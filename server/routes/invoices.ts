import { Router, Request } from 'express';
import { prisma } from '../db';
import { serializeEntry, serializeInvoice } from '../mappers';
import { findAccessibleDossier, actorName } from '../access';
import { getAuthUser } from '../auth';
import { handler } from '../http';
import { validateInvoiceInput, identifier, isoDate, positiveMoney, optionalText, PAYMENT_METHODS, InvoiceInputData, unwrap } from '../validation';
import { computeInvoiceTotals, invoicePostings, paidAmount, settlementAmount, isSupplierSide, KIND_PREFIX, KIND_LABEL } from '../../src/utils/invoices';
import { treasuryAccountFor } from '../../src/utils/paymentAccounts';
import type { PaymentMethod } from '../../src/types';
import { assertAccountsUsable, lockError, linesCreate, numberer, withNumberRetry } from './entries';
import { simpleLines, defaultJournal } from '../../src/utils/entryLines';
import { ENTRY_INCLUDE } from './bootstrap';

/**
 * Facturation (factures clients, avoirs, factures fournisseurs) :
 * brouillon → en attente → validée (écritures générées) → annulée.
 * Lettrage : rattachement de règlements (crédit 411 ou débit 401) aux factures validées.
 */
const router = Router();

export const INVOICE_INCLUDE = { lines: true, payments: true } as const;

/** Facture d'origine d'un avoir, renvoyée à jour (son lettrage change avec l'avoir). */
async function relatedInvoices(originalInvoiceId: string | null) {
  if (!originalInvoiceId) return [];
  const row = await prisma.invoice.findUnique({ where: { id: originalInvoiceId }, include: INVOICE_INCLUDE });
  return row ? [serializeInvoice(row)] : [];
}

async function findAccessibleInvoice(req: Request, id: string | null) {
  if (!id) return null;
  const inv = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
  if (!inv || !(await findAccessibleDossier(req, inv.clientDossierId))) return null;
  return inv;
}

function invoiceData(d: InvoiceInputData) {
  const totals = computeInvoiceTotals(d.lines, d.vatRate);
  return {
    kind: d.kind,
    externalRef: d.externalRef,
    originalInvoiceId: d.originalInvoiceId,
    date: new Date(d.date),
    dueDate: new Date(d.dueDate),
    mode: d.mode,
    paymentMethod: d.paymentMethod as any,
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    customerEmail: d.customerEmail,
    customerAddress: d.customerAddress,
    customerTaxId: d.customerTaxId,
    customerAccountCode: d.customerAccountCode,
    salesAccountCode: d.salesAccountCode,
    vatRate: d.vatRate,
    totalHT: totals.totalHT,
    totalTVA: totals.totalTVA,
    totalTTC: totals.totalTTC,
    paymentTerms: d.paymentTerms,
    notes: d.notes,
    lines: {
      create: d.lines.map((l, i) => ({ position: i, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amountHT: totals.amounts[i] })),
    },
  };
}

/** Numéro séquentiel par dossier, par type et par année : FAC-2026-0001, AV-2026-0001, FF-2026-0001. */
async function nextNumber(dossierId: string, date: string, kind: InvoiceInputData['kind']) {
  const prefix = `${KIND_PREFIX[kind]}-${date.slice(0, 4)}-`;
  const last = await prisma.invoice.findFirst({
    where: { clientDossierId: dossierId, number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const n = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

async function checkAccounts(d: InvoiceInputData, dossierId: string) {
  const codes = [d.customerAccountCode, d.salesAccountCode, d.kind === 'purchase' ? '4452' : '4431'];
  if (d.mode === 'cash' && d.paymentMethod) codes.push(treasuryAccountFor(d.paymentMethod as PaymentMethod).code);
  return assertAccountsUsable(codes, dossierId);
}

/**
 * Avoir : la facture d'origine est une facture client validée du même dossier, et le total des avoirs
 * (hors annulés) ne dépasse pas son TTC. Retourne un message d'erreur ou null.
 */
async function creditNoteError(d: { kind: string; originalInvoiceId: string | null; totalTTC: number }, dossierId: string, selfId?: string) {
  if (d.kind !== 'credit_note') return null;
  const orig = d.originalInvoiceId ? await prisma.invoice.findUnique({ where: { id: d.originalInvoiceId }, include: { creditNotes: true } }) : null;
  if (!orig || orig.clientDossierId !== dossierId || orig.kind !== 'sale') return "Facture d'origine introuvable dans ce dossier.";
  if (orig.status !== 'validated') return "La facture d'origine doit être validée.";
  const already = orig.creditNotes.filter(c => c.id !== selfId && c.status !== 'cancelled').reduce((s, c) => s + Number(c.totalTTC), 0);
  const max = Number(orig.totalTTC) - already;
  return d.totalTTC > max + 0.001 ? `L'avoir dépasse le montant restant à créditer sur ${orig.number} (${max.toLocaleString('fr-FR')}).` : null;
}

router.post('/invoices', handler(async (req, res) => {
  const dossierId = identifier((req.body ?? {}).clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });
  const d = unwrap(validateInvoiceInput(req.body));
  const accountError = await checkAccounts(d, dossier.id) ?? await creditNoteError({ ...d, totalTTC: computeInvoiceTotals(d.lines, d.vatRate).totalTTC }, dossier.id);
  if (accountError) return res.status(400).json({ error: accountError });

  // Deux créations simultanées peuvent tirer le même numéro : on réessaie sur conflit d'unicité.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await prisma.invoice.create({
        data: {
          ...invoiceData(d),
          clientDossierId: dossier.id,
          number: await nextNumber(dossier.id, d.date, d.kind),
          status: req.body?.submit === true ? 'pending_review' : 'draft',
          createdById: getAuthUser(req)!.sub,
        },
        include: INVOICE_INCLUDE,
      });
      return res.status(201).json(serializeInvoice(row));
    } catch (e: any) {
      if (e?.code !== 'P2002' || attempt === 2) throw e;
    }
  }
}));

router.post('/invoices/:id/update', handler(async (req, res) => {
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  if (inv.status !== 'draft' && inv.status !== 'pending_review') {
    return res.status(409).json({ error: 'Facture validée ou annulée : modification impossible.' });
  }
  const d = unwrap(validateInvoiceInput({ ...req.body, kind: inv.kind, originalInvoiceId: inv.originalInvoiceId }));
  const accountError = await checkAccounts(d, inv.clientDossierId)
    ?? await creditNoteError({ ...d, totalTTC: computeInvoiceTotals(d.lines, d.vatRate).totalTTC }, inv.clientDossierId, inv.id);
  if (accountError) return res.status(400).json({ error: accountError });

  const [, row] = await prisma.$transaction([
    prisma.invoiceLine.deleteMany({ where: { invoiceId: inv.id } }),
    prisma.invoice.update({
      where: { id: inv.id },
      data: { ...invoiceData(d), status: req.body?.submit === true ? 'pending_review' : inv.status, updatedById: getAuthUser(req)!.sub },
      include: INVOICE_INCLUDE,
    }),
  ]);
  res.json(serializeInvoice(row));
}));

router.post('/invoices/:id/submit', handler(async (req, res) => {
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  if (inv.status !== 'draft') return res.status(409).json({ error: 'Seul un brouillon peut être soumis.' });
  const row = await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'pending_review' }, include: INVOICE_INCLUDE });
  res.json(serializeInvoice(row));
}));

/**
 * Validation définitive : génère les écritures 411 / 70x / 4431 (+ règlement au comptant),
 * toutes validées et rattachées à la facture. Réponse : { invoice, entries }.
 * Tout utilisateur ayant accès au dossier émet directement depuis le brouillon.
 */
router.post('/invoices/:id/validate', handler(async (req, res) => {
  const user = getAuthUser(req)!;
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  if (!['draft', 'pending_review'].includes(inv.status)) return res.status(409).json({ error: 'Cette facture ne peut plus être validée.' });
  const dossier = await prisma.clientDossier.findUniqueOrThrow({ where: { id: inv.clientDossierId } });
  const locked = lockError(dossier, inv.date)
    ?? await creditNoteError({ kind: inv.kind, originalInvoiceId: inv.originalInvoiceId, totalTTC: Number(inv.totalTTC) }, inv.clientDossierId, inv.id);
  if (locked) return res.status(409).json({ error: locked });

  const author = await actorName(req);
  const invoice = serializeInvoice(inv);
  const treasury = invoice.paymentMethod ? treasuryAccountFor(invoice.paymentMethod).code : undefined;
  const { sale, payment } = invoicePostings(invoice, treasury);
  const now = new Date();
  const base = {
    date: inv.date,
    pieceRef: inv.number,
    clientDossierId: inv.clientDossierId,
    status: 'validated' as const,
    rawInput: `${KIND_LABEL[inv.kind]} ${inv.number}`,
    inputType: 'manual' as const,
    paymentMethod: (inv.paymentMethod ?? 'bank_transfer') as any,
    createdById: inv.createdById,
    validatedById: user.sub,
    validatedAt: now,
    invoiceId: inv.id,
  };
  const entryData = (p: typeof sale, number: number) => ({
    ...base,
    label: p.label,
    journal: p.journal,
    number,
    amount: p.amount,
    lines: linesCreate(p.lines),
    explanationSimplified: `${p.label} : ${p.amount.toLocaleString('fr-FR')}.`,
    auditTrail: { create: { action: 'validated_by_expert' as const, author, notes: `Générée à la validation de ${KIND_LABEL[inv.kind].toLowerCase()} ${inv.number}.` } },
  });

  const created = await withNumberRetry(() => prisma.$transaction(async tx => {
    const next = numberer(tx, inv.clientDossierId);
    const saleEntry = await tx.journalEntry.create({ data: entryData(sale, await next(sale.journal)) });
    const ids = [saleEntry.id];
    // Avoir : imputé d'office sur la facture d'origine, à hauteur de son reste dû.
    if (inv.kind === 'credit_note' && inv.originalInvoiceId) {
      const orig = await tx.invoice.findUniqueOrThrow({ where: { id: inv.originalInvoiceId }, include: { payments: true } });
      const due = Number(orig.totalTTC) - orig.payments.reduce((s, p) => s + Number(p.amount), 0);
      const amount = Math.min(due, Number(inv.totalTTC));
      if (amount > 0) await tx.invoicePayment.create({ data: { invoiceId: orig.id, entryId: saleEntry.id, amount, createdById: user.sub } });
    }
    if (payment) {
      const pay = await tx.journalEntry.create({ data: entryData(payment, await next(payment.journal)) });
      ids.push(pay.id);
      await tx.invoicePayment.create({ data: { invoiceId: inv.id, entryId: pay.id, amount: payment.amount, createdById: user.sub } });
    }
    await tx.invoice.update({ where: { id: inv.id }, data: { status: 'validated', validatedById: user.sub, validatedAt: now } });
    return ids;
  }));

  const [fresh, entries] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: INVOICE_INCLUDE }),
    prisma.journalEntry.findMany({ where: { id: { in: created } }, include: ENTRY_INCLUDE }),
  ]);
  res.json({ invoice: serializeInvoice(fresh), entries: entries.map(serializeEntry), related: await relatedInvoices(inv.originalInvoiceId) });
}));

/**
 * Annulation par tout utilisateur ayant accès au dossier.
 * Facture validée : ses écritures sont annulées et son lettrage supprimé.
 */
router.post('/invoices/:id/cancel', handler(async (req, res) => {
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  if (inv.status === 'cancelled') return res.status(409).json({ error: 'Facture déjà annulée.' });
  const activeCreditNotes = await prisma.invoice.count({ where: { originalInvoiceId: inv.id, status: { not: 'cancelled' } } });
  if (activeCreditNotes) return res.status(409).json({ error: 'Cette facture a un avoir : annulez d’abord l’avoir.' });
  if (inv.status === 'validated') {
    const locked = lockError(await prisma.clientDossier.findUniqueOrThrow({ where: { id: inv.clientDossierId } }), inv.date);
    if (locked) return res.status(409).json({ error: `${locked} Établissez plutôt un avoir.` });
  }
  const author = await actorName(req);
  const reason = optionalText((req.body ?? {}).reason, 300) ?? `Annulation de la facture ${inv.number}.`;
  const generated = await prisma.journalEntry.findMany({ where: { invoiceId: inv.id }, select: { id: true } });

  await prisma.$transaction([
    // Lettrages de la facture, et ceux de ses écritures (un avoir imputé sur sa facture d'origine).
    prisma.invoicePayment.deleteMany({ where: { OR: [{ invoiceId: inv.id }, { entryId: { in: generated.map(e => e.id) } }] } }),
    ...generated.map(e => prisma.journalEntry.update({
      where: { id: e.id },
      data: { status: 'cancelled', auditTrail: { create: { action: 'cancelled', author, notes: reason } } },
    })),
    prisma.invoice.update({ where: { id: inv.id }, data: { status: 'cancelled' } }),
  ]);

  const [fresh, entries] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: INVOICE_INCLUDE }),
    prisma.journalEntry.findMany({ where: { invoiceId: inv.id }, include: ENTRY_INCLUDE }),
  ]);
  res.json({ invoice: serializeInvoice(fresh), entries: entries.map(serializeEntry), related: await relatedInvoices(inv.originalInvoiceId) });
}));

/**
 * Lettrage d'un règlement sur une facture validée :
 *  - { entryId, amount } : règlement déjà saisi (écriture au crédit d'un compte 411 du dossier) ;
 *  - { newPayment: { date, amount, paymentMethod } } : crée l'écriture de règlement (validée d'office).
 * Réponse : { invoice, entry }.
 */
router.post('/invoices/:id/payments', handler(async (req, res) => {
  const user = getAuthUser(req)!;
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  if (inv.status !== 'validated') return res.status(409).json({ error: 'Seule une facture validée peut être lettrée.' });
  if (inv.kind === 'credit_note') return res.status(409).json({ error: "Un avoir s'impute sur sa facture d'origine." });
  const supplier = isSupplierSide(inv.kind);
  const remaining = Number(inv.totalTTC) - paidAmount(serializeInvoice(inv));
  const body = req.body ?? {};

  let entryId: string;
  let amount: number;
  if (body.newPayment) {
    const np = body.newPayment;
    const date = isoDate(np.date);
    amount = positiveMoney(np.amount) ?? 0;
    const method = PAYMENT_METHODS.find(m => m === np.paymentMethod);
    if (!date || !amount || !method) return res.status(400).json({ error: 'Règlement invalide (date, montant et mode requis).' });
    if (amount > remaining) return res.status(400).json({ error: `Le règlement dépasse le reste dû (${remaining.toLocaleString('fr-FR')}).` });
    const treasury = treasuryAccountFor(method).code;
    const accountError = await assertAccountsUsable([treasury, inv.customerAccountCode], inv.clientDossierId);
    if (accountError) return res.status(400).json({ error: accountError });
    const locked = lockError(await prisma.clientDossier.findUniqueOrThrow({ where: { id: inv.clientDossierId } }), date);
    if (locked) return res.status(409).json({ error: locked });
    const label = `${supplier ? 'Paiement' : 'Règlement'} ${KIND_LABEL[inv.kind].toLowerCase()} ${inv.number} — ${inv.customerName}`;
    const author = await actorName(req);
    const lines = supplier ? simpleLines(inv.customerAccountCode, treasury, amount) : simpleLines(treasury, inv.customerAccountCode, amount);
    const journal = defaultJournal(lines);
    // Le règlement saisi par un utilisateur du dossier est validé d'office.
    const entry = await withNumberRetry(async () => prisma.journalEntry.create({
      data: {
        date: new Date(date), label, pieceRef: optionalText(np.pieceRef, 80) ?? `REG-${inv.number}`,
        journal, number: await numberer(prisma, inv.clientDossierId)(journal),
        lines: linesCreate(lines),
        amount, clientDossierId: inv.clientDossierId,
        status: 'validated', validatedById: user.sub, validatedAt: new Date(),
        rawInput: label, inputType: 'manual', paymentMethod: method as any,
        explanationSimplified: `${label} : ${amount.toLocaleString('fr-FR')} ${supplier ? 'payés' : 'encaissés'}.`,
        createdById: user.sub,
        auditTrail: { create: { action: 'edited_by_expert', author, notes: `Règlement saisi et lettré sur ${inv.number}.` } },
      },
    }));
    entryId = entry.id;
  } else {
    const id = identifier(body.entryId);
    const entry = id ? await prisma.journalEntry.findUnique({ where: { id }, include: { payments: true, lines: true } }) : null;
    if (!entry || entry.clientDossierId !== inv.clientDossierId) return res.status(404).json({ error: 'Règlement introuvable dans ce dossier.' });
    if (entry.status === 'cancelled') return res.status(409).json({ error: 'Règlement annulé.' });
    const settled = settlementAmount({ lines: entry.lines.map(l => ({ accountCode: l.accountCode, debit: Number(l.debit), credit: Number(l.credit) })) }, inv.kind);
    if (settled <= 0) return res.status(400).json({ error: supplier ? 'Un paiement fournisseur doit débiter un compte 40x.' : 'Un règlement client doit créditer un compte 411.' });
    const free = settled - entry.payments.reduce((s, p) => s + Number(p.amount), 0);
    amount = positiveMoney(body.amount) ?? Math.min(free, remaining);
    if (amount <= 0 || amount > free + 0.001) return res.status(400).json({ error: `Montant supérieur au disponible du règlement (${free.toLocaleString('fr-FR')}).` });
    if (amount > remaining + 0.001) return res.status(400).json({ error: `Montant supérieur au reste dû (${remaining.toLocaleString('fr-FR')}).` });
    entryId = entry.id;
  }

  await prisma.invoicePayment.create({ data: { invoiceId: inv.id, entryId, amount, createdById: user.sub } });
  const [fresh, entry] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: INVOICE_INCLUDE }),
    prisma.journalEntry.findUniqueOrThrow({ where: { id: entryId }, include: ENTRY_INCLUDE }),
  ]);
  res.status(201).json({ invoice: serializeInvoice(fresh), entry: serializeEntry(entry) });
}));

/**
 * Suppression d'un brouillon jamais validé (aucune écriture). Une facture client ou un avoir ne se supprime
 * que s'il porte le dernier numéro de sa série (pas de trou dans la numérotation) ; sinon : annulation.
 */
router.post('/invoices/:id/delete', handler(async (req, res) => {
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  if (inv.status !== 'draft' && inv.status !== 'pending_review') {
    return res.status(409).json({ error: 'Seul un brouillon jamais validé se supprime ; une facture validée s’annule.' });
  }
  if (inv.kind !== 'purchase') {
    const prefix = inv.number.slice(0, inv.number.lastIndexOf('-') + 1);
    const last = await prisma.invoice.findFirst({ where: { clientDossierId: inv.clientDossierId, number: { startsWith: prefix } }, orderBy: { number: 'desc' }, select: { id: true } });
    if (last?.id !== inv.id) return res.status(409).json({ error: `${inv.number} n'est pas le dernier numéro : annulez-la pour garder une numérotation sans trou.` });
  }
  await prisma.invoice.delete({ where: { id: inv.id } });
  res.status(204).end();
}));

/** Délettrage. Le règlement comptant généré par la facture ne se délettre pas (annuler la facture). */
router.post('/invoice-payments/:id/delete', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const p = id ? await prisma.invoicePayment.findUnique({ where: { id }, include: { entry: { select: { invoiceId: true } } } }) : null;
  const inv = p ? await findAccessibleInvoice(req, p.invoiceId) : null;
  if (!p || !inv) return res.status(404).json({ error: 'Lettrage introuvable.' });
  if (p.entry.invoiceId === inv.id) return res.status(409).json({ error: 'Règlement comptant de la facture : annulez la facture.' });
  await prisma.invoicePayment.delete({ where: { id: p.id } });
  const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: INVOICE_INCLUDE });
  res.json(serializeInvoice(fresh));
}));

export default router;

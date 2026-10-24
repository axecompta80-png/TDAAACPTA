import { Router, Request } from 'express';
import { prisma } from '../db';
import { serializeEntry, serializeInvoice } from '../mappers';
import { findAccessibleDossier, canValidate, canUnvalidate, actorName, ownsDossier } from '../access';
import { getAuthUser } from '../auth';
import { handler } from '../http';
import { validateInvoiceInput, identifier, isoDate, positiveMoney, optionalText, PAYMENT_METHODS, InvoiceInputData, unwrap } from '../validation';
import { computeInvoiceTotals, invoicePostings, paidAmount } from '../../src/utils/invoices';
import { treasuryAccountFor } from '../../src/utils/paymentAccounts';
import type { PaymentMethod } from '../../src/types';
import { assertAccountsUsable, isOwnWork } from './entries';
import { ENTRY_INCLUDE } from './bootstrap';

/**
 * Facturation : brouillon → en attente → validée (écritures générées) → annulée.
 * Lettrage : rattachement de règlements (crédit 411) aux factures validées.
 */
const router = Router();

export const INVOICE_INCLUDE = { lines: true, payments: true } as const;

async function findAccessibleInvoice(req: Request, id: string | null) {
  if (!id) return null;
  const inv = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
  if (!inv || !(await findAccessibleDossier(req, inv.clientDossierId))) return null;
  return inv;
}

function invoiceData(d: InvoiceInputData) {
  const totals = computeInvoiceTotals(d.lines, d.vatRate);
  return {
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

/** Numéro séquentiel par dossier et par année : FAC-2026-0001. */
async function nextNumber(dossierId: string, date: string) {
  const prefix = `FAC-${date.slice(0, 4)}-`;
  const last = await prisma.invoice.findFirst({
    where: { clientDossierId: dossierId, number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const n = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

async function checkAccounts(d: InvoiceInputData, dossierId: string) {
  const codes = [d.customerAccountCode, d.salesAccountCode, '4431'];
  if (d.mode === 'cash' && d.paymentMethod) codes.push(treasuryAccountFor(d.paymentMethod as PaymentMethod).code);
  return assertAccountsUsable(codes, dossierId);
}

router.post('/invoices', handler(async (req, res) => {
  const dossierId = identifier((req.body ?? {}).clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });
  const d = unwrap(validateInvoiceInput(req.body));
  const accountError = await checkAccounts(d, dossier.id);
  if (accountError) return res.status(400).json({ error: accountError });

  // Deux créations simultanées peuvent tirer le même numéro : on réessaie sur conflit d'unicité.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await prisma.invoice.create({
        data: {
          ...invoiceData(d),
          clientDossierId: dossier.id,
          number: await nextNumber(dossier.id, d.date),
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
  const d = unwrap(validateInvoiceInput(req.body));
  const accountError = await checkAccounts(d, inv.clientDossierId);
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
 * Le propriétaire du dossier émet directement depuis le brouillon ; les autres profils
 * valident une facture en attente qu'ils n'ont pas saisie.
 */
router.post('/invoices/:id/validate', handler(async (req, res) => {
  const user = getAuthUser(req)!;
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  const owner = await ownsDossier(req, inv.clientDossierId);
  if (!owner && !canValidate(user.role)) return res.status(403).json({ error: 'Validation réservée au propriétaire du dossier.' });
  const validatable = owner ? ['draft', 'pending_review'] : ['pending_review'];
  if (!validatable.includes(inv.status)) return res.status(409).json({ error: 'Cette facture ne peut plus être validée.' });
  if (!owner && isOwnWork(inv, user.sub)) {
    return res.status(403).json({ error: 'Séparation des tâches : vous avez saisi ou modifié cette facture.' });
  }

  const author = await actorName(req);
  const invoice = serializeInvoice(inv);
  const treasury = invoice.paymentMethod ? treasuryAccountFor(invoice.paymentMethod).code : undefined;
  const { sale, payment } = invoicePostings(invoice, treasury);
  const now = new Date();
  const base = {
    date: inv.date,
    pieceRef: inv.number,
    tvaAmount: 0, // la TVA est portée par sa propre écriture sur le 4431
    clientDossierId: inv.clientDossierId,
    status: 'validated' as const,
    confidenceScore: 100,
    rawInput: `Facture ${inv.number}`,
    inputType: 'manual' as const,
    paymentMethod: (inv.paymentMethod ?? 'bank_transfer') as any,
    createdById: inv.createdById,
    validatedById: user.sub,
    validatedAt: now,
    invoiceId: inv.id,
  };
  const entryData = (p: { debit: string; credit: string; amount: number; label: string }) => ({
    ...base,
    label: p.label,
    debitAccountCode: p.debit,
    creditAccountCode: p.credit,
    amount: p.amount,
    explanationSimplified: `${p.label} : ${p.amount.toLocaleString('fr-FR')} (débit ${p.debit} / crédit ${p.credit}).`,
    auditTrail: { create: { action: 'validated_by_expert' as const, author, notes: `Générée à la validation de la facture ${inv.number}.` } },
  });

  const created = await prisma.$transaction(async tx => {
    const ids: string[] = [];
    for (const p of sale) {
      ids.push((await tx.journalEntry.create({ data: entryData(p) })).id);
    }
    if (payment) {
      const pay = await tx.journalEntry.create({ data: entryData(payment) });
      ids.push(pay.id);
      await tx.invoicePayment.create({ data: { invoiceId: inv.id, entryId: pay.id, amount: payment.amount, createdById: user.sub } });
    }
    await tx.invoice.update({ where: { id: inv.id }, data: { status: 'validated', validatedById: user.sub, validatedAt: now } });
    return ids;
  });

  const [fresh, entries] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: INVOICE_INCLUDE }),
    prisma.journalEntry.findMany({ where: { id: { in: created } }, include: ENTRY_INCLUDE }),
  ]);
  res.json({ invoice: serializeInvoice(fresh), entries: entries.map(serializeEntry) });
}));

/**
 * Annulation. Brouillon / en attente : par tout profil de saisie.
 * Facture validée : propriétaire du dossier, Chef comptable ou administrateur ; ses écritures sont annulées et son lettrage supprimé.
 */
router.post('/invoices/:id/cancel', handler(async (req, res) => {
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  if (inv.status === 'cancelled') return res.status(409).json({ error: 'Facture déjà annulée.' });
  if (inv.status === 'validated' && !canUnvalidate(getAuthUser(req)?.role) && !(await ownsDossier(req, inv.clientDossierId))) {
    return res.status(403).json({ error: "Annulation d'une facture validée réservée au propriétaire du dossier." });
  }
  const author = await actorName(req);
  const reason = optionalText((req.body ?? {}).reason, 300) ?? `Annulation de la facture ${inv.number}.`;
  const generated = await prisma.journalEntry.findMany({ where: { invoiceId: inv.id }, select: { id: true } });

  await prisma.$transaction([
    prisma.invoicePayment.deleteMany({ where: { invoiceId: inv.id } }),
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
  res.json({ invoice: serializeInvoice(fresh), entries: entries.map(serializeEntry) });
}));

/**
 * Lettrage d'un règlement sur une facture validée :
 *  - { entryId, amount } : règlement déjà saisi (écriture au crédit d'un compte 411 du dossier) ;
 *  - { newPayment: { date, amount, paymentMethod } } : crée l'écriture de règlement (validée d'office pour le propriétaire du dossier, sinon en attente).
 * Réponse : { invoice, entry }.
 */
router.post('/invoices/:id/payments', handler(async (req, res) => {
  const user = getAuthUser(req)!;
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
  if (inv.status !== 'validated') return res.status(409).json({ error: 'Seule une facture validée peut être lettrée.' });
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
    const label = `Règlement facture ${inv.number} — ${inv.customerName}`;
    const author = await actorName(req);
    // Le propriétaire saisit lui-même son règlement : il est validé d'office.
    const owner = await ownsDossier(req, inv.clientDossierId);
    const entry = await prisma.journalEntry.create({
      data: {
        date: new Date(date), label, pieceRef: optionalText(np.pieceRef, 80) ?? `REG-${inv.number}`,
        debitAccountCode: treasury, creditAccountCode: inv.customerAccountCode,
        amount, tvaAmount: 0, clientDossierId: inv.clientDossierId,
        ...(owner ? { status: 'validated' as const, validatedById: user.sub, validatedAt: new Date() } : { status: 'pending_review' as const }),
        confidenceScore: 100, rawInput: label, inputType: 'manual', paymentMethod: method as any,
        explanationSimplified: `${label} : ${amount.toLocaleString('fr-FR')} encaissés.`,
        createdById: user.sub,
        auditTrail: { create: { action: 'edited_by_expert', author, notes: `Règlement saisi et lettré sur ${inv.number}.` } },
      },
    });
    entryId = entry.id;
  } else {
    const id = identifier(body.entryId);
    const entry = id ? await prisma.journalEntry.findUnique({ where: { id }, include: { payments: true } }) : null;
    if (!entry || entry.clientDossierId !== inv.clientDossierId) return res.status(404).json({ error: 'Règlement introuvable dans ce dossier.' });
    if (entry.status === 'cancelled') return res.status(409).json({ error: 'Règlement annulé.' });
    if (!entry.creditAccountCode.startsWith('411')) return res.status(400).json({ error: 'Un règlement client doit créditer un compte 411.' });
    const free = Number(entry.amount) - entry.payments.reduce((s, p) => s + Number(p.amount), 0);
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

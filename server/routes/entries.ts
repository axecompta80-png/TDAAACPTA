import { Router, Request } from 'express';
import { prisma } from '../db';
import { serializeEntry } from '../mappers';
import { findAccessibleDossier, findAccessibleEntry, actorName } from '../access';
import { getAuthUser } from '../auth';
import { handler } from '../http';
import { validateEntryInput, identifier, optionalReason, isoDate, EntryInput, unwrap } from '../validation';
import { ENTRY_INCLUDE } from './bootstrap';
import { isLocked, reversedLines } from '../../src/utils/entryLines';
import type { JournalCode, JournalLine } from '../../src/types';

const router = Router();

/** Statuts encore modifiables par un saisisseur. */
const EDITABLE = ['draft', 'pending_review', 'anomaly'];

type Tx = { journalEntry: Pick<typeof prisma.journalEntry, "aggregate"> };

/**
 * Vérifie que les comptes existent, sont actifs et appartiennent au plan standard
 * ou au plan propre du dossier (évite une erreur de clé étrangère).
 */
export async function assertAccountsUsable(codes: string[], dossierId: string): Promise<string | null> {
  const unique = [...new Set(codes)];
  const found = await prisma.syscohadaAccount.findMany({
    where: { code: { in: unique }, active: true, OR: [{ dossierId: null }, { dossierId }] },
    select: { code: true },
  });
  const known = new Set(found.map(f => f.code));
  const missing = unique.filter(c => !known.has(c));
  return missing.length ? `Compte inconnu ou inactif pour ce dossier : ${missing.join(', ')}.` : null;
}

const fr = (d: string) => d.split('-').reverse().join('/');

/** Message si la date tombe dans la période bloquée du dossier, sinon null. */
export function lockError(dossier: { lockedUntil: Date | null }, date: string | Date): string | null {
  const until = dossier.lockedUntil?.toISOString().slice(0, 10);
  const day = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
  return isLocked(day, until)
    ? `Période bloquée jusqu'au ${fr(until!)} (déclarée ou clôturée) : aucune écriture ne peut y être ajoutée ou modifiée. Pour corriger, passez une contre-passation à une date ultérieure.`
    : null;
}

async function dossierOf(id: string) {
  return prisma.clientDossier.findUniqueOrThrow({ where: { id }, select: { id: true, lockedUntil: true } });
}

function userId(req: Request): string {
  return getAuthUser(req)!.sub;
}

/**
 * Une écriture sans anomalie est validée dès l'enregistrement (aucun seuil de confiance).
 * Les anomalies et les brouillons attendent leur vérification.
 */
export function autoValidates(e: Pick<EntryInput, 'status' | 'detectedAnomaly'>): boolean {
  return e.status === 'pending_review' && !e.detectedAnomaly;
}

function autoValidationData(author: string, uid: string) {
  return {
    status: 'validated' as const,
    validatedById: uid,
    validatedAt: new Date(),
    auditTrail: { create: { action: 'auto_validated' as const, author, notes: 'Validée automatiquement (aucune anomalie détectée).' } },
  };
}

export const linesCreate = (lines: JournalLine[]) => ({
  create: lines.map((l, position) => ({ position, accountCode: l.accountCode, label: l.label, debit: l.debit, credit: l.credit })),
});

/** Prochains numéros d'ordre par journal d'un dossier (un compteur local par appel). */
export function numberer(tx: Tx, dossierId: string) {
  const next = new Map<JournalCode, number>();
  return async (journal: JournalCode) => {
    if (!next.has(journal)) {
      const last = await tx.journalEntry.aggregate({ where: { clientDossierId: dossierId, journal }, _max: { number: true } });
      next.set(journal, (last._max.number ?? 0) + 1);
    }
    const n = next.get(journal)!;
    next.set(journal, n + 1);
    return n;
  };
}

export const defaultPieceRef = (journal: JournalCode, n: number) => `${journal}-${String(n).padStart(5, '0')}`;

/** Deux saisies simultanées peuvent tirer le même numéro : on réessaie sur conflit d'unicité. */
export async function withNumberRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      if (e?.code !== 'P2002' || attempt === 2) throw e;
    }
  }
}

function entryCreateData(e: EntryInput, dossierId: string, number: number, createdById: string, author: string) {
  const auto = autoValidates(e);
  return {
    id: e.id,
    date: new Date(e.date),
    label: e.label,
    pieceRef: e.pieceRef || defaultPieceRef(e.journal, number),
    journal: e.journal,
    number,
    amount: e.amount,
    lines: linesCreate(e.lines),
    clientDossierId: dossierId,
    status: e.status as any,
    detectedAnomaly: e.detectedAnomaly,
    rawInput: e.rawInput,
    inputType: e.inputType as any,
    explanationSimplified: e.explanationSimplified,
    paymentMethod: e.paymentMethod as any,
    createdById,
    ...(auto ? { status: 'validated' as const, validatedById: createdById, validatedAt: new Date() } : {}),
    auditTrail: {
      create: [...e.auditTrail.map(a => ({
        id: a.id,
        timestamp: new Date(a.timestamp),
        action: a.action as any,
        author: a.author,
        notes: a.notes,
        previousValue: a.previousValue,
      })), ...(auto ? [autoValidationData(author, createdById).auditTrail.create] : [])],
    },
  };
}

/** Création d'une écriture rattachée à un dossier accessible au requérant (brouillon ou en attente). */
router.post('/entries', handler(async (req, res) => {
  const dossierId = identifier((req.body ?? {}).clientDossierId);
  if (!dossierId) return res.status(400).json({ error: 'Dossier comptable invalide.' });
  const dossier = await findAccessibleDossier(req, dossierId);
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });

  const e = unwrap(validateEntryInput(req.body));
  const locked = lockError(dossier, e.date);
  if (locked) return res.status(409).json({ error: locked });

  const accountError = await assertAccountsUsable(e.lines.map(l => l.accountCode), dossierId);
  if (accountError) return res.status(400).json({ error: accountError });

  const author = await actorName(req);
  const created = await withNumberRetry(() => prisma.$transaction(async tx => {
    const number = await numberer(tx, dossierId)(e.journal);
    return tx.journalEntry.create({ data: entryCreateData(e, dossierId, number, userId(req), author), include: ENTRY_INCLUDE });
  }));
  res.status(201).json(serializeEntry(created));
}));

/** Import (Excel ou lot) : chaque écriture est validée et rattachée à un dossier accessible. */
router.post('/entries/import', handler(async (req, res) => {
  const list = Array.isArray((req.body ?? {}).entries) ? (req.body.entries as unknown[]) : [];
  if (list.length === 0) return res.status(400).json({ error: 'Aucune écriture à importer.' });
  if (list.length > 5000) return res.status(400).json({ error: 'Import limité à 5000 écritures par opération.' });

  const author = await actorName(req);
  // Tout est vérifié avant d'écrire : une ligne refusée n'enregistre aucune ligne (pas d'import à moitié).
  const rows: { e: EntryInput; dossierId: string }[] = [];
  for (const raw of list) {
    const dossierId = identifier((raw as any)?.clientDossierId);
    if (!dossierId) return res.status(400).json({ error: 'Une écriture importée référence un dossier invalide.' });
    const dossier = await findAccessibleDossier(req, dossierId);
    if (!dossier) return res.status(403).json({ error: 'Import refusé : dossier hors de votre périmètre.' });

    const e = unwrap(validateEntryInput(raw, { requireId: true }));
    const locked = lockError(dossier, e.date);
    if (locked) return res.status(409).json({ error: `« ${e.label} » : ${locked}` });

    const accountError = await assertAccountsUsable(e.lines.map(l => l.accountCode), dossierId);
    if (accountError) return res.status(400).json({ error: accountError });

    rows.push({ e, dossierId });
  }
  const created = await withNumberRetry(() => prisma.$transaction(async tx => {
    const numbers = new Map<string, ReturnType<typeof numberer>>();
    const out = [];
    for (const { e, dossierId } of rows) {
      if (!numbers.has(dossierId)) numbers.set(dossierId, numberer(tx, dossierId));
      const number = await numbers.get(dossierId)!(e.journal);
      out.push(await tx.journalEntry.create({ data: entryCreateData(e, dossierId, number, userId(req), author), include: ENTRY_INCLUDE }));
    }
    return out;
  }, { timeout: 120_000, maxWait: 10_000 }));
  res.status(201).json(created.map(serializeEntry));
}));

/**
 * Mise à jour d'une écriture : POST /entries/:id/update.
 * Interdite une fois validée ou annulée (il faut d'abord la dévalider). La piste d'audit ne s'efface jamais.
 */
router.post('/entries/:id/update', handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant d\'écriture invalide.' });
  const existing = await findAccessibleEntry(req, id);
  if (!existing) return res.status(404).json({ error: 'Écriture introuvable.' });
  if (!EDITABLE.includes(existing.status)) {
    return res.status(409).json({ error: 'Écriture validée ou annulée : modification impossible (dévalidez-la ou contre-passez-la).' });
  }
  if (existing.invoiceId) {
    return res.status(409).json({ error: 'Écriture générée par une facture : modifiez la facture.' });
  }

  const e = unwrap(validateEntryInput(req.body));
  const dossier = await dossierOf(existing.clientDossierId);
  const locked = lockError(dossier, existing.date) ?? lockError(dossier, e.date);
  if (locked) return res.status(409).json({ error: locked });

  const accountError = await assertAccountsUsable(e.lines.map(l => l.accountCode), existing.clientDossierId);
  if (accountError) return res.status(400).json({ error: accountError });

  const auto = autoValidates(e);

  await withNumberRetry(() => prisma.$transaction(async tx => {
    // Changement de journal : nouveau numéro dans le journal d'arrivée.
    const number = e.journal === existing.journal ? existing.number : await numberer(tx, existing.clientDossierId)(e.journal);
    // Numéro de pièce automatique : suit le journal ; une référence saisie est conservée.
    const keepRef = e.pieceRef && e.pieceRef !== defaultPieceRef(existing.journal, existing.number);
    await tx.journalLine.deleteMany({ where: { entryId: id } });
    await tx.journalEntry.update({
      where: { id },
      data: {
        date: new Date(e.date),
        label: e.label,
        pieceRef: keepRef ? e.pieceRef : defaultPieceRef(e.journal, number),
        journal: e.journal,
        number,
        amount: e.amount,
        lines: linesCreate(e.lines),
        status: e.status as any,
        detectedAnomaly: e.detectedAnomaly ?? null,
        rawInput: e.rawInput,
        inputType: e.inputType as any,
        explanationSimplified: e.explanationSimplified,
        paymentMethod: e.paymentMethod as any,
        updatedById: userId(req),
      },
    });
  }));

  for (const a of e.auditTrail) {
    await prisma.auditLog.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        journalEntryId: id,
        timestamp: new Date(a.timestamp),
        action: a.action as any,
        author: a.author,
        notes: a.notes,
        previousValue: a.previousValue,
      },
    });
  }
  if (auto) {
    await prisma.journalEntry.update({ where: { id }, data: { ...autoValidationData(await actorName(req), userId(req)), detectedAnomaly: null } });
  }

  const fresh = await prisma.journalEntry.findUniqueOrThrow({ where: { id: id }, include: ENTRY_INCLUDE });
  res.json(serializeEntry(fresh));
}));

/** Brouillon → en attente de validation. */
router.post('/entries/:id/submit', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const existing = id ? await findAccessibleEntry(req, id) : null;
  if (!existing) return res.status(404).json({ error: 'Écriture introuvable.' });
  if (existing.status !== 'draft') return res.status(409).json({ error: 'Seul un brouillon peut être soumis à validation.' });

  const row = await prisma.journalEntry.update({
    where: { id: existing.id },
    data: {
      status: 'pending_review',
      auditTrail: { create: { action: 'submitted_for_review', author: await actorName(req), notes: 'Soumise à validation.' } },
    },
    include: ENTRY_INCLUDE,
  });
  res.json(serializeEntry(row));
}));

/**
 * Validation (unitaire ou en lot) par tout utilisateur ayant accès au dossier.
 * Réponse : écritures validées + écritures refusées avec leur motif.
 */
router.post('/entries/batch-validate', handler(async (req, res) => {
  const user = getAuthUser(req)!;
  const rawIds = Array.isArray((req.body ?? {}).ids) ? (req.body.ids as unknown[]) : [];
  const ids = rawIds.map(identifier).filter((v): v is string => Boolean(v));
  if (ids.length === 0) return res.status(400).json({ error: 'Aucune écriture à valider.' });

  const author = await actorName(req);
  const validatedIds: string[] = [];
  const refused: { id: string; reason: string }[] = [];
  for (const id of ids) {
    const entry = await findAccessibleEntry(req, id);
    if (!entry) { refused.push({ id, reason: 'Écriture introuvable.' }); continue; }
    if (entry.status !== 'pending_review' && entry.status !== 'anomaly') {
      refused.push({ id, reason: entry.status === 'draft' ? 'Brouillon non soumis.' : 'Déjà validée ou annulée.' });
      continue;
    }
    const locked = lockError(await dossierOf(entry.clientDossierId), entry.date);
    if (locked) { refused.push({ id, reason: locked }); continue; }
    await prisma.journalEntry.update({
      where: { id },
      data: {
        status: 'validated',
        detectedAnomaly: null,
        validatedById: user.sub,
        validatedAt: new Date(),
        auditTrail: { create: { action: 'validated_by_expert', author, notes: 'Validation définitive.' } },
      },
    });
    validatedIds.push(id);
  }

  const rows = await prisma.journalEntry.findMany({ where: { id: { in: validatedIds } }, include: ENTRY_INCLUDE });
  res.json({ validated: rows.map(serializeEntry), refused });
}));

/** Dévalidation (hors période bloquée). L'écriture repasse "en attente". */
router.post('/entries/:id/unvalidate', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const existing = id ? await findAccessibleEntry(req, id) : null;
  if (!existing) return res.status(404).json({ error: 'Écriture introuvable.' });
  if (existing.status !== 'validated') return res.status(409).json({ error: 'Seule une écriture validée peut être dévalidée.' });
  if (existing.invoiceId) return res.status(409).json({ error: 'Écriture générée par une facture : annulez la facture.' });
  const locked = lockError(await dossierOf(existing.clientDossierId), existing.date);
  if (locked) return res.status(409).json({ error: locked });

  const row = await prisma.journalEntry.update({
    where: { id: existing.id },
    data: {
      status: 'pending_review',
      validatedById: null,
      validatedAt: null,
      auditTrail: { create: { action: 'unvalidated', author: await actorName(req), notes: optionalReason(req.body) ?? 'Dévalidée.' } },
    },
    include: ENTRY_INCLUDE,
  });
  res.json(serializeEntry(row));
}));

/** Annulation (hors période bloquée). Le lettrage éventuel est supprimé. */
router.post('/entries/:id/cancel', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const existing = id ? await findAccessibleEntry(req, id) : null;
  if (!existing) return res.status(404).json({ error: 'Écriture introuvable.' });
  if (existing.status === 'cancelled') return res.status(409).json({ error: 'Écriture déjà annulée.' });
  if (existing.invoiceId) return res.status(409).json({ error: 'Écriture générée par une facture : annulez la facture.' });
  const locked = lockError(await dossierOf(existing.clientDossierId), existing.date);
  if (locked) return res.status(409).json({ error: locked });

  const author = await actorName(req);
  const [, row] = await prisma.$transaction([
    prisma.invoicePayment.deleteMany({ where: { entryId: existing.id } }),
    prisma.journalEntry.update({
      where: { id: existing.id },
      data: {
        status: 'cancelled',
        auditTrail: { create: { action: 'cancelled', author, notes: optionalReason(req.body) ?? 'Annulée.' } },
      },
      include: ENTRY_INCLUDE,
    }),
  ]);
  res.json(serializeEntry(row));
}));

/**
 * Contre-passation d'une écriture validée : nouvelle écriture validée, mêmes comptes, sens inversé,
 * datée de `date` (aujourd'hui par défaut) hors période bloquée. Seule correction possible
 * d'une écriture d'une période déclarée ou clôturée. Réponse : { original, reversal }.
 */
router.post('/entries/:id/reverse', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const existing = id ? await prisma.journalEntry.findFirst({ where: { id }, include: { lines: true, reversals: true } }) : null;
  if (!existing || !(await findAccessibleEntry(req, existing.id))) return res.status(404).json({ error: 'Écriture introuvable.' });
  if (existing.status !== 'validated') return res.status(409).json({ error: 'Seule une écriture validée se contre-passe.' });
  if (existing.invoiceId) return res.status(409).json({ error: 'Écriture générée par une facture : annulez la facture.' });
  if (existing.reversalOfId) return res.status(409).json({ error: 'Cette écriture est déjà une contre-passation.' });
  if (existing.reversals.some(r => r.status !== 'cancelled')) return res.status(409).json({ error: 'Écriture déjà contre-passée.' });

  const date = isoDate((req.body ?? {}).date) ?? new Date().toISOString().slice(0, 10);
  const dossier = await dossierOf(existing.clientDossierId);
  const locked = lockError(dossier, date);
  if (locked) return res.status(409).json({ error: locked });

  const user = userId(req);
  const author = await actorName(req);
  const reason = optionalReason(req.body);
  const lines = reversedLines([...existing.lines].sort((a, b) => a.position - b.position)
    .map(l => ({ accountCode: l.accountCode, label: l.label ?? undefined, debit: Number(l.debit), credit: Number(l.credit) })));
  const label = `Contre-passation ${existing.pieceRef} — ${existing.label}`.slice(0, 300);

  const reversal = await withNumberRetry(() => prisma.$transaction(async tx => {
    const number = await numberer(tx, existing.clientDossierId)(existing.journal);
    await tx.invoicePayment.deleteMany({ where: { entryId: existing.id } });
    await tx.auditLog.create({ data: { journalEntryId: existing.id, action: 'reversed', author, notes: reason ?? `Contre-passée le ${fr(date)}.` } });
    return tx.journalEntry.create({
      data: {
        date: new Date(date), label, pieceRef: `CP-${existing.pieceRef}`.slice(0, 80),
        journal: existing.journal, number, amount: existing.amount, lines: linesCreate(lines),
        clientDossierId: existing.clientDossierId, status: 'validated',
        rawInput: label, inputType: 'manual', paymentMethod: existing.paymentMethod,
        explanationSimplified: `Annule l'écriture ${existing.pieceRef} du ${fr(existing.date.toISOString().slice(0, 10))} en inversant le débit et le crédit.`,
        createdById: user, validatedById: user, validatedAt: new Date(), reversalOfId: existing.id,
        auditTrail: { create: { action: 'reversed', author, notes: reason ?? `Contre-passation de ${existing.pieceRef}.` } },
      },
      include: ENTRY_INCLUDE,
    });
  }));
  const original = await prisma.journalEntry.findUniqueOrThrow({ where: { id: existing.id }, include: ENTRY_INCLUDE });
  res.status(201).json({ original: serializeEntry(original), reversal: serializeEntry(reversal) });
}));

export default router;

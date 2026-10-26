import { Router, Request } from 'express';
import { prisma } from '../db';
import { serializeEntry } from '../mappers';
import { findAccessibleDossier, findAccessibleEntry, actorName } from '../access';
import { getAuthUser } from '../auth';
import { handler } from '../http';
import { validateEntryInput, identifier, optionalReason, EntryInput, unwrap } from '../validation';
import { ENTRY_INCLUDE } from './bootstrap';

const router = Router();

/** Statuts encore modifiables par un saisisseur. */
const EDITABLE = ['draft', 'pending_review', 'anomaly'];

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

function userId(req: Request): string {
  return getAuthUser(req)!.sub;
}

type DossierRules = { id: string };

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

function entryCreateData(e: EntryInput, dossier: DossierRules, createdById: string, author: string) {
  const dossierId = dossier.id;
  const auto = autoValidates(e);
  return {
    id: e.id,
    date: new Date(e.date),
    label: e.label,
    pieceRef: e.pieceRef,
    debitAccountCode: e.debitAccountCode,
    creditAccountCode: e.creditAccountCode,
    amount: e.amount,
    tvaAmount: e.tvaAmount,
    clientDossierId: dossierId,
    status: e.status as any,
    confidenceScore: e.confidenceScore,
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
        confidenceScore: a.confidenceScore,
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

  const accountError = await assertAccountsUsable([e.debitAccountCode, e.creditAccountCode], dossierId);
  if (accountError) return res.status(400).json({ error: accountError });

  const created = await prisma.journalEntry.create({ data: entryCreateData(e, dossier, userId(req), await actorName(req)), include: ENTRY_INCLUDE });
  res.status(201).json(serializeEntry(created));
}));

/** Import (Excel ou lot) : chaque écriture est validée et rattachée à un dossier accessible. */
router.post('/entries/import', handler(async (req, res) => {
  const list = Array.isArray((req.body ?? {}).entries) ? (req.body.entries as unknown[]) : [];
  if (list.length === 0) return res.status(400).json({ error: 'Aucune écriture à importer.' });
  if (list.length > 5000) return res.status(400).json({ error: 'Import limité à 5000 écritures par opération.' });

  const author = await actorName(req);
  const created = [];
  for (const raw of list) {
    const dossierId = identifier((raw as any)?.clientDossierId);
    if (!dossierId) return res.status(400).json({ error: 'Une écriture importée référence un dossier invalide.' });
    const dossier = await findAccessibleDossier(req, dossierId);
    if (!dossier) return res.status(403).json({ error: 'Import refusé : dossier hors de votre périmètre.' });

    const e = unwrap(validateEntryInput(raw, { requireId: true }));

    const accountError = await assertAccountsUsable([e.debitAccountCode, e.creditAccountCode], dossierId);
    if (accountError) return res.status(400).json({ error: accountError });

    const row = await prisma.journalEntry.create({ data: entryCreateData(e, dossier, userId(req), author), include: ENTRY_INCLUDE });
    created.push(serializeEntry(row));
  }
  res.status(201).json(created);
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
    return res.status(409).json({ error: 'Écriture validée ou annulée : modification impossible (dévalidez-la d’abord).' });
  }
  if (existing.invoiceId) {
    return res.status(409).json({ error: 'Écriture générée par une facture : modifiez la facture.' });
  }

  const e = unwrap(validateEntryInput(req.body));

  const accountError = await assertAccountsUsable([e.debitAccountCode, e.creditAccountCode], existing.clientDossierId);
  if (accountError) return res.status(400).json({ error: accountError });

  const auto = autoValidates(e);

  await prisma.journalEntry.update({
    where: { id: id },
    data: {
      date: new Date(e.date),
      label: e.label,
      pieceRef: e.pieceRef,
      debitAccountCode: e.debitAccountCode,
      creditAccountCode: e.creditAccountCode,
      amount: e.amount,
      tvaAmount: e.tvaAmount,
      status: e.status as any,
      confidenceScore: e.confidenceScore,
      detectedAnomaly: e.detectedAnomaly ?? null,
      rawInput: e.rawInput,
      inputType: e.inputType as any,
      explanationSimplified: e.explanationSimplified,
      paymentMethod: e.paymentMethod as any,
      updatedById: userId(req),
    },
  });

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
        confidenceScore: a.confidenceScore,
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

/** Dévalidation par tout utilisateur ayant accès au dossier. L'écriture repasse "en attente". */
router.post('/entries/:id/unvalidate', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const existing = id ? await findAccessibleEntry(req, id) : null;
  if (!existing) return res.status(404).json({ error: 'Écriture introuvable.' });
  if (existing.status !== 'validated') return res.status(409).json({ error: 'Seule une écriture validée peut être dévalidée.' });
  if (existing.invoiceId) return res.status(409).json({ error: 'Écriture générée par une facture : annulez la facture.' });

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

/** Annulation par tout utilisateur ayant accès au dossier. Le lettrage éventuel est supprimé. */
router.post('/entries/:id/cancel', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const existing = id ? await findAccessibleEntry(req, id) : null;
  if (!existing) return res.status(404).json({ error: 'Écriture introuvable.' });
  if (existing.status === 'cancelled') return res.status(409).json({ error: 'Écriture déjà annulée.' });
  if (existing.invoiceId) return res.status(409).json({ error: 'Écriture générée par une facture : annulez la facture.' });

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

export default router;

import { Router } from 'express';
import { prisma } from '../db';
import { serializeAsset, serializeEntry } from '../mappers';
import { findAccessibleDossier, actorName } from '../access';
import { getAuthUser } from '../auth';
import { handler } from '../http';
import { identifier, isoDate, optionalText } from '../validation';
import { ENTRY_INCLUDE } from './bootstrap';
import { assertAccountsUsable, lockError, linesCreate, numberer, withNumberRetry, defaultPieceRef } from './entries';
import { depreciationSchedule, amortizationAccountFor, DEPRECIATION_EXPENSE } from '../../src/utils/assets';

const router = Router();

async function amortAccount(code: string, dossierId: string) {
  const rows = await prisma.syscohadaAccount.findMany({
    where: { code: { startsWith: '28' }, active: true, OR: [{ dossierId: null }, { dossierId }] }, select: { code: true },
  });
  const known = new Set(rows.map(r => r.code));
  return amortizationAccountFor(code, c => known.has(c));
}

/**
 * Nouvelle immobilisation : { clientDossierId, label, accountCode (2x), acquisitionDate, cost, durationYears,
 * depreciatedThrough? } — ce dernier pour un bien ancien dont les dotations passées sont déjà en comptabilité.
 */
router.post('/assets', handler(async (req, res) => {
  const b = req.body ?? {};
  const dossierId = identifier(b.clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });
  const label = optionalText(b.label, 200);
  const accountCode = String(b.accountCode ?? '').trim();
  const acquisitionDate = isoDate(b.acquisitionDate);
  const cost = Math.round(Number(b.cost) * 100) / 100;
  const durationYears = Number(b.durationYears);
  const depreciatedThrough = b.depreciatedThrough ? Number(b.depreciatedThrough) : null;
  if (!label) return res.status(400).json({ error: 'Désignation requise.' });
  if (!/^2[1-7]\d*$/.test(accountCode)) return res.status(400).json({ error: 'Compte d’immobilisation attendu (classe 2, hors 28 et 29).' });
  if (!acquisitionDate) return res.status(400).json({ error: 'Date d’acquisition invalide.' });
  if (!(cost > 0)) return res.status(400).json({ error: 'Coût d’acquisition invalide.' });
  if (!Number.isInteger(durationYears) || durationYears < 1 || durationYears > 50) return res.status(400).json({ error: 'Durée d’amortissement : 1 à 50 ans.' });
  if (depreciatedThrough !== null && (!Number.isInteger(depreciatedThrough) || depreciatedThrough < Number(acquisitionDate.slice(0, 4)))) {
    return res.status(400).json({ error: 'Exercice des dotations déjà passées invalide.' });
  }
  const err = await assertAccountsUsable([accountCode], dossier.id);
  if (err) return res.status(400).json({ error: err });
  if (!(await amortAccount(accountCode, dossier.id))) {
    return res.status(400).json({ error: `Aucun compte d’amortissement 28… pour ${accountCode} : créez-le dans le plan comptable.` });
  }
  const row = await prisma.fixedAsset.create({
    data: { clientDossierId: dossier.id, label, accountCode, acquisitionDate: new Date(acquisitionDate), cost, durationYears, depreciatedThrough },
  });
  res.status(201).json(serializeAsset(row));
}));

/** Suppression : seulement tant qu'aucune dotation n'a été passée. */
router.post('/assets/:id/delete', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const row = id ? await prisma.fixedAsset.findUnique({ where: { id } }) : null;
  if (!row || !(await findAccessibleDossier(req, row.clientDossierId))) return res.status(404).json({ error: 'Immobilisation introuvable.' });
  if (row.depreciatedThrough !== null) return res.status(409).json({ error: 'Des dotations ont déjà été passées : contre-passez-les avant de supprimer.' });
  await prisma.fixedAsset.delete({ where: { id: row.id } });
  res.status(204).end();
}));

/**
 * Passe les dotations aux amortissements jusqu'à l'exercice `year` inclus (rattrape les exercices manquants) :
 * une écriture OD au 31/12 par immobilisation et par exercice, D 6811 / C 28xx. Tout ou rien.
 */
router.post('/assets/depreciate', handler(async (req, res) => {
  const b = req.body ?? {};
  const dossierId = identifier(b.clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });
  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) return res.status(400).json({ error: 'Exercice invalide.' });

  const assets = await prisma.fixedAsset.findMany({ where: { clientDossierId: dossier.id } });
  const todo: { assetId: string; year: number; amount: number; label: string; credit: string }[] = [];
  for (const a of assets) {
    const credit = await amortAccount(a.accountCode, dossier.id);
    if (!credit) return res.status(400).json({ error: `Aucun compte d’amortissement pour ${a.accountCode} (${a.label}).` });
    const schedule = depreciationSchedule({ acquisitionDate: a.acquisitionDate.toISOString().slice(0, 10), cost: Number(a.cost), durationYears: a.durationYears });
    for (const r of schedule) {
      if (r.year > year || (a.depreciatedThrough !== null && r.year <= a.depreciatedThrough) || r.amount <= 0) continue;
      const locked = lockError(dossier, `${r.year}-12-31`);
      if (locked) return res.status(409).json({ error: `${a.label}, dotation ${r.year} : ${locked}` });
      todo.push({ assetId: a.id, year: r.year, amount: r.amount, label: a.label, credit });
    }
  }
  const err = await assertAccountsUsable([DEPRECIATION_EXPENSE, ...todo.map(t => t.credit)], dossier.id);
  if (todo.length && err) return res.status(400).json({ error: err });

  const userId = getAuthUser(req)!.sub;
  const author = await actorName(req);
  const created = await withNumberRetry(() => prisma.$transaction(async tx => {
    const next = numberer(tx, dossier.id);
    const out = [];
    for (const t of todo) {
      const number = await next('OD');
      const label = `Dotation aux amortissements ${t.year} — ${t.label}`.slice(0, 300);
      out.push(await tx.journalEntry.create({
        data: {
          date: new Date(`${t.year}-12-31`), label, pieceRef: defaultPieceRef('OD', number), journal: 'OD', number,
          amount: t.amount, clientDossierId: dossier.id, status: 'validated', validatedById: userId, validatedAt: new Date(),
          createdById: userId, rawInput: label, inputType: 'manual', paymentMethod: 'bank_transfer',
          explanationSimplified: `Usure de l'année ${t.year} de « ${t.label} », constatée en charge.`,
          lines: linesCreate([
            { accountCode: DEPRECIATION_EXPENSE, debit: t.amount, credit: 0 },
            { accountCode: t.credit, debit: 0, credit: t.amount },
          ]),
          auditTrail: { create: { action: 'auto_validated', author, notes: 'Dotation générée depuis le registre des immobilisations.' } },
        },
        include: ENTRY_INCLUDE,
      }));
    }
    await tx.fixedAsset.updateMany({
      where: { clientDossierId: dossier.id, OR: [{ depreciatedThrough: null }, { depreciatedThrough: { lt: year } }] },
      data: { depreciatedThrough: year },
    });
    return out;
  }));
  const fresh = await prisma.fixedAsset.findMany({ where: { clientDossierId: dossier.id }, orderBy: { acquisitionDate: 'asc' } });
  res.status(201).json({ entries: created.map(serializeEntry), assets: fresh.map(serializeAsset) });
}));

export default router;

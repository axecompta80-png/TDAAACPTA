import { Router, Request } from 'express';
import { prisma } from '../db';
import { findAccessibleDossier, actorName, dossierScopeWhere } from '../access';
import { getAuthUser } from '../auth';
import { handler } from '../http';
import { identifier, isoDate, optionalText, JOURNAL_CODES, PAYMENT_METHODS } from '../validation';
import { assertAccountsUsable, lockError, linesCreate, numberer, withNumberRetry, defaultPieceRef } from './entries';
import { linesError, defaultJournal, totalDebit, nextMonthly } from '../../src/utils/entryLines';
import type { JournalLine } from '../../src/types';

const router = Router();

export function serializeRecurring(r: any) {
  return {
    id: r.id, clientDossierId: r.clientDossierId, label: r.label, journal: r.journal,
    lines: r.lines as JournalLine[], day: r.day, nextDate: r.nextDate.toISOString().slice(0, 10), active: r.active,
  };
}

/**
 * Génère les écritures récurrentes échues des dossiers visibles (rattrapage limité à 24 mois).
 * Même règle que la saisie : sans anomalie, l'écriture est validée d'office. Une échéance tombant
 * dans une période bloquée est sautée.
 * ponytail: déclenché au chargement de l'application ; passer à une tâche planifiée si des dossiers
 * restent longtemps sans être ouverts.
 */
export async function generateDueRecurring(req: Request) {
  const user = getAuthUser(req);
  if (!user) return;
  const today = new Date().toISOString().slice(0, 10);
  const due = await prisma.recurringEntry.findMany({
    where: { active: true, nextDate: { lte: new Date(today) }, clientDossier: dossierScopeWhere(req) as any },
    include: { clientDossier: { select: { lockedUntil: true } } },
  });
  if (!due.length) return;
  const author = await actorName(req);
  for (const r of due) {
    let date = r.nextDate.toISOString().slice(0, 10);
    const lines = r.lines as unknown as JournalLine[];
    for (let i = 0; i < 24 && date <= today; i++, date = nextMonthly(date, r.day)) {
      if (lockError(r.clientDossier, date)) continue;
      await withNumberRetry(() => prisma.$transaction(async tx => {
        const number = await numberer(tx, r.clientDossierId)(r.journal);
        await tx.journalEntry.create({
          data: {
            date: new Date(date), label: r.label, pieceRef: defaultPieceRef(r.journal, number), journal: r.journal, number,
            amount: totalDebit(lines), lines: linesCreate(lines), clientDossierId: r.clientDossierId,
            status: 'validated', validatedById: user.sub, validatedAt: new Date(), createdById: r.createdById,
            rawInput: r.label, inputType: 'manual', paymentMethod: r.paymentMethod,
            explanationSimplified: `Écriture récurrente du ${date.split('-').reverse().join('/')}.`,
            auditTrail: { create: { action: 'auto_validated', author, notes: 'Générée par une écriture récurrente.' } },
          },
        });
      }));
    }
    await prisma.recurringEntry.update({ where: { id: r.id }, data: { nextDate: new Date(date) } });
  }
}

/** Nouvelle écriture récurrente : { clientDossierId, label, journal?, lines, paymentMethod?, startDate }. */
router.post('/recurring', handler(async (req, res) => {
  const b = req.body ?? {};
  const dossierId = identifier(b.clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });
  const label = optionalText(b.label, 300);
  const startDate = isoDate(b.startDate);
  const lines: JournalLine[] = (Array.isArray(b.lines) ? b.lines : []).slice(0, 50).map((l: any) => ({
    accountCode: String(l?.accountCode ?? '').trim().slice(0, 20),
    debit: Math.round((Number(l?.debit) || 0) * 100) / 100,
    credit: Math.round((Number(l?.credit) || 0) * 100) / 100,
    label: optionalText(l?.label, 300) ?? undefined,
  }));
  if (!label) return res.status(400).json({ error: 'Libellé requis.' });
  if (!startDate) return res.status(400).json({ error: 'Date de première échéance invalide.' });
  const err = linesError(lines) ?? await assertAccountsUsable(lines.map(l => l.accountCode), dossier.id);
  if (err) return res.status(400).json({ error: err });

  const row = await prisma.recurringEntry.create({
    data: {
      clientDossierId: dossier.id, label, lines: lines as any,
      journal: JOURNAL_CODES.find(j => j === b.journal) ?? defaultJournal(lines),
      paymentMethod: PAYMENT_METHODS.find(m => m === b.paymentMethod) ?? 'bank_transfer',
      day: Number(startDate.slice(8, 10)), nextDate: new Date(startDate), createdById: getAuthUser(req)!.sub,
    },
  });
  res.status(201).json(serializeRecurring(row));
}));

router.post('/recurring/:id/stop', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const row = id ? await prisma.recurringEntry.findUnique({ where: { id } }) : null;
  if (!row || !(await findAccessibleDossier(req, row.clientDossierId))) return res.status(404).json({ error: 'Écriture récurrente introuvable.' });
  const updated = await prisma.recurringEntry.update({ where: { id: row.id }, data: { active: false } });
  res.json(serializeRecurring(updated));
}));

export default router;

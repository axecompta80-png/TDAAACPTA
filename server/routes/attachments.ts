import { Router } from 'express';
import { prisma } from '../db';
import { findAccessibleDossier, findAccessibleEntry } from '../access';
import { getAuthUser } from '../auth';
import { handler } from '../http';
import { identifier, isoDate, optionalText } from '../validation';
import { lockError } from './entries';

const router = Router();

/** 3 Mo : le corps JSON (base64, +33 %) reste sous la limite de 4,5 Mo des fonctions Vercel. */
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const ALLOWED = /^(application\/pdf|image\/(jpeg|png|webp)|text\/csv|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/vnd\.ms-excel)$/;

/** Joindre une pièce : { filename, mimeType, data (base64) }. Possible même sur une période bloquée. */
router.post('/entries/:id/attachments', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const entry = id ? await findAccessibleEntry(req, id) : null;
  if (!entry) return res.status(404).json({ error: 'Écriture introuvable.' });
  const b = req.body ?? {};
  const filename = optionalText(b.filename, 200)?.replace(/[\\/\r\n"]/g, '_');
  const mimeType = String(b.mimeType ?? '');
  if (!filename) return res.status(400).json({ error: 'Nom de fichier requis.' });
  if (!ALLOWED.test(mimeType)) return res.status(400).json({ error: 'Format non pris en charge (PDF, image, Excel, CSV ou Word).' });
  const data = typeof b.data === 'string' ? Buffer.from(b.data.replace(/^data:[^;]+;base64,/, ''), 'base64') : null;
  if (!data?.length) return res.status(400).json({ error: 'Fichier vide.' });
  if (data.length > MAX_ATTACHMENT_BYTES) return res.status(413).json({ error: 'Fichier trop volumineux (3 Mo maximum).' });

  const row = await prisma.attachment.create({
    data: { entryId: entry.id, filename, mimeType, size: data.length, data, createdById: getAuthUser(req)!.sub },
    select: { id: true, filename: true, mimeType: true, size: true },
  });
  res.status(201).json(row);
}));

router.get('/attachments/:id', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const row = id ? await prisma.attachment.findUnique({ where: { id } }) : null;
  if (!row || !(await findAccessibleEntry(req, row.entryId))) return res.status(404).json({ error: 'Pièce introuvable.' });
  res.setHeader('Content-Type', row.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.filename)}"; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
  res.send(Buffer.from(row.data));
}));

/** Retirer une pièce : interdit sur une période bloquée (la pièce justifie une écriture déclarée). */
router.post('/attachments/:id/delete', handler(async (req, res) => {
  const id = identifier(req.params.id);
  const row = id ? await prisma.attachment.findUnique({ where: { id }, select: { id: true, entryId: true } }) : null;
  const entry = row ? await findAccessibleEntry(req, row.entryId) : null;
  if (!row || !entry) return res.status(404).json({ error: 'Pièce introuvable.' });
  const dossier = await prisma.clientDossier.findUniqueOrThrow({ where: { id: entry.clientDossierId }, select: { lockedUntil: true } });
  const locked = lockError(dossier, entry.date);
  if (locked) return res.status(409).json({ error: locked });
  await prisma.attachment.delete({ where: { id: row.id } });
  res.status(204).end();
}));

/**
 * Rapprochement bancaire : pointe (date du relevé) ou dépointe (date null) des lignes de trésorerie
 * (comptes 5x) d'écritures validées du dossier. { clientDossierId, lineIds, date }.
 */
router.post('/lines/reconcile', handler(async (req, res) => {
  const b = req.body ?? {};
  const dossierId = identifier(b.clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });
  const ids = (Array.isArray(b.lineIds) ? b.lineIds : []).map(identifier).filter(Boolean).slice(0, 5000) as string[];
  const date = b.date === null ? null : isoDate(b.date);
  if (!ids.length) return res.status(400).json({ error: 'Aucune ligne sélectionnée.' });
  if (b.date !== null && !date) return res.status(400).json({ error: 'Date du relevé invalide.' });

  const where = { id: { in: ids }, accountCode: { startsWith: '5' }, entry: { clientDossierId: dossier.id, status: 'validated' as const } };
  if ((await prisma.journalLine.count({ where })) !== ids.length) {
    return res.status(400).json({ error: 'Seules les lignes de trésorerie (comptes 5) d’écritures validées du dossier se pointent.' });
  }
  await prisma.journalLine.updateMany({ where, data: { reconciledOn: date ? new Date(date) : null } });
  res.json({ lineIds: ids, reconciledOn: date ?? undefined });
}));

export default router;

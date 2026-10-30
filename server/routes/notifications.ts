import { Router } from 'express';
import { prisma } from '../db';
import { serializeNotification } from '../mappers';
import type { Request } from 'express';
import { findAccessibleDossier, notificationScopeWhere, dossierScopeWhere } from '../access';
import { deadlinesToRemind } from '../../src/utils/fiscalCalendar';
import { handler } from '../http';
import { validateNotificationInput, identifier, unwrap } from '../validation';

const router = Router();

const fr = (d: string) => d.split('-').reverse().join('/');

/**
 * Rappels d'échéances fiscales des dossiers visibles (réglage « Rappels des échéances »).
 * Identifiant fixe par dossier et échéance : un seul rappel, même si l'application est rechargée.
 * Une échéance est faite quand sa période est bloquée (TVA marquée déclarée, exercice clôturé).
 * Rien n'est rappelé pour une période antérieure au dossier (création ou première écriture).
 */
export async function createDeadlineReminders(req: Request) {
  const dossiers = await prisma.clientDossier.findMany({
    where: dossierScopeWhere(req) as any,
    select: { id: true, lockedUntil: true, regimeFiscal: true, createdAt: true, settings: { select: { notifyOnTaxDeadline: true } } },
  });
  const firsts = await prisma.journalEntry.groupBy({ by: ['clientDossierId'], where: { clientDossierId: { in: dossiers.map(d => d.id) } }, _min: { date: true } });
  const startOf = (d: typeof dossiers[number]) => {
    const first = firsts.find(f => f.clientDossierId === d.id)?._min.date;
    return (first && first < d.createdAt ? first : d.createdAt).toISOString().slice(0, 7);
  };
  const today = new Date().toISOString().slice(0, 10);
  const rows = dossiers.filter(d => d.settings?.notifyOnTaxDeadline ?? true).flatMap(d =>
    deadlinesToRemind(today, d.lockedUntil?.toISOString().slice(0, 10))
      .filter(x => x.periodEnd.slice(0, 7) >= startOf(d))
      .filter(x => d.regimeFiscal !== 'SYNTHETIQUE_FORFAIT' || !x.key.startsWith('tva'))
      .map(x => ({
        id: `echeance-${d.id}-${x.key}`,
        title: x.due < today ? `En retard : ${x.label}` : `Échéance le ${fr(x.due)} : ${x.label}`,
        message: x.due < today
          ? `La date limite du ${fr(x.due)} est passée. Déposez la déclaration puis marquez la période déclarée.`
          : `À déposer avant le ${fr(x.due)}. Une fois déclarée, marquez la période déclarée pour la bloquer.`,
        type: (x.due < today ? 'warning' : 'info') as 'warning' | 'info',
        category: 'fiscal' as const,
        dossierId: d.id,
        actionLabel: 'Ouvrir la fiscalité',
        actionMode: 'expert' as const,
        actionExpertTab: 'tax',
      })));
  if (rows.length) await prisma.appNotification.createMany({ data: rows, skipDuplicates: true });
}

/** Création d'une notification liée à un dossier accessible (ou globale si aucun dossier). */
router.post('/notifications', handler(async (req, res) => {
  const n = unwrap(validateNotificationInput(req.body));

  if (n.dossierId) {
    const dossier = await findAccessibleDossier(req, n.dossierId);
    if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });
  }

  const created = await prisma.appNotification.create({
    data: {
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type as any,
      category: n.category as any,
      read: n.read,
      dossierId: n.dossierId,
      actionLabel: n.actionLabel,
      actionMode: n.actionMode as any,
      actionExpertTab: n.actionExpertTab,
    },
  });
  res.status(201).json(serializeNotification(created));
}));

/** Marque comme lues uniquement les notifications visibles par le requérant. */
router.post('/notifications/read-all', handler(async (req, res) => {
  await prisma.appNotification.updateMany({ where: notificationScopeWhere(req) as any, data: { read: true } });
  res.status(204).end();
}));

router.post('/notifications/:id/read', handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant de notification invalide.' });
  const scoped = await prisma.appNotification.findFirst({ where: { id: id, ...(notificationScopeWhere(req) as any) } });
  if (!scoped) return res.status(404).json({ error: 'Notification introuvable.' });
  const updated = await prisma.appNotification.update({ where: { id: id }, data: { read: true } });
  res.json(serializeNotification(updated));
}));

router.post('/notifications/:id/delete', handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant de notification invalide.' });
  const scoped = await prisma.appNotification.findFirst({ where: { id: id, ...(notificationScopeWhere(req) as any) } });
  if (!scoped) return res.status(404).json({ error: 'Notification introuvable.' });
  await prisma.appNotification.delete({ where: { id: id } });
  res.status(204).end();
}));

/** Vide le centre de notifications du périmètre du requérant (jamais celui des autres). */
router.post('/notifications/clear', handler(async (req, res) => {
  await prisma.appNotification.deleteMany({ where: notificationScopeWhere(req) as any });
  res.status(204).end();
}));

export default router;

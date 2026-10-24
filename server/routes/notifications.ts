import { Router } from 'express';
import { prisma } from '../db';
import { serializeNotification } from '../mappers';
import { findAccessibleDossier, notificationScopeWhere } from '../access';
import { handler } from '../http';
import { validateNotificationInput, identifier, unwrap } from '../validation';

const router = Router();

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

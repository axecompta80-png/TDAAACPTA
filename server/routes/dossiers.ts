import { Router } from 'express';
import { prisma } from '../db';
import { serializeDossier, REGIME_FISCAL_TO_DB } from '../mappers';
import { getAuthUser } from '../auth';
import { dossierScopeWhere, findAccessibleDossier, ownsDossier } from '../access';
import { handler } from '../http';
import { validateDossierInput, identifier, unwrap } from '../validation';
import { DOSSIER_INCLUDE, ENTRY_INCLUDE } from './bootstrap';

const router = Router();

/** Dossiers visibles par le requérant (créés par lui ou qui lui sont attribués). */
router.get('/dossiers', handler(async (req, res) => {
  const rows = await prisma.clientDossier.findMany({
    where: dossierScopeWhere(req) as any,
    include: DOSSIER_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
  res.json(rows.map(serializeDossier));
}));

/** Détail d'un dossier avec ses écritures, uniquement si accessible. */
router.get('/dossiers/:id', handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant de dossier invalide.' });
  const dossier = await findAccessibleDossier(req, id);
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });

  const [full, entryRows] = await Promise.all([
    prisma.clientDossier.findUnique({ where: { id: id }, include: DOSSIER_INCLUDE }),
    prisma.journalEntry.findMany({
      where: { clientDossierId: id },
      include: ENTRY_INCLUDE,
      orderBy: { date: 'desc' },
    }),
  ]);
  res.json({ dossier: serializeDossier(full), entries: entryRows });
}));

/** Création : le propriétaire est toujours l'utilisateur en session (jamais fourni par le client). */
router.post('/dossiers', handler(async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });

  const d = unwrap(validateDossierInput(req.body));

  const created = await prisma.clientDossier.create({
    data: {
      ownerId: user.sub,
      name: d.name,
      managerName: d.managerName,
      phone: d.phone,
      activity: d.activity,
      city: d.city,
      country: d.country,
      rccm: d.rccm,
      ifu: d.ifu,
      regimeFiscal: REGIME_FISCAL_TO_DB[d.regimeFiscal] as any,
      confidenceThreshold: d.confidenceThreshold,
      currency: d.currency,
    },
    include: DOSSIER_INCLUDE,
  });
  res.status(201).json(serializeDossier(created));
}));

/** Mise à jour d'un dossier : POST /dossiers/:id/update (jamais de méthode PUT exposée). */
router.post('/dossiers/:id/update', handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant de dossier invalide.' });
  const existing = await findAccessibleDossier(req, id);
  if (!existing) return res.status(404).json({ error: 'Dossier introuvable.' });

  const d = unwrap(validateDossierInput(req.body));

  const updated = await prisma.clientDossier.update({
    where: { id: id },
    data: {
      name: d.name,
      managerName: d.managerName,
      phone: d.phone,
      activity: d.activity,
      city: d.city,
      country: d.country,
      rccm: d.rccm,
      ifu: d.ifu,
      regimeFiscal: REGIME_FISCAL_TO_DB[d.regimeFiscal] as any,
      confidenceThreshold: d.confidenceThreshold,
      currency: d.currency,
    },
    include: DOSSIER_INCLUDE,
  });
  res.json(serializeDossier(updated));
}));

/** Suppression d'un dossier par son créateur : POST /dossiers/:id/delete (cascade sur écritures et notifications). */
router.post('/dossiers/:id/delete', handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant de dossier invalide.' });
  const existing = await findAccessibleDossier(req, id);
  if (!existing) return res.status(404).json({ error: 'Dossier introuvable.' });
  if (!(await ownsDossier(req, id))) return res.status(403).json({ error: 'Seul le créateur du dossier peut le supprimer.' });

  await prisma.clientDossier.delete({ where: { id: id } });
  res.status(204).end();
}));

/**
 * Attributions : le créateur du dossier l'attribue à un comptable de son entreprise,
 * ou retire cette attribution. Réponse : le dossier à jour.
 */
async function assignmentGuard(req: any, res: any): Promise<string | null> {
  const id = identifier(req.params.id);
  const dossier = id ? await findAccessibleDossier(req, id) : null;
  if (!dossier) { res.status(404).json({ error: 'Dossier introuvable.' }); return null; }
  if (dossier.ownerId !== getAuthUser(req)!.sub) {
    res.status(403).json({ error: 'Seul le créateur du dossier peut gérer ses attributions.' });
    return null;
  }
  return dossier.id;
}

router.post('/dossiers/:id/assignments', handler(async (req, res) => {
  const dossierId = await assignmentGuard(req, res);
  if (!dossierId) return;
  const me = getAuthUser(req)!.sub;
  const targetId = identifier((req.body ?? {}).userId);
  if (!targetId || targetId === me) return res.status(400).json({ error: 'Comptable invalide.' });
  const [self, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: me }, select: { organizationId: true } }),
    prisma.user.findUnique({ where: { id: targetId }, select: { organizationId: true } }),
  ]);
  if (!target || target.organizationId !== self?.organizationId) {
    return res.status(404).json({ error: 'Comptable introuvable dans votre entreprise.' });
  }
  await prisma.dossierAssignment.upsert({
    where: { dossierId_userId: { dossierId, userId: targetId } },
    create: { dossierId, userId: targetId },
    update: {},
  });
  res.json(serializeDossier(await prisma.clientDossier.findUnique({ where: { id: dossierId }, include: DOSSIER_INCLUDE })));
}));

router.post('/dossiers/:id/assignments/:userId/delete', handler(async (req, res) => {
  const dossierId = await assignmentGuard(req, res);
  if (!dossierId) return;
  const userId = identifier(req.params.userId);
  if (userId) await prisma.dossierAssignment.deleteMany({ where: { dossierId, userId } });
  res.json(serializeDossier(await prisma.clientDossier.findUnique({ where: { id: dossierId }, include: DOSSIER_INCLUDE })));
}));

export default router;

import { Router } from 'express';
import { prisma } from '../db';
import { serializeDossier, REGIME_FISCAL_TO_DB } from '../mappers';
import { getAuthUser } from '../auth';
import { dossierScopeWhere, findAccessibleDossier } from '../access';
import { handler } from '../http';
import { validateDossierInput, identifier, unwrap } from '../validation';
import { DOSSIER_INCLUDE, ENTRY_INCLUDE } from './bootstrap';

const router = Router();

/** Dossiers visibles par le requérant (les siens, ou tous pour un administrateur). */
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

/** Suppression d'un dossier : POST /dossiers/:id/delete (cascade sur écritures et notifications). */
router.post('/dossiers/:id/delete', handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant de dossier invalide.' });
  const existing = await findAccessibleDossier(req, id);
  if (!existing) return res.status(404).json({ error: 'Dossier introuvable.' });

  await prisma.clientDossier.delete({ where: { id: id } });
  res.status(204).end();
}));

export default router;

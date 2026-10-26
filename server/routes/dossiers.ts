import { Router } from 'express';
import { prisma } from '../db';
import { serializeDossier, REGIME_FISCAL_TO_DB } from '../mappers';
import { getAuthUser, hashPassword } from '../auth';
import { dossierScopeWhere, findAccessibleDossier, isMainAccount, NO_ACCESS } from '../access';
import { handler } from '../http';
import { validateDossierInput, identifier, unwrap, DossierInput } from '../validation';
import { createDefaultPlatformSettings, copySettings } from '../seedData';
import { DOSSIER_INCLUDE, ENTRY_INCLUDE } from './bootstrap';

const router = Router();

export const dossierData = (d: DossierInput) => ({
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
});

const mainOnly = (res: any) => res.status(403).json({ error: "Réservé au compte principal de l'entreprise." });

/** Dossiers visibles par le requérant (entreprise + dossiers pour le principal, son dossier pour un propriétaire). */
router.get('/dossiers', handler(async (req, res) => {
  const rows = await prisma.clientDossier.findMany({
    where: dossierScopeWhere(req) as any,
    include: DOSSIER_INCLUDE,
    orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
  });
  res.json(rows.map(serializeDossier));
}));

/** Détail d'un dossier avec ses écritures. Dossier de l'entreprise hors périmètre : 403. */
router.get('/dossiers/:id', handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant de dossier invalide.' });
  const dossier = await findAccessibleDossier(req, id);
  if (!dossier) {
    const sameOrg = await prisma.clientDossier.findFirst({ where: { id, organizationId: getAuthUser(req)?.organizationId ?? '' }, select: { id: true } });
    return sameOrg ? res.status(403).json({ error: NO_ACCESS }) : res.status(404).json({ error: 'Dossier introuvable.' });
  }

  const [full, entryRows] = await Promise.all([
    prisma.clientDossier.findUnique({ where: { id }, include: DOSSIER_INCLUDE }),
    prisma.journalEntry.findMany({ where: { clientDossierId: id }, include: ENTRY_INCLUDE, orderBy: { date: 'desc' } }),
  ]);
  res.json({ dossier: serializeDossier(full), entries: entryRows });
}));

/** Informations de l'entreprise : crée la comptabilité principale (une seule fois, compte principal). */
router.post('/company', handler(async (req, res) => {
  if (!isMainAccount(req)) return mainOnly(res);
  const organizationId = getAuthUser(req)!.organizationId!;
  if (await prisma.clientDossier.findFirst({ where: { organizationId, isMain: true } })) {
    return res.status(409).json({ error: "Les informations de l'entreprise sont déjà enregistrées." });
  }
  const d = unwrap(validateDossierInput(req.body));
  const created = await prisma.$transaction(async tx => {
    const row = await tx.clientDossier.create({ data: { ...dossierData(d), organizationId, isMain: true } });
    await createDefaultPlatformSettings(tx as any, row.id);
    await tx.organization.update({ where: { id: organizationId }, data: { name: d.name } });
    return tx.clientDossier.findUniqueOrThrow({ where: { id: row.id }, include: DOSSIER_INCLUDE });
  });
  res.status(201).json(serializeDossier(created));
}));

/**
 * « Ajouter un Dossier » (compte principal) : nom du dossier + propriétaire (nom, email, mot de passe).
 * Infos fiscales et réglages copiés de l'entreprise, compte du propriétaire créé dans la même transaction.
 */
router.post('/dossiers', handler(async (req, res) => {
  if (!isMainAccount(req)) return mainOnly(res);
  const organizationId = getAuthUser(req)!.organizationId!;
  const { name, ownerName, email, password } = req.body ?? {};
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 160) : '';
  const cleanOwner = typeof ownerName === 'string' ? ownerName.trim().slice(0, 120) : '';
  const cleanEmail = typeof email === 'string' ? email.trim() : '';
  if (!cleanName) return res.status(400).json({ error: 'Nom du dossier requis.' });
  if (!cleanOwner) return res.status(400).json({ error: 'Nom du propriétaire requis.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'Email invalide.' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }
  if (await prisma.user.findUnique({ where: { email: cleanEmail } })) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }
  const main = await prisma.clientDossier.findFirst({ where: { organizationId, isMain: true }, include: { settings: true } });
  if (!main) return res.status(400).json({ error: "Renseignez d'abord les informations de l'entreprise." });

  const passwordHash = await hashPassword(password);
  const created = await prisma.$transaction(async tx => {
    const { id: _id, isMain: _m, createdAt: _c, updatedAt: _u, settings, ...fiscal } = main;
    const row = await tx.clientDossier.create({ data: { ...fiscal, name: cleanName, isMain: false } });
    if (settings) await tx.platformSettings.create({ data: { ...copySettings(settings), dossierId: row.id } });
    else await createDefaultPlatformSettings(tx as any, row.id);
    await tx.user.create({ data: { email: cleanEmail, name: cleanOwner, passwordHash, role: 'COMPTABLE', organizationId, dossierId: row.id } });
    return tx.clientDossier.findUniqueOrThrow({ where: { id: row.id }, include: DOSSIER_INCLUDE });
  });
  res.status(201).json(serializeDossier(created));
}));

/** Mise à jour des informations d'un dossier accessible : POST /dossiers/:id/update. */
router.post('/dossiers/:id/update', handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant de dossier invalide.' });
  const existing = await findAccessibleDossier(req, id);
  if (!existing) return res.status(404).json({ error: 'Dossier introuvable.' });

  const d = unwrap(validateDossierInput(req.body));
  const updated = await prisma.clientDossier.update({ where: { id }, data: dossierData(d), include: DOSSIER_INCLUDE });
  if (existing.isMain) await prisma.organization.update({ where: { id: existing.organizationId }, data: { name: d.name } });
  res.json(serializeDossier(updated));
}));

/** Suppression d'un dossier par le compte principal (cascade : écritures, réglages, compte du propriétaire). */
router.post('/dossiers/:id/delete', handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant de dossier invalide.' });
  const existing = await findAccessibleDossier(req, id);
  if (!existing) return res.status(404).json({ error: 'Dossier introuvable.' });
  if (!isMainAccount(req)) return mainOnly(res);
  if (existing.isMain) return res.status(400).json({ error: "La comptabilité de l'entreprise ne peut pas être supprimée." });

  await prisma.clientDossier.delete({ where: { id } });
  res.status(204).end();
}));

export default router;

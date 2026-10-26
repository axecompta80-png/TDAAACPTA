import { Router } from 'express';
import { prisma } from '../db';
import { serializePlatformSettings } from '../mappers';
import { createDefaultPlatformSettings, settingsData } from '../seedData';
import { findAccessibleDossier, isMainAccount } from '../access';
import { handler } from '../http';
import { validateSettingsInput, identifier, unwrap } from '../validation';

/**
 * Réglages par dossier. Ceux de la comptabilité de l'entreprise, modifiés par le compte
 * principal, sont recopiés sur tous les dossiers de l'entreprise (qui peuvent ensuite re-modifier les leurs).
 */
const router = Router();

router.get('/settings', handler(async (req, res) => {
  const dossierId = identifier(req.query.dossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });
  const row = (await prisma.platformSettings.findUnique({ where: { dossierId: dossier.id } })) ?? (await createDefaultPlatformSettings(prisma, dossier.id));
  res.json(serializePlatformSettings(row));
}));

/** Réponse : { settings, propagated } — propagated = recopiés sur tous les dossiers de l'entreprise. */
router.post('/settings/update', handler(async (req, res) => {
  const dossierId = identifier((req.body ?? {}).dossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });
  const data = settingsData(unwrap(validateSettingsInput(req.body)));

  const propagated = dossier.isMain && isMainAccount(req);
  const targets = propagated
    ? (await prisma.clientDossier.findMany({ where: { organizationId: dossier.organizationId }, select: { id: true } })).map(d => d.id)
    : [dossier.id];
  await prisma.$transaction(targets.map(id => prisma.platformSettings.upsert({ where: { dossierId: id }, update: data, create: { ...data, dossierId: id } })));
  const saved = await prisma.platformSettings.findUniqueOrThrow({ where: { dossierId: dossier.id } });
  res.json({ settings: serializePlatformSettings(saved), propagated });
}));

export default router;

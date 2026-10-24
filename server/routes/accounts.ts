import { Router } from 'express';
import { prisma } from '../db';
import { serializeAccount } from '../mappers';
import { findAccessibleDossier } from '../access';
import { handler } from '../http';
import { validateAccountInput, identifier, unwrap } from '../validation';

/**
 * Plan comptable propre à un dossier : création de sous-comptes (ex. 5211 Banques → 5212 Ecobank)
 * et désactivation. Le plan SYSCOHADA standard (dossierId null) n'est jamais modifiable.
 */
const router = Router();

router.post('/accounts', handler(async (req, res) => {
  const a = unwrap(validateAccountInput(req.body));
  const dossier = await findAccessibleDossier(req, a.dossierId);
  if (!dossier) return res.status(404).json({ error: 'Dossier introuvable.' });

  const parent = await prisma.syscohadaAccount.findFirst({
    where: { code: a.parentCode, OR: [{ dossierId: null }, { dossierId: a.dossierId }] },
  });
  if (!parent) return res.status(400).json({ error: `Compte parent ${a.parentCode} introuvable.` });

  const taken = await prisma.syscohadaAccount.findUnique({ where: { code: a.code } });
  if (taken) {
    return res.status(409).json({
      error: taken.dossierId && taken.dossierId !== a.dossierId
        ? `Le code ${a.code} est déjà utilisé par un autre dossier : choisissez un autre code (ex. ${a.code}1).`
        : `Le compte ${a.code} existe déjà.`,
    });
  }

  const row = await prisma.syscohadaAccount.create({
    data: {
      code: a.code,
      label: a.label,
      classNumber: Number(a.code[0]),
      category: parent.category,
      parentCode: parent.code,
      dossierId: a.dossierId,
    },
  });
  res.status(201).json(serializeAccount(row));
}));

/** Renommer / activer / désactiver un compte personnalisé. */
router.post('/accounts/:code/update', handler(async (req, res) => {
  const code = identifier(req.params.code);
  const row = code ? await prisma.syscohadaAccount.findUnique({ where: { code } }) : null;
  if (!row || !row.dossierId || !(await findAccessibleDossier(req, row.dossierId))) {
    return res.status(404).json({ error: 'Compte personnalisé introuvable (le plan standard n\'est pas modifiable).' });
  }
  const { label, active } = req.body ?? {};
  const data: { label?: string; active?: boolean } = {};
  if (typeof label === 'string' && label.trim()) data.label = label.trim().slice(0, 120);
  if (typeof active === 'boolean') data.active = active;
  const updated = await prisma.syscohadaAccount.update({ where: { code: row.code }, data });
  res.json(serializeAccount(updated));
}));

export default router;

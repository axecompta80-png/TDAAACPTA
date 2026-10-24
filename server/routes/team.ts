import { Router } from 'express';
import { prisma } from '../db';
import { getAuthUser, hashPassword } from '../auth';
import { handler } from '../http';
import { identifier } from '../validation';

/**
 * Équipe d'une entreprise : un comptable voit les comptables de son entreprise,
 * en ajoute (mêmes droits que lui) et retire ceux qu'il a créés.
 */
const router = Router();

function serializeMember(u: { id: string; name: string; email: string; role: string; createdById: string | null; createdAt: Date }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdById: u.createdById, createdAt: u.createdAt.toISOString() };
}

async function myOrganization(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { organizationId: true, organization: { select: { name: true } } } });
}

router.get('/team', handler(async (req, res) => {
  const me = getAuthUser(req)!.sub;
  const { organizationId, organization } = await myOrganization(me);
  const members = await prisma.user.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } });
  res.json({ organizationName: organization.name, members: members.map(serializeMember) });
}));

router.post('/team', handler(async (req, res) => {
  const me = getAuthUser(req)!.sub;
  const { email, name, password } = req.body ?? {};
  const cleanEmail = typeof email === 'string' ? email.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'Email invalide.' });
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Nom requis.' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }
  if (await prisma.user.findUnique({ where: { email: cleanEmail } })) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }
  const { organizationId } = await myOrganization(me);
  const user = await prisma.user.create({
    data: { email: cleanEmail, name: name.trim(), passwordHash: await hashPassword(password), role: 'COMPTABLE', organizationId, createdById: me },
  });
  res.status(201).json(serializeMember(user));
}));

/** Retrait d'un comptable créé par le requérant : ses dossiers lui sont transférés. */
router.post('/team/:id/delete', handler(async (req, res) => {
  const me = getAuthUser(req)!.sub;
  const id = identifier(req.params.id);
  const target = id ? await prisma.user.findUnique({ where: { id }, select: { id: true, createdById: true } }) : null;
  if (!target || target.createdById !== me) {
    return res.status(404).json({ error: 'Comptable introuvable parmi ceux que vous avez créés.' });
  }
  await prisma.$transaction([
    prisma.clientDossier.updateMany({ where: { ownerId: target.id }, data: { ownerId: me } }),
    // Les dossiers récupérés sont désormais les siens : une attribution à soi-même n'a plus de sens.
    prisma.dossierAssignment.deleteMany({ where: { userId: me, dossier: { ownerId: me } } }),
    prisma.user.delete({ where: { id: target.id } }),
  ]);
  res.status(204).end();
}));

export default router;

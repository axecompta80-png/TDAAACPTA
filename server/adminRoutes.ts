import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from './db';
import { hashPassword } from './auth';

const router = Router();

const ROLES = ['ADMIN', 'COMPTABLE'] as const;

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Réservé aux administrateurs.' });
  }
  next();
}

function serializeUser(u: { id: string; email: string; name: string; role: string; createdAt: Date; organization?: { name: string } }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt.toISOString(), organizationName: u.organization?.name };
}

const WITH_ORG = { organization: { select: { name: true } } } as const;

function validId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

router.use(requireAdmin);

router.get('/users', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' }, include: WITH_ORG });
    res.json(users.map(serializeUser));
  } catch (e) {
    next(e);
  }
});

/** Création d'un compte par un administrateur (ADMIN ou COMPTABLE), avec sa propre entreprise. */
router.post('/users', async (req, res, next) => {
  try {
    const { email, name, password, role } = req.body ?? {};
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide.' });
    }
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Nom requis.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, name: name.trim(), passwordHash, role, organization: { create: { name: name.trim() } } }, include: WITH_ORG });
    res.status(201).json(serializeUser(user));
  } catch (e) {
    next(e);
  }
});

/** Changement de rôle : POST /users/:id/role (aucune méthode PATCH exposée). */
router.post('/users/:id/role', async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identifiant utilisateur invalide.' });
    const { role } = req.body ?? {};
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide.' });
    }
    const requester = (req as any).user;
    if (id === requester.sub && role !== 'ADMIN') {
      return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre rôle administrateur.' });
    }
    const updated = await prisma.user.update({ where: { id }, data: { role }, include: WITH_ORG });
    res.json(serializeUser(updated));
  } catch (e) {
    next(e);
  }
});

/** Réinitialisation du mot de passe d'un compte par un administrateur. */
router.post('/users/:id/password', async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identifiant utilisateur invalide.' });
    const { password } = req.body ?? {};
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }
    const updated = await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) }, include: WITH_ORG });
    res.json(serializeUser(updated));
  } catch (e) {
    next(e);
  }
});

/**
 * Suppression d'un compte : POST /users/:id/delete.
 * Compte principal : toute son entreprise (dossiers, écritures, propriétaires). Propriétaire : son seul compte.
 */
router.post('/users/:id/delete', async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identifiant utilisateur invalide.' });
    const requester = (req as any).user;
    if (id === requester.sub) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }
    const target = await prisma.user.findUnique({ where: { id }, select: { dossierId: true, organizationId: true } });
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    if (target.dossierId) await prisma.user.delete({ where: { id } });
    else await prisma.organization.delete({ where: { id: target.organizationId } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;

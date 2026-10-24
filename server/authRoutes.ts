import { Router } from 'express';
import { prisma } from './db';
import { hashPassword, verifyPassword, signToken, verifyToken, COOKIE_NAME, COOKIE_OPTIONS } from './auth';

const router = Router();

function serializeUser(u: { id: string; email: string; name: string; role: string }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

router.post('/signup', async (req, res, next) => {
  try {
    const { email, name, password } = req.body ?? {};
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, nom et mot de passe requis.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
    }

    const passwordHash = await hashPassword(password);
    // Le tout premier compte créé sur l'instance devient administrateur.
    const isFirstUser = (await prisma.user.count()) === 0;

    const user = await prisma.user.create({
      data: { email, name, passwordHash, role: isFirstUser ? 'ADMIN' : 'COMPTABLE' },
    });

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.status(201).json(serializeUser(user));
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json(serializeUser(user));
  } catch (e) {
    next(e);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: undefined });
  res.status(204).end();
});

router.get('/me', async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }
    res.json(serializeUser(user));
  } catch (e) {
    next(e);
  }
});

export default router;

// Doit rester le tout premier import : les imports ES sont hissés et évalués dans
// l'ordre d'écriture, donc .env doit être chargé avant que d'autres modules
// (./auth, etc.) ne lisent process.env à leur propre chargement.
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import dataRoutes from './routes';
import agentRoutes from './agentRoutes';
import authRoutes from './authRoutes';
import adminRoutes from './adminRoutes';
import { requireAuth } from './auth';

/**
 * Application Express nue (sans app.listen, sans middleware Vite/statique).
 *
 * Point d'entrée partagé par les deux modes d'hébergement :
 * - `server.ts` : hébergement Node classique (dev avec Vite en middleware, ou
 *   `node dist/server.cjs` en production), qui ajoute le service des fichiers
 *   statiques et appelle app.listen().
 * - `api/index.ts` : fonction serverless Vercel, qui exporte directement cet
 *   `app` (Vercel appelle les requêtes HTTP comme un handler, sans listen()) ;
 *   les fichiers statiques (`dist/`) sont alors servis par le CDN Vercel.
 */
export const app = express();

app.disable('x-powered-by');

/**
 * Politique CORS stricte de la plateforme.
 * Le frontend est servi par ce même serveur en production : les en-têtes CORS ne
 * sont donc émis que pour une origine explicitement autorisée (APP_URL / ALLOWED_ORIGINS),
 * jamais reflétés pour n'importe quel appelant.
 * Seules les méthodes GET, POST et OPTIONS sont autorisées : toute action destructrice
 * ou de mise à jour passe par un POST explicite (POST-Action), jamais par PUT/PATCH/DELETE.
 */
const ALLOWED_METHODS = ['GET', 'POST', 'OPTIONS'];
const ALLOWED_ORIGINS = [process.env.APP_URL, ...(process.env.ALLOWED_ORIGINS?.split(',') ?? [])]
  .map((o) => o?.trim())
  .filter((o): o is string => Boolean(o));
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({ error: 'Méthode HTTP non autorisée (GET, POST ou OPTIONS uniquement).' });
  }
  next();
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

// Auth routes (signup / login / logout / session courante) — publiques
app.use('/api/auth', authRoutes);

// Health Check — public
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    product: 'AxeCompta',
    edition: 'SYSCOHADA Révisé 2026',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Tout ce qui suit nécessite une session valide
app.use('/api', requireAuth);

// Agent IA : saisie en langage naturel, photos/PDF, SMS Mobile Money, questions, résumés de dossier
app.use('/api/agent', agentRoutes);

// Database-backed CRUD routes (dossiers, écritures, notifications, paramètres)
app.use('/api', dataRoutes);

// Gestion des utilisateurs & rôles — réservé aux administrateurs
app.use('/api/admin', adminRoutes);

/** Message public associé à une erreur applicative (aucun détail d'implémentation exposé). */
function publicErrorMessage(err: any): { status: number; message: string } {
  switch (err?.code) {
    case 'P2025':
      return { status: 404, message: 'Ressource introuvable.' };
    case 'P2002':
      return { status: 409, message: 'Conflit : cette ressource existe déjà.' };
    case 'P2003':
      return { status: 400, message: 'Référence invalide : donnée liée manquante.' };
    case 'P2000':
      return { status: 400, message: 'Valeur trop longue pour un champ.' };
    default:
      if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500 && typeof err?.publicMessage === 'string') {
        return { status: err.status, message: err.publicMessage };
      }
      return { status: 500, message: 'Erreur interne du serveur.' };
  }
}

// Central error handler for the async data routes
app.use('/api', (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[AxeCompta API]', err?.code ?? '', err?.message ?? err);
  if (res.headersSent) return next(err);
  const { status, message } = publicErrorMessage(err);
  res.status(status).json({ error: message });
});

let seeded: Promise<void> | null = null;

/**
 * Garantit le plan comptable SYSCOHADA et les réglages par défaut, une seule fois
 * par instance de processus (démarrage Node classique, ou premier appel après un
 * cold start serverless).
 */
export function ensureSeeded(): Promise<void> {
  if (!seeded) {
    seeded = (async () => {
      const { prisma } = await import('./db');
      const { ensureSyscohadaAccounts, createDefaultPlatformSettings } = await import('./seedData');
      try {
        await ensureSyscohadaAccounts(prisma);
      } catch (e: any) {
        console.error('[AxeCompta] Mise à jour du plan comptable impossible :', e?.message);
      }
      try {
        if ((await prisma.platformSettings.count()) === 0) {
          await createDefaultPlatformSettings(prisma);
        }
      } catch (e: any) {
        console.error('[AxeCompta] Initialisation des réglages impossible :', e?.message);
      }
    })();
  }
  return seeded;
}

import type { Request } from 'express';
import { prisma } from './db';
import { getAuthUser } from './auth';

/**
 * Règles de cloisonnement des données AxeCompta.
 *
 * - Compte principal (User.dossierId null) : la comptabilité de son entreprise (dossier isMain)
 *   et tous les dossiers de son entreprise. Lui seul crée/supprime des dossiers et règle
 *   les paramètres d'entreprise (recopiés sur tous les dossiers).
 * - Propriétaire de dossier (User.dossierId renseigné) : toutes les fonctionnalités, sur ce seul dossier.
 * - L'admin a en plus l'espace /admin ; dans l'espace comptable il suit les mêmes règles.
 *
 * Toute autorisation est évaluée côté serveur à partir de la session, jamais d'un
 * identifiant transmis par le client.
 */

export const NO_ACCESS = "Vous n'avez pas accès à ce dossier.";

const NONE = { organizationId: '__aucune__' }; // jamais satisfait : requête non authentifiée

/** Drapeau `where` Prisma restreignant la lecture aux dossiers visibles par le requérant. */
export function dossierScopeWhere(req: Request): Record<string, unknown> {
  const user = getAuthUser(req);
  if (!user?.organizationId) return NONE;
  // Jamais de clé `id` ici : ce filtre est combiné par spread avec `{ id: ... }` par les appelants.
  return user.dossierId ? { owner: { is: { id: user.sub } } } : { organizationId: user.organizationId };
}

/** Drapeau `where` pour les écritures visibles (rattachées à un dossier accessible). */
export function entryScopeWhere(req: Request): Record<string, unknown> {
  return { clientDossier: dossierScopeWhere(req) };
}

/** Drapeau `where` pour les notifications visibles. */
export function notificationScopeWhere(req: Request): Record<string, unknown> {
  return { dossier: dossierScopeWhere(req) };
}

/** Le requérant est-il le compte principal de son entreprise ? */
export function isMainAccount(req: Request): boolean {
  const user = getAuthUser(req);
  return Boolean(user?.organizationId) && !user?.dossierId;
}

/** Nom affiché dans la piste d'audit (jamais fourni par le client). */
export async function actorName(req: Request): Promise<string> {
  const user = getAuthUser(req);
  if (!user) return 'Inconnu';
  const row = await prisma.user.findUnique({ where: { id: user.sub }, select: { name: true } });
  return row?.name ?? user.email;
}

/**
 * Charge un dossier uniquement s'il est accessible au requérant.
 * Retourne null si le dossier est inexistant ou hors périmètre (réponse 404 côté routeur).
 */
export async function findAccessibleDossier(req: Request, dossierId: string) {
  if (!getAuthUser(req)) return null;
  return prisma.clientDossier.findFirst({ where: { id: dossierId, ...dossierScopeWhere(req) } });
}

/** Vérifie qu'une écriture est accessible, et la retourne. */
export async function findAccessibleEntry(req: Request, entryId: string) {
  if (!getAuthUser(req)) return null;
  return prisma.journalEntry.findFirst({ where: { id: entryId, ...entryScopeWhere(req) } });
}

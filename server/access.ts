import type { Request } from 'express';
import { prisma } from './db';
import { getAuthUser } from './auth';

/**
 * Règles de cloisonnement des données AxeCompta.
 *
 * - Deux rôles : COMPTABLE et ADMIN. L'admin a en plus l'espace /admin ; dans l'espace
 *   comptable il est soumis exactement aux mêmes règles qu'un comptable.
 * - Un utilisateur voit les dossiers qu'il a créés et ceux qui lui ont été attribués,
 *   rien d'autre (même au sein de son entreprise). Sur ces dossiers, il a tous les droits :
 *   saisie, validation, dévalidation, annulation, facturation.
 * - Supprimer un dossier et gérer ses attributions restent réservés à son créateur.
 *
 * Toute autorisation est évaluée côté serveur à partir de la session, jamais d'un
 * identifiant transmis par le client.
 */

const NONE = { id: '__aucun__' }; // jamais satisfait : requête non authentifiée

/** Drapeau `where` Prisma restreignant la lecture aux dossiers visibles par le requérant. */
export function dossierScopeWhere(req: Request): Record<string, unknown> {
  const user = getAuthUser(req);
  if (!user) return NONE;
  return { OR: [{ ownerId: user.sub }, { assignments: { some: { userId: user.sub } } }] };
}

/** Drapeau `where` pour les écritures visibles (rattachées à un dossier accessible). */
export function entryScopeWhere(req: Request): Record<string, unknown> {
  return { clientDossier: dossierScopeWhere(req) };
}

/** Drapeau `where` pour les notifications visibles. */
export function notificationScopeWhere(req: Request): Record<string, unknown> {
  return { dossier: dossierScopeWhere(req) };
}

/** Le requérant a-t-il créé ce dossier ? (suppression, attributions) */
export async function ownsDossier(req: Request, dossierId: string): Promise<boolean> {
  const user = getAuthUser(req);
  if (!user) return false;
  const dossier = await prisma.clientDossier.findUnique({ where: { id: dossierId }, select: { ownerId: true } });
  return dossier?.ownerId === user.sub;
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

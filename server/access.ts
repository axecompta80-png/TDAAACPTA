import type { Request } from 'express';
import { prisma } from './db';
import { getAuthUser } from './auth';

/**
 * Règles de cloisonnement des données AxeCompta.
 *
 * - Un utilisateur classique ne voit et ne modifie que les dossiers qu'il a créés,
 *   ainsi que les écritures et notifications rattachées à ces dossiers.
 * - L'administrateur (concepteurs de la plateforme) est à part : il gère les comptes
 *   utilisateurs via /api/admin et n'a accès à aucune donnée comptable.
 *
 * Toute autorisation est évaluée côté serveur à partir de la session, jamais d'un
 * identifiant transmis par le client.
 */

export function isAdminRequest(req: Request): boolean {
  return getAuthUser(req)?.role === 'ADMIN';
}

/**
 * Rôles comptables :
 * - COMPTABLE : saisie (brouillon / en attente), voit ses propres dossiers ;
 * - DAF : validation définitive, voit tous les dossiers ;
 * - CHEF_COMPTABLE : validation + dévalidation / annulation, voit tous les dossiers ;
 */
export function seesAllDossiers(role?: string): boolean {
  return role === 'DAF' || role === 'CHEF_COMPTABLE';
}
export function canValidate(role?: string): boolean {
  return role === 'DAF' || role === 'CHEF_COMPTABLE';
}
export function canUnvalidate(role?: string): boolean {
  return role === 'CHEF_COMPTABLE';
}

/**
 * Entrepreneur seul : le propriétaire d'un dossier a tous les droits dessus
 * (validation, dévalidation, annulation). La séparation des tâches ne s'applique
 * qu'aux autres intervenants du dossier.
 */
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

/** Drapeau `where` Prisma restreignant la lecture aux dossiers visibles par le requérant. */
export function dossierScopeWhere(req: Request): Record<string, unknown> {
  const user = getAuthUser(req);
  if (!user) return { ownerId: '__aucun__' }; // jamais satisfait : requête non authentifiée
  return seesAllDossiers(user.role) ? {} : { ownerId: user.sub };
}

/** Drapeau `where` pour les écritures visibles (rattachées à un dossier accessible). */
export function entryScopeWhere(req: Request): Record<string, unknown> {
  const user = getAuthUser(req);
  if (!user) return { clientDossier: { ownerId: '__aucun__' } };
  return seesAllDossiers(user.role) ? {} : { clientDossier: { ownerId: user.sub } };
}

/** Drapeau `where` pour les notifications visibles. */
export function notificationScopeWhere(req: Request): Record<string, unknown> {
  const user = getAuthUser(req);
  if (!user) return { dossier: { ownerId: '__aucun__' } };
  return seesAllDossiers(user.role) ? {} : { dossier: { ownerId: user.sub } };
}

/**
 * Charge un dossier uniquement s'il est accessible au requérant.
 * Retourne null si le dossier est inexistant ou hors périmètre (réponse 404 côté routeur).
 */
export async function findAccessibleDossier(req: Request, dossierId: string) {
  const user = getAuthUser(req);
  if (!user) return null;
  const dossier = await prisma.clientDossier.findUnique({ where: { id: dossierId } });
  if (!dossier) return null;
  if (!seesAllDossiers(user.role) && dossier.ownerId !== user.sub) return null;
  return dossier;
}

/** Vérifie qu'une écriture est accessible, et la retourne avec son dossier. */
export async function findAccessibleEntry(req: Request, entryId: string) {
  const user = getAuthUser(req);
  if (!user) return null;
  const entry = await prisma.journalEntry.findUnique({ where: { id: entryId } });
  if (!entry) return null;
  if (!seesAllDossiers(user.role)) {
    const dossier = await prisma.clientDossier.findUnique({ where: { id: entry.clientDossierId } });
    if (!dossier || dossier.ownerId !== user.sub) return null;
  }
  return entry;
}

import type { CurrentUser } from './authApi';

// Miroir de server/access.ts pour l'affichage ; le serveur reste la seule autorité.
/** Seul le créateur d'un dossier peut le supprimer et gérer ses attributions. */
export const ownsDossier = (dossier: { ownerId: string }, user: CurrentUser) => dossier.ownerId === user.id;

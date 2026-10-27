import type { Request } from 'express';
import { prisma } from '../db';
import {
  serializeDossier,
  serializeEntry,
  serializeNotification,
  serializePlatformSettings,
  serializeAccount,
  serializeInvoice,
} from '../mappers';
import { dossierScopeWhere, entryScopeWhere, notificationScopeWhere } from '../access';
import { getAuthUser } from '../auth';

/** Relations systématiquement chargées pour reconstituer une écriture complète côté client. */
export const ENTRY_INCLUDE = { auditTrail: true, debitAccount: true, creditAccount: true } as const;
/** Propriétaire chargé pour afficher son nom à côté du dossier. */
export const DOSSIER_INCLUDE = { owner: { select: { name: true } } } as const;

/**
 * Charges utiles de démarrage de l'application.
 * Périmètre strictement filtré sur l'utilisateur en session. `directory` liste les dossiers de
 * l'entreprise (id, nom, propriétaire seulement) pour le sélecteur, y compris ceux hors périmètre.
 */
export async function buildBootstrapPayload(req: Request) {
  const dossierScope = dossierScopeWhere(req) as any;
  const [dossierRows, directoryRows, entryRows, notificationRows, settingsRows, accountRows, invoiceRows] = await Promise.all([
    prisma.clientDossier.findMany({
      where: dossierScope,
      include: DOSSIER_INCLUDE,
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.clientDossier.findMany({
      where: { organizationId: getAuthUser(req)?.organizationId ?? '__aucune__' },
      select: { id: true, name: true, isMain: true, ownerName: true, owner: { select: { name: true } } },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.journalEntry.findMany({
      where: entryScopeWhere(req) as any,
      include: ENTRY_INCLUDE,
      orderBy: { date: 'desc' },
    }),
    prisma.appNotification.findMany({
      where: notificationScopeWhere(req) as any,
      orderBy: { timestamp: 'desc' },
    }),
    prisma.platformSettings.findMany({ where: { dossier: dossierScope } }),
    // Comptes personnalisés des dossiers visibles (le plan standard est embarqué côté client).
    prisma.syscohadaAccount.findMany({ where: { dossierId: { not: null }, dossier: { is: dossierScope } }, orderBy: { code: 'asc' } }),
    prisma.invoice.findMany({
      where: { clientDossier: dossierScope },
      include: { lines: true, payments: true },
      orderBy: { number: 'desc' },
    }),
  ]);

  return {
    dossiers: dossierRows.map(serializeDossier),
    directory: directoryRows.map(d => ({ id: d.id, name: d.name, isMain: d.isMain, ownerName: d.owner?.name ?? d.ownerName ?? undefined })),
    entries: entryRows.map(serializeEntry),
    notifications: notificationRows.map(serializeNotification),
    settingsByDossier: Object.fromEntries(settingsRows.map(r => [r.dossierId, serializePlatformSettings(r)])),
    accounts: accountRows.map(serializeAccount),
    invoices: invoiceRows.map(serializeInvoice),
  };
}

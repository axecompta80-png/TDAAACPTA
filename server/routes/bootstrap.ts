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
import { DEFAULT_PLATFORM_SETTINGS } from '../../src/data/initialSettings';

/** Relations systématiquement chargées pour reconstituer une écriture complète côté client. */
export const ENTRY_INCLUDE = { auditTrail: true, debitAccount: true, creditAccount: true } as const;
/** Owner chargé pour exposer le propriétaire d'un dossier (vue cabinet administrateur). */
export const DOSSIER_INCLUDE = {
  owner: { select: { name: true } },
  assignments: { select: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
} as const;

/**
 * Charges utiles de démarrage de l'application.
 * Périmètre strictement filtré sur l'utilisateur en session (un administrateur voit tout).
 */
export async function buildBootstrapPayload(req: Request) {
  const dossierScope = dossierScopeWhere(req) as any;
  const [dossierRows, entryRows, notificationRows, settingsRow, accountRows, invoiceRows] = await Promise.all([
    prisma.clientDossier.findMany({
      where: dossierScopeWhere(req) as any,
      include: DOSSIER_INCLUDE,
      orderBy: { createdAt: 'asc' },
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
    prisma.platformSettings.findFirst(),
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
    entries: entryRows.map(serializeEntry),
    notifications: notificationRows.map(serializeNotification),
    settings: settingsRow ? serializePlatformSettings(settingsRow) : DEFAULT_PLATFORM_SETTINGS,
    accounts: accountRows.map(serializeAccount),
    invoices: invoiceRows.map(serializeInvoice),
  };
}

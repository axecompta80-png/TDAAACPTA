import type { PrismaClient } from '@prisma/client';
import { SYSCOHADA_ACCOUNTS } from '../src/data/syscohadaPlan';
import { DEFAULT_PLATFORM_SETTINGS } from '../src/data/initialSettings';
import { AI_MODEL_TO_DB } from './mappers';

/**
 * Initialisation du socle technique uniquement.
 *
 * Aucune donnée comptable de démonstration n'est créée : chaque utilisateur démarre
 * avec un compte vierge et crée lui-même ses dossiers et ses écritures.
 * Seuls le plan comptable SYSCOHADA et les réglages par défaut sont garantis.
 */

/** Garantit la présence de tous les comptes du plan SYSCOHADA (référentiel partagé, non cloisonné). */
export async function ensureSyscohadaAccounts(prisma: PrismaClient) {
  for (const acc of SYSCOHADA_ACCOUNTS) {
    await prisma.syscohadaAccount.upsert({
      where: { code: acc.code },
      update: { label: acc.label, classNumber: acc.classNumber, category: acc.category as any },
      create: { code: acc.code, label: acc.label, classNumber: acc.classNumber, category: acc.category as any },
    });
  }
}

/** Champs de réglages tels que stockés, à partir de réglages au format client (valeurs par défaut ou saisie validée). */
export function settingsData(s: any) {
  return {
    syscohadaVersion: s.syscohadaVersion,
    cashDeductibilityThreshold: s.cashDeductibilityThreshold,
    defaultVatRate: s.defaultVatRate,
    autoFlagLargeCashPayments: s.autoFlagLargeCashPayments,
    defaultDebitCashAccount: s.defaultDebitCashAccount,
    defaultCreditSalesAccount: s.defaultCreditSalesAccount,
    defaultDebitExpenseAccount: s.defaultDebitExpenseAccount,
    globalConfidenceThreshold: s.globalConfidenceThreshold,
    autoValidateHighConfidence: s.autoValidateHighConfidence,
    duplicateDetection: s.duplicateDetection,
    aiModelPreference: AI_MODEL_TO_DB[s.aiModelPreference] as any,
    defaultStartupView: s.defaultStartupView as any,
    numberFormatting: s.numberFormatting as any,
    cabinetName: s.cabinetName,
    expertLicenseNumber: s.expertLicenseNumber,
    soundEnabled: s.soundEnabled,
    soundType: s.soundType as any,
    soundVolume: s.soundVolume,
    notifyOnAnomaly: s.notifyOnAnomaly,
    notifyOnTaxDeadline: s.notifyOnTaxDeadline,
    notifyOnMobileMoneySync: s.notifyOnMobileMoneySync,
  };
}

/** Copie d'une ligne de réglages existante (sans son identité). */
export function copySettings(row: { id: string; dossierId: string; updatedAt: Date } & Record<string, unknown>) {
  const { id: _id, dossierId: _d, updatedAt: _u, ...rest } = row;
  return rest as any;
}

/** Crée les réglages par défaut d'un dossier. */
export async function createDefaultPlatformSettings(prisma: PrismaClient, dossierId: string) {
  return prisma.platformSettings.create({ data: { ...settingsData(DEFAULT_PLATFORM_SETTINGS), dossierId } });
}

/**
 * Purge les données applicatives héritées (dossiers, écritures, notifications)
 * laissées par les anciennes versions de développement du projet.
 * Ne touche ni aux utilisateurs, ni au plan comptable, ni aux réglages.
 */
export async function purgeLegacyDemoData(prisma: PrismaClient) {
  await prisma.appNotification.deleteMany();
  await prisma.journalEntry.deleteMany(); // cascade sur audit_logs
  await prisma.clientDossier.deleteMany();
}

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

/** Crée la ligne unique de réglages de la plateforme avec les valeurs par défaut. */
export async function createDefaultPlatformSettings(prisma: PrismaClient) {
  return prisma.platformSettings.create({
    data: {
      syscohadaVersion: DEFAULT_PLATFORM_SETTINGS.syscohadaVersion,
      cashDeductibilityThreshold: DEFAULT_PLATFORM_SETTINGS.cashDeductibilityThreshold,
      defaultVatRate: DEFAULT_PLATFORM_SETTINGS.defaultVatRate,
      autoFlagLargeCashPayments: DEFAULT_PLATFORM_SETTINGS.autoFlagLargeCashPayments,
      defaultDebitCashAccount: DEFAULT_PLATFORM_SETTINGS.defaultDebitCashAccount,
      defaultCreditSalesAccount: DEFAULT_PLATFORM_SETTINGS.defaultCreditSalesAccount,
      defaultDebitExpenseAccount: DEFAULT_PLATFORM_SETTINGS.defaultDebitExpenseAccount,
      globalConfidenceThreshold: DEFAULT_PLATFORM_SETTINGS.globalConfidenceThreshold,
      autoValidateHighConfidence: DEFAULT_PLATFORM_SETTINGS.autoValidateHighConfidence,
      duplicateDetection: DEFAULT_PLATFORM_SETTINGS.duplicateDetection,
      aiModelPreference: AI_MODEL_TO_DB[DEFAULT_PLATFORM_SETTINGS.aiModelPreference] as any,
      defaultStartupView: DEFAULT_PLATFORM_SETTINGS.defaultStartupView as any,
      numberFormatting: DEFAULT_PLATFORM_SETTINGS.numberFormatting as any,
      cabinetName: DEFAULT_PLATFORM_SETTINGS.cabinetName,
      expertLicenseNumber: DEFAULT_PLATFORM_SETTINGS.expertLicenseNumber,
      soundEnabled: DEFAULT_PLATFORM_SETTINGS.soundEnabled,
      soundType: DEFAULT_PLATFORM_SETTINGS.soundType as any,
      soundVolume: DEFAULT_PLATFORM_SETTINGS.soundVolume,
      notifyOnAnomaly: DEFAULT_PLATFORM_SETTINGS.notifyOnAnomaly,
      notifyOnTaxDeadline: DEFAULT_PLATFORM_SETTINGS.notifyOnTaxDeadline,
      notifyOnMobileMoneySync: DEFAULT_PLATFORM_SETTINGS.notifyOnMobileMoneySync,
    },
  });
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

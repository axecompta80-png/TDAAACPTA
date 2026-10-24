import { Router } from 'express';
import { prisma } from '../db';
import { serializePlatformSettings, AI_MODEL_TO_DB } from '../mappers';
import { createDefaultPlatformSettings } from '../seedData';
import { handler } from '../http';
import { validateSettingsInput, unwrap } from '../validation';

const router = Router();

/** Réglages de la plateforme (référentiel transversal, identique pour tous les utilisateurs). */
router.get('/settings', handler(async (_req, res) => {
  const row = (await prisma.platformSettings.findFirst()) ?? (await createDefaultPlatformSettings(prisma));
  res.json(serializePlatformSettings(row));
}));

router.post('/settings/update', handler(async (req, res) => {
  const s = unwrap(validateSettingsInput(req.body)) as any;

  const data = {
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
    defaultStartupView: s.defaultStartupView,
    numberFormatting: s.numberFormatting,
    cabinetName: s.cabinetName,
    expertLicenseNumber: s.expertLicenseNumber,
    soundEnabled: s.soundEnabled,
    soundType: s.soundType,
    soundVolume: s.soundVolume,
    notifyOnAnomaly: s.notifyOnAnomaly,
    notifyOnTaxDeadline: s.notifyOnTaxDeadline,
    notifyOnMobileMoneySync: s.notifyOnMobileMoneySync,
  };

  const existing = await prisma.platformSettings.findFirst();
  const saved = existing
    ? await prisma.platformSettings.update({ where: { id: existing.id }, data })
    : await prisma.platformSettings.create({ data });
  res.json(serializePlatformSettings(saved));
}));

export default router;

import { Router } from 'express';
import { prisma } from '../db';
import { getAuthUser } from '../auth';
import { REGIME_FISCAL_TO_DB, AI_MODEL_TO_DB } from '../mappers';
import { handler } from '../http';
import { validateDossierInput, validateEntryInput, validateSettingsInput, identifier } from '../validation';
import { buildBootstrapPayload } from './bootstrap';

const router = Router();

/**
 * Restauration d'une sauvegarde JSON.
 *
 * Sécurité : l'opération ne remplace QUE les données de l'utilisateur en session.
 * Les identifiants de propriété de la sauvegarde sont ignorés ; tout dossier restauré
 * appartient au requérant. Les réglages globaux ne sont appliqués que par un administrateur.
 */
router.post('/import-backup', handler(async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });

  const body = (req.body ?? {}) as { settings?: unknown; dossiers?: unknown[]; entries?: unknown[] };
  const dossiers = Array.isArray(body.dossiers) ? body.dossiers : [];
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (dossiers.length === 0 && entries.length === 0) {
    return res.status(400).json({ error: 'Sauvegarde vide ou invalide.' });
  }
  if (dossiers.length > 500 || entries.length > 20000) {
    return res.status(400).json({ error: 'Sauvegarde trop volumineuse (500 dossiers / 20000 écritures maximum).' });
  }

  // 1. Vider uniquement le périmètre du requérant (jamais celui des autres utilisateurs).
  await prisma.appNotification.deleteMany({ where: { dossier: { ownerId: user.sub } } });
  await prisma.journalEntry.deleteMany({ where: { clientDossier: { ownerId: user.sub } } });
  await prisma.clientDossier.deleteMany({ where: { ownerId: user.sub } });

  // 2. Recréer les dossiers, rattachés au requérant.
  const restoredDossierIds = new Set<string>();
  for (const raw of dossiers) {
    const parsed = validateDossierInput(raw);
    if (!parsed.ok) continue;
    const d = parsed.data;
    const id = identifier((raw as any)?.id) ?? undefined;
    const created = await prisma.clientDossier.create({
      data: {
        ...(id ? { id } : {}),
        ownerId: user.sub,
        name: d.name,
        managerName: d.managerName,
        phone: d.phone,
        activity: d.activity,
        city: d.city,
        country: d.country,
        rccm: d.rccm,
        ifu: d.ifu,
        regimeFiscal: REGIME_FISCAL_TO_DB[d.regimeFiscal] as any,
        confidenceThreshold: d.confidenceThreshold,
        currency: d.currency,
      },
    });
    restoredDossierIds.add(created.id);
  }

  // 3. Recréer les écritures, uniquement sur les dossiers restaurés.
  for (const raw of entries) {
    const dossierId = identifier((raw as any)?.clientDossierId);
    if (!dossierId || !restoredDossierIds.has(dossierId)) continue;
    // Dossier restauré = dossier du requérant : il en conserve les statuts validés.
    const parsed = validateEntryInput(raw, { trusted: true });
    if (!parsed.ok) continue;
    const e = parsed.data;
    const id = identifier((raw as any)?.id) ?? undefined;
    await prisma.journalEntry.create({
      data: {
        ...(id ? { id } : {}),
        date: new Date(e.date),
        label: e.label,
        pieceRef: e.pieceRef,
        debitAccountCode: e.debitAccountCode,
        creditAccountCode: e.creditAccountCode,
        amount: e.amount,
        tvaAmount: e.tvaAmount,
        clientDossierId: dossierId,
        status: e.status as any,
        confidenceScore: e.confidenceScore,
        detectedAnomaly: e.detectedAnomaly,
        rawInput: e.rawInput,
        inputType: e.inputType as any,
        explanationSimplified: e.explanationSimplified,
        paymentMethod: e.paymentMethod as any,
        auditTrail: {
          create: e.auditTrail.map(a => ({
            id: a.id,
            timestamp: new Date(a.timestamp),
            action: a.action as any,
            author: a.author,
            notes: a.notes,
            previousValue: a.previousValue,
            confidenceScore: a.confidenceScore,
          })),
        },
      },
    });
  }

  // 4. Réglages : réservés à l'administrateur (configuration globale de la plateforme).
  if (body.settings && user.role === 'ADMIN') {
    const parsed = validateSettingsInput(body.settings);
    if (parsed.ok) {
      const s = parsed.data as any;
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
      if (existing) await prisma.platformSettings.update({ where: { id: existing.id }, data });
      else await prisma.platformSettings.create({ data });
    }
  }

  res.json(await buildBootstrapPayload(req));
}));

export default router;

import type { ClientDossier, JournalEntry, AppNotification, PlatformSettings, SYSCOHADAAccount, Invoice } from '../src/types';

// Prisma enums use @map to store the exact French/hyphenated strings the
// frontend already relies on. Prisma Client itself always returns the
// enum's identifier name, never the mapped DB value, so we translate here.

export const REGIME_FISCAL_TO_DB: Record<string, string> = {
  'Réel Simplifié': 'REEL_SIMPLIFIE',
  'Réel Normal': 'REEL_NORMAL',
  'Synthétique / Forfait': 'SYNTHETIQUE_FORFAIT',
};

export const REGIME_FISCAL_FROM_DB: Record<string, ClientDossier['regimeFiscal']> = {
  REEL_SIMPLIFIE: 'Réel Simplifié',
  REEL_NORMAL: 'Réel Normal',
  SYNTHETIQUE_FORFAIT: 'Synthétique / Forfait',
};

export const AI_MODEL_TO_DB: Record<string, string> = {
  'gemini-2.5-flash': 'GEMINI_2_5_FLASH',
  'gemini-2.5-flash-lite': 'GEMINI_2_5_FLASH_LITE',
  'heuristic-fast': 'HEURISTIC_FAST',
};

export const AI_MODEL_FROM_DB: Record<string, PlatformSettings['aiModelPreference']> = {
  GEMINI_2_5_FLASH: 'gemini-2.5-flash',
  GEMINI_2_5_FLASH_LITE: 'gemini-2.5-flash-lite',
  HEURISTIC_FAST: 'heuristic-fast',
};

/** Reconstruit un horodatage relatif ("Il y a 5 min", "Hier à 17:45"...) comme l'attend NotificationPanel. */
export function relativeTimeFr(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;

  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} heure${diffH > 1 ? 's' : ''}`;

  const diffD = Math.round(diffH / 24);
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffD === 1) return `Hier à ${time}`;

  return date.toLocaleDateString('fr-FR');
}

export function serializeDossier(row: any): ClientDossier {
  return {
    id: row.id,
    isMain: Boolean(row.isMain),
    ownerName: row.owner?.name ?? undefined,
    name: row.name,
    managerName: row.managerName,
    phone: row.phone,
    activity: row.activity,
    city: row.city,
    country: row.country,
    rccm: row.rccm,
    ifu: row.ifu,
    regimeFiscal: REGIME_FISCAL_FROM_DB[row.regimeFiscal],
    currency: row.currency,
  };
}

export function serializeAuditLog(row: any) {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    action: row.action,
    author: row.author,
    notes: row.notes ?? undefined,
    previousValue: row.previousValue ?? undefined,
    confidenceScore: row.confidenceScore ?? undefined,
  };
}

export function serializeEntry(row: any): JournalEntry {
  return {
    id: row.id,
    date: row.date.toISOString().split('T')[0],
    label: row.label,
    pieceRef: row.pieceRef,
    debitAccount: `${row.debitAccountCode} - ${row.debitAccount.label}`,
    debitAccountCode: row.debitAccountCode,
    creditAccount: `${row.creditAccountCode} - ${row.creditAccount.label}`,
    creditAccountCode: row.creditAccountCode,
    amount: Number(row.amount),
    tvaAmount: Number(row.tvaAmount),
    clientDossierId: row.clientDossierId,
    status: row.status,
    confidenceScore: row.confidenceScore,
    detectedAnomaly: row.detectedAnomaly ?? undefined,
    rawInput: row.rawInput,
    inputType: row.inputType,
    explanationSimplified: row.explanationSimplified,
    paymentMethod: row.paymentMethod,
    auditTrail: (row.auditTrail ?? []).map(serializeAuditLog),
    createdById: row.createdById ?? undefined,
    updatedById: row.updatedById ?? undefined,
    validatedById: row.validatedById ?? undefined,
    validatedAt: row.validatedAt?.toISOString() ?? undefined,
    invoiceId: row.invoiceId ?? undefined,
  };
}

export function serializeAccount(row: any): SYSCOHADAAccount {
  return {
    code: row.code,
    label: row.label,
    classNumber: row.classNumber,
    category: row.category,
    parentCode: row.parentCode ?? undefined,
    dossierId: row.dossierId ?? undefined,
    active: row.active,
  };
}

const day = (d: Date) => d.toISOString().split('T')[0];

export function serializeInvoice(row: any): Invoice {
  return {
    id: row.id,
    clientDossierId: row.clientDossierId,
    number: row.number,
    date: day(row.date),
    dueDate: day(row.dueDate),
    mode: row.mode,
    paymentMethod: row.paymentMethod ?? undefined,
    customerName: row.customerName,
    customerPhone: row.customerPhone ?? undefined,
    customerEmail: row.customerEmail ?? undefined,
    customerAddress: row.customerAddress ?? undefined,
    customerTaxId: row.customerTaxId ?? undefined,
    customerAccountCode: row.customerAccountCode,
    salesAccountCode: row.salesAccountCode,
    vatRate: Number(row.vatRate),
    totalHT: Number(row.totalHT),
    totalTVA: Number(row.totalTVA),
    totalTTC: Number(row.totalTTC),
    paymentTerms: row.paymentTerms ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    createdById: row.createdById ?? undefined,
    updatedById: row.updatedById ?? undefined,
    validatedById: row.validatedById ?? undefined,
    validatedAt: row.validatedAt?.toISOString() ?? undefined,
    lines: [...(row.lines ?? [])]
      .sort((a: any, b: any) => a.position - b.position)
      .map((l: any) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), amountHT: Number(l.amountHT) })),
    payments: (row.payments ?? []).map((p: any) => ({ id: p.id, entryId: p.entryId, amount: Number(p.amount), createdAt: p.createdAt.toISOString() })),
  };
}

export function serializeNotification(row: any): AppNotification {
  const hasPayload = Boolean(row.actionMode || row.actionExpertTab);
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    timestamp: relativeTimeFr(row.timestamp),
    type: row.type,
    category: row.category,
    read: row.read,
    dossierId: row.dossierId ?? undefined,
    actionLabel: row.actionLabel ?? undefined,
    actionPayload: hasPayload
      ? { mode: row.actionMode ?? undefined, expertTab: row.actionExpertTab ?? undefined }
      : undefined,
  };
}

export function serializePlatformSettings(row: any): PlatformSettings {
  return {
    syscohadaVersion: row.syscohadaVersion,
    cashDeductibilityThreshold: Number(row.cashDeductibilityThreshold),
    defaultVatRate: Number(row.defaultVatRate),
    autoFlagLargeCashPayments: row.autoFlagLargeCashPayments,
    defaultDebitCashAccount: row.defaultDebitCashAccount,
    defaultCreditSalesAccount: row.defaultCreditSalesAccount,
    defaultDebitExpenseAccount: row.defaultDebitExpenseAccount,
    duplicateDetection: row.duplicateDetection,
    aiModelPreference: AI_MODEL_FROM_DB[row.aiModelPreference],
    defaultStartupView: row.defaultStartupView,
    numberFormatting: row.numberFormatting,
    cabinetName: row.cabinetName,
    expertLicenseNumber: row.expertLicenseNumber,
    soundEnabled: row.soundEnabled,
    soundType: row.soundType,
    soundVolume: row.soundVolume,
    notifyOnAnomaly: row.notifyOnAnomaly,
    notifyOnTaxDeadline: row.notifyOnTaxDeadline,
    notifyOnMobileMoneySync: row.notifyOnMobileMoneySync,
  };
}

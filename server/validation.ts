import { simpleLines, linesError, defaultJournal, JOURNALS, totalDebit } from '../src/utils/entryLines';
import type { JournalCode, JournalLine } from '../src/types';

/**
 * Validation stricte des entrées API (whitelist de champs + types + bornes).
 *
 * Aucune valeur du client n'est écrite telle quelle en base : chaque champ est
 * validé, normalisé et borné. Les identifiants de propriété (entreprise, dossier) ne sont
 * jamais acceptés depuis le client, ils proviennent de la session serveur.
 */

export const REGIMES_FISCAUX = ['Réel Simplifié', 'Réel Normal', 'Synthétique / Forfait'] as const;
export const TRANSACTION_STATUSES = ['draft', 'pending_review', 'anomaly', 'validated', 'cancelled'] as const;
/** Statuts qu'un saisisseur peut demander : la validation passe toujours par une route dédiée. */
export const ENTRY_STATUSES = ['draft', 'pending_review', 'anomaly'] as const;
export const INPUT_MODES = ['text', 'voice', 'photo', 'mobile_money', 'manual', 'excel_import'] as const;
export const PAYMENT_METHODS = ['cash', 'orange_money', 'mtn_momo', 'wave', 'moov_money', 'bank_transfer', 'cheque'] as const;
export const AUDIT_ACTIONS = ['created_by_ai', 'validated_by_expert', 'auto_validated', 'edited_by_expert', 'anomaly_flagged', 'submitted_for_review', 'unvalidated', 'cancelled', 'reversed'] as const;
export const JOURNAL_CODES = JOURNALS.map(j => j.code);
/** Actions que le client peut journaliser lui-même (les autres sont écrites par le serveur). */
const CLIENT_AUDIT_ACTIONS = ['created_by_ai', 'edited_by_expert', 'anomaly_flagged'] as const;

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Déroule un résultat de validation : renvoie les données ou lève une erreur 400 exposable au client. */
export function unwrap<T>(result: Result<T>): T {
  const outcome = result as { ok: boolean; data?: T; error?: string };
  if (outcome.ok) return outcome.data as T;
  const message = outcome.error ?? 'Données invalides.';
  throw Object.assign(new Error(message), { status: 400, publicMessage: message });
}

const MAX_TEXT = 500;

function text(value: unknown, max = 160): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export function optionalText(value: unknown, max = MAX_TEXT): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function identifier(value: unknown): string | null {
  const t = text(value, 64);
  if (!t || !/^[A-Za-z0-9_-]+$/.test(t)) return null;
  return t;
}

/** Date normalisée au format YYYY-MM-DD (rejette toute chaîne non convertible). */
export function isoDate(value: unknown): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function money(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) return null;
  return Math.round(n * 100) / 100;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export interface DossierInput {
  name: string; managerName: string; phone: string; activity: string; city: string; country: string;
  rccm: string; ifu: string; regimeFiscal: string; currency: string;
}

export function validateDossierInput(body: unknown): Result<DossierInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = text(b.name, 160);
  const managerName = text(b.managerName, 120);
  const phone = text(b.phone, 40);
  const activity = text(b.activity, 200);
  const city = text(b.city, 80);
  const country = text(b.country, 80);
  const rccm = text(b.rccm, 60);
  const ifu = text(b.ifu, 60);
  const currency = text(b.currency, 12) ?? 'FCFA';
  const regimeFiscal = oneOf(b.regimeFiscal, REGIMES_FISCAUX);

  if (!name) return { ok: false, error: 'Le nom du dossier est requis (160 caractères maximum).' };
  if (!managerName) return { ok: false, error: 'Le nom du gérant est requis.' };
  if (!phone) return { ok: false, error: 'Le numéro de téléphone est requis.' };
  if (!activity) return { ok: false, error: "Le secteur d'activité est requis." };
  if (!city) return { ok: false, error: 'La ville est requise.' };
  if (!country) return { ok: false, error: 'Le pays est requis.' };
  if (!rccm) return { ok: false, error: 'Le numéro RCCM est requis.' };
  if (!ifu) return { ok: false, error: "Le numéro d'IFU est requis." };
  if (!regimeFiscal) return { ok: false, error: 'Régime fiscal invalide.' };

  return { ok: true, data: { name, managerName, phone, activity, city, country, rccm, ifu, regimeFiscal, currency } };
}

export interface AuditLogInput {
  id: string; timestamp: string; action: string; author: string;
  notes?: string; previousValue?: string;
}

export interface EntryInput {
  id?: string;
  date: string;
  label: string;
  /** Vide : numéro de pièce attribué par le serveur (VT-000012). */
  pieceRef: string;
  journal: JournalCode;
  lines: JournalLine[];
  amount: number;
  status: string;
  detectedAnomaly?: string;
  rawInput: string;
  inputType: string;
  explanationSimplified: string;
  paymentMethod: string;
  auditTrail: AuditLogInput[];
}

function parseAuditTrail(value: unknown, trusted = false): AuditLogInput[] {
  if (!Array.isArray(value)) return [];
  const rows: AuditLogInput[] = [];
  for (const raw of value.slice(0, 100)) {
    const a = (raw ?? {}) as Record<string, unknown>;
    const action = oneOf(a.action, trusted ? AUDIT_ACTIONS : CLIENT_AUDIT_ACTIONS);
    if (a.action !== undefined && !action) continue; // validation/annulation : jamais acceptées du client
    const author = optionalText(a.author, 120) ?? 'Agent AxeCompta';
    const notes = optionalText(a.notes) ?? undefined;
    const previousValue = optionalText(a.previousValue) ?? undefined;
    rows.push({
      id: identifier(a.id) ?? `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: isoDate(a.timestamp) && typeof a.timestamp === 'string' ? new Date(a.timestamp).toISOString() : new Date().toISOString(),
      action: action ?? 'created_by_ai',
      author,
      notes,
      previousValue,
    });
  }
  return rows;
}

/**
 * Lignes d'écriture. Ancien format accepté (sauvegardes antérieures) :
 * debitAccountCode / creditAccountCode / amount / tvaAmount, converti en lignes.
 */
function parseLines(b: Record<string, unknown>): JournalLine[] | string {
  if (!Array.isArray(b.lines)) {
    const debit = text(b.debitAccountCode, 20);
    const credit = text(b.creditAccountCode, 20);
    const amount = money(b.amount);
    const tva = money(b.tvaAmount ?? 0) ?? 0;
    if (!debit || !credit || !amount) return 'Lignes d\'écriture manquantes.';
    return simpleLines(debit, credit, amount, tva);
  }
  if (b.lines.length > 200) return 'Écriture limitée à 200 lignes.';
  const lines: JournalLine[] = [];
  for (const [i, raw] of b.lines.entries()) {
    const l = (raw ?? {}) as Record<string, unknown>;
    const accountCode = text(l.accountCode, 20);
    const debit = money(l.debit ?? 0);
    const credit = money(l.credit ?? 0);
    if (!accountCode) return `Ligne ${i + 1} : compte invalide.`;
    if (debit === null || credit === null) return `Ligne ${i + 1} : montant invalide.`;
    if (debit === 0 && credit === 0) continue; // ligne vide du formulaire
    lines.push({ accountCode, debit, credit, label: optionalText(l.label, 300) ?? undefined });
  }
  return linesError(lines) ?? lines;
}

/**
 * `trusted` (restauration de sauvegarde par un profil habilité à valider) : statut et piste
 * d'audit d'origine conservés. Sinon, une écriture arrive au mieux "en attente".
 */
export function validateEntryInput(body: unknown, options: { requireId?: boolean; trusted?: boolean } = {}): Result<EntryInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const date = isoDate(b.date);
  const label = text(b.label, 300);
  const pieceRef = optionalText(b.pieceRef, 80) ?? '';
  const lines = parseLines(b);
  // Toute écriture saisie arrive au mieux "en attente" : un statut "validé" envoyé par le client est ignoré.
  const status = oneOf(b.status, options.trusted ? TRANSACTION_STATUSES : ENTRY_STATUSES) ?? 'pending_review';
  const inputType = oneOf(b.inputType, INPUT_MODES);
  const paymentMethod = oneOf(b.paymentMethod, PAYMENT_METHODS);
  const explanationSimplified = optionalText(b.explanationSimplified) ?? '';
  const rawInput = optionalText(b.rawInput) ?? '';
  const detectedAnomaly = optionalText(b.detectedAnomaly) ?? undefined;
  const id = options.requireId ? identifier(b.id) : undefined;

  if (options.requireId && !id) return { ok: false, error: 'Identifiant d\'écriture invalide.' };
  if (!date) return { ok: false, error: 'Date d\'écriture invalide.' };
  if (!label) return { ok: false, error: 'Le libellé de l\'écriture est requis.' };
  if (typeof lines === 'string') return { ok: false, error: lines };
  const journal = oneOf(b.journal, JOURNAL_CODES) ?? defaultJournal(lines);
  if (!inputType) return { ok: false, error: 'Mode de saisie invalide.' };
  if (!paymentMethod) return { ok: false, error: 'Mode de paiement invalide.' };

  return {
    ok: true,
    data: {
      id: id ?? undefined, date, label, pieceRef, journal, lines, amount: totalDebit(lines), status, detectedAnomaly, rawInput, inputType,
      explanationSimplified, paymentMethod, auditTrail: parseAuditTrail(b.auditTrail, options.trusted),
    },
  };
}

export interface NotificationInput {
  id?: string; title: string; message: string; type: string; category: string;
  read: boolean; dossierId?: string; actionLabel?: string; actionMode?: string; actionExpertTab?: string;
}

const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'] as const;
const NOTIFICATION_CATEGORIES = ['compta', 'fiscal', 'tresorerie', 'ia', 'system'] as const;
const STARTUP_VIEWS = ['simplified', 'expert'] as const;
const EXPERT_TABS = ['portfolio', 'journal', 'invoices', 'accounts', 'ledger', 'financials', 'tax'] as const;

export function validateNotificationInput(body: unknown): Result<NotificationInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = text(b.title, 160);
  const message = text(b.message, MAX_TEXT);
  const type = oneOf(b.type, NOTIFICATION_TYPES);
  const category = oneOf(b.category, NOTIFICATION_CATEGORIES);
  const dossierId = b.dossierId === undefined || b.dossierId === null ? undefined : identifier(b.dossierId);
  const actionLabel = optionalText(b.actionLabel, 80) ?? undefined;
  const payload = (b.actionPayload ?? {}) as Record<string, unknown>;
  const actionMode = oneOf(payload.mode, STARTUP_VIEWS) ?? undefined;
  const actionExpertTab = oneOf(payload.expertTab, EXPERT_TABS) ?? undefined;
  const id = identifier(b.id) ?? undefined;

  if (!title) return { ok: false, error: 'Titre de notification requis.' };
  if (!message) return { ok: false, error: 'Message de notification requis.' };
  if (!type) return { ok: false, error: 'Type de notification invalide.' };
  if (!category) return { ok: false, error: 'Catégorie de notification invalide.' };
  if (b.dossierId && !dossierId) return { ok: false, error: 'Dossier de notification invalide.' };

  return { ok: true, data: { id, title, message, type, category, read: b.read === true, dossierId, actionLabel, actionMode, actionExpertTab } };
}

export function validateSettingsInput(body: unknown): Result<Record<string, unknown>> {
  const b = (body ?? {}) as Record<string, unknown>;
  const s = b;
  const version = text(s.syscohadaVersion, 120);
  const cabinetName = text(s.cabinetName, 160);
  const license = optionalText(s.expertLicenseNumber, 80) ?? '';
  const num = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  if (!version) return { ok: false, error: 'Version SYSCOHADA requise.' };
  if (!cabinetName) return { ok: false, error: 'Nom de l’espace requis.' };
  return {
    ok: true,
    data: {
      syscohadaVersion: version,
      cashDeductibilityThreshold: num(s.cashDeductibilityThreshold, 0, 1e9, 500000),
      defaultVatRate: num(s.defaultVatRate, 0, 100, 18),
      autoFlagLargeCashPayments: s.autoFlagLargeCashPayments !== false,
      defaultDebitCashAccount: text(s.defaultDebitCashAccount, 120) ?? '5711 - Caisse Principale',
      defaultCreditSalesAccount: text(s.defaultCreditSalesAccount, 120) ?? '7011 - Ventes de Marchandises',
      defaultDebitExpenseAccount: text(s.defaultDebitExpenseAccount, 120) ?? '6011 - Achats de Marchandises',
      duplicateDetection: s.duplicateDetection !== false,
      aiModelPreference: oneOf(s.aiModelPreference, ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'heuristic-fast'] as const) ?? 'gemini-2.5-flash',
      defaultStartupView: oneOf(s.defaultStartupView, STARTUP_VIEWS) ?? 'simplified',
      numberFormatting: oneOf(s.numberFormatting, ['standard', 'compact'] as const) ?? 'standard',
      cabinetName,
      expertLicenseNumber: license,
      soundEnabled: s.soundEnabled !== false,
      soundType: oneOf(s.soundType, ['fintech_chime', 'crystal_bell', 'soft_chord', 'alert_warning'] as const) ?? 'fintech_chime',
      soundVolume: num(s.soundVolume, 0, 1, 0.7),
      notifyOnAnomaly: s.notifyOnAnomaly !== false,
      notifyOnTaxDeadline: s.notifyOnTaxDeadline !== false,
      notifyOnMobileMoneySync: s.notifyOnMobileMoneySync !== false,
    },
  };
}

// ---------- Plan comptable ----------

export interface AccountInput { code: string; label: string; parentCode: string; dossierId: string }

export function validateAccountInput(body: unknown): Result<AccountInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  const parentCode = typeof b.parentCode === 'string' ? b.parentCode.trim() : '';
  const label = text(b.label, 120);
  const dossierId = identifier(b.dossierId);
  if (!/^[1-9][0-9]{2,11}$/.test(code)) return { ok: false, error: 'Code de compte invalide (3 à 12 chiffres).' };
  if (!/^[1-9][0-9]{2,11}$/.test(parentCode)) return { ok: false, error: 'Compte parent invalide.' };
  // Même compte principal SYSCOHADA (3 premiers chiffres) : 5211 Banques → 5212 Ecobank, 52111…
  if (code === parentCode || !code.startsWith(parentCode.slice(0, 3))) {
    return { ok: false, error: `Le sous-compte doit commencer par ${parentCode.slice(0, 3)} (même compte principal que ${parentCode}).` };
  }
  if (!label) return { ok: false, error: 'Libellé du compte requis.' };
  if (!dossierId) return { ok: false, error: 'Dossier invalide.' };
  return { ok: true, data: { code, label, parentCode, dossierId } };
}

// ---------- Factures ----------

export interface InvoiceInputData {
  kind: 'sale' | 'credit_note' | 'purchase';
  externalRef: string | null;
  originalInvoiceId: string | null;
  date: string; dueDate: string; mode: 'cash' | 'credit'; paymentMethod: string | null;
  customerName: string; customerPhone: string | null; customerEmail: string | null;
  customerAddress: string | null; customerTaxId: string | null;
  customerAccountCode: string; salesAccountCode: string; vatRate: number;
  paymentTerms: string | null; notes: string | null;
  lines: { description: string; quantity: number; unitPrice: number }[];
}

export function validateInvoiceInput(body: unknown): Result<InvoiceInputData> {
  const b = (body ?? {}) as Record<string, unknown>;
  const date = isoDate(b.date);
  const kind = oneOf(b.kind, ['sale', 'credit_note', 'purchase'] as const) ?? 'sale';
  const purchase = kind === 'purchase';
  // Un avoir est imputé sur la créance (aucun remboursement immédiat).
  const mode = kind === 'credit_note' ? 'credit' : oneOf(b.mode, ['cash', 'credit'] as const);
  const paymentMethod = oneOf(b.paymentMethod, PAYMENT_METHODS);
  const customerName = text(b.customerName, 160);
  const customerAccountCode = (typeof b.customerAccountCode === 'string' && b.customerAccountCode.trim()) || (purchase ? '4011' : '4111');
  const salesAccountCode = (typeof b.salesAccountCode === 'string' && b.salesAccountCode.trim()) || (purchase ? '6011' : '7011');
  const originalInvoiceId = kind === 'credit_note' ? identifier(b.originalInvoiceId) : null;
  const vat = Number(b.vatRate ?? 0);
  const rawLines = Array.isArray(b.lines) ? b.lines.slice(0, 200) : [];
  const lines: InvoiceInputData['lines'] = [];
  for (const raw of rawLines) {
    const l = (raw ?? {}) as Record<string, unknown>;
    const description = text(l.description, 300);
    const quantity = Number(l.quantity);
    const unitPrice = money(l.unitPrice);
    if (!description) return { ok: false, error: 'Chaque ligne doit avoir une désignation.' };
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9) return { ok: false, error: `Quantité invalide pour « ${description} ».` };
    if (unitPrice === null) return { ok: false, error: `Prix unitaire invalide pour « ${description} ».` };
    lines.push({ description, quantity: Math.round(quantity * 1000) / 1000, unitPrice });
  }

  if (!date) return { ok: false, error: 'Date de facture invalide.' };
  if (!mode) return { ok: false, error: 'Mode de facture invalide (comptant ou crédit).' };
  if (mode === 'cash' && !paymentMethod) return { ok: false, error: 'Mode de règlement requis pour une facture au comptant.' };
  if (!customerName) return { ok: false, error: purchase ? 'Nom du fournisseur requis.' : 'Nom du client requis.' };
  if (purchase) {
    if (!/^40[0-9]{1,10}$/.test(customerAccountCode)) return { ok: false, error: 'Le compte fournisseur doit être un compte 40x.' };
    if (!/^(6|2)[0-9]{1,11}$/.test(salesAccountCode)) return { ok: false, error: "Le compte d'achat doit être une charge (6x) ou une immobilisation (2x)." };
  } else {
    if (!/^411[0-9]{0,9}$/.test(customerAccountCode)) return { ok: false, error: 'Le compte client doit être un compte 411.' };
    if (!/^70[0-9]{1,10}$/.test(salesAccountCode)) return { ok: false, error: 'Le compte de vente doit être un compte 70x.' };
  }
  if (kind === 'credit_note' && !originalInvoiceId) return { ok: false, error: "Un avoir doit référencer la facture d'origine." };
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) return { ok: false, error: 'Taux de TVA invalide.' };
  if (lines.length === 0) return { ok: false, error: 'La facture doit contenir au moins une ligne.' };
  const dueDate = mode === 'cash' ? date : (isoDate(b.dueDate) ?? date);
  if (dueDate < date) return { ok: false, error: "L'échéance ne peut pas précéder la date de facture." };

  return {
    ok: true,
    data: {
      kind, externalRef: purchase ? optionalText(b.externalRef, 80) : null, originalInvoiceId,
      date, dueDate, mode, paymentMethod: mode === 'cash' ? paymentMethod : null,
      customerName,
      customerPhone: optionalText(b.customerPhone, 40),
      customerEmail: optionalText(b.customerEmail, 160),
      customerAddress: optionalText(b.customerAddress, 300),
      customerTaxId: optionalText(b.customerTaxId, 60),
      customerAccountCode, salesAccountCode, vatRate: Math.round(vat * 100) / 100,
      paymentTerms: optionalText(b.paymentTerms, 300),
      notes: optionalText(b.notes, MAX_TEXT),
      lines,
    },
  };
}

export function positiveMoney(value: unknown): number | null {
  const n = money(value);
  return n !== null && n > 0 ? n : null;
}

/** Motif facultatif d'une dévalidation / annulation. */
export function optionalReason(body: unknown): string | null {
  return optionalText(((body ?? {}) as Record<string, unknown>).reason, 300);
}

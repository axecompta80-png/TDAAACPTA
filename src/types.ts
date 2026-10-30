/** Cycle de vie : draft → pending_review (ou anomaly) → validated → cancelled */
export type TransactionStatus = 'draft' | 'pending_review' | 'anomaly' | 'validated' | 'cancelled';

export type InputMode = 'text' | 'voice' | 'photo' | 'mobile_money' | 'manual' | 'excel_import';

export type PaymentMethod = 
  | 'cash' 
  | 'orange_money' 
  | 'mtn_momo' 
  | 'wave' 
  | 'moov_money' 
  | 'bank_transfer' 
  | 'cheque';

export interface AuditLog {
  id: string;
  timestamp: string;
  action: 'created_by_ai' | 'validated_by_expert' | 'auto_validated' | 'edited_by_expert' | 'anomaly_flagged' | 'submitted_for_review' | 'unvalidated' | 'cancelled' | 'reversed';
  author: string;
  notes?: string;
  previousValue?: string;
}

/** Journaux : ventes, achats, banque (et Mobile Money), caisse, opérations diverses, à-nouveaux. */
export type JournalCode = 'VT' | 'AC' | 'BQ' | 'CA' | 'OD' | 'AN';

/** Une ligne d'écriture : un compte, au débit OU au crédit. */
/** Onglets du mode Comptable. */
export type ExpertTab = 'portfolio' | 'journal' | 'invoices' | 'accounts' | 'ledger' | 'financials' | 'tax' | 'bank' | 'assets';

export interface JournalLine {
  /** Identifiant serveur (absent sur une ligne en cours de saisie). */
  id?: string;
  accountCode: string;
  /** Intitulé du compte, renseigné par le serveur. */
  accountLabel?: string;
  label?: string;
  debit: number;
  credit: number;
  /** Rapprochement bancaire : date du relevé où la ligne a été pointée. */
  reconciledOn?: string;
}

/** Pièce justificative (métadonnées ; le fichier se télécharge à part). */
export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** Immobilisation du registre, amortie en linéaire. */
export interface FixedAsset {
  id: string;
  clientDossierId: string;
  label: string;
  accountCode: string;
  acquisitionDate: string;
  cost: number;
  durationYears: number;
  depreciatedThrough?: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  label: string;
  pieceRef: string;
  journal: JournalCode;
  /** Numéro d'ordre dans le journal du dossier, attribué par le serveur. */
  number?: number;
  /** Au moins deux lignes, total débit = total crédit. */
  lines: JournalLine[];
  /** Total débit (= total crédit), calculé par le serveur. */
  amount: number;
  clientDossierId: string;
  status: TransactionStatus;
  detectedAnomaly?: string;
  rawInput: string;
  inputType: InputMode;
  explanationSimplified: string;
  paymentMethod: PaymentMethod;
  auditTrail: AuditLog[];
  // Renseignés par le serveur (piste d'audit)
  createdById?: string;
  updatedById?: string;
  validatedById?: string;
  validatedAt?: string;
  /** Facture à l'origine de l'écriture (écritures générées automatiquement). */
  invoiceId?: string;
  /** Écriture contre-passée par celle-ci. */
  reversalOfId?: string;
  attachments?: AttachmentMeta[];
}

/** Écriture répétée chaque mois. */
export interface RecurringEntry {
  id: string;
  clientDossierId: string;
  label: string;
  journal: JournalCode;
  lines: JournalLine[];
  day: number;
  nextDate: string;
  active: boolean;
}

export interface SYSCOHADAAccount {
  code: string;
  label: string;
  classNumber: number;
  category: 'bilan_actif' | 'bilan_passif' | 'charge' | 'produit' | 'tresorerie';
  /** Compte personnalisé : compte parent, dossier propriétaire, actif ou non. */
  parentCode?: string;
  dossierId?: string;
  active?: boolean;
}

export type InvoiceStatus = 'draft' | 'pending_review' | 'validated' | 'cancelled';

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  amountHT: number;
}

export interface InvoicePayment {
  id: string;
  entryId: string;
  amount: number;
  createdAt: string;
}

/** Facture client, avoir client, facture fournisseur. */
export type InvoiceKind = 'sale' | 'credit_note' | 'purchase';

export interface Invoice {
  id: string;
  clientDossierId: string;
  kind: InvoiceKind;
  number: string;
  /** Numéro de la facture du fournisseur. */
  externalRef?: string;
  /** Avoir : facture client d'origine. */
  originalInvoiceId?: string;
  date: string;
  dueDate: string;
  mode: 'cash' | 'credit';
  paymentMethod?: PaymentMethod;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerTaxId?: string;
  customerAccountCode: string;
  salesAccountCode: string;
  vatRate: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  paymentTerms?: string;
  notes?: string;
  status: InvoiceStatus;
  createdById?: string;
  updatedById?: string;
  validatedById?: string;
  validatedAt?: string;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
}

/** Données saisies dans le formulaire de facture (totaux recalculés par le serveur). */
export interface InvoiceInput {
  kind?: InvoiceKind;
  externalRef?: string;
  originalInvoiceId?: string;
  date: string;
  dueDate?: string;
  mode: 'cash' | 'credit';
  paymentMethod?: PaymentMethod;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerTaxId?: string;
  customerAccountCode?: string;
  salesAccountCode?: string;
  vatRate: number;
  paymentTerms?: string;
  notes?: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
}

export interface ClientDossier {
  id: string;
  /** Comptabilité de l'entreprise elle-même (une par entreprise) ; sinon un dossier confié à un propriétaire. */
  isMain: boolean;
  /** Nom du propriétaire du dossier, renseigné côté serveur (absent pour l'entreprise). */
  ownerName?: string;
  name: string;
  managerName: string;
  phone: string;
  activity: string;
  city: string;
  country: string;
  rccm: string;
  ifu: string;
  regimeFiscal: 'Réel Simplifié' | 'Réel Normal' | 'Synthétique / Forfait';
  currency: string;
  /** Écritures datées jusqu'à ce jour inclus : bloquées (période déclarée ou exercice clôturé). */
  lockedUntil?: string;
}

/** Entrée du sélecteur Entreprise / Dossiers (y compris les dossiers hors périmètre). */
export interface DossierDirectoryItem {
  id: string;
  name: string;
  isMain: boolean;
  ownerName?: string;
}

/** Champs saisis pour les informations d'une entreprise ou d'un dossier. */
export type DossierInfo = Omit<ClientDossier, 'id' | 'isMain' | 'ownerName' | 'lockedUntil'>;

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  timestamp: string;
  text: string;
  attachedPhoto?: string;
  voiceDuration?: string;
  generatedEntry?: JournalEntry;
  quickActions?: string[];
}

export interface CashflowSummary {
  cashAvailable: number;
  mobileMoneyBalance: number;
  bankBalance: number;
  totalLiquidity: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  netCashflow: number;
}

export interface CreditScoreReport {
  dossierId: string;
  scoreGlobal: number; // e.g. 84 / 100
  mention: 'Excellent dossier bancable' | 'Profil sain & solvable' | 'Profil modéré' | 'À consolider';
  chiffreAffairesMensuelMoyen: number;
  margeNetteEstimee: number;
  ratioAutonomieFinanciere: number;
  capaciteEmpruntMensuelle: number;
  montantFinancementConseille: number;
  recommandationsBanque: string[];
}

export type NotificationCategory = 'compta' | 'fiscal' | 'tresorerie' | 'ia' | 'system';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: NotificationType;
  category: NotificationCategory;
  read: boolean;
  dossierId?: string;
  actionLabel?: string;
  actionPayload?: {
    mode?: 'simplified' | 'expert';
    expertTab?: ExpertTab;
  };
}

export interface PlatformSettings {
  // Comptabilité & SYSCOHADA
  syscohadaVersion: string;
  cashDeductibilityThreshold: number; // e.g. 500000 FCFA
  defaultVatRate: number; // e.g. 18%
  autoFlagLargeCashPayments: boolean;
  defaultDebitCashAccount: string;
  defaultCreditSalesAccount: string;
  defaultDebitExpenseAccount: string;

  // IA
  duplicateDetection: boolean;
  aiModelPreference: 'gemini-2.5-flash' | 'gemini-2.5-flash-lite' | 'heuristic-fast';

  // Préférences & Affichage
  defaultStartupView: 'simplified' | 'expert';
  numberFormatting: 'standard' | 'compact';
  cabinetName: string;
  expertLicenseNumber: string;

  // Audio & Notifications
  soundEnabled: boolean;
  soundType: 'fintech_chime' | 'crystal_bell' | 'soft_chord' | 'alert_warning';
  soundVolume: number;
  notifyOnAnomaly: boolean;
  notifyOnTaxDeadline: boolean;
  notifyOnMobileMoneySync: boolean;
}

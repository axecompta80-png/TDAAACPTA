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
  action: 'created_by_ai' | 'validated_by_expert' | 'auto_validated' | 'edited_by_expert' | 'anomaly_flagged' | 'submitted_for_review' | 'unvalidated' | 'cancelled';
  author: string;
  notes?: string;
  previousValue?: string;
  confidenceScore?: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  label: string;
  pieceRef: string;
  debitAccount: string; // e.g. "5711 - Caisse Principale"
  debitAccountCode: string; // "5711"
  creditAccount: string; // e.g. "7011 - Vente de Marchandises"
  creditAccountCode: string; // "7011"
  amount: number; // Montant TTC en FCFA
  tvaAmount: number; // Montant TVA en FCFA
  clientDossierId: string;
  status: TransactionStatus;
  confidenceScore: number; // 0 - 100
  detectedAnomaly?: string;
  rawInput: string;
  inputType: InputMode;
  explanationSimplified: string;
  paymentMethod: PaymentMethod;
  auditTrail: AuditLog[];
  // Renseignés par le serveur (séparation des tâches)
  createdById?: string;
  updatedById?: string;
  validatedById?: string;
  validatedAt?: string;
  /** Facture à l'origine de l'écriture (écritures générées automatiquement). */
  invoiceId?: string;
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

export interface Invoice {
  id: string;
  clientDossierId: string;
  number: string;
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
  /** Identifiant du compte propriétaire du dossier (cloisonnement des données). */
  ownerId: string;
  /** Nom du propriétaire, renseigné côté serveur pour l'affichage cabinet (admin). */
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
  confidenceThreshold: number; // default 85
  currency: string;
}

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
    expertTab?: 'portfolio' | 'journal' | 'invoices' | 'accounts' | 'ledger' | 'financials' | 'tax';
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

  // IA & Seuil d'imputation
  globalConfidenceThreshold: number; // 50 to 98
  autoValidateHighConfidence: boolean;
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

import type { PaymentMethod, JournalEntry, ClientDossier, PlatformSettings } from '../../src/types';

export type OperationKind =
  | 'sale'
  | 'purchase'
  | 'expense'
  | 'asset_purchase'
  | 'customer_payment'
  | 'supplier_payment'
  | 'owner_withdrawal'
  | 'transfer'
  | 'loan_received'
  | 'loan_repayment'
  | 'capital_contribution'
  | 'opening_balance'
  | 'bank_fee'
  | 'other_income'
  | 'depreciation';

export type Settlement = 'paid' | 'credit' | 'partial';

/** Opération comprise par l'agent, avant transformation en écritures. */
export interface ParsedOperation {
  kind: OperationKind;
  /** Montant TTC */
  amount: number;
  /** Compte hors trésorerie (produit, charge, immobilisation, tiers). Optionnel : un défaut par nature existe. */
  natureAccountCode?: string;
  /** Mode de paiement cité par l'utilisateur ; undefined = non précisé */
  paymentMethod?: PaymentMethod;
  /** Virements internes : destination (paymentMethod = source) */
  toMethod?: PaymentMethod;
  settlement: Settlement;
  /** Partie déjà réglée si settlement = partial */
  paidAmount?: number;
  /** undefined → décidé selon la nature et le régime fiscal */
  vatApplicable?: boolean;
  counterparty?: string;
  label: string;
  explanation?: string;
  confidence: number;
  anomaly?: string;
  date?: string;
  /** Référence de pièce (ex : ID de transaction Mobile Money) */
  pieceRef?: string;
  sourceText: string;
  /** Frais de transaction Mobile Money extraits d'un SMS */
  fee?: number;
  /** TVA lue sur un document (facture, reçu) : prioritaire sur le calcul au taux par défaut */
  vatAmount?: number;
}

export type AgentIntent = 'operation' | 'question' | 'clarification' | 'chitchat';

export interface ParseOutcome {
  intent: AgentIntent;
  reply?: string;
  clarification?: string;
  operations: ParsedOperation[];
}

export interface AgentRequestContext {
  dossier: ClientDossier;
  settings: PlatformSettings;
  entries: JournalEntry[];
  now: Date;
  /** Nom affiché de l'utilisateur connecté (salutation de l'agent). */
  userName: string;
}

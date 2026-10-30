import type { Invoice, InvoiceKind, JournalCode, JournalLine } from '../types';
import { TVA_COLLECTED, TVA_DEDUCTIBLE, defaultJournal } from './entryLines';

/**
 * Règles de facturation partagées par le serveur (calcul officiel) et le client (aperçu).
 * ponytail: arrondi à l'unité (FCFA, sans centimes) ; passer à 2 décimales pour une devise à centimes.
 */
export function computeInvoiceTotals(lines: { quantity: number; unitPrice: number }[], vatRate: number) {
  const amounts = lines.map(l => Math.round(l.quantity * l.unitPrice));
  const totalHT = amounts.reduce((s, a) => s + a, 0);
  const totalTVA = Math.round((totalHT * vatRate) / 100);
  return { amounts, totalHT, totalTVA, totalTTC: totalHT + totalTVA };
}

export interface Posting { label: string; journal: JournalCode; amount: number; lines: JournalLine[] }

export const KIND_LABEL: Record<InvoiceKind, string> = { sale: 'Facture', credit_note: 'Avoir', purchase: 'Facture fournisseur' };
export const KIND_PREFIX: Record<InvoiceKind, string> = { sale: 'FAC', credit_note: 'AV', purchase: 'FF' };

/** Le tiers est-il un fournisseur (règlements au débit du 401) ? */
export const isSupplierSide = (kind: InvoiceKind) => kind === 'purchase';

const line = (accountCode: string, debit: number, credit: number): JournalLine => ({ accountCode, debit, credit });

/**
 * Écritures générées à la validation :
 *   facture client (VT)      : D 411x TTC / C 70x HT / C 4431 TVA
 *   avoir client (VT)        : D 70x HT / D 4431 TVA / C 411x TTC
 *   facture fournisseur (AC) : D 6x HT / D 4452 TVA / C 401x TTC
 *   + au comptant : règlement immédiat (trésorerie / tiers), lettré automatiquement.
 */
export function invoicePostings(
  inv: Pick<Invoice, 'number' | 'customerName' | 'customerAccountCode' | 'salesAccountCode' | 'totalHT' | 'totalTVA' | 'totalTTC' | 'mode'> & { kind?: InvoiceKind; externalRef?: string },
  treasuryCode?: string,
): { sale: Posting; payment?: Posting } {
  const kind = inv.kind ?? 'sale';
  const tiers = inv.customerAccountCode, nature = inv.salesAccountCode;
  const tva = inv.totalTVA > 0;
  const lines: JournalLine[] =
    kind === 'sale' ? [line(tiers, inv.totalTTC, 0), line(nature, 0, inv.totalHT), ...(tva ? [line(TVA_COLLECTED, 0, inv.totalTVA)] : [])]
    : kind === 'credit_note' ? [line(nature, inv.totalHT, 0), ...(tva ? [line(TVA_COLLECTED, inv.totalTVA, 0)] : []), line(tiers, 0, inv.totalTTC)]
    : [line(nature, inv.totalHT, 0), ...(tva ? [line(TVA_DEDUCTIBLE, inv.totalTVA, 0)] : []), line(tiers, 0, inv.totalTTC)];
  const ref = kind === 'purchase' && inv.externalRef ? `${inv.number} (${inv.externalRef})` : inv.number;
  const sale: Posting = {
    label: `${KIND_LABEL[kind]} ${ref} — ${inv.customerName}`,
    journal: kind === 'purchase' ? 'AC' : 'VT', amount: inv.totalTTC, lines,
  };
  const payLines: JournalLine[] | undefined = inv.mode === 'cash' && treasuryCode && kind !== 'credit_note'
    ? kind === 'purchase'
      ? [line(tiers, inv.totalTTC, 0), line(treasuryCode, 0, inv.totalTTC)]
      : [line(treasuryCode, inv.totalTTC, 0), line(tiers, 0, inv.totalTTC)]
    : undefined;
  const payment = payLines
    ? { label: `Règlement comptant ${KIND_LABEL[kind].toLowerCase()} ${ref}`, journal: defaultJournal(payLines), amount: inv.totalTTC, lines: payLines }
    : undefined;
  return { sale, payment };
}

/** Montant d'une écriture utilisable comme règlement : crédit du 411 (client) ou débit du 401 (fournisseur). */
export function settlementAmount(e: { lines: JournalLine[] }, kind: InvoiceKind): number {
  return isSupplierSide(kind)
    ? e.lines.filter(l => l.accountCode.startsWith('40')).reduce((s, l) => s + l.debit, 0)
    : e.lines.filter(l => l.accountCode.startsWith('411')).reduce((s, l) => s + l.credit, 0);
}

export function paidAmount(inv: Pick<Invoice, 'payments'>): number {
  return inv.payments.reduce((s, p) => s + p.amount, 0);
}

export function remainingAmount(inv: Pick<Invoice, 'payments' | 'totalTTC'>): number {
  return Math.max(0, inv.totalTTC - paidAmount(inv));
}

export type SettlementState = 'unpaid' | 'partial' | 'paid';
export function settlementState(inv: Pick<Invoice, 'payments' | 'totalTTC'>): SettlementState {
  const paid = paidAmount(inv);
  if (paid <= 0) return 'unpaid';
  return paid >= inv.totalTTC ? 'paid' : 'partial';
}

export const AGING_BUCKETS = [
  { key: 'notDue', label: 'Non échu' },
  { key: 'd0_30', label: 'Retard < 30 j' },
  { key: 'd30_60', label: '30 - 60 j' },
  { key: 'd60_90', label: '60 - 90 j' },
  { key: 'd90plus', label: '> 90 j' },
] as const;
export type AgingKey = typeof AGING_BUCKETS[number]['key'];

const DAY = 86_400_000;
export function agingBucket(dueDate: string, today: string): AgingKey {
  const late = Math.floor((Date.parse(today) - Date.parse(dueDate)) / DAY);
  if (late <= 0) return 'notDue';
  if (late < 30) return 'd0_30';
  if (late < 60) return 'd30_60';
  if (late < 90) return 'd60_90';
  return 'd90plus';
}

export interface AgedRow { customer: string; total: number; buckets: Record<AgingKey, number>; invoices: number }

/** Balance âgée : créances restant dues sur les factures validées, par client et par ancienneté. */
export function computeAgedBalance(invoices: Invoice[], today: string): { rows: AgedRow[]; totals: AgedRow } {
  const empty = (customer: string): AgedRow => ({
    customer, total: 0, invoices: 0, buckets: { notDue: 0, d0_30: 0, d30_60: 0, d60_90: 0, d90plus: 0 },
  });
  const byCustomer = new Map<string, AgedRow>();
  const totals = empty('Total');
  for (const inv of invoices) {
    if (inv.status !== 'validated' || inv.kind === 'credit_note') continue;
    const due = remainingAmount(inv);
    if (due <= 0) continue;
    // ponytail: regroupement par nom de client ; passer par une table Clients si les homonymes posent problème.
    const key = inv.customerName.trim();
    const row = byCustomer.get(key) ?? empty(key);
    const bucket = agingBucket(inv.dueDate, today);
    for (const r of [row, totals]) {
      r.buckets[bucket] += due;
      r.total += due;
      r.invoices += 1;
    }
    byCustomer.set(key, row);
  }
  return { rows: [...byCustomer.values()].sort((a, b) => b.total - a.total), totals };
}

import type { Invoice } from '../types';

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

export interface Posting { debit: string; credit: string; amount: number; label: string }

/**
 * Écritures générées à la validation d'une facture (une écriture = une ligne débit / crédit) :
 *   411x / 70x   montant HT
 *   411x / 4431  TVA collectée
 *   + au comptant : trésorerie / 411x  montant TTC (règlement immédiat, lettré automatiquement)
 */
export function invoicePostings(
  inv: Pick<Invoice, 'number' | 'customerName' | 'customerAccountCode' | 'salesAccountCode' | 'totalHT' | 'totalTVA' | 'totalTTC' | 'mode'>,
  treasuryCode?: string,
): { sale: Posting[]; payment?: Posting } {
  const sale: Posting[] = [
    { debit: inv.customerAccountCode, credit: inv.salesAccountCode, amount: inv.totalHT, label: `Facture ${inv.number} — ${inv.customerName} (HT)` },
  ];
  if (inv.totalTVA > 0) {
    sale.push({ debit: inv.customerAccountCode, credit: '4431', amount: inv.totalTVA, label: `Facture ${inv.number} — TVA collectée` });
  }
  const payment = inv.mode === 'cash' && treasuryCode
    ? { debit: treasuryCode, credit: inv.customerAccountCode, amount: inv.totalTTC, label: `Règlement comptant facture ${inv.number}` }
    : undefined;
  return { sale, payment };
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
    if (inv.status !== 'validated') continue;
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

// Vérification rapide : npx tsx src/utils/invoices.check.ts
import assert from 'node:assert/strict';
import { computeInvoiceTotals, invoicePostings, agingBucket, computeAgedBalance, settlementState } from './invoices';
import type { Invoice } from '../types';

const t = computeInvoiceTotals([{ quantity: 3, unitPrice: 10000 }, { quantity: 1, unitPrice: 5001 }], 18);
assert.deepEqual(t, { amounts: [30000, 5001], totalHT: 35001, totalTVA: 6300, totalTTC: 41301 });

const inv = { number: 'FAC-1', customerName: 'Awa', customerAccountCode: '4111', salesAccountCode: '7011', totalHT: 100, totalTVA: 18, totalTTC: 118, mode: 'cash' as const };
const p = invoicePostings(inv, '5711');
assert.equal(p.sale.reduce((s, x) => s + x.amount, 0), 118); // le 411 est débité du TTC
assert.deepEqual(p.sale.map(x => x.credit), ['7011', '4431']);
assert.deepEqual([p.payment?.debit, p.payment?.credit, p.payment?.amount], ['5711', '4111', 118]);
assert.equal(invoicePostings({ ...inv, totalTVA: 0, mode: 'credit' }).sale.length, 1);
assert.equal(invoicePostings({ ...inv, mode: 'credit' }, '5711').payment, undefined);

assert.equal(agingBucket('2026-10-17', '2026-10-17'), 'notDue');
assert.equal(agingBucket('2026-10-16', '2026-10-17'), 'd0_30');
assert.equal(agingBucket('2026-09-17', '2026-10-17'), 'd30_60');
assert.equal(agingBucket('2026-08-18', '2026-10-17'), 'd60_90');
assert.equal(agingBucket('2026-07-01', '2026-10-17'), 'd90plus');

const base = { status: 'validated', customerName: 'Awa', totalTTC: 1000, payments: [] } as unknown as Invoice;
const aged = computeAgedBalance([
  { ...base, dueDate: '2026-10-30' },
  { ...base, dueDate: '2026-07-01', payments: [{ id: 'p', entryId: 'e', amount: 400, createdAt: '' }] },
  { ...base, dueDate: '2026-07-01', payments: [{ id: 'p', entryId: 'e', amount: 1000, createdAt: '' }] }, // soldée
  { ...base, status: 'draft', dueDate: '2026-07-01' }, // non validée : ignorée
], '2026-10-17');
assert.equal(aged.rows.length, 1);
assert.equal(aged.totals.total, 1600);
assert.equal(aged.totals.buckets.notDue, 1000);
assert.equal(aged.totals.buckets.d90plus, 600);
assert.equal(settlementState({ totalTTC: 1000, payments: [{ id: '', entryId: '', amount: 400, createdAt: '' }] }), 'partial');

console.log('invoices.check: OK');

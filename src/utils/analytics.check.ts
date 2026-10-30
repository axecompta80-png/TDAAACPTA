// Vérification rapide : npx tsx src/utils/analytics.check.ts
import assert from 'node:assert/strict';
import { computeFinancialReport, computeTva, computeFlows } from './analytics';
import { simpleLines } from './entryLines';
import type { JournalEntry, JournalLine } from '../types';

const e = (date: string, lines: JournalLine[]): JournalEntry => ({
  id: date + Math.random(), date, label: '', pieceRef: '', journal: 'OD', lines, amount: 0, clientDossierId: 'd',
  status: 'validated', rawInput: '', inputType: 'manual', explanationSimplified: '', paymentMethod: 'cash', auditTrail: [],
});

const entries = [
  e('2025-01-01', simpleLines('5211', '101', 1_000_000)),          // apport en capital
  e('2025-03-01', simpleLines('5711', '7011', 118_000, 18_000)),    // vente 2025 avec TVA
  e('2025-04-01', simpleLines('6011', '401', 59_000, 9_000)),       // achat 2025 avec TVA
  e('2026-02-01', simpleLines('5211', '162', 500_000)),            // emprunt
  e('2026-02-10', simpleLines('5711', '7011', 236_000, 36_000)),    // vente 2026
  e('2026-02-11', simpleLines('6221', '5211', 1_700_000)),          // loyer : découvert bancaire
];

const r25 = computeFinancialReport(entries, '2025');
assert.equal(r25.revenue, 100_000);
assert.equal(r25.purchases, 50_000);
assert.equal(r25.reportANouveau, 0);
assert.equal(r25.imbalance, 0);

const r26 = computeFinancialReport(entries, '2026');
assert.equal(r26.revenue, 200_000);                // 2025 hors compte de résultat 2026
assert.equal(r26.reportANouveau, 50_000);          // résultat 2025 reporté
assert.equal(r26.dettes >= 500_000 && r26.overdrafts > 0, true); // emprunt et découvert au passif
assert.equal(r26.imbalance, 0);
assert.equal(computeFinancialReport(entries).imbalance, 0);

const tva = computeTva(entries, '2025-03');
assert.deepEqual([tva.totalSalesHT, tva.tvaCollectee, tva.tvaDeductible], [100_000, 18_000, 0]);
assert.equal(computeTva(entries, '2025').tvaDeductible, 9_000);

const f = computeFlows(entries, '2026-01-01', '2026-12-31');
assert.deepEqual([f.cashIn, f.cashOut, f.revenue, f.expenses], [736_000, 1_700_000, 200_000, 1_700_000]);

console.log('analytics.check: OK');

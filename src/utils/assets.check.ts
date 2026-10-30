// npx tsx src/utils/assets.check.ts
import assert from 'node:assert/strict';
import { depreciationSchedule, amortizationAccountFor } from './assets';

// Acquis le 1er janvier : 3 annuités pleines, le cumul tombe juste malgré les arrondis.
const a = depreciationSchedule({ acquisitionDate: '2026-01-01', cost: 100, durationYears: 3 });
assert.deepEqual(a.map(r => r.amount), [33, 34, 33]);
assert.equal(a.at(-1)!.net, 0);

// Acquis le 1er juillet : demi-annuité la 1re année, solde la dernière.
const b = depreciationSchedule({ acquisitionDate: '2026-07-01', cost: 1_200_000, durationYears: 4 });
assert.deepEqual(b.map(r => [r.year, r.amount]), [[2026, 150000], [2027, 300000], [2028, 300000], [2029, 300000], [2030, 150000]]);
assert.equal(b.reduce((s, r) => s + r.amount, 0), 1_200_000);

assert.deepEqual(depreciationSchedule({ acquisitionDate: '2026-01-01', cost: 0, durationYears: 3 }), []);

const known = new Set(['2844', '2815', '28']);
assert.equal(amortizationAccountFor('2441', c => known.has(c)), '2844');
assert.equal(amortizationAccountFor('215', c => known.has(c)), '2815');
assert.equal(amortizationAccountFor('231', c => c === 'nope'), undefined);
console.log('assets OK');

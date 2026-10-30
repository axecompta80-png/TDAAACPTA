// Vérification rapide : npx tsx server/routes/recurring.check.ts
import assert from 'node:assert/strict';
import { nextMonthly } from '../../src/utils/entryLines';

assert.equal(nextMonthly('2026-01-31', 31), '2026-02-28');
assert.equal(nextMonthly('2026-02-28', 31), '2026-03-31');
assert.equal(nextMonthly('2026-12-05', 5), '2027-01-05');
assert.equal(nextMonthly('2028-01-30', 30), '2028-02-29');
console.log('recurring.check : OK');

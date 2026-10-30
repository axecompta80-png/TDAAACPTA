// npx tsx src/utils/fiscalCalendar.check.ts
import assert from 'node:assert/strict';
import { fiscalDeadlines, deadlinesToRemind } from './fiscalCalendar';

const d = fiscalDeadlines([2026], '2026-09-30');
assert.equal(d.length, 13);
const dec = d.find(x => x.key === 'tva-2026-12')!;
assert.equal(dec.due, '2027-01-15');
assert.equal(d.find(x => x.key === 'tva-2026-09')!.done, true);
assert.equal(d.find(x => x.key === 'tva-2026-10')!.done, false);
assert.equal(d.find(x => x.key === 'dsf-2026')!.due, '2027-04-30');

// Le 10 novembre : TVA d'octobre (due le 15/11) à rappeler ; septembre déclaré ; rien de vieux.
assert.deepEqual(deadlinesToRemind('2026-11-10', '2026-09-30').map(x => x.key), ['tva-2026-10']);
// Septembre non déclaré, en retard de 26 jours : rappelé aussi.
assert.deepEqual(deadlinesToRemind('2026-11-10', '2026-08-31').map(x => x.key), ['tva-2026-09', 'tva-2026-10']);
console.log('fiscalCalendar OK');

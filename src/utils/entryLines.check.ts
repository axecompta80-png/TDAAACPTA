// Vérification rapide : npx tsx src/utils/entryLines.check.ts
import assert from 'node:assert/strict';
import { simpleLines, linesError, defaultJournal, accountsSummary, prefixBalance, entryTva, reversedLines, isLocked } from './entryLines';

// Vente avec TVA : la TVA va au 4431, le 7x reçoit le HT.
const sale = simpleLines('5711', '7011', 118000, 18000);
assert.deepEqual(sale.map(l => [l.accountCode, l.debit, l.credit]), [['5711', 118000, 0], ['7011', 0, 100000], ['4431', 0, 18000]]);
assert.equal(linesError(sale), null);
assert.equal(defaultJournal(sale), 'CA');
assert.equal(entryTva({ lines: sale }), 18000);

// Achat avec TVA : la TVA va au 4452.
const buy = simpleLines('6011', '401', 11800, 1800);
assert.deepEqual(buy.map(l => [l.accountCode, l.debit, l.credit]), [['6011', 10000, 0], ['4452', 1800, 0], ['401', 0, 11800]]);
assert.equal(defaultJournal(buy), 'AC');
assert.equal(accountsSummary({ lines: buy }), '6011, 4452 / 401');

// TVA sans objet (virement interne) : ignorée.
assert.equal(simpleLines('5211', '5711', 1000, 180).length, 2);
assert.equal(defaultJournal(simpleLines('4111', '7011', 10)), 'VT');
assert.equal(defaultJournal(simpleLines('4711', '162', 10)), 'OD');

// Contrôles
assert.match(linesError([{ accountCode: '601', debit: 10, credit: 0 }])!, /deux lignes/);
assert.match(linesError([{ accountCode: '601', debit: 10, credit: 0 }, { accountCode: '401', debit: 0, credit: 9 }])!, /déséquilibrée/);
assert.match(linesError([{ accountCode: '601', debit: 10, credit: 10 }, { accountCode: '401', debit: 0, credit: 0 }])!, /OU/);
assert.equal(prefixBalance({ lines: sale }, '57'), 118000);

const rev = reversedLines(sale);
assert.equal(prefixBalance({ lines: [...sale, ...rev] }, ''), 0);
assert.equal(rev[0].credit, 118000);

assert.equal(isLocked('2026-03-31', '2026-03-31'), true);
assert.equal(isLocked('2026-04-01', '2026-03-31'), false);
assert.equal(isLocked('2026-04-01', undefined), false);

console.log('entryLines.check: OK');

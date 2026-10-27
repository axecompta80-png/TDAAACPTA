// Vérification de la lecture des cellules d'import : npx tsx src/utils/excelParser.check.ts
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseCellAmount, parseCellDate, parseExcelBuffer, detectColumns, generateSampleExcelTemplate } from './excelParser';

const amounts: [unknown, number | null][] = [
  [185000, 185000], ['185,000', 185000], ['1 234 567', 1234567], ['1 234 567', 1234567],
  ['1.234.567', 1234567], ['1 234,50', 1234.5], ['1,234.50', 1234.5], ['25 000 FCFA', 25000],
  ['-25 000', -25000], ['(25 000)', -25000], ['12,5', 12.5], ['', null], ['FCFA', null],
];
for (const [input, expected] of amounts) assert.equal(parseCellAmount(input), expected, `montant ${JSON.stringify(input)}`);

const dates: [unknown, string | null][] = [
  ['05/09/2026', '2026-09-05'], ['5/9/26', '2026-09-05'], ['05-09-2026', '2026-09-05'], ['05.09.2026', '2026-09-05'],
  ['2026-09-05', '2026-09-05'], ['2026/09/05', '2026-09-05'], [new Date(2026, 8, 5), '2026-09-05'],
  [new Date(2026, 8, 4, 23, 59, 17), '2026-09-05'], [46270, '2026-09-05'], ['31/02/2026', null], ['demain', null], ['', null],
];
for (const [input, expected] of dates) assert.equal(parseCellDate(input), expected, `date ${String(input)}`);

// Classeur réel : ligne de titre, montant au format anglais, date Excel, CSV français en Windows-1252.
const ws = XLSX.utils.aoa_to_sheet([
  ['Relevé de compte – Septembre'],
  [],
  ['Date', 'Libellé', 'Montant TTC', 'TVA'],
  [new Date(2026, 8, 5), 'Vente riz', 185000, 33300],
]);
ws['C4'].z = '#,##0';
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'S');
const xlsx = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
const [row] = parseExcelBuffer(xlsx, 'releve.xlsx').rowsBySheet.S;
assert.equal(row['Montant TTC'], 185000);
assert.equal(parseCellDate(row.Date), '2026-09-05');
const map = detectColumns(Object.keys(row));
assert.equal(map.amountCol, 'Montant TTC');
assert.equal(map.tvaCol, 'TVA');

const csv = 'Date;Libellé;Montant\n05/09/2026;Achat ciment;1 234 567,50\n';
const bytes = Uint8Array.from([...csv].map(c => (c === 'é' ? 0xe9 : c.charCodeAt(0))));
const [c] = parseExcelBuffer(bytes.buffer, 'export.csv').rowsBySheet.Sheet1;
assert.equal(c['Libellé'], 'Achat ciment');
assert.equal(parseCellDate(c.Date), '2026-09-05');
assert.equal(parseCellAmount(c.Montant), 1234567.5);

// Les deux modèles proposés au téléchargement sont reconnus.
const journal = parseExcelBuffer(generateSampleExcelTemplate('journal_syscohada').buffer, 'm.xlsx').rowsBySheet.Journal_SYSCOHADA;
assert.deepEqual(detectColumns(Object.keys(journal[0])), {
  dateCol: 'Date', labelCol: "Libellé de l'opération", amountCol: 'Montant TTC', debitCol: undefined, creditCol: undefined,
  pieceRefCol: 'N° Pièce', debitAccountCol: 'Compte Débit', creditAccountCol: 'Compte Crédit', paymentMethodCol: 'Moyen de Paiement', tvaCol: 'TVA (18%)',
});
const releve = parseExcelBuffer(generateSampleExcelTemplate('releve_bancaire_mobile').buffer, 'm.xlsx').rowsBySheet.Releve_Transactions;
const rm = detectColumns(Object.keys(releve[0]));
assert.equal(rm.debitCol, 'Débit (Dépenses)');
assert.equal(rm.creditCol, 'Crédit (Recettes)');
assert.equal(rm.labelCol, 'Libellé de la Transaction');
assert.equal(rm.pieceRefCol, 'Référence');

assert.equal(detectColumns(['Date', 'Libellé', 'Débit (Dépenses)', 'Crédit (Recettes)']).debitCol, 'Débit (Dépenses)');
assert.equal(detectColumns(['Date', 'Libellé', 'Débit', 'Crédit']).creditCol, 'Crédit');

console.log('excelParser : OK');

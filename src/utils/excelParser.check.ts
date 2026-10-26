// Vérification rapide : npx tsx src/utils/excelParser.check.ts
// Les deux modèles Excel proposés au téléchargement doivent se réimporter avec des montants.
import assert from 'node:assert/strict';
import { generateSampleExcelTemplate, parseExcelBuffer, detectColumns } from './excelParser';

for (const type of ['journal_syscohada', 'releve_bancaire_mobile'] as const) {
  const { sheetNames, rowsBySheet } = parseExcelBuffer(generateSampleExcelTemplate(type).buffer as ArrayBuffer);
  const m = detectColumns(Object.keys(rowsBySheet[sheetNames[0]][0]));
  assert.ok(m.amountCol || (m.debitCol && m.creditCol), `${type} : aucune colonne de montant`);
  assert.notEqual(m.amountCol, m.pieceRefCol, `${type} : la référence est prise pour le montant`);
}
assert.equal(detectColumns(['Date', 'Libellé', 'Débit (Dépenses)', 'Crédit (Recettes)']).debitCol, 'Débit (Dépenses)');
assert.equal(detectColumns(['Date', 'Libellé', 'Débit', 'Crédit']).creditCol, 'Crédit');

console.log('excelParser.check : OK');

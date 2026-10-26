// Vérification rapide : npx tsx server/routes/entries.check.ts
import assert from 'node:assert/strict';
import { autoValidates } from './entries';

const sure = { status: 'pending_review', detectedAnomaly: undefined };

assert.equal(autoValidates(sure), true); // sans anomalie : validée d'office
assert.equal(autoValidates({ ...sure, detectedAnomaly: 'Doublon ?' }), false); // anomalie : à vérifier
assert.equal(autoValidates({ ...sure, status: 'draft' }), false); // brouillon volontaire
assert.equal(autoValidates({ ...sure, status: 'anomaly' }), false);

console.log('entries.check : OK');

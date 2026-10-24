// Vérification rapide : npx tsx server/routes/entries.check.ts
import assert from 'node:assert/strict';
import { autoValidates } from './entries';

const dossier = { id: 'd', confidenceThreshold: 85 };
const sure = { status: 'pending_review', detectedAnomaly: undefined, confidenceScore: 90 };

assert.equal(autoValidates(sure, dossier), true); // sûre et sans anomalie : validée d'office
assert.equal(autoValidates({ ...sure, confidenceScore: 84 }, dossier), false); // sous le seuil : à vérifier
assert.equal(autoValidates({ ...sure, detectedAnomaly: 'Doublon ?' }, dossier), false); // anomalie : à vérifier
assert.equal(autoValidates({ ...sure, status: 'draft' }, dossier), false); // brouillon volontaire
assert.equal(autoValidates({ ...sure, status: 'anomaly' }, dossier), false);

console.log('entries.check : OK');

// Vérification rapide : npx tsx server/routes/entries.check.ts
import assert from 'node:assert/strict';
import { autoValidates } from './entries';

const dossier = { id: 'd', ownerId: 'moi', confidenceThreshold: 85 };
const sure = { status: 'pending_review', detectedAnomaly: undefined, confidenceScore: 90 };

assert.equal(autoValidates(sure, dossier, 'moi'), true); // entrepreneur seul : validée d'office
assert.equal(autoValidates(sure, dossier, 'autre'), false); // un autre intervenant : circuit de validation
assert.equal(autoValidates({ ...sure, confidenceScore: 84 }, dossier, 'moi'), false); // sous le seuil : à vérifier
assert.equal(autoValidates({ ...sure, detectedAnomaly: 'Doublon ?' }, dossier, 'moi'), false); // anomalie : à vérifier
assert.equal(autoValidates({ ...sure, status: 'draft' }, dossier, 'moi'), false); // brouillon volontaire
assert.equal(autoValidates({ ...sure, status: 'anomaly' }, dossier, 'moi'), false);

console.log('entries.check : OK');

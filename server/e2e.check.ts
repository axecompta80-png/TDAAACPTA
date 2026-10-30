// Test de bout en bout de l'API, sur un serveur lancé (base de test conseillée) :
//   ADMIN_EMAIL=… ADMIN_PASSWORD=… BASE_URL=http://localhost:3001 npx tsx server/e2e.check.ts
// Crée des comptes jetables (entreprise A avec ses dossiers, entreprise C),
// vérifie le cloisonnement et les droits, puis supprime ce qu'il a créé.
import { deadlinesToRemind } from '../src/utils/fiscalCalendar';
const BASE = (process.env.BASE_URL ?? 'http://localhost:3001') + '/api';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? '', password: process.env.ADMIN_PASSWORD ?? '' };
const NO_ACCESS = "Vous n'avez pas accès à ce dossier.";
const jars: Record<string, string> = {};

async function call(who: string, path: string, body?: unknown) {
  const r = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', cookie: jars[who] ?? '' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const c = r.headers.get('set-cookie');
  if (c) jars[who] = c.split(';')[0];
  let j: any = null;
  try { j = await r.json(); } catch {}
  return { s: r.status, j };
}

let ok = 0, ko = 0;
function t(name: string, cond: unknown, extra: unknown = '') {
  cond ? ok++ : ko++;
  console.log(cond ? '  OK ' : '  KO ', name, cond ? '' : JSON.stringify(extra)?.slice(0, 300));
}

const run = Date.now();
const mail = (n: string) => `e2e-${n}-${run}@test.local`;
const PWD = 'Motdepasse123';
const companyBody = (name: string) => ({
  name, managerName: 'Test', phone: '+221 77', activity: 'Commerce (saisie libre)', city: 'Dakar', country: 'Sénégal',
  rccm: 'SN-1', ifu: 'X1', regimeFiscal: 'Réel Simplifié', currency: 'FCFA',
});
const entryBody = (dossierId: string, pieceRef: string) => ({
  clientDossierId: dossierId, date: '2026-10-24', label: 'Vente comptant', pieceRef, debitAccountCode: '5711', creditAccountCode: '7011',
  amount: 11800, tvaAmount: 1800, status: 'pending_review', inputType: 'manual', paymentMethod: 'cash',
});

console.log('INSCRIPTION ET INFORMATIONS DE L\'ENTREPRISE');
const a = await call('A', '/auth/signup', { email: mail('a'), name: 'Entreprise A', password: PWD });
t("inscription de A (nom de l'entreprise) en compte principal", a.s === 201 && a.j?.role === 'COMPTABLE' && a.j?.name === 'Entreprise A' && a.j?.dossierId === null, a.j);
const c = await call('C', '/auth/signup', { email: mail('c'), name: 'Entreprise C', password: PWD });
t('inscription de C (autre entreprise)', c.s === 201, c.j);
t("A n'a encore aucune comptabilité", (await call('A', '/bootstrap')).j?.dossiers?.length === 0);
const main = await call('A', '/company', companyBody('Entreprise A'));
t("A enregistre les informations de l'entreprise", main.s === 201 && main.j?.isMain === true, main.j);
const M = main.j?.id;
t('une seule fois', (await call('A', '/company', companyBody('Bis'))).s === 409);
const eM = await call('A', '/entries', entryBody(M, 'M1'));
t("A tient sa comptabilité sans créer de dossier", eM.s === 201, eM.j);
await call('C', '/company', companyBody('Entreprise C'));

console.log('AJOUTER UN DOSSIER');
t('nom du dossier obligatoire', (await call('A', '/dossiers', { name: '' })).s === 400);
const d = await call('A', '/dossiers', { name: 'Boutique Plateau', ownerName: 'Propriétaire B' });
t('A crée un dossier avec un propriétaire', d.s === 201 && d.j?.name === 'Boutique Plateau' && d.j?.ownerName === 'Propriétaire B' && !d.j?.isMain, d.j);
const D = d.j?.id;
t("infos fiscales copiées de l'entreprise", d.j?.rccm === 'SN-1' && d.j?.country === 'Sénégal', d.j);
const sansProprio = await call('A', '/dossiers', { name: 'Dépôt Sud' });
t('dossier avec le nom seul', sansProprio.s === 201 && !sansProprio.j?.ownerName, sansProprio.j);

console.log('COMPTE PRINCIPAL');
const bootA = (await call('A', '/bootstrap')).j;
t("A voit l'entreprise et le dossier", bootA?.dossiers?.some((x: any) => x.id === M) && bootA?.dossiers?.some((x: any) => x.id === D), bootA?.dossiers);
t('le propriétaire apparaît dans la liste', bootA?.directory?.some((x: any) => x.id === D && x.ownerName === 'Propriétaire B'), bootA?.directory);
t('A ouvre le dossier', (await call('A', `/dossiers/${D}`)).s === 200);
const eD = await call('A', '/entries', entryBody(D, 'D1'));
t("A saisit dans le dossier : sans anomalie, validée d'office (aucun seuil)", eD.s === 201 && eD.j?.status === 'validated', eD.j);
const eAno = await call('A', '/entries', { ...entryBody(D, 'D2'), detectedAnomaly: 'Doublon possible' });
t('une anomalie reste à vérifier', eAno.s === 201 && eAno.j?.status !== 'validated', eAno.j);

console.log('ÉCRITURES À PLUSIEURS LIGNES, JOURNAUX, PÉRIODES BLOQUÉES');
const codes = (e: any) => e?.lines?.map((l: any) => `${l.accountCode}:${l.debit}/${l.credit}`).join(' ');
t('ancien format converti : TVA sur le 4431, journal caisse', codes(eD.j) === '5711:11800/0 7011:0/10000 4431:0/1800' && eD.j?.journal === 'CA', eD.j);
const achat = await call('A', '/entries', {
  clientDossierId: D, date: '2026-10-24', label: 'Facture fournisseur', pieceRef: '', status: 'pending_review', inputType: 'manual', paymentMethod: 'bank_transfer',
  lines: [{ accountCode: '6011', debit: 10000 }, { accountCode: '4452', debit: 1800 }, { accountCode: '4011', credit: 11800 }],
});
t('écriture à 3 lignes, journal achats, pièce numérotée', achat.s === 201 && achat.j?.journal === 'AC' && achat.j?.pieceRef === 'AC-00001' && achat.j?.amount === 11800, achat.j);
const desequilibre = await call('A', '/entries', { ...entryBody(D, 'X'), lines: [{ accountCode: '6011', debit: 100 }, { accountCode: '4011', credit: 90 }] });
t('écriture déséquilibrée refusée', desequilibre.s === 400 && /déséquilibrée/.test(desequilibre.j?.error), desequilibre.j);
t("C ne bloque pas le dossier de A", (await call('C', `/dossiers/${D}/lock`, { until: '2026-10-31' })).s === 404);
const lockKo = await call('A', `/dossiers/${D}/lock`, { until: '2026-10-31' });
t('blocage refusé tant qu\'une écriture reste à valider', lockKo.s === 409, lockKo.j);
await call('A', `/entries/${eAno.j?.id}/cancel`, {});
const lockOk = await call('A', `/dossiers/${D}/lock`, { until: '2026-10-31' });
t('octobre bloqué', lockOk.s === 200 && lockOk.j?.lockedUntil === '2026-10-31', lockOk.j);
t('saisie refusée dans la période bloquée', (await call('A', '/entries', entryBody(D, 'L1'))).s === 409);
t('dévalidation refusée dans la période bloquée', (await call('A', `/entries/${eD.j?.id}/unvalidate`, {})).s === 409);
t('annulation refusée dans la période bloquée', (await call('A', `/entries/${achat.j?.id}/cancel`, {})).s === 409);
t('contre-passation refusée si datée dans la période', (await call('A', `/entries/${achat.j?.id}/reverse`, { date: '2026-10-31' })).s === 409);
const cp = await call('A', `/entries/${achat.j?.id}/reverse`, { date: '2026-11-02', reason: 'Erreur de fournisseur' });
t('contre-passation : sens inversé, validée, rattachée', cp.s === 201 && codes(cp.j?.reversal) === '6011:0/10000 4452:0/1800 4011:11800/0'
  && cp.j?.reversal?.status === 'validated' && cp.j?.reversal?.reversalOfId === achat.j?.id && cp.j?.reversal?.journal === 'AC' && cp.j?.reversal?.number === 2, cp.j);
t('pas de seconde contre-passation', (await call('A', `/entries/${achat.j?.id}/reverse`, { date: '2026-11-02' })).s === 409);
t('le compte principal débloque', (await call('A', `/dossiers/${D}/lock`, { until: null })).j?.lockedUntil === undefined);
t("A ne supprime pas l'entreprise", (await call('A', `/dossiers/${M}/delete`, {})).s === 400);

console.log('PARAMÈTRES');
const base = bootA.settingsByDossier[M];
const sM = await call('A', '/settings/update', { ...base, dossierId: M, soundVolume: 0.3 });
t("paramètres de l'entreprise recopiés sur les dossiers", sM.j?.propagated === true && (await call('A', `/settings?dossierId=${D}`)).j?.soundVolume === 0.3, sM.j);
const sD = await call('A', '/settings/update', { ...base, dossierId: D, soundVolume: 0.5 });
t('paramètres du dossier : ce dossier seulement', sD.j?.propagated === false && (await call('A', `/settings?dossierId=${M}`)).j?.soundVolume === 0.3, sD.j);

console.log('AUTRE ENTREPRISE');
t("C n'ouvre pas le dossier de A", (await call('C', `/dossiers/${D}`)).s === 404);
t("C ne voit pas A dans sa liste", !(await call('C', '/bootstrap')).j?.directory?.some((x: any) => x.id === M || x.id === D));
t("C ne saisit pas dans le dossier de A", (await call('C', '/entries', entryBody(D, 'C1'))).s === 404);
t("C ne règle pas le dossier de A", (await call('C', '/settings/update', { ...base, dossierId: D })).s === 404);
t("C ne supprime pas le dossier de A", (await call('C', `/dossiers/${D}/delete`, {})).s === 404);
t("C n'utilise pas l'agent sur ce dossier", (await call('C', '/agent/chat', { dossierId: D, message: 'Combien ai-je vendu ?' })).s === 404);
const ag = await call('A', '/agent/chat', { dossierId: D, message: "J'ai payé le salaire de Moussa 150000F par virement" });
t("l'agent comprend une opération (salaire → 6611)", ag.s === 200 && JSON.stringify(ag.j).includes('6611'), ag.j);
t("l'agent répond à une question", (await call('A', '/agent/chat', { dossierId: D, message: 'Combien j\'ai en caisse ?' })).s === 200);

console.log('SAUVEGARDE JSON');
const facture = await call('A', '/invoices', { clientDossierId: D, date: '2026-10-24', mode: 'credit', customerName: 'Client', vatRate: 18, lines: [{ description: 'Article', quantity: 2, unitPrice: 5000 }] });
const emise = await call('A', `/invoices/${facture.j?.id}/validate`, {});
t('facture émise : une écriture VT à 3 lignes', emise.j?.entries?.length === 1 && emise.j.entries[0].journal === 'VT' && codes(emise.j.entries[0]) === '4111:11800/0 7011:0/10000 4431:0/1800', emise.j);
const reglement = await call('A', `/invoices/${facture.j?.id}/payments`, { newPayment: { date: '2026-10-25', amount: 5000, paymentMethod: 'wave' } });
t('facture validée et réglée en partie', reglement.s === 201 && reglement.j?.invoice?.payments?.length === 1, reglement.j);
console.log('AVOIRS, FACTURES FOURNISSEURS, BROUILLONS');
const avoir = await call('A', '/invoices', { clientDossierId: D, kind: 'credit_note', originalInvoiceId: facture.j?.id, date: '2026-10-26', customerName: 'Client', vatRate: 18, lines: [{ description: 'Remise', quantity: 1, unitPrice: 2000 }] });
t('avoir créé (numéro AV-)', avoir.s === 201 && avoir.j?.number?.startsWith('AV-2026-') && avoir.j?.kind === 'credit_note', avoir.j);
const avoirTrop = await call('A', '/invoices', { clientDossierId: D, kind: 'credit_note', originalInvoiceId: facture.j?.id, date: '2026-10-26', customerName: 'Client', vatRate: 18, lines: [{ description: 'Trop', quantity: 1, unitPrice: 9000 }] });
t('avoir supérieur au restant refusé', avoirTrop.s === 400, avoirTrop.j);
const avoirOk = await call('A', `/invoices/${avoir.j?.id}/validate`, {});
t('avoir validé : écriture inverse et imputé sur la facture', codes(avoirOk.j?.entries?.[0]) === '7011:2000/0 4431:360/0 4111:0/2360'
  && avoirOk.j?.related?.[0]?.payments?.some((p: any) => p.amount === 2360), avoirOk.j);
t("facture d'origine non annulable tant que l'avoir existe", (await call('A', `/invoices/${facture.j?.id}/cancel`, {})).s === 409);
const ff = await call('A', '/invoices', { clientDossierId: D, kind: 'purchase', externalRef: 'F-778', date: '2026-10-26', dueDate: '2026-11-26', mode: 'credit', customerName: 'Grossiste', customerAccountCode: '4011', salesAccountCode: '6011', vatRate: 18, lines: [{ description: 'Riz', quantity: 10, unitPrice: 1000 }] });
t('facture fournisseur créée (FF-)', ff.s === 201 && ff.j?.number?.startsWith('FF-2026-') && ff.j?.externalRef === 'F-778', ff.j);
const ffOk = await call('A', `/invoices/${ff.j?.id}/validate`, {});
t('facture fournisseur : journal achats, TVA déductible', ffOk.j?.entries?.[0]?.journal === 'AC' && codes(ffOk.j.entries[0]) === '6011:10000/0 4452:1800/0 4011:0/11800', ffOk.j);
const paie = await call('A', `/invoices/${ff.j?.id}/payments`, { newPayment: { date: '2026-10-27', amount: 11800, paymentMethod: 'bank_transfer' } });
t('paiement fournisseur : débit 401 / crédit banque, soldée', paie.s === 201 && codes(paie.j?.entry) === '4011:11800/0 5211:0/11800' && paie.j?.invoice?.payments?.length === 1, paie.j);
const b1 = await call('A', '/invoices', { clientDossierId: D, date: '2026-10-28', mode: 'credit', customerName: 'X', vatRate: 0, lines: [{ description: 'a', quantity: 1, unitPrice: 1 }] });
const b2 = await call('A', '/invoices', { clientDossierId: D, date: '2026-10-28', mode: 'credit', customerName: 'Y', vatRate: 0, lines: [{ description: 'b', quantity: 1, unitPrice: 1 }] });
t("brouillon qui n'est pas le dernier numéro : suppression refusée", (await call('A', `/invoices/${b1.j?.id}/delete`, {})).s === 409);
t('dernier brouillon supprimé', (await call('A', `/invoices/${b2.j?.id}/delete`, {})).s === 204);
t('facture validée : suppression refusée', (await call('A', `/invoices/${facture.j?.id}/delete`, {})).s === 409);

console.log('ÉCRITURES RÉCURRENTES');
const ago = new Date(); ago.setUTCMonth(ago.getUTCMonth() - 2, 1);
const start = ago.toISOString().slice(0, 10);
const rec = await call('A', '/recurring', { clientDossierId: D, label: 'Loyer boutique', startDate: start, paymentMethod: 'bank_transfer',
  lines: [{ accountCode: '6221', debit: 150000 }, { accountCode: '5211', credit: 150000 }] });
t('écriture récurrente créée', rec.s === 201 && rec.j?.day === 1, rec.j);
const bootRec = (await call('A', '/bootstrap')).j;
const loyers = bootRec.entries.filter((e: any) => e.clientDossierId === D && e.label === 'Loyer boutique');
t('3 mois échus générés (rattrapage), validés, journal banque', loyers.length === 3 && loyers.every((e: any) => e.status === 'validated' && e.journal === 'BQ'), loyers.map((e: any) => e.date));
t('prochaine échéance le mois suivant', bootRec.recurring.find((r: any) => r.id === rec.j?.id)?.nextDate > new Date().toISOString().slice(0, 10), bootRec.recurring);
t('pas de doublon au rechargement', (await call('A', '/bootstrap')).j.entries.filter((e: any) => e.label === 'Loyer boutique').length === 3);
t('arrêt', (await call('A', `/recurring/${rec.j?.id}/stop`, {})).j?.active === false);
t("C n'arrête pas une récurrente de A", (await call('C', `/recurring/${rec.j?.id}/stop`, {})).s === 404);

console.log('PIÈCES JOINTES');
const ecr = eD.j;
const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
const pj = await call('A', `/entries/${ecr?.id}/attachments`, { filename: 'facture.pdf', mimeType: 'application/pdf', data: pdf });
t('pièce jointe ajoutée', pj.s === 201 && pj.j?.size === 13 && pj.j?.filename === 'facture.pdf', pj.j);
t('format non autorisé refusé', (await call('A', `/entries/${ecr?.id}/attachments`, { filename: 'x.html', mimeType: 'text/html', data: pdf })).s === 400);
t('fichier de plus de 3 Mo refusé', (await call('A', `/entries/${ecr?.id}/attachments`, { filename: 'gros.pdf', mimeType: 'application/pdf', data: Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64') })).s === 413);
const dl = await fetch(`${BASE}/attachments/${pj.j?.id}`, { headers: { cookie: jars.A } });
t('téléchargement identique', dl.status === 200 && dl.headers.get('content-type') === 'application/pdf' && (await dl.text()) === '%PDF-1.4 test');
t("C ne télécharge pas la pièce de A", (await fetch(`${BASE}/attachments/${pj.j?.id}`, { headers: { cookie: jars.C } })).status === 404);
t("C ne joint rien à une écriture de A", (await call('C', `/entries/${ecr?.id}/attachments`, { filename: 'a.pdf', mimeType: 'application/pdf', data: pdf })).s === 404);
const pj2 = await call('A', `/entries/${ecr?.id}/attachments`, { filename: 'doublon.png', mimeType: 'image/png', data: pdf });
t("C ne retire pas la pièce de A", (await call('C', `/attachments/${pj2.j?.id}/delete`, {})).s === 404);
t('pièce retirée', (await call('A', `/attachments/${pj2.j?.id}/delete`, {})).s === 204);
t('pièces visibles au chargement', JSON.stringify((await call('A', '/bootstrap')).j.entries.find((e: any) => e.id === ecr?.id)?.attachments) === JSON.stringify([pj.j]));

console.log('RAPPROCHEMENT BANCAIRE');
const bootBq = (await call('A', '/bootstrap')).j;
const linesD = bootBq.entries.filter((e: any) => e.clientDossierId === D && e.status === 'validated').flatMap((e: any) => e.lines);
const bankLine = linesD.find((l: any) => l.accountCode.startsWith('5'));
const notBank = linesD.find((l: any) => !l.accountCode.startsWith('5'));
const pt = await call('A', '/lines/reconcile', { clientDossierId: D, lineIds: [bankLine?.id], date: '2026-10-31' });
t('mouvement de trésorerie pointé', pt.s === 200 && pt.j?.reconciledOn === '2026-10-31', pt.j);
t('pointage visible au chargement', (await call('A', '/bootstrap')).j.entries.flatMap((e: any) => e.lines).find((l: any) => l.id === bankLine?.id)?.reconciledOn === '2026-10-31');
t('ligne hors trésorerie refusée', (await call('A', '/lines/reconcile', { clientDossierId: D, lineIds: [notBank?.id], date: '2026-10-31' })).s === 400);
t("C ne pointe pas chez A", (await call('C', '/lines/reconcile', { clientDossierId: D, lineIds: [bankLine?.id], date: '2026-10-31' })).s === 404);

console.log('IMMOBILISATIONS');
const im = await call('A', '/assets', { clientDossierId: D, label: 'Ordinateur', accountCode: '244', acquisitionDate: '2025-07-01', cost: 1200000, durationYears: 4 });
t('immobilisation ajoutée au registre', im.s === 201 && im.j?.cost === 1200000 && im.j?.depreciatedThrough === undefined, im.j);
t('compte hors immobilisations refusé', (await call('A', '/assets', { clientDossierId: D, label: 'X', accountCode: '6011', acquisitionDate: '2025-07-01', cost: 10, durationYears: 2 })).s === 400);
const dot = await call('A', '/assets/depreciate', { clientDossierId: D, year: 2026 });
t('dotations 2025 (prorata) et 2026 passées : D 6811 / C 2844', dot.s === 201 && dot.j?.entries?.length === 2
  && codes(dot.j.entries[0]) === '6811:150000/0 2844:0/150000' && codes(dot.j.entries[1]) === '6811:300000/0 2844:0/300000'
  && dot.j.entries.every((e: any) => e.journal === 'OD' && e.status === 'validated'), dot.j);
t('relancer ne double pas les dotations', (await call('A', '/assets/depreciate', { clientDossierId: D, year: 2026 })).j?.entries?.length === 0);
t('suppression refusée une fois amortie', (await call('A', `/assets/${im.j?.id}/delete`, {})).s === 409);
t("C n'amortit pas chez A", (await call('C', '/assets/depreciate', { clientDossierId: D, year: 2026 })).s === 404);
const ancien = await call('A', '/assets', { clientDossierId: D, label: 'Camion', accountCode: '215', acquisitionDate: '2024-01-01', cost: 900000, durationYears: 3, depreciatedThrough: 2025 });
t('bien ancien : dotations passées déclarées', ancien.s === 201 && ancien.j?.depreciatedThrough === 2025, ancien.j);
const dot27 = await call('A', '/assets/depreciate', { clientDossierId: D, year: 2027 });
const got27 = dot27.j?.entries?.map((e: any) => `${e.date}:${e.amount}`).sort();
t('seules les dotations manquantes sont passées (camion 2026, ordinateur 2027)', JSON.stringify(got27) === JSON.stringify(['2026-12-31:300000', '2027-12-31:300000']), got27);

console.log('RAPPELS FISCAUX');
const bootF = (await call('A', '/bootstrap')).j;
// Le dossier vient d'être créé : rien avant le mois de sa première écriture.
const firstMonth = bootF.entries.filter((e: any) => e.clientDossierId === D).map((e: any) => e.date).sort()[0].slice(0, 7);
const expected = deadlinesToRemind(new Date().toISOString().slice(0, 10), bootF.dossiers.find((x: any) => x.id === D)?.lockedUntil)
  .filter(d => d.periodEnd.slice(0, 7) >= firstMonth).map(d => `echeance-${D}-${d.key}`).sort();
const reminders = (b: any) => b.notifications.filter((n: any) => n.id.startsWith(`echeance-${D}-`)).map((n: any) => n.id).sort();
t('rappels des échéances proches non déclarées', JSON.stringify(reminders(bootF)) === JSON.stringify(expected), [reminders(bootF), expected]);
t('pas de doublon au rechargement', JSON.stringify(reminders((await call('A', '/bootstrap')).j)) === JSON.stringify(expected));

const snapshot = (boot: any) => JSON.stringify(boot.entries.filter((e: any) => e.clientDossierId === D)
  .map(({ id, date, label, pieceRef, journal, number, lines, amount, status, invoiceId, reversalOfId, validatedAt, auditTrail, attachments }: any) =>
    ({ id, date, label, pieceRef, journal, number, lines: lines.map(({ id: _, ...l }: any) => l), amount, status, invoiceId, reversalOfId, validatedAt, audit: auditTrail.length, attachments }))
  .sort((x: any, y: any) => x.id.localeCompare(y.id)));
const before = (await call('A', '/bootstrap')).j;
const sauvegarde = { dossiers: before.dossiers.filter((x: any) => x.id === D), entries: before.entries };
const restored = await call('A', '/import-backup', sauvegarde);
t('restauration acceptée', restored.s === 200, restored.j);
t('écritures restituées à l\'identique (montants, dates, statuts, liens facture, audit, pointage, pièces jointes)', snapshot(restored.j) === snapshot(before), [snapshot(restored.j).slice(0, 200), snapshot(before).slice(0, 200)]);
const factureApres = restored.j?.invoices?.find((i: any) => i.id === facture.j?.id);
t('règlement et avoir lettrés conservés', factureApres?.payments?.length === 2 && factureApres.payments.some((p: any) => p.amount === 5000), factureApres);
const abimee = { ...sauvegarde, entries: [...sauvegarde.entries, { ...sauvegarde.entries.find((e: any) => e.clientDossierId === D), id: 'casse', lines: [{ accountCode: '6011', debit: 5, credit: 0 }] }] };
const refus = await call('A', '/import-backup', abimee);
t('sauvegarde avec une écriture invalide : refusée avec le motif', refus.s === 400 && /refusée/.test(refus.j?.error), refus.j);
t('… et rien n\'a été modifié', snapshot((await call('A', '/bootstrap')).j) === snapshot(before));
t("C ne restaure pas le dossier de A", (await call('C', '/import-backup', sauvegarde)).s === 400);

console.log('SUPPRESSION D\'UN DOSSIER');
t('A supprime le dossier', (await call('A', `/dossiers/${D}/delete`, {})).s === 204);
t('le dossier a disparu', (await call('A', `/dossiers/${D}`)).s === 404);

console.log('MOT DE PASSE');
t('refusé si mot de passe actuel faux', (await call('C', '/auth/change-password', { currentPassword: 'faux-faux', newPassword: 'Nouveau12345' })).s === 400);
t('refusé si nouveau trop court', (await call('C', '/auth/change-password', { currentPassword: PWD, newPassword: 'court' })).s === 400);
t('accepté sinon', (await call('C', '/auth/change-password', { currentPassword: PWD, newPassword: 'Nouveau12345' })).s === 204);
t('le nouveau mot de passe fonctionne', (await call('C2', '/auth/login', { email: mail('c'), password: 'Nouveau12345' })).s === 200);
t("l'ancien ne fonctionne plus", (await call('C3', '/auth/login', { email: mail('c'), password: PWD })).s === 401);

console.log('ADMIN');
const ad = await call('admin', '/auth/login', ADMIN);
t('connexion admin', ad.s === 200 && ad.j?.role === 'ADMIN', ad.j);
const users = await call('admin', '/admin/users');
t("l'admin voit les utilisateurs de la plateforme", users.j?.some((u: any) => u.id === a.j.id), users.j);
t('un comptable est refusé sur /admin', (await call('A', '/admin/users')).s === 403);
t("espace comptable de l'admin : rien des autres entreprises", !(await call('admin', '/bootstrap')).j?.dossiers?.some((x: any) => x.id === M));
t("l'inscription publique ne crée pas d'admin", a.j?.role !== 'ADMIN' && c.j?.role !== 'ADMIN');

console.log('NETTOYAGE');
for (const u of [a.j, c.j]) await call('admin', `/admin/users/${u.id}/delete`, {});
t('comptes de test supprimés', !(await call('admin', '/admin/users')).j?.some((u: any) => u.email.startsWith(`e2e-`) && u.email.includes(String(run))));
t("l'entreprise est supprimée avec son compte principal", (await call('A', '/bootstrap')).s === 401);

console.log(`\n${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);

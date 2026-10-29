// Test de bout en bout de l'API, sur un serveur lancé (base de test conseillée) :
//   ADMIN_EMAIL=… ADMIN_PASSWORD=… BASE_URL=http://localhost:3001 npx tsx server/e2e.check.ts
// Crée des comptes jetables (entreprise A avec ses dossiers, entreprise C),
// vérifie le cloisonnement et les droits, puis supprime ce qu'il a créé.
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

console.log('SAUVEGARDE JSON');
const facture = await call('A', '/invoices', { clientDossierId: D, date: '2026-10-24', mode: 'credit', customerName: 'Client', vatRate: 18, lines: [{ description: 'Article', quantity: 2, unitPrice: 5000 }] });
await call('A', `/invoices/${facture.j?.id}/validate`, {});
const reglement = await call('A', `/invoices/${facture.j?.id}/payments`, { newPayment: { date: '2026-10-25', amount: 5000, paymentMethod: 'wave' } });
t('facture validée et réglée en partie', reglement.s === 201 && reglement.j?.invoice?.payments?.length === 1, reglement.j);
const snapshot = (boot: any) => JSON.stringify(boot.entries.filter((e: any) => e.clientDossierId === D)
  .map(({ id, date, label, pieceRef, debitAccountCode, creditAccountCode, amount, tvaAmount, status, invoiceId, validatedAt, auditTrail }: any) =>
    ({ id, date, label, pieceRef, debitAccountCode, creditAccountCode, amount, tvaAmount, status, invoiceId, validatedAt, audit: auditTrail.length }))
  .sort((x: any, y: any) => x.id.localeCompare(y.id)));
const before = (await call('A', '/bootstrap')).j;
const sauvegarde = { dossiers: before.dossiers.filter((x: any) => x.id === D), entries: before.entries };
const restored = await call('A', '/import-backup', sauvegarde);
t('restauration acceptée', restored.s === 200, restored.j);
t('écritures restituées à l\'identique (montants, dates, statuts, liens facture, audit)', snapshot(restored.j) === snapshot(before), [snapshot(restored.j).slice(0, 200), snapshot(before).slice(0, 200)]);
const factureApres = restored.j?.invoices?.find((i: any) => i.id === facture.j?.id);
t('paiement de la facture conservé', factureApres?.payments?.length === 1 && factureApres.payments[0].amount === 5000, factureApres);
const abimee = { ...sauvegarde, entries: [...sauvegarde.entries, { ...sauvegarde.entries.find((e: any) => e.clientDossierId === D), id: 'casse', amount: -3 }] };
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

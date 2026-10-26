// Test de bout en bout de l'API, sur un serveur lancé (base de test conseillée) :
//   ADMIN_EMAIL=… ADMIN_PASSWORD=… BASE_URL=http://localhost:3001 npx tsx server/e2e.check.ts
// Crée des comptes jetables (entreprise A, propriétaire B d'un dossier de A, entreprise C),
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
  amount: 11800, tvaAmount: 1800, status: 'pending_review', confidenceScore: 60, inputType: 'manual', paymentMethod: 'cash',
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
t('nom du dossier obligatoire', (await call('A', '/dossiers', { name: '', ownerName: 'B', email: mail('b'), password: PWD })).s === 400);
t('mot de passe trop court refusé', (await call('A', '/dossiers', { name: 'Boutique', ownerName: 'B', email: mail('b'), password: 'court' })).s === 400);
const d = await call('A', '/dossiers', { name: 'Boutique Plateau', ownerName: 'Propriétaire B', email: mail('b'), password: PWD });
t('A crée un dossier confié à B', d.s === 201 && d.j?.name === 'Boutique Plateau' && d.j?.ownerName === 'Propriétaire B' && !d.j?.isMain, d.j);
const D = d.j?.id;
t("infos fiscales copiées de l'entreprise", d.j?.rccm === 'SN-1' && d.j?.country === 'Sénégal', d.j);
t('email déjà utilisé refusé', (await call('A', '/dossiers', { name: 'X', ownerName: 'X', email: mail('b'), password: PWD })).s === 409);

console.log('PROPRIÉTAIRE DU DOSSIER');
const b = await call('B', '/auth/login', { email: mail('b'), password: PWD });
t('B se connecte avec son email', b.s === 200 && b.j?.dossierId === D, b.j);
const bootB = (await call('B', '/bootstrap')).j;
t('B ne charge que son dossier', bootB?.dossiers?.length === 1 && bootB.dossiers[0].id === D, bootB?.dossiers);
t("B voit la liste (entreprise + dossiers) pour le sélecteur", bootB?.directory?.some((x: any) => x.id === M && x.isMain) && bootB?.directory?.some((x: any) => x.id === D), bootB?.directory);
t("aucune donnée de l'entreprise chez B", !bootB?.entries?.some((e: any) => e.clientDossierId === M) && !bootB?.settingsByDossier?.[M]);
const openMain = await call('B', `/dossiers/${M}`);
t('B ouvre l\'entreprise : 403 « pas accès »', openMain.s === 403 && openMain.j?.error === NO_ACCESS, openMain);
t('B ouvre son dossier', (await call('B', `/dossiers/${D}`)).s === 200);
const eB = await call('B', '/entries', entryBody(D, 'B1'));
t("B saisit dans son dossier : sans anomalie, validée d'office (aucun seuil)", eB.s === 201 && eB.j?.status === 'validated', eB.j);
t('B dévalide', (await call('B', `/entries/${eB.j?.id}/unvalidate`, {})).j?.status === 'pending_review');
t('B revalide', (await call('B', '/entries/batch-validate', { ids: [eB.j?.id] })).j?.validated?.length === 1);
const eAno = await call('B', '/entries', { ...entryBody(D, 'B3'), detectedAnomaly: 'Doublon possible' });
t('une anomalie reste à vérifier', eAno.s === 201 && eAno.j?.status !== 'validated', eAno.j);
t("B ne saisit pas dans l'entreprise", (await call('B', '/entries', entryBody(M, 'B2'))).s === 404);
t("B ne valide pas une écriture de l'entreprise", (await call('B', `/entries/${eM.j?.id}/unvalidate`, {})).s === 404);
const inv = await call('B', '/invoices', { clientDossierId: D, date: '2026-10-24', mode: 'credit', customerName: 'Client', vatRate: 18, lines: [{ description: 'Article', quantity: 2, unitPrice: 5000 }] });
t('B crée une facture', inv.s === 201, inv.j);
t('B émet la facture', (await call('B', `/invoices/${inv.j?.id}/validate`, {})).j?.entries?.length >= 2);
t("B n'ajoute pas de dossier", (await call('B', '/dossiers', { name: 'Y', ownerName: 'Y', email: mail('y'), password: PWD })).s === 403);
t('B ne supprime pas son dossier', (await call('B', `/dossiers/${D}/delete`, {})).s === 403);
t("B n'utilise pas l'agent sur l'entreprise", (await call('B', '/agent/chat', { dossierId: M, message: 'Combien ai-je vendu ?' })).s === 404);

console.log('COMPTE PRINCIPAL');
const bootA = (await call('A', '/bootstrap')).j;
t("A voit l'entreprise et le dossier", bootA?.dossiers?.some((x: any) => x.id === M) && bootA?.dossiers?.some((x: any) => x.id === D), bootA?.dossiers);
t('A voit les écritures de B', bootA?.entries?.some((e: any) => e.id === eB.j?.id));
t('A ouvre le dossier', (await call('A', `/dossiers/${D}`)).s === 200);
t("A ne supprime pas l'entreprise", (await call('A', `/dossiers/${M}/delete`, {})).s === 400);

console.log('PARAMÈTRES');
const base = bootA.settingsByDossier[M];
const sM = await call('A', '/settings/update', { ...base, dossierId: M, soundVolume: 0.3 });
t("paramètres de l'entreprise recopiés sur les dossiers", sM.j?.propagated === true && (await call('B', `/settings?dossierId=${D}`)).j?.soundVolume === 0.3, sM.j);
const sD = await call('B', '/settings/update', { ...base, dossierId: D, soundVolume: 0.5 });
t('paramètres du dossier : ce dossier seulement', sD.j?.propagated === false && (await call('A', `/settings?dossierId=${M}`)).j?.soundVolume === 0.3, sD.j);
t("A depuis le dossier : ce dossier seulement", (await call('A', '/settings/update', { ...base, dossierId: D, soundVolume: 0.6 })).j?.propagated === false);
t("B ne règle pas l'entreprise", (await call('B', '/settings/update', { ...base, dossierId: M })).s === 404);

console.log('AUTRE ENTREPRISE');
t("C n'ouvre pas le dossier de A", (await call('C', `/dossiers/${D}`)).s === 404);
t("C ne voit pas A dans sa liste", !(await call('C', '/bootstrap')).j?.directory?.some((x: any) => x.id === M || x.id === D));
t("C n'utilise pas l'agent sur ce dossier", (await call('C', '/agent/chat', { dossierId: D, message: 'Combien ai-je vendu ?' })).s === 404);

console.log('SUPPRESSION D\'UN DOSSIER');
t('A supprime le dossier', (await call('A', `/dossiers/${D}/delete`, {})).s === 204);
t("le compte de B est supprimé avec", (await call('B', '/bootstrap')).s === 401 && (await call('B2', '/auth/login', { email: mail('b'), password: PWD })).s === 401);

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

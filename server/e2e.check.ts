// Test de bout en bout de l'API, sur un serveur lancé (base de test conseillée) :
//   ADMIN_EMAIL=… ADMIN_PASSWORD=… BASE_URL=http://localhost:3001 npx tsx server/e2e.check.ts
// Crée des comptables jetables (A, B créé par A, C d'une autre entreprise), vérifie le
// cloisonnement et les droits, puis supprime ce qu'il a créé.
const BASE = (process.env.BASE_URL ?? 'http://localhost:3001') + '/api';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? '', password: process.env.ADMIN_PASSWORD ?? '' };
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
const dossierBody = (name: string) => ({
  name, managerName: 'Test', phone: '+221 77', activity: 'Commerce (saisie libre)', city: 'Dakar', country: 'Sénégal',
  rccm: 'SN-1', ifu: 'X1', regimeFiscal: 'Réel Simplifié', confidenceThreshold: 85, currency: 'FCFA',
});
const entryBody = (dossierId: string, pieceRef: string) => ({
  clientDossierId: dossierId, date: '2026-10-24', label: 'Vente comptant', pieceRef, debitAccountCode: '5711', creditAccountCode: '7011',
  amount: 11800, tvaAmount: 1800, status: 'pending_review', confidenceScore: 60, inputType: 'manual', paymentMethod: 'cash',
});

console.log('INSCRIPTION');
const a = await call('A', '/auth/signup', { email: mail('a'), name: 'Comptable A', password: PWD });
t('inscription de A en COMPTABLE', a.s === 201 && a.j?.role === 'COMPTABLE', a.j);
const c = await call('C', '/auth/signup', { email: mail('c'), name: 'Comptable C', password: PWD });
t('inscription de C (autre entreprise)', c.s === 201 && c.j?.role === 'COMPTABLE', c.j);

console.log('ÉQUIPE');
const b = await call('A', '/team', { name: 'Comptable B', email: mail('b'), password: PWD });
t('A crée B', b.s === 201 && b.j?.role === 'COMPTABLE' && b.j?.createdById === a.j.id, b.j);
t('B se connecte', (await call('B', '/auth/login', { email: mail('b'), password: PWD })).s === 200);
const teamA = await call('A', '/team');
t("A voit B dans l'équipe", teamA.j?.members?.some((m: any) => m.id === b.j.id), teamA.j);
const teamC = await call('C', '/team');
t("C ne voit pas l'équipe de A", !teamC.j?.members?.some((m: any) => m.id === a.j.id || m.id === b.j.id), teamC.j);

console.log('DOSSIERS ET ATTRIBUTIONS');
const d = await call('A', '/dossiers', dossierBody('Département Ventes'));
t('A crée un dossier', d.s === 201, d.j);
const D = d.j.id;
t('B ne voit pas le dossier non attribué', (await call('B', `/dossiers/${D}`)).s === 404);
t("B ne voit rien dans sa liste", !(await call('B', '/dossiers')).j?.some((x: any) => x.id === D));
t("C ne peut pas attribuer à B le dossier de A", (await call('C', `/dossiers/${D}/assignments`, { userId: b.j.id })).s === 404);
const asg = await call('A', `/dossiers/${D}/assignments`, { userId: b.j.id });
t('A attribue le dossier à B', asg.s === 200 && asg.j?.assignees?.some((x: any) => x.id === b.j.id), asg.j);
t("A ne peut pas attribuer à C (autre entreprise)", (await call('A', `/dossiers/${D}/assignments`, { userId: c.j.id })).s === 404);
t('B voit le dossier attribué', (await call('B', `/dossiers/${D}`)).s === 200);
t('B le voit au démarrage (bootstrap)', (await call('B', '/bootstrap')).j?.dossiers?.some((x: any) => x.id === D));

const eB = await call('B', '/entries', entryBody(D, 'B1'));
t('B saisit dans le dossier attribué', eB.s === 201, eB.j);
const vB = await call('B', '/entries/batch-validate', { ids: [eB.j?.id] });
t('B valide sa propre saisie', vB.j?.validated?.length === 1, vB.j);
t('B dévalide', (await call('B', `/entries/${eB.j?.id}/unvalidate`, {})).j?.status === 'pending_review');
const inv = await call('B', '/invoices', { clientDossierId: D, date: '2026-10-24', mode: 'credit', customerName: 'Client', vatRate: 18, lines: [{ description: 'Article', quantity: 2, unitPrice: 5000 }] });
t('B crée une facture', inv.s === 201, inv.j);
const fv = await call('B', `/invoices/${inv.j?.id}/validate`, {});
t('B émet la facture (écritures générées)', fv.s === 200 && fv.j?.entries?.length >= 2, fv.j);
t('B ne supprime pas le dossier', (await call('B', `/dossiers/${D}/delete`, {})).s === 403);
t('B ne gère pas les attributions', (await call('B', `/dossiers/${D}/assignments/${b.j.id}/delete`, {})).s === 403);

const eA = await call('A', '/entries', entryBody(D, 'A1'));
const vA = await call('A', '/entries/batch-validate', { ids: [eA.j?.id] });
t('A valide sa propre saisie', vA.j?.validated?.length === 1, vA.j);

t('C ne voit pas le dossier de A', (await call('C', `/dossiers/${D}`)).s === 404);
t("C ne voit pas les écritures de A", (await call('C', `/entries/${eA.j?.id}/unvalidate`, {})).s === 404);
t("C n'utilise pas l'agent sur ce dossier", (await call('C', '/agent/chat', { dossierId: D, message: 'Combien ai-je vendu ?' })).s === 404);

const un = await call('A', `/dossiers/${D}/assignments/${b.j.id}/delete`, {});
t("A retire l'attribution", un.s === 200 && !un.j?.assignees?.length, un.j);
t('B ne voit plus le dossier', (await call('B', `/dossiers/${D}`)).s === 404);

console.log('RETRAIT D\'UN COMPTABLE');
const dB = await call('B', '/dossiers', dossierBody('Département Achats'));
t('C ne peut pas retirer B', (await call('C', `/team/${b.j.id}/delete`, {})).s === 404);
t('A retire B', (await call('A', `/team/${b.j.id}/delete`, {})).s === 204);
t('le dossier de B est transféré à A', (await call('A', `/dossiers/${dB.j?.id}`)).s === 200);
t("B n'a plus accès", (await call('B', '/bootstrap')).s === 401);

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
const adminDossiers = (await call('admin', '/bootstrap')).j?.dossiers ?? [];
t("espace comptable de l'admin : rien des autres entreprises", !adminDossiers.some((x: any) => x.id === D || x.id === dB.j?.id), adminDossiers);
const dAdm = await call('admin', '/dossiers', dossierBody('Axe Digital — test'));
t("l'admin crée un dossier dans son espace comptable", dAdm.s === 201, dAdm.j);
t("A ne voit pas le dossier de l'admin", (await call('A', `/dossiers/${dAdm.j?.id}`)).s === 404);
t("l'inscription publique ne crée pas d'admin", a.j?.role !== 'ADMIN' && c.j?.role !== 'ADMIN');

console.log('NETTOYAGE');
await call('admin', `/dossiers/${dAdm.j?.id}/delete`, {});
for (const u of [a.j, c.j]) await call('admin', `/admin/users/${u.id}/delete`, {});
t('comptes de test supprimés', !(await call('admin', '/admin/users')).j?.some((u: any) => u.email.startsWith(`e2e-`) && u.email.includes(String(run))));

console.log(`\n${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);

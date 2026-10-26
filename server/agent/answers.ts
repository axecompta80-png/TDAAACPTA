import { normalizeText } from '../../src/utils/paymentAccounts';
import { formatFcfa } from '../../src/utils/amounts';
import type { AgentContext } from '../../src/utils/analytics';
import type { ClientDossier, PlatformSettings } from '../../src/types';

/**
 * Réponses hors ligne aux questions sur les données du dossier et aux notions SYSCOHADA.
 * Tous les chiffres viennent de l'analyse des écritures réelles : jamais de valeurs par défaut inventées.
 */

const F = (n: number) => `${formatFcfa(n)} FCFA`;

interface KnowledgeItem { re: RegExp; answer: string }

const KNOWLEDGE: KnowledgeItem[] = [
  {
    re: /\btva\b.*(?:c.?est quoi|explique|comment|taux)|(?:c.?est quoi|explique).*\btva\b/,
    answer: "La TVA (taxe sur la valeur ajoutée) est un impôt payé par le client final : vous la collectez sur vos ventes (compte 4431) et vous déduisez celle payée sur vos achats (compte 4452). Chaque mois, vous reversez la différence à l'administration fiscale, avant le 15 du mois suivant. Le taux normal est de 18 % dans la zone UEMOA.",
  },
  {
    re: /amortissement/,
    answer: "L'amortissement répartit le coût d'un équipement (ordinateur, moto, machine…) sur sa durée d'utilisation. Chaque année, vous enregistrez une charge (compte 6811) qui diminue la valeur de l'équipement (comptes 28xx). C'est une charge qui ne sort pas d'argent de votre caisse. Dites-moi par exemple : « amortissement de l'ordinateur 120 000 F ».",
  },
  {
    re: /compte d.?attente|\b4711\b|\b471\b/,
    answer: "Le compte 4711 est un compte d'attente : on y place une opération dont on ne connaît pas encore la nature (retrait sans justificatif, virement inconnu). Il doit être vidé avant la clôture, sinon les états financiers sont faux.",
  },
  {
    re: /\bdsf\b|declaration statistique/,
    answer: "La DSF (Déclaration Statistique et Fiscale) est la déclaration annuelle obligatoire des entreprises en zone OHADA : bilan, compte de résultat, tableaux annexes. Elle est déposée avant le 30 avril (ou 31 mai selon les pays) et sert de base à l'impôt sur les bénéfices.",
  },
  {
    re: /plan comptable|syscohada.*(?:c.?est quoi|explique)|(?:c.?est quoi|explique).*syscohada|\bohada\b.*(?:c.?est quoi|explique)/,
    answer: "Le SYSCOHADA est le référentiel comptable commun aux 17 pays de l'OHADA. Il classe les comptes en 8 classes : 1 ressources durables, 2 immobilisations, 3 stocks, 4 tiers (clients, fournisseurs, État), 5 trésorerie (caisse 5711, banque 5211, Mobile Money 526x), 6 charges, 7 produits, 8 hors activités ordinaires.",
  },
  {
    re: /bilan\b.*(?:c.?est quoi|explique)|(?:c.?est quoi|explique).*\bbilan\b/,
    answer: "Le bilan est la photo de votre entreprise à une date : à gauche ce que vous possédez (actif : équipements, stocks, clients, trésorerie), à droite ce que vous devez et le capital (passif). Il doit toujours être équilibré.",
  },
  {
    re: /compte de resultat|resultat net.*(?:c.?est quoi|explique)|(?:c.?est quoi|explique).*resultat/,
    answer: "Le compte de résultat compare vos produits (ventes, classe 7) à vos charges (achats, loyer, salaires, classe 6) sur une période. La différence est votre bénéfice ou votre perte.",
  },
  {
    re: /provision/,
    answer: "Une provision est une charge que vous constatez à l'avance pour un risque probable (client qui ne paiera peut-être pas, litige). Elle diminue le résultat de l'exercice sans sortie d'argent. À valider avec votre expert-comptable.",
  },
  {
    re: /debit|credit.*(?:c.?est quoi|explique|difference)|partie double/,
    answer: "En partie double, chaque opération touche deux comptes pour le même montant : un débit et un crédit. Exemple : vente de 15 000 F en espèces → débit caisse 5711 (l'argent entre), crédit ventes 7011 (le produit).",
  },
];

const TAX_CALENDAR =
  "Échéances courantes (à confirmer avec votre régime) : TVA mensuelle avant le 15 du mois suivant ; cotisations sociales (CNPS/CNSS) avant le 15 du mois suivant ; acomptes d'impôt sur les bénéfices trimestriels ; DSF annuelle avant le 30 avril. Les délais exacts varient légèrement selon les pays de l'OHADA.";

function methodFocus(n: string): { label: string; value: (c: AgentContext) => number } | undefined {
  if (/orange/.test(n)) return { label: 'Orange Money', value: c => c.treasury.orangeMoney };
  if (/mtn|momo/.test(n)) return { label: 'MTN MoMo', value: c => c.treasury.mtnMomo };
  if (/wave/.test(n)) return { label: 'Wave', value: c => c.treasury.wave };
  if (/moov/.test(n)) return { label: 'Moov Money', value: c => c.treasury.moovMoney };
  if (/banque|bancaire/.test(n)) return { label: 'la banque', value: c => c.treasury.bank };
  if (/caisse|especes|cash|liquide/.test(n)) return { label: 'la caisse', value: c => c.treasury.cash };
  return undefined;
}

export function answerQuestion(question: string, ctx: AgentContext, dossier: ClientDossier, settings: PlatformSettings): string {
  const n = normalizeText(question);
  const t = ctx.treasury;
  const empty = ctx.review.total === 0;

  for (const k of KNOWLEDGE) if (k.re.test(n)) return k.answer;

  if (/echeance|calendrier|declaration|impot|fiscal/.test(n) && !/tva/.test(n)) return TAX_CALENDAR;

  if (empty) {
    return "Je n'ai encore aucune écriture pour ce dossier, donc je ne peux pas chiffrer. Dites-moi par exemple « J'ai vendu 3 sacs de ciment à 5000 F, payé en espèces » et je commencerai votre comptabilité.";
  }

  // Soldes de trésorerie
  if (/solde|tresorerie|disponible|combien.*(?:caisse|banque|orange|mtn|momo|wave|moov|reste|ai-?je en)|argent.*(?:caisse|banque)/.test(n) && !/ventes?|vendu/.test(n)) {
    const mentioned = ['orange', 'mtn|momo', 'wave', 'moov', 'banque|bancaire', 'caisse|especes|cash|liquide'].filter(k => new RegExp(k).test(n)).length;
    const focus = mentioned === 1 ? methodFocus(n) : undefined;
    if (focus) return `Sur ${focus.label}, il y a ${F(focus.value(ctx))} d'après vos écritures.`;
    return `Votre trésorerie totale est de ${F(t.total)} :\n• Caisse (espèces) : ${F(t.cash)}\n• Banque : ${F(t.bank)}\n• Orange Money : ${F(t.orangeMoney)}\n• MTN MoMo : ${F(t.mtnMomo)}\n• Wave : ${F(t.wave)}\n• Moov Money : ${F(t.moovMoney)}${t.total < 0 ? "\n\nAttention : un solde négatif signifie souvent qu'il manque le solde de départ. Dites-moi par exemple « j'avais 200 000 F en caisse au départ »." : ''}`;
  }

  // Clients qui doivent / fournisseurs
  if (/qui me doit|creance|impaye|clients?.*(?:doit|devoir|payer)|argent.*dehors/.test(n)) {
    if (ctx.receivables.total <= 0) return 'Aucun client ne vous doit d’argent d’après vos écritures.';
    return `Vos clients vous doivent ${F(ctx.receivables.total)}. Dernières ventes à crédit :\n${ctx.receivables.open.map(o => `• ${o.date} — ${o.label} : ${F(o.amount)}`).join('\n')}`;
  }
  if (/dette|fournisseurs?.*(?:payer|dois|devoir)|dois-?je payer|a payer|je dois/.test(n)) {
    if (ctx.payables.total <= 0) return 'Vous ne devez rien à vos fournisseurs d’après vos écritures.';
    return `Vous devez ${F(ctx.payables.total)} à vos fournisseurs. Dernières factures à payer :\n${ctx.payables.open.map(o => `• ${o.date} — ${o.label} : ${F(o.amount)}`).join('\n')}`;
  }

  // Prévision & capacité de payer
  if (/prevision|previsionnel|prochains? (?:mois|jours|semaines)|fin du mois|projection|assez d.?argent|puis-?je (?:payer|acheter|me permettre)|cash ?flow|tiendr/.test(n)) {
    const f = ctx.forecast;
    if (f.basedOnEntries === 0) return `Votre trésorerie est de ${F(t.total)}, mais je n'ai pas eu de mouvement sur les 30 derniers jours pour faire une projection fiable.`;
    const trend = f.dailyNet >= 0 ? `Vous gagnez en moyenne ${F(f.dailyNet)} par jour.` : `Vous perdez en moyenne ${F(-f.dailyNet)} par jour${f.runwayDays !== null ? ` : à ce rythme, votre trésorerie tient environ ${f.runwayDays} jours` : ''}.`;
    return `Trésorerie actuelle : ${F(t.total)}. ${trend}\nProjection si le rythme des 30 derniers jours continue : ${F(f.in30)} dans 30 jours, ${F(f.in60)} dans 60 jours, ${F(f.in90)} dans 90 jours.`;
  }

  // TVA
  if (/\btva\b/.test(n)) {
    const v = ctx.tva;
    return `TVA du mois (écritures validées) : ${F(v.tvaCollectee)} collectée, ${F(v.tvaDeductible)} déductible. ${v.credit > 0 ? `Vous avez un crédit de TVA de ${F(v.credit)}.` : `TVA à reverser : ${F(v.netToPay)}, avant le 15 du mois prochain.`} Seules les écritures validées comptent : il reste ${ctx.review.pending + ctx.review.anomalies} écriture(s) à valider.`;
  }

  // Crédit bancaire
  if (/credit|pret|emprunt|financement|bancable|score|solvab/.test(n)) {
    const c = ctx.credit;
    if (!c.sufficientData) return `Il me faut plus d'historique pour évaluer votre dossier (au moins une dizaine d'écritures). ${c.recommendations[0]}`;
    return `Score de solvabilité : ${c.score}/100 (${c.mention}). CA mensuel moyen ${F(c.avgMonthlyRevenue)}, flux net ${F(c.avgMonthlyNetFlow)}/mois, ${c.traceabilityRate}% de ventes tracées hors espèces. Capacité de remboursement estimée : ${F(c.maxMonthlyRepayment)}/mois (33 % du flux net), soit un financement d'environ ${F(c.suggested12MonthCredit)} sur 12 mois.\nÀ améliorer : ${c.recommendations[0]}`;
  }

  // Bénéfice / marge
  if (/benefice|marge|resultat|rentab|gagn/.test(n)) {
    const m = ctx.month;
    return `Sur ${m.label} : chiffre d'affaires ${F(m.revenue)}, charges ${F(m.expenses)}, soit un résultat de ${F(m.result)}${m.revenue > 0 ? ` (marge ${Math.round((m.result / m.revenue) * 100)} %)` : ''}.`;
  }

  // Ventes / dépenses par période
  const periodKey = /aujourd|ce jour/.test(n) ? 'today' : /semaine|7 jours/.test(n) ? 'week' : /annee|an\b|annuel/.test(n) ? 'year' : 'month';
  const flows = periodKey === 'today' ? ctx.today : periodKey === 'week' ? ctx.week : periodKey === 'year' ? ctx.year : ctx.month;
  const periodLabel = { today: "aujourd'hui", week: 'les 7 derniers jours', month: ctx.month.label, year: "cette année" }[periodKey];

  if (/depense|charges?|achats?|coute|sorti|plus grosses?/.test(n)) {
    const top = flows.topExpenses.map(e => `• ${e.label} : ${F(e.amount)}`).join('\n');
    return `Dépenses sur ${periodLabel} : ${F(flows.expenses)} (hors TVA).${top ? `\nPrincipaux postes :\n${top}` : ''}`;
  }
  if (/vendu|ventes?|chiffre d.?affaires|\bca\b|recettes?|encaiss/.test(n)) {
    return `Sur ${periodLabel} : chiffre d'affaires ${F(flows.revenue)} (hors TVA), dont ${F(flows.cashIn)} effectivement encaissés. Charges : ${F(flows.expenses)}.`;
  }

  // À valider / anomalies
  if (/anomalie|verifier|attente|valider|revue|probleme/.test(n)) {
    const r = ctx.review;
    return `Il y a ${r.pending} écriture(s) en attente de validation et ${r.anomalies} anomalie(s) à examiner, sur ${r.total} écritures. Vous les trouvez dans l'onglet « Journal & Validation » du Mode Comptable.`;
  }

  // Vue d'ensemble
  return `Voici la situation de ${dossier.name} : trésorerie ${F(t.total)}, chiffre d'affaires du mois ${F(ctx.month.revenue)}, charges ${F(ctx.month.expenses)}, résultat ${F(ctx.month.result)}. Les clients vous doivent ${F(ctx.receivables.total)} et vous devez ${F(ctx.payables.total)} à vos fournisseurs. ${ctx.review.pending + ctx.review.anomalies > 0 ? `${ctx.review.pending + ctx.review.anomalies} écriture(s) attendent une vérification.` : 'Toutes vos écritures sont validées.'}\nVous pouvez me demander : « combien j'ai en caisse ? », « qui me doit de l'argent ? », « puis-je payer mon loyer ? », « quel est mon score de crédit ? ».`;
}

export function greetingReply(dossier: ClientDossier, text: string, userName?: string): string {
  const n = normalizeText(text);
  const who = (userName && userName.trim()) || dossier.managerName;
  if (/^merci/.test(n)) return 'Avec plaisir ! Dites-moi dès que vous avez une nouvelle vente, un achat ou un reçu.';
  return `Bonjour ${who} ! Dites-moi ce que vous avez vendu ou acheté aujourd'hui pour ${dossier.name}, ou posez-moi une question sur votre trésorerie.`;
}

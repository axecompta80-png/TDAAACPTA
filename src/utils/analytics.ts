import type { JournalEntry } from '../types';
import { getAccountByCode } from '../data/syscohadaPlan';
import { prefixBalance, debitCodes, creditCodes } from './entryLines';

/**
 * Indicateurs calculés uniquement à partir des écritures réelles d'un dossier.
 * Partagé entre l'agent IA (serveur) et les écrans (trésorerie, TVA, dossier Crédit-Ready).
 */

export type Period = 'today' | 'week' | 'month' | 'year' | 'all';

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function periodBounds(period: Period, now = new Date()): { from: string; to: string; label: string } {
  const to = isoDate(now);
  if (period === 'today') return { from: to, to, label: "aujourd'hui" };
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: isoDate(d), to, label: 'les 7 derniers jours' };
  }
  if (period === 'month') {
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to,
      label: now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  }
  if (period === 'year') return { from: `${now.getFullYear()}-01-01`, to, label: `l'année ${now.getFullYear()}` };
  return { from: '0000-01-01', to: '9999-12-31', label: 'depuis le début' };
}

const inRange = (e: JournalEntry, from: string, to: string) => e.date >= from && e.date <= to;
/** Produits nets (crédit - débit) et charges nettes (débit - crédit) d'une écriture sur des préfixes. */
const income = (e: JournalEntry, ...p: string[]) => -prefixBalance(e, ...p);
const charge = (e: JournalEntry, ...p: string[]) => prefixBalance(e, ...p);
const INCOME = ['7', '82', '84', '86', '88'];
const CHARGE = ['6', '81', '83', '85', '87'];

// ---------- Soldes & trésorerie ----------

/** Solde (débit - crédit) de chaque compte à partir des écritures. */
export function computeBalances(entries: JournalEntry[]): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const e of entries) {
    for (const l of e.lines) balances[l.accountCode] = (balances[l.accountCode] ?? 0) + l.debit - l.credit;
  }
  return balances;
}

export interface TreasurySnapshot {
  cash: number;
  orangeMoney: number;
  mtnMomo: number;
  wave: number;
  moovMoney: number;
  bank: number;
  mobileMoney: number;
  total: number;
}

/** Somme des soldes des comptes commençant par l'un des préfixes (inclut les sous-comptes). */
function sumPrefix(b: Record<string, number>, ...prefixes: string[]): number {
  let total = 0;
  for (const [code, v] of Object.entries(b)) if (prefixes.some(p => code.startsWith(p))) total += v;
  return total;
}

export function computeTreasury(entries: JournalEntry[]): TreasurySnapshot {
  const b = computeBalances(entries);
  const cash = sumPrefix(b, '57');
  const orangeMoney = sumPrefix(b, '5261');
  const mtnMomo = sumPrefix(b, '5262');
  const wave = sumPrefix(b, '5263');
  const moovMoney = sumPrefix(b, '5264');
  // Banques : 52x hors portefeuilles Mobile Money (526x), sous-comptes inclus (5212 Ecobank…)
  const bank = sumPrefix(b, '52') - sumPrefix(b, '526');
  const mobileMoney = orangeMoney + mtnMomo + wave + moovMoney;
  return { cash, orangeMoney, mtnMomo, wave, moovMoney, bank, mobileMoney, total: cash + mobileMoney + bank };
}

// ---------- Flux ----------

export interface Flows {
  /** Encaissements réels (trésorerie qui augmente, hors virements internes) */
  cashIn: number;
  /** Décaissements réels */
  cashOut: number;
  netCash: number;
  /** Chiffre d'affaires HT (comptes 7x) */
  revenue: number;
  /** Charges HT (comptes 6x) */
  expenses: number;
  result: number;
  count: number;
  topExpenses: { code: string; label: string; amount: number }[];
  topRevenue: { code: string; label: string; amount: number }[];
}

export function computeFlows(entries: JournalEntry[], from: string, to: string): Flows {
  let cashIn = 0, cashOut = 0, revenue = 0, expenses = 0, count = 0;
  const exp: Record<string, number> = {};
  const rev: Record<string, number> = {};

  for (const e of entries) {
    if (!inRange(e, from, to)) continue;
    count++;
    // Mouvement net de trésorerie (un virement interne s'annule).
    const t = prefixBalance(e, '5');
    if (t > 0) cashIn += t;
    if (t < 0) cashOut -= t;
    for (const l of e.lines) {
      if (INCOME.some(p => l.accountCode.startsWith(p))) {
        revenue += l.credit - l.debit;
        rev[l.accountCode] = (rev[l.accountCode] ?? 0) + l.credit - l.debit;
      } else if (CHARGE.some(p => l.accountCode.startsWith(p))) {
        expenses += l.debit - l.credit;
        exp[l.accountCode] = (exp[l.accountCode] ?? 0) + l.debit - l.credit;
      }
    }
  }

  const rank = (m: Record<string, number>) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, amount]) => ({ code, label: getAccountByCode(code)?.label ?? `Compte ${code}`, amount }));

  return {
    cashIn, cashOut, netCash: cashIn - cashOut, revenue, expenses, result: revenue - expenses, count,
    topExpenses: rank(exp), topRevenue: rank(rev),
  };
}

// ---------- Tiers ----------

export function computeReceivables(entries: JournalEntry[]) {
  const b = computeBalances(entries);
  const total = Math.max(0, sumPrefix(b, '411'));
  const open = entries
    .filter(e => prefixBalance(e, '411') > 0)
    .sort((a, c) => (a.date < c.date ? 1 : -1))
    .slice(0, 5)
    .map(e => ({ date: e.date, label: e.label, amount: prefixBalance(e, '411') }));
  return { total, open };
}

export function computePayables(entries: JournalEntry[]) {
  const b = computeBalances(entries);
  const total = Math.max(0, -sumPrefix(b, '401'));
  const open = entries
    .filter(e => prefixBalance(e, '401') < 0)
    .sort((a, c) => (a.date < c.date ? 1 : -1))
    .slice(0, 5)
    .map(e => ({ date: e.date, label: e.label, amount: -prefixBalance(e, '401') }));
  return { total, open };
}

// ---------- TVA ----------

export interface TvaSummary {
  period: string;
  totalSalesHT: number;
  totalPurchasesHT: number;
  tvaCollectee: number;
  tvaDeductible: number;
  netToPay: number;
  credit: number;
  entriesCount: number;
}

/** TVA du mois `YYYY-MM` (ou de l'année `YYYY`) : soldes des comptes 443 (collectée) et 445 (déductible) des écritures validées. */
export function computeTva(entries: JournalEntry[], month: string): TvaSummary {
  let totalSalesHT = 0, totalPurchasesHT = 0, tvaCollectee = 0, tvaDeductible = 0, entriesCount = 0;
  for (const e of entries) {
    if (e.status !== 'validated' || !e.date.startsWith(month)) continue;
    const sales = income(e, '70');
    const purchases = charge(e, '60', '61', '62', '63', '21', '22', '23', '24');
    totalSalesHT += sales;
    totalPurchasesHT += purchases;
    tvaCollectee += income(e, '443');
    tvaDeductible += charge(e, '445');
    if (sales || purchases) entriesCount++;
  }
  return {
    period: month,
    totalSalesHT, totalPurchasesHT, tvaCollectee, tvaDeductible,
    netToPay: Math.max(0, tvaCollectee - tvaDeductible),
    credit: Math.max(0, tvaDeductible - tvaCollectee),
    entriesCount,
  };
}

// ---------- Prévision de trésorerie ----------

export function forecastCash(entries: JournalEntry[], now = new Date()) {
  const treasury = computeTreasury(entries);
  const windowDays = 30;
  const from = new Date(now);
  from.setDate(from.getDate() - windowDays + 1);
  const flows = computeFlows(entries, isoDate(from), isoDate(now));
  const dailyNet = flows.netCash / windowDays;
  const at = (days: number) => Math.round(treasury.total + dailyNet * days);
  return {
    basedOnEntries: flows.count,
    dailyNet: Math.round(dailyNet),
    in30: at(30), in60: at(60), in90: at(90),
    runwayDays: dailyNet < 0 && treasury.total > 0 ? Math.floor(treasury.total / -dailyNet) : null,
  };
}

// ---------- Score de solvabilité (dossier Crédit-Ready) ----------

export interface CreditAssessment {
  sufficientData: boolean;
  score: number;
  mention: 'Excellent dossier bancable' | 'Profil sain & solvable' | 'Profil modéré' | 'À consolider';
  monthsObserved: number;
  avgMonthlyRevenue: number;
  avgMonthlyExpenses: number;
  avgMonthlyNetFlow: number;
  netMarginPct: number;
  traceabilityRate: number;
  regularityRate: number;
  anomalyRate: number;
  runwayMonths: number;
  maxMonthlyRepayment: number;
  suggested12MonthCredit: number;
  recommendations: string[];
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));

export function computeCreditAssessment(entries: JournalEntry[], now = new Date()): CreditAssessment {
  const dated = entries.filter(e => e.date <= isoDate(now));
  if (dated.length === 0) {
    return {
      sufficientData: false, score: 0, mention: 'À consolider', monthsObserved: 0,
      avgMonthlyRevenue: 0, avgMonthlyExpenses: 0, avgMonthlyNetFlow: 0, netMarginPct: 0,
      traceabilityRate: 0, regularityRate: 0, anomalyRate: 0, runwayMonths: 0,
      maxMonthlyRepayment: 0, suggested12MonthCredit: 0,
      recommendations: ['Aucune écriture enregistrée : commencez à saisir vos ventes et achats pour constituer votre dossier.'],
    };
  }

  // Fenêtre : 6 derniers mois maximum
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const windowed = dated.filter(e => e.date >= isoDate(sixMonthsAgo));
  const firstDate = windowed.reduce((min, e) => (e.date < min ? e.date : min), windowed[0].date);
  const [fy, fm] = firstDate.split('-').map(Number);
  const monthsObserved = Math.max(1, Math.min(6, (now.getFullYear() - fy) * 12 + (now.getMonth() + 1 - fm) + 1));

  const flows = computeFlows(windowed, '0000-01-01', '9999-12-31');
  const avgMonthlyRevenue = Math.round(flows.revenue / monthsObserved);
  const avgMonthlyExpenses = Math.round(flows.expenses / monthsObserved);
  const avgMonthlyNetFlow = avgMonthlyRevenue - avgMonthlyExpenses;
  const netMarginPct = flows.revenue > 0 ? Math.round(((flows.revenue - flows.expenses) / flows.revenue) * 100) : 0;

  // Traçabilité : parmi les encaissements réels de ventes, part passée par Mobile Money / banque
  const salesEntries = windowed.filter(e => income(e, '7') > 0 && prefixBalance(e, '5') > 0);
  const traced = salesEntries.filter(e => e.paymentMethod !== 'cash').length;
  const traceabilityRate = salesEntries.length ? Math.round((traced / salesEntries.length) * 100) : 0;

  const monthsWithRevenue = new Set(windowed.filter(e => income(e, '7') > 0).map(e => e.date.slice(0, 7))).size;
  const regularityRate = Math.round((monthsWithRevenue / monthsObserved) * 100);

  const anomalyRate = windowed.length ? windowed.filter(e => e.status === 'anomaly').length / windowed.length : 0;

  const treasury = computeTreasury(entries);
  const runwayMonths = avgMonthlyExpenses > 0 ? Math.max(0, treasury.total) / avgMonthlyExpenses : 0;

  const score = Math.round(
    25 * (regularityRate / 100) +
    25 * clamp(traceabilityRate / 100 / 0.6) +
    20 * clamp((netMarginPct / 100 + 0.05) / 0.25) +
    15 * clamp(runwayMonths / 3) +
    15 * (1 - clamp(anomalyRate * 5)),
  );

  const mention: CreditAssessment['mention'] =
    score >= 80 ? 'Excellent dossier bancable' : score >= 65 ? 'Profil sain & solvable' : score >= 45 ? 'Profil modéré' : 'À consolider';

  const maxMonthlyRepayment = Math.max(0, Math.round(avgMonthlyNetFlow * 0.33));
  const recommendations: string[] = [];
  if (windowed.length < 10 || monthsObserved < 3) recommendations.push('Historique court : les banques demandent en général 3 à 6 mois de flux réguliers. Continuez à tout enregistrer.');
  if (traceabilityRate < 50) recommendations.push(`Seulement ${traceabilityRate}% de vos ventes sont tracées (Mobile Money / banque). Encaissez davantage hors espèces.`);
  if (regularityRate < 80) recommendations.push('Vos encaissements ne sont pas réguliers chaque mois : la banque y verra un risque.');
  if (netMarginPct < 10) recommendations.push('Marge nette faible : réduisez vos charges ou revoyez vos prix avant de demander un crédit.');
  if (anomalyRate > 0.05) recommendations.push('Plusieurs écritures sont en anomalie : faites-les valider par votre expert-comptable avant le dépôt.');
  if (runwayMonths < 1) recommendations.push('Trésorerie inférieure à un mois de charges : constituez une réserve.');
  if (recommendations.length === 0) recommendations.push('Dossier solide : préparez vos états financiers certifiés et vos relevés Mobile Money / bancaires.');

  return {
    sufficientData: windowed.length >= 10 && monthsObserved >= 1,
    score, mention, monthsObserved, avgMonthlyRevenue, avgMonthlyExpenses, avgMonthlyNetFlow, netMarginPct,
    traceabilityRate, regularityRate, anomalyRate: Math.round(anomalyRate * 100), runwayMonths: Math.round(runwayMonths * 10) / 10,
    maxMonthlyRepayment, suggested12MonthCredit: maxMonthlyRepayment * 12, recommendations,
  };
}

// ---------- Contexte compact pour l'agent ----------

export function computeReviewCounts(entries: JournalEntry[]) {
  return {
    pending: entries.filter(e => e.status === 'pending_review').length,
    anomalies: entries.filter(e => e.status === 'anomaly').length,
    validated: entries.filter(e => e.status === 'validated').length,
    total: entries.length,
  };
}

export function buildAgentContext(entries: JournalEntry[], now = new Date()) {
  const month = periodBounds('month', now);
  const week = periodBounds('week', now);
  const today = periodBounds('today', now);
  return {
    date: isoDate(now),
    treasury: computeTreasury(entries),
    today: computeFlows(entries, today.from, today.to),
    week: computeFlows(entries, week.from, week.to),
    month: { label: month.label, ...computeFlows(entries, month.from, month.to) },
    year: computeFlows(entries, periodBounds('year', now).from, isoDate(now)),
    receivables: computeReceivables(entries),
    payables: computePayables(entries),
    tva: computeTva(entries, isoDate(now).slice(0, 7)),
    forecast: forecastCash(entries, now),
    credit: computeCreditAssessment(entries, now),
    review: computeReviewCounts(entries),
    recentEntries: [...entries]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 8)
      .map(e => ({ date: e.date, label: e.label, amount: e.amount, debit: debitCodes(e).join(','), credit: creditCodes(e).join(','), method: e.paymentMethod, status: e.status })),
  };
}

export type AgentContext = ReturnType<typeof buildAgentContext>;

// ---------- États financiers (Bilan & Compte de résultat) ----------
export interface FinancialReport {
  hasData: boolean;
  /** Exercice présenté (année civile), ou null : toutes les écritures. */
  year: string | null;
  // Compte de résultat (produits / charges HT)
  revenue: number;
  otherIncome: number;
  purchases: number;
  services: number;
  personnel: number;
  taxes: number;
  depreciation: number;
  financialResult: number;
  haoResult: number;
  resultBeforeTax: number;
  corporateTax: number;
  corporateTaxEstimated: boolean;
  netProfit: number;
  // Soldes intermédiaires de gestion
  grossMargin: number;
  addedValue: number;
  ebe: number;
  operatingResult: number;
  // Bilan
  immobilisationsBrutes: number;
  amortissements: number;
  immobilisationsNettes: number;
  stocks: number;
  creances: number;
  treasury: number;
  totalActif: number;
  capital: number;
  /** Résultats des exercices antérieurs (report à nouveau calculé). */
  reportANouveau: number;
  /** Dettes financières et circulantes (hors découverts). */
  dettes: number;
  /** Trésorerie passif : découverts et soldes créditeurs de trésorerie. */
  overdrafts: number;
  resultatBilan: number;
  totalPassif: number;
  /** Écart actif - passif (0 si équilibré) ; un écart signale un jeu d'écritures incomplet. */
  imbalance: number;
}

/** Résultat (produits - charges, classes 6 à 8) d'un ensemble d'écritures. */
const resultOf = (entries: JournalEntry[]) =>
  entries.reduce((s, e) => s + income(e, ...INCOME) - charge(e, ...CHARGE) - charge(e, '89'), 0);

/**
 * Bilan et Compte de résultat SYSCOHADA à partir des SEULES écritures validées.
 * Exercice = année civile `year` : le compte de résultat porte sur l'année, le bilan sur tout
 * l'historique jusqu'au 31/12 ; les résultats des années précédentes forment le report à nouveau.
 * Aucune valeur de démonstration : un dossier sans écriture produit un rapport à zéro.
 */
export function computeFinancialReport(entries: JournalEntry[], year: string | null = null): FinancialReport {
  const validated = entries.filter(e => e.status === 'validated' && (!year || e.date <= `${year}-12-31`));
  const current = year ? validated.filter(e => e.date >= `${year}-01-01`) : validated;
  const previous = year ? validated.filter(e => e.date < `${year}-01-01`) : [];
  const balances = computeBalances(validated);

  const incomeOf = (prefixes: string[]) => current.reduce((s, e) => s + income(e, ...prefixes), 0);
  const expenseOf = (prefixes: string[]) => current.reduce((s, e) => s + charge(e, ...prefixes), 0);

  const revenue = incomeOf(['70']);
  const otherIncome = incomeOf(['71', '72', '73', '74', '75']);
  const purchases = expenseOf(['60', '61']);
  const services = expenseOf(['62', '63']);
  const personnel = expenseOf(['66']);
  const taxes = expenseOf(['64']);
  const depreciation = expenseOf(['68', '69']);
  const financialResult = incomeOf(['76', '77', '78', '79']) - expenseOf(['65', '67']);
  const haoResult = incomeOf(['82', '84', '86', '88']) - expenseOf(['81', '83', '85', '87']);

  const grossMargin = revenue - purchases;
  const addedValue = grossMargin - services;
  const ebe = addedValue - personnel - taxes;
  const operatingResult = ebe - depreciation;
  const resultBeforeTax = operatingResult + financialResult + haoResult;

  const taxEntries = expenseOf(['89']);
  const corporateTaxEstimated = taxEntries === 0 && resultBeforeTax > 0;
  const corporateTax = taxEntries > 0 ? taxEntries : corporateTaxEstimated ? Math.round(resultBeforeTax * 0.25) : 0;
  const netProfit = resultBeforeTax - corporateTax;

  // Bilan : soldes réels par nature de compte.
  const sumBalances = (predicate: (code: string, balance: number) => boolean) => {
    let total = 0;
    for (const [code, balance] of Object.entries(balances)) {
      if (predicate(code, balance)) total += balance;
    }
    return total;
  };

  const immobilisationsBrutes = sumBalances((c, b) => c.startsWith('2') && !c.startsWith('28') && !c.startsWith('29') && b > 0);
  const amortissements = 0 - sumBalances(c => c.startsWith('28') || c.startsWith('29'));
  const immobilisationsNettes = immobilisationsBrutes - Math.max(0, amortissements);
  const stocks = sumBalances((c, b) => c.startsWith('3') && b > 0);
  const creances = sumBalances((c, b) => c.startsWith('4') && b > 0);
  // Trésorerie : soldes débiteurs à l'actif, découverts (soldes créditeurs) au passif.
  const treasuryActif = sumBalances((c, b) => c.startsWith('5') && b > 0);
  const overdrafts = 0 - sumBalances((c, b) => c.startsWith('5') && b < 0);
  const totalActif = immobilisationsNettes + stocks + creances + treasuryActif;

  const capital = 0 - sumBalances(c => c.startsWith('1') && !/^1[6-9]/.test(c));
  const emprunts = 0 - sumBalances(c => /^1[6-9]/.test(c));
  const reportANouveau = resultOf(previous);
  // L'impôt estimé (non encore comptabilisé) est une dette fiscale : sans lui, le bilan ne s'équilibre pas.
  const dettes = emprunts - sumBalances((c, b) => c.startsWith('4') && b < 0) + (corporateTaxEstimated ? corporateTax : 0);
  const resultatBilan = netProfit;
  const totalPassif = capital + reportANouveau + dettes + overdrafts + resultatBilan;

  return {
    hasData: current.length > 0,
    year,
    revenue, otherIncome, purchases, services, personnel, taxes, depreciation,
    financialResult, haoResult, resultBeforeTax, corporateTax, corporateTaxEstimated,
    netProfit, grossMargin, addedValue, ebe, operatingResult,
    immobilisationsBrutes, amortissements: Math.max(0, amortissements), immobilisationsNettes,
    stocks, creances, treasury: treasuryActif, totalActif,
    capital, reportANouveau, dettes, overdrafts, resultatBilan, totalPassif,
    imbalance: Math.round((totalActif - totalPassif) * 100) / 100,
  };
}

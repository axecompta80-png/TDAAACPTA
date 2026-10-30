import type { FixedAsset } from '../types';

/**
 * Amortissement linéaire SYSCOHADA, prorata temporis en jours la première année
 * (base 360 jours, mois de 30 jours). Montants arrondis au franc ; le total est exactement le coût.
 */
export function depreciationSchedule(a: Pick<FixedAsset, 'acquisitionDate' | 'cost' | 'durationYears'>) {
  const rows: { year: number; amount: number; cumulative: number; net: number }[] = [];
  if (!(a.cost > 0) || !(a.durationYears > 0)) return rows;
  const annual = a.cost / a.durationYears;
  const [y0, m, d] = a.acquisitionDate.split('-').map(Number);
  const firstDays = (12 - m) * 30 + (30 - Math.min(d, 30) + 1);
  // Arrondi du cumul exact (et non de chaque annuité) : les écarts d'arrondi ne s'accumulent pas.
  let exact = 0, cumulative = 0;
  for (let year = y0; cumulative < a.cost && year <= y0 + a.durationYears; year++) {
    exact += year === y0 ? annual * firstDays / 360 : annual;
    const amount = Math.min(a.cost, Math.round(exact)) - cumulative;
    cumulative += amount;
    rows.push({ year, amount, cumulative, net: a.cost - cumulative });
  }
  return rows;
}

/** Compte d'amortissement d'une immobilisation : 2441 → 2844, 215 → 2815 (le plus long qui existe). */
export function amortizationAccountFor(code: string, exists: (c: string) => boolean): string | undefined {
  for (let n = code.length; n >= 2; n--) {
    const c = '28' + code.slice(1, n);
    if (exists(c)) return c;
  }
  return undefined;
}

/** Dotation : 6811 (exploitation). */
export const DEPRECIATION_EXPENSE = '6811';

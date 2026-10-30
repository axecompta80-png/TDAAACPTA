import type { JournalCode, JournalEntry, JournalLine } from '../types';

/**
 * Écritures à plusieurs lignes : règles partagées par le serveur (contrôle officiel) et l'interface.
 */

export const JOURNALS: { code: JournalCode; label: string }[] = [
  { code: 'VT', label: 'Ventes' },
  { code: 'AC', label: 'Achats' },
  { code: 'BQ', label: 'Banque & Mobile Money' },
  { code: 'CA', label: 'Caisse' },
  { code: 'OD', label: 'Opérations diverses' },
  { code: 'AN', label: 'À-nouveaux (soldes d’ouverture)' },
];
export const JOURNAL_LABEL = Object.fromEntries(JOURNALS.map(j => [j.code, j.label])) as Record<JournalCode, string>;

export const TVA_COLLECTED = '4431';
export const TVA_DEDUCTIBLE = '4452';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Lignes d'une opération simple « débit / crédit pour un montant TTC ».
 * Avec TVA, elle est passée sur son propre compte :
 *   vente (crédit 7x)          : D débit TTC / C 7x HT + C 4431 TVA
 *   achat (débit 6x, 2x, 3x)   : D débit HT + D 4452 TVA / C crédit TTC
 * Ailleurs la TVA n'a pas de sens et est ignorée.
 */
export function simpleLines(debit: string, credit: string, amount: number, tva = 0): JournalLine[] {
  const ttc = round2(amount);
  const t = round2(Math.min(Math.max(0, tva), ttc));
  if (t > 0 && t < ttc && credit.startsWith('7')) {
    return [
      { accountCode: debit, debit: ttc, credit: 0 },
      { accountCode: credit, debit: 0, credit: round2(ttc - t) },
      { accountCode: TVA_COLLECTED, debit: 0, credit: t },
    ];
  }
  if (t > 0 && t < ttc && /^[236]/.test(debit)) {
    return [
      { accountCode: debit, debit: round2(ttc - t), credit: 0 },
      { accountCode: TVA_DEDUCTIBLE, debit: t, credit: 0 },
      { accountCode: credit, debit: 0, credit: ttc },
    ];
  }
  return [
    { accountCode: debit, debit: ttc, credit: 0 },
    { accountCode: credit, debit: 0, credit: ttc },
  ];
}

export const totalDebit = (lines: JournalLine[]) => round2(lines.reduce((s, l) => s + l.debit, 0));
export const totalCredit = (lines: JournalLine[]) => round2(lines.reduce((s, l) => s + l.credit, 0));

/** Message d'erreur si les lignes ne forment pas une écriture valable, sinon null. */
export function linesError(lines: JournalLine[]): string | null {
  if (lines.length < 2) return 'Une écriture comporte au moins deux lignes.';
  for (const [i, l] of lines.entries()) {
    if (!l.accountCode) return `Ligne ${i + 1} : compte manquant.`;
    if (l.debit < 0 || l.credit < 0) return `Ligne ${i + 1} : montant négatif.`;
    if ((l.debit > 0) === (l.credit > 0)) return `Ligne ${i + 1} : un montant au débit OU au crédit.`;
  }
  const d = totalDebit(lines), c = totalCredit(lines);
  if (Math.abs(d - c) > 0.005) return `Écriture déséquilibrée : débit ${d.toLocaleString('fr-FR')} ≠ crédit ${c.toLocaleString('fr-FR')}.`;
  return null;
}

/** Journal le plus naturel pour ces lignes : la trésorerie d'abord, puis ventes, achats, sinon OD. */
export function defaultJournal(lines: JournalLine[]): JournalCode {
  const has = (re: RegExp) => lines.some(l => re.test(l.accountCode));
  if (has(/^57/)) return 'CA';
  if (has(/^5[0-6]/)) return 'BQ';
  if (has(/^7/)) return 'VT';
  if (has(/^(6|2|40)/)) return 'AC';
  return 'OD';
}

/** Comptes débités puis crédités, pour l'affichage compact « 601, 4452 / 401 ». */
export function accountsSummary(e: Pick<JournalEntry, 'lines'>): string {
  const codes = (side: 'debit' | 'credit') => [...new Set(e.lines.filter(l => l[side] > 0).map(l => l.accountCode))].join(', ');
  return `${codes('debit')} / ${codes('credit')}`;
}

export const debitCodes = (e: Pick<JournalEntry, 'lines'>) => e.lines.filter(l => l.debit > 0).map(l => l.accountCode);
export const creditCodes = (e: Pick<JournalEntry, 'lines'>) => e.lines.filter(l => l.credit > 0).map(l => l.accountCode);

/** Solde (débit - crédit) des lignes dont le compte commence par l'un des préfixes. */
export function prefixBalance(e: Pick<JournalEntry, 'lines'>, ...prefixes: string[]): number {
  let s = 0;
  for (const l of e.lines) if (prefixes.some(p => l.accountCode.startsWith(p))) s += l.debit - l.credit;
  return round2(s);
}

/** TVA portée par l'écriture (collectée + déductible). */
export const entryTva = (e: Pick<JournalEntry, 'lines'>) =>
  round2(Math.abs(prefixBalance(e, '443')) + Math.abs(prefixBalance(e, '445')));

/** Contre-passation : mêmes comptes, débit et crédit inversés. */
export const reversedLines = (lines: JournalLine[]): JournalLine[] =>
  lines.map(l => ({ accountCode: l.accountCode, label: l.label, debit: l.credit, credit: l.debit }));

/** Une date est-elle dans la période bloquée ? */
export const isLocked = (date: string, lockedUntil?: string | null) => !!lockedUntil && date <= lockedUntil;

/** Même jour le mois suivant, ramené au dernier jour des mois courts (31/01 → 28/02 → 31/03). */
export function nextMonthly(date: string, day: number): string {
  const [y, m] = date.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

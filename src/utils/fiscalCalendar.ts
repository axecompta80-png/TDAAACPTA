import { isLocked } from './entryLines';

export interface Deadline {
  key: string;
  label: string;
  /** Date limite (AAAA-MM-JJ). */
  due: string;
  /** Fin de la période déclarée : la déclaration est faite quand la période est bloquée. */
  periodEnd: string;
  done: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * Échéances fiscales des exercices donnés : TVA du mois (15 du mois suivant) et
 * états financiers / DSF de l'exercice (30 avril N+1).
 * ponytail: dates communes UEMOA ; ajouter un tableau par pays si un dossier en a besoin (ex. Cameroun 15 mars).
 */
export function fiscalDeadlines(years: number[], lockedUntil?: string | null): Deadline[] {
  const out: Deadline[] = [];
  for (const y of years) {
    for (let m = 1; m <= 12; m++) {
      const periodEnd = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
      const due = m === 12 ? `${y + 1}-01-15` : `${y}-${pad(m + 1)}-15`;
      out.push({ key: `tva-${y}-${pad(m)}`, label: `TVA de ${MONTHS[m - 1]} ${y}`, due, periodEnd, done: isLocked(periodEnd, lockedUntil) });
    }
    const periodEnd = `${y}-12-31`;
    out.push({ key: `dsf-${y}`, label: `États financiers et DSF ${y}`, due: `${y + 1}-04-30`, periodEnd, done: isLocked(periodEnd, lockedUntil) });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

/** Échéances à rappeler : non faites, en retard depuis moins de 30 jours ou dues dans les 7 jours. */
export function deadlinesToRemind(today: string, lockedUntil?: string | null): Deadline[] {
  const y = Number(today.slice(0, 4));
  const shift = (days: number) => new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);
  const from = shift(-30), to = shift(7);
  return fiscalDeadlines([y - 1, y], lockedUntil).filter(d => !d.done && d.due >= from && d.due <= to);
}

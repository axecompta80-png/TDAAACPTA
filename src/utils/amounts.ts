import { normalizeText } from './paymentAccounts';

/**
 * Extraction de montants en langage courant (FCFA) :
 *   "5000F", "5 000 F CFA", "5.000", "45k", "1,5 million", "deux cent cinquante mille francs",
 *   "3 sacs à 5000F" (quantité × prix), "acompte 10 000 F, reste 15 000 F" (paiement partiel).
 */

export interface AmountInfo {
  /** Montant total TTC de l'opération */
  amount: number;
  /** Montant réellement réglé si paiement partiel (acompte / avance) */
  paid?: number;
  quantity?: number;
  unitPrice?: number;
  /** true si le montant portait une marque de devise (F, FCFA, francs…) */
  hasCurrency: boolean;
}

interface Token {
  value: number;
  index: number;
  end: number;
  hasCurrency: boolean;
}

const NUM = String.raw`\d{1,3}(?:[\s .,']\d{3})+(?!\d)|\d+(?:[.,]\d+)?`;
const SUFFIX = String.raw`(?:\s*(k|m|millions?|milliards?|mille)\b)?`;
const CURRENCY = String.raw`(?:\s*(f\s*cfa|fcfa|cfa|francs?|frs?|f\b|xof|xaf))?`;

function toNumber(raw: string): number {
  const s = raw.replace(/[\s ']/g, '');
  // "5.000" ou "5,000" → milliers ; "1,5" ou "1.5" → décimal
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ''), 10);
  return parseFloat(s.replace(',', '.'));
}

function maskNonAmounts(norm: string): string {
  return norm
    // dates 12/09/2026, 12-09
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, m => ' '.repeat(m.length))
    // heures 14h30, 14:30
    .replace(/\b\d{1,2}\s*(?:h|:)\s*\d{2}\b/g, m => ' '.repeat(m.length))
    // numéros de téléphone / identifiants longs (8+ chiffres d'affilée, ou 0X XX XX XX XX)
    .replace(/\b0\d(?:[\s.]?\d{2}){3,4}\b/g, m => ' '.repeat(m.length))
    .replace(/\b\d{8,}\b/g, m => ' '.repeat(m.length))
    // références de transaction (MP240918.1234.A12345, ID: 123456)
    .replace(/\b(?:id|ref|trans(?:action)?)\s*(?:id)?\s*[:#]?\s*[a-z0-9.\-_]{5,}/g, m => ' '.repeat(m.length));
}

function digitTokens(norm: string): Token[] {
  const masked = maskNonAmounts(norm);
  const re = new RegExp(`(${NUM})${SUFFIX}${CURRENCY}`, 'g');
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    let value = toNumber(m[1]);
    if (!isFinite(value)) continue;
    const suf = m[2];
    if (suf) {
      if (suf === 'k' || suf === 'mille') value *= 1000;
      else if (suf.startsWith('milliard')) value *= 1e9;
      else value *= 1e6; // m / million(s)
    }
    tokens.push({ value: Math.round(value), index: m.index, end: m.index + m[0].length, hasCurrency: !!m[3] });
  }
  return tokens;
}

// ---------- Nombres écrits en toutes lettres (dictée vocale) ----------

const WORD_VALUES: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
};

function wordRunValue(words: string[]): number {
  let total = 0;
  let current = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 'et') continue;
    if (w === 'cent' || w === 'cents') current = (current || 1) * 100;
    else if (w === 'mille') { total += (current || 1) * 1000; current = 0; }
    else if (w.startsWith('million')) { total += (current || 1) * 1e6; current = 0; }
    else if (w.startsWith('milliard')) { total += (current || 1) * 1e9; current = 0; }
    else if ((w === 'vingt' || w === 'vingts') && words[i - 1] === 'quatre') current += 76; // quatre-vingt = 80
    else if (w in WORD_VALUES) current += WORD_VALUES[w];
  }
  return total + current;
}

function wordTokens(norm: string): Token[] {
  const tokens: Token[] = [];
  const re = /[a-z]+(?:[-\s]+[a-z]+)*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    // découpe la séquence en runs de mots-nombres consécutifs
    const parts = m[0].split(/([-\s]+)/);
    let offset = m.index;
    let runStart = -1;
    let runWords: string[] = [];
    let runEndOffset = 0;
    const flush = () => {
      if (runWords.length) {
        const meaningful = runWords.filter(w => w !== 'et');
        const hasBig = meaningful.some(w => w.startsWith('cent') || w === 'mille' || w.startsWith('million') || w.startsWith('milliard'));
        const value = wordRunValue(runWords);
        if (hasBig && value >= 100) {
          const tail = norm.slice(runEndOffset).match(/^\s*(f\s*cfa|fcfa|cfa|francs?|frs?|f\b)/);
          tokens.push({ value, index: runStart, end: runEndOffset + (tail ? tail[0].length : 0), hasCurrency: !!tail });
        }
      }
      runWords = [];
      runStart = -1;
    };
    for (const part of parts) {
      if (/^[-\s]+$/.test(part)) { offset += part.length; continue; }
      const isNumWord = part in WORD_VALUES || /^(cents?|mille|millions?|milliards?)$/.test(part) || (part === 'et' && runWords.length > 0);
      if (isNumWord) {
        if (runStart < 0) runStart = offset;
        runWords.push(part);
        runEndOffset = offset + part.length;
      } else {
        flush();
      }
      offset += part.length;
    }
    flush();
  }
  return tokens;
}

export function extractAmountTokens(text: string): Token[] {
  const norm = normalizeText(text);
  return [...digitTokens(norm), ...wordTokens(norm)].sort((a, b) => a.index - b.index);
}

/** "12 000" → 12000, utilisé pour ranger des chaînes de nombres dans un formulaire. */
export function formatFcfa(n: number): string {
  return Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
}

/**
 * Trouve le montant principal d'une phrase.
 * Retourne undefined si aucun montant fiable n'est présent : l'agent doit alors poser la question.
 */
export function extractAmountInfo(text: string): AmountInfo | undefined {
  const norm = normalizeText(text);
  const tokens = extractAmountTokens(text);
  if (tokens.length === 0) return undefined;

  const around = (t: Token, before: number) => norm.slice(Math.max(0, t.index - before), t.index);

  // 1. Paiement partiel : "acompte de 10 000 F, reste 15 000 F" / "payé 20 000 sur 50 000"
  const resteIdx = tokens.findIndex(t => /(?:reste|restant|solde|le\s+reste)\s*(?:de|a|:)?\s*$/.test(around(t, 22)));
  if (resteIdx > 0) {
    const paid = tokens[resteIdx - 1];
    const rest = tokens[resteIdx];
    return { amount: paid.value + rest.value, paid: paid.value, hasCurrency: paid.hasCurrency || rest.hasCurrency };
  }
  const surIdx = tokens.findIndex((t, i) => i > 0 && /\bsur\s*$/.test(around(t, 8)));
  if (surIdx > 0 && /acompte|avance|verse|paye|regle|partiel/.test(norm)) {
    const paid = tokens[surIdx - 1];
    const total = tokens[surIdx];
    if (total.value > paid.value) return { amount: total.value, paid: paid.value, hasCurrency: total.hasCurrency };
  }

  // 2. Quantité × prix unitaire : "3 sacs de ciment à 5000F", "12 x 2500"
  const qp = norm.match(new RegExp(`(?<![\\d.,])(\\d{1,4})\\s*(?:x|×)\\s*(${NUM})${SUFFIX}`)) ||
    norm.match(new RegExp(`(?<![\\d.,])(\\d{1,4})\\s+[a-z' ]{1,45}?\\s(?:a|@|x)\\s*(${NUM})${SUFFIX}`));
  if (qp) {
    const qty = parseInt(qp[1], 10);
    let unit = toNumber(qp[2]);
    if (qp[3]) unit *= qp[3] === 'k' || qp[3] === 'mille' ? 1000 : qp[3].startsWith('milliard') ? 1e9 : 1e6;
    const perUnitHint = /\b(?:chacun|chacune|l'unite|la piece|le sac|le kilo|unite|piece)\b/.test(norm);
    const totalHint = /\b(?:total|au total|en tout)\b/.test(norm) && !perUnitHint;
    // "3 sacs à 5000F" est un prix unitaire, sauf si "total / en tout" indique le contraire
    if (qty > 0 && qty < 10000 && unit > 0 && !totalHint) {
      return { amount: Math.round(qty * unit), quantity: qty, unitPrice: Math.round(unit), hasCurrency: true };
    }
  }

  // 3. "total / montant" explicite
  const totalTok = tokens.find(t => /(?:total|montant|somme|pour)\s*(?:de|:)?\s*$/.test(around(t, 14)) && t.hasCurrency) ||
    tokens.find(t => /(?:total|montant total|en tout)\s*(?:de|:)?\s*$/.test(around(t, 16)));
  if (totalTok) return { amount: totalTok.value, hasCurrency: totalTok.hasCurrency };

  // 4. Premier montant portant une devise, sinon premier nombre plausible
  const withCurrency = tokens.find(t => t.hasCurrency && t.value > 0);
  if (withCurrency) return { amount: withCurrency.value, hasCurrency: true };
  const plain = tokens.find(t => t.value >= 100);
  if (plain) return { amount: plain.value, hasCurrency: false };
  return undefined;
}

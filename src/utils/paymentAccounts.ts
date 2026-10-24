import type { PaymentMethod } from '../types';

/**
 * Source unique de vérité : mode de paiement → compte de trésorerie SYSCOHADA.
 * Utilisée par l'agent IA (serveur), l'import Excel, le facturier et les écrans de trésorerie.
 *   espèces            → 5711 Caisse
 *   chèque / virement  → 5211 Banque
 *   Orange Money       → 5261
 *   MTN MoMo           → 5262
 *   Wave               → 5263
 *   Moov Money         → 5264
 */
export const TREASURY_ACCOUNT: Record<PaymentMethod, { code: string; label: string }> = {
  cash: { code: '5711', label: 'Caisse principale (espèces)' },
  orange_money: { code: '5261', label: 'Portefeuille Orange Money Entreprise' },
  mtn_momo: { code: '5262', label: 'Portefeuille MTN Mobile Money' },
  wave: { code: '5263', label: 'Portefeuille Wave Business' },
  moov_money: { code: '5264', label: 'Portefeuille Moov Money' },
  bank_transfer: { code: '5211', label: 'Banque locale (Ecobank, Coris, SG, UBA)' },
  cheque: { code: '5211', label: 'Banque locale (Ecobank, Coris, SG, UBA)' },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  wave: 'Wave',
  moov_money: 'Moov Money',
  bank_transfer: 'Virement bancaire',
  cheque: 'Chèque bancaire',
};

/** Tournure utilisée dans les phrases : "encaissé {en espèces}", "payé {par Orange Money}". */
export const PAYMENT_METHOD_VIA: Record<PaymentMethod, string> = {
  cash: 'en espèces',
  orange_money: 'par Orange Money',
  mtn_momo: 'par MTN MoMo',
  wave: 'par Wave',
  moov_money: 'par Moov Money',
  bank_transfer: 'par virement bancaire',
  cheque: 'par chèque bancaire',
};

/** Nom du "portefeuille" concerné, pour expliquer l'effet sur les disponibilités. */
export const PAYMENT_METHOD_WALLET: Record<PaymentMethod, string> = {
  cash: 'caisse',
  orange_money: 'compte Orange Money',
  mtn_momo: 'compte MTN MoMo',
  wave: 'compte Wave',
  moov_money: 'compte Moov Money',
  bank_transfer: 'compte bancaire',
  cheque: 'compte bancaire',
};

export const TREASURY_ACCOUNT_CODES = ['5211', '5261', '5262', '5263', '5264', '5711', '5721'];

export function treasuryAccountFor(method: PaymentMethod) {
  return TREASURY_ACCOUNT[method] ?? TREASURY_ACCOUNT.cash;
}

export function isTreasuryCode(code: string) {
  return code.startsWith('5');
}

/** Compte de trésorerie → mode de paiement le plus représentatif. */
export function paymentMethodFromAccountCode(code: string): PaymentMethod | undefined {
  switch (code) {
    case '5711':
    case '5721':
      return 'cash';
    case '5261':
      return 'orange_money';
    case '5262':
      return 'mtn_momo';
    case '5263':
      return 'wave';
    case '5264':
      return 'moov_money';
    case '5211':
      return 'bank_transfer';
    default:
      return undefined;
  }
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'");
}

interface MethodPattern {
  method: PaymentMethod;
  re: RegExp;
}

// Ordre sans importance : on retient la position dans le texte.
// Les marques d'opérateurs (Orange, MTN, Moov) sont aussi des fournisseurs de télécoms :
// on exige "money"/"momo"/"OM" ou une tournure de paiement ("par orange") pour éviter
// de confondre "facture Orange 15 000 F" avec un paiement Orange Money.
const METHOD_PATTERNS: MethodPattern[] = [
  { method: 'orange_money', re: /\borange\s*-?\s*money\b|\bom\b|\bo\.m\.?\b|\b(?:par|via|avec|en|sur)\s+orange\b/g },
  { method: 'mtn_momo', re: /\bmomo\b|\bmtn\s*-?\s*(?:momo|mobile\s*money|money)\b|\bmobile\s*money\s*mtn\b|\b(?:par|via|avec|en|sur)\s+mtn\b/g },
  { method: 'wave', re: /\bwave\b/g },
  { method: 'moov_money', re: /\bmoov\s*-?\s*(?:money|africa\s*money)\b|\bflooz\b|\b(?:par|via|avec|en|sur)\s+moov\b/g },
  { method: 'cheque', re: /\bcheques?\b|\bchq\b/g },
  {
    method: 'bank_transfer',
    re: /\bvirements?\b|\bbanque\b|\bbancaires?\b|\becobank\b|\bcoris\b|\bbicec\b|\bboa\b|\bsgbci\b|\bsociete\s+generale\b|\buba\b|\bbni\b|\bnsia\b|\bafriland\b|\bbhci\b|\bcarte\s+bancaire\b|\bpar\s+carte\b|\bswift\b/g,
  },
  { method: 'cash', re: /\bcash\b|\bespeces?\b|\bliquides?\b|\ben\s+main\b|\bcaisse\b|\bcomptant\b/g },
];

const CUE_BEFORE = /(?:paye|payee?s?|paiement|regle|reglee?s?|reglement|par|via|avec|en|sur|depuis|de)\s*$/;

export interface MethodMention {
  method: PaymentMethod;
  index: number;
  cued: boolean;
}

/** Tous les modes de paiement cités, dans l'ordre d'apparition. */
export function detectAllPaymentMethods(text: string): MethodMention[] {
  const norm = normalizeText(text);
  const found: MethodMention[] = [];
  for (const { method, re } of METHOD_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(norm)) !== null) {
      const before = norm.slice(Math.max(0, m.index - 16), m.index);
      found.push({ method, index: m.index, cued: CUE_BEFORE.test(before) || /^(?:par|via|avec|en|sur)\b/.test(m[0]) });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  found.sort((a, b) => a.index - b.index);
  // Un chèque cité avec "banque" reste un chèque : on supprime le doublon bancaire voisin
  return found.filter((f, i) => !(f.method === 'bank_transfer' && found.some((o, j) => j !== i && o.method === 'cheque' && Math.abs(o.index - f.index) < 25)));
}

/**
 * Mode de paiement principal d'un texte libre, ou undefined si rien n'est précisé.
 * Un mode introduit par "payé / par / via…" l'emporte sur un simple nom cité.
 */
export function detectPaymentMethod(text: string): PaymentMethod | undefined {
  const all = detectAllPaymentMethods(text);
  if (all.length === 0) return undefined;
  const cued = all.find(a => a.cued);
  return (cued ?? all[0]).method;
}

/** Interprète une cellule "mode de paiement" d'un fichier importé ("Espèces", "OM", "Chèque"...). */
export function paymentMethodFromCell(value: string | undefined): PaymentMethod | undefined {
  if (!value) return undefined;
  const v = normalizeText(value).trim();
  if (!v) return undefined;
  if (v === 'om') return 'orange_money';
  if (v === 'cash' || v === 'especes' || v === 'espece' || v === 'liquide' || v === 'caisse') return 'cash';
  if (v.startsWith('cheq') || v.startsWith('chq')) return 'cheque';
  return detectPaymentMethod(v) ?? detectPaymentMethod(`par ${v}`);
}

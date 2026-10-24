import type { PaymentMethod } from '../../src/types';
import {
  detectAllPaymentMethods,
  detectPaymentMethod,
  normalizeText,
  PAYMENT_METHOD_LABEL,
} from '../../src/utils/paymentAccounts';
import { extractAmountInfo, extractAmountTokens } from '../../src/utils/amounts';
import type { OperationKind, ParsedOperation, ParseOutcome } from './types';

/**
 * Moteur de règles de l'agent : comprend une phrase (ou un SMS Mobile Money) et produit des
 * opérations structurées. Sert de repli sans clé IA, et de garde-fou déterministe autour de Gemini
 * (le mode de paiement dit par l'utilisateur ne doit jamais être contredit par le modèle).
 */

// ---------- Détection d'intention ----------

const QUESTION_START =
  /^(?:combien|quel(?:le|s|les)?|qui|quand|comment|pourquoi|est-?ce|puis-?je|peux-?je|dois-?je|ai-?je|montre|affiche|donne|dis|explique|c'est quoi|qu'est-?ce|que dois|ou en suis|ou est|bilan|resume|situation|liste|y a-?t-?il|combien|prevision|previsions|aide|help|que puis|comment va)/;
const OPERATION_VERBS =
  /\b(?:vendu|vendre|vente|achete|achat|paye|payee|regle|encaisse|depense|recu|retire|depose|verse|emprunte|rembourse|approvisionne|livre|facture)\b/;
const GREETING = /^(?:bonjour|bonsoir|salut|coucou|hello|hi|merci|ok|d'accord|super|parfait|bien recu|cool)\b/;

export function isGreeting(text: string): boolean {
  const n = normalizeText(text).trim();
  return GREETING.test(n) && extractAmountTokens(text).length === 0 && n.split(/\s+/).length <= 6;
}

export function isQuestion(text: string): boolean {
  const n = normalizeText(text).trim();
  const hasAmount = extractAmountTokens(text).length > 0;
  if (QUESTION_START.test(n)) return !(hasAmount && OPERATION_VERBS.test(n.split(/[?]/)[0]) && !/^(?:combien|quel|qui|quand|comment)/.test(n));
  if (n.includes('?')) return !(hasAmount && OPERATION_VERBS.test(n));
  return false;
}

// ---------- Dates ----------

const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDateHint(text: string, now: Date): string | undefined {
  const n = normalizeText(text);
  if (/avant-?hier/.test(n)) { const d = new Date(now); d.setDate(d.getDate() - 2); return fmt(d); }
  if (/\bhier\b/.test(n)) { const d = new Date(now); d.setDate(d.getDate() - 1); return fmt(d); }
  let m = n.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
    return fmt(new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
  }
  m = n.match(/\ble\s+(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?/);
  if (m) return fmt(new Date(m[3] ? parseInt(m[3], 10) : now.getFullYear(), MONTHS.indexOf(m[2]), parseInt(m[1], 10)));
  m = n.match(/\ble\s+(\d{1,2})[/.-](\d{1,2})\b/);
  if (m) return fmt(new Date(now.getFullYear(), parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
  return undefined;
}

// ---------- Découpage en opérations ----------

export function splitSegments(text: string): string[] {
  const pieces = text.split(/\s*(?:;|\n|,\s+|\s+puis\s+|\s+ensuite\s+|\s+et\s+)\s*/i).map(p => p.trim()).filter(Boolean);
  const segments: string[] = [];
  let buffer = '';
  for (const piece of pieces) {
    const norm = normalizeText(piece);
    const hasAmount = extractAmountTokens(piece).length > 0;
    const continuation = /^(?:reste|restant|solde|sur|dont|soit|avec|le reste)\b/.test(norm);
    if (!hasAmount || continuation) {
      if (segments.length > 0) segments[segments.length - 1] += ` ${piece}`;
      else buffer = buffer ? `${buffer} ${piece}` : piece;
    } else {
      segments.push(buffer ? `${buffer} ${piece}` : piece);
      buffer = '';
    }
  }
  if (buffer) segments.push(buffer);
  return segments.length ? segments : [text];
}

// ---------- Mots-clés ----------

const RE = {
  depreciation: /amortissement|dotation aux amortissements/,
  opening: /solde (?:d.?ouverture|initial|de depart)|report a nouveau|au depart|fonds de caisse|j.?avais (?:deja )?[^.]{0,30}(?:caisse|banque|compte)|il y avait/,
  ownerWithdrawal: /retrait (?:personnel|perso)|usage personnel|pour moi\b|\bperso\b|prelevement (?:perso|personnel|exploitant)|sans justificatif|besoins? personnels?|depense personnelle|pour ma famille/,
  transferVerb: /\b(?:retire|retrait|preleve|depose|depot|verse|versement|vers|approvisionne|approvisionnement|recharge|recharger|transfere|transfert)\b/,
  transferDeposit: /\b(?:depose|depot|verse|versement|approvisionne|approvisionnement|recharge|recharger)\b/,
  transferWithdraw: /\b(?:retire|retrait|preleve)\b/,
  loanReceived: /(?:pret|emprunt|credit) (?:recu|obtenu|bancaire|de la banque|accorde)|j.?ai emprunte|emprunte|deblocage (?:du )?(?:pret|credit)|pret de la banque/,
  loanRepayment: /rembours\w* .{0,30}(?:pret|emprunt|credit)|(?:echeance|mensualite) .{0,25}(?:pret|emprunt|credit)/,
  capital: /apport (?:en )?(?:capital|personnel|associe|exploitant|numeraire)|augmentation de capital|mise de fonds/,
  bankFee: /frais (?:bancaires?|de tenue|de retrait|de transfert|de virement|mobile money|de compte|de transaction)|agios|commission (?:bancaire|mobile money|de retrait|de transfert)|frais wave|frais orange/,
  commissionEarned: /(?:recu|encaisse|gagne|touche) .{0,25}commission|commission (?:recue|encaissee|sur vente)/,
  supplierPayment: /(?:regle|paye|reglement|rembourse|solde|versement)\b.{0,40}\bfournisseur|\bfournisseur\b.{0,40}\b(?:regle|paye|reglement|solde)/,
  customerPayment: /(?:client|cliente)\b.{0,40}\b(?:a paye|a regle|m.?a paye|m.?a verse|m.?a rembourse|a solde|regle|rembourse)|reglement (?:du |de la )?client|paiement (?:du |de la )?client|encaisse.{0,25}(?:creance|facture)|acompte (?:client|recu)|creance (?:encaissee|recouvree)|(?:m.?a|nous a) (?:paye|verse|regle) (?:sa|la|ses|les) (?:dette|facture|creance)/,
  salary: /salaire|\bpaie\b|paye (?:le |mes |les |mon )?(?:employes?|ouvriers?|gardien|vendeuse?|vendeurs?|personnel|apprentis?|caissiere?)|avance sur salaire|main d.?oeuvre|remuneration/,
  social: /cnps|cnss|ipres|cotisations? sociales?|charges sociales/,
  asset: /(?:achete|achat|acquis|acquisition|paye|payer)\b.{0,50}\b(?:ordinateur|laptop|imprimante|climatiseur|congelateur|frigo|refrigerateur|moto\b|camion|vehicule|voiture|tricycle|machine|generateur|groupe electrogene|etagere|mobilier|etal\b|caisse enregistreuse|telephone portable|smartphone|photocopieur|onduleur|balance)/,
  sale: /\bvendu|\bvente|\bvend\b|encaisse|recette|facture (?:client|emise)|prestation|le client a achete|j.?ai facture|\blivre\b.{0,20}client|chiffre d.affaires/,
  purchase: /achete|\bachat|approvisionn|\bstock\b|commande|reapprovisionn|marchandises?\b/,
  otherIncome: /\b(?:don|subvention|remboursement recu|indemnite|dividende|interet|interets|loyer recu|plus-value)\b/,
  credit: /a credit|\ba terme\b|non paye|pas encore paye|impaye|\bdette\b|reglera plus tard|reglement differe|facture en attente|sur facture|paiement differe/,
  service: /prestation|service|consult|reparation|coiffure|couture|formation|travaux|main d.?oeuvre|nettoyage|conseil|honoraires|location de|livraison facturee/,
  finished: /fabrique|confectionne|produit fini|pain|gateau|jus artisanal/,
  rawMaterial: /matieres? premieres?|intrants?|farine|tissu|bois|cacao|ingredients?|semences?|engrais/,
  noVat: /sans tva|exonere|non assujetti|hors taxe non|pas de tva/,
  invoicePresent: /facture|recu\b|ticket|bon de livraison|bordereau/,
};

interface NatureRule { re: RegExp; code: string; label: string; confidence: number }

const EXPENSE_NATURES: NatureRule[] = [
  { re: /electricite|\bcie\b|senelec|\beneo\b|sbee|cash power|woyofal|\bsonabel\b|\bnigelec\b|courant/, code: '6051', label: "Facture d'électricité", confidence: 95 },
  { re: /\beau\b|sodeci|\bsde\b|camwater|soneb|\bonea\b|\bsnde\b|facture d'eau/, code: '6052', label: "Facture d'eau", confidence: 95 },
  { re: /carburant|essence|gasoil|gazoil|gas-?oil|diesel|\bplein\b|totalenergies|total energies|\bshell\b|oilibya/, code: '6053', label: 'Carburant', confidence: 93 },
  { re: /transport|\btaxi\b|moto-?taxi|\bworo\b|gbaka|livraison|\bfret\b|manutention|peage|expedition|\bbus\b/, code: '6121', label: 'Frais de transport / livraison', confidence: 91 },
  { re: /loyer|\bbail\b|location (?:du |de la |d')?(?:boutique|magasin|local|depot|bureau)/, code: '6221', label: 'Loyer', confidence: 96 },
  { re: /entretien|reparation|reparer|maintenance|depannage|mecanicien|plombier|electricien|vidange/, code: '6241', label: 'Entretien et réparations', confidence: 90 },
  { re: /internet|forfait|credit (?:telephon|d.?appel|de communication)|recharge (?:telephon|credit)|airtime|wifi|canalbox|abonnement (?:telephone|internet|orange|mtn|moov)|facture (?:orange|mtn|moov)|telephone|telecom|\bappels?\b/, code: '6271', label: 'Télécommunications / Internet', confidence: 93 },
  { re: /fourniture|papeterie|emballage|sachets?|ramette|cartouche|nettoyage|produits? d'entretien/, code: '6581', label: 'Fournitures et frais divers', confidence: 82 },
];

const SERVICE_ACCOUNT = '7061';
const FINISHED_ACCOUNT = '7021';

// ---------- Extraction de détails ----------

const COUNTERPARTY_RE =
  /(?:chez|fournisseur|client|cliente|aupres de|de la part de|a|à|au|de|pour)\s+((?:M\.|Mme|Mr|Dr)?\s*\p{Lu}[\p{L}\d'&.-]*(?:\s+\p{Lu}[\p{L}'&.-]*){0,3})/u;

function extractCounterparty(seg: string): string | undefined {
  // On ne retient que les noms propres (majuscule) ; le premier mot de la phrase est ignoré.
  const m = seg.slice(1).match(COUNTERPARTY_RE);
  if (!m) return undefined;
  const name = m[1].trim();
  if (/^(?:Orange|MTN|Wave|Moov|Cash|Ecobank|Coris|CIE|SODECI|Senelec|Eneo|Mobile|Money)\b/i.test(name)) return undefined;
  return name.length > 2 ? name : undefined;
}

function extractGoods(seg: string, verbs: RegExp): string | undefined {
  const cleaned = seg.replace(/\s+/g, ' ').trim();
  const m = cleaned.match(verbs);
  if (!m || m.index === undefined) return undefined;
  const rest = cleaned.slice(m.index + m[0].length).trim();
  const goods = rest
    .split(/\s+(?:à|a|pour|payé|payée|paye|cash|par|via|chez|au prix|en|espèces|especes|à crédit|a credit|\d)/i)[0]
    .replace(/^(?:pour|de|d')\s*/i, '')
    .trim();
  if (!/[a-zA-Zéèêàçù]{3,}/.test(goods) || goods.length > 70) return undefined;
  if (/\b(?:francs?|fcfa|mille|million|cent|cash)\b/i.test(goods)) return undefined;
  return goods;
}

const ACCOUNT_SHORT: Record<PaymentMethod, string> = { cash: 'Caisse', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', wave: 'Wave', moov_money: 'Moov Money', bank_transfer: 'Banque', cheque: 'Banque' };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- Interprétation d'un segment ----------

export type SegmentResult = { op: ParsedOperation } | { missing: 'amount' | 'kind'; hint?: string };

export function parseSegment(seg: string, now: Date): SegmentResult {
  const norm = normalizeText(seg);
  const info = extractAmountInfo(seg);
  const mentions = detectAllPaymentMethods(seg);
  const primary = detectPaymentMethod(seg);
  const date = parseDateHint(seg, now);
  const counterparty = extractCounterparty(seg);
  const isCreditSale = RE.credit.test(norm);
  const vatApplicable = RE.noVat.test(norm) ? false : undefined;

  const base = (kind: OperationKind, label: string, confidence: number, extra: Partial<ParsedOperation> = {}): ParsedOperation => {
    const amount = info?.amount ?? 0;
    let settlement: ParsedOperation['settlement'] = 'paid';
    let paidAmount: number | undefined;
    if (info?.paid && info.paid < amount) { settlement = 'partial'; paidAmount = info.paid; }
    else if (isCreditSale && (kind === 'sale' || kind === 'purchase' || kind === 'expense' || kind === 'asset_purchase')) settlement = 'credit';
    return {
      kind, amount, paymentMethod: primary, settlement, paidAmount, vatApplicable, counterparty, label,
      confidence, date, sourceText: seg, ...extra,
    };
  };

  const needAmount = (hint: string): SegmentResult => ({ missing: 'amount', hint });
  const fromToPair = (): { from?: PaymentMethod; to?: PaymentMethod } => {
    const methods = mentions.map(m => m.method);
    const distinct = methods.filter((m, i) => methods.indexOf(m) === i);
    const vers = norm.search(/\bvers\b|\bsur (?:le |mon |ma )?(?:compte|caisse)|\ba destination\b/);
    if (distinct.length >= 2) {
      // "de la banque vers la caisse" : source avant "vers", destination après ; sinon ordre d'apparition
      if (vers >= 0) {
        const before = mentions.filter(m => m.index < vers);
        const after = mentions.filter(m => m.index >= vers);
        if (before.length && after.length) return { from: before[before.length - 1].method, to: after[0].method };
      }
      return { from: distinct[0], to: distinct[1] };
    }
    if (distinct.length === 1) {
      const m = distinct[0];
      if (m === 'cash') return {};
      if (RE.transferWithdraw.test(norm)) return { from: m, to: 'cash' };
      if (RE.transferDeposit.test(norm)) return { from: 'cash', to: m };
    }
    return {};
  };

  // 1. Amortissement
  if (RE.depreciation.test(norm)) {
    if (!info) return needAmount("l'amortissement à constater");
    const assetCode = /moto|camion|vehicule|voiture|tricycle/.test(norm) ? '215'
      : /machine|outillage|generateur|groupe electrogene|congelateur/.test(norm) ? '241'
      : /etagere|mobilier|etal|table|chaise/.test(norm) ? '245' : '244';
    return { op: base('depreciation', `Dotation aux amortissements – ${cap(extractGoods(seg, /amortissement (?:de |du |d'|des |sur )?(?:l'|la |le |les )?/) ?? 'matériel')}`, 88, { natureAccountCode: assetCode, paymentMethod: undefined }) };
  }

  // 2. Solde d'ouverture
  if (RE.opening.test(norm)) {
    if (!info) return needAmount("le solde d'ouverture");
    return { op: base('opening_balance', `Solde d'ouverture – ${PAYMENT_METHOD_LABEL[primary ?? 'cash']}`, 85) };
  }

  // 3. Prélèvement personnel
  if (RE.ownerWithdrawal.test(norm) && !RE.customerPayment.test(norm)) {
    if (!info) return needAmount('le retrait');
    return { op: base('owner_withdrawal', 'Retrait de fonds sans affectation professionnelle', 55, {
      natureAccountCode: '4711',
      anomaly: 'Retrait de fonds sans motif d’affectation professionnelle : risque de confusion de patrimoine.',
    }) };
  }

  // 4. Virement interne (retrait banque → caisse, dépôt caisse → banque, recharge Mobile Money…)
  if (RE.transferVerb.test(norm) && mentions.length > 0 && !RE.salary.test(norm) && !RE.supplierPayment.test(norm) && !RE.customerPayment.test(norm) && !RE.sale.test(norm) && !RE.purchase.test(norm)) {
    const { from, to } = fromToPair();
    if (from && to && from !== to) {
      if (!info) return needAmount('le transfert');
      return { op: base('transfer', `Transfert de fonds : ${ACCOUNT_SHORT[from]} → ${ACCOUNT_SHORT[to]}`, 93, { paymentMethod: from, toMethod: to, settlement: 'paid' }) };
    }
  }
  // "retrait espèces 350 000F" sans source ni motif → prélèvement à justifier
  if (/\bretrait\b|\bretire\b/.test(norm) && (!primary || primary === 'cash') && !RE.purchase.test(norm) && !RE.salary.test(norm) && !/fournisseur/.test(norm)) {
    if (!info) return needAmount('le retrait');
    return { op: base('owner_withdrawal', 'Retrait d’espèces sans justificatif précis', 50, {
      natureAccountCode: '4711',
      anomaly: 'Retrait de fonds sans motif d’affectation professionnelle : risque de confusion de patrimoine.',
    }) };
  }

  // 5. Financement
  if (RE.loanRepayment.test(norm)) {
    if (!info) return needAmount("l'échéance remboursée");
    return { op: base('loan_repayment', 'Remboursement d’emprunt', 88) };
  }
  if (RE.loanReceived.test(norm)) {
    if (!info) return needAmount('le montant du prêt');
    return { op: base('loan_received', `Emprunt reçu${counterparty ? ` – ${counterparty}` : ''}`, 88) };
  }
  if (RE.capital.test(norm)) {
    if (!info) return needAmount("l'apport");
    return { op: base('capital_contribution', 'Apport en capital', 86) };
  }

  // 6. Frais bancaires / Mobile Money
  if (RE.bankFee.test(norm) && !RE.commissionEarned.test(norm)) {
    if (!info) return needAmount('les frais');
    return { op: base('bank_fee', `Frais bancaires / Mobile Money${primary ? ` (${PAYMENT_METHOD_LABEL[primary]})` : ''}`, 92) };
  }
  if (RE.commissionEarned.test(norm)) {
    if (!info) return needAmount('la commission');
    return { op: base('other_income', 'Commission reçue', 88, { natureAccountCode: '7071' }) };
  }

  // 7. Règlements de tiers
  if (RE.supplierPayment.test(norm) && !/\bachete\b|\bachat\b/.test(norm)) {
    if (!info) return needAmount('le règlement');
    return { op: base('supplier_payment', `Règlement fournisseur${counterparty ? ` ${counterparty}` : ''}`, 88, { settlement: 'paid' }) };
  }
  if (RE.customerPayment.test(norm) && !/\bvendu\b/.test(norm)) {
    if (!info) return needAmount('le règlement');
    return { op: base('customer_payment', `Règlement client${counterparty ? ` ${counterparty}` : ''}`, 88, { settlement: 'paid' }) };
  }

  // 8. Personnel
  if (RE.social.test(norm)) {
    if (!info) return needAmount('les cotisations');
    return { op: base('expense', 'Cotisations sociales', 93, { natureAccountCode: '6451', vatApplicable: false }) };
  }
  if (RE.salary.test(norm)) {
    if (!info) return needAmount('le salaire');
    return { op: base('expense', `Salaires${counterparty ? ` – ${counterparty}` : ''}`, 93, { natureAccountCode: '6411', vatApplicable: false }) };
  }

  // 9. Immobilisation
  if (RE.asset.test(norm)) {
    if (!info) return needAmount("le prix de l'équipement");
    const code = /moto\b|camion|vehicule|voiture|tricycle/.test(norm) ? '215'
      : /machine|generateur|groupe electrogene|congelateur|frigo|refrigerateur|balance/.test(norm) ? '241'
      : /etagere|mobilier|etal\b/.test(norm) ? '245' : '244';
    const goods = extractGoods(seg, /(?:achete|achat|acquis|acquisition|paye|payer)\s+(?:d'|de |du |des |un |une |le |la |l')?/i);
    return { op: base('asset_purchase', `Acquisition ${goods ? cap(goods) : 'd’immobilisation'}`, 88, { natureAccountCode: code }) };
  }

  // 10. Charges courantes identifiées par mot-clé
  const isSaleWord = RE.sale.test(norm);
  if (!isSaleWord) {
    for (const rule of EXPENSE_NATURES) {
      if (rule.re.test(norm)) {
        if (!info) return needAmount(rule.label.toLowerCase());
        const needsReceipt = rule.code === '6121' && primary === 'cash' && !RE.invoicePresent.test(norm);
        return { op: base('expense', rule.label, needsReceipt ? 76 : rule.confidence, { natureAccountCode: rule.code }) };
      }
    }
  }

  // 11. Ventes
  if (isSaleWord) {
    if (!info) return needAmount('la vente');
    const isService = RE.service.test(norm);
    const isFinished = RE.finished.test(norm);
    const goods = extractGoods(seg, /(?:vendu|vend|vente d[eu']?s?|facture|livre)\s+(?:d'|de |du |des |la |le |les |l')?/i);
    const label = isService ? `Prestation${goods ? ` : ${goods}` : ''}` : `Vente${goods ? ` de ${goods}` : ''}`;
    return { op: base('sale', `${label}${counterparty ? ` – ${counterparty}` : ''}`, 94, {
      natureAccountCode: isService ? SERVICE_ACCOUNT : isFinished ? FINISHED_ACCOUNT : '7011',
    }) };
  }

  // 12. Achats de marchandises
  if (RE.purchase.test(norm) || /\bachete\b/.test(norm)) {
    if (!info) return needAmount("l'achat");
    const goods = extractGoods(seg, /(?:achete|achat|acheter|commande|approvisionnement)\s+(?:d'|de |du |des |la |le |les |l')?/i);
    return { op: base('purchase', `Achat${goods ? ` de ${goods}` : ' de marchandises'}${counterparty ? ` – ${counterparty}` : ''}`, 90, {
      natureAccountCode: RE.rawMaterial.test(norm) ? '6021' : '6011',
    }) };
  }

  if (RE.otherIncome.test(norm)) {
    if (!info) return needAmount('le montant reçu');
    return { op: base('other_income', 'Produit accessoire', 80, { natureAccountCode: /subvention|don\b/.test(norm) ? '8511' : '7071' }) };
  }

  // 13. Verbes génériques : direction connue, nature inconnue → vérification humaine
  if (/\b(?:paye|payee|regle|depense|decaisse|sorti|sortie|debourse|reglement)\b/.test(norm)) {
    if (!info) return needAmount('la dépense');
    return { op: base('expense', 'Dépense diverse à qualifier', 62, { natureAccountCode: '6581' }) };
  }
  if (/\b(?:recu|encaisse|rentre|rentree|entree|touche|gagne)\b/.test(norm)) {
    if (!info) return needAmount("l'encaissement");
    return { op: base('sale', 'Encaissement à qualifier', 65, { natureAccountCode: '7011' }) };
  }

  return { missing: 'kind' };
}

// ---------- SMS Mobile Money ----------

function detectProvider(norm: string): PaymentMethod | undefined {
  if (/orange/.test(norm)) return 'orange_money';
  if (/\bmtn\b|momo/.test(norm)) return 'mtn_momo';
  if (/\bwave\b/.test(norm)) return 'wave';
  if (/\bmoov\b|flooz/.test(norm)) return 'moov_money';
  return undefined;
}

export function looksLikeMobileMoneySms(text: string): boolean {
  const n = normalizeText(text);
  return !!detectProvider(n) && /solde|transaction|\bid\b|ref|vous avez (?:recu|envoye|paye|retire)|you have|frais|balance/.test(n) && extractAmountTokens(text).length > 0;
}

export function parseMobileMoneySms(sms: string, now: Date): ParsedOperation[] {
  const norm = normalizeText(sms);
  const provider = detectProvider(norm) ?? detectPaymentMethod(sms);
  const tokens = extractAmountTokens(sms);
  const before = (idx: number) => norm.slice(Math.max(0, idx - 22), idx);

  let amount: number | undefined;
  let fee = 0;
  for (const t of tokens) {
    const ctx = before(t.index);
    if (/(?:solde|balance)[^0-9]{0,18}$/.test(ctx)) continue;
    if (/(?:frais|fee|commission|taxe)[^0-9]{0,12}$/.test(ctx)) { fee += t.value; continue; }
    if (amount === undefined) amount = t.value;
  }
  if (!amount) return [];

  const refMatch = sms.match(/(?:id|ref|r[ée]f[ée]rence|trans(?:action)?(?:\s*id)?)\s*[:#]?\s*([A-Z0-9][A-Z0-9._-]{5,})/i);
  const pieceRef = refMatch?.[1];
  const nameMatch = sms.match(/(?:de|from|a|à|to|au)\s+((?:[A-ZÉÈ][A-Za-zÀ-ÿ'-]+)(?:\s+[A-ZÉÈ][A-Za-zÀ-ÿ'-]+){0,2})/);
  const counterparty = nameMatch?.[1];

  const received = /vous avez recu|you have received|recu de|depot de|credite|paiement recu|reception/.test(norm);
  const withdrawal = /retrait|withdraw/.test(norm);
  const airtime = /achat de (?:credit|forfait)|forfait|airtime|recharge (?:telephon|de credit)/.test(norm);
  const date = parseDateHint(sms, now);

  const common = { paymentMethod: provider, settlement: 'paid' as const, counterparty, date, pieceRef, sourceText: sms, fee: fee || undefined };
  const ops: ParsedOperation[] = [];

  if (withdrawal && !received) {
    ops.push({ kind: 'transfer', amount, ...common, toMethod: 'cash', label: `Retrait Mobile Money → caisse (${PAYMENT_METHOD_LABEL[provider ?? 'orange_money']})`, confidence: 92 });
  } else if (received) {
    ops.push({ kind: 'sale', amount, ...common, natureAccountCode: '7011', label: `Encaissement ${PAYMENT_METHOD_LABEL[provider ?? 'orange_money']}${counterparty ? ` de ${counterparty}` : ''}`, confidence: 82,
      explanation: undefined });
  } else if (airtime) {
    ops.push({ kind: 'expense', amount, ...common, natureAccountCode: '6271', label: `Achat crédit / forfait (${PAYMENT_METHOD_LABEL[provider ?? 'orange_money']})`, confidence: 92 });
  } else {
    ops.push({ kind: 'expense', amount, ...common, natureAccountCode: '6011', label: `Paiement Mobile Money${counterparty ? ` à ${counterparty}` : ''}`, confidence: 72 });
  }
  if (fee > 0) {
    ops.push({ kind: 'bank_fee', amount: fee, paymentMethod: provider, settlement: 'paid', label: `Frais ${PAYMENT_METHOD_LABEL[provider ?? 'orange_money']}`, confidence: 95, date, pieceRef, sourceText: sms });
  }
  return ops;
}

// ---------- Point d'entrée ----------

export function parseWithHeuristics(text: string, inputType: string, now: Date): ParseOutcome {
  if (inputType === 'mobile_money' || looksLikeMobileMoneySms(text)) {
    const ops = parseMobileMoneySms(text, now);
    if (ops.length) return { intent: 'operation', operations: ops };
    return { intent: 'clarification', operations: [], clarification: "Je n'ai pas trouvé le montant dans ce SMS. Pouvez-vous coller le message complet (avec le montant en FCFA) ?" };
  }

  const segments = splitSegments(text);
  const operations: ParsedOperation[] = [];
  const missing: { hint?: string; missing: 'amount' | 'kind' }[] = [];
  for (const seg of segments) {
    const r = parseSegment(seg, now);
    if ('op' in r) operations.push(r.op);
    else missing.push(r);
  }

  if (operations.length > 0) {
    // Un segment isolé sans montant ne bloque pas les autres, mais on le signale.
    const note = missing.length ? ` (une partie de votre message n'a pas pu être comprise : précisez-la si besoin)` : '';
    return { intent: 'operation', operations, reply: note || undefined };
  }
  const first = missing[0];
  if (first?.missing === 'amount') {
    return { intent: 'clarification', operations: [], clarification: `J'ai bien compris l'opération (${first.hint}), mais je ne trouve pas le montant. Quel est le montant en FCFA ?` };
  }
  return {
    intent: 'clarification',
    operations: [],
    clarification: "Je n'ai pas compris s'il s'agit d'une vente, d'un achat, d'un paiement ou d'un transfert. Pouvez-vous préciser, avec le montant ? Exemple : « J'ai vendu 3 sacs de ciment à 5000 F, payé en espèces ».",
  };
}

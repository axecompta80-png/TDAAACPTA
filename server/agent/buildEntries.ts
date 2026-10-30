import { randomUUID } from 'crypto';
import type { AuditLog, InputMode, JournalEntry, PaymentMethod } from '../../src/types';
import { SYSCOHADA_ACCOUNTS } from '../../src/data/syscohadaPlan';
import {
  isTreasuryCode,
  normalizeText,
  PAYMENT_METHOD_VIA,
  PAYMENT_METHOD_WALLET,
  treasuryAccountFor,
} from '../../src/utils/paymentAccounts';
import { formatFcfa } from '../../src/utils/amounts';
import { simpleLines, defaultJournal, debitCodes, creditCodes } from '../../src/utils/entryLines';
import type { AgentRequestContext, OperationKind, ParsedOperation } from './types';

/**
 * Transforme des opérations comprises (par Gemini ou par le moteur de règles) en écritures
 * SYSCOHADA en partie double. Règle centrale : le compte de TRÉSORERIE découle uniquement du
 * mode de paiement (espèces → 5711, chèque/virement → 5211, Orange Money → 5261, MTN → 5262,
 * Wave → 5263, Moov → 5264). L'IA ne choisit que la nature de l'opération.
 */

interface Line {
  debit: string;
  credit: string;
  amount: number;
  method: PaymentMethod;
  suffix?: string;
}

const accountByCode = new Map(SYSCOHADA_ACCOUNTS.map(a => [a.code, a]));


export const isKnownAccount = (code: string | undefined): code is string => !!code && accountByCode.has(code);

const codeOf = (setting: string | undefined) => (setting ?? '').split(' - ')[0].trim();

const VATABLE_PREFIXES = ['701', '702', '706', '707', '601', '602', '6051', '6052', '6053', '6121', '6241', '6271', '6581', '215', '241', '244', '245'];
const VAT_KINDS: OperationKind[] = ['sale', 'purchase', 'expense', 'asset_purchase'];
const DEPRECIATION_ACCOUNT: Record<string, string> = { '215': '2815', '241': '2841', '244': '2844', '245': '2845' };

const STOPWORDS = new Set(['pour', 'avec', 'dans', 'chez', 'paye', 'payee', 'cash', 'vendu', 'achete', 'sacs', 'facture', 'fcfa', 'francs', 'mobile', 'money', 'orange', 'wave', 'moov', 'especes', 'virement']);

function tokens(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

function overlap(a: Set<string>, b: Set<string>): { shared: number; jaccard: number } {
  let shared = 0;
  a.forEach(t => { if (b.has(t)) shared++; });
  const union = a.size + b.size - shared;
  return { shared, jaccard: union ? shared / union : 0 };
}

function dayDiff(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

/** L'expert a déjà corrigé une opération semblable dans ce dossier : on reprend son compte. */
function findPrecedent(op: ParsedOperation, ctx: AgentRequestContext) {
  const wanted = tokens(`${op.label} ${op.counterparty ?? ''} ${op.sourceText}`);
  if (wanted.size === 0) return undefined;
  let best: { entry: JournalEntry; nature: string; score: number } | undefined;

  for (const e of ctx.entries) {
    if (e.clientDossierId !== ctx.dossier.id) continue;
    if (!e.auditTrail.some(a => a.action === 'edited_by_expert')) continue;
    const nature = e.lines.map(l => l.accountCode).find(c => !isTreasuryCode(c) && /^[2367]/.test(c));
    if (!nature) continue;
    const sameDirection =
      op.kind === 'sale' || op.kind === 'other_income' ? nature.startsWith('7')
      : op.kind === 'purchase' || op.kind === 'expense' ? /^[63]/.test(nature)
      : op.kind === 'asset_purchase' ? nature.startsWith('2')
      : false;
    if (!sameDirection) continue;
    const { shared, jaccard } = overlap(wanted, tokens(`${e.label} ${e.rawInput}`));
    if (shared >= 2 && jaccard >= 0.5 && (!best || jaccard > best.score)) best = { entry: e, nature, score: jaccard };
  }
  return best;
}

function findDuplicate(line: Line, op: ParsedOperation, date: string, ctx: AgentRequestContext): JournalEntry | undefined {
  const wanted = tokens(`${op.label} ${op.sourceText}`);
  return ctx.entries.find(e => {
    if (e.clientDossierId !== ctx.dossier.id) return false;
    if (e.amount !== line.amount || !debitCodes(e).includes(line.debit) || !creditCodes(e).includes(line.credit)) return false;
    if (dayDiff(e.date, date) > 2) return false;
    if (op.pieceRef && e.pieceRef === op.pieceRef) return true;
    if (e.rawInput.trim().toLowerCase() === op.sourceText.trim().toLowerCase()) return true;
    const { jaccard } = overlap(wanted, tokens(`${e.label} ${e.rawInput}`));
    return jaccard >= 0.5;
  });
}

function defaultMethod(kind: OperationKind): PaymentMethod {
  return kind === 'bank_fee' || kind === 'loan_received' || kind === 'loan_repayment' ? 'bank_transfer' : 'cash';
}

function explain(op: ParsedOperation, m: PaymentMethod, amount: number, paid: number | undefined, assumed: boolean): string {
  const A = `${formatFcfa(amount)} FCFA`;
  const via = PAYMENT_METHOD_VIA[m];
  const wallet = PAYMENT_METHOD_WALLET[m];
  const to = op.toMethod;
  let text: string;

  switch (op.kind) {
    case 'sale':
      text = op.settlement === 'credit'
        ? `Vente à crédit de ${A} : le client vous doit cette somme (créance client). Rien n'est encaissé pour le moment.`
        : op.settlement === 'partial'
          ? `Vente de ${A} : ${formatFcfa(paid ?? 0)} FCFA encaissés ${via}, il reste ${formatFcfa(amount - (paid ?? 0))} FCFA à recevoir du client.`
          : `Vente de ${A} encaissée ${via}. Votre ${wallet} augmente.`;
      break;
    case 'purchase':
      text = op.settlement === 'credit'
        ? `Achat de ${A} à crédit : vous devez cette somme à votre fournisseur. Votre trésorerie ne bouge pas.`
        : op.settlement === 'partial'
          ? `Achat de ${A} : ${formatFcfa(paid ?? 0)} FCFA payés ${via}, il reste ${formatFcfa(amount - (paid ?? 0))} FCFA à payer au fournisseur.`
          : `Achat de marchandises de ${A} payé ${via}. Votre ${wallet} diminue et le stock acheté est enregistré en charge.`;
      break;
    case 'expense':
      text = op.settlement === 'credit'
        ? `${op.label} de ${A} à payer plus tard : c'est une dette envers le fournisseur, enregistrée en charge.`
        : `${op.label} de ${A} payé ${via}. Votre ${wallet} diminue et la dépense est enregistrée en charges.`;
      break;
    case 'asset_purchase':
      text = `Équipement de ${A} payé ${via}. C'est un investissement : il est inscrit à l'actif de l'entreprise et non en charge.`;
      break;
    case 'customer_payment':
      text = `Votre client vous a réglé ${A} ${via}. Sa dette diminue et votre ${wallet} augmente.`;
      break;
    case 'supplier_payment':
      text = `Vous avez réglé ${A} à votre fournisseur ${via}. Votre dette diminue et votre ${wallet} baisse.`;
      break;
    case 'transfer':
      text = `Vous avez déplacé ${A} de votre ${wallet} vers votre ${PAYMENT_METHOD_WALLET[to ?? 'cash']}. Votre trésorerie totale ne change pas.`;
      break;
    case 'owner_withdrawal':
      text = `Retrait de ${A} sans justificatif : il faut préciser si c'est une dépense de l'entreprise ou un prélèvement personnel. Mis en attente de vérification.`;
      break;
    case 'loan_received':
      text = `Emprunt de ${A} reçu ${via} : votre ${wallet} augmente, mais vous avez une dette à rembourser à la banque.`;
      break;
    case 'loan_repayment':
      text = `Remboursement d'emprunt de ${A} payé ${via}. Votre dette envers la banque diminue.`;
      break;
    case 'capital_contribution':
      text = `Apport de ${A} versé ${via} dans l'entreprise. Votre ${wallet} augmente.`;
      break;
    case 'opening_balance':
      text = `Solde de départ enregistré : ${A} dans votre ${wallet}.`;
      break;
    case 'bank_fee':
      text = `Frais de ${A} prélevés sur votre ${wallet}, enregistrés en charges.`;
      break;
    case 'other_income':
      text = `Encaissement de ${A} (${op.label.toLowerCase()}) ${via}. Votre ${wallet} augmente.`;
      break;
    case 'depreciation':
      text = `Amortissement de ${A} : constate la perte de valeur du matériel sur la période (charge sans sortie d'argent).`;
      break;
    default:
      text = `Opération de ${A} enregistrée.`;
  }
  return assumed ? `${text} (Mode de paiement non précisé : espèces supposé — corrigez-moi si besoin.)` : text;
}

interface BuildOptions {
  ctx: AgentRequestContext;
  rawInput: string;
  inputType: InputMode;
  source: string;
}

export function buildEntries(ops: ParsedOperation[], { ctx, rawInput, inputType, source }: BuildOptions): JournalEntry[] {
  const { dossier, settings, now } = ctx;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const rate = settings.defaultVatRate;
  const noVatRegime = dossier.regimeFiscal === 'Synthétique / Forfait';
  const out: JournalEntry[] = [];

  for (const op of ops) {
    if (!(op.amount > 0)) continue;
    const assumed = !op.paymentMethod && op.settlement !== 'credit' && !['depreciation', 'transfer'].includes(op.kind);
    const method = op.paymentMethod ?? defaultMethod(op.kind);
    const treasuryCode = (m: PaymentMethod) => {
      // Réglage "compte de caisse par défaut" respecté pour les espèces uniquement
      const custom = codeOf(settings.defaultDebitCashAccount);
      return m === 'cash' && isTreasuryCode(custom) && custom.startsWith('57') ? custom : treasuryAccountFor(m).code;
    };
    const T = treasuryCode(method);

    // Reprise d'une correction passée de l'expert pour la même nature d'opération
    let nature = isKnownAccount(op.natureAccountCode) ? op.natureAccountCode : undefined;
    let precedentNote: string | undefined;
    const precedent = findPrecedent(op, ctx);
    if (precedent && precedent.nature !== nature) {
      nature = precedent.nature;
      precedentNote = `Compte ${nature} repris de la correction de l'expert sur l'écriture ${precedent.entry.pieceRef}.`;
    }

    const salesDefault = codeOf(settings.defaultCreditSalesAccount);
    const expenseFallback = '6581';
    const lines: Line[] = [];
    const paid = op.settlement === 'partial' ? Math.min(op.paidAmount ?? 0, op.amount) : undefined;

    // creditNature : compte utilisé pour la part non encaissée d'une vente (7011 comptant → 7012 à crédit)
    const settle = (natureCode: string, side: 'in' | 'out', deferredNature: string = natureCode) => {
      const tiers = side === 'in' ? '4111' : (natureCode.startsWith('641') ? '4211' : natureCode.startsWith('645') ? '4311' : '4011');
      const line = (amount: number, useTiers: boolean, n: string): Line =>
        side === 'in'
          ? { debit: useTiers ? '4111' : T, credit: n, amount, method }
          : { debit: n, credit: useTiers ? tiers : T, amount, method };
      if (op.settlement === 'credit') lines.push(line(op.amount, true, deferredNature));
      else if (op.settlement === 'partial' && paid && paid < op.amount) {
        lines.push({ ...line(paid, false, natureCode), suffix: ' (acompte)' });
        lines.push({ ...line(op.amount - paid, true, deferredNature), suffix: ' (reste à régler)' });
      } else lines.push(line(op.amount, false, natureCode));
    };

    switch (op.kind) {
      case 'sale': {
        const n = nature && nature.startsWith('7') ? nature : (isKnownAccount(salesDefault) && salesDefault.startsWith('7') ? salesDefault : '7011');
        settle(n, 'in', n === '7011' ? '7012' : n);
        break;
      }
      case 'other_income':
        lines.push({ debit: T, credit: nature && /^[78]/.test(nature) ? nature : '7071', amount: op.amount, method });
        break;
      case 'purchase':
        settle(nature && /^[63]/.test(nature) ? nature : '6011', 'out');
        break;
      case 'expense':
        settle(nature && /^[63]/.test(nature) ? nature : expenseFallback, 'out');
        break;
      case 'asset_purchase':
        settle(nature && nature.startsWith('2') ? nature : '244', 'out');
        break;
      case 'customer_payment':
        lines.push({ debit: T, credit: '4111', amount: op.amount, method });
        break;
      case 'supplier_payment':
        lines.push({ debit: '4011', credit: T, amount: op.amount, method });
        break;
      case 'transfer': {
        const to = op.toMethod ?? 'cash';
        if (treasuryCode(to) === T) continue; // même compte des deux côtés : rien à comptabiliser
        lines.push({ debit: treasuryCode(to), credit: T, amount: op.amount, method });
        break;
      }
      case 'owner_withdrawal':
        lines.push({ debit: '4711', credit: T, amount: op.amount, method });
        break;
      case 'loan_received':
        lines.push({ debit: T, credit: '162', amount: op.amount, method });
        break;
      case 'loan_repayment':
        lines.push({ debit: '162', credit: T, amount: op.amount, method });
        break;
      case 'capital_contribution':
      case 'opening_balance':
        lines.push({ debit: T, credit: '101', amount: op.amount, method });
        break;
      case 'bank_fee':
        lines.push({ debit: '6311', credit: T, amount: op.amount, method });
        break;
      case 'depreciation': {
        const asset = nature && DEPRECIATION_ACCOUNT[nature] ? nature : '244';
        lines.push({ debit: '6811', credit: DEPRECIATION_ACCOUNT[asset], amount: op.amount, method: 'bank_transfer' });
        break;
      }
    }

    const date = op.date ?? today;
    lines.forEach((line, idx) => {
      const natureCode = [line.debit, line.credit].find(c => /^[2367]/.test(c) && !isTreasuryCode(c)) ?? '';
      const vatable =
        op.vatApplicable ??
        (!noVatRegime && VAT_KINDS.includes(op.kind) && VATABLE_PREFIXES.some(p => natureCode.startsWith(p)));
      const tvaAmount = op.vatAmount !== undefined && lines.length === 1
        ? Math.min(Math.max(0, Math.round(op.vatAmount)), line.amount)
        : vatable ? Math.round((line.amount * rate) / (100 + rate)) : 0;

      let anomaly = op.anomaly;
      const cashSide = [line.debit, line.credit].some(c => c === '5711' || c === '5721') && line.method === 'cash';
      const flaggable = !['transfer', 'opening_balance', 'capital_contribution', 'loan_received', 'loan_repayment', 'owner_withdrawal', 'depreciation'].includes(op.kind);

      if (!anomaly && cashSide && flaggable && settings.autoFlagLargeCashPayments && line.amount >= settings.cashDeductibilityThreshold) {
        const inflow = isTreasuryCode(line.debit);
        anomaly = inflow
          ? `Encaissement en espèces de ${formatFcfa(line.amount)} FCFA (≥ seuil de ${formatFcfa(settings.cashDeductibilityThreshold)} FCFA) : renforcer la traçabilité et le justificatif client.`
          : `Paiement en espèces de ${formatFcfa(line.amount)} FCFA (≥ seuil de ${formatFcfa(settings.cashDeductibilityThreshold)} FCFA) : charge susceptible d'être rejetée fiscalement.`;
      }
      if (!anomaly && date > today) {
        anomaly = `Date postérieure à aujourd'hui (${date}) : vérifier la date de l'opération.`;
      }
      if (settings.duplicateDetection) {
        const dup = findDuplicate(line, op, date, ctx);
        if (dup) {
          anomaly = `Doublon possible avec l'écriture ${dup.pieceRef} du ${dup.date} (même montant, mêmes comptes).`;
        }
      }

      // L'IA propose : la validation se décide à l'enregistrement (autoValidates, server/routes/entries.ts).
      const status: JournalEntry['status'] = anomaly ? 'anomaly' : 'pending_review';
      const action: AuditLog['action'] = anomaly ? 'anomaly_flagged' : 'created_by_ai';
      const ref = op.pieceRef ?? `OP-${Math.floor(1000 + Math.random() * 9000)}`;
      const explanation = explain(op, line.method, op.amount, paid, assumed);
      const entryLines = simpleLines(line.debit, line.credit, line.amount, tvaAmount);

      out.push({
        id: `entry-${randomUUID()}`,
        clientDossierId: dossier.id,
        date,
        label: `${op.label}${line.suffix ?? ''}`.slice(0, 160),
        pieceRef: idx === 0 ? ref : `${ref}-${String.fromCharCode(65 + idx)}`,
        journal: defaultJournal(entryLines),
        lines: entryLines.map(l => ({ ...l, accountLabel: accountByCode.get(l.accountCode)?.label })),
        amount: line.amount,
        status,
        detectedAnomaly: anomaly,
        rawInput,
        inputType,
        explanationSimplified: explanation,
        paymentMethod: line.method,
        auditTrail: [{
          id: `aud-${randomUUID()}`,
          timestamp: new Date().toISOString(),
          action,
          author: 'Agent AxeCompta (IA Syscohada)',
          notes: [anomaly, precedentNote, `Attribué via ${source}`].filter(Boolean).join(' • '),
        }],
      });
    });
  }
  return out;
}

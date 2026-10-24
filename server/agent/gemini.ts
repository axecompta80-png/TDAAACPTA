import { GoogleGenAI, Type } from '@google/genai';
import type { PaymentMethod, PlatformSettings, ClientDossier } from '../../src/types';
import { SYSCOHADA_ACCOUNTS } from '../../src/data/syscohadaPlan';
import { detectAllPaymentMethods, detectPaymentMethod, isTreasuryCode } from '../../src/utils/paymentAccounts';
import type { AgentContext } from '../../src/utils/analytics';
import { isKnownAccount } from './buildEntries';
import { parseWithHeuristics } from './heuristic';
import type { OperationKind, ParseOutcome, ParsedOperation } from './types';

let client: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return client;
}

/**
 * Les réglages de la plateforme stockent un choix de "famille" (rapide / économique) ; le nom de
 * modèle réellement appelé est résolu ici. Les versions figées de Google sont retirées (gemini-2.5-flash
 * renvoie déjà 404) : on essaie donc plusieurs candidats dans l'ordre (modèle rapide, puis alias
 * "-latest"). Surcharge possible par GEMINI_MODEL / GEMINI_MODEL_LITE.
 */
export function modelCandidates(settings: PlatformSettings): string[] {
  if (settings.aiModelPreference === 'heuristic-fast') return [];
  const primary = settings.aiModelPreference === 'gemini-2.5-flash-lite'
    ? process.env.GEMINI_MODEL_LITE || 'gemini-flash-lite-latest'
    : process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  return Array.from(new Set([primary, 'gemini-flash-latest', 'gemini-flash-lite-latest']));
}

// Erreurs pour lesquelles un autre modèle a des chances de répondre (retiré, surchargé, quota)
const RETRYABLE_MODEL_ERROR = /404|NOT_FOUND|no longer available|503|UNAVAILABLE|high demand|429|RESOURCE_EXHAUSTED/i;

/** Premier modèle candidat (utilisé pour l'affichage de la source) ; null = moteur de règles uniquement. */
export function modelFromSettings(settings: PlatformSettings): string | null {
  return modelCandidates(settings)[0] ?? null;
}

const KINDS: OperationKind[] = [
  'sale', 'purchase', 'expense', 'asset_purchase', 'customer_payment', 'supplier_payment', 'owner_withdrawal',
  'transfer', 'loan_received', 'loan_repayment', 'capital_contribution', 'opening_balance', 'bank_fee', 'other_income', 'depreciation',
];
const METHODS: PaymentMethod[] = ['cash', 'orange_money', 'mtn_momo', 'wave', 'moov_money', 'bank_transfer', 'cheque'];

const NATURE_ACCOUNTS = SYSCOHADA_ACCOUNTS.filter(a => !isTreasuryCode(a.code))
  .map(a => `${a.code}=${a.label}`)
  .join(' ; ');

function buildPrompt(text: string, hasDocument: boolean, dossier: ClientDossier, settings: PlatformSettings, analytics: AgentContext): string {
  return `Tu es AxeCompta, l'agent comptable IA de la zone OHADA (référentiel SYSCOHADA) pour un entrepreneur ou un cabinet francophone d'Afrique.
Entreprise : activité « ${dossier.activity} », pays ${dossier.country}, régime ${dossier.regimeFiscal}, devise FCFA. Taux de TVA par défaut : ${settings.defaultVatRate} %.
Date du jour : ${analytics.date}.

TU DOIS CLASSER LE MESSAGE (ou le document joint) dans UNE intention :
- "operation" : l'utilisateur raconte une ou plusieurs opérations à enregistrer (vente, achat, dépense, paiement, encaissement, transfert…). Découpe en une opération par transaction distincte.
- "question" : il pose une question sur ses chiffres, sa trésorerie, la fiscalité, un crédit, ou demande une explication comptable. Réponds dans "reply", en français simple, 2 à 4 phrases, UNIQUEMENT avec les chiffres du JSON « DONNÉES DU DOSSIER » ci-dessous (n'invente jamais un chiffre ; si l'information manque, dis-le).
- "clarification" : une information indispensable manque (montant, sens de l'opération). Pose UNE question courte dans "clarification". Ne devine jamais un montant.
- "chitchat" : salutation ou remerciement. Réponds brièvement dans "reply".

RÈGLES POUR LES OPÉRATIONS :
- Ne choisis PAS le compte de trésorerie : il est déduit automatiquement du mode de paiement (espèces → caisse 5711 ; chèque ou virement bancaire → banque 5211 ; Orange Money → 5261 ; MTN MoMo → 5262 ; Wave → 5263 ; Moov Money → 5264).
- "paymentMethod" = le mode dit par l'utilisateur : "cash" (cash, espèces, liquide, comptant), "cheque", "bank_transfer" (virement, banque), "orange_money", "mtn_momo", "wave", "moov_money". Si rien n'est précisé, mets "unspecified".
- "natureAccountCode" = le compte de l'autre côté de l'écriture, choisi UNIQUEMENT dans cette liste : ${NATURE_ACCOUNTS}.
  Ventes de marchandises 7011, services 7061, produits finis 7021, achats de marchandises 6011, matières premières 6021, électricité 6051, eau 6052, carburant 6053, transport 6121, loyer 6221, entretien 6241, télécoms 6271, frais bancaires / Mobile Money 6311, salaires 6411, charges sociales 6451, divers 6581, matériel informatique 244, véhicule 215, matériel industriel 241, mobilier 245, emprunt 162.
- "kind" : sale, purchase, expense, asset_purchase (équipement durable), customer_payment (un client règle une dette), supplier_payment (règlement d'une dette fournisseur), owner_withdrawal (retrait personnel / sans justificatif), transfer (déplacement entre caisse, banque, Mobile Money : paymentMethod = source, toPaymentMethod = destination), loan_received, loan_repayment, capital_contribution, opening_balance (solde de départ), bank_fee, other_income, depreciation.
- "settlement" : "paid" (réglé), "credit" (pas encore payé) ou "partial" (acompte : renseigne paidAmount).
- "amount" = montant TOTAL TTC en FCFA (entier). Quantité × prix unitaire si besoin ("3 sacs à 5000F" = 15000). "45k" = 45000.
- "vatApplicable" : true seulement pour ventes/achats/dépenses soumis à TVA ; false pour salaires, prêts, transferts, frais bancaires, retraits. Si un document indique la TVA, renseigne "vatAmount".
- "confidence" (0-100) : > 90 si tout est précis ; < 80 si ambigu ou sans pièce ; 50 pour un retrait sans motif.
- "anomaly" : chaîne non vide UNIQUEMENT pour une vraie anomalie (retrait sans justificatif, mélange personnel/professionnel, montant incohérent, doublon évident). Une simple incertitude se traduit par une "confidence" basse, jamais par "anomaly".
- "sourceSnippet" : le morceau exact du message d'où vient cette opération.
- "label" : libellé comptable court. "date" au format AAAA-MM-JJ si l'utilisateur ou le document précise une date (hier, avant-hier, date sur le reçu), sinon vide.
- SMS Mobile Money : reconnais l'opérateur, le montant, les frais (opération bank_fee séparée), l'identifiant de transaction ("pieceRef"). Un SMS « vous avez reçu » = encaissement à confirmer (confidence ≤ 82).
${hasDocument ? '- Un document est joint (facture, reçu, relevé, PDF) : extrais fournisseur/client (counterparty), date, numéro (pieceRef), montant TTC, TVA (vatAmount), mode de paiement lu sur la pièce. Si le document est illisible, intent = "clarification".\n' : ''}
DONNÉES DU DOSSIER (calculées sur les écritures réelles) :
${JSON.stringify(analytics)}

MESSAGE DE L'UTILISATEUR : « ${text} »`;
}

const operationSchema = {
  type: Type.OBJECT,
  properties: {
    kind: { type: Type.STRING, enum: KINDS },
    amount: { type: Type.NUMBER },
    natureAccountCode: { type: Type.STRING },
    paymentMethod: { type: Type.STRING, enum: [...METHODS, 'unspecified'] },
    toPaymentMethod: { type: Type.STRING, enum: [...METHODS, 'unspecified'] },
    settlement: { type: Type.STRING, enum: ['paid', 'credit', 'partial'] },
    paidAmount: { type: Type.NUMBER },
    vatApplicable: { type: Type.BOOLEAN },
    vatAmount: { type: Type.NUMBER },
    counterparty: { type: Type.STRING },
    label: { type: Type.STRING },
    confidence: { type: Type.INTEGER },
    anomaly: { type: Type.STRING },
    date: { type: Type.STRING },
    pieceRef: { type: Type.STRING },
    sourceSnippet: { type: Type.STRING },
  },
  required: ['kind', 'amount', 'paymentMethod', 'settlement', 'label', 'confidence', 'sourceSnippet'],
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ['operation', 'question', 'clarification', 'chitchat'] },
    reply: { type: Type.STRING },
    clarification: { type: Type.STRING },
    operations: { type: Type.ARRAY, items: operationSchema },
  },
  required: ['intent', 'operations'],
};

const validMethod = (m: unknown): PaymentMethod | undefined => (METHODS as string[]).includes(m as string) ? (m as PaymentMethod) : undefined;

/**
 * Le modèle comprend ; le mode de paiement dit par l'utilisateur, lui, est une règle dure.
 * On relit le texte source : "cash" ne doit jamais devenir banque parce que le modèle a hésité.
 */
function reconcileOperations(raw: any[], fullText: string, now: Date): ParsedOperation[] {
  const wholeMentions = Array.from(new Set(detectAllPaymentMethods(fullText).map(m => m.method)));
  const ops: ParsedOperation[] = [];

  for (const r of raw) {
    if (!KINDS.includes(r?.kind)) continue;
    const amount = Math.round(Number(r.amount));
    if (!(amount > 0)) continue;

    const snippet: string = typeof r.sourceSnippet === 'string' && r.sourceSnippet ? r.sourceSnippet : fullText;
    const fromSnippet = detectPaymentMethod(snippet);
    let paymentMethod = fromSnippet ?? (raw.length === 1 || wholeMentions.length === 1 ? detectPaymentMethod(fullText) : undefined) ?? validMethod(r.paymentMethod);
    let toMethod = validMethod(r.toPaymentMethod);

    if (r.kind === 'transfer') {
      const mentions = Array.from(new Set(detectAllPaymentMethods(snippet).map(m => m.method)));
      if (mentions.length >= 2) {
        // Ordre d'apparition : source puis destination, sauf tournure "vers"/"sur" gérée par les règles
        const h = parseWithHeuristics(snippet, 'text', now).operations.find(o => o.kind === 'transfer');
        if (h) { paymentMethod = h.paymentMethod; toMethod = h.toMethod; }
      }
      if (!paymentMethod || !toMethod || paymentMethod === toMethod) {
        const h = parseWithHeuristics(snippet, 'text', now).operations.find(o => o.kind === 'transfer');
        if (h?.paymentMethod && h.toMethod) { paymentMethod = h.paymentMethod; toMethod = h.toMethod; }
        else continue; // transfert incohérent : on laisse le moteur de règles / la clarification décider
      }
    }

    const paid = Number(r.paidAmount);
    ops.push({
      kind: r.kind,
      amount,
      natureAccountCode: isKnownAccount(r.natureAccountCode) && !isTreasuryCode(r.natureAccountCode) ? r.natureAccountCode : undefined,
      paymentMethod,
      toMethod,
      settlement: r.settlement === 'credit' || r.settlement === 'partial' ? r.settlement : 'paid',
      paidAmount: paid > 0 && paid < amount ? Math.round(paid) : undefined,
      vatApplicable: typeof r.vatApplicable === 'boolean' ? r.vatApplicable : undefined,
      vatAmount: Number(r.vatAmount) > 0 ? Math.round(Number(r.vatAmount)) : undefined,
      counterparty: r.counterparty || undefined,
      label: String(r.label || 'Opération').slice(0, 140),
      confidence: Math.max(0, Math.min(100, Math.round(Number(r.confidence) || 80))),
      anomaly: r.anomaly ? String(r.anomaly) : undefined,
      date: /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') ? r.date : undefined,
      pieceRef: r.pieceRef || undefined,
      sourceText: snippet,
    });
  }
  return ops;
}

export let usedModel: string | null = null;

export interface GeminiInput {
  text: string;
  image?: { data: string; mimeType: string };
  dossier: ClientDossier;
  settings: PlatformSettings;
  analytics: AgentContext;
  now: Date;
}

/** Retourne null si Gemini est indisponible ou en échec : l'appelant bascule alors sur les règles. */
export async function analyzeWithGemini(input: GeminiInput): Promise<ParseOutcome | null> {
  const ai = getGenAI();
  const candidates = modelCandidates(input.settings);
  if (!ai || candidates.length === 0) return null;

  const prompt = buildPrompt(input.text || 'Analyse le document joint.', !!input.image, input.dossier, input.settings, input.analytics);
  try {
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | undefined;
    let lastError: any;
    const startedAt = Date.now();
    for (const model of candidates) {
      // Au-delà de 13 s cumulées, on préfère répondre avec le moteur de règles que faire attendre
      if (response === undefined && Date.now() - startedAt > 13000) break;
      try {
        response = await ai.models.generateContent({
          model,
          contents: input.image
            ? { parts: [{ inlineData: { data: input.image.data, mimeType: input.image.mimeType } }, { text: prompt }] }
            : prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.1,
            httpOptions: { timeout: 12000 },
            // Réflexion minimale sur la famille 3.x : classer une phrase ne demande pas de raisonnement long
            ...(/^gemini-3\./.test(model) ? { thinkingConfig: { thinkingLevel: 'minimal' as any } } : {}),
          },
        });
        usedModel = model;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Gemini (${model}) indisponible :`, String(err?.message).slice(0, 140));
        if (!RETRYABLE_MODEL_ERROR.test(String(err?.message))) throw err;
      }
    }
    if (!response) throw lastError;
    const parsed = JSON.parse(response.text?.trim() || '{}');
    const intent = ['operation', 'question', 'clarification', 'chitchat'].includes(parsed.intent) ? parsed.intent : 'operation';

    if (intent === 'operation') {
      const ops = reconcileOperations(parsed.operations ?? [], input.text, input.now);
      if (ops.length === 0) return null; // réponse inexploitable → règles
      return { intent, operations: ops };
    }
    return { intent, operations: [], reply: parsed.reply || undefined, clarification: parsed.clarification || undefined };
  } catch (err: any) {
    console.warn('Gemini indisponible, bascule sur le moteur de règles :', err?.message);
    return null;
  }
}

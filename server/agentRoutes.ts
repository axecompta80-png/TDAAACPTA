import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from './db';
import { serializeDossier, serializeEntry, serializePlatformSettings } from './mappers';
import { DEFAULT_PLATFORM_SETTINGS } from '../src/data/initialSettings';
import { buildAgentContext, computeReviewCounts } from '../src/utils/analytics';
import { formatFcfa } from '../src/utils/amounts';
import type { InputMode, JournalEntry } from '../src/types';
import { answerQuestion, greetingReply } from './agent/answers';
import { buildEntries } from './agent/buildEntries';
import * as gemini from './agent/gemini';
import { analyzeWithGemini, getGenAI, modelFromSettings } from './agent/gemini';
import { isGreeting, isQuestion, parseWithHeuristics } from './agent/heuristic';
import type { AgentRequestContext, ParseOutcome } from './agent/types';
import { getAuthUser } from './auth';
import { dossierScopeWhere } from './access';
import { accountsSummary } from '../src/utils/entryLines';

const router = Router();
import { ENTRY_INCLUDE } from './routes/bootstrap';
const INPUT_MODES: InputMode[] = ['text', 'voice', 'photo', 'mobile_money', 'manual', 'excel_import'];
const ALLOWED_DOCUMENT_TYPES = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;

function handler(fn: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

/**
 * Charge le contexte d'un dossier pour l'agent, en vérifiant au préalable que
 * l'utilisateur en session y a accès.
 * Retourne null si le dossier est inexistant ou hors périmètre (réponse 404).
 */
async function loadContext(req: Request, dossierId: string): Promise<AgentRequestContext | null> {
  const user = getAuthUser(req);
  if (!user) return null;

  const dossierRow = await prisma.clientDossier.findFirst({
    where: { id: dossierId, ...dossierScopeWhere(req) },
    include: { owner: { select: { name: true } } },
  });
  if (!dossierRow) return null;

  const [entryRows, settingsRow, userRow] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { clientDossierId: dossierId, status: { not: 'cancelled' } },
      include: ENTRY_INCLUDE,
      orderBy: { date: 'desc' },
      take: 2000,
    }),
    prisma.platformSettings.findUnique({ where: { dossierId } }),
    prisma.user.findUnique({ where: { id: user.sub }, select: { name: true } }),
  ]);

  return {
    dossier: serializeDossier(dossierRow),
    entries: entryRows.map(serializeEntry),
    settings: settingsRow ? serializePlatformSettings(settingsRow) : DEFAULT_PLATFORM_SETTINGS,
    now: new Date(),
    userName: userRow?.name ?? '',
  };
}

function summarize(entries: JournalEntry[]): string {
  if (entries.length === 1) return entries[0].explanationSimplified;
  const lines = entries.map(e => `• ${e.label} — ${formatFcfa(e.amount)} FCFA (${accountsSummary(e)})`);
  return `J'ai enregistré ${entries.length} écritures :\n${lines.join('\n')}`;
}

// Sans anomalie, l'écriture est validée à l'enregistrement : seules les anomalies sont signalées.
function reviewNote(entries: JournalEntry[]): string {
  const anomaly = entries.find(e => e.status === 'anomaly');
  return anomaly ? `\n\n⚠️ ${anomaly.detectedAnomaly}` : '';
}

// Discussion avec l'agent : comprend une opération, une question, ou demande une précision.
router.post('/chat', handler(async (req, res) => {
  const { dossierId, message = '', inputType = 'text', pendingText, image } = req.body ?? {};
  if (typeof dossierId !== 'string' || (!String(message).trim() && !image)) {
    return res.status(400).json({ error: 'Dossier et message requis.' });
  }
  const mode: InputMode = INPUT_MODES.includes(inputType) ? inputType : 'text';

  let imagePayload: { data: string; mimeType: string } | undefined;
  if (image) {
    const mimeType = String(image.mimeType || '');
    if (!ALLOWED_DOCUMENT_TYPES.test(mimeType) || typeof image.data !== 'string') {
      return res.status(400).json({ error: 'Format de document non pris en charge (JPEG, PNG, WebP ou PDF).' });
    }
    if (image.data.length > 12_000_000) {
      return res.status(413).json({ error: 'Document trop volumineux.' });
    }
    imagePayload = { data: image.data.replace(/^data:[^;]+;base64,/, ''), mimeType };
  }

  const ctx = await loadContext(req, dossierId);
  if (!ctx) return res.status(404).json({ error: 'Dossier introuvable.' });

  // La réponse à une demande de précision complète le message précédent ; une question ou un bonjour, non.
  const isFollowUp = typeof pendingText === 'string' && pendingText && !isQuestion(message) && !isGreeting(message);
  const text: string = isFollowUp ? `${pendingText} ${message}`.trim() : String(message).trim();

  const analytics = buildAgentContext(ctx.entries, ctx.now);
  const model = modelFromSettings(ctx.settings);
  let outcome: ParseOutcome | null = null;
  let source = 'moteur-de-regles';

  // 1. Gemini comprend et classe (opération / question / précision / salutation)
  if (getGenAI() && model) {
    outcome = await analyzeWithGemini({ text, image: imagePayload, dossier: ctx.dossier, settings: ctx.settings, analytics, now: ctx.now });
    if (outcome) source = gemini.usedModel ?? model;
  }

  // 2. Repli : documents impossibles à lire sans IA, sinon moteur de règles
  if (!outcome) {
    if (imagePayload) {
      return res.json({
        success: true,
        intent: 'clarification',
        reply: "Je ne peux pas lire les photos ou PDF pour le moment (l'IA de lecture de documents est indisponible). Écrivez-moi simplement ce que dit le reçu : fournisseur, montant et mode de paiement. Exemple : « Facture SOCOCE 42 500 F payée en espèces ».",
        entries: [],
        source,
      });
    }
    if (isGreeting(text)) outcome = { intent: 'chitchat', operations: [], reply: greetingReply(ctx.dossier, text, ctx.userName) };
    else if (isQuestion(text)) outcome = { intent: 'question', operations: [], reply: answerQuestion(text, analytics, ctx.dossier, ctx.settings) };
    else outcome = parseWithHeuristics(text, mode, ctx.now);
  }

  // La salutation est toujours produite côté serveur avec le nom du compte connecté,
  // même lorsque le modèle IA a classé le message en conversationnel.
  if (outcome.intent === 'chitchat') {
    outcome.reply = greetingReply(ctx.dossier, text, ctx.userName);
  }

  // Gemini a classé "question" mais sans réponse exploitable → réponse chiffrée hors ligne
  if (outcome.intent === 'question' && !outcome.reply) outcome.reply = answerQuestion(text, analytics, ctx.dossier, ctx.settings);

  if (outcome.intent === 'operation') {
    const entries = buildEntries(outcome.operations, { ctx, rawInput: String(message).trim() || text, inputType: imagePayload ? 'photo' : mode, source });
    if (entries.length === 0) {
      return res.json({ success: true, intent: 'clarification', reply: "Je n'ai pas pu construire d'écriture valide (montant manquant ou comptes identiques). Pouvez-vous reformuler avec le montant et le mode de paiement ?", entries: [], pendingText: text, source });
    }
    const counts = computeReviewCounts(entries);
    return res.json({
      success: true,
      intent: 'operation',
      reply: `${summarize(entries)}${reviewNote(entries)}${outcome.reply ?? ''}`,
      entries,
      review: counts,
      source,
      quickActions: ['Combien j\'ai en caisse ?', 'Mes ventes du mois', 'Qui me doit de l\'argent ?'],
    });
  }

  if (outcome.intent === 'clarification') {
    return res.json({
      success: true,
      intent: 'clarification',
      reply: outcome.clarification || outcome.reply || 'Pouvez-vous préciser le montant et le mode de paiement ?',
      entries: [],
      pendingText: text,
      source,
    });
  }

  return res.json({ success: true, intent: outcome.intent, reply: outcome.reply, entries: [], source });
}));

// Résumé IA d'un dossier (cabinet) : santé, risques, points à traiter.
router.post('/dossier-summary', handler(async (req, res) => {
  const ctx = await loadContext(req, String(req.body?.dossierId ?? ''));
  if (!ctx) return res.status(404).json({ error: 'Dossier introuvable.' });
  const a = buildAgentContext(ctx.entries, ctx.now);
  const f = (n: number) => `${formatFcfa(n)} FCFA`;
  const points: string[] = [];
  if (a.review.anomalies) points.push(`${a.review.anomalies} anomalie(s) à examiner`);
  if (a.review.pending) points.push(`${a.review.pending} écriture(s) en attente de validation`);
  if (a.treasury.total < 0) points.push('trésorerie négative : soldes d’ouverture manquants ou décaissements non justifiés');
  if (a.receivables.total > a.month.revenue && a.receivables.total > 0) points.push(`créances clients élevées (${f(a.receivables.total)})`);
  if (a.forecast.runwayDays !== null && a.forecast.runwayDays < 60) points.push(`trésorerie pour environ ${a.forecast.runwayDays} jours au rythme actuel`);
  if (a.credit.sufficientData && a.credit.traceabilityRate < 40) points.push(`seulement ${a.credit.traceabilityRate}% des ventes tracées hors espèces`);
  const thresholdBatch = ctx.entries.filter(e => e.status === 'pending_review' && !e.detectedAnomaly).length;
  res.json({
    dossierId: ctx.dossier.id,
    summary: `${ctx.dossier.name} : trésorerie ${f(a.treasury.total)}, chiffre d'affaires du mois ${f(a.month.revenue)}, charges ${f(a.month.expenses)}, résultat ${f(a.month.result)}. TVA du mois : ${a.tva.netToPay > 0 ? `${f(a.tva.netToPay)} à reverser` : `crédit de ${f(a.tva.credit)}`}. Score de solvabilité ${a.credit.sufficientData ? `${a.credit.score}/100` : 'non évaluable (historique insuffisant)'}.`,
    points,
    batchValidationCandidates: thresholdBatch,
    analytics: a,
  });
}));

export default router;

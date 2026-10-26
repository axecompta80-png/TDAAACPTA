import { Router } from 'express';
import { prisma } from '../db';
import { getAuthUser } from '../auth';
import { handler } from '../http';
import { validateDossierInput, validateEntryInput, identifier } from '../validation';
import { findAccessibleDossier } from '../access';
import { buildBootstrapPayload } from './bootstrap';
import { dossierData } from './dossiers';

const router = Router();

/**
 * Restauration d'une sauvegarde JSON.
 *
 * Sécurité : seuls les dossiers de la sauvegarde qui existent déjà ET sont accessibles au
 * requérant sont restaurés (informations + écritures remplacées). Les autres sont ignorés :
 * une sauvegarde ne crée jamais de dossier ni de compte. Les réglages ne sont pas restaurés.
 */
router.post('/import-backup', handler(async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });

  const body = (req.body ?? {}) as { dossiers?: unknown[]; entries?: unknown[] };
  const dossiers = Array.isArray(body.dossiers) ? body.dossiers : [];
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (dossiers.length === 0 && entries.length === 0) {
    return res.status(400).json({ error: 'Sauvegarde vide ou invalide.' });
  }
  if (dossiers.length > 500 || entries.length > 20000) {
    return res.status(400).json({ error: 'Sauvegarde trop volumineuse (500 dossiers / 20000 écritures maximum).' });
  }

  // 1. Dossiers restaurables : présents dans la sauvegarde et dans le périmètre du requérant.
  const restoredDossierIds = new Set<string>();
  for (const raw of dossiers) {
    const id = identifier((raw as any)?.id);
    const parsed = validateDossierInput(raw);
    if (!id || !parsed.ok || !(await findAccessibleDossier(req, id))) continue;
    await prisma.appNotification.deleteMany({ where: { dossierId: id } });
    await prisma.journalEntry.deleteMany({ where: { clientDossierId: id } });
    await prisma.clientDossier.update({ where: { id }, data: dossierData(parsed.data) });
    restoredDossierIds.add(id);
  }
  if (restoredDossierIds.size === 0) {
    return res.status(400).json({ error: 'Aucun dossier de cette sauvegarde ne correspond à vos dossiers.' });
  }

  // 3. Recréer les écritures, uniquement sur les dossiers restaurés.
  for (const raw of entries) {
    const dossierId = identifier((raw as any)?.clientDossierId);
    if (!dossierId || !restoredDossierIds.has(dossierId)) continue;
    // Dossier accessible au requérant : il en conserve les statuts validés.
    const parsed = validateEntryInput(raw, { trusted: true });
    if (!parsed.ok) continue;
    const e = parsed.data;
    const id = identifier((raw as any)?.id) ?? undefined;
    await prisma.journalEntry.create({
      data: {
        ...(id ? { id } : {}),
        date: new Date(e.date),
        label: e.label,
        pieceRef: e.pieceRef,
        debitAccountCode: e.debitAccountCode,
        creditAccountCode: e.creditAccountCode,
        amount: e.amount,
        tvaAmount: e.tvaAmount,
        clientDossierId: dossierId,
        status: e.status as any,
        confidenceScore: e.confidenceScore,
        detectedAnomaly: e.detectedAnomaly,
        rawInput: e.rawInput,
        inputType: e.inputType as any,
        explanationSimplified: e.explanationSimplified,
        paymentMethod: e.paymentMethod as any,
        auditTrail: {
          create: e.auditTrail.map(a => ({
            id: a.id,
            timestamp: new Date(a.timestamp),
            action: a.action as any,
            author: a.author,
            notes: a.notes,
            previousValue: a.previousValue,
            confidenceScore: a.confidenceScore,
          })),
        },
      },
    });
  }

  res.json(await buildBootstrapPayload(req));
}));

export default router;

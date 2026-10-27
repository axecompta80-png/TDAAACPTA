import { Router } from 'express';
import { prisma } from '../db';
import { getAuthUser } from '../auth';
import { handler } from '../http';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { validateDossierInput, validateEntryInput, identifier, DossierInput } from '../validation';
import { findAccessibleDossier } from '../access';
import { buildBootstrapPayload } from './bootstrap';
import { dossierData } from './dossiers';

const router = Router();

const optionalId = (v: unknown) => identifier(v) ?? null;
const optionalDate = (v: unknown) => {
  const d = typeof v === 'string' ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/**
 * Restauration d'une sauvegarde JSON.
 *
 * Sécurité : seuls les dossiers de la sauvegarde qui existent déjà ET sont accessibles au
 * requérant sont restaurés (informations + écritures remplacées). Les autres sont ignorés :
 * une sauvegarde ne crée jamais de dossier ni de compte. Les réglages ne sont pas restaurés.
 *
 * Fidélité : tout est vérifié avant d'écrire et la restauration se fait en une transaction.
 * Une écriture refusée bloque tout (rien n'est perdu en silence ni à moitié restauré).
 * Les liens facture et les paiements de factures sont conservés.
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
  const restorable = new Map<string, DossierInput>();
  for (const raw of dossiers) {
    const id = identifier((raw as any)?.id);
    const parsed = validateDossierInput(raw);
    if (!id || !parsed.ok || !(await findAccessibleDossier(req, id))) continue;
    restorable.set(id, parsed.data);
  }
  if (restorable.size === 0) {
    return res.status(400).json({ error: 'Aucun dossier de cette sauvegarde ne correspond à vos dossiers.' });
  }
  const dossierIds = [...restorable.keys()];

  // 2. Vérifier toutes les écritures avant de toucher à la base.
  const [accounts, invoices] = await Promise.all([
    prisma.syscohadaAccount.findMany({ where: { OR: [{ dossierId: null }, { dossierId: { in: dossierIds } }] }, select: { code: true, dossierId: true } }),
    prisma.invoice.findMany({ where: { clientDossierId: { in: dossierIds } }, select: { id: true, clientDossierId: true } }),
  ]);
  const accountOk = (code: string, dossierId: string) => accounts.some(a => a.code === code && (a.dossierId === null || a.dossierId === dossierId));
  const invoiceDossier = new Map(invoices.map(i => [i.id, i.clientDossierId]));

  const errors: string[] = [];
  const usedIds = new Set<string>();
  const entryRows: Prisma.JournalEntryCreateManyInput[] = [];
  const auditRows: Prisma.AuditLogCreateManyInput[] = [];
  entries.forEach((raw: any, i) => {
    const dossierId = identifier(raw?.clientDossierId);
    if (!dossierId || !restorable.has(dossierId)) return; // écriture d'un dossier non restauré
    const where = `écriture n°${i + 1} « ${String(raw?.label ?? '').slice(0, 40)} »`;
    // Dossier accessible au requérant : il en conserve les statuts validés.
    const parsed = validateEntryInput(raw, { trusted: true });
    if (!parsed.ok) return void errors.push(`${where} : ${(parsed as { error: string }).error}`);
    const e = parsed.data;
    const unknown = [e.debitAccountCode, e.creditAccountCode].filter(c => !accountOk(c, dossierId));
    if (unknown.length) return void errors.push(`${where} : compte inconnu ${unknown.join(', ')}`);

    let id = identifier(raw?.id);
    if (!id || usedIds.has(id)) id = randomUUID();
    usedIds.add(id);
    const invoiceId = optionalId(raw?.invoiceId);
    entryRows.push({
      id,
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
      createdById: optionalId(raw?.createdById),
      updatedById: optionalId(raw?.updatedById),
      validatedById: optionalId(raw?.validatedById),
      validatedAt: optionalDate(raw?.validatedAt),
      invoiceId: invoiceId && invoiceDossier.get(invoiceId) === dossierId ? invoiceId : null,
    });
    for (const a of e.auditTrail) {
      auditRows.push({
        id: a.id,
        journalEntryId: id,
        timestamp: new Date(a.timestamp),
        action: a.action as any,
        author: a.author,
        notes: a.notes,
        previousValue: a.previousValue,
        confidenceScore: a.confidenceScore,
      });
    }
  });
  if (errors.length) {
    return res.status(400).json({
      error: `Sauvegarde non restaurée, rien n'a été modifié. ${errors.length} écriture(s) refusée(s) : ${errors.slice(0, 3).join(' ; ')}${errors.length > 3 ? '…' : ''}`,
    });
  }

  // 3. Remplacement en une transaction. Supprimer une écriture supprime ses paiements de facture :
  //    on les garde de côté et on les recrée pour les écritures restaurées.
  await prisma.$transaction(async tx => {
    const payments = await tx.invoicePayment.findMany({ where: { entry: { clientDossierId: { in: dossierIds } } } });
    await tx.appNotification.deleteMany({ where: { dossierId: { in: dossierIds } } });
    await tx.journalEntry.deleteMany({ where: { clientDossierId: { in: dossierIds } } });
    for (const [id, data] of restorable) await tx.clientDossier.update({ where: { id }, data: dossierData(data) });
    await tx.journalEntry.createMany({ data: entryRows });
    await tx.auditLog.createMany({ data: auditRows, skipDuplicates: true });
    const kept = payments.filter(p => usedIds.has(p.entryId));
    if (kept.length) await tx.invoicePayment.createMany({ data: kept });
  }, { timeout: 120_000, maxWait: 10_000 });

  res.json(await buildBootstrapPayload(req));
}));

export default router;

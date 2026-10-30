var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/db.ts
var db_exports = {};
__export(db_exports, {
  prisma: () => prisma
});
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
var adapter, prisma;
var init_db = __esm({
  "server/db.ts"() {
    adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prisma = new PrismaClient({ adapter });
  }
});

// server/mappers.ts
function relativeTimeFr(date) {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 6e4);
  if (diffMin < 1) return "\xC0 l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} heure${diffH > 1 ? "s" : ""}`;
  const diffD = Math.round(diffH / 24);
  const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diffD === 1) return `Hier \xE0 ${time}`;
  return date.toLocaleDateString("fr-FR");
}
function serializeDossier(row) {
  return {
    id: row.id,
    isMain: Boolean(row.isMain),
    ownerName: row.owner?.name ?? row.ownerName ?? void 0,
    name: row.name,
    managerName: row.managerName,
    phone: row.phone,
    activity: row.activity,
    city: row.city,
    country: row.country,
    rccm: row.rccm,
    ifu: row.ifu,
    regimeFiscal: REGIME_FISCAL_FROM_DB[row.regimeFiscal],
    currency: row.currency,
    lockedUntil: row.lockedUntil ? row.lockedUntil.toISOString().slice(0, 10) : void 0
  };
}
function serializeAuditLog(row) {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    action: row.action,
    author: row.author,
    notes: row.notes ?? void 0,
    previousValue: row.previousValue ?? void 0
  };
}
function serializeEntry(row) {
  return {
    id: row.id,
    date: row.date.toISOString().split("T")[0],
    label: row.label,
    pieceRef: row.pieceRef,
    journal: row.journal,
    number: row.number,
    lines: [...row.lines ?? []].sort((a, b) => a.position - b.position).map((l) => ({
      id: l.id,
      accountCode: l.accountCode,
      accountLabel: l.account?.label,
      label: l.label ?? void 0,
      debit: Number(l.debit),
      credit: Number(l.credit),
      reconciledOn: l.reconciledOn?.toISOString().slice(0, 10) ?? void 0
    })),
    amount: Number(row.amount),
    clientDossierId: row.clientDossierId,
    status: row.status,
    detectedAnomaly: row.detectedAnomaly ?? void 0,
    rawInput: row.rawInput,
    inputType: row.inputType,
    explanationSimplified: row.explanationSimplified,
    paymentMethod: row.paymentMethod,
    auditTrail: (row.auditTrail ?? []).map(serializeAuditLog),
    createdById: row.createdById ?? void 0,
    updatedById: row.updatedById ?? void 0,
    validatedById: row.validatedById ?? void 0,
    validatedAt: row.validatedAt?.toISOString() ?? void 0,
    invoiceId: row.invoiceId ?? void 0,
    attachments: (row.attachments ?? []).map((a) => ({ id: a.id, filename: a.filename, mimeType: a.mimeType, size: a.size })),
    reversalOfId: row.reversalOfId ?? void 0
  };
}
function serializeAccount(row) {
  return {
    code: row.code,
    label: row.label,
    classNumber: row.classNumber,
    category: row.category,
    parentCode: row.parentCode ?? void 0,
    dossierId: row.dossierId ?? void 0,
    active: row.active
  };
}
function serializeInvoice(row) {
  return {
    id: row.id,
    clientDossierId: row.clientDossierId,
    kind: row.kind ?? "sale",
    number: row.number,
    externalRef: row.externalRef ?? void 0,
    originalInvoiceId: row.originalInvoiceId ?? void 0,
    date: day(row.date),
    dueDate: day(row.dueDate),
    mode: row.mode,
    paymentMethod: row.paymentMethod ?? void 0,
    customerName: row.customerName,
    customerPhone: row.customerPhone ?? void 0,
    customerEmail: row.customerEmail ?? void 0,
    customerAddress: row.customerAddress ?? void 0,
    customerTaxId: row.customerTaxId ?? void 0,
    customerAccountCode: row.customerAccountCode,
    salesAccountCode: row.salesAccountCode,
    vatRate: Number(row.vatRate),
    totalHT: Number(row.totalHT),
    totalTVA: Number(row.totalTVA),
    totalTTC: Number(row.totalTTC),
    paymentTerms: row.paymentTerms ?? void 0,
    notes: row.notes ?? void 0,
    status: row.status,
    createdById: row.createdById ?? void 0,
    updatedById: row.updatedById ?? void 0,
    validatedById: row.validatedById ?? void 0,
    validatedAt: row.validatedAt?.toISOString() ?? void 0,
    lines: [...row.lines ?? []].sort((a, b) => a.position - b.position).map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), amountHT: Number(l.amountHT) })),
    payments: (row.payments ?? []).map((p) => ({ id: p.id, entryId: p.entryId, amount: Number(p.amount), createdAt: p.createdAt.toISOString() }))
  };
}
function serializeNotification(row) {
  const hasPayload = Boolean(row.actionMode || row.actionExpertTab);
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    timestamp: relativeTimeFr(row.timestamp),
    type: row.type,
    category: row.category,
    read: row.read,
    dossierId: row.dossierId ?? void 0,
    actionLabel: row.actionLabel ?? void 0,
    actionPayload: hasPayload ? { mode: row.actionMode ?? void 0, expertTab: row.actionExpertTab ?? void 0 } : void 0
  };
}
function serializePlatformSettings(row) {
  return {
    syscohadaVersion: row.syscohadaVersion,
    cashDeductibilityThreshold: Number(row.cashDeductibilityThreshold),
    defaultVatRate: Number(row.defaultVatRate),
    autoFlagLargeCashPayments: row.autoFlagLargeCashPayments,
    defaultDebitCashAccount: row.defaultDebitCashAccount,
    defaultCreditSalesAccount: row.defaultCreditSalesAccount,
    defaultDebitExpenseAccount: row.defaultDebitExpenseAccount,
    duplicateDetection: row.duplicateDetection,
    aiModelPreference: AI_MODEL_FROM_DB[row.aiModelPreference],
    defaultStartupView: row.defaultStartupView,
    numberFormatting: row.numberFormatting,
    cabinetName: row.cabinetName,
    expertLicenseNumber: row.expertLicenseNumber,
    soundEnabled: row.soundEnabled,
    soundType: row.soundType,
    soundVolume: row.soundVolume,
    notifyOnAnomaly: row.notifyOnAnomaly,
    notifyOnTaxDeadline: row.notifyOnTaxDeadline,
    notifyOnMobileMoneySync: row.notifyOnMobileMoneySync
  };
}
function serializeAsset(a) {
  return {
    id: a.id,
    clientDossierId: a.clientDossierId,
    label: a.label,
    accountCode: a.accountCode,
    acquisitionDate: a.acquisitionDate.toISOString().slice(0, 10),
    cost: Number(a.cost),
    durationYears: a.durationYears,
    depreciatedThrough: a.depreciatedThrough ?? void 0
  };
}
var REGIME_FISCAL_TO_DB, REGIME_FISCAL_FROM_DB, AI_MODEL_TO_DB, AI_MODEL_FROM_DB, day;
var init_mappers = __esm({
  "server/mappers.ts"() {
    REGIME_FISCAL_TO_DB = {
      "R\xE9el Simplifi\xE9": "REEL_SIMPLIFIE",
      "R\xE9el Normal": "REEL_NORMAL",
      "Synth\xE9tique / Forfait": "SYNTHETIQUE_FORFAIT"
    };
    REGIME_FISCAL_FROM_DB = {
      REEL_SIMPLIFIE: "R\xE9el Simplifi\xE9",
      REEL_NORMAL: "R\xE9el Normal",
      SYNTHETIQUE_FORFAIT: "Synth\xE9tique / Forfait"
    };
    AI_MODEL_TO_DB = {
      "gemini-2.5-flash": "GEMINI_2_5_FLASH",
      "gemini-2.5-flash-lite": "GEMINI_2_5_FLASH_LITE",
      "heuristic-fast": "HEURISTIC_FAST"
    };
    AI_MODEL_FROM_DB = {
      GEMINI_2_5_FLASH: "gemini-2.5-flash",
      GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite",
      HEURISTIC_FAST: "heuristic-fast"
    };
    day = (d) => d.toISOString().split("T")[0];
  }
});

// src/data/syscohadaPlan.ts
function getAccountByCode(code) {
  return SYSCOHADA_ACCOUNTS.find((a) => a.code === code || a.code.startsWith(code));
}
var SYSCOHADA_ACCOUNTS;
var init_syscohadaPlan = __esm({
  "src/data/syscohadaPlan.ts"() {
    SYSCOHADA_ACCOUNTS = [
      // Classe 1 : Ressources Durables
      { code: "101", label: "Capital social", classNumber: 1, category: "bilan_passif" },
      { code: "102", label: "Capital personnel (exploitant individuel)", classNumber: 1, category: "bilan_passif" },
      { code: "111", label: "R\xE9serve l\xE9gale", classNumber: 1, category: "bilan_passif" },
      { code: "121", label: "Report \xE0 nouveau cr\xE9diteur", classNumber: 1, category: "bilan_passif" },
      { code: "129", label: "Report \xE0 nouveau d\xE9biteur", classNumber: 1, category: "bilan_passif" },
      { code: "131", label: "R\xE9sultat net de l\u2019exercice (B\xE9n\xE9fice)", classNumber: 1, category: "bilan_passif" },
      { code: "139", label: "R\xE9sultat net de l\u2019exercice (Perte)", classNumber: 1, category: "bilan_passif" },
      { code: "162", label: "Emprunts et dettes bancaires", classNumber: 1, category: "bilan_passif" },
      // Classe 2 : Actif Immobilisé
      { code: "215", label: "Mat\xE9riel de transport (camions, tricycles)", classNumber: 2, category: "bilan_actif" },
      { code: "241", label: "Mat\xE9riel et outillage industriel", classNumber: 2, category: "bilan_actif" },
      { code: "244", label: "Mat\xE9riel de bureau et informatique", classNumber: 2, category: "bilan_actif" },
      { code: "231", label: "B\xE2timents (boutique, entrep\xF4t, bureaux)", classNumber: 2, category: "bilan_actif" },
      { code: "245", label: "Mobilier de bureau et \xE9tals", classNumber: 2, category: "bilan_actif" },
      { code: "2831", label: "Amortissements des b\xE2timents", classNumber: 2, category: "bilan_actif" },
      { code: "2815", label: "Amortissements du mat\xE9riel de transport", classNumber: 2, category: "bilan_actif" },
      { code: "2841", label: "Amortissements du mat\xE9riel et outillage", classNumber: 2, category: "bilan_actif" },
      { code: "2844", label: "Amortissements du mat\xE9riel de bureau et informatique", classNumber: 2, category: "bilan_actif" },
      { code: "2845", label: "Amortissements du mobilier de bureau et \xE9tals", classNumber: 2, category: "bilan_actif" },
      // Classe 3 : Stocks
      { code: "311", label: "Marchandises (stocks g\xE9n\xE9raux)", classNumber: 3, category: "bilan_actif" },
      { code: "321", label: "Mati\xE8res premi\xE8res et fournitures li\xE9es", classNumber: 3, category: "bilan_actif" },
      // Classe 4 : Comptes de Tiers
      { code: "4011", label: "Fournisseurs d\u2019exploitation", classNumber: 4, category: "bilan_passif" },
      { code: "4091", label: "Fournisseurs, avances et acomptes vers\xE9s", classNumber: 4, category: "bilan_actif" },
      { code: "4111", label: "Clients ordinaires", classNumber: 4, category: "bilan_actif" },
      { code: "4191", label: "Clients, avances et acomptes re\xE7us", classNumber: 4, category: "bilan_passif" },
      { code: "4211", label: "Personnel, salaires et r\xE9mun\xE9rations dues", classNumber: 4, category: "bilan_passif" },
      { code: "4311", label: "S\xE9curit\xE9 sociale (CNPS / CNSS / IPRES)", classNumber: 4, category: "bilan_passif" },
      { code: "4421", label: "\xC9tat, imp\xF4ts et taxes \xE0 payer", classNumber: 4, category: "bilan_passif" },
      { code: "4431", label: "\xC9tat, TVA factur\xE9e sur ventes (18%)", classNumber: 4, category: "bilan_passif" },
      { code: "4451", label: "\xC9tat, TVA r\xE9cup\xE9rable sur immobilisations", classNumber: 4, category: "bilan_actif" },
      { code: "4452", label: "\xC9tat, TVA d\xE9ductible sur achats et services (18%)", classNumber: 4, category: "bilan_actif" },
      { code: "4441", label: "\xC9tat, TVA due / \xE0 d\xE9caisser", classNumber: 4, category: "bilan_passif" },
      { code: "4449", label: "\xC9tat, cr\xE9dit de TVA \xE0 reporter", classNumber: 4, category: "bilan_actif" },
      { code: "4471", label: "\xC9tat, Imp\xF4ts sur les b\xE9n\xE9fices & acomptes", classNumber: 4, category: "bilan_passif" },
      { code: "4711", label: "Compte d\u2019attente cr\xE9diteur/d\xE9biteur", classNumber: 4, category: "bilan_actif" },
      { code: "4812", label: "Fournisseurs d\u2019investissements (achats d\u2019immobilisations)", classNumber: 4, category: "bilan_passif" },
      // Classe 5 : Trésorerie
      { code: "5211", label: "Banque locale (Ecobank, Coris, SG, UBA)", classNumber: 5, category: "tresorerie" },
      { code: "5261", label: "Portefeuille Orange Money Entreprise", classNumber: 5, category: "tresorerie" },
      { code: "5262", label: "Portefeuille MTN Mobile Money", classNumber: 5, category: "tresorerie" },
      { code: "5263", label: "Portefeuille Wave Business", classNumber: 5, category: "tresorerie" },
      { code: "5264", label: "Portefeuille Moov Money", classNumber: 5, category: "tresorerie" },
      { code: "5711", label: "Caisse principale (esp\xE8ces)", classNumber: 5, category: "tresorerie" },
      { code: "5721", label: "Caisse magasin / point de vente", classNumber: 5, category: "tresorerie" },
      // Classe 6 : Charges des Activités Ordinaires
      { code: "6011", label: "Achats de marchandises (revente en l\u2019\xE9tat)", classNumber: 6, category: "charge" },
      { code: "6021", label: "Achats de mati\xE8res premi\xE8res (production)", classNumber: 6, category: "charge" },
      { code: "6051", label: "Fournitures d\u2019\xE9lectricit\xE9 (CIE / SENELEC / ENEO)", classNumber: 6, category: "charge" },
      { code: "6052", label: "Fournitures d\u2019eau (SODECI / SDE / CAMWATER)", classNumber: 6, category: "charge" },
      { code: "6053", label: "Carburant et lubrifiants", classNumber: 6, category: "charge" },
      { code: "6121", label: "Transports sur achats et livraisons", classNumber: 6, category: "charge" },
      { code: "6221", label: "Locations immobili\xE8res (boutique, d\xE9p\xF4t)", classNumber: 6, category: "charge" },
      { code: "6241", label: "Entretien et r\xE9parations mat\xE9riels", classNumber: 6, category: "charge" },
      { code: "6271", label: "Frais de t\xE9l\xE9communications & Internet", classNumber: 6, category: "charge" },
      { code: "6311", label: "Frais bancaires et commissions Mobile Money", classNumber: 6, category: "charge" },
      { code: "6411", label: "Imp\xF4ts et taxes directs (patente, taxes fonci\xE8res)", classNumber: 6, category: "charge" },
      { code: "6581", label: "Frais divers de gestion courante", classNumber: 6, category: "charge" },
      { code: "6611", label: "Appointements, salaires et commissions", classNumber: 6, category: "charge" },
      { code: "6641", label: "Charges sociales sur r\xE9mun\xE9rations (part patronale)", classNumber: 6, category: "charge" },
      { code: "6711", label: "Int\xE9r\xEAts des emprunts", classNumber: 6, category: "charge" },
      { code: "6811", label: "Dotations aux amortissements d\u2019exploitation", classNumber: 6, category: "charge" },
      // Classe 7 : Produits des Activités Ordinaires
      { code: "7011", label: "Ventes de marchandises au comptant", classNumber: 7, category: "produit" },
      { code: "7012", label: "Ventes de marchandises \xE0 cr\xE9dit", classNumber: 7, category: "produit" },
      { code: "7021", label: "Ventes de produits confectionn\xE9s / finis", classNumber: 7, category: "produit" },
      { code: "7061", label: "Prestations de services et travaux", classNumber: 7, category: "produit" },
      { code: "7071", label: "Commissions et produits accessoires", classNumber: 7, category: "produit" },
      // Classe 8 : Comptes Hors Activités Ordinaires (HAO)
      { code: "8111", label: "Valeurs comptables des cessions d\u2019immobilisations", classNumber: 8, category: "charge" },
      { code: "8211", label: "Produits des cessions d\u2019immobilisations", classNumber: 8, category: "produit" },
      { code: "8411", label: "Produits HAO (dons et subventions exceptionnels re\xE7us)", classNumber: 8, category: "produit" },
      { code: "8911", label: "Imp\xF4t sur le r\xE9sultat de l\u2019exercice", classNumber: 8, category: "charge" }
    ];
  }
});

// src/data/initialSettings.ts
var DEFAULT_PLATFORM_SETTINGS;
var init_initialSettings = __esm({
  "src/data/initialSettings.ts"() {
    DEFAULT_PLATFORM_SETTINGS = {
      // Comptabilité & SYSCOHADA
      syscohadaVersion: "SYSCOHADA R\xE9vis\xE9 2026 (AUDCIF)",
      cashDeductibilityThreshold: 5e5,
      // 500 000 FCFA selon article OHADA/CGI
      defaultVatRate: 18,
      // 18% par défaut zone UEMOA
      autoFlagLargeCashPayments: true,
      defaultDebitCashAccount: "5711 - Caisse Principale",
      defaultCreditSalesAccount: "7011 - Ventes de Marchandises",
      defaultDebitExpenseAccount: "6011 - Achats de Marchandises",
      // IA
      duplicateDetection: true,
      aiModelPreference: "gemini-2.5-flash",
      // Préférences & Affichage
      defaultStartupView: "simplified",
      numberFormatting: "standard",
      cabinetName: "Cabinet KM Consulting & Audit OHADA",
      expertLicenseNumber: "ONECCA-CI N\xB0 2024-889",
      // Audio & Notifications
      soundEnabled: true,
      soundType: "fintech_chime",
      soundVolume: 0.7,
      notifyOnAnomaly: true,
      notifyOnTaxDeadline: true,
      notifyOnMobileMoneySync: true
    };
  }
});

// server/seedData.ts
var seedData_exports = {};
__export(seedData_exports, {
  copySettings: () => copySettings,
  createDefaultPlatformSettings: () => createDefaultPlatformSettings,
  ensureSyscohadaAccounts: () => ensureSyscohadaAccounts,
  purgeLegacyDemoData: () => purgeLegacyDemoData,
  settingsData: () => settingsData
});
async function ensureSyscohadaAccounts(prisma2) {
  for (const acc of SYSCOHADA_ACCOUNTS) {
    await prisma2.syscohadaAccount.upsert({
      where: { code: acc.code },
      update: { label: acc.label, classNumber: acc.classNumber, category: acc.category },
      create: { code: acc.code, label: acc.label, classNumber: acc.classNumber, category: acc.category }
    });
  }
}
function settingsData(s) {
  return {
    syscohadaVersion: s.syscohadaVersion,
    cashDeductibilityThreshold: s.cashDeductibilityThreshold,
    defaultVatRate: s.defaultVatRate,
    autoFlagLargeCashPayments: s.autoFlagLargeCashPayments,
    defaultDebitCashAccount: s.defaultDebitCashAccount,
    defaultCreditSalesAccount: s.defaultCreditSalesAccount,
    defaultDebitExpenseAccount: s.defaultDebitExpenseAccount,
    duplicateDetection: s.duplicateDetection,
    aiModelPreference: AI_MODEL_TO_DB[s.aiModelPreference],
    defaultStartupView: s.defaultStartupView,
    numberFormatting: s.numberFormatting,
    cabinetName: s.cabinetName,
    expertLicenseNumber: s.expertLicenseNumber,
    soundEnabled: s.soundEnabled,
    soundType: s.soundType,
    soundVolume: s.soundVolume,
    notifyOnAnomaly: s.notifyOnAnomaly,
    notifyOnTaxDeadline: s.notifyOnTaxDeadline,
    notifyOnMobileMoneySync: s.notifyOnMobileMoneySync
  };
}
function copySettings(row) {
  const { id: _id, dossierId: _d, updatedAt: _u, ...rest } = row;
  return rest;
}
async function createDefaultPlatformSettings(prisma2, dossierId) {
  return prisma2.platformSettings.create({ data: { ...settingsData(DEFAULT_PLATFORM_SETTINGS), dossierId } });
}
async function purgeLegacyDemoData(prisma2) {
  await prisma2.appNotification.deleteMany();
  await prisma2.journalEntry.deleteMany();
  await prisma2.clientDossier.deleteMany();
}
var init_seedData = __esm({
  "server/seedData.ts"() {
    init_syscohadaPlan();
    init_initialSettings();
    init_mappers();
  }
});

// server/app.ts
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";

// server/routes/index.ts
import { Router as Router11 } from "express";

// server/http.ts
function handler(fn) {
  return (req, res, next) => fn(req, res).catch(next);
}

// server/routes/recurring.ts
init_db();
import { Router as Router3 } from "express";

// server/access.ts
init_db();

// server/auth.ts
init_db();
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET manquant dans les variables d'environnement.");
  }
  return secret;
}
var COOKIE_NAME = "axecompta_session";
var COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1e3
  // 7 jours
};
function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    const payload = token ? verifyToken(token) : null;
    const user = payload ? await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true, organizationId: true, dossierId: true } }) : null;
    if (!user) {
      return res.status(401).json({ error: "Authentification requise." });
    }
    req.user = { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId, dossierId: user.dossierId };
    next();
  } catch (e) {
    next(e);
  }
}
function getAuthUser(req) {
  return req.user;
}

// server/access.ts
var NO_ACCESS = "Vous n'avez pas acc\xE8s \xE0 ce dossier.";
var NONE = { organizationId: "__aucune__" };
function dossierScopeWhere(req) {
  const user = getAuthUser(req);
  if (!user?.organizationId) return NONE;
  return user.dossierId ? { owner: { is: { id: user.sub } } } : { organizationId: user.organizationId };
}
function entryScopeWhere(req) {
  return { clientDossier: dossierScopeWhere(req) };
}
function notificationScopeWhere(req) {
  return { dossier: dossierScopeWhere(req) };
}
function isMainAccount(req) {
  const user = getAuthUser(req);
  return Boolean(user?.organizationId) && !user?.dossierId;
}
async function actorName(req) {
  const user = getAuthUser(req);
  if (!user) return "Inconnu";
  const row = await prisma.user.findUnique({ where: { id: user.sub }, select: { name: true } });
  return row?.name ?? user.email;
}
async function findAccessibleDossier(req, dossierId) {
  if (!getAuthUser(req)) return null;
  return prisma.clientDossier.findFirst({ where: { id: dossierId, ...dossierScopeWhere(req) } });
}
async function findAccessibleEntry(req, entryId) {
  if (!getAuthUser(req)) return null;
  return prisma.journalEntry.findFirst({ where: { id: entryId, ...entryScopeWhere(req) } });
}

// src/utils/entryLines.ts
var JOURNALS = [
  { code: "VT", label: "Ventes" },
  { code: "AC", label: "Achats" },
  { code: "BQ", label: "Banque & Mobile Money" },
  { code: "CA", label: "Caisse" },
  { code: "OD", label: "Op\xE9rations diverses" },
  { code: "AN", label: "\xC0-nouveaux (soldes d\u2019ouverture)" }
];
var JOURNAL_LABEL = Object.fromEntries(JOURNALS.map((j) => [j.code, j.label]));
var TVA_COLLECTED = "4431";
var TVA_DEDUCTIBLE = "4452";
var round2 = (n) => Math.round(n * 100) / 100;
function simpleLines(debit, credit, amount, tva = 0) {
  const ttc = round2(amount);
  const t = round2(Math.min(Math.max(0, tva), ttc));
  if (t > 0 && t < ttc && credit.startsWith("7")) {
    return [
      { accountCode: debit, debit: ttc, credit: 0 },
      { accountCode: credit, debit: 0, credit: round2(ttc - t) },
      { accountCode: TVA_COLLECTED, debit: 0, credit: t }
    ];
  }
  if (t > 0 && t < ttc && /^[236]/.test(debit)) {
    return [
      { accountCode: debit, debit: round2(ttc - t), credit: 0 },
      { accountCode: TVA_DEDUCTIBLE, debit: t, credit: 0 },
      { accountCode: credit, debit: 0, credit: ttc }
    ];
  }
  return [
    { accountCode: debit, debit: ttc, credit: 0 },
    { accountCode: credit, debit: 0, credit: ttc }
  ];
}
var totalDebit = (lines) => round2(lines.reduce((s, l) => s + l.debit, 0));
var totalCredit = (lines) => round2(lines.reduce((s, l) => s + l.credit, 0));
function linesError(lines) {
  if (lines.length < 2) return "Une \xE9criture comporte au moins deux lignes.";
  for (const [i, l] of lines.entries()) {
    if (!l.accountCode) return `Ligne ${i + 1} : compte manquant.`;
    if (l.debit < 0 || l.credit < 0) return `Ligne ${i + 1} : montant n\xE9gatif.`;
    if (l.debit > 0 === l.credit > 0) return `Ligne ${i + 1} : un montant au d\xE9bit OU au cr\xE9dit.`;
  }
  const d = totalDebit(lines), c = totalCredit(lines);
  if (Math.abs(d - c) > 5e-3) return `\xC9criture d\xE9s\xE9quilibr\xE9e : d\xE9bit ${d.toLocaleString("fr-FR")} \u2260 cr\xE9dit ${c.toLocaleString("fr-FR")}.`;
  return null;
}
function defaultJournal(lines) {
  const has = (re) => lines.some((l) => re.test(l.accountCode));
  if (has(/^57/)) return "CA";
  if (has(/^5[0-6]/)) return "BQ";
  if (has(/^7/)) return "VT";
  if (has(/^(6|2|40)/)) return "AC";
  return "OD";
}
function accountsSummary(e) {
  const codes = (side) => [...new Set(e.lines.filter((l) => l[side] > 0).map((l) => l.accountCode))].join(", ");
  return `${codes("debit")} / ${codes("credit")}`;
}
var debitCodes = (e) => e.lines.filter((l) => l.debit > 0).map((l) => l.accountCode);
var creditCodes = (e) => e.lines.filter((l) => l.credit > 0).map((l) => l.accountCode);
function prefixBalance(e, ...prefixes) {
  let s = 0;
  for (const l of e.lines) if (prefixes.some((p) => l.accountCode.startsWith(p))) s += l.debit - l.credit;
  return round2(s);
}
var reversedLines = (lines) => lines.map((l) => ({ accountCode: l.accountCode, label: l.label, debit: l.credit, credit: l.debit }));
var isLocked = (date, lockedUntil) => !!lockedUntil && date <= lockedUntil;
function nextMonthly(date, day2) {
  const [y, m] = date.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(day2, last)).padStart(2, "0")}`;
}

// server/validation.ts
var REGIMES_FISCAUX = ["R\xE9el Simplifi\xE9", "R\xE9el Normal", "Synth\xE9tique / Forfait"];
var TRANSACTION_STATUSES = ["draft", "pending_review", "anomaly", "validated", "cancelled"];
var ENTRY_STATUSES = ["draft", "pending_review", "anomaly"];
var INPUT_MODES = ["text", "voice", "photo", "mobile_money", "manual", "excel_import"];
var PAYMENT_METHODS = ["cash", "orange_money", "mtn_momo", "wave", "moov_money", "bank_transfer", "cheque"];
var AUDIT_ACTIONS = ["created_by_ai", "validated_by_expert", "auto_validated", "edited_by_expert", "anomaly_flagged", "submitted_for_review", "unvalidated", "cancelled", "reversed"];
var JOURNAL_CODES = JOURNALS.map((j) => j.code);
var CLIENT_AUDIT_ACTIONS = ["created_by_ai", "edited_by_expert", "anomaly_flagged"];
function unwrap(result) {
  const outcome = result;
  if (outcome.ok) return outcome.data;
  const message = outcome.error ?? "Donn\xE9es invalides.";
  throw Object.assign(new Error(message), { status: 400, publicMessage: message });
}
var MAX_TEXT = 500;
function text(value, max = 160) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}
function optionalText(value, max = MAX_TEXT) {
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
function identifier(value) {
  const t = text(value, 64);
  if (!t || !/^[A-Za-z0-9_-]+$/.test(t)) return null;
  return t;
}
function isoDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}
function money(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) return null;
  return Math.round(n * 100) / 100;
}
function oneOf(value, allowed) {
  return typeof value === "string" && allowed.includes(value) ? value : null;
}
function validateDossierInput(body) {
  const b = body ?? {};
  const name = text(b.name, 160);
  const managerName = text(b.managerName, 120);
  const phone = text(b.phone, 40);
  const activity = text(b.activity, 200);
  const city = text(b.city, 80);
  const country = text(b.country, 80);
  const rccm = text(b.rccm, 60);
  const ifu = text(b.ifu, 60);
  const currency = text(b.currency, 12) ?? "FCFA";
  const regimeFiscal = oneOf(b.regimeFiscal, REGIMES_FISCAUX);
  if (!name) return { ok: false, error: "Le nom du dossier est requis (160 caract\xE8res maximum)." };
  if (!managerName) return { ok: false, error: "Le nom du g\xE9rant est requis." };
  if (!phone) return { ok: false, error: "Le num\xE9ro de t\xE9l\xE9phone est requis." };
  if (!activity) return { ok: false, error: "Le secteur d'activit\xE9 est requis." };
  if (!city) return { ok: false, error: "La ville est requise." };
  if (!country) return { ok: false, error: "Le pays est requis." };
  if (!rccm) return { ok: false, error: "Le num\xE9ro RCCM est requis." };
  if (!ifu) return { ok: false, error: "Le num\xE9ro d'IFU est requis." };
  if (!regimeFiscal) return { ok: false, error: "R\xE9gime fiscal invalide." };
  return { ok: true, data: { name, managerName, phone, activity, city, country, rccm, ifu, regimeFiscal, currency } };
}
function parseAuditTrail(value, trusted = false) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  for (const raw of value.slice(0, 100)) {
    const a = raw ?? {};
    const action = oneOf(a.action, trusted ? AUDIT_ACTIONS : CLIENT_AUDIT_ACTIONS);
    if (a.action !== void 0 && !action) continue;
    const author = optionalText(a.author, 120) ?? "Agent AxeCompta";
    const notes = optionalText(a.notes) ?? void 0;
    const previousValue = optionalText(a.previousValue) ?? void 0;
    rows.push({
      id: identifier(a.id) ?? `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: isoDate(a.timestamp) && typeof a.timestamp === "string" ? new Date(a.timestamp).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      action: action ?? "created_by_ai",
      author,
      notes,
      previousValue
    });
  }
  return rows;
}
function parseLines(b) {
  if (!Array.isArray(b.lines)) {
    const debit = text(b.debitAccountCode, 20);
    const credit = text(b.creditAccountCode, 20);
    const amount = money(b.amount);
    const tva = money(b.tvaAmount ?? 0) ?? 0;
    if (!debit || !credit || !amount) return "Lignes d'\xE9criture manquantes.";
    return simpleLines(debit, credit, amount, tva);
  }
  if (b.lines.length > 200) return "\xC9criture limit\xE9e \xE0 200 lignes.";
  const lines = [];
  for (const [i, raw] of b.lines.entries()) {
    const l = raw ?? {};
    const accountCode = text(l.accountCode, 20);
    const debit = money(l.debit ?? 0);
    const credit = money(l.credit ?? 0);
    if (!accountCode) return `Ligne ${i + 1} : compte invalide.`;
    if (debit === null || credit === null) return `Ligne ${i + 1} : montant invalide.`;
    if (debit === 0 && credit === 0) continue;
    lines.push({ accountCode, debit, credit, label: optionalText(l.label, 300) ?? void 0 });
  }
  return linesError(lines) ?? lines;
}
function validateEntryInput(body, options = {}) {
  const b = body ?? {};
  const date = isoDate(b.date);
  const label = text(b.label, 300);
  const pieceRef = optionalText(b.pieceRef, 80) ?? "";
  const lines = parseLines(b);
  const status = oneOf(b.status, options.trusted ? TRANSACTION_STATUSES : ENTRY_STATUSES) ?? "pending_review";
  const inputType = oneOf(b.inputType, INPUT_MODES);
  const paymentMethod = oneOf(b.paymentMethod, PAYMENT_METHODS);
  const explanationSimplified = optionalText(b.explanationSimplified) ?? "";
  const rawInput = optionalText(b.rawInput) ?? "";
  const detectedAnomaly = optionalText(b.detectedAnomaly) ?? void 0;
  const id = options.requireId ? identifier(b.id) : void 0;
  if (options.requireId && !id) return { ok: false, error: "Identifiant d'\xE9criture invalide." };
  if (!date) return { ok: false, error: "Date d'\xE9criture invalide." };
  if (!label) return { ok: false, error: "Le libell\xE9 de l'\xE9criture est requis." };
  if (typeof lines === "string") return { ok: false, error: lines };
  const journal = oneOf(b.journal, JOURNAL_CODES) ?? defaultJournal(lines);
  if (!inputType) return { ok: false, error: "Mode de saisie invalide." };
  if (!paymentMethod) return { ok: false, error: "Mode de paiement invalide." };
  return {
    ok: true,
    data: {
      id: id ?? void 0,
      date,
      label,
      pieceRef,
      journal,
      lines,
      amount: totalDebit(lines),
      status,
      detectedAnomaly,
      rawInput,
      inputType,
      explanationSimplified,
      paymentMethod,
      auditTrail: parseAuditTrail(b.auditTrail, options.trusted)
    }
  };
}
var NOTIFICATION_TYPES = ["info", "success", "warning", "error"];
var NOTIFICATION_CATEGORIES = ["compta", "fiscal", "tresorerie", "ia", "system"];
var STARTUP_VIEWS = ["simplified", "expert"];
var EXPERT_TABS = ["portfolio", "journal", "invoices", "accounts", "ledger", "financials", "tax", "bank", "assets"];
function validateNotificationInput(body) {
  const b = body ?? {};
  const title = text(b.title, 160);
  const message = text(b.message, MAX_TEXT);
  const type = oneOf(b.type, NOTIFICATION_TYPES);
  const category = oneOf(b.category, NOTIFICATION_CATEGORIES);
  const dossierId = b.dossierId === void 0 || b.dossierId === null ? void 0 : identifier(b.dossierId);
  const actionLabel = optionalText(b.actionLabel, 80) ?? void 0;
  const payload = b.actionPayload ?? {};
  const actionMode = oneOf(payload.mode, STARTUP_VIEWS) ?? void 0;
  const actionExpertTab = oneOf(payload.expertTab, EXPERT_TABS) ?? void 0;
  const id = identifier(b.id) ?? void 0;
  if (!title) return { ok: false, error: "Titre de notification requis." };
  if (!message) return { ok: false, error: "Message de notification requis." };
  if (!type) return { ok: false, error: "Type de notification invalide." };
  if (!category) return { ok: false, error: "Cat\xE9gorie de notification invalide." };
  if (b.dossierId && !dossierId) return { ok: false, error: "Dossier de notification invalide." };
  return { ok: true, data: { id, title, message, type, category, read: b.read === true, dossierId, actionLabel, actionMode, actionExpertTab } };
}
function validateSettingsInput(body) {
  const b = body ?? {};
  const s = b;
  const version = text(s.syscohadaVersion, 120);
  const cabinetName = text(s.cabinetName, 160);
  const license = optionalText(s.expertLicenseNumber, 80) ?? "";
  const num = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  if (!version) return { ok: false, error: "Version SYSCOHADA requise." };
  if (!cabinetName) return { ok: false, error: "Nom de l\u2019espace requis." };
  return {
    ok: true,
    data: {
      syscohadaVersion: version,
      cashDeductibilityThreshold: num(s.cashDeductibilityThreshold, 0, 1e9, 5e5),
      defaultVatRate: num(s.defaultVatRate, 0, 100, 18),
      autoFlagLargeCashPayments: s.autoFlagLargeCashPayments !== false,
      defaultDebitCashAccount: text(s.defaultDebitCashAccount, 120) ?? "5711 - Caisse Principale",
      defaultCreditSalesAccount: text(s.defaultCreditSalesAccount, 120) ?? "7011 - Ventes de Marchandises",
      defaultDebitExpenseAccount: text(s.defaultDebitExpenseAccount, 120) ?? "6011 - Achats de Marchandises",
      duplicateDetection: s.duplicateDetection !== false,
      aiModelPreference: oneOf(s.aiModelPreference, ["gemini-2.5-flash", "gemini-2.5-flash-lite", "heuristic-fast"]) ?? "gemini-2.5-flash",
      defaultStartupView: oneOf(s.defaultStartupView, STARTUP_VIEWS) ?? "simplified",
      numberFormatting: oneOf(s.numberFormatting, ["standard", "compact"]) ?? "standard",
      cabinetName,
      expertLicenseNumber: license,
      soundEnabled: s.soundEnabled !== false,
      soundType: oneOf(s.soundType, ["fintech_chime", "crystal_bell", "soft_chord", "alert_warning"]) ?? "fintech_chime",
      soundVolume: num(s.soundVolume, 0, 1, 0.7),
      notifyOnAnomaly: s.notifyOnAnomaly !== false,
      notifyOnTaxDeadline: s.notifyOnTaxDeadline !== false,
      notifyOnMobileMoneySync: s.notifyOnMobileMoneySync !== false
    }
  };
}
function validateAccountInput(body) {
  const b = body ?? {};
  const code = typeof b.code === "string" ? b.code.trim() : "";
  const parentCode = typeof b.parentCode === "string" ? b.parentCode.trim() : "";
  const label = text(b.label, 120);
  const dossierId = identifier(b.dossierId);
  if (!/^[1-9][0-9]{2,11}$/.test(code)) return { ok: false, error: "Code de compte invalide (3 \xE0 12 chiffres)." };
  if (!/^[1-9][0-9]{2,11}$/.test(parentCode)) return { ok: false, error: "Compte parent invalide." };
  if (code === parentCode || !code.startsWith(parentCode.slice(0, 3))) {
    return { ok: false, error: `Le sous-compte doit commencer par ${parentCode.slice(0, 3)} (m\xEAme compte principal que ${parentCode}).` };
  }
  if (!label) return { ok: false, error: "Libell\xE9 du compte requis." };
  if (!dossierId) return { ok: false, error: "Dossier invalide." };
  return { ok: true, data: { code, label, parentCode, dossierId } };
}
function validateInvoiceInput(body) {
  const b = body ?? {};
  const date = isoDate(b.date);
  const kind = oneOf(b.kind, ["sale", "credit_note", "purchase"]) ?? "sale";
  const purchase = kind === "purchase";
  const mode = kind === "credit_note" ? "credit" : oneOf(b.mode, ["cash", "credit"]);
  const paymentMethod = oneOf(b.paymentMethod, PAYMENT_METHODS);
  const customerName = text(b.customerName, 160);
  const customerAccountCode = typeof b.customerAccountCode === "string" && b.customerAccountCode.trim() || (purchase ? "4011" : "4111");
  const salesAccountCode = typeof b.salesAccountCode === "string" && b.salesAccountCode.trim() || (purchase ? "6011" : "7011");
  const originalInvoiceId = kind === "credit_note" ? identifier(b.originalInvoiceId) : null;
  const vat = Number(b.vatRate ?? 0);
  const rawLines = Array.isArray(b.lines) ? b.lines.slice(0, 200) : [];
  const lines = [];
  for (const raw of rawLines) {
    const l = raw ?? {};
    const description = text(l.description, 300);
    const quantity = Number(l.quantity);
    const unitPrice = money(l.unitPrice);
    if (!description) return { ok: false, error: "Chaque ligne doit avoir une d\xE9signation." };
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9) return { ok: false, error: `Quantit\xE9 invalide pour \xAB ${description} \xBB.` };
    if (unitPrice === null) return { ok: false, error: `Prix unitaire invalide pour \xAB ${description} \xBB.` };
    lines.push({ description, quantity: Math.round(quantity * 1e3) / 1e3, unitPrice });
  }
  if (!date) return { ok: false, error: "Date de facture invalide." };
  if (!mode) return { ok: false, error: "Mode de facture invalide (comptant ou cr\xE9dit)." };
  if (mode === "cash" && !paymentMethod) return { ok: false, error: "Mode de r\xE8glement requis pour une facture au comptant." };
  if (!customerName) return { ok: false, error: purchase ? "Nom du fournisseur requis." : "Nom du client requis." };
  if (purchase) {
    if (!/^40[0-9]{1,10}$/.test(customerAccountCode)) return { ok: false, error: "Le compte fournisseur doit \xEAtre un compte 40x." };
    if (!/^(6|2)[0-9]{1,11}$/.test(salesAccountCode)) return { ok: false, error: "Le compte d'achat doit \xEAtre une charge (6x) ou une immobilisation (2x)." };
  } else {
    if (!/^411[0-9]{0,9}$/.test(customerAccountCode)) return { ok: false, error: "Le compte client doit \xEAtre un compte 411." };
    if (!/^70[0-9]{1,10}$/.test(salesAccountCode)) return { ok: false, error: "Le compte de vente doit \xEAtre un compte 70x." };
  }
  if (kind === "credit_note" && !originalInvoiceId) return { ok: false, error: "Un avoir doit r\xE9f\xE9rencer la facture d'origine." };
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) return { ok: false, error: "Taux de TVA invalide." };
  if (lines.length === 0) return { ok: false, error: "La facture doit contenir au moins une ligne." };
  const dueDate = mode === "cash" ? date : isoDate(b.dueDate) ?? date;
  if (dueDate < date) return { ok: false, error: "L'\xE9ch\xE9ance ne peut pas pr\xE9c\xE9der la date de facture." };
  return {
    ok: true,
    data: {
      kind,
      externalRef: purchase ? optionalText(b.externalRef, 80) : null,
      originalInvoiceId,
      date,
      dueDate,
      mode,
      paymentMethod: mode === "cash" ? paymentMethod : null,
      customerName,
      customerPhone: optionalText(b.customerPhone, 40),
      customerEmail: optionalText(b.customerEmail, 160),
      customerAddress: optionalText(b.customerAddress, 300),
      customerTaxId: optionalText(b.customerTaxId, 60),
      customerAccountCode,
      salesAccountCode,
      vatRate: Math.round(vat * 100) / 100,
      paymentTerms: optionalText(b.paymentTerms, 300),
      notes: optionalText(b.notes, MAX_TEXT),
      lines
    }
  };
}
function positiveMoney(value) {
  const n = money(value);
  return n !== null && n > 0 ? n : null;
}
function optionalReason(body) {
  return optionalText((body ?? {}).reason, 300);
}

// server/routes/entries.ts
init_db();
init_mappers();
import { Router as Router2 } from "express";

// server/routes/bootstrap.ts
init_db();
init_mappers();

// server/routes/notifications.ts
init_db();
init_mappers();
import { Router } from "express";

// src/utils/fiscalCalendar.ts
var pad = (n) => String(n).padStart(2, "0");
var lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
var MONTHS = ["janvier", "f\xE9vrier", "mars", "avril", "mai", "juin", "juillet", "ao\xFBt", "septembre", "octobre", "novembre", "d\xE9cembre"];
function fiscalDeadlines(years, lockedUntil) {
  const out = [];
  for (const y of years) {
    for (let m = 1; m <= 12; m++) {
      const periodEnd2 = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
      const due = m === 12 ? `${y + 1}-01-15` : `${y}-${pad(m + 1)}-15`;
      out.push({ key: `tva-${y}-${pad(m)}`, label: `TVA de ${MONTHS[m - 1]} ${y}`, due, periodEnd: periodEnd2, done: isLocked(periodEnd2, lockedUntil) });
    }
    const periodEnd = `${y}-12-31`;
    out.push({ key: `dsf-${y}`, label: `\xC9tats financiers et DSF ${y}`, due: `${y + 1}-04-30`, periodEnd, done: isLocked(periodEnd, lockedUntil) });
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}
function deadlinesToRemind(today, lockedUntil) {
  const y = Number(today.slice(0, 4));
  const shift = (days) => new Date(Date.parse(today) + days * 864e5).toISOString().slice(0, 10);
  const from = shift(-30), to = shift(7);
  return fiscalDeadlines([y - 1, y], lockedUntil).filter((d) => !d.done && d.due >= from && d.due <= to);
}

// server/routes/notifications.ts
var router = Router();
var fr = (d) => d.split("-").reverse().join("/");
async function createDeadlineReminders(req) {
  const dossiers = await prisma.clientDossier.findMany({
    where: dossierScopeWhere(req),
    select: { id: true, lockedUntil: true, regimeFiscal: true, createdAt: true, settings: { select: { notifyOnTaxDeadline: true } } }
  });
  const firsts = await prisma.journalEntry.groupBy({ by: ["clientDossierId"], where: { clientDossierId: { in: dossiers.map((d) => d.id) } }, _min: { date: true } });
  const startOf = (d) => {
    const first = firsts.find((f) => f.clientDossierId === d.id)?._min.date;
    return (first && first < d.createdAt ? first : d.createdAt).toISOString().slice(0, 7);
  };
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const rows = dossiers.filter((d) => d.settings?.notifyOnTaxDeadline ?? true).flatMap((d) => deadlinesToRemind(today, d.lockedUntil?.toISOString().slice(0, 10)).filter((x) => x.periodEnd.slice(0, 7) >= startOf(d)).filter((x) => d.regimeFiscal !== "SYNTHETIQUE_FORFAIT" || !x.key.startsWith("tva")).map((x) => ({
    id: `echeance-${d.id}-${x.key}`,
    title: x.due < today ? `En retard : ${x.label}` : `\xC9ch\xE9ance le ${fr(x.due)} : ${x.label}`,
    message: x.due < today ? `La date limite du ${fr(x.due)} est pass\xE9e. D\xE9posez la d\xE9claration puis marquez la p\xE9riode d\xE9clar\xE9e.` : `\xC0 d\xE9poser avant le ${fr(x.due)}. Une fois d\xE9clar\xE9e, marquez la p\xE9riode d\xE9clar\xE9e pour la bloquer.`,
    type: x.due < today ? "warning" : "info",
    category: "fiscal",
    dossierId: d.id,
    actionLabel: "Ouvrir la fiscalit\xE9",
    actionMode: "expert",
    actionExpertTab: "tax"
  })));
  if (rows.length) await prisma.appNotification.createMany({ data: rows, skipDuplicates: true });
}
router.post("/notifications", handler(async (req, res) => {
  const n = unwrap(validateNotificationInput(req.body));
  if (n.dossierId) {
    const dossier = await findAccessibleDossier(req, n.dossierId);
    if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  }
  const created = await prisma.appNotification.create({
    data: {
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      category: n.category,
      read: n.read,
      dossierId: n.dossierId,
      actionLabel: n.actionLabel,
      actionMode: n.actionMode,
      actionExpertTab: n.actionExpertTab
    }
  });
  res.status(201).json(serializeNotification(created));
}));
router.post("/notifications/read-all", handler(async (req, res) => {
  await prisma.appNotification.updateMany({ where: notificationScopeWhere(req), data: { read: true } });
  res.status(204).end();
}));
router.post("/notifications/:id/read", handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant de notification invalide." });
  const scoped = await prisma.appNotification.findFirst({ where: { id, ...notificationScopeWhere(req) } });
  if (!scoped) return res.status(404).json({ error: "Notification introuvable." });
  const updated = await prisma.appNotification.update({ where: { id }, data: { read: true } });
  res.json(serializeNotification(updated));
}));
router.post("/notifications/:id/delete", handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant de notification invalide." });
  const scoped = await prisma.appNotification.findFirst({ where: { id, ...notificationScopeWhere(req) } });
  if (!scoped) return res.status(404).json({ error: "Notification introuvable." });
  await prisma.appNotification.delete({ where: { id } });
  res.status(204).end();
}));
router.post("/notifications/clear", handler(async (req, res) => {
  await prisma.appNotification.deleteMany({ where: notificationScopeWhere(req) });
  res.status(204).end();
}));
var notifications_default = router;

// server/routes/bootstrap.ts
var ENTRY_INCLUDE = {
  auditTrail: true,
  lines: { include: { account: { select: { label: true } } } },
  attachments: { select: { id: true, filename: true, mimeType: true, size: true } }
};
var DOSSIER_INCLUDE = { owner: { select: { name: true } } };
async function buildBootstrapPayload(req) {
  const dossierScope = dossierScopeWhere(req);
  await generateDueRecurring(req);
  await createDeadlineReminders(req);
  const [dossierRows, directoryRows, entryRows, notificationRows, settingsRows, accountRows, invoiceRows, recurringRows, assetRows] = await Promise.all([
    prisma.clientDossier.findMany({
      where: dossierScope,
      include: DOSSIER_INCLUDE,
      orderBy: [{ isMain: "desc" }, { createdAt: "asc" }]
    }),
    prisma.clientDossier.findMany({
      where: { organizationId: getAuthUser(req)?.organizationId ?? "__aucune__" },
      select: { id: true, name: true, isMain: true, ownerName: true, owner: { select: { name: true } } },
      orderBy: [{ isMain: "desc" }, { createdAt: "asc" }]
    }),
    prisma.journalEntry.findMany({
      where: entryScopeWhere(req),
      include: ENTRY_INCLUDE,
      orderBy: { date: "desc" }
    }),
    prisma.appNotification.findMany({
      where: notificationScopeWhere(req),
      orderBy: { timestamp: "desc" }
    }),
    prisma.platformSettings.findMany({ where: { dossier: dossierScope } }),
    // Comptes personnalisés des dossiers visibles (le plan standard est embarqué côté client).
    prisma.syscohadaAccount.findMany({ where: { dossierId: { not: null }, dossier: { is: dossierScope } }, orderBy: { code: "asc" } }),
    prisma.invoice.findMany({
      where: { clientDossier: dossierScope },
      include: { lines: true, payments: true },
      orderBy: { number: "desc" }
    }),
    prisma.recurringEntry.findMany({ where: { active: true, clientDossier: dossierScope }, orderBy: { nextDate: "asc" } }),
    prisma.fixedAsset.findMany({ where: { clientDossier: dossierScope }, orderBy: { acquisitionDate: "asc" } })
  ]);
  return {
    dossiers: dossierRows.map(serializeDossier),
    directory: directoryRows.map((d) => ({ id: d.id, name: d.name, isMain: d.isMain, ownerName: d.owner?.name ?? d.ownerName ?? void 0 })),
    entries: entryRows.map(serializeEntry),
    notifications: notificationRows.map(serializeNotification),
    settingsByDossier: Object.fromEntries(settingsRows.map((r) => [r.dossierId, serializePlatformSettings(r)])),
    accounts: accountRows.map(serializeAccount),
    invoices: invoiceRows.map(serializeInvoice),
    recurring: recurringRows.map(serializeRecurring),
    assets: assetRows.map(serializeAsset)
  };
}

// server/routes/entries.ts
var router2 = Router2();
var EDITABLE = ["draft", "pending_review", "anomaly"];
async function assertAccountsUsable(codes, dossierId) {
  const unique = [...new Set(codes)];
  const found = await prisma.syscohadaAccount.findMany({
    where: { code: { in: unique }, active: true, OR: [{ dossierId: null }, { dossierId }] },
    select: { code: true }
  });
  const known = new Set(found.map((f) => f.code));
  const missing = unique.filter((c) => !known.has(c));
  return missing.length ? `Compte inconnu ou inactif pour ce dossier : ${missing.join(", ")}.` : null;
}
var fr2 = (d) => d.split("-").reverse().join("/");
function lockError(dossier, date) {
  const until = dossier.lockedUntil?.toISOString().slice(0, 10);
  const day2 = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  return isLocked(day2, until) ? `P\xE9riode bloqu\xE9e jusqu'au ${fr2(until)} (d\xE9clar\xE9e ou cl\xF4tur\xE9e) : aucune \xE9criture ne peut y \xEAtre ajout\xE9e ou modifi\xE9e. Pour corriger, passez une contre-passation \xE0 une date ult\xE9rieure.` : null;
}
async function dossierOf(id) {
  return prisma.clientDossier.findUniqueOrThrow({ where: { id }, select: { id: true, lockedUntil: true } });
}
function userId(req) {
  return getAuthUser(req).sub;
}
function autoValidates(e) {
  return e.status === "pending_review" && !e.detectedAnomaly;
}
function autoValidationData(author, uid) {
  return {
    status: "validated",
    validatedById: uid,
    validatedAt: /* @__PURE__ */ new Date(),
    auditTrail: { create: { action: "auto_validated", author, notes: "Valid\xE9e automatiquement (aucune anomalie d\xE9tect\xE9e)." } }
  };
}
var linesCreate = (lines) => ({
  create: lines.map((l, position) => ({ position, accountCode: l.accountCode, label: l.label, debit: l.debit, credit: l.credit }))
});
function numberer(tx, dossierId) {
  const next = /* @__PURE__ */ new Map();
  return async (journal) => {
    if (!next.has(journal)) {
      const last = await tx.journalEntry.aggregate({ where: { clientDossierId: dossierId, journal }, _max: { number: true } });
      next.set(journal, (last._max.number ?? 0) + 1);
    }
    const n = next.get(journal);
    next.set(journal, n + 1);
    return n;
  };
}
var defaultPieceRef = (journal, n) => `${journal}-${String(n).padStart(5, "0")}`;
async function withNumberRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e?.code !== "P2002" || attempt === 2) throw e;
    }
  }
}
function entryCreateData(e, dossierId, number, createdById, author) {
  const auto = autoValidates(e);
  return {
    id: e.id,
    date: new Date(e.date),
    label: e.label,
    pieceRef: e.pieceRef || defaultPieceRef(e.journal, number),
    journal: e.journal,
    number,
    amount: e.amount,
    lines: linesCreate(e.lines),
    clientDossierId: dossierId,
    status: e.status,
    detectedAnomaly: e.detectedAnomaly,
    rawInput: e.rawInput,
    inputType: e.inputType,
    explanationSimplified: e.explanationSimplified,
    paymentMethod: e.paymentMethod,
    createdById,
    ...auto ? { status: "validated", validatedById: createdById, validatedAt: /* @__PURE__ */ new Date() } : {},
    auditTrail: {
      create: [...e.auditTrail.map((a) => ({
        id: a.id,
        timestamp: new Date(a.timestamp),
        action: a.action,
        author: a.author,
        notes: a.notes,
        previousValue: a.previousValue
      })), ...auto ? [autoValidationData(author, createdById).auditTrail.create] : []]
    }
  };
}
router2.post("/entries", handler(async (req, res) => {
  const dossierId = identifier((req.body ?? {}).clientDossierId);
  if (!dossierId) return res.status(400).json({ error: "Dossier comptable invalide." });
  const dossier = await findAccessibleDossier(req, dossierId);
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  const e = unwrap(validateEntryInput(req.body));
  const locked = lockError(dossier, e.date);
  if (locked) return res.status(409).json({ error: locked });
  const accountError = await assertAccountsUsable(e.lines.map((l) => l.accountCode), dossierId);
  if (accountError) return res.status(400).json({ error: accountError });
  const author = await actorName(req);
  const created = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const number = await numberer(tx, dossierId)(e.journal);
    return tx.journalEntry.create({ data: entryCreateData(e, dossierId, number, userId(req), author), include: ENTRY_INCLUDE });
  }));
  res.status(201).json(serializeEntry(created));
}));
router2.post("/entries/import", handler(async (req, res) => {
  const list = Array.isArray((req.body ?? {}).entries) ? req.body.entries : [];
  if (list.length === 0) return res.status(400).json({ error: "Aucune \xE9criture \xE0 importer." });
  if (list.length > 5e3) return res.status(400).json({ error: "Import limit\xE9 \xE0 5000 \xE9critures par op\xE9ration." });
  const author = await actorName(req);
  const rows = [];
  for (const raw of list) {
    const dossierId = identifier(raw?.clientDossierId);
    if (!dossierId) return res.status(400).json({ error: "Une \xE9criture import\xE9e r\xE9f\xE9rence un dossier invalide." });
    const dossier = await findAccessibleDossier(req, dossierId);
    if (!dossier) return res.status(403).json({ error: "Import refus\xE9 : dossier hors de votre p\xE9rim\xE8tre." });
    const e = unwrap(validateEntryInput(raw, { requireId: true }));
    const locked = lockError(dossier, e.date);
    if (locked) return res.status(409).json({ error: `\xAB ${e.label} \xBB : ${locked}` });
    const accountError = await assertAccountsUsable(e.lines.map((l) => l.accountCode), dossierId);
    if (accountError) return res.status(400).json({ error: accountError });
    rows.push({ e, dossierId });
  }
  const created = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const numbers = /* @__PURE__ */ new Map();
    const out = [];
    for (const { e, dossierId } of rows) {
      if (!numbers.has(dossierId)) numbers.set(dossierId, numberer(tx, dossierId));
      const number = await numbers.get(dossierId)(e.journal);
      out.push(await tx.journalEntry.create({ data: entryCreateData(e, dossierId, number, userId(req), author), include: ENTRY_INCLUDE }));
    }
    return out;
  }, { timeout: 12e4, maxWait: 1e4 }));
  res.status(201).json(created.map(serializeEntry));
}));
router2.post("/entries/:id/update", handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant d'\xE9criture invalide." });
  const existing = await findAccessibleEntry(req, id);
  if (!existing) return res.status(404).json({ error: "\xC9criture introuvable." });
  if (!EDITABLE.includes(existing.status)) {
    return res.status(409).json({ error: "\xC9criture valid\xE9e ou annul\xE9e : modification impossible (d\xE9validez-la ou contre-passez-la)." });
  }
  if (existing.invoiceId) {
    return res.status(409).json({ error: "\xC9criture g\xE9n\xE9r\xE9e par une facture : modifiez la facture." });
  }
  const e = unwrap(validateEntryInput(req.body));
  const dossier = await dossierOf(existing.clientDossierId);
  const locked = lockError(dossier, existing.date) ?? lockError(dossier, e.date);
  if (locked) return res.status(409).json({ error: locked });
  const accountError = await assertAccountsUsable(e.lines.map((l) => l.accountCode), existing.clientDossierId);
  if (accountError) return res.status(400).json({ error: accountError });
  const auto = autoValidates(e);
  await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const number = e.journal === existing.journal ? existing.number : await numberer(tx, existing.clientDossierId)(e.journal);
    const keepRef = e.pieceRef && e.pieceRef !== defaultPieceRef(existing.journal, existing.number);
    await tx.journalLine.deleteMany({ where: { entryId: id } });
    await tx.journalEntry.update({
      where: { id },
      data: {
        date: new Date(e.date),
        label: e.label,
        pieceRef: keepRef ? e.pieceRef : defaultPieceRef(e.journal, number),
        journal: e.journal,
        number,
        amount: e.amount,
        lines: linesCreate(e.lines),
        status: e.status,
        detectedAnomaly: e.detectedAnomaly ?? null,
        rawInput: e.rawInput,
        inputType: e.inputType,
        explanationSimplified: e.explanationSimplified,
        paymentMethod: e.paymentMethod,
        updatedById: userId(req)
      }
    });
  }));
  for (const a of e.auditTrail) {
    await prisma.auditLog.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        journalEntryId: id,
        timestamp: new Date(a.timestamp),
        action: a.action,
        author: a.author,
        notes: a.notes,
        previousValue: a.previousValue
      }
    });
  }
  if (auto) {
    await prisma.journalEntry.update({ where: { id }, data: { ...autoValidationData(await actorName(req), userId(req)), detectedAnomaly: null } });
  }
  const fresh = await prisma.journalEntry.findUniqueOrThrow({ where: { id }, include: ENTRY_INCLUDE });
  res.json(serializeEntry(fresh));
}));
router2.post("/entries/:id/submit", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const existing = id ? await findAccessibleEntry(req, id) : null;
  if (!existing) return res.status(404).json({ error: "\xC9criture introuvable." });
  if (existing.status !== "draft") return res.status(409).json({ error: "Seul un brouillon peut \xEAtre soumis \xE0 validation." });
  const row = await prisma.journalEntry.update({
    where: { id: existing.id },
    data: {
      status: "pending_review",
      auditTrail: { create: { action: "submitted_for_review", author: await actorName(req), notes: "Soumise \xE0 validation." } }
    },
    include: ENTRY_INCLUDE
  });
  res.json(serializeEntry(row));
}));
router2.post("/entries/batch-validate", handler(async (req, res) => {
  const user = getAuthUser(req);
  const rawIds = Array.isArray((req.body ?? {}).ids) ? req.body.ids : [];
  const ids = rawIds.map(identifier).filter((v) => Boolean(v));
  if (ids.length === 0) return res.status(400).json({ error: "Aucune \xE9criture \xE0 valider." });
  const author = await actorName(req);
  const validatedIds = [];
  const refused = [];
  for (const id of ids) {
    const entry = await findAccessibleEntry(req, id);
    if (!entry) {
      refused.push({ id, reason: "\xC9criture introuvable." });
      continue;
    }
    if (entry.status !== "pending_review" && entry.status !== "anomaly") {
      refused.push({ id, reason: entry.status === "draft" ? "Brouillon non soumis." : "D\xE9j\xE0 valid\xE9e ou annul\xE9e." });
      continue;
    }
    const locked = lockError(await dossierOf(entry.clientDossierId), entry.date);
    if (locked) {
      refused.push({ id, reason: locked });
      continue;
    }
    await prisma.journalEntry.update({
      where: { id },
      data: {
        status: "validated",
        detectedAnomaly: null,
        validatedById: user.sub,
        validatedAt: /* @__PURE__ */ new Date(),
        auditTrail: { create: { action: "validated_by_expert", author, notes: "Validation d\xE9finitive." } }
      }
    });
    validatedIds.push(id);
  }
  const rows = await prisma.journalEntry.findMany({ where: { id: { in: validatedIds } }, include: ENTRY_INCLUDE });
  res.json({ validated: rows.map(serializeEntry), refused });
}));
router2.post("/entries/:id/unvalidate", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const existing = id ? await findAccessibleEntry(req, id) : null;
  if (!existing) return res.status(404).json({ error: "\xC9criture introuvable." });
  if (existing.status !== "validated") return res.status(409).json({ error: "Seule une \xE9criture valid\xE9e peut \xEAtre d\xE9valid\xE9e." });
  if (existing.invoiceId) return res.status(409).json({ error: "\xC9criture g\xE9n\xE9r\xE9e par une facture : annulez la facture." });
  const locked = lockError(await dossierOf(existing.clientDossierId), existing.date);
  if (locked) return res.status(409).json({ error: locked });
  const row = await prisma.journalEntry.update({
    where: { id: existing.id },
    data: {
      status: "pending_review",
      validatedById: null,
      validatedAt: null,
      auditTrail: { create: { action: "unvalidated", author: await actorName(req), notes: optionalReason(req.body) ?? "D\xE9valid\xE9e." } }
    },
    include: ENTRY_INCLUDE
  });
  res.json(serializeEntry(row));
}));
router2.post("/entries/:id/cancel", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const existing = id ? await findAccessibleEntry(req, id) : null;
  if (!existing) return res.status(404).json({ error: "\xC9criture introuvable." });
  if (existing.status === "cancelled") return res.status(409).json({ error: "\xC9criture d\xE9j\xE0 annul\xE9e." });
  if (existing.invoiceId) return res.status(409).json({ error: "\xC9criture g\xE9n\xE9r\xE9e par une facture : annulez la facture." });
  const locked = lockError(await dossierOf(existing.clientDossierId), existing.date);
  if (locked) return res.status(409).json({ error: locked });
  const author = await actorName(req);
  const [, row] = await prisma.$transaction([
    prisma.invoicePayment.deleteMany({ where: { entryId: existing.id } }),
    prisma.journalEntry.update({
      where: { id: existing.id },
      data: {
        status: "cancelled",
        auditTrail: { create: { action: "cancelled", author, notes: optionalReason(req.body) ?? "Annul\xE9e." } }
      },
      include: ENTRY_INCLUDE
    })
  ]);
  res.json(serializeEntry(row));
}));
router2.post("/entries/:id/reverse", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const existing = id ? await prisma.journalEntry.findFirst({ where: { id }, include: { lines: true, reversals: true } }) : null;
  if (!existing || !await findAccessibleEntry(req, existing.id)) return res.status(404).json({ error: "\xC9criture introuvable." });
  if (existing.status !== "validated") return res.status(409).json({ error: "Seule une \xE9criture valid\xE9e se contre-passe." });
  if (existing.invoiceId) return res.status(409).json({ error: "\xC9criture g\xE9n\xE9r\xE9e par une facture : annulez la facture." });
  if (existing.reversalOfId) return res.status(409).json({ error: "Cette \xE9criture est d\xE9j\xE0 une contre-passation." });
  if (existing.reversals.some((r) => r.status !== "cancelled")) return res.status(409).json({ error: "\xC9criture d\xE9j\xE0 contre-pass\xE9e." });
  const date = isoDate((req.body ?? {}).date) ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const dossier = await dossierOf(existing.clientDossierId);
  const locked = lockError(dossier, date);
  if (locked) return res.status(409).json({ error: locked });
  const user = userId(req);
  const author = await actorName(req);
  const reason = optionalReason(req.body);
  const lines = reversedLines([...existing.lines].sort((a, b) => a.position - b.position).map((l) => ({ accountCode: l.accountCode, label: l.label ?? void 0, debit: Number(l.debit), credit: Number(l.credit) })));
  const label = `Contre-passation ${existing.pieceRef} \u2014 ${existing.label}`.slice(0, 300);
  const reversal = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const number = await numberer(tx, existing.clientDossierId)(existing.journal);
    await tx.invoicePayment.deleteMany({ where: { entryId: existing.id } });
    await tx.auditLog.create({ data: { journalEntryId: existing.id, action: "reversed", author, notes: reason ?? `Contre-pass\xE9e le ${fr2(date)}.` } });
    return tx.journalEntry.create({
      data: {
        date: new Date(date),
        label,
        pieceRef: `CP-${existing.pieceRef}`.slice(0, 80),
        journal: existing.journal,
        number,
        amount: existing.amount,
        lines: linesCreate(lines),
        clientDossierId: existing.clientDossierId,
        status: "validated",
        rawInput: label,
        inputType: "manual",
        paymentMethod: existing.paymentMethod,
        explanationSimplified: `Annule l'\xE9criture ${existing.pieceRef} du ${fr2(existing.date.toISOString().slice(0, 10))} en inversant le d\xE9bit et le cr\xE9dit.`,
        createdById: user,
        validatedById: user,
        validatedAt: /* @__PURE__ */ new Date(),
        reversalOfId: existing.id,
        auditTrail: { create: { action: "reversed", author, notes: reason ?? `Contre-passation de ${existing.pieceRef}.` } }
      },
      include: ENTRY_INCLUDE
    });
  }));
  const original = await prisma.journalEntry.findUniqueOrThrow({ where: { id: existing.id }, include: ENTRY_INCLUDE });
  res.status(201).json({ original: serializeEntry(original), reversal: serializeEntry(reversal) });
}));
var entries_default = router2;

// server/routes/recurring.ts
var router3 = Router3();
function serializeRecurring(r) {
  return {
    id: r.id,
    clientDossierId: r.clientDossierId,
    label: r.label,
    journal: r.journal,
    lines: r.lines,
    day: r.day,
    nextDate: r.nextDate.toISOString().slice(0, 10),
    active: r.active
  };
}
async function generateDueRecurring(req) {
  const user = getAuthUser(req);
  if (!user) return;
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const due = await prisma.recurringEntry.findMany({
    where: { active: true, nextDate: { lte: new Date(today) }, clientDossier: dossierScopeWhere(req) },
    include: { clientDossier: { select: { lockedUntil: true } } }
  });
  if (!due.length) return;
  const author = await actorName(req);
  for (const r of due) {
    let date = r.nextDate.toISOString().slice(0, 10);
    const lines = r.lines;
    for (let i = 0; i < 24 && date <= today; i++, date = nextMonthly(date, r.day)) {
      if (lockError(r.clientDossier, date)) continue;
      await withNumberRetry(() => prisma.$transaction(async (tx) => {
        const number = await numberer(tx, r.clientDossierId)(r.journal);
        await tx.journalEntry.create({
          data: {
            date: new Date(date),
            label: r.label,
            pieceRef: defaultPieceRef(r.journal, number),
            journal: r.journal,
            number,
            amount: totalDebit(lines),
            lines: linesCreate(lines),
            clientDossierId: r.clientDossierId,
            status: "validated",
            validatedById: user.sub,
            validatedAt: /* @__PURE__ */ new Date(),
            createdById: r.createdById,
            rawInput: r.label,
            inputType: "manual",
            paymentMethod: r.paymentMethod,
            explanationSimplified: `\xC9criture r\xE9currente du ${date.split("-").reverse().join("/")}.`,
            auditTrail: { create: { action: "auto_validated", author, notes: "G\xE9n\xE9r\xE9e par une \xE9criture r\xE9currente." } }
          }
        });
      }));
    }
    await prisma.recurringEntry.update({ where: { id: r.id }, data: { nextDate: new Date(date) } });
  }
}
router3.post("/recurring", handler(async (req, res) => {
  const b = req.body ?? {};
  const dossierId = identifier(b.clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  const label = optionalText(b.label, 300);
  const startDate = isoDate(b.startDate);
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 50).map((l) => ({
    accountCode: String(l?.accountCode ?? "").trim().slice(0, 20),
    debit: Math.round((Number(l?.debit) || 0) * 100) / 100,
    credit: Math.round((Number(l?.credit) || 0) * 100) / 100,
    label: optionalText(l?.label, 300) ?? void 0
  }));
  if (!label) return res.status(400).json({ error: "Libell\xE9 requis." });
  if (!startDate) return res.status(400).json({ error: "Date de premi\xE8re \xE9ch\xE9ance invalide." });
  const err = linesError(lines) ?? await assertAccountsUsable(lines.map((l) => l.accountCode), dossier.id);
  if (err) return res.status(400).json({ error: err });
  const row = await prisma.recurringEntry.create({
    data: {
      clientDossierId: dossier.id,
      label,
      lines,
      journal: JOURNAL_CODES.find((j) => j === b.journal) ?? defaultJournal(lines),
      paymentMethod: PAYMENT_METHODS.find((m) => m === b.paymentMethod) ?? "bank_transfer",
      day: Number(startDate.slice(8, 10)),
      nextDate: new Date(startDate),
      createdById: getAuthUser(req).sub
    }
  });
  res.status(201).json(serializeRecurring(row));
}));
router3.post("/recurring/:id/stop", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const row = id ? await prisma.recurringEntry.findUnique({ where: { id } }) : null;
  if (!row || !await findAccessibleDossier(req, row.clientDossierId)) return res.status(404).json({ error: "\xC9criture r\xE9currente introuvable." });
  const updated = await prisma.recurringEntry.update({ where: { id: row.id }, data: { active: false } });
  res.json(serializeRecurring(updated));
}));
var recurring_default = router3;

// server/routes/attachments.ts
init_db();
import { Router as Router4 } from "express";
var router4 = Router4();
var MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
var ALLOWED = /^(application\/pdf|image\/(jpeg|png|webp)|text\/csv|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/vnd\.ms-excel)$/;
router4.post("/entries/:id/attachments", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const entry = id ? await findAccessibleEntry(req, id) : null;
  if (!entry) return res.status(404).json({ error: "\xC9criture introuvable." });
  const b = req.body ?? {};
  const filename = optionalText(b.filename, 200)?.replace(/[\\/\r\n"]/g, "_");
  const mimeType = String(b.mimeType ?? "");
  if (!filename) return res.status(400).json({ error: "Nom de fichier requis." });
  if (!ALLOWED.test(mimeType)) return res.status(400).json({ error: "Format non pris en charge (PDF, image, Excel, CSV ou Word)." });
  const data = typeof b.data === "string" ? Buffer.from(b.data.replace(/^data:[^;]+;base64,/, ""), "base64") : null;
  if (!data?.length) return res.status(400).json({ error: "Fichier vide." });
  if (data.length > MAX_ATTACHMENT_BYTES) return res.status(413).json({ error: "Fichier trop volumineux (3 Mo maximum)." });
  const row = await prisma.attachment.create({
    data: { entryId: entry.id, filename, mimeType, size: data.length, data, createdById: getAuthUser(req).sub },
    select: { id: true, filename: true, mimeType: true, size: true }
  });
  res.status(201).json(row);
}));
router4.get("/attachments/:id", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const row = id ? await prisma.attachment.findUnique({ where: { id } }) : null;
  if (!row || !await findAccessibleEntry(req, row.entryId)) return res.status(404).json({ error: "Pi\xE8ce introuvable." });
  res.setHeader("Content-Type", row.mimeType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(row.filename)}"; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
  res.send(Buffer.from(row.data));
}));
router4.post("/attachments/:id/delete", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const row = id ? await prisma.attachment.findUnique({ where: { id }, select: { id: true, entryId: true } }) : null;
  const entry = row ? await findAccessibleEntry(req, row.entryId) : null;
  if (!row || !entry) return res.status(404).json({ error: "Pi\xE8ce introuvable." });
  const dossier = await prisma.clientDossier.findUniqueOrThrow({ where: { id: entry.clientDossierId }, select: { lockedUntil: true } });
  const locked = lockError(dossier, entry.date);
  if (locked) return res.status(409).json({ error: locked });
  await prisma.attachment.delete({ where: { id: row.id } });
  res.status(204).end();
}));
router4.post("/lines/reconcile", handler(async (req, res) => {
  const b = req.body ?? {};
  const dossierId = identifier(b.clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  const ids = (Array.isArray(b.lineIds) ? b.lineIds : []).map(identifier).filter(Boolean).slice(0, 5e3);
  const date = b.date === null ? null : isoDate(b.date);
  if (!ids.length) return res.status(400).json({ error: "Aucune ligne s\xE9lectionn\xE9e." });
  if (b.date !== null && !date) return res.status(400).json({ error: "Date du relev\xE9 invalide." });
  const where = { id: { in: ids }, accountCode: { startsWith: "5" }, entry: { clientDossierId: dossier.id, status: "validated" } };
  if (await prisma.journalLine.count({ where }) !== ids.length) {
    return res.status(400).json({ error: "Seules les lignes de tr\xE9sorerie (comptes 5) d\u2019\xE9critures valid\xE9es du dossier se pointent." });
  }
  await prisma.journalLine.updateMany({ where, data: { reconciledOn: date ? new Date(date) : null } });
  res.json({ lineIds: ids, reconciledOn: date ?? void 0 });
}));
var attachments_default = router4;

// server/routes/assets.ts
init_db();
init_mappers();
import { Router as Router5 } from "express";

// src/utils/assets.ts
function depreciationSchedule(a) {
  const rows = [];
  if (!(a.cost > 0) || !(a.durationYears > 0)) return rows;
  const annual = a.cost / a.durationYears;
  const [y0, m, d] = a.acquisitionDate.split("-").map(Number);
  const firstDays = (12 - m) * 30 + (30 - Math.min(d, 30) + 1);
  let exact = 0, cumulative = 0;
  for (let year = y0; cumulative < a.cost && year <= y0 + a.durationYears; year++) {
    exact += year === y0 ? annual * firstDays / 360 : annual;
    const amount = Math.min(a.cost, Math.round(exact)) - cumulative;
    cumulative += amount;
    rows.push({ year, amount, cumulative, net: a.cost - cumulative });
  }
  return rows;
}
function amortizationAccountFor(code, exists) {
  for (let n = code.length; n >= 2; n--) {
    const c = "28" + code.slice(1, n);
    if (exists(c)) return c;
  }
  return void 0;
}
var DEPRECIATION_EXPENSE = "6811";

// server/routes/assets.ts
var router5 = Router5();
async function amortAccount(code, dossierId) {
  const rows = await prisma.syscohadaAccount.findMany({
    where: { code: { startsWith: "28" }, active: true, OR: [{ dossierId: null }, { dossierId }] },
    select: { code: true }
  });
  const known = new Set(rows.map((r) => r.code));
  return amortizationAccountFor(code, (c) => known.has(c));
}
router5.post("/assets", handler(async (req, res) => {
  const b = req.body ?? {};
  const dossierId = identifier(b.clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  const label = optionalText(b.label, 200);
  const accountCode = String(b.accountCode ?? "").trim();
  const acquisitionDate = isoDate(b.acquisitionDate);
  const cost = Math.round(Number(b.cost) * 100) / 100;
  const durationYears = Number(b.durationYears);
  const depreciatedThrough = b.depreciatedThrough ? Number(b.depreciatedThrough) : null;
  if (!label) return res.status(400).json({ error: "D\xE9signation requise." });
  if (!/^2[1-7]\d*$/.test(accountCode)) return res.status(400).json({ error: "Compte d\u2019immobilisation attendu (classe 2, hors 28 et 29)." });
  if (!acquisitionDate) return res.status(400).json({ error: "Date d\u2019acquisition invalide." });
  if (!(cost > 0)) return res.status(400).json({ error: "Co\xFBt d\u2019acquisition invalide." });
  if (!Number.isInteger(durationYears) || durationYears < 1 || durationYears > 50) return res.status(400).json({ error: "Dur\xE9e d\u2019amortissement : 1 \xE0 50 ans." });
  if (depreciatedThrough !== null && (!Number.isInteger(depreciatedThrough) || depreciatedThrough < Number(acquisitionDate.slice(0, 4)))) {
    return res.status(400).json({ error: "Exercice des dotations d\xE9j\xE0 pass\xE9es invalide." });
  }
  const err = await assertAccountsUsable([accountCode], dossier.id);
  if (err) return res.status(400).json({ error: err });
  if (!await amortAccount(accountCode, dossier.id)) {
    return res.status(400).json({ error: `Aucun compte d\u2019amortissement 28\u2026 pour ${accountCode} : cr\xE9ez-le dans le plan comptable.` });
  }
  const row = await prisma.fixedAsset.create({
    data: { clientDossierId: dossier.id, label, accountCode, acquisitionDate: new Date(acquisitionDate), cost, durationYears, depreciatedThrough }
  });
  res.status(201).json(serializeAsset(row));
}));
router5.post("/assets/:id/delete", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const row = id ? await prisma.fixedAsset.findUnique({ where: { id } }) : null;
  if (!row || !await findAccessibleDossier(req, row.clientDossierId)) return res.status(404).json({ error: "Immobilisation introuvable." });
  if (row.depreciatedThrough !== null) return res.status(409).json({ error: "Des dotations ont d\xE9j\xE0 \xE9t\xE9 pass\xE9es : contre-passez-les avant de supprimer." });
  await prisma.fixedAsset.delete({ where: { id: row.id } });
  res.status(204).end();
}));
router5.post("/assets/depreciate", handler(async (req, res) => {
  const b = req.body ?? {};
  const dossierId = identifier(b.clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  const year = Number(b.year);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) return res.status(400).json({ error: "Exercice invalide." });
  const assets = await prisma.fixedAsset.findMany({ where: { clientDossierId: dossier.id } });
  const todo = [];
  for (const a of assets) {
    const credit = await amortAccount(a.accountCode, dossier.id);
    if (!credit) return res.status(400).json({ error: `Aucun compte d\u2019amortissement pour ${a.accountCode} (${a.label}).` });
    const schedule = depreciationSchedule({ acquisitionDate: a.acquisitionDate.toISOString().slice(0, 10), cost: Number(a.cost), durationYears: a.durationYears });
    for (const r of schedule) {
      if (r.year > year || a.depreciatedThrough !== null && r.year <= a.depreciatedThrough || r.amount <= 0) continue;
      const locked = lockError(dossier, `${r.year}-12-31`);
      if (locked) return res.status(409).json({ error: `${a.label}, dotation ${r.year} : ${locked}` });
      todo.push({ assetId: a.id, year: r.year, amount: r.amount, label: a.label, credit });
    }
  }
  const err = await assertAccountsUsable([DEPRECIATION_EXPENSE, ...todo.map((t) => t.credit)], dossier.id);
  if (todo.length && err) return res.status(400).json({ error: err });
  const userId2 = getAuthUser(req).sub;
  const author = await actorName(req);
  const created = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const next = numberer(tx, dossier.id);
    const out = [];
    for (const t of todo) {
      const number = await next("OD");
      const label = `Dotation aux amortissements ${t.year} \u2014 ${t.label}`.slice(0, 300);
      out.push(await tx.journalEntry.create({
        data: {
          date: /* @__PURE__ */ new Date(`${t.year}-12-31`),
          label,
          pieceRef: defaultPieceRef("OD", number),
          journal: "OD",
          number,
          amount: t.amount,
          clientDossierId: dossier.id,
          status: "validated",
          validatedById: userId2,
          validatedAt: /* @__PURE__ */ new Date(),
          createdById: userId2,
          rawInput: label,
          inputType: "manual",
          paymentMethod: "bank_transfer",
          explanationSimplified: `Usure de l'ann\xE9e ${t.year} de \xAB ${t.label} \xBB, constat\xE9e en charge.`,
          lines: linesCreate([
            { accountCode: DEPRECIATION_EXPENSE, debit: t.amount, credit: 0 },
            { accountCode: t.credit, debit: 0, credit: t.amount }
          ]),
          auditTrail: { create: { action: "auto_validated", author, notes: "Dotation g\xE9n\xE9r\xE9e depuis le registre des immobilisations." } }
        },
        include: ENTRY_INCLUDE
      }));
    }
    await tx.fixedAsset.updateMany({
      where: { clientDossierId: dossier.id, OR: [{ depreciatedThrough: null }, { depreciatedThrough: { lt: year } }] },
      data: { depreciatedThrough: year }
    });
    return out;
  }));
  const fresh = await prisma.fixedAsset.findMany({ where: { clientDossierId: dossier.id }, orderBy: { acquisitionDate: "asc" } });
  res.status(201).json({ entries: created.map(serializeEntry), assets: fresh.map(serializeAsset) });
}));
var assets_default = router5;

// server/routes/dossiers.ts
init_db();
init_mappers();
import { Router as Router6 } from "express";
init_seedData();
var router6 = Router6();
var dossierData = (d) => ({
  name: d.name,
  managerName: d.managerName,
  phone: d.phone,
  activity: d.activity,
  city: d.city,
  country: d.country,
  rccm: d.rccm,
  ifu: d.ifu,
  regimeFiscal: REGIME_FISCAL_TO_DB[d.regimeFiscal],
  currency: d.currency
});
var mainOnly = (res) => res.status(403).json({ error: "R\xE9serv\xE9 au compte principal de l'entreprise." });
router6.get("/dossiers", handler(async (req, res) => {
  const rows = await prisma.clientDossier.findMany({
    where: dossierScopeWhere(req),
    include: DOSSIER_INCLUDE,
    orderBy: [{ isMain: "desc" }, { createdAt: "asc" }]
  });
  res.json(rows.map(serializeDossier));
}));
router6.get("/dossiers/:id", handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant de dossier invalide." });
  const dossier = await findAccessibleDossier(req, id);
  if (!dossier) {
    const sameOrg = await prisma.clientDossier.findFirst({ where: { id, organizationId: getAuthUser(req)?.organizationId ?? "" }, select: { id: true } });
    return sameOrg ? res.status(403).json({ error: NO_ACCESS }) : res.status(404).json({ error: "Dossier introuvable." });
  }
  const [full, entryRows] = await Promise.all([
    prisma.clientDossier.findUnique({ where: { id }, include: DOSSIER_INCLUDE }),
    prisma.journalEntry.findMany({ where: { clientDossierId: id }, include: ENTRY_INCLUDE, orderBy: { date: "desc" } })
  ]);
  res.json({ dossier: serializeDossier(full), entries: entryRows });
}));
router6.post("/company", handler(async (req, res) => {
  if (!isMainAccount(req)) return mainOnly(res);
  const organizationId = getAuthUser(req).organizationId;
  if (await prisma.clientDossier.findFirst({ where: { organizationId, isMain: true } })) {
    return res.status(409).json({ error: "Les informations de l'entreprise sont d\xE9j\xE0 enregistr\xE9es." });
  }
  const d = unwrap(validateDossierInput(req.body));
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.clientDossier.create({ data: { ...dossierData(d), organizationId, isMain: true } });
    await createDefaultPlatformSettings(tx, row.id);
    await tx.organization.update({ where: { id: organizationId }, data: { name: d.name } });
    return tx.clientDossier.findUniqueOrThrow({ where: { id: row.id }, include: DOSSIER_INCLUDE });
  });
  res.status(201).json(serializeDossier(created));
}));
router6.post("/dossiers", handler(async (req, res) => {
  if (!isMainAccount(req)) return mainOnly(res);
  const organizationId = getAuthUser(req).organizationId;
  const { name, ownerName } = req.body ?? {};
  const cleanName = typeof name === "string" ? name.trim().slice(0, 160) : "";
  const cleanOwner = typeof ownerName === "string" ? ownerName.trim().slice(0, 120) : "";
  if (!cleanName) return res.status(400).json({ error: "Nom du dossier requis." });
  const main = await prisma.clientDossier.findFirst({ where: { organizationId, isMain: true }, include: { settings: true } });
  if (!main) return res.status(400).json({ error: "Renseignez d'abord les informations de l'entreprise." });
  const created = await prisma.$transaction(async (tx) => {
    const { id: _id, isMain: _m, createdAt: _c, updatedAt: _u, lockedUntil: _l, settings, ...fiscal } = main;
    const row = await tx.clientDossier.create({ data: { ...fiscal, name: cleanName, ownerName: cleanOwner || null, isMain: false } });
    if (settings) await tx.platformSettings.create({ data: { ...copySettings(settings), dossierId: row.id } });
    else await createDefaultPlatformSettings(tx, row.id);
    return tx.clientDossier.findUniqueOrThrow({ where: { id: row.id }, include: DOSSIER_INCLUDE });
  });
  res.status(201).json(serializeDossier(created));
}));
router6.post("/dossiers/:id/update", handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant de dossier invalide." });
  const existing = await findAccessibleDossier(req, id);
  if (!existing) return res.status(404).json({ error: "Dossier introuvable." });
  const d = unwrap(validateDossierInput(req.body));
  const updated = await prisma.clientDossier.update({ where: { id }, data: dossierData(d), include: DOSSIER_INCLUDE });
  if (existing.isMain) await prisma.organization.update({ where: { id: existing.organizationId }, data: { name: d.name } });
  res.json(serializeDossier(updated));
}));
router6.post("/dossiers/:id/lock", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const dossier = id ? await findAccessibleDossier(req, id) : null;
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  const raw = (req.body ?? {}).until;
  const until = raw === null ? null : isoDate(raw);
  if (raw !== null && !until) return res.status(400).json({ error: "Date de blocage invalide." });
  const current = dossier.lockedUntil?.toISOString().slice(0, 10) ?? null;
  const backwards = current && (!until || until < current);
  if (backwards && !isMainAccount(req)) {
    return res.status(403).json({ error: "D\xE9bloquer une p\xE9riode est r\xE9serv\xE9 au compte principal de l'entreprise." });
  }
  if (until && !backwards) {
    const open = await prisma.journalEntry.count({
      where: { clientDossierId: dossier.id, date: { lte: new Date(until) }, status: { in: ["draft", "pending_review", "anomaly"] } }
    });
    if (open) {
      return res.status(409).json({ error: `${open} \xE9criture(s) de la p\xE9riode ne sont pas valid\xE9es : validez-les ou annulez-les avant de bloquer.` });
    }
  }
  const updated = await prisma.clientDossier.update({
    where: { id: dossier.id },
    data: { lockedUntil: until ? new Date(until) : null },
    include: DOSSIER_INCLUDE
  });
  res.json(serializeDossier(updated));
}));
router6.post("/dossiers/:id/delete", handler(async (req, res) => {
  const id = identifier(req.params.id);
  if (!id) return res.status(400).json({ error: "Identifiant de dossier invalide." });
  const existing = await findAccessibleDossier(req, id);
  if (!existing) return res.status(404).json({ error: "Dossier introuvable." });
  if (!isMainAccount(req)) return mainOnly(res);
  if (existing.isMain) return res.status(400).json({ error: "La comptabilit\xE9 de l'entreprise ne peut pas \xEAtre supprim\xE9e." });
  await prisma.clientDossier.delete({ where: { id } });
  res.status(204).end();
}));
var dossiers_default = router6;

// server/routes/settings.ts
init_db();
init_mappers();
init_seedData();
import { Router as Router7 } from "express";
var router7 = Router7();
router7.get("/settings", handler(async (req, res) => {
  const dossierId = identifier(req.query.dossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  const row = await prisma.platformSettings.findUnique({ where: { dossierId: dossier.id } }) ?? await createDefaultPlatformSettings(prisma, dossier.id);
  res.json(serializePlatformSettings(row));
}));
router7.post("/settings/update", handler(async (req, res) => {
  const dossierId = identifier((req.body ?? {}).dossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  const data = settingsData(unwrap(validateSettingsInput(req.body)));
  const propagated = dossier.isMain && isMainAccount(req);
  const targets = propagated ? (await prisma.clientDossier.findMany({ where: { organizationId: dossier.organizationId }, select: { id: true } })).map((d) => d.id) : [dossier.id];
  await prisma.$transaction(targets.map((id) => prisma.platformSettings.upsert({ where: { dossierId: id }, update: data, create: { ...data, dossierId: id } })));
  const saved = await prisma.platformSettings.findUniqueOrThrow({ where: { dossierId: dossier.id } });
  res.json({ settings: serializePlatformSettings(saved), propagated });
}));
var settings_default = router7;

// server/routes/backup.ts
init_db();
import { Router as Router8 } from "express";
import { randomUUID } from "node:crypto";
var router8 = Router8();
var optionalId = (v) => identifier(v) ?? null;
var optionalDate = (v) => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
router8.post("/import-backup", handler(async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: "Authentification requise." });
  const body = req.body ?? {};
  const dossiers = Array.isArray(body.dossiers) ? body.dossiers : [];
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (dossiers.length === 0 && entries.length === 0) {
    return res.status(400).json({ error: "Sauvegarde vide ou invalide." });
  }
  if (dossiers.length > 500 || entries.length > 2e4) {
    return res.status(400).json({ error: "Sauvegarde trop volumineuse (500 dossiers / 20000 \xE9critures maximum)." });
  }
  const restorable = /* @__PURE__ */ new Map();
  for (const raw of dossiers) {
    const id = identifier(raw?.id);
    const parsed = validateDossierInput(raw);
    if (!id || !parsed.ok || !await findAccessibleDossier(req, id)) continue;
    restorable.set(id, parsed.data);
  }
  if (restorable.size === 0) {
    return res.status(400).json({ error: "Aucun dossier de cette sauvegarde ne correspond \xE0 vos dossiers." });
  }
  const dossierIds = [...restorable.keys()];
  const [accounts, invoices] = await Promise.all([
    prisma.syscohadaAccount.findMany({ where: { OR: [{ dossierId: null }, { dossierId: { in: dossierIds } }] }, select: { code: true, dossierId: true } }),
    prisma.invoice.findMany({ where: { clientDossierId: { in: dossierIds } }, select: { id: true, clientDossierId: true } })
  ]);
  const accountOk = (code, dossierId) => accounts.some((a) => a.code === code && (a.dossierId === null || a.dossierId === dossierId));
  const invoiceDossier = new Map(invoices.map((i) => [i.id, i.clientDossierId]));
  const errors = [];
  const usedIds = /* @__PURE__ */ new Set();
  const entryRows = [];
  const lineRows = [];
  const auditRows = [];
  entries.forEach((raw, i) => {
    const dossierId = identifier(raw?.clientDossierId);
    if (!dossierId || !restorable.has(dossierId)) return;
    const where = `\xE9criture n\xB0${i + 1} \xAB ${String(raw?.label ?? "").slice(0, 40)} \xBB`;
    const parsed = validateEntryInput(raw, { trusted: true });
    if (!parsed.ok) return void errors.push(`${where} : ${parsed.error}`);
    const e = parsed.data;
    const unknown = [...new Set(e.lines.map((l) => l.accountCode))].filter((c) => !accountOk(c, dossierId));
    if (unknown.length) return void errors.push(`${where} : compte inconnu ${unknown.join(", ")}`);
    let id = identifier(raw?.id);
    if (!id || usedIds.has(id)) id = randomUUID();
    usedIds.add(id);
    const invoiceId = optionalId(raw?.invoiceId);
    entryRows.push({
      id,
      date: new Date(e.date),
      label: e.label,
      pieceRef: e.pieceRef,
      journal: e.journal,
      number: Number(raw?.number) || 0,
      // renuméroté ci-dessous
      amount: e.amount,
      clientDossierId: dossierId,
      status: e.status,
      detectedAnomaly: e.detectedAnomaly,
      rawInput: e.rawInput,
      inputType: e.inputType,
      explanationSimplified: e.explanationSimplified,
      paymentMethod: e.paymentMethod,
      createdById: optionalId(raw?.createdById),
      updatedById: optionalId(raw?.updatedById),
      validatedById: optionalId(raw?.validatedById),
      validatedAt: optionalDate(raw?.validatedAt),
      invoiceId: invoiceId && invoiceDossier.get(invoiceId) === dossierId ? invoiceId : null,
      reversalOfId: optionalId(raw?.reversalOfId)
    });
    e.lines.forEach((l, position) => lineRows.push({
      entryId: id,
      position,
      accountCode: l.accountCode,
      label: l.label,
      debit: l.debit,
      credit: l.credit,
      reconciledOn: Array.isArray(raw?.lines) ? optionalDate(raw.lines[position]?.reconciledOn) : null
    }));
    for (const a of e.auditTrail) {
      auditRows.push({
        id: a.id,
        journalEntryId: id,
        timestamp: new Date(a.timestamp),
        action: a.action,
        author: a.author,
        notes: a.notes,
        previousValue: a.previousValue
      });
    }
  });
  const used = /* @__PURE__ */ new Map();
  const keyOf = (row) => `${row.clientDossierId}|${row.journal}`;
  const missing = [];
  for (const row of entryRows) {
    const set = used.get(keyOf(row)) ?? /* @__PURE__ */ new Set();
    used.set(keyOf(row), set);
    if (Number.isInteger(row.number) && row.number > 0 && !set.has(row.number)) set.add(row.number);
    else missing.push(row);
  }
  for (const row of missing.sort((a, b) => +new Date(a.date) - +new Date(b.date))) {
    const set = used.get(keyOf(row));
    row.number = Math.max(0, ...set) + 1;
    set.add(row.number);
    if (!row.pieceRef) row.pieceRef = defaultPieceRef(row.journal, row.number);
  }
  for (const row of entryRows) if (row.reversalOfId && !usedIds.has(row.reversalOfId)) row.reversalOfId = null;
  if (errors.length) {
    return res.status(400).json({
      error: `Sauvegarde non restaur\xE9e, rien n'a \xE9t\xE9 modifi\xE9. ${errors.length} \xE9criture(s) refus\xE9e(s) : ${errors.slice(0, 3).join(" ; ")}${errors.length > 3 ? "\u2026" : ""}`
    });
  }
  await prisma.$transaction(async (tx) => {
    const payments = await tx.invoicePayment.findMany({ where: { entry: { clientDossierId: { in: dossierIds } } } });
    const attachments = await tx.attachment.findMany({ where: { entry: { clientDossierId: { in: dossierIds } } } });
    await tx.appNotification.deleteMany({ where: { dossierId: { in: dossierIds } } });
    await tx.journalEntry.deleteMany({ where: { clientDossierId: { in: dossierIds } } });
    for (const [id, data] of restorable) await tx.clientDossier.update({ where: { id }, data: dossierData(data) });
    await tx.journalEntry.createMany({ data: entryRows.map((r) => ({ ...r, reversalOfId: null })) });
    for (const r of entryRows.filter((r2) => r2.reversalOfId)) {
      await tx.journalEntry.update({ where: { id: r.id }, data: { reversalOfId: r.reversalOfId } });
    }
    await tx.journalLine.createMany({ data: lineRows });
    await tx.auditLog.createMany({ data: auditRows, skipDuplicates: true });
    const kept = payments.filter((p) => usedIds.has(p.entryId));
    if (kept.length) await tx.invoicePayment.createMany({ data: kept });
    const keptFiles = attachments.filter((a) => usedIds.has(a.entryId));
    if (keptFiles.length) await tx.attachment.createMany({ data: keptFiles });
  }, { timeout: 12e4, maxWait: 1e4 });
  res.json(await buildBootstrapPayload(req));
}));
var backup_default = router8;

// server/routes/accounts.ts
init_db();
init_mappers();
import { Router as Router9 } from "express";
var router9 = Router9();
router9.post("/accounts", handler(async (req, res) => {
  const a = unwrap(validateAccountInput(req.body));
  const dossier = await findAccessibleDossier(req, a.dossierId);
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  const parent = await prisma.syscohadaAccount.findFirst({
    where: { code: a.parentCode, OR: [{ dossierId: null }, { dossierId: a.dossierId }] }
  });
  if (!parent) return res.status(400).json({ error: `Compte parent ${a.parentCode} introuvable.` });
  const taken = await prisma.syscohadaAccount.findUnique({ where: { code: a.code } });
  if (taken) {
    return res.status(409).json({
      error: taken.dossierId && taken.dossierId !== a.dossierId ? `Le code ${a.code} est d\xE9j\xE0 utilis\xE9 par un autre dossier : choisissez un autre code (ex. ${a.code}1).` : `Le compte ${a.code} existe d\xE9j\xE0.`
    });
  }
  const row = await prisma.syscohadaAccount.create({
    data: {
      code: a.code,
      label: a.label,
      classNumber: Number(a.code[0]),
      category: parent.category,
      parentCode: parent.code,
      dossierId: a.dossierId
    }
  });
  res.status(201).json(serializeAccount(row));
}));
router9.post("/accounts/:code/update", handler(async (req, res) => {
  const code = identifier(req.params.code);
  const row = code ? await prisma.syscohadaAccount.findUnique({ where: { code } }) : null;
  if (!row || !row.dossierId || !await findAccessibleDossier(req, row.dossierId)) {
    return res.status(404).json({ error: "Compte personnalis\xE9 introuvable (le plan standard n'est pas modifiable)." });
  }
  const { label, active } = req.body ?? {};
  const data = {};
  if (typeof label === "string" && label.trim()) data.label = label.trim().slice(0, 120);
  if (typeof active === "boolean") data.active = active;
  const updated = await prisma.syscohadaAccount.update({ where: { code: row.code }, data });
  res.json(serializeAccount(updated));
}));
var accounts_default = router9;

// server/routes/invoices.ts
init_db();
init_mappers();
import { Router as Router10 } from "express";

// src/utils/invoices.ts
function computeInvoiceTotals(lines, vatRate) {
  const amounts = lines.map((l) => Math.round(l.quantity * l.unitPrice));
  const totalHT = amounts.reduce((s, a) => s + a, 0);
  const totalTVA = Math.round(totalHT * vatRate / 100);
  return { amounts, totalHT, totalTVA, totalTTC: totalHT + totalTVA };
}
var KIND_LABEL = { sale: "Facture", credit_note: "Avoir", purchase: "Facture fournisseur" };
var KIND_PREFIX = { sale: "FAC", credit_note: "AV", purchase: "FF" };
var isSupplierSide = (kind) => kind === "purchase";
var line = (accountCode, debit, credit) => ({ accountCode, debit, credit });
function invoicePostings(inv, treasuryCode) {
  const kind = inv.kind ?? "sale";
  const tiers = inv.customerAccountCode, nature = inv.salesAccountCode;
  const tva = inv.totalTVA > 0;
  const lines = kind === "sale" ? [line(tiers, inv.totalTTC, 0), line(nature, 0, inv.totalHT), ...tva ? [line(TVA_COLLECTED, 0, inv.totalTVA)] : []] : kind === "credit_note" ? [line(nature, inv.totalHT, 0), ...tva ? [line(TVA_COLLECTED, inv.totalTVA, 0)] : [], line(tiers, 0, inv.totalTTC)] : [line(nature, inv.totalHT, 0), ...tva ? [line(TVA_DEDUCTIBLE, inv.totalTVA, 0)] : [], line(tiers, 0, inv.totalTTC)];
  const ref = kind === "purchase" && inv.externalRef ? `${inv.number} (${inv.externalRef})` : inv.number;
  const sale = {
    label: `${KIND_LABEL[kind]} ${ref} \u2014 ${inv.customerName}`,
    journal: kind === "purchase" ? "AC" : "VT",
    amount: inv.totalTTC,
    lines
  };
  const payLines = inv.mode === "cash" && treasuryCode && kind !== "credit_note" ? kind === "purchase" ? [line(tiers, inv.totalTTC, 0), line(treasuryCode, 0, inv.totalTTC)] : [line(treasuryCode, inv.totalTTC, 0), line(tiers, 0, inv.totalTTC)] : void 0;
  const payment = payLines ? { label: `R\xE8glement comptant ${KIND_LABEL[kind].toLowerCase()} ${ref}`, journal: defaultJournal(payLines), amount: inv.totalTTC, lines: payLines } : void 0;
  return { sale, payment };
}
function settlementAmount(e, kind) {
  return isSupplierSide(kind) ? e.lines.filter((l) => l.accountCode.startsWith("40")).reduce((s, l) => s + l.debit, 0) : e.lines.filter((l) => l.accountCode.startsWith("411")).reduce((s, l) => s + l.credit, 0);
}
function paidAmount(inv) {
  return inv.payments.reduce((s, p) => s + p.amount, 0);
}

// src/utils/paymentAccounts.ts
var TREASURY_ACCOUNT = {
  cash: { code: "5711", label: "Caisse principale (esp\xE8ces)" },
  orange_money: { code: "5261", label: "Portefeuille Orange Money Entreprise" },
  mtn_momo: { code: "5262", label: "Portefeuille MTN Mobile Money" },
  wave: { code: "5263", label: "Portefeuille Wave Business" },
  moov_money: { code: "5264", label: "Portefeuille Moov Money" },
  bank_transfer: { code: "5211", label: "Banque locale (Ecobank, Coris, SG, UBA)" },
  cheque: { code: "5211", label: "Banque locale (Ecobank, Coris, SG, UBA)" }
};
var PAYMENT_METHOD_LABEL = {
  cash: "Esp\xE8ces",
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  wave: "Wave",
  moov_money: "Moov Money",
  bank_transfer: "Virement bancaire",
  cheque: "Ch\xE8que bancaire"
};
var PAYMENT_METHOD_VIA = {
  cash: "en esp\xE8ces",
  orange_money: "par Orange Money",
  mtn_momo: "par MTN MoMo",
  wave: "par Wave",
  moov_money: "par Moov Money",
  bank_transfer: "par virement bancaire",
  cheque: "par ch\xE8que bancaire"
};
var PAYMENT_METHOD_WALLET = {
  cash: "caisse",
  orange_money: "compte Orange Money",
  mtn_momo: "compte MTN MoMo",
  wave: "compte Wave",
  moov_money: "compte Moov Money",
  bank_transfer: "compte bancaire",
  cheque: "compte bancaire"
};
function treasuryAccountFor(method) {
  return TREASURY_ACCOUNT[method] ?? TREASURY_ACCOUNT.cash;
}
function isTreasuryCode(code) {
  return code.startsWith("5");
}
function normalizeText(text2) {
  return text2.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'");
}
var METHOD_PATTERNS = [
  { method: "orange_money", re: /\borange\s*-?\s*money\b|\bom\b|\bo\.m\.?\b|\b(?:par|via|avec|en|sur)\s+orange\b/g },
  { method: "mtn_momo", re: /\bmomo\b|\bmtn\s*-?\s*(?:momo|mobile\s*money|money)\b|\bmobile\s*money\s*mtn\b|\b(?:par|via|avec|en|sur)\s+mtn\b/g },
  { method: "wave", re: /\bwave\b/g },
  { method: "moov_money", re: /\bmoov\s*-?\s*(?:money|africa\s*money)\b|\bflooz\b|\b(?:par|via|avec|en|sur)\s+moov\b/g },
  { method: "cheque", re: /\bcheques?\b|\bchq\b/g },
  {
    method: "bank_transfer",
    re: /\bvirements?\b|\bbanque\b|\bbancaires?\b|\becobank\b|\bcoris\b|\bbicec\b|\bboa\b|\bsgbci\b|\bsociete\s+generale\b|\buba\b|\bbni\b|\bnsia\b|\bafriland\b|\bbhci\b|\bcarte\s+bancaire\b|\bpar\s+carte\b|\bswift\b/g
  },
  { method: "cash", re: /\bcash\b|\bespeces?\b|\bliquides?\b|\ben\s+main\b|\bcaisse\b|\bcomptant\b/g }
];
var CUE_BEFORE = /(?:paye|payee?s?|paiement|regle|reglee?s?|reglement|par|via|avec|en|sur|depuis|de)\s*$/;
function detectAllPaymentMethods(text2) {
  const norm = normalizeText(text2);
  const found = [];
  for (const { method, re } of METHOD_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(norm)) !== null) {
      const before = norm.slice(Math.max(0, m.index - 16), m.index);
      found.push({ method, index: m.index, cued: CUE_BEFORE.test(before) || /^(?:par|via|avec|en|sur)\b/.test(m[0]) });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found.filter((f, i) => !(f.method === "bank_transfer" && found.some((o, j) => j !== i && o.method === "cheque" && Math.abs(o.index - f.index) < 25)));
}
function detectPaymentMethod(text2) {
  const all = detectAllPaymentMethods(text2);
  if (all.length === 0) return void 0;
  const cued = all.find((a) => a.cued);
  return (cued ?? all[0]).method;
}

// server/routes/invoices.ts
var router10 = Router10();
var INVOICE_INCLUDE = { lines: true, payments: true };
async function relatedInvoices(originalInvoiceId) {
  if (!originalInvoiceId) return [];
  const row = await prisma.invoice.findUnique({ where: { id: originalInvoiceId }, include: INVOICE_INCLUDE });
  return row ? [serializeInvoice(row)] : [];
}
async function findAccessibleInvoice(req, id) {
  if (!id) return null;
  const inv = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
  if (!inv || !await findAccessibleDossier(req, inv.clientDossierId)) return null;
  return inv;
}
function invoiceData(d) {
  const totals = computeInvoiceTotals(d.lines, d.vatRate);
  return {
    kind: d.kind,
    externalRef: d.externalRef,
    originalInvoiceId: d.originalInvoiceId,
    date: new Date(d.date),
    dueDate: new Date(d.dueDate),
    mode: d.mode,
    paymentMethod: d.paymentMethod,
    customerName: d.customerName,
    customerPhone: d.customerPhone,
    customerEmail: d.customerEmail,
    customerAddress: d.customerAddress,
    customerTaxId: d.customerTaxId,
    customerAccountCode: d.customerAccountCode,
    salesAccountCode: d.salesAccountCode,
    vatRate: d.vatRate,
    totalHT: totals.totalHT,
    totalTVA: totals.totalTVA,
    totalTTC: totals.totalTTC,
    paymentTerms: d.paymentTerms,
    notes: d.notes,
    lines: {
      create: d.lines.map((l, i) => ({ position: i, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amountHT: totals.amounts[i] }))
    }
  };
}
async function nextNumber(dossierId, date, kind) {
  const prefix = `${KIND_PREFIX[kind]}-${date.slice(0, 4)}-`;
  const last = await prisma.invoice.findFirst({
    where: { clientDossierId: dossierId, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true }
  });
  const n = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}
async function checkAccounts(d, dossierId) {
  const codes = [d.customerAccountCode, d.salesAccountCode, d.kind === "purchase" ? "4452" : "4431"];
  if (d.mode === "cash" && d.paymentMethod) codes.push(treasuryAccountFor(d.paymentMethod).code);
  return assertAccountsUsable(codes, dossierId);
}
async function creditNoteError(d, dossierId, selfId) {
  if (d.kind !== "credit_note") return null;
  const orig = d.originalInvoiceId ? await prisma.invoice.findUnique({ where: { id: d.originalInvoiceId }, include: { creditNotes: true } }) : null;
  if (!orig || orig.clientDossierId !== dossierId || orig.kind !== "sale") return "Facture d'origine introuvable dans ce dossier.";
  if (orig.status !== "validated") return "La facture d'origine doit \xEAtre valid\xE9e.";
  const already = orig.creditNotes.filter((c) => c.id !== selfId && c.status !== "cancelled").reduce((s, c) => s + Number(c.totalTTC), 0);
  const max = Number(orig.totalTTC) - already;
  return d.totalTTC > max + 1e-3 ? `L'avoir d\xE9passe le montant restant \xE0 cr\xE9diter sur ${orig.number} (${max.toLocaleString("fr-FR")}).` : null;
}
router10.post("/invoices", handler(async (req, res) => {
  const dossierId = identifier((req.body ?? {}).clientDossierId);
  const dossier = dossierId ? await findAccessibleDossier(req, dossierId) : null;
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  const d = unwrap(validateInvoiceInput(req.body));
  const accountError = await checkAccounts(d, dossier.id) ?? await creditNoteError({ ...d, totalTTC: computeInvoiceTotals(d.lines, d.vatRate).totalTTC }, dossier.id);
  if (accountError) return res.status(400).json({ error: accountError });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await prisma.invoice.create({
        data: {
          ...invoiceData(d),
          clientDossierId: dossier.id,
          number: await nextNumber(dossier.id, d.date, d.kind),
          status: req.body?.submit === true ? "pending_review" : "draft",
          createdById: getAuthUser(req).sub
        },
        include: INVOICE_INCLUDE
      });
      return res.status(201).json(serializeInvoice(row));
    } catch (e) {
      if (e?.code !== "P2002" || attempt === 2) throw e;
    }
  }
}));
router10.post("/invoices/:id/update", handler(async (req, res) => {
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: "Facture introuvable." });
  if (inv.status !== "draft" && inv.status !== "pending_review") {
    return res.status(409).json({ error: "Facture valid\xE9e ou annul\xE9e : modification impossible." });
  }
  const d = unwrap(validateInvoiceInput({ ...req.body, kind: inv.kind, originalInvoiceId: inv.originalInvoiceId }));
  const accountError = await checkAccounts(d, inv.clientDossierId) ?? await creditNoteError({ ...d, totalTTC: computeInvoiceTotals(d.lines, d.vatRate).totalTTC }, inv.clientDossierId, inv.id);
  if (accountError) return res.status(400).json({ error: accountError });
  const [, row] = await prisma.$transaction([
    prisma.invoiceLine.deleteMany({ where: { invoiceId: inv.id } }),
    prisma.invoice.update({
      where: { id: inv.id },
      data: { ...invoiceData(d), status: req.body?.submit === true ? "pending_review" : inv.status, updatedById: getAuthUser(req).sub },
      include: INVOICE_INCLUDE
    })
  ]);
  res.json(serializeInvoice(row));
}));
router10.post("/invoices/:id/submit", handler(async (req, res) => {
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: "Facture introuvable." });
  if (inv.status !== "draft") return res.status(409).json({ error: "Seul un brouillon peut \xEAtre soumis." });
  const row = await prisma.invoice.update({ where: { id: inv.id }, data: { status: "pending_review" }, include: INVOICE_INCLUDE });
  res.json(serializeInvoice(row));
}));
router10.post("/invoices/:id/validate", handler(async (req, res) => {
  const user = getAuthUser(req);
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: "Facture introuvable." });
  if (!["draft", "pending_review"].includes(inv.status)) return res.status(409).json({ error: "Cette facture ne peut plus \xEAtre valid\xE9e." });
  const dossier = await prisma.clientDossier.findUniqueOrThrow({ where: { id: inv.clientDossierId } });
  const locked = lockError(dossier, inv.date) ?? await creditNoteError({ kind: inv.kind, originalInvoiceId: inv.originalInvoiceId, totalTTC: Number(inv.totalTTC) }, inv.clientDossierId, inv.id);
  if (locked) return res.status(409).json({ error: locked });
  const author = await actorName(req);
  const invoice = serializeInvoice(inv);
  const treasury = invoice.paymentMethod ? treasuryAccountFor(invoice.paymentMethod).code : void 0;
  const { sale, payment } = invoicePostings(invoice, treasury);
  const now = /* @__PURE__ */ new Date();
  const base = {
    date: inv.date,
    pieceRef: inv.number,
    clientDossierId: inv.clientDossierId,
    status: "validated",
    rawInput: `${KIND_LABEL[inv.kind]} ${inv.number}`,
    inputType: "manual",
    paymentMethod: inv.paymentMethod ?? "bank_transfer",
    createdById: inv.createdById,
    validatedById: user.sub,
    validatedAt: now,
    invoiceId: inv.id
  };
  const entryData = (p, number) => ({
    ...base,
    label: p.label,
    journal: p.journal,
    number,
    amount: p.amount,
    lines: linesCreate(p.lines),
    explanationSimplified: `${p.label} : ${p.amount.toLocaleString("fr-FR")}.`,
    auditTrail: { create: { action: "validated_by_expert", author, notes: `G\xE9n\xE9r\xE9e \xE0 la validation de ${KIND_LABEL[inv.kind].toLowerCase()} ${inv.number}.` } }
  });
  const created = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const next = numberer(tx, inv.clientDossierId);
    const saleEntry = await tx.journalEntry.create({ data: entryData(sale, await next(sale.journal)) });
    const ids = [saleEntry.id];
    if (inv.kind === "credit_note" && inv.originalInvoiceId) {
      const orig = await tx.invoice.findUniqueOrThrow({ where: { id: inv.originalInvoiceId }, include: { payments: true } });
      const due = Number(orig.totalTTC) - orig.payments.reduce((s, p) => s + Number(p.amount), 0);
      const amount = Math.min(due, Number(inv.totalTTC));
      if (amount > 0) await tx.invoicePayment.create({ data: { invoiceId: orig.id, entryId: saleEntry.id, amount, createdById: user.sub } });
    }
    if (payment) {
      const pay = await tx.journalEntry.create({ data: entryData(payment, await next(payment.journal)) });
      ids.push(pay.id);
      await tx.invoicePayment.create({ data: { invoiceId: inv.id, entryId: pay.id, amount: payment.amount, createdById: user.sub } });
    }
    await tx.invoice.update({ where: { id: inv.id }, data: { status: "validated", validatedById: user.sub, validatedAt: now } });
    return ids;
  }));
  const [fresh, entries] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: INVOICE_INCLUDE }),
    prisma.journalEntry.findMany({ where: { id: { in: created } }, include: ENTRY_INCLUDE })
  ]);
  res.json({ invoice: serializeInvoice(fresh), entries: entries.map(serializeEntry), related: await relatedInvoices(inv.originalInvoiceId) });
}));
router10.post("/invoices/:id/cancel", handler(async (req, res) => {
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: "Facture introuvable." });
  if (inv.status === "cancelled") return res.status(409).json({ error: "Facture d\xE9j\xE0 annul\xE9e." });
  const activeCreditNotes = await prisma.invoice.count({ where: { originalInvoiceId: inv.id, status: { not: "cancelled" } } });
  if (activeCreditNotes) return res.status(409).json({ error: "Cette facture a un avoir : annulez d\u2019abord l\u2019avoir." });
  if (inv.status === "validated") {
    const locked = lockError(await prisma.clientDossier.findUniqueOrThrow({ where: { id: inv.clientDossierId } }), inv.date);
    if (locked) return res.status(409).json({ error: `${locked} \xC9tablissez plut\xF4t un avoir.` });
  }
  const author = await actorName(req);
  const reason = optionalText((req.body ?? {}).reason, 300) ?? `Annulation de la facture ${inv.number}.`;
  const generated = await prisma.journalEntry.findMany({ where: { invoiceId: inv.id }, select: { id: true } });
  await prisma.$transaction([
    // Lettrages de la facture, et ceux de ses écritures (un avoir imputé sur sa facture d'origine).
    prisma.invoicePayment.deleteMany({ where: { OR: [{ invoiceId: inv.id }, { entryId: { in: generated.map((e) => e.id) } }] } }),
    ...generated.map((e) => prisma.journalEntry.update({
      where: { id: e.id },
      data: { status: "cancelled", auditTrail: { create: { action: "cancelled", author, notes: reason } } }
    })),
    prisma.invoice.update({ where: { id: inv.id }, data: { status: "cancelled" } })
  ]);
  const [fresh, entries] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: INVOICE_INCLUDE }),
    prisma.journalEntry.findMany({ where: { invoiceId: inv.id }, include: ENTRY_INCLUDE })
  ]);
  res.json({ invoice: serializeInvoice(fresh), entries: entries.map(serializeEntry), related: await relatedInvoices(inv.originalInvoiceId) });
}));
router10.post("/invoices/:id/payments", handler(async (req, res) => {
  const user = getAuthUser(req);
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: "Facture introuvable." });
  if (inv.status !== "validated") return res.status(409).json({ error: "Seule une facture valid\xE9e peut \xEAtre lettr\xE9e." });
  if (inv.kind === "credit_note") return res.status(409).json({ error: "Un avoir s'impute sur sa facture d'origine." });
  const supplier = isSupplierSide(inv.kind);
  const remaining = Number(inv.totalTTC) - paidAmount(serializeInvoice(inv));
  const body = req.body ?? {};
  let entryId;
  let amount;
  if (body.newPayment) {
    const np = body.newPayment;
    const date = isoDate(np.date);
    amount = positiveMoney(np.amount) ?? 0;
    const method = PAYMENT_METHODS.find((m) => m === np.paymentMethod);
    if (!date || !amount || !method) return res.status(400).json({ error: "R\xE8glement invalide (date, montant et mode requis)." });
    if (amount > remaining) return res.status(400).json({ error: `Le r\xE8glement d\xE9passe le reste d\xFB (${remaining.toLocaleString("fr-FR")}).` });
    const treasury = treasuryAccountFor(method).code;
    const accountError = await assertAccountsUsable([treasury, inv.customerAccountCode], inv.clientDossierId);
    if (accountError) return res.status(400).json({ error: accountError });
    const locked = lockError(await prisma.clientDossier.findUniqueOrThrow({ where: { id: inv.clientDossierId } }), date);
    if (locked) return res.status(409).json({ error: locked });
    const label = `${supplier ? "Paiement" : "R\xE8glement"} ${KIND_LABEL[inv.kind].toLowerCase()} ${inv.number} \u2014 ${inv.customerName}`;
    const author = await actorName(req);
    const lines = supplier ? simpleLines(inv.customerAccountCode, treasury, amount) : simpleLines(treasury, inv.customerAccountCode, amount);
    const journal = defaultJournal(lines);
    const entry2 = await withNumberRetry(async () => prisma.journalEntry.create({
      data: {
        date: new Date(date),
        label,
        pieceRef: optionalText(np.pieceRef, 80) ?? `REG-${inv.number}`,
        journal,
        number: await numberer(prisma, inv.clientDossierId)(journal),
        lines: linesCreate(lines),
        amount,
        clientDossierId: inv.clientDossierId,
        status: "validated",
        validatedById: user.sub,
        validatedAt: /* @__PURE__ */ new Date(),
        rawInput: label,
        inputType: "manual",
        paymentMethod: method,
        explanationSimplified: `${label} : ${amount.toLocaleString("fr-FR")} ${supplier ? "pay\xE9s" : "encaiss\xE9s"}.`,
        createdById: user.sub,
        auditTrail: { create: { action: "edited_by_expert", author, notes: `R\xE8glement saisi et lettr\xE9 sur ${inv.number}.` } }
      }
    }));
    entryId = entry2.id;
  } else {
    const id = identifier(body.entryId);
    const entry2 = id ? await prisma.journalEntry.findUnique({ where: { id }, include: { payments: true, lines: true } }) : null;
    if (!entry2 || entry2.clientDossierId !== inv.clientDossierId) return res.status(404).json({ error: "R\xE8glement introuvable dans ce dossier." });
    if (entry2.status === "cancelled") return res.status(409).json({ error: "R\xE8glement annul\xE9." });
    const settled = settlementAmount({ lines: entry2.lines.map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit), credit: Number(l.credit) })) }, inv.kind);
    if (settled <= 0) return res.status(400).json({ error: supplier ? "Un paiement fournisseur doit d\xE9biter un compte 40x." : "Un r\xE8glement client doit cr\xE9diter un compte 411." });
    const free = settled - entry2.payments.reduce((s, p) => s + Number(p.amount), 0);
    amount = positiveMoney(body.amount) ?? Math.min(free, remaining);
    if (amount <= 0 || amount > free + 1e-3) return res.status(400).json({ error: `Montant sup\xE9rieur au disponible du r\xE8glement (${free.toLocaleString("fr-FR")}).` });
    if (amount > remaining + 1e-3) return res.status(400).json({ error: `Montant sup\xE9rieur au reste d\xFB (${remaining.toLocaleString("fr-FR")}).` });
    entryId = entry2.id;
  }
  await prisma.invoicePayment.create({ data: { invoiceId: inv.id, entryId, amount, createdById: user.sub } });
  const [fresh, entry] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: INVOICE_INCLUDE }),
    prisma.journalEntry.findUniqueOrThrow({ where: { id: entryId }, include: ENTRY_INCLUDE })
  ]);
  res.status(201).json({ invoice: serializeInvoice(fresh), entry: serializeEntry(entry) });
}));
router10.post("/invoices/:id/delete", handler(async (req, res) => {
  const inv = await findAccessibleInvoice(req, identifier(req.params.id));
  if (!inv) return res.status(404).json({ error: "Facture introuvable." });
  if (inv.status !== "draft" && inv.status !== "pending_review") {
    return res.status(409).json({ error: "Seul un brouillon jamais valid\xE9 se supprime ; une facture valid\xE9e s\u2019annule." });
  }
  if (inv.kind !== "purchase") {
    const prefix = inv.number.slice(0, inv.number.lastIndexOf("-") + 1);
    const last = await prisma.invoice.findFirst({ where: { clientDossierId: inv.clientDossierId, number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { id: true } });
    if (last?.id !== inv.id) return res.status(409).json({ error: `${inv.number} n'est pas le dernier num\xE9ro : annulez-la pour garder une num\xE9rotation sans trou.` });
  }
  await prisma.invoice.delete({ where: { id: inv.id } });
  res.status(204).end();
}));
router10.post("/invoice-payments/:id/delete", handler(async (req, res) => {
  const id = identifier(req.params.id);
  const p = id ? await prisma.invoicePayment.findUnique({ where: { id }, include: { entry: { select: { invoiceId: true } } } }) : null;
  const inv = p ? await findAccessibleInvoice(req, p.invoiceId) : null;
  if (!p || !inv) return res.status(404).json({ error: "Lettrage introuvable." });
  if (p.entry.invoiceId === inv.id) return res.status(409).json({ error: "R\xE8glement comptant de la facture : annulez la facture." });
  await prisma.invoicePayment.delete({ where: { id: p.id } });
  const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: INVOICE_INCLUDE });
  res.json(serializeInvoice(fresh));
}));
var invoices_default = router10;

// server/routes/index.ts
var router11 = Router11();
router11.get("/bootstrap", handler(async (req, res) => {
  res.json(await buildBootstrapPayload(req));
}));
router11.use(dossiers_default);
router11.use(entries_default);
router11.use(notifications_default);
router11.use(settings_default);
router11.use(backup_default);
router11.use(accounts_default);
router11.use(invoices_default);
router11.use(recurring_default);
router11.use(attachments_default);
router11.use(assets_default);
var routes_default = router11;

// server/agentRoutes.ts
init_db();
init_mappers();
init_initialSettings();
import { Router as Router12 } from "express";

// src/utils/analytics.ts
init_syscohadaPlan();
function isoDate2(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day2 = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day2}`;
}
function periodBounds(period, now = /* @__PURE__ */ new Date()) {
  const to = isoDate2(now);
  if (period === "today") return { from: to, to, label: "aujourd'hui" };
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: isoDate2(d), to, label: "les 7 derniers jours" };
  }
  if (period === "month") {
    return {
      from: isoDate2(new Date(now.getFullYear(), now.getMonth(), 1)),
      to,
      label: now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    };
  }
  if (period === "year") return { from: `${now.getFullYear()}-01-01`, to, label: `l'ann\xE9e ${now.getFullYear()}` };
  return { from: "0000-01-01", to: "9999-12-31", label: "depuis le d\xE9but" };
}
var inRange = (e, from, to) => e.date >= from && e.date <= to;
var income = (e, ...p) => -prefixBalance(e, ...p);
var charge = (e, ...p) => prefixBalance(e, ...p);
var INCOME = ["7", "82", "84", "86", "88"];
var CHARGE = ["6", "81", "83", "85", "87"];
function computeBalances(entries) {
  const balances = {};
  for (const e of entries) {
    for (const l of e.lines) balances[l.accountCode] = (balances[l.accountCode] ?? 0) + l.debit - l.credit;
  }
  return balances;
}
function sumPrefix(b, ...prefixes) {
  let total = 0;
  for (const [code, v] of Object.entries(b)) if (prefixes.some((p) => code.startsWith(p))) total += v;
  return total;
}
function computeTreasury(entries) {
  const b = computeBalances(entries);
  const cash = sumPrefix(b, "57");
  const orangeMoney = sumPrefix(b, "5261");
  const mtnMomo = sumPrefix(b, "5262");
  const wave = sumPrefix(b, "5263");
  const moovMoney = sumPrefix(b, "5264");
  const bank = sumPrefix(b, "52") - sumPrefix(b, "526");
  const mobileMoney = orangeMoney + mtnMomo + wave + moovMoney;
  return { cash, orangeMoney, mtnMomo, wave, moovMoney, bank, mobileMoney, total: cash + mobileMoney + bank };
}
function computeFlows(entries, from, to) {
  let cashIn = 0, cashOut = 0, revenue = 0, expenses = 0, count = 0;
  const exp = {};
  const rev = {};
  for (const e of entries) {
    if (!inRange(e, from, to)) continue;
    count++;
    const t = prefixBalance(e, "5");
    if (t > 0) cashIn += t;
    if (t < 0) cashOut -= t;
    for (const l of e.lines) {
      if (INCOME.some((p) => l.accountCode.startsWith(p))) {
        revenue += l.credit - l.debit;
        rev[l.accountCode] = (rev[l.accountCode] ?? 0) + l.credit - l.debit;
      } else if (CHARGE.some((p) => l.accountCode.startsWith(p))) {
        expenses += l.debit - l.credit;
        exp[l.accountCode] = (exp[l.accountCode] ?? 0) + l.debit - l.credit;
      }
    }
  }
  const rank = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, amount]) => ({ code, label: getAccountByCode(code)?.label ?? `Compte ${code}`, amount }));
  return {
    cashIn,
    cashOut,
    netCash: cashIn - cashOut,
    revenue,
    expenses,
    result: revenue - expenses,
    count,
    topExpenses: rank(exp),
    topRevenue: rank(rev)
  };
}
function computeReceivables(entries) {
  const b = computeBalances(entries);
  const total = Math.max(0, sumPrefix(b, "411"));
  const open = entries.filter((e) => prefixBalance(e, "411") > 0).sort((a, c) => a.date < c.date ? 1 : -1).slice(0, 5).map((e) => ({ date: e.date, label: e.label, amount: prefixBalance(e, "411") }));
  return { total, open };
}
function computePayables(entries) {
  const b = computeBalances(entries);
  const total = Math.max(0, -sumPrefix(b, "401"));
  const open = entries.filter((e) => prefixBalance(e, "401") < 0).sort((a, c) => a.date < c.date ? 1 : -1).slice(0, 5).map((e) => ({ date: e.date, label: e.label, amount: -prefixBalance(e, "401") }));
  return { total, open };
}
function computeTva(entries, month) {
  let totalSalesHT = 0, totalPurchasesHT = 0, tvaCollectee = 0, tvaDeductible = 0, entriesCount = 0;
  for (const e of entries) {
    if (e.status !== "validated" || !e.date.startsWith(month)) continue;
    const sales = income(e, "70");
    const purchases = charge(e, "60", "61", "62", "63", "21", "22", "23", "24");
    totalSalesHT += sales;
    totalPurchasesHT += purchases;
    tvaCollectee += income(e, "443");
    tvaDeductible += charge(e, "445");
    if (sales || purchases) entriesCount++;
  }
  return {
    period: month,
    totalSalesHT,
    totalPurchasesHT,
    tvaCollectee,
    tvaDeductible,
    netToPay: Math.max(0, tvaCollectee - tvaDeductible),
    credit: Math.max(0, tvaDeductible - tvaCollectee),
    entriesCount
  };
}
function forecastCash(entries, now = /* @__PURE__ */ new Date()) {
  const treasury = computeTreasury(entries);
  const windowDays = 30;
  const from = new Date(now);
  from.setDate(from.getDate() - windowDays + 1);
  const flows = computeFlows(entries, isoDate2(from), isoDate2(now));
  const dailyNet = flows.netCash / windowDays;
  const at = (days) => Math.round(treasury.total + dailyNet * days);
  return {
    basedOnEntries: flows.count,
    dailyNet: Math.round(dailyNet),
    in30: at(30),
    in60: at(60),
    in90: at(90),
    runwayDays: dailyNet < 0 && treasury.total > 0 ? Math.floor(treasury.total / -dailyNet) : null
  };
}
var clamp = (x) => Math.max(0, Math.min(1, x));
function computeCreditAssessment(entries, now = /* @__PURE__ */ new Date()) {
  const dated = entries.filter((e) => e.date <= isoDate2(now));
  if (dated.length === 0) {
    return {
      sufficientData: false,
      score: 0,
      mention: "\xC0 consolider",
      monthsObserved: 0,
      avgMonthlyRevenue: 0,
      avgMonthlyExpenses: 0,
      avgMonthlyNetFlow: 0,
      netMarginPct: 0,
      traceabilityRate: 0,
      regularityRate: 0,
      anomalyRate: 0,
      runwayMonths: 0,
      maxMonthlyRepayment: 0,
      suggested12MonthCredit: 0,
      recommendations: ["Aucune \xE9criture enregistr\xE9e : commencez \xE0 saisir vos ventes et achats pour constituer votre dossier."]
    };
  }
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const windowed = dated.filter((e) => e.date >= isoDate2(sixMonthsAgo));
  const firstDate = windowed.reduce((min, e) => e.date < min ? e.date : min, windowed[0].date);
  const [fy, fm] = firstDate.split("-").map(Number);
  const monthsObserved = Math.max(1, Math.min(6, (now.getFullYear() - fy) * 12 + (now.getMonth() + 1 - fm) + 1));
  const flows = computeFlows(windowed, "0000-01-01", "9999-12-31");
  const avgMonthlyRevenue = Math.round(flows.revenue / monthsObserved);
  const avgMonthlyExpenses = Math.round(flows.expenses / monthsObserved);
  const avgMonthlyNetFlow = avgMonthlyRevenue - avgMonthlyExpenses;
  const netMarginPct = flows.revenue > 0 ? Math.round((flows.revenue - flows.expenses) / flows.revenue * 100) : 0;
  const salesEntries = windowed.filter((e) => income(e, "7") > 0 && prefixBalance(e, "5") > 0);
  const traced = salesEntries.filter((e) => e.paymentMethod !== "cash").length;
  const traceabilityRate = salesEntries.length ? Math.round(traced / salesEntries.length * 100) : 0;
  const monthsWithRevenue = new Set(windowed.filter((e) => income(e, "7") > 0).map((e) => e.date.slice(0, 7))).size;
  const regularityRate = Math.round(monthsWithRevenue / monthsObserved * 100);
  const anomalyRate = windowed.length ? windowed.filter((e) => e.status === "anomaly").length / windowed.length : 0;
  const treasury = computeTreasury(entries);
  const runwayMonths = avgMonthlyExpenses > 0 ? Math.max(0, treasury.total) / avgMonthlyExpenses : 0;
  const score = Math.round(
    25 * (regularityRate / 100) + 25 * clamp(traceabilityRate / 100 / 0.6) + 20 * clamp((netMarginPct / 100 + 0.05) / 0.25) + 15 * clamp(runwayMonths / 3) + 15 * (1 - clamp(anomalyRate * 5))
  );
  const mention = score >= 80 ? "Excellent dossier bancable" : score >= 65 ? "Profil sain & solvable" : score >= 45 ? "Profil mod\xE9r\xE9" : "\xC0 consolider";
  const maxMonthlyRepayment = Math.max(0, Math.round(avgMonthlyNetFlow * 0.33));
  const recommendations = [];
  if (windowed.length < 10 || monthsObserved < 3) recommendations.push("Historique court : les banques demandent en g\xE9n\xE9ral 3 \xE0 6 mois de flux r\xE9guliers. Continuez \xE0 tout enregistrer.");
  if (traceabilityRate < 50) recommendations.push(`Seulement ${traceabilityRate}% de vos ventes sont trac\xE9es (Mobile Money / banque). Encaissez davantage hors esp\xE8ces.`);
  if (regularityRate < 80) recommendations.push("Vos encaissements ne sont pas r\xE9guliers chaque mois : la banque y verra un risque.");
  if (netMarginPct < 10) recommendations.push("Marge nette faible : r\xE9duisez vos charges ou revoyez vos prix avant de demander un cr\xE9dit.");
  if (anomalyRate > 0.05) recommendations.push("Plusieurs \xE9critures sont en anomalie : faites-les valider par votre expert-comptable avant le d\xE9p\xF4t.");
  if (runwayMonths < 1) recommendations.push("Tr\xE9sorerie inf\xE9rieure \xE0 un mois de charges : constituez une r\xE9serve.");
  if (recommendations.length === 0) recommendations.push("Dossier solide : pr\xE9parez vos \xE9tats financiers certifi\xE9s et vos relev\xE9s Mobile Money / bancaires.");
  return {
    sufficientData: windowed.length >= 10 && monthsObserved >= 1,
    score,
    mention,
    monthsObserved,
    avgMonthlyRevenue,
    avgMonthlyExpenses,
    avgMonthlyNetFlow,
    netMarginPct,
    traceabilityRate,
    regularityRate,
    anomalyRate: Math.round(anomalyRate * 100),
    runwayMonths: Math.round(runwayMonths * 10) / 10,
    maxMonthlyRepayment,
    suggested12MonthCredit: maxMonthlyRepayment * 12,
    recommendations
  };
}
function computeReviewCounts(entries) {
  return {
    pending: entries.filter((e) => e.status === "pending_review").length,
    anomalies: entries.filter((e) => e.status === "anomaly").length,
    validated: entries.filter((e) => e.status === "validated").length,
    total: entries.length
  };
}
function buildAgentContext(entries, now = /* @__PURE__ */ new Date()) {
  const month = periodBounds("month", now);
  const week = periodBounds("week", now);
  const today = periodBounds("today", now);
  return {
    date: isoDate2(now),
    treasury: computeTreasury(entries),
    today: computeFlows(entries, today.from, today.to),
    week: computeFlows(entries, week.from, week.to),
    month: { label: month.label, ...computeFlows(entries, month.from, month.to) },
    year: computeFlows(entries, periodBounds("year", now).from, isoDate2(now)),
    receivables: computeReceivables(entries),
    payables: computePayables(entries),
    tva: computeTva(entries, isoDate2(now).slice(0, 7)),
    forecast: forecastCash(entries, now),
    credit: computeCreditAssessment(entries, now),
    review: computeReviewCounts(entries),
    recentEntries: [...entries].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 8).map((e) => ({ date: e.date, label: e.label, amount: e.amount, debit: debitCodes(e).join(","), credit: creditCodes(e).join(","), method: e.paymentMethod, status: e.status }))
  };
}

// src/utils/amounts.ts
var NUM = String.raw`\d{1,3}(?:[\s .,']\d{3})+(?!\d)|\d+(?:[.,]\d+)?`;
var SUFFIX = String.raw`(?:\s*(k|m|millions?|milliards?|mille)\b)?`;
var CURRENCY = String.raw`(?:\s*(f\s*cfa|fcfa|cfa|francs?|frs?|f\b|xof|xaf))?`;
function toNumber(raw) {
  const s = raw.replace(/[\s ']/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return parseInt(s.replace(/[.,]/g, ""), 10);
  return parseFloat(s.replace(",", "."));
}
function maskNonAmounts(norm) {
  return norm.replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, (m) => " ".repeat(m.length)).replace(/\b\d{1,2}\s*(?:h|:)\s*\d{2}\b/g, (m) => " ".repeat(m.length)).replace(/\b0\d(?:[\s.]?\d{2}){3,4}\b/g, (m) => " ".repeat(m.length)).replace(/\b\d{8,}\b/g, (m) => " ".repeat(m.length)).replace(/\b(?:id|ref|trans(?:action)?)\s*(?:id)?\s*[:#]?\s*[a-z0-9.\-_]{5,}/g, (m) => " ".repeat(m.length));
}
function digitTokens(norm) {
  const masked = maskNonAmounts(norm);
  const re = new RegExp(`(${NUM})${SUFFIX}${CURRENCY}`, "g");
  const tokens2 = [];
  let m;
  while ((m = re.exec(masked)) !== null) {
    let value = toNumber(m[1]);
    if (!isFinite(value)) continue;
    const suf = m[2];
    if (suf) {
      if (suf === "k" || suf === "mille") value *= 1e3;
      else if (suf.startsWith("milliard")) value *= 1e9;
      else value *= 1e6;
    }
    tokens2.push({ value: Math.round(value), index: m.index, end: m.index + m[0].length, hasCurrency: !!m[3] });
  }
  return tokens2;
}
var WORD_VALUES = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  vingts: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60
};
function wordRunValue(words) {
  let total = 0;
  let current = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === "et") continue;
    if (w === "cent" || w === "cents") current = (current || 1) * 100;
    else if (w === "mille") {
      total += (current || 1) * 1e3;
      current = 0;
    } else if (w.startsWith("million")) {
      total += (current || 1) * 1e6;
      current = 0;
    } else if (w.startsWith("milliard")) {
      total += (current || 1) * 1e9;
      current = 0;
    } else if ((w === "vingt" || w === "vingts") && words[i - 1] === "quatre") current += 76;
    else if (w in WORD_VALUES) current += WORD_VALUES[w];
  }
  return total + current;
}
function wordTokens(norm) {
  const tokens2 = [];
  const re = /[a-z]+(?:[-\s]+[a-z]+)*/g;
  let m;
  while ((m = re.exec(norm)) !== null) {
    const parts = m[0].split(/([-\s]+)/);
    let offset = m.index;
    let runStart = -1;
    let runWords = [];
    let runEndOffset = 0;
    const flush = () => {
      if (runWords.length) {
        const meaningful = runWords.filter((w) => w !== "et");
        const hasBig = meaningful.some((w) => w.startsWith("cent") || w === "mille" || w.startsWith("million") || w.startsWith("milliard"));
        const value = wordRunValue(runWords);
        if (hasBig && value >= 100) {
          const tail = norm.slice(runEndOffset).match(/^\s*(f\s*cfa|fcfa|cfa|francs?|frs?|f\b)/);
          tokens2.push({ value, index: runStart, end: runEndOffset + (tail ? tail[0].length : 0), hasCurrency: !!tail });
        }
      }
      runWords = [];
      runStart = -1;
    };
    for (const part of parts) {
      if (/^[-\s]+$/.test(part)) {
        offset += part.length;
        continue;
      }
      const isNumWord = part in WORD_VALUES || /^(cents?|mille|millions?|milliards?)$/.test(part) || part === "et" && runWords.length > 0;
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
  return tokens2;
}
function extractAmountTokens(text2) {
  const norm = normalizeText(text2);
  return [...digitTokens(norm), ...wordTokens(norm)].sort((a, b) => a.index - b.index);
}
function formatFcfa(n) {
  return Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ");
}
function extractAmountInfo(text2) {
  const norm = normalizeText(text2);
  const tokens2 = extractAmountTokens(text2);
  if (tokens2.length === 0) return void 0;
  const around = (t, before) => norm.slice(Math.max(0, t.index - before), t.index);
  const resteIdx = tokens2.findIndex((t) => /(?:reste|restant|solde|le\s+reste)\s*(?:de|a|:)?\s*$/.test(around(t, 22)));
  if (resteIdx > 0) {
    const paid = tokens2[resteIdx - 1];
    const rest = tokens2[resteIdx];
    return { amount: paid.value + rest.value, paid: paid.value, hasCurrency: paid.hasCurrency || rest.hasCurrency };
  }
  const surIdx = tokens2.findIndex((t, i) => i > 0 && /\bsur\s*$/.test(around(t, 8)));
  if (surIdx > 0 && /acompte|avance|verse|paye|regle|partiel/.test(norm)) {
    const paid = tokens2[surIdx - 1];
    const total = tokens2[surIdx];
    if (total.value > paid.value) return { amount: total.value, paid: paid.value, hasCurrency: total.hasCurrency };
  }
  const qp = norm.match(new RegExp(`(?<![\\d.,])(\\d{1,4})\\s*(?:x|\xD7)\\s*(${NUM})${SUFFIX}`)) || norm.match(new RegExp(`(?<![\\d.,])(\\d{1,4})\\s+[a-z' ]{1,45}?\\s(?:a|@|x)\\s*(${NUM})${SUFFIX}`));
  if (qp) {
    const qty = parseInt(qp[1], 10);
    let unit = toNumber(qp[2]);
    if (qp[3]) unit *= qp[3] === "k" || qp[3] === "mille" ? 1e3 : qp[3].startsWith("milliard") ? 1e9 : 1e6;
    const perUnitHint = /\b(?:chacun|chacune|l'unite|la piece|le sac|le kilo|unite|piece)\b/.test(norm);
    const totalHint = /\b(?:total|au total|en tout)\b/.test(norm) && !perUnitHint;
    if (qty > 0 && qty < 1e4 && unit > 0 && !totalHint) {
      return { amount: Math.round(qty * unit), quantity: qty, unitPrice: Math.round(unit), hasCurrency: true };
    }
  }
  const totalTok = tokens2.find((t) => /(?:total|montant|somme|pour)\s*(?:de|:)?\s*$/.test(around(t, 14)) && t.hasCurrency) || tokens2.find((t) => /(?:total|montant total|en tout)\s*(?:de|:)?\s*$/.test(around(t, 16)));
  if (totalTok) return { amount: totalTok.value, hasCurrency: totalTok.hasCurrency };
  const withCurrency = tokens2.find((t) => t.hasCurrency && t.value > 0);
  if (withCurrency) return { amount: withCurrency.value, hasCurrency: true };
  const plain = tokens2.find((t) => t.value >= 100);
  if (plain) return { amount: plain.value, hasCurrency: false };
  return void 0;
}

// server/agent/answers.ts
var F = (n) => `${formatFcfa(n)} FCFA`;
var KNOWLEDGE = [
  {
    re: /\btva\b.*(?:c.?est quoi|explique|comment|taux)|(?:c.?est quoi|explique).*\btva\b/,
    answer: "La TVA (taxe sur la valeur ajout\xE9e) est un imp\xF4t pay\xE9 par le client final : vous la collectez sur vos ventes (compte 4431) et vous d\xE9duisez celle pay\xE9e sur vos achats (compte 4452). Chaque mois, vous reversez la diff\xE9rence \xE0 l'administration fiscale, avant le 15 du mois suivant. Le taux normal est de 18 % dans la zone UEMOA."
  },
  {
    re: /amortissement/,
    answer: "L'amortissement r\xE9partit le co\xFBt d'un \xE9quipement (ordinateur, moto, machine\u2026) sur sa dur\xE9e d'utilisation. Chaque ann\xE9e, vous enregistrez une charge (compte 6811) qui diminue la valeur de l'\xE9quipement (comptes 28xx). C'est une charge qui ne sort pas d'argent de votre caisse. Dites-moi par exemple : \xAB amortissement de l'ordinateur 120 000 F \xBB."
  },
  {
    re: /compte d.?attente|\b4711\b|\b471\b/,
    answer: "Le compte 4711 est un compte d'attente : on y place une op\xE9ration dont on ne conna\xEEt pas encore la nature (retrait sans justificatif, virement inconnu). Il doit \xEAtre vid\xE9 avant la cl\xF4ture, sinon les \xE9tats financiers sont faux."
  },
  {
    re: /\bdsf\b|declaration statistique/,
    answer: "La DSF (D\xE9claration Statistique et Fiscale) est la d\xE9claration annuelle obligatoire des entreprises en zone OHADA : bilan, compte de r\xE9sultat, tableaux annexes. Elle est d\xE9pos\xE9e avant le 30 avril (ou 31 mai selon les pays) et sert de base \xE0 l'imp\xF4t sur les b\xE9n\xE9fices."
  },
  {
    re: /plan comptable|syscohada.*(?:c.?est quoi|explique)|(?:c.?est quoi|explique).*syscohada|\bohada\b.*(?:c.?est quoi|explique)/,
    answer: "Le SYSCOHADA est le r\xE9f\xE9rentiel comptable commun aux 17 pays de l'OHADA. Il classe les comptes en 8 classes : 1 ressources durables, 2 immobilisations, 3 stocks, 4 tiers (clients, fournisseurs, \xC9tat), 5 tr\xE9sorerie (caisse 5711, banque 5211, Mobile Money 526x), 6 charges, 7 produits, 8 hors activit\xE9s ordinaires."
  },
  {
    re: /bilan\b.*(?:c.?est quoi|explique)|(?:c.?est quoi|explique).*\bbilan\b/,
    answer: "Le bilan est la photo de votre entreprise \xE0 une date : \xE0 gauche ce que vous poss\xE9dez (actif : \xE9quipements, stocks, clients, tr\xE9sorerie), \xE0 droite ce que vous devez et le capital (passif). Il doit toujours \xEAtre \xE9quilibr\xE9."
  },
  {
    re: /compte de resultat|resultat net.*(?:c.?est quoi|explique)|(?:c.?est quoi|explique).*resultat/,
    answer: "Le compte de r\xE9sultat compare vos produits (ventes, classe 7) \xE0 vos charges (achats, loyer, salaires, classe 6) sur une p\xE9riode. La diff\xE9rence est votre b\xE9n\xE9fice ou votre perte."
  },
  {
    re: /provision/,
    answer: "Une provision est une charge que vous constatez \xE0 l'avance pour un risque probable (client qui ne paiera peut-\xEAtre pas, litige). Elle diminue le r\xE9sultat de l'exercice sans sortie d'argent. \xC0 valider avec votre expert-comptable."
  },
  {
    re: /debit|credit.*(?:c.?est quoi|explique|difference)|partie double/,
    answer: "En partie double, chaque op\xE9ration touche deux comptes pour le m\xEAme montant : un d\xE9bit et un cr\xE9dit. Exemple : vente de 15 000 F en esp\xE8ces \u2192 d\xE9bit caisse 5711 (l'argent entre), cr\xE9dit ventes 7011 (le produit)."
  }
];
var TAX_CALENDAR = "\xC9ch\xE9ances courantes (\xE0 confirmer avec votre r\xE9gime) : TVA mensuelle avant le 15 du mois suivant ; cotisations sociales (CNPS/CNSS) avant le 15 du mois suivant ; acomptes d'imp\xF4t sur les b\xE9n\xE9fices trimestriels ; DSF annuelle avant le 30 avril. Les d\xE9lais exacts varient l\xE9g\xE8rement selon les pays de l'OHADA.";
function methodFocus(n) {
  if (/orange/.test(n)) return { label: "Orange Money", value: (c) => c.treasury.orangeMoney };
  if (/mtn|momo/.test(n)) return { label: "MTN MoMo", value: (c) => c.treasury.mtnMomo };
  if (/wave/.test(n)) return { label: "Wave", value: (c) => c.treasury.wave };
  if (/moov/.test(n)) return { label: "Moov Money", value: (c) => c.treasury.moovMoney };
  if (/banque|bancaire/.test(n)) return { label: "la banque", value: (c) => c.treasury.bank };
  if (/caisse|especes|cash|liquide/.test(n)) return { label: "la caisse", value: (c) => c.treasury.cash };
  return void 0;
}
function answerQuestion(question, ctx, dossier, settings) {
  const n = normalizeText(question);
  const t = ctx.treasury;
  const empty = ctx.review.total === 0;
  for (const k of KNOWLEDGE) if (k.re.test(n)) return k.answer;
  if (/echeance|calendrier|declaration|impot|fiscal/.test(n) && !/tva/.test(n)) return TAX_CALENDAR;
  if (empty) {
    return "Je n'ai encore aucune \xE9criture pour ce dossier, donc je ne peux pas chiffrer. Dites-moi par exemple \xAB J'ai vendu 3 sacs de ciment \xE0 5000 F, pay\xE9 en esp\xE8ces \xBB et je commencerai votre comptabilit\xE9.";
  }
  if (/solde|tresorerie|disponible|combien.*(?:caisse|banque|orange|mtn|momo|wave|moov|reste|ai-?je en)|argent.*(?:caisse|banque)/.test(n) && !/ventes?|vendu/.test(n)) {
    const mentioned = ["orange", "mtn|momo", "wave", "moov", "banque|bancaire", "caisse|especes|cash|liquide"].filter((k) => new RegExp(k).test(n)).length;
    const focus = mentioned === 1 ? methodFocus(n) : void 0;
    if (focus) return `Sur ${focus.label}, il y a ${F(focus.value(ctx))} d'apr\xE8s vos \xE9critures.`;
    return `Votre tr\xE9sorerie totale est de ${F(t.total)} :
\u2022 Caisse (esp\xE8ces) : ${F(t.cash)}
\u2022 Banque : ${F(t.bank)}
\u2022 Orange Money : ${F(t.orangeMoney)}
\u2022 MTN MoMo : ${F(t.mtnMomo)}
\u2022 Wave : ${F(t.wave)}
\u2022 Moov Money : ${F(t.moovMoney)}${t.total < 0 ? "\n\nAttention : un solde n\xE9gatif signifie souvent qu'il manque le solde de d\xE9part. Dites-moi par exemple \xAB j'avais 200 000 F en caisse au d\xE9part \xBB." : ""}`;
  }
  if (/qui me doit|creance|impaye|clients?.*(?:doit|devoir|payer)|argent.*dehors/.test(n)) {
    if (ctx.receivables.total <= 0) return "Aucun client ne vous doit d\u2019argent d\u2019apr\xE8s vos \xE9critures.";
    return `Vos clients vous doivent ${F(ctx.receivables.total)}. Derni\xE8res ventes \xE0 cr\xE9dit :
${ctx.receivables.open.map((o) => `\u2022 ${o.date} \u2014 ${o.label} : ${F(o.amount)}`).join("\n")}`;
  }
  if (/dette|fournisseurs?.*(?:payer|dois|devoir)|dois-?je payer|a payer|je dois/.test(n)) {
    if (ctx.payables.total <= 0) return "Vous ne devez rien \xE0 vos fournisseurs d\u2019apr\xE8s vos \xE9critures.";
    return `Vous devez ${F(ctx.payables.total)} \xE0 vos fournisseurs. Derni\xE8res factures \xE0 payer :
${ctx.payables.open.map((o) => `\u2022 ${o.date} \u2014 ${o.label} : ${F(o.amount)}`).join("\n")}`;
  }
  if (/prevision|previsionnel|prochains? (?:mois|jours|semaines)|fin du mois|projection|assez d.?argent|puis-?je (?:payer|acheter|me permettre)|cash ?flow|tiendr/.test(n)) {
    const f = ctx.forecast;
    if (f.basedOnEntries === 0) return `Votre tr\xE9sorerie est de ${F(t.total)}, mais je n'ai pas eu de mouvement sur les 30 derniers jours pour faire une projection fiable.`;
    const trend = f.dailyNet >= 0 ? `Vous gagnez en moyenne ${F(f.dailyNet)} par jour.` : `Vous perdez en moyenne ${F(-f.dailyNet)} par jour${f.runwayDays !== null ? ` : \xE0 ce rythme, votre tr\xE9sorerie tient environ ${f.runwayDays} jours` : ""}.`;
    return `Tr\xE9sorerie actuelle : ${F(t.total)}. ${trend}
Projection si le rythme des 30 derniers jours continue : ${F(f.in30)} dans 30 jours, ${F(f.in60)} dans 60 jours, ${F(f.in90)} dans 90 jours.`;
  }
  if (/\btva\b/.test(n)) {
    const v = ctx.tva;
    return `TVA du mois (\xE9critures valid\xE9es) : ${F(v.tvaCollectee)} collect\xE9e, ${F(v.tvaDeductible)} d\xE9ductible. ${v.credit > 0 ? `Vous avez un cr\xE9dit de TVA de ${F(v.credit)}.` : `TVA \xE0 reverser : ${F(v.netToPay)}, avant le 15 du mois prochain.`} Seules les \xE9critures valid\xE9es comptent : il reste ${ctx.review.pending + ctx.review.anomalies} \xE9criture(s) \xE0 valider.`;
  }
  if (/credit|pret|emprunt|financement|bancable|score|solvab/.test(n)) {
    const c = ctx.credit;
    if (!c.sufficientData) return `Il me faut plus d'historique pour \xE9valuer votre dossier (au moins une dizaine d'\xE9critures). ${c.recommendations[0]}`;
    return `Score de solvabilit\xE9 : ${c.score}/100 (${c.mention}). CA mensuel moyen ${F(c.avgMonthlyRevenue)}, flux net ${F(c.avgMonthlyNetFlow)}/mois, ${c.traceabilityRate}% de ventes trac\xE9es hors esp\xE8ces. Capacit\xE9 de remboursement estim\xE9e : ${F(c.maxMonthlyRepayment)}/mois (33 % du flux net), soit un financement d'environ ${F(c.suggested12MonthCredit)} sur 12 mois.
\xC0 am\xE9liorer : ${c.recommendations[0]}`;
  }
  if (/benefice|marge|resultat|rentab|gagn/.test(n)) {
    const m = ctx.month;
    return `Sur ${m.label} : chiffre d'affaires ${F(m.revenue)}, charges ${F(m.expenses)}, soit un r\xE9sultat de ${F(m.result)}${m.revenue > 0 ? ` (marge ${Math.round(m.result / m.revenue * 100)} %)` : ""}.`;
  }
  const periodKey = /aujourd|ce jour/.test(n) ? "today" : /semaine|7 jours/.test(n) ? "week" : /annee|an\b|annuel/.test(n) ? "year" : "month";
  const flows = periodKey === "today" ? ctx.today : periodKey === "week" ? ctx.week : periodKey === "year" ? ctx.year : ctx.month;
  const periodLabel = { today: "aujourd'hui", week: "les 7 derniers jours", month: ctx.month.label, year: "cette ann\xE9e" }[periodKey];
  if (/depense|charges?|achats?|coute|sorti|plus grosses?/.test(n)) {
    const top = flows.topExpenses.map((e) => `\u2022 ${e.label} : ${F(e.amount)}`).join("\n");
    return `D\xE9penses sur ${periodLabel} : ${F(flows.expenses)} (hors TVA).${top ? `
Principaux postes :
${top}` : ""}`;
  }
  if (/vendu|ventes?|chiffre d.?affaires|\bca\b|recettes?|encaiss/.test(n)) {
    return `Sur ${periodLabel} : chiffre d'affaires ${F(flows.revenue)} (hors TVA), dont ${F(flows.cashIn)} effectivement encaiss\xE9s. Charges : ${F(flows.expenses)}.`;
  }
  if (/anomalie|verifier|attente|valider|revue|probleme/.test(n)) {
    const r = ctx.review;
    return `Il y a ${r.pending} \xE9criture(s) en attente de validation et ${r.anomalies} anomalie(s) \xE0 examiner, sur ${r.total} \xE9critures. Vous les trouvez dans l'onglet \xAB Journal & Validation \xBB du Mode Comptable.`;
  }
  return `Voici la situation de ${dossier.name} : tr\xE9sorerie ${F(t.total)}, chiffre d'affaires du mois ${F(ctx.month.revenue)}, charges ${F(ctx.month.expenses)}, r\xE9sultat ${F(ctx.month.result)}. Les clients vous doivent ${F(ctx.receivables.total)} et vous devez ${F(ctx.payables.total)} \xE0 vos fournisseurs. ${ctx.review.pending + ctx.review.anomalies > 0 ? `${ctx.review.pending + ctx.review.anomalies} \xE9criture(s) attendent une v\xE9rification.` : "Toutes vos \xE9critures sont valid\xE9es."}
Vous pouvez me demander : \xAB combien j'ai en caisse ? \xBB, \xAB qui me doit de l'argent ? \xBB, \xAB puis-je payer mon loyer ? \xBB, \xAB quel est mon score de cr\xE9dit ? \xBB.`;
}
function greetingReply(dossier, text2, userName) {
  const n = normalizeText(text2);
  const who = userName && userName.trim() || dossier.managerName;
  if (/^merci/.test(n)) return "Avec plaisir ! Dites-moi d\xE8s que vous avez une nouvelle vente, un achat ou un re\xE7u.";
  return `Bonjour ${who} ! Dites-moi ce que vous avez vendu ou achet\xE9 aujourd'hui pour ${dossier.name}, ou posez-moi une question sur votre tr\xE9sorerie.`;
}

// server/agent/buildEntries.ts
init_syscohadaPlan();
import { randomUUID as randomUUID2 } from "crypto";
var accountByCode = new Map(SYSCOHADA_ACCOUNTS.map((a) => [a.code, a]));
var isKnownAccount = (code) => !!code && accountByCode.has(code);
var codeOf = (setting) => (setting ?? "").split(" - ")[0].trim();
var VATABLE_PREFIXES = ["701", "702", "706", "707", "601", "602", "6051", "6052", "6053", "6121", "6241", "6271", "6581", "215", "241", "244", "245"];
var VAT_KINDS = ["sale", "purchase", "expense", "asset_purchase"];
var DEPRECIATION_ACCOUNT = { "215": "2815", "241": "2841", "244": "2844", "245": "2845" };
var STOPWORDS = /* @__PURE__ */ new Set(["pour", "avec", "dans", "chez", "paye", "payee", "cash", "vendu", "achete", "sacs", "facture", "fcfa", "francs", "mobile", "money", "orange", "wave", "moov", "especes", "virement"]);
function tokens(text2) {
  return new Set(
    normalizeText(text2).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOPWORDS.has(w))
  );
}
function overlap(a, b) {
  let shared = 0;
  a.forEach((t) => {
    if (b.has(t)) shared++;
  });
  const union = a.size + b.size - shared;
  return { shared, jaccard: union ? shared / union : 0 };
}
function dayDiff(a, b) {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 864e5);
}
function findPrecedent(op, ctx) {
  const wanted = tokens(`${op.label} ${op.counterparty ?? ""} ${op.sourceText}`);
  if (wanted.size === 0) return void 0;
  let best;
  for (const e of ctx.entries) {
    if (e.clientDossierId !== ctx.dossier.id) continue;
    if (!e.auditTrail.some((a) => a.action === "edited_by_expert")) continue;
    const nature = e.lines.map((l) => l.accountCode).find((c) => !isTreasuryCode(c) && /^[2367]/.test(c));
    if (!nature) continue;
    const sameDirection = op.kind === "sale" || op.kind === "other_income" ? nature.startsWith("7") : op.kind === "purchase" || op.kind === "expense" ? /^[63]/.test(nature) : op.kind === "asset_purchase" ? nature.startsWith("2") : false;
    if (!sameDirection) continue;
    const { shared, jaccard } = overlap(wanted, tokens(`${e.label} ${e.rawInput}`));
    if (shared >= 2 && jaccard >= 0.5 && (!best || jaccard > best.score)) best = { entry: e, nature, score: jaccard };
  }
  return best;
}
function findDuplicate(line2, op, date, ctx) {
  const wanted = tokens(`${op.label} ${op.sourceText}`);
  return ctx.entries.find((e) => {
    if (e.clientDossierId !== ctx.dossier.id) return false;
    if (e.amount !== line2.amount || !debitCodes(e).includes(line2.debit) || !creditCodes(e).includes(line2.credit)) return false;
    if (dayDiff(e.date, date) > 2) return false;
    if (op.pieceRef && e.pieceRef === op.pieceRef) return true;
    if (e.rawInput.trim().toLowerCase() === op.sourceText.trim().toLowerCase()) return true;
    const { jaccard } = overlap(wanted, tokens(`${e.label} ${e.rawInput}`));
    return jaccard >= 0.5;
  });
}
function defaultMethod(kind) {
  return kind === "bank_fee" || kind === "loan_received" || kind === "loan_repayment" ? "bank_transfer" : "cash";
}
function explain(op, m, amount, paid, assumed) {
  const A = `${formatFcfa(amount)} FCFA`;
  const via = PAYMENT_METHOD_VIA[m];
  const wallet = PAYMENT_METHOD_WALLET[m];
  const to = op.toMethod;
  let text2;
  switch (op.kind) {
    case "sale":
      text2 = op.settlement === "credit" ? `Vente \xE0 cr\xE9dit de ${A} : le client vous doit cette somme (cr\xE9ance client). Rien n'est encaiss\xE9 pour le moment.` : op.settlement === "partial" ? `Vente de ${A} : ${formatFcfa(paid ?? 0)} FCFA encaiss\xE9s ${via}, il reste ${formatFcfa(amount - (paid ?? 0))} FCFA \xE0 recevoir du client.` : `Vente de ${A} encaiss\xE9e ${via}. Votre ${wallet} augmente.`;
      break;
    case "purchase":
      text2 = op.settlement === "credit" ? `Achat de ${A} \xE0 cr\xE9dit : vous devez cette somme \xE0 votre fournisseur. Votre tr\xE9sorerie ne bouge pas.` : op.settlement === "partial" ? `Achat de ${A} : ${formatFcfa(paid ?? 0)} FCFA pay\xE9s ${via}, il reste ${formatFcfa(amount - (paid ?? 0))} FCFA \xE0 payer au fournisseur.` : `Achat de marchandises de ${A} pay\xE9 ${via}. Votre ${wallet} diminue et le stock achet\xE9 est enregistr\xE9 en charge.`;
      break;
    case "expense":
      text2 = op.settlement === "credit" ? `${op.label} de ${A} \xE0 payer plus tard : c'est une dette envers le fournisseur, enregistr\xE9e en charge.` : `${op.label} de ${A} pay\xE9 ${via}. Votre ${wallet} diminue et la d\xE9pense est enregistr\xE9e en charges.`;
      break;
    case "asset_purchase":
      text2 = `\xC9quipement de ${A} pay\xE9 ${via}. C'est un investissement : il est inscrit \xE0 l'actif de l'entreprise et non en charge.`;
      break;
    case "customer_payment":
      text2 = `Votre client vous a r\xE9gl\xE9 ${A} ${via}. Sa dette diminue et votre ${wallet} augmente.`;
      break;
    case "supplier_payment":
      text2 = `Vous avez r\xE9gl\xE9 ${A} \xE0 votre fournisseur ${via}. Votre dette diminue et votre ${wallet} baisse.`;
      break;
    case "transfer":
      text2 = `Vous avez d\xE9plac\xE9 ${A} de votre ${wallet} vers votre ${PAYMENT_METHOD_WALLET[to ?? "cash"]}. Votre tr\xE9sorerie totale ne change pas.`;
      break;
    case "owner_withdrawal":
      text2 = `Retrait de ${A} sans justificatif : il faut pr\xE9ciser si c'est une d\xE9pense de l'entreprise ou un pr\xE9l\xE8vement personnel. Mis en attente de v\xE9rification.`;
      break;
    case "loan_received":
      text2 = `Emprunt de ${A} re\xE7u ${via} : votre ${wallet} augmente, mais vous avez une dette \xE0 rembourser \xE0 la banque.`;
      break;
    case "loan_repayment":
      text2 = `Remboursement d'emprunt de ${A} pay\xE9 ${via}. Votre dette envers la banque diminue.`;
      break;
    case "capital_contribution":
      text2 = `Apport de ${A} vers\xE9 ${via} dans l'entreprise. Votre ${wallet} augmente.`;
      break;
    case "opening_balance":
      text2 = `Solde de d\xE9part enregistr\xE9 : ${A} dans votre ${wallet}.`;
      break;
    case "bank_fee":
      text2 = `Frais de ${A} pr\xE9lev\xE9s sur votre ${wallet}, enregistr\xE9s en charges.`;
      break;
    case "other_income":
      text2 = `Encaissement de ${A} (${op.label.toLowerCase()}) ${via}. Votre ${wallet} augmente.`;
      break;
    case "depreciation":
      text2 = `Amortissement de ${A} : constate la perte de valeur du mat\xE9riel sur la p\xE9riode (charge sans sortie d'argent).`;
      break;
    default:
      text2 = `Op\xE9ration de ${A} enregistr\xE9e.`;
  }
  return assumed ? `${text2} (Mode de paiement non pr\xE9cis\xE9 : esp\xE8ces suppos\xE9 \u2014 corrigez-moi si besoin.)` : text2;
}
function buildEntries(ops, { ctx, rawInput, inputType, source }) {
  const { dossier, settings, now } = ctx;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const rate = settings.defaultVatRate;
  const noVatRegime = dossier.regimeFiscal === "Synth\xE9tique / Forfait";
  const out = [];
  for (const op of ops) {
    if (!(op.amount > 0)) continue;
    const assumed = !op.paymentMethod && op.settlement !== "credit" && !["depreciation", "transfer"].includes(op.kind);
    const method = op.paymentMethod ?? defaultMethod(op.kind);
    const treasuryCode = (m) => {
      const custom = codeOf(settings.defaultDebitCashAccount);
      return m === "cash" && isTreasuryCode(custom) && custom.startsWith("57") ? custom : treasuryAccountFor(m).code;
    };
    const T = treasuryCode(method);
    let nature = isKnownAccount(op.natureAccountCode) ? op.natureAccountCode : void 0;
    let precedentNote;
    const precedent = findPrecedent(op, ctx);
    if (precedent && precedent.nature !== nature) {
      nature = precedent.nature;
      precedentNote = `Compte ${nature} repris de la correction de l'expert sur l'\xE9criture ${precedent.entry.pieceRef}.`;
    }
    const salesDefault = codeOf(settings.defaultCreditSalesAccount);
    const expenseFallback = "6581";
    const lines = [];
    const paid = op.settlement === "partial" ? Math.min(op.paidAmount ?? 0, op.amount) : void 0;
    const settle = (natureCode, side, deferredNature = natureCode) => {
      const tiers = side === "in" ? "4111" : natureCode.startsWith("641") ? "4211" : natureCode.startsWith("645") ? "4311" : "4011";
      const line2 = (amount, useTiers, n) => side === "in" ? { debit: useTiers ? "4111" : T, credit: n, amount, method } : { debit: n, credit: useTiers ? tiers : T, amount, method };
      if (op.settlement === "credit") lines.push(line2(op.amount, true, deferredNature));
      else if (op.settlement === "partial" && paid && paid < op.amount) {
        lines.push({ ...line2(paid, false, natureCode), suffix: " (acompte)" });
        lines.push({ ...line2(op.amount - paid, true, deferredNature), suffix: " (reste \xE0 r\xE9gler)" });
      } else lines.push(line2(op.amount, false, natureCode));
    };
    switch (op.kind) {
      case "sale": {
        const n = nature && nature.startsWith("7") ? nature : isKnownAccount(salesDefault) && salesDefault.startsWith("7") ? salesDefault : "7011";
        settle(n, "in", n === "7011" ? "7012" : n);
        break;
      }
      case "other_income":
        lines.push({ debit: T, credit: nature && /^[78]/.test(nature) ? nature : "7071", amount: op.amount, method });
        break;
      case "purchase":
        settle(nature && /^[63]/.test(nature) ? nature : "6011", "out");
        break;
      case "expense":
        settle(nature && /^[63]/.test(nature) ? nature : expenseFallback, "out");
        break;
      case "asset_purchase":
        settle(nature && nature.startsWith("2") ? nature : "244", "out");
        break;
      case "customer_payment":
        lines.push({ debit: T, credit: "4111", amount: op.amount, method });
        break;
      case "supplier_payment":
        lines.push({ debit: "4011", credit: T, amount: op.amount, method });
        break;
      case "transfer": {
        const to = op.toMethod ?? "cash";
        if (treasuryCode(to) === T) continue;
        lines.push({ debit: treasuryCode(to), credit: T, amount: op.amount, method });
        break;
      }
      case "owner_withdrawal":
        lines.push({ debit: "4711", credit: T, amount: op.amount, method });
        break;
      case "loan_received":
        lines.push({ debit: T, credit: "162", amount: op.amount, method });
        break;
      case "loan_repayment":
        lines.push({ debit: "162", credit: T, amount: op.amount, method });
        break;
      case "capital_contribution":
      case "opening_balance":
        lines.push({ debit: T, credit: "101", amount: op.amount, method });
        break;
      case "bank_fee":
        lines.push({ debit: "6311", credit: T, amount: op.amount, method });
        break;
      case "depreciation": {
        const asset = nature && DEPRECIATION_ACCOUNT[nature] ? nature : "244";
        lines.push({ debit: "6811", credit: DEPRECIATION_ACCOUNT[asset], amount: op.amount, method: "bank_transfer" });
        break;
      }
    }
    const date = op.date ?? today;
    lines.forEach((line2, idx) => {
      const natureCode = [line2.debit, line2.credit].find((c) => /^[2367]/.test(c) && !isTreasuryCode(c)) ?? "";
      const vatable = op.vatApplicable ?? (!noVatRegime && VAT_KINDS.includes(op.kind) && VATABLE_PREFIXES.some((p) => natureCode.startsWith(p)));
      const tvaAmount = op.vatAmount !== void 0 && lines.length === 1 ? Math.min(Math.max(0, Math.round(op.vatAmount)), line2.amount) : vatable ? Math.round(line2.amount * rate / (100 + rate)) : 0;
      let anomaly = op.anomaly;
      const cashSide = [line2.debit, line2.credit].some((c) => c === "5711" || c === "5721") && line2.method === "cash";
      const flaggable = !["transfer", "opening_balance", "capital_contribution", "loan_received", "loan_repayment", "owner_withdrawal", "depreciation"].includes(op.kind);
      if (!anomaly && cashSide && flaggable && settings.autoFlagLargeCashPayments && line2.amount >= settings.cashDeductibilityThreshold) {
        const inflow = isTreasuryCode(line2.debit);
        anomaly = inflow ? `Encaissement en esp\xE8ces de ${formatFcfa(line2.amount)} FCFA (\u2265 seuil de ${formatFcfa(settings.cashDeductibilityThreshold)} FCFA) : renforcer la tra\xE7abilit\xE9 et le justificatif client.` : `Paiement en esp\xE8ces de ${formatFcfa(line2.amount)} FCFA (\u2265 seuil de ${formatFcfa(settings.cashDeductibilityThreshold)} FCFA) : charge susceptible d'\xEAtre rejet\xE9e fiscalement.`;
      }
      if (!anomaly && date > today) {
        anomaly = `Date post\xE9rieure \xE0 aujourd'hui (${date}) : v\xE9rifier la date de l'op\xE9ration.`;
      }
      if (settings.duplicateDetection) {
        const dup = findDuplicate(line2, op, date, ctx);
        if (dup) {
          anomaly = `Doublon possible avec l'\xE9criture ${dup.pieceRef} du ${dup.date} (m\xEAme montant, m\xEAmes comptes).`;
        }
      }
      const status = anomaly ? "anomaly" : "pending_review";
      const action = anomaly ? "anomaly_flagged" : "created_by_ai";
      const ref = op.pieceRef ?? `OP-${Math.floor(1e3 + Math.random() * 9e3)}`;
      const explanation = explain(op, line2.method, op.amount, paid, assumed);
      const entryLines = simpleLines(line2.debit, line2.credit, line2.amount, tvaAmount);
      out.push({
        id: `entry-${randomUUID2()}`,
        clientDossierId: dossier.id,
        date,
        label: `${op.label}${line2.suffix ?? ""}`.slice(0, 160),
        pieceRef: idx === 0 ? ref : `${ref}-${String.fromCharCode(65 + idx)}`,
        journal: defaultJournal(entryLines),
        lines: entryLines.map((l) => ({ ...l, accountLabel: accountByCode.get(l.accountCode)?.label })),
        amount: line2.amount,
        status,
        detectedAnomaly: anomaly,
        rawInput,
        inputType,
        explanationSimplified: explanation,
        paymentMethod: line2.method,
        auditTrail: [{
          id: `aud-${randomUUID2()}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          action,
          author: "Agent AxeCompta (IA Syscohada)",
          notes: [anomaly, precedentNote, `Attribu\xE9 via ${source}`].filter(Boolean).join(" \u2022 ")
        }]
      });
    });
  }
  return out;
}

// server/agent/gemini.ts
init_syscohadaPlan();
import { GoogleGenAI, Type } from "@google/genai";

// server/agent/heuristic.ts
var QUESTION_START = /^(?:combien|quel(?:le|s|les)?|qui|quand|comment|pourquoi|est-?ce|puis-?je|peux-?je|dois-?je|ai-?je|montre|affiche|donne|dis|explique|c'est quoi|qu'est-?ce|que dois|ou en suis|ou est|bilan|resume|situation|liste|y a-?t-?il|combien|prevision|previsions|aide|help|que puis|comment va)/;
var OPERATION_VERBS = /\b(?:vendu|vendre|vente|achete|achat|paye|payee|regle|encaisse|depense|recu|retire|depose|verse|emprunte|rembourse|approvisionne|livre|facture)\b/;
var GREETING = /^(?:bonjour|bonsoir|salut|coucou|hello|hi|merci|ok|d'accord|super|parfait|bien recu|cool)\b/;
function isGreeting(text2) {
  const n = normalizeText(text2).trim();
  return GREETING.test(n) && extractAmountTokens(text2).length === 0 && n.split(/\s+/).length <= 6;
}
function isQuestion(text2) {
  const n = normalizeText(text2).trim();
  const hasAmount = extractAmountTokens(text2).length > 0;
  if (QUESTION_START.test(n)) return !(hasAmount && OPERATION_VERBS.test(n.split(/[?]/)[0]) && !/^(?:combien|quel|qui|quand|comment)/.test(n));
  if (n.includes("?")) return !(hasAmount && OPERATION_VERBS.test(n));
  return false;
}
var MONTHS2 = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseDateHint(text2, now) {
  const n = normalizeText(text2);
  if (/avant-?hier/.test(n)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return fmt(d);
  }
  if (/\bhier\b/.test(n)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return fmt(d);
  }
  let m = n.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? 2e3 + parseInt(m[3], 10) : parseInt(m[3], 10);
    return fmt(new Date(y, parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
  }
  m = n.match(/\ble\s+(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?:\s+(\d{4}))?/);
  if (m) return fmt(new Date(m[3] ? parseInt(m[3], 10) : now.getFullYear(), MONTHS2.indexOf(m[2]), parseInt(m[1], 10)));
  m = n.match(/\ble\s+(\d{1,2})[/.-](\d{1,2})\b/);
  if (m) return fmt(new Date(now.getFullYear(), parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
  return void 0;
}
function splitSegments(text2) {
  const pieces = text2.split(/\s*(?:;|\n|,\s+|\s+puis\s+|\s+ensuite\s+|\s+et\s+)\s*/i).map((p) => p.trim()).filter(Boolean);
  const segments = [];
  let buffer = "";
  for (const piece of pieces) {
    const norm = normalizeText(piece);
    const hasAmount = extractAmountTokens(piece).length > 0;
    const continuation = /^(?:reste|restant|solde|sur|dont|soit|avec|le reste)\b/.test(norm);
    if (!hasAmount || continuation) {
      if (segments.length > 0) segments[segments.length - 1] += ` ${piece}`;
      else buffer = buffer ? `${buffer} ${piece}` : piece;
    } else {
      segments.push(buffer ? `${buffer} ${piece}` : piece);
      buffer = "";
    }
  }
  if (buffer) segments.push(buffer);
  return segments.length ? segments : [text2];
}
var RE = {
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
  noVat: /sans tva|exonere|non assujetti|hors taxe non|pas de tva/
};
var EXPENSE_NATURES = [
  { re: /electricite|\bcie\b|senelec|\beneo\b|sbee|cash power|woyofal|\bsonabel\b|\bnigelec\b|courant/, code: "6051", label: "Facture d'\xE9lectricit\xE9" },
  { re: /\beau\b|sodeci|\bsde\b|camwater|soneb|\bonea\b|\bsnde\b|facture d'eau/, code: "6052", label: "Facture d'eau" },
  { re: /carburant|essence|gasoil|gazoil|gas-?oil|diesel|\bplein\b|totalenergies|total energies|\bshell\b|oilibya/, code: "6053", label: "Carburant" },
  { re: /transport|\btaxi\b|moto-?taxi|\bworo\b|gbaka|livraison|\bfret\b|manutention|peage|expedition|\bbus\b/, code: "6121", label: "Frais de transport / livraison" },
  { re: /loyer|\bbail\b|location (?:du |de la |d')?(?:boutique|magasin|local|depot|bureau)/, code: "6221", label: "Loyer" },
  { re: /entretien|reparation|reparer|maintenance|depannage|mecanicien|plombier|electricien|vidange/, code: "6241", label: "Entretien et r\xE9parations" },
  { re: /internet|forfait|credit (?:telephon|d.?appel|de communication)|recharge (?:telephon|credit)|airtime|wifi|canalbox|abonnement (?:telephone|internet|orange|mtn|moov)|facture (?:orange|mtn|moov)|telephone|telecom|\bappels?\b/, code: "6271", label: "T\xE9l\xE9communications / Internet" },
  { re: /fourniture|papeterie|emballage|sachets?|ramette|cartouche|nettoyage|produits? d'entretien/, code: "6581", label: "Fournitures et frais divers" }
];
var SERVICE_ACCOUNT = "7061";
var FINISHED_ACCOUNT = "7021";
var COUNTERPARTY_RE = /(?:chez|fournisseur|client|cliente|aupres de|de la part de|a|à|au|de|pour)\s+((?:M\.|Mme|Mr|Dr)?\s*\p{Lu}[\p{L}\d'&.-]*(?:\s+\p{Lu}[\p{L}'&.-]*){0,3})/u;
function extractCounterparty(seg) {
  const m = seg.slice(1).match(COUNTERPARTY_RE);
  if (!m) return void 0;
  const name = m[1].trim();
  if (/^(?:Orange|MTN|Wave|Moov|Cash|Ecobank|Coris|CIE|SODECI|Senelec|Eneo|Mobile|Money)\b/i.test(name)) return void 0;
  return name.length > 2 ? name : void 0;
}
function extractGoods(seg, verbs) {
  const cleaned = seg.replace(/\s+/g, " ").trim();
  const m = cleaned.match(verbs);
  if (!m || m.index === void 0) return void 0;
  const rest = cleaned.slice(m.index + m[0].length).trim();
  const goods = rest.split(/\s+(?:à|a|pour|payé|payée|paye|cash|par|via|chez|au prix|en|espèces|especes|à crédit|a credit|\d)/i)[0].replace(/^(?:pour|de|d')\s*/i, "").trim();
  if (!/[a-zA-Zéèêàçù]{3,}/.test(goods) || goods.length > 70) return void 0;
  if (/\b(?:francs?|fcfa|mille|million|cent|cash)\b/i.test(goods)) return void 0;
  return goods;
}
var ACCOUNT_SHORT = { cash: "Caisse", orange_money: "Orange Money", mtn_momo: "MTN MoMo", wave: "Wave", moov_money: "Moov Money", bank_transfer: "Banque", cheque: "Banque" };
var cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function parseSegment(seg, now) {
  const norm = normalizeText(seg);
  const info = extractAmountInfo(seg);
  const mentions = detectAllPaymentMethods(seg);
  const primary = detectPaymentMethod(seg);
  const date = parseDateHint(seg, now);
  const counterparty = extractCounterparty(seg);
  const isCreditSale = RE.credit.test(norm);
  const vatApplicable = RE.noVat.test(norm) ? false : void 0;
  const base = (kind, label, extra = {}) => {
    const amount = info?.amount ?? 0;
    let settlement = "paid";
    let paidAmount2;
    if (info?.paid && info.paid < amount) {
      settlement = "partial";
      paidAmount2 = info.paid;
    } else if (isCreditSale && (kind === "sale" || kind === "purchase" || kind === "expense" || kind === "asset_purchase")) settlement = "credit";
    return {
      kind,
      amount,
      paymentMethod: primary,
      settlement,
      paidAmount: paidAmount2,
      vatApplicable,
      counterparty,
      label,
      date,
      sourceText: seg,
      ...extra
    };
  };
  const needAmount = (hint) => ({ missing: "amount", hint });
  const fromToPair = () => {
    const methods = mentions.map((m) => m.method);
    const distinct = methods.filter((m, i) => methods.indexOf(m) === i);
    const vers = norm.search(/\bvers\b|\bsur (?:le |mon |ma )?(?:compte|caisse)|\ba destination\b/);
    if (distinct.length >= 2) {
      if (vers >= 0) {
        const before = mentions.filter((m) => m.index < vers);
        const after = mentions.filter((m) => m.index >= vers);
        if (before.length && after.length) return { from: before[before.length - 1].method, to: after[0].method };
      }
      return { from: distinct[0], to: distinct[1] };
    }
    if (distinct.length === 1) {
      const m = distinct[0];
      if (m === "cash") return {};
      if (RE.transferWithdraw.test(norm)) return { from: m, to: "cash" };
      if (RE.transferDeposit.test(norm)) return { from: "cash", to: m };
    }
    return {};
  };
  if (RE.depreciation.test(norm)) {
    if (!info) return needAmount("l'amortissement \xE0 constater");
    const assetCode = /moto|camion|vehicule|voiture|tricycle/.test(norm) ? "215" : /machine|outillage|generateur|groupe electrogene|congelateur/.test(norm) ? "241" : /etagere|mobilier|etal|table|chaise/.test(norm) ? "245" : "244";
    return { op: base("depreciation", `Dotation aux amortissements \u2013 ${cap(extractGoods(seg, /amortissement (?:de |du |d'|des |sur )?(?:l'|la |le |les )?/) ?? "mat\xE9riel")}`, { natureAccountCode: assetCode, paymentMethod: void 0 }) };
  }
  if (RE.opening.test(norm)) {
    if (!info) return needAmount("le solde d'ouverture");
    return { op: base("opening_balance", `Solde d'ouverture \u2013 ${PAYMENT_METHOD_LABEL[primary ?? "cash"]}`) };
  }
  if (RE.ownerWithdrawal.test(norm) && !RE.customerPayment.test(norm)) {
    if (!info) return needAmount("le retrait");
    return { op: base("owner_withdrawal", "Retrait de fonds sans affectation professionnelle", {
      natureAccountCode: "4711",
      anomaly: "Retrait de fonds sans motif d\u2019affectation professionnelle : risque de confusion de patrimoine."
    }) };
  }
  if (RE.transferVerb.test(norm) && mentions.length > 0 && !RE.salary.test(norm) && !RE.supplierPayment.test(norm) && !RE.customerPayment.test(norm) && !RE.sale.test(norm) && !RE.purchase.test(norm)) {
    const { from, to } = fromToPair();
    if (from && to && from !== to) {
      if (!info) return needAmount("le transfert");
      return { op: base("transfer", `Transfert de fonds : ${ACCOUNT_SHORT[from]} \u2192 ${ACCOUNT_SHORT[to]}`, { paymentMethod: from, toMethod: to, settlement: "paid" }) };
    }
  }
  if (/\bretrait\b|\bretire\b/.test(norm) && (!primary || primary === "cash") && !RE.purchase.test(norm) && !RE.salary.test(norm) && !/fournisseur/.test(norm)) {
    if (!info) return needAmount("le retrait");
    return { op: base("owner_withdrawal", "Retrait d\u2019esp\xE8ces sans justificatif pr\xE9cis", {
      natureAccountCode: "4711",
      anomaly: "Retrait de fonds sans motif d\u2019affectation professionnelle : risque de confusion de patrimoine."
    }) };
  }
  if (RE.loanRepayment.test(norm)) {
    if (!info) return needAmount("l'\xE9ch\xE9ance rembours\xE9e");
    return { op: base("loan_repayment", "Remboursement d\u2019emprunt") };
  }
  if (RE.loanReceived.test(norm)) {
    if (!info) return needAmount("le montant du pr\xEAt");
    return { op: base("loan_received", `Emprunt re\xE7u${counterparty ? ` \u2013 ${counterparty}` : ""}`) };
  }
  if (RE.capital.test(norm)) {
    if (!info) return needAmount("l'apport");
    return { op: base("capital_contribution", "Apport en capital") };
  }
  if (RE.bankFee.test(norm) && !RE.commissionEarned.test(norm)) {
    if (!info) return needAmount("les frais");
    return { op: base("bank_fee", `Frais bancaires / Mobile Money${primary ? ` (${PAYMENT_METHOD_LABEL[primary]})` : ""}`) };
  }
  if (RE.commissionEarned.test(norm)) {
    if (!info) return needAmount("la commission");
    return { op: base("other_income", "Commission re\xE7ue", { natureAccountCode: "7071" }) };
  }
  if (RE.supplierPayment.test(norm) && !/\bachete\b|\bachat\b/.test(norm)) {
    if (!info) return needAmount("le r\xE8glement");
    return { op: base("supplier_payment", `R\xE8glement fournisseur${counterparty ? ` ${counterparty}` : ""}`, { settlement: "paid" }) };
  }
  if (RE.customerPayment.test(norm) && !/\bvendu\b/.test(norm)) {
    if (!info) return needAmount("le r\xE8glement");
    return { op: base("customer_payment", `R\xE8glement client${counterparty ? ` ${counterparty}` : ""}`, { settlement: "paid" }) };
  }
  if (RE.social.test(norm)) {
    if (!info) return needAmount("les cotisations");
    return { op: base("expense", "Cotisations sociales", { natureAccountCode: "6641", vatApplicable: false }) };
  }
  if (RE.salary.test(norm)) {
    if (!info) return needAmount("le salaire");
    return { op: base("expense", `Salaires${counterparty ? ` \u2013 ${counterparty}` : ""}`, { natureAccountCode: "6611", vatApplicable: false }) };
  }
  if (RE.asset.test(norm)) {
    if (!info) return needAmount("le prix de l'\xE9quipement");
    const code = /moto\b|camion|vehicule|voiture|tricycle/.test(norm) ? "215" : /machine|generateur|groupe electrogene|congelateur|frigo|refrigerateur|balance/.test(norm) ? "241" : /etagere|mobilier|etal\b/.test(norm) ? "245" : "244";
    const goods = extractGoods(seg, /(?:achete|achat|acquis|acquisition|paye|payer)\s+(?:d'|de |du |des |un |une |le |la |l')?/i);
    return { op: base("asset_purchase", `Acquisition ${goods ? cap(goods) : "d\u2019immobilisation"}`, { natureAccountCode: code }) };
  }
  const isSaleWord = RE.sale.test(norm);
  if (!isSaleWord) {
    for (const rule of EXPENSE_NATURES) {
      if (rule.re.test(norm)) {
        if (!info) return needAmount(rule.label.toLowerCase());
        return { op: base("expense", rule.label, { natureAccountCode: rule.code }) };
      }
    }
  }
  if (isSaleWord) {
    if (!info) return needAmount("la vente");
    const isService = RE.service.test(norm);
    const isFinished = RE.finished.test(norm);
    const goods = extractGoods(seg, /(?:vendu|vend|vente d[eu']?s?|facture|livre)\s+(?:d'|de |du |des |la |le |les |l')?/i);
    const label = isService ? `Prestation${goods ? ` : ${goods}` : ""}` : `Vente${goods ? ` de ${goods}` : ""}`;
    return { op: base("sale", `${label}${counterparty ? ` \u2013 ${counterparty}` : ""}`, {
      natureAccountCode: isService ? SERVICE_ACCOUNT : isFinished ? FINISHED_ACCOUNT : "7011"
    }) };
  }
  if (RE.purchase.test(norm) || /\bachete\b/.test(norm)) {
    if (!info) return needAmount("l'achat");
    const goods = extractGoods(seg, /(?:achete|achat|acheter|commande|approvisionnement)\s+(?:d'|de |du |des |la |le |les |l')?/i);
    return { op: base("purchase", `Achat${goods ? ` de ${goods}` : " de marchandises"}${counterparty ? ` \u2013 ${counterparty}` : ""}`, {
      natureAccountCode: RE.rawMaterial.test(norm) ? "6021" : "6011"
    }) };
  }
  if (RE.otherIncome.test(norm)) {
    if (!info) return needAmount("le montant re\xE7u");
    return { op: base("other_income", "Produit accessoire", { natureAccountCode: /subvention|don\b/.test(norm) ? "8411" : "7071" }) };
  }
  if (/\b(?:paye|payee|regle|depense|decaisse|sorti|sortie|debourse|reglement)\b/.test(norm)) {
    if (!info) return needAmount("la d\xE9pense");
    return { op: base("expense", "D\xE9pense diverse \xE0 qualifier", { natureAccountCode: "6581" }) };
  }
  if (/\b(?:recu|encaisse|rentre|rentree|entree|touche|gagne)\b/.test(norm)) {
    if (!info) return needAmount("l'encaissement");
    return { op: base("sale", "Encaissement \xE0 qualifier", { natureAccountCode: "7011" }) };
  }
  return { missing: "kind" };
}
function detectProvider(norm) {
  if (/orange/.test(norm)) return "orange_money";
  if (/\bmtn\b|momo/.test(norm)) return "mtn_momo";
  if (/\bwave\b/.test(norm)) return "wave";
  if (/\bmoov\b|flooz/.test(norm)) return "moov_money";
  return void 0;
}
function looksLikeMobileMoneySms(text2) {
  const n = normalizeText(text2);
  return !!detectProvider(n) && /solde|transaction|\bid\b|ref|vous avez (?:recu|envoye|paye|retire)|you have|frais|balance/.test(n) && extractAmountTokens(text2).length > 0;
}
function parseMobileMoneySms(sms, now) {
  const norm = normalizeText(sms);
  const provider = detectProvider(norm) ?? detectPaymentMethod(sms);
  const tokens2 = extractAmountTokens(sms);
  const before = (idx) => norm.slice(Math.max(0, idx - 22), idx);
  let amount;
  let fee = 0;
  for (const t of tokens2) {
    const ctx = before(t.index);
    if (/(?:solde|balance)[^0-9]{0,18}$/.test(ctx)) continue;
    if (/(?:frais|fee|commission|taxe)[^0-9]{0,12}$/.test(ctx)) {
      fee += t.value;
      continue;
    }
    if (amount === void 0) amount = t.value;
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
  const common = { paymentMethod: provider, settlement: "paid", counterparty, date, pieceRef, sourceText: sms, fee: fee || void 0 };
  const ops = [];
  if (withdrawal && !received) {
    ops.push({ kind: "transfer", amount, ...common, toMethod: "cash", label: `Retrait Mobile Money \u2192 caisse (${PAYMENT_METHOD_LABEL[provider ?? "orange_money"]})` });
  } else if (received) {
    ops.push({
      kind: "sale",
      amount,
      ...common,
      natureAccountCode: "7011",
      label: `Encaissement ${PAYMENT_METHOD_LABEL[provider ?? "orange_money"]}${counterparty ? ` de ${counterparty}` : ""}`,
      explanation: void 0
    });
  } else if (airtime) {
    ops.push({ kind: "expense", amount, ...common, natureAccountCode: "6271", label: `Achat cr\xE9dit / forfait (${PAYMENT_METHOD_LABEL[provider ?? "orange_money"]})` });
  } else {
    ops.push({ kind: "expense", amount, ...common, natureAccountCode: "6011", label: `Paiement Mobile Money${counterparty ? ` \xE0 ${counterparty}` : ""}` });
  }
  if (fee > 0) {
    ops.push({ kind: "bank_fee", amount: fee, paymentMethod: provider, settlement: "paid", label: `Frais ${PAYMENT_METHOD_LABEL[provider ?? "orange_money"]}`, date, pieceRef, sourceText: sms });
  }
  return ops;
}
function parseWithHeuristics(text2, inputType, now) {
  if (inputType === "mobile_money" || looksLikeMobileMoneySms(text2)) {
    const ops = parseMobileMoneySms(text2, now);
    if (ops.length) return { intent: "operation", operations: ops };
    return { intent: "clarification", operations: [], clarification: "Je n'ai pas trouv\xE9 le montant dans ce SMS. Pouvez-vous coller le message complet (avec le montant en FCFA) ?" };
  }
  const segments = splitSegments(text2);
  const operations = [];
  const missing = [];
  for (const seg of segments) {
    const r = parseSegment(seg, now);
    if ("op" in r) operations.push(r.op);
    else missing.push(r);
  }
  if (operations.length > 0) {
    const note = missing.length ? ` (une partie de votre message n'a pas pu \xEAtre comprise : pr\xE9cisez-la si besoin)` : "";
    return { intent: "operation", operations, reply: note || void 0 };
  }
  const first = missing[0];
  if (first?.missing === "amount") {
    return { intent: "clarification", operations: [], clarification: `J'ai bien compris l'op\xE9ration (${first.hint}), mais je ne trouve pas le montant. Quel est le montant en FCFA ?` };
  }
  return {
    intent: "clarification",
    operations: [],
    clarification: "Je n'ai pas compris s'il s'agit d'une vente, d'un achat, d'un paiement ou d'un transfert. Pouvez-vous pr\xE9ciser, avec le montant ? Exemple : \xAB J'ai vendu 3 sacs de ciment \xE0 5000 F, pay\xE9 en esp\xE8ces \xBB."
  };
}

// server/agent/gemini.ts
var client = null;
function getGenAI() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) {
    client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
  }
  return client;
}
function modelCandidates(settings) {
  if (settings.aiModelPreference === "heuristic-fast") return [];
  const primary = settings.aiModelPreference === "gemini-2.5-flash-lite" ? process.env.GEMINI_MODEL_LITE || "gemini-flash-lite-latest" : process.env.GEMINI_MODEL || "gemini-3.6-flash";
  return Array.from(/* @__PURE__ */ new Set([primary, "gemini-flash-latest", "gemini-flash-lite-latest"]));
}
var RETRYABLE_MODEL_ERROR = /404|NOT_FOUND|no longer available|503|UNAVAILABLE|high demand|429|RESOURCE_EXHAUSTED/i;
function modelFromSettings(settings) {
  return modelCandidates(settings)[0] ?? null;
}
var KINDS = [
  "sale",
  "purchase",
  "expense",
  "asset_purchase",
  "customer_payment",
  "supplier_payment",
  "owner_withdrawal",
  "transfer",
  "loan_received",
  "loan_repayment",
  "capital_contribution",
  "opening_balance",
  "bank_fee",
  "other_income",
  "depreciation"
];
var METHODS = ["cash", "orange_money", "mtn_momo", "wave", "moov_money", "bank_transfer", "cheque"];
var NATURE_ACCOUNTS = SYSCOHADA_ACCOUNTS.filter((a) => !isTreasuryCode(a.code)).map((a) => `${a.code}=${a.label}`).join(" ; ");
function buildPrompt(text2, hasDocument, dossier, settings, analytics) {
  return `Tu es AxeCompta, l'agent comptable IA de la zone OHADA (r\xE9f\xE9rentiel SYSCOHADA) pour un entrepreneur ou un cabinet francophone d'Afrique.
Entreprise : activit\xE9 \xAB ${dossier.activity} \xBB, pays ${dossier.country}, r\xE9gime ${dossier.regimeFiscal}, devise FCFA. Taux de TVA par d\xE9faut : ${settings.defaultVatRate} %.
Date du jour : ${analytics.date}.

TU DOIS CLASSER LE MESSAGE (ou le document joint) dans UNE intention :
- "operation" : l'utilisateur raconte une ou plusieurs op\xE9rations \xE0 enregistrer (vente, achat, d\xE9pense, paiement, encaissement, transfert\u2026). D\xE9coupe en une op\xE9ration par transaction distincte.
- "question" : il pose une question sur ses chiffres, sa tr\xE9sorerie, la fiscalit\xE9, un cr\xE9dit, ou demande une explication comptable. R\xE9ponds dans "reply", en fran\xE7ais simple, 2 \xE0 4 phrases, UNIQUEMENT avec les chiffres du JSON \xAB DONN\xC9ES DU DOSSIER \xBB ci-dessous (n'invente jamais un chiffre ; si l'information manque, dis-le).
- "clarification" : une information indispensable manque (montant, sens de l'op\xE9ration). Pose UNE question courte dans "clarification". Ne devine jamais un montant.
- "chitchat" : salutation ou remerciement. R\xE9ponds bri\xE8vement dans "reply".

R\xC8GLES POUR LES OP\xC9RATIONS :
- Ne choisis PAS le compte de tr\xE9sorerie : il est d\xE9duit automatiquement du mode de paiement (esp\xE8ces \u2192 caisse 5711 ; ch\xE8que ou virement bancaire \u2192 banque 5211 ; Orange Money \u2192 5261 ; MTN MoMo \u2192 5262 ; Wave \u2192 5263 ; Moov Money \u2192 5264).
- "paymentMethod" = le mode dit par l'utilisateur : "cash" (cash, esp\xE8ces, liquide, comptant), "cheque", "bank_transfer" (virement, banque), "orange_money", "mtn_momo", "wave", "moov_money". Si rien n'est pr\xE9cis\xE9, mets "unspecified".
- "natureAccountCode" = le compte de l'autre c\xF4t\xE9 de l'\xE9criture, choisi UNIQUEMENT dans cette liste : ${NATURE_ACCOUNTS}.
  Ventes de marchandises 7011, services 7061, produits finis 7021, achats de marchandises 6011, mati\xE8res premi\xE8res 6021, \xE9lectricit\xE9 6051, eau 6052, carburant 6053, transport 6121, loyer 6221, entretien 6241, t\xE9l\xE9coms 6271, frais bancaires / Mobile Money 6311, salaires 6611, charges sociales 6641, imp\xF4ts et taxes 6411, divers 6581, mat\xE9riel informatique 244, v\xE9hicule 215, mat\xE9riel industriel 241, mobilier 245, emprunt 162.
- "kind" : sale, purchase, expense, asset_purchase (\xE9quipement durable), customer_payment (un client r\xE8gle une dette), supplier_payment (r\xE8glement d'une dette fournisseur), owner_withdrawal (retrait personnel / sans justificatif), transfer (d\xE9placement entre caisse, banque, Mobile Money : paymentMethod = source, toPaymentMethod = destination), loan_received, loan_repayment, capital_contribution, opening_balance (solde de d\xE9part), bank_fee, other_income, depreciation.
- "settlement" : "paid" (r\xE9gl\xE9), "credit" (pas encore pay\xE9) ou "partial" (acompte : renseigne paidAmount).
- "amount" = montant TOTAL TTC en FCFA (entier). Quantit\xE9 \xD7 prix unitaire si besoin ("3 sacs \xE0 5000F" = 15000). "45k" = 45000.
- "vatApplicable" : true seulement pour ventes/achats/d\xE9penses soumis \xE0 TVA ; false pour salaires, pr\xEAts, transferts, frais bancaires, retraits. Si un document indique la TVA, renseigne "vatAmount".
- "anomaly" : cha\xEEne non vide UNIQUEMENT pour une vraie anomalie (retrait sans justificatif, m\xE9lange personnel/professionnel, montant incoh\xE9rent, doublon \xE9vident). Une simple incertitude n'est jamais une "anomaly".
- "sourceSnippet" : le morceau exact du message d'o\xF9 vient cette op\xE9ration.
- "label" : libell\xE9 comptable court. "date" au format AAAA-MM-JJ si l'utilisateur ou le document pr\xE9cise une date (hier, avant-hier, date sur le re\xE7u), sinon vide.
- SMS Mobile Money : reconnais l'op\xE9rateur, le montant, les frais (op\xE9ration bank_fee s\xE9par\xE9e), l'identifiant de transaction ("pieceRef"). Un SMS \xAB vous avez re\xE7u \xBB = encaissement \xE0 confirmer.
${hasDocument ? '- Un document est joint (facture, re\xE7u, relev\xE9, PDF) : extrais fournisseur/client (counterparty), date, num\xE9ro (pieceRef), montant TTC, TVA (vatAmount), mode de paiement lu sur la pi\xE8ce. Si le document est illisible, intent = "clarification".\n' : ""}
DONN\xC9ES DU DOSSIER (calcul\xE9es sur les \xE9critures r\xE9elles) :
${JSON.stringify(analytics)}

MESSAGE DE L'UTILISATEUR : \xAB ${text2} \xBB`;
}
var operationSchema = {
  type: Type.OBJECT,
  properties: {
    kind: { type: Type.STRING, enum: KINDS },
    amount: { type: Type.NUMBER },
    natureAccountCode: { type: Type.STRING },
    paymentMethod: { type: Type.STRING, enum: [...METHODS, "unspecified"] },
    toPaymentMethod: { type: Type.STRING, enum: [...METHODS, "unspecified"] },
    settlement: { type: Type.STRING, enum: ["paid", "credit", "partial"] },
    paidAmount: { type: Type.NUMBER },
    vatApplicable: { type: Type.BOOLEAN },
    vatAmount: { type: Type.NUMBER },
    counterparty: { type: Type.STRING },
    label: { type: Type.STRING },
    anomaly: { type: Type.STRING },
    date: { type: Type.STRING },
    pieceRef: { type: Type.STRING },
    sourceSnippet: { type: Type.STRING }
  },
  required: ["kind", "amount", "paymentMethod", "settlement", "label", "sourceSnippet"]
};
var responseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ["operation", "question", "clarification", "chitchat"] },
    reply: { type: Type.STRING },
    clarification: { type: Type.STRING },
    operations: { type: Type.ARRAY, items: operationSchema }
  },
  required: ["intent", "operations"]
};
var validMethod = (m) => METHODS.includes(m) ? m : void 0;
function reconcileOperations(raw, fullText, now) {
  const wholeMentions = Array.from(new Set(detectAllPaymentMethods(fullText).map((m) => m.method)));
  const ops = [];
  for (const r of raw) {
    if (!KINDS.includes(r?.kind)) continue;
    const amount = Math.round(Number(r.amount));
    if (!(amount > 0)) continue;
    const snippet = typeof r.sourceSnippet === "string" && r.sourceSnippet ? r.sourceSnippet : fullText;
    const fromSnippet = detectPaymentMethod(snippet);
    let paymentMethod = fromSnippet ?? (raw.length === 1 || wholeMentions.length === 1 ? detectPaymentMethod(fullText) : void 0) ?? validMethod(r.paymentMethod);
    let toMethod = validMethod(r.toPaymentMethod);
    if (r.kind === "transfer") {
      const mentions = Array.from(new Set(detectAllPaymentMethods(snippet).map((m) => m.method)));
      if (mentions.length >= 2) {
        const h = parseWithHeuristics(snippet, "text", now).operations.find((o) => o.kind === "transfer");
        if (h) {
          paymentMethod = h.paymentMethod;
          toMethod = h.toMethod;
        }
      }
      if (!paymentMethod || !toMethod || paymentMethod === toMethod) {
        const h = parseWithHeuristics(snippet, "text", now).operations.find((o) => o.kind === "transfer");
        if (h?.paymentMethod && h.toMethod) {
          paymentMethod = h.paymentMethod;
          toMethod = h.toMethod;
        } else continue;
      }
    }
    const paid = Number(r.paidAmount);
    ops.push({
      kind: r.kind,
      amount,
      natureAccountCode: isKnownAccount(r.natureAccountCode) && !isTreasuryCode(r.natureAccountCode) ? r.natureAccountCode : void 0,
      paymentMethod,
      toMethod,
      settlement: r.settlement === "credit" || r.settlement === "partial" ? r.settlement : "paid",
      paidAmount: paid > 0 && paid < amount ? Math.round(paid) : void 0,
      vatApplicable: typeof r.vatApplicable === "boolean" ? r.vatApplicable : void 0,
      vatAmount: Number(r.vatAmount) > 0 ? Math.round(Number(r.vatAmount)) : void 0,
      counterparty: r.counterparty || void 0,
      label: String(r.label || "Op\xE9ration").slice(0, 140),
      anomaly: r.anomaly ? String(r.anomaly) : void 0,
      date: /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "") ? r.date : void 0,
      pieceRef: r.pieceRef || void 0,
      sourceText: snippet
    });
  }
  return ops;
}
var usedModel = null;
async function analyzeWithGemini(input) {
  const ai = getGenAI();
  const candidates = modelCandidates(input.settings);
  if (!ai || candidates.length === 0) return null;
  const prompt = buildPrompt(input.text || "Analyse le document joint.", !!input.image, input.dossier, input.settings, input.analytics);
  try {
    let response;
    let lastError;
    const startedAt = Date.now();
    for (const model of candidates) {
      if (response === void 0 && Date.now() - startedAt > 13e3) break;
      try {
        response = await ai.models.generateContent({
          model,
          contents: input.image ? { parts: [{ inlineData: { data: input.image.data, mimeType: input.image.mimeType } }, { text: prompt }] } : prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.1,
            httpOptions: { timeout: 12e3 },
            // Réflexion minimale sur la famille 3.x : classer une phrase ne demande pas de raisonnement long
            .../^gemini-3\./.test(model) ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}
          }
        });
        usedModel = model;
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Gemini (${model}) indisponible :`, String(err?.message).slice(0, 140));
        if (!RETRYABLE_MODEL_ERROR.test(String(err?.message))) throw err;
      }
    }
    if (!response) throw lastError;
    const parsed = JSON.parse(response.text?.trim() || "{}");
    const intent = ["operation", "question", "clarification", "chitchat"].includes(parsed.intent) ? parsed.intent : "operation";
    if (intent === "operation") {
      const ops = reconcileOperations(parsed.operations ?? [], input.text, input.now);
      if (ops.length === 0) return null;
      return { intent, operations: ops };
    }
    return { intent, operations: [], reply: parsed.reply || void 0, clarification: parsed.clarification || void 0 };
  } catch (err) {
    console.warn("Gemini indisponible, bascule sur le moteur de r\xE8gles :", err?.message);
    return null;
  }
}

// server/agentRoutes.ts
var router12 = Router12();
var INPUT_MODES2 = ["text", "voice", "photo", "mobile_money", "manual", "excel_import"];
var ALLOWED_DOCUMENT_TYPES = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
function handler2(fn) {
  return (req, res, next) => fn(req, res).catch(next);
}
async function loadContext(req, dossierId) {
  const user = getAuthUser(req);
  if (!user) return null;
  const dossierRow = await prisma.clientDossier.findFirst({
    where: { id: dossierId, ...dossierScopeWhere(req) },
    include: { owner: { select: { name: true } } }
  });
  if (!dossierRow) return null;
  const [entryRows, settingsRow, userRow] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { clientDossierId: dossierId, status: { not: "cancelled" } },
      include: ENTRY_INCLUDE,
      orderBy: { date: "desc" },
      take: 2e3
    }),
    prisma.platformSettings.findUnique({ where: { dossierId } }),
    prisma.user.findUnique({ where: { id: user.sub }, select: { name: true } })
  ]);
  return {
    dossier: serializeDossier(dossierRow),
    entries: entryRows.map(serializeEntry),
    settings: settingsRow ? serializePlatformSettings(settingsRow) : DEFAULT_PLATFORM_SETTINGS,
    now: /* @__PURE__ */ new Date(),
    userName: userRow?.name ?? ""
  };
}
function summarize(entries) {
  if (entries.length === 1) return entries[0].explanationSimplified;
  const lines = entries.map((e) => `\u2022 ${e.label} \u2014 ${formatFcfa(e.amount)} FCFA (${accountsSummary(e)})`);
  return `J'ai enregistr\xE9 ${entries.length} \xE9critures :
${lines.join("\n")}`;
}
function reviewNote(entries) {
  const anomaly = entries.find((e) => e.status === "anomaly");
  return anomaly ? `

\u26A0\uFE0F ${anomaly.detectedAnomaly}` : "";
}
router12.post("/chat", handler2(async (req, res) => {
  const { dossierId, message = "", inputType = "text", pendingText, image } = req.body ?? {};
  if (typeof dossierId !== "string" || !String(message).trim() && !image) {
    return res.status(400).json({ error: "Dossier et message requis." });
  }
  const mode = INPUT_MODES2.includes(inputType) ? inputType : "text";
  let imagePayload;
  if (image) {
    const mimeType = String(image.mimeType || "");
    if (!ALLOWED_DOCUMENT_TYPES.test(mimeType) || typeof image.data !== "string") {
      return res.status(400).json({ error: "Format de document non pris en charge (JPEG, PNG, WebP ou PDF)." });
    }
    if (image.data.length > 12e6) {
      return res.status(413).json({ error: "Document trop volumineux." });
    }
    imagePayload = { data: image.data.replace(/^data:[^;]+;base64,/, ""), mimeType };
  }
  const ctx = await loadContext(req, dossierId);
  if (!ctx) return res.status(404).json({ error: "Dossier introuvable." });
  const isFollowUp = typeof pendingText === "string" && pendingText && !isQuestion(message) && !isGreeting(message);
  const text2 = isFollowUp ? `${pendingText} ${message}`.trim() : String(message).trim();
  const analytics = buildAgentContext(ctx.entries, ctx.now);
  const model = modelFromSettings(ctx.settings);
  let outcome = null;
  let source = "moteur-de-regles";
  if (getGenAI() && model) {
    outcome = await analyzeWithGemini({ text: text2, image: imagePayload, dossier: ctx.dossier, settings: ctx.settings, analytics, now: ctx.now });
    if (outcome) source = usedModel ?? model;
  }
  if (!outcome) {
    if (imagePayload) {
      return res.json({
        success: true,
        intent: "clarification",
        reply: "Je ne peux pas lire les photos ou PDF pour le moment (l'IA de lecture de documents est indisponible). \xC9crivez-moi simplement ce que dit le re\xE7u : fournisseur, montant et mode de paiement. Exemple : \xAB Facture SOCOCE 42 500 F pay\xE9e en esp\xE8ces \xBB.",
        entries: [],
        source
      });
    }
    if (isGreeting(text2)) outcome = { intent: "chitchat", operations: [], reply: greetingReply(ctx.dossier, text2, ctx.userName) };
    else if (isQuestion(text2)) outcome = { intent: "question", operations: [], reply: answerQuestion(text2, analytics, ctx.dossier, ctx.settings) };
    else outcome = parseWithHeuristics(text2, mode, ctx.now);
  }
  if (outcome.intent === "chitchat") {
    outcome.reply = greetingReply(ctx.dossier, text2, ctx.userName);
  }
  if (outcome.intent === "question" && !outcome.reply) outcome.reply = answerQuestion(text2, analytics, ctx.dossier, ctx.settings);
  if (outcome.intent === "operation") {
    const entries = buildEntries(outcome.operations, { ctx, rawInput: String(message).trim() || text2, inputType: imagePayload ? "photo" : mode, source });
    if (entries.length === 0) {
      return res.json({ success: true, intent: "clarification", reply: "Je n'ai pas pu construire d'\xE9criture valide (montant manquant ou comptes identiques). Pouvez-vous reformuler avec le montant et le mode de paiement ?", entries: [], pendingText: text2, source });
    }
    const counts = computeReviewCounts(entries);
    return res.json({
      success: true,
      intent: "operation",
      reply: `${summarize(entries)}${reviewNote(entries)}${outcome.reply ?? ""}`,
      entries,
      review: counts,
      source,
      quickActions: ["Combien j'ai en caisse ?", "Mes ventes du mois", "Qui me doit de l'argent ?"]
    });
  }
  if (outcome.intent === "clarification") {
    return res.json({
      success: true,
      intent: "clarification",
      reply: outcome.clarification || outcome.reply || "Pouvez-vous pr\xE9ciser le montant et le mode de paiement ?",
      entries: [],
      pendingText: text2,
      source
    });
  }
  return res.json({ success: true, intent: outcome.intent, reply: outcome.reply, entries: [], source });
}));
router12.post("/dossier-summary", handler2(async (req, res) => {
  const ctx = await loadContext(req, String(req.body?.dossierId ?? ""));
  if (!ctx) return res.status(404).json({ error: "Dossier introuvable." });
  const a = buildAgentContext(ctx.entries, ctx.now);
  const f = (n) => `${formatFcfa(n)} FCFA`;
  const points = [];
  if (a.review.anomalies) points.push(`${a.review.anomalies} anomalie(s) \xE0 examiner`);
  if (a.review.pending) points.push(`${a.review.pending} \xE9criture(s) en attente de validation`);
  if (a.treasury.total < 0) points.push("tr\xE9sorerie n\xE9gative : soldes d\u2019ouverture manquants ou d\xE9caissements non justifi\xE9s");
  if (a.receivables.total > a.month.revenue && a.receivables.total > 0) points.push(`cr\xE9ances clients \xE9lev\xE9es (${f(a.receivables.total)})`);
  if (a.forecast.runwayDays !== null && a.forecast.runwayDays < 60) points.push(`tr\xE9sorerie pour environ ${a.forecast.runwayDays} jours au rythme actuel`);
  if (a.credit.sufficientData && a.credit.traceabilityRate < 40) points.push(`seulement ${a.credit.traceabilityRate}% des ventes trac\xE9es hors esp\xE8ces`);
  const thresholdBatch = ctx.entries.filter((e) => e.status === "pending_review" && !e.detectedAnomaly).length;
  res.json({
    dossierId: ctx.dossier.id,
    summary: `${ctx.dossier.name} : tr\xE9sorerie ${f(a.treasury.total)}, chiffre d'affaires du mois ${f(a.month.revenue)}, charges ${f(a.month.expenses)}, r\xE9sultat ${f(a.month.result)}. TVA du mois : ${a.tva.netToPay > 0 ? `${f(a.tva.netToPay)} \xE0 reverser` : `cr\xE9dit de ${f(a.tva.credit)}`}. Score de solvabilit\xE9 ${a.credit.sufficientData ? `${a.credit.score}/100` : "non \xE9valuable (historique insuffisant)"}.`,
    points,
    batchValidationCandidates: thresholdBatch,
    analytics: a
  });
}));
var agentRoutes_default = router12;

// server/authRoutes.ts
init_db();
import { Router as Router13 } from "express";
var router13 = Router13();
function serializeUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, dossierId: u.dossierId };
}
router13.post("/signup", async (req, res, next) => {
  try {
    const { email, name, password } = req.body ?? {};
    if (typeof email !== "string" || typeof name !== "string" || !email.trim() || !name.trim() || !password) {
      return res.status(400).json({ error: "Nom de l'entreprise, email et mot de passe requis." });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caract\xE8res." });
    }
    const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (existing) {
      return res.status(409).json({ error: "Un compte existe d\xE9j\xE0 avec cet email." });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email: email.trim(), name: name.trim(), passwordHash, role: "COMPTABLE", organization: { create: { name: name.trim() } } }
    });
    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.status(201).json(serializeUser(user));
  } catch (e) {
    next(e);
  }
});
router13.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis." });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !await verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }
    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json(serializeUser(user));
  } catch (e) {
    next(e);
  }
});
router13.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: void 0 });
  res.status(204).end();
});
router13.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caract\xE8res." });
    }
    const user = await prisma.user.findUnique({ where: { id: getAuthUser(req).sub } });
    if (!user || typeof currentPassword !== "string" || !await verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: "Mot de passe actuel incorrect." });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
router13.get("/me", async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return res.status(401).json({ error: "Non authentifi\xE9." });
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ error: "Non authentifi\xE9." });
    }
    res.json(serializeUser(user));
  } catch (e) {
    next(e);
  }
});
var authRoutes_default = router13;

// server/adminRoutes.ts
init_db();
import { Router as Router14 } from "express";
var router14 = Router14();
var ROLES = ["ADMIN", "COMPTABLE"];
function requireAdmin(req, res, next) {
  const user = req.user;
  if (!user || user.role !== "ADMIN") {
    return res.status(403).json({ error: "R\xE9serv\xE9 aux administrateurs." });
  }
  next();
}
function serializeUser2(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt.toISOString(), organizationName: u.organization?.name };
}
var WITH_ORG = { organization: { select: { name: true } } };
function validId(value) {
  if (typeof value !== "string") return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}
router14.use(requireAdmin);
router14.get("/users", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: WITH_ORG });
    res.json(users.map(serializeUser2));
  } catch (e) {
    next(e);
  }
});
router14.post("/users", async (req, res, next) => {
  try {
    const { email, name, password, role } = req.body ?? {};
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Email invalide." });
    }
    if (typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Nom requis." });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caract\xE8res." });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: "R\xF4le invalide." });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Un compte existe d\xE9j\xE0 avec cet email." });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, name: name.trim(), passwordHash, role, organization: { create: { name: name.trim() } } }, include: WITH_ORG });
    res.status(201).json(serializeUser2(user));
  } catch (e) {
    next(e);
  }
});
router14.post("/users/:id/role", async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant utilisateur invalide." });
    const { role } = req.body ?? {};
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: "R\xF4le invalide." });
    }
    const requester = req.user;
    if (id === requester.sub && role !== "ADMIN") {
      return res.status(400).json({ error: "Vous ne pouvez pas retirer votre propre r\xF4le administrateur." });
    }
    const updated = await prisma.user.update({ where: { id }, data: { role }, include: WITH_ORG });
    res.json(serializeUser2(updated));
  } catch (e) {
    next(e);
  }
});
router14.post("/users/:id/password", async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant utilisateur invalide." });
    const { password } = req.body ?? {};
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caract\xE8res." });
    }
    const updated = await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) }, include: WITH_ORG });
    res.json(serializeUser2(updated));
  } catch (e) {
    next(e);
  }
});
router14.post("/users/:id/delete", async (req, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant utilisateur invalide." });
    const requester = req.user;
    if (id === requester.sub) {
      return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
    }
    const target = await prisma.user.findUnique({ where: { id }, select: { dossierId: true, organizationId: true } });
    if (!target) return res.status(404).json({ error: "Utilisateur introuvable." });
    if (target.dossierId) await prisma.user.delete({ where: { id } });
    else await prisma.organization.delete({ where: { id: target.organizationId } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
var adminRoutes_default = router14;

// server/app.ts
var app = express();
app.disable("x-powered-by");
var ALLOWED_METHODS = ["GET", "POST", "OPTIONS"];
var ALLOWED_ORIGINS = [process.env.APP_URL, ...process.env.ALLOWED_ORIGINS?.split(",") ?? []].map((o) => o?.trim()).filter((o) => Boolean(o));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS.join(", "));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "600");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({ error: "M\xE9thode HTTP non autoris\xE9e (GET, POST ou OPTIONS uniquement)." });
  }
  next();
});
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());
app.use("/api/auth", authRoutes_default);
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    product: "AxeCompta",
    edition: "SYSCOHADA R\xE9vis\xE9 2026",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});
app.use("/api", requireAuth);
app.use("/api/agent", agentRoutes_default);
app.use("/api", routes_default);
app.use("/api/admin", adminRoutes_default);
function publicErrorMessage(err) {
  switch (err?.code) {
    case "P2025":
      return { status: 404, message: "Ressource introuvable." };
    case "P2002":
      return { status: 409, message: "Conflit : cette ressource existe d\xE9j\xE0." };
    case "P2003":
      return { status: 400, message: "R\xE9f\xE9rence invalide : donn\xE9e li\xE9e manquante." };
    case "P2000":
      return { status: 400, message: "Valeur trop longue pour un champ." };
    default:
      if (typeof err?.status === "number" && err.status >= 400 && err.status < 500 && typeof err?.publicMessage === "string") {
        return { status: err.status, message: err.publicMessage };
      }
      return { status: 500, message: "Erreur interne du serveur." };
  }
}
app.use("/api", (err, req, res, next) => {
  console.error("[AxeCompta API]", err?.code ?? "", err?.message ?? err);
  if (res.headersSent) return next(err);
  const { status, message } = publicErrorMessage(err);
  res.status(status).json({ error: message });
});
var seeded = null;
function ensureSeeded() {
  if (!seeded) {
    seeded = (async () => {
      const { prisma: prisma2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { ensureSyscohadaAccounts: ensureSyscohadaAccounts2 } = await Promise.resolve().then(() => (init_seedData(), seedData_exports));
      try {
        await ensureSyscohadaAccounts2(prisma2);
      } catch (e) {
        console.error("[AxeCompta] Mise \xE0 jour du plan comptable impossible :", e?.message);
      }
    })();
  }
  return seeded;
}

// server/vercelHandler.ts
async function handler3(req, res) {
  try {
    await ensureSeeded();
    app(req, res);
  } catch (e) {
    console.error("[AxeCompta] Erreur non intercept\xE9e dans la fonction serverless :", e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Erreur interne du serveur." }));
    }
  }
}
export {
  handler3 as default
};

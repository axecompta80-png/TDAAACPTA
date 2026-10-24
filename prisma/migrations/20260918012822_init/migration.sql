-- CreateEnum
CREATE TYPE "RegimeFiscal" AS ENUM ('Réel Simplifié', 'Réel Normal', 'Synthétique / Forfait');

-- CreateEnum
CREATE TYPE "AccountCategory" AS ENUM ('bilan_actif', 'bilan_passif', 'charge', 'produit', 'tresorerie');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('validated', 'pending_review', 'anomaly');

-- CreateEnum
CREATE TYPE "InputMode" AS ENUM ('text', 'voice', 'photo', 'mobile_money', 'manual', 'excel_import');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'orange_money', 'mtn_momo', 'wave', 'moov_money', 'bank_transfer', 'cheque');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('created_by_ai', 'validated_by_expert', 'auto_validated', 'edited_by_expert', 'anomaly_flagged');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('info', 'success', 'warning', 'error');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('compta', 'fiscal', 'tresorerie', 'ia', 'system');

-- CreateEnum
CREATE TYPE "AiModelPreference" AS ENUM ('gemini-2.5-flash', 'gemini-2.5-flash-lite', 'heuristic-fast');

-- CreateEnum
CREATE TYPE "StartupView" AS ENUM ('simplified', 'expert');

-- CreateEnum
CREATE TYPE "NumberFormatting" AS ENUM ('standard', 'compact');

-- CreateEnum
CREATE TYPE "SoundType" AS ENUM ('fintech_chime', 'crystal_bell', 'soft_chord', 'alert_warning');

-- CreateTable
CREATE TABLE "client_dossiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "rccm" TEXT NOT NULL,
    "ifu" TEXT NOT NULL,
    "regimeFiscal" "RegimeFiscal" NOT NULL,
    "confidenceThreshold" INTEGER NOT NULL DEFAULT 85,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syscohada_accounts" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "classNumber" INTEGER NOT NULL,
    "category" "AccountCategory" NOT NULL,

    CONSTRAINT "syscohada_accounts_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "pieceRef" TEXT NOT NULL,
    "debitAccountCode" TEXT NOT NULL,
    "creditAccountCode" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "tvaAmount" DECIMAL(14,2) NOT NULL,
    "clientDossierId" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending_review',
    "confidenceScore" INTEGER NOT NULL,
    "detectedAnomaly" TEXT,
    "rawInput" TEXT NOT NULL,
    "inputType" "InputMode" NOT NULL,
    "explanationSimplified" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "AuditAction" NOT NULL,
    "author" TEXT NOT NULL,
    "notes" TEXT,
    "previousValue" TEXT,
    "confidenceScore" INTEGER,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "NotificationType" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dossierId" TEXT,
    "actionLabel" TEXT,
    "actionMode" "StartupView",
    "actionExpertTab" TEXT,

    CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "syscohadaVersion" TEXT NOT NULL,
    "cashDeductibilityThreshold" DECIMAL(14,2) NOT NULL,
    "defaultVatRate" DECIMAL(5,2) NOT NULL,
    "autoFlagLargeCashPayments" BOOLEAN NOT NULL,
    "defaultDebitCashAccount" TEXT NOT NULL,
    "defaultCreditSalesAccount" TEXT NOT NULL,
    "defaultDebitExpenseAccount" TEXT NOT NULL,
    "globalConfidenceThreshold" INTEGER NOT NULL,
    "autoValidateHighConfidence" BOOLEAN NOT NULL,
    "duplicateDetection" BOOLEAN NOT NULL,
    "aiModelPreference" "AiModelPreference" NOT NULL,
    "defaultStartupView" "StartupView" NOT NULL,
    "numberFormatting" "NumberFormatting" NOT NULL,
    "cabinetName" TEXT NOT NULL,
    "expertLicenseNumber" TEXT NOT NULL,
    "soundEnabled" BOOLEAN NOT NULL,
    "soundType" "SoundType" NOT NULL,
    "soundVolume" DOUBLE PRECISION NOT NULL,
    "notifyOnAnomaly" BOOLEAN NOT NULL,
    "notifyOnTaxDeadline" BOOLEAN NOT NULL,
    "notifyOnMobileMoneySync" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_entries_clientDossierId_idx" ON "journal_entries"("clientDossierId");

-- CreateIndex
CREATE INDEX "audit_logs_journalEntryId_idx" ON "audit_logs"("journalEntryId");

-- CreateIndex
CREATE INDEX "app_notifications_dossierId_idx" ON "app_notifications"("dossierId");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_debitAccountCode_fkey" FOREIGN KEY ("debitAccountCode") REFERENCES "syscohada_accounts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_creditAccountCode_fkey" FOREIGN KEY ("creditAccountCode") REFERENCES "syscohada_accounts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_clientDossierId_fkey" FOREIGN KEY ("clientDossierId") REFERENCES "client_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "client_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

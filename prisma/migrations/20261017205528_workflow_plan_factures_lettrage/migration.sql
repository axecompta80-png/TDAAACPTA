-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'pending_review', 'validated', 'cancelled');

-- CreateEnum
CREATE TYPE "InvoiceMode" AS ENUM ('cash', 'credit');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'submitted_for_review';
ALTER TYPE "AuditAction" ADD VALUE 'unvalidated';
ALTER TYPE "AuditAction" ADD VALUE 'cancelled';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionStatus" ADD VALUE 'draft';
ALTER TYPE "TransactionStatus" ADD VALUE 'cancelled';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'CHEF_COMPTABLE';
ALTER TYPE "UserRole" ADD VALUE 'DAF';

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "invoiceId" TEXT,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedById" TEXT;

-- AlterTable
ALTER TABLE "syscohada_accounts" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dossierId" TEXT,
ADD COLUMN     "parentCode" TEXT;

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "clientDossierId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "mode" "InvoiceMode" NOT NULL,
    "paymentMethod" "PaymentMethod",
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "customerTaxId" TEXT,
    "customerAccountCode" TEXT NOT NULL DEFAULT '4111',
    "salesAccountCode" TEXT NOT NULL DEFAULT '7011',
    "vatRate" DECIMAL(5,2) NOT NULL,
    "totalHT" DECIMAL(14,2) NOT NULL,
    "totalTVA" DECIMAL(14,2) NOT NULL,
    "totalTTC" DECIMAL(14,2) NOT NULL,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "createdById" TEXT,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "amountHT" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_clientDossierId_number_key" ON "invoices"("clientDossierId", "number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoiceId_idx" ON "invoice_lines"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_payments_entryId_idx" ON "invoice_payments"("entryId");

-- CreateIndex
CREATE INDEX "syscohada_accounts_dossierId_idx" ON "syscohada_accounts"("dossierId");

-- AddForeignKey
ALTER TABLE "syscohada_accounts" ADD CONSTRAINT "syscohada_accounts_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "client_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientDossierId_fkey" FOREIGN KEY ("clientDossierId") REFERENCES "client_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

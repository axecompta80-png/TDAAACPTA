-- Pièces jointes, rapprochement bancaire (pointage des lignes), registre des immobilisations.
-- AlterTable
ALTER TABLE "journal_lines" ADD COLUMN     "reconciledOn" DATE;
-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" TEXT NOT NULL,
    "clientDossierId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "acquisitionDate" DATE NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "depreciatedThrough" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "attachments_entryId_idx" ON "attachments"("entryId");
-- CreateIndex
CREATE INDEX "fixed_assets_clientDossierId_idx" ON "fixed_assets"("clientDossierId");
-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_clientDossierId_fkey" FOREIGN KEY ("clientDossierId") REFERENCES "client_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Écritures répétées chaque mois.
CREATE TABLE "recurring_entries" (
    "id" TEXT NOT NULL,
    "clientDossierId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "journal" "JournalCode" NOT NULL,
    "lines" JSONB NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "day" INTEGER NOT NULL,
    "nextDate" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recurring_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "recurring_entries_clientDossierId_idx" ON "recurring_entries"("clientDossierId");
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_clientDossierId_fkey" FOREIGN KEY ("clientDossierId") REFERENCES "client_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

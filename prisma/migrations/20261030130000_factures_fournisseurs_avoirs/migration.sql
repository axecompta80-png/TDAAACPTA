-- Factures fournisseurs et avoirs clients (même table que les factures clients).
CREATE TYPE "InvoiceKind" AS ENUM ('sale', 'credit_note', 'purchase');
ALTER TABLE "invoices" ADD COLUMN "kind" "InvoiceKind" NOT NULL DEFAULT 'sale',
ADD COLUMN "externalRef" TEXT,
ADD COLUMN "originalInvoiceId" TEXT;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

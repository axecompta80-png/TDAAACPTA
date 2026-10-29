-- Plus de score de confiance IA : ni calculé, ni affiché, ni stocké.
-- AlterTable
ALTER TABLE "journal_entries" DROP COLUMN "confidenceScore";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "confidenceScore";

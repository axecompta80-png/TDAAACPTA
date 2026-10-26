-- Plus de seuil de confiance IA : toute écriture sans anomalie est validée à l'enregistrement.
-- AlterTable
ALTER TABLE "client_dossiers" DROP COLUMN "confidenceThreshold";

-- AlterTable
ALTER TABLE "platform_settings" DROP COLUMN "autoValidateHighConfidence",
DROP COLUMN "globalConfidenceThreshold";


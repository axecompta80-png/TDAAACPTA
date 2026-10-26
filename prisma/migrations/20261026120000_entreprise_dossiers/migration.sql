-- Refonte Entreprise + Dossiers : on repart de zéro côté comptabilité.
-- Les comptes de connexion sont conservés (ils refont le formulaire « Informations de l'entreprise »),
-- sauf les comptables ajoutés via l'ancienne « Équipe », qui n'ont plus de place dans ce modèle.
TRUNCATE "client_dossiers", "platform_settings" CASCADE;
DELETE FROM "users" WHERE "createdById" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "client_dossiers" DROP CONSTRAINT "client_dossiers_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "dossier_assignments" DROP CONSTRAINT "dossier_assignments_dossierId_fkey";

-- DropForeignKey
ALTER TABLE "dossier_assignments" DROP CONSTRAINT "dossier_assignments_userId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_createdById_fkey";

-- DropIndex
DROP INDEX "client_dossiers_ownerId_idx";

-- AlterTable
ALTER TABLE "client_dossiers" DROP COLUMN "ownerId",
ADD COLUMN     "isMain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "dossierId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "createdById",
ADD COLUMN     "dossierId" TEXT;

-- DropTable
DROP TABLE "dossier_assignments";

-- CreateIndex
CREATE INDEX "client_dossiers_organizationId_idx" ON "client_dossiers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_dossierId_key" ON "platform_settings"("dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "users_dossierId_key" ON "users"("dossierId");

-- AddForeignKey
ALTER TABLE "client_dossiers" ADD CONSTRAINT "client_dossiers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "client_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "client_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Une seule comptabilité principale par entreprise.
CREATE UNIQUE INDEX "client_dossiers_one_main_per_org" ON "client_dossiers"("organizationId") WHERE "isMain";

-- Deux rôles seulement : ADMIN et COMPTABLE (CHEF_COMPTABLE, DAF, LECTURE_SEULE → COMPTABLE).
CREATE TYPE "UserRole_new" AS ENUM ('ADMIN', 'COMPTABLE');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new"
  USING (CASE WHEN "role"::text = 'ADMIN' THEN 'ADMIN' ELSE 'COMPTABLE' END)::"UserRole_new";
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'COMPTABLE';

-- Entreprises : chaque utilisateur existant reçoit la sienne.
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "users" ADD COLUMN "createdById" TEXT, ADD COLUMN "organizationId" TEXT;
INSERT INTO "organizations" ("id", "name") SELECT 'org-' || "id", "name" FROM "users";
UPDATE "users" SET "organizationId" = 'org-' || "id";
ALTER TABLE "users" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Attribution d'un dossier par son créateur à un autre comptable de la même entreprise.
CREATE TABLE "dossier_assignments" (
    "dossierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dossier_assignments_pkey" PRIMARY KEY ("dossierId","userId")
);
CREATE INDEX "dossier_assignments_userId_idx" ON "dossier_assignments"("userId");
ALTER TABLE "dossier_assignments" ADD CONSTRAINT "dossier_assignments_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "client_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dossier_assignments" ADD CONSTRAINT "dossier_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

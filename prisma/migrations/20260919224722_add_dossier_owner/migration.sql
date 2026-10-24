/*
  Warnings:

  - Added the required column `ownerId` to the `client_dossiers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "client_dossiers" ADD COLUMN     "ownerId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "client_dossiers_ownerId_idx" ON "client_dossiers"("ownerId");

-- AddForeignKey
ALTER TABLE "client_dossiers" ADD CONSTRAINT "client_dossiers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

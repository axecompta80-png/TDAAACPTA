-- Écritures à plusieurs lignes, journaux, numérotation, contre-passation et périodes bloquées.
-- Les écritures existantes (un compte au débit, un au crédit, TVA à part) sont converties en lignes,
-- la TVA passant sur son propre compte (4431 sur les ventes, 4452 sur les achats).

-- Enums
CREATE TYPE "JournalCode" AS ENUM ('VT', 'AC', 'BQ', 'CA', 'OD', 'AN');
ALTER TYPE "AuditAction" ADD VALUE 'reversed';

-- Comptes utilisés par la conversion et la clôture (le plan complet est resynchronisé au démarrage).
INSERT INTO "syscohada_accounts" ("code", "label", "classNumber", "category", "active") VALUES
  ('4431', 'État, TVA facturée sur ventes (18%)', 4, 'bilan_passif', true),
  ('4452', 'État, TVA déductible sur achats et services (18%)', 4, 'bilan_actif', true)
ON CONFLICT ("code") DO NOTHING;

-- Lignes
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "accountCode" TEXT NOT NULL,
    "label" TEXT,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "journal_lines_entryId_idx" ON "journal_lines"("entryId");
CREATE INDEX "journal_lines_accountCode_idx" ON "journal_lines"("accountCode");
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountCode_fkey" FOREIGN KEY ("accountCode") REFERENCES "syscohada_accounts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Conversion : vente avec TVA (crédit 7x) → D débit TTC / C 7x HT / C 4431 TVA
INSERT INTO "journal_lines" ("id", "entryId", "position", "accountCode", "debit", "credit")
SELECT gen_random_uuid()::text, e."id", v.pos, v.code, v.d, v.c
FROM "journal_entries" e
CROSS JOIN LATERAL (VALUES
  (0, e."debitAccountCode", e."amount", 0::numeric),
  (1, e."creditAccountCode", 0::numeric, e."amount" - e."tvaAmount"),
  (2, '4431', 0::numeric, e."tvaAmount")
) AS v(pos, code, d, c)
WHERE e."tvaAmount" > 0 AND e."tvaAmount" < e."amount" AND e."creditAccountCode" LIKE '7%';

-- Achat avec TVA (débit 6x, 2x, 3x) → D débit HT / D 4452 TVA / C crédit TTC
INSERT INTO "journal_lines" ("id", "entryId", "position", "accountCode", "debit", "credit")
SELECT gen_random_uuid()::text, e."id", v.pos, v.code, v.d, v.c
FROM "journal_entries" e
CROSS JOIN LATERAL (VALUES
  (0, e."debitAccountCode", e."amount" - e."tvaAmount", 0::numeric),
  (1, '4452', e."tvaAmount", 0::numeric),
  (2, e."creditAccountCode", 0::numeric, e."amount")
) AS v(pos, code, d, c)
WHERE e."tvaAmount" > 0 AND e."tvaAmount" < e."amount" AND e."creditAccountCode" NOT LIKE '7%'
  AND e."debitAccountCode" ~ '^[236]';

-- Toutes les autres : deux lignes (TVA sans objet ignorée, comme le faisaient déjà les états).
INSERT INTO "journal_lines" ("id", "entryId", "position", "accountCode", "debit", "credit")
SELECT gen_random_uuid()::text, e."id", v.pos, v.code, v.d, v.c
FROM "journal_entries" e
CROSS JOIN LATERAL (VALUES
  (0, e."debitAccountCode", e."amount", 0::numeric),
  (1, e."creditAccountCode", 0::numeric, e."amount")
) AS v(pos, code, d, c)
WHERE NOT EXISTS (SELECT 1 FROM "journal_lines" l WHERE l."entryId" = e."id");

-- Journal, numéro, contre-passation
ALTER TABLE "journal_entries" ADD COLUMN "journal" "JournalCode" NOT NULL DEFAULT 'OD';
ALTER TABLE "journal_entries" ADD COLUMN "number" INTEGER;
ALTER TABLE "journal_entries" ADD COLUMN "reversalOfId" TEXT;

-- Même règle que defaultJournal (src/utils/entryLines.ts) : trésorerie, puis ventes, achats, sinon OD.
UPDATE "journal_entries" e SET "journal" = CASE
  WHEN EXISTS (SELECT 1 FROM "journal_lines" l WHERE l."entryId" = e."id" AND l."accountCode" LIKE '57%') THEN 'CA'::"JournalCode"
  WHEN EXISTS (SELECT 1 FROM "journal_lines" l WHERE l."entryId" = e."id" AND l."accountCode" ~ '^5[0-6]') THEN 'BQ'::"JournalCode"
  WHEN EXISTS (SELECT 1 FROM "journal_lines" l WHERE l."entryId" = e."id" AND l."accountCode" LIKE '7%') THEN 'VT'::"JournalCode"
  WHEN EXISTS (SELECT 1 FROM "journal_lines" l WHERE l."entryId" = e."id" AND l."accountCode" ~ '^(6|2|40)') THEN 'AC'::"JournalCode"
  ELSE 'OD'::"JournalCode"
END;

UPDATE "journal_entries" e SET "number" = n.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "clientDossierId", "journal" ORDER BY "date", "createdAt", "id") AS rn
  FROM "journal_entries"
) n
WHERE n."id" = e."id";
ALTER TABLE "journal_entries" ALTER COLUMN "number" SET NOT NULL;

CREATE UNIQUE INDEX "journal_entries_clientDossierId_journal_number_key" ON "journal_entries"("clientDossierId", "journal", "number");
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Anciennes colonnes, désormais portées par les lignes.
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_debitAccountCode_fkey";
ALTER TABLE "journal_entries" DROP CONSTRAINT "journal_entries_creditAccountCode_fkey";
ALTER TABLE "journal_entries" DROP COLUMN "debitAccountCode",
DROP COLUMN "creditAccountCode",
DROP COLUMN "tvaAmount";

-- Périodes bloquées
ALTER TABLE "client_dossiers" ADD COLUMN "lockedUntil" DATE;

-- Plan comptable : numéros SYSCOHADA corrigés. L'application utilisait 6411 pour les salaires
-- (661 en SYSCOHADA révisé ; 641 = impôts et taxes), 6451 pour les charges sociales (664)
-- et 8511 pour les dons reçus (85 = dotations HAO, une charge ; produits HAO = 84).
INSERT INTO "syscohada_accounts" ("code", "label", "classNumber", "category", "active") VALUES
  ('6611', 'Appointements, salaires et commissions', 6, 'charge', true),
  ('6641', 'Charges sociales sur rémunérations (part patronale)', 6, 'charge', true),
  ('8411', 'Produits HAO (dons et subventions exceptionnels reçus)', 8, 'produit', true)
ON CONFLICT ("code") DO NOTHING;
UPDATE "journal_lines" SET "accountCode" = '6611' WHERE "accountCode" = '6411';
UPDATE "journal_lines" SET "accountCode" = '6641' WHERE "accountCode" = '6451';
UPDATE "journal_lines" SET "accountCode" = '8411' WHERE "accountCode" = '8511';
UPDATE "syscohada_accounts" SET "label" = 'Impôts et taxes directs (patente, taxes foncières)' WHERE "code" = '6411' AND "dossierId" IS NULL;
DELETE FROM "syscohada_accounts" WHERE "code" IN ('6451', '8511') AND "dossierId" IS NULL;

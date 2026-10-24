import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Connexion directe (non poolée) requise pour les migrations DDL sur Neon.
    url: env("DATABASE_URL_UNPOOLED"),
  },
});

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ensureSyscohadaAccounts } from '../server/seedData';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Initialisation technique de la base : plan comptable SYSCOHADA (les réglages sont créés avec chaque dossier).
 * Aucune donnée comptable de démonstration n'est injectée (comptes utilisateurs vierges).
 */
async function main() {
  await ensureSyscohadaAccounts(prisma);
  console.log('✓ Plan comptable SYSCOHADA');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

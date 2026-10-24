import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  ensureSyscohadaAccounts,
  createDefaultPlatformSettings,
} from '../server/seedData';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Initialisation technique de la base : plan comptable SYSCOHADA + réglages par défaut.
 * Aucune donnée comptable de démonstration n'est injectée (comptes utilisateurs vierges).
 */
async function main() {
  await ensureSyscohadaAccounts(prisma);
  console.log('✓ Plan comptable SYSCOHADA');

  if ((await prisma.platformSettings.count()) === 0) {
    await createDefaultPlatformSettings(prisma);
    console.log('✓ Paramètres de la plateforme (valeurs par défaut)');
  } else {
    console.log('· Paramètres déjà présents, inchangés');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

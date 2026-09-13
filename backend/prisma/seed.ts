import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/database/seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await seedDatabase(prisma);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

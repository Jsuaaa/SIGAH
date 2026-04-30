import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.test if it exists, otherwise fall back to .env
dotenv.config({ path: path.join(__dirname, '../.env.test') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/**
 * Registers afterEach cleanup for the calling test suite.
 * Import this file at the top of each integration test that needs DB cleanup.
 *
 * Cleans:
 *  - All zones (order matters: zones have no deps yet, but will when #11/#12/#15 land)
 *  - All non-seed users (keeps admin@sigah.gov.co for token helpers)
 */
afterEach(async () => {
  await prisma.zone.deleteMany();
  await prisma.user.deleteMany({
    where: { email: { not: 'admin@sigah.gov.co' } },
  });
});

export { prisma };

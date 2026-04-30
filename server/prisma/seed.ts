import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@sigah.gov.co';
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const password_hash = await bcrypt.hash(password, 10);
    const admin = await prisma.user.create({
      data: {
        email,
        password_hash,
        role: 'ADMIN',
      },
    });
    console.log(`Admin user created: ${admin.email}`);
  } else {
    console.log(`Admin user already exists: ${email}`);
  }

  // Seed zones — real neighborhoods from Montería's left bank of the Sinú river
  // affected by the 2026 flood (see PLAN.md). Idempotent via upsert.
  const monteriaZones = [
    { name: 'Cantaclaro',              risk_level: 'CRITICAL' as const, latitude: 8.7320, longitude: -75.8967, estimated_population: 18000 },
    { name: 'Robinson Pitalúa',        risk_level: 'HIGH'     as const, latitude: 8.7415, longitude: -75.9012, estimated_population: 12500 },
    { name: 'El Poblado',              risk_level: 'HIGH'     as const, latitude: 8.7589, longitude: -75.9134, estimated_population: 9800  },
    { name: 'Mogambo',                 risk_level: 'MEDIUM'   as const, latitude: 8.7203, longitude: -75.8845, estimated_population: 6200  },
    { name: 'Margen Izquierda Centro', risk_level: 'CRITICAL' as const, latitude: 8.7497, longitude: -75.9050, estimated_population: 22000 },
  ];

  for (const z of monteriaZones) {
    await prisma.zone.upsert({ where: { name: z.name }, update: {}, create: z });
  }
  console.log(`Seeded ${monteriaZones.length} zones.`);
}

main()
  .catch((e: Error) => {
    console.error('Seed failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

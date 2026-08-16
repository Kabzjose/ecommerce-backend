import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const zoneNames = ['CBD', 'Westlands', 'Karen', 'Kilimani', 'Industrial Area', 'Eastlands'];

  const zones = await Promise.all(
    zoneNames.map((name) =>
      prisma.zone.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  const zoneByName = Object.fromEntries(zones.map((z) => [z.name, z]));

  const routes: [string, string, number][] = [
    ['CBD', 'Westlands', 300],
    ['CBD', 'Karen', 500],
    ['CBD', 'Kilimani', 350],
    ['CBD', 'Industrial Area', 400],
    ['CBD', 'Eastlands', 300],
    ['Westlands', 'Karen', 450],
    ['Westlands', 'Kilimani', 300],
  ];

  for (const [from, to, price] of routes) {
    await prisma.zoneRoute.upsert({
      where: {
        fromZoneId_toZoneId: { fromZoneId: zoneByName[from].id, toZoneId: zoneByName[to].id },
      },
      update: { price },
      create: { fromZoneId: zoneByName[from].id, toZoneId: zoneByName[to].id, price },
    });
    // Mirror the reverse direction with the same price
    await prisma.zoneRoute.upsert({
      where: {
        fromZoneId_toZoneId: { fromZoneId: zoneByName[to].id, toZoneId: zoneByName[from].id },
      },
      update: { price },
      create: { fromZoneId: zoneByName[to].id, toZoneId: zoneByName[from].id, price },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const adminPhone = process.env.SEED_ADMIN_PHONE;

  if (adminEmail && adminPassword && adminPhone) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'System Admin',
      email: adminEmail,
      phone: adminPhone,
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('✅ Seeded admin account');
}

  const sampleProducts = [
    {
      name: 'Wireless Earbuds',
      description: 'Bluetooth 5.0 earbuds with charging case and 24hr battery life',
      price: 2500,
      stockQuantity: 50,
      category: 'Electronics',
    },
    {
      name: 'Phone Case - Universal',
      description: 'Shockproof silicone phone case, fits most smartphones',
      price: 500,
      stockQuantity: 200,
      category: 'Accessories',
    },
    {
      name: 'Notebook A5',
      description: 'Hardcover ruled notebook, 200 pages, premium quality',
      price: 350,
      stockQuantity: 150,
      category: 'Stationery',
    },
  ];

  for (const p of sampleProducts) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({ data: p });
    }
  }

  // prisma/seed.ts — add this after your existing zone/route seeding

const STORE_ZONE_NAME = 'CBD'; // whichever zone your store's pickup actually is

const storeZone = await prisma.zone.findUnique({ where: { name: STORE_ZONE_NAME } });
const allZones = await prisma.zone.findMany();

if (storeZone) {
  for (const zone of allZones) {
    if (zone.id === storeZone.id) continue;

    const existingRoute = await prisma.zoneRoute.findUnique({
      where: { fromZoneId_toZoneId: { fromZoneId: storeZone.id, toZoneId: zone.id } },
    });

    if (!existingRoute) {
      // Simple flat default — adjust pricing logic as you see fit
      const defaultPrice = 250;
      await prisma.zoneRoute.create({
        data: { fromZoneId: storeZone.id, toZoneId: zone.id, price: defaultPrice },
      });
      await prisma.zoneRoute.create({
        data: { fromZoneId: zone.id, toZoneId: storeZone.id, price: defaultPrice },
      });
    }
  }
  console.log(`✅ Ensured routes exist from ${STORE_ZONE_NAME} to every zone`);
}
  console.log('✅ Seeded sample products');

  console.log('✅ Seeded zones and routes');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
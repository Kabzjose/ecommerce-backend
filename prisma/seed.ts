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

  const products = [
    // --- Phones ---
    {
      name: 'Galaxy Nova A55',
      description: '6.6" AMOLED display, 128GB storage, 5000mAh battery, triple rear camera. A reliable everyday smartphone with all-day battery life.',
      price: 32999,
      stockQuantity: 40,
      category: 'Phones',
      imageUrl: 'https://picsum.photos/seed/phone-galaxy-nova/600/600',
    },
    {
      name: 'Pixel Lite 9',
      description: '6.1" OLED display, 128GB storage, clean Android experience with 3 years of software updates.',
      price: 45999,
      stockQuantity: 25,
      category: 'Phones',
      imageUrl: 'https://picsum.photos/seed/phone-pixel-lite/600/600',
    },
    {
      name: 'Infinix Note 40',
      description: '6.7" display, 256GB storage, 108MP camera, fast 45W charging. Great value flagship-level specs.',
      price: 24999,
      stockQuantity: 60,
      category: 'Phones',
      imageUrl: 'https://picsum.photos/seed/phone-infinix-note/600/600',
    },
    {
      name: 'Tecno Spark 20',
      description: '6.6" display, 128GB storage, 5000mAh battery. An affordable, dependable daily driver.',
      price: 15999,
      stockQuantity: 80,
      category: 'Phones',
      imageUrl: 'https://picsum.photos/seed/phone-tecno-spark/600/600',
    },
    {
      name: 'iPhone SE Classic',
      description: '4.7" Retina display, 64GB storage, A15 chip. Compact size with strong performance.',
      price: 54999,
      stockQuantity: 15,
      category: 'Phones',
      imageUrl: 'https://picsum.photos/seed/phone-iphone-se/600/600',
    },

    // --- Tablets ---
    {
      name: 'Galaxy Tab Air 11',
      description: '11" LCD display, 128GB storage, S-Pen included. Great for note-taking and media.',
      price: 38999,
      stockQuantity: 20,
      category: 'Tablets',
      imageUrl: 'https://picsum.photos/seed/tablet-galaxy-tab/600/600',
    },
    {
      name: 'iPad 10th Gen',
      description: '10.9" Liquid Retina display, 64GB storage, A14 Bionic chip. The everyday iPad for work and play.',
      price: 52999,
      stockQuantity: 18,
      category: 'Tablets',
      imageUrl: 'https://picsum.photos/seed/tablet-ipad-10th/600/600',
    },
    {
      name: 'Lenovo Tab M11',
      description: '11" display, 128GB storage, quad speakers. Budget-friendly tablet for streaming and browsing.',
      price: 19999,
      stockQuantity: 35,
      category: 'Tablets',
      imageUrl: 'https://picsum.photos/seed/tablet-lenovo-m11/600/600',
    },
    {
      name: 'Xiaomi Pad 6',
      description: '11" 144Hz display, 256GB storage, Snapdragon 870. Smooth performance for gaming and productivity.',
      price: 34999,
      stockQuantity: 22,
      category: 'Tablets',
      imageUrl: 'https://picsum.photos/seed/tablet-xiaomi-pad/600/600',
    },

    // --- Laptops ---
    {
      name: 'HP Pavilion 15',
      description: 'Intel Core i5, 8GB RAM, 512GB SSD, 15.6" FHD display. Reliable everyday laptop for work and study.',
      price: 68999,
      stockQuantity: 15,
      category: 'Laptops',
      imageUrl: 'https://picsum.photos/seed/laptop-hp-pavilion/600/600',
    },
    {
      name: 'Lenovo IdeaPad Slim 3',
      description: 'AMD Ryzen 5, 8GB RAM, 256GB SSD, 14" display. Lightweight and portable for on-the-go productivity.',
      price: 54999,
      stockQuantity: 20,
      category: 'Laptops',
      imageUrl: 'https://picsum.photos/seed/laptop-lenovo-ideapad/600/600',
    },
    {
      name: 'MacBook Air M2',
      description: 'Apple M2 chip, 8GB RAM, 256GB SSD, 13.6" Liquid Retina display. Fast, silent, and long battery life.',
      price: 149999,
      stockQuantity: 8,
      category: 'Laptops',
      imageUrl: 'https://picsum.photos/seed/laptop-macbook-air/600/600',
    },
    {
      name: 'Dell Inspiron 15',
      description: 'Intel Core i7, 16GB RAM, 512GB SSD, 15.6" FHD display. Solid performance for multitasking.',
      price: 89999,
      stockQuantity: 12,
      category: 'Laptops',
      imageUrl: 'https://picsum.photos/seed/laptop-dell-inspiron/600/600',
    },
    {
      name: 'ASUS Vivobook 14',
      description: 'AMD Ryzen 3, 8GB RAM, 256GB SSD, 14" display. Compact and affordable for students.',
      price: 47999,
      stockQuantity: 25,
      category: 'Laptops',
      imageUrl: 'https://picsum.photos/seed/laptop-asus-vivobook/600/600',
    },

    // --- TVs ---
    {
      name: 'Hisense 43" Smart TV',
      description: '43" Full HD LED, built-in Android TV, dual-band WiFi. Great entry-level smart TV.',
      price: 27999,
      stockQuantity: 18,
      category: 'TVs',
      imageUrl: 'https://picsum.photos/seed/tv-hisense-43/600/600',
    },
    {
      name: 'Samsung 55" Crystal UHD',
      description: '55" 4K UHD display, Crystal Processor, Tizen smart platform. Vivid color and sharp detail.',
      price: 64999,
      stockQuantity: 10,
      category: 'TVs',
      imageUrl: 'https://picsum.photos/seed/tv-samsung-55/600/600',
    },
    {
      name: 'LG 50" 4K UHD Smart TV',
      description: '50" 4K UHD, webOS smart platform, AI picture processing. Sharp visuals for movies and sports.',
      price: 54999,
      stockQuantity: 12,
      category: 'TVs',
      imageUrl: 'https://picsum.photos/seed/tv-lg-50/600/600',
    },
    {
      name: 'TCL 32" HD Smart TV',
      description: '32" HD LED, built-in streaming apps. Compact size, ideal for bedrooms.',
      price: 15999,
      stockQuantity: 30,
      category: 'TVs',
      imageUrl: 'https://picsum.photos/seed/tv-tcl-32/600/600',
    },

    // --- Woofers / Speakers ---
    {
      name: 'Sony XB33 Bluetooth Speaker',
      description: 'Extra bass portable speaker, 24hr battery, IP67 waterproof. Great for parties and outdoor use.',
      price: 12999,
      stockQuantity: 40,
      category: 'Woofers',
      imageUrl: 'https://picsum.photos/seed/woofer-sony-xb33/600/600',
    },
    {
      name: 'JBL PartyBox 110',
      description: 'Powerful bass, built-in light show, 12hr playtime. Ideal for home parties and gatherings.',
      price: 34999,
      stockQuantity: 15,
      category: 'Woofers',
      imageUrl: 'https://picsum.photos/seed/woofer-jbl-partybox/600/600',
    },
    {
      name: 'Sayona Home Theatre System',
      description: '2.1 channel system with dedicated subwoofer, Bluetooth and USB playback. Deep bass for movie nights.',
      price: 8999,
      stockQuantity: 35,
      category: 'Woofers',
      imageUrl: 'https://picsum.photos/seed/woofer-sayona-theatre/600/600',
    },
    {
      name: 'Vitron 10" Subwoofer System',
      description: '10-inch subwoofer, 3-way system, remote control. Strong bass output for home audio setups.',
      price: 11999,
      stockQuantity: 28,
      category: 'Woofers',
      imageUrl: 'https://picsum.photos/seed/woofer-vitron-10inch/600/600',
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: p });
    } else {
      await prisma.product.create({ data: p });
    }
  }
  console.log(`✅ Seeded ${products.length} products across Phones, Tablets, Laptops, TVs, and Woofers`);

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
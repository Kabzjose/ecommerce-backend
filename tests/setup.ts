import { beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/config/db.js';

beforeEach(async () => {
  // Wipe tables in FK-safe order before every test — child tables first
  await prisma.notificationLog.deleteMany();
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.zoneRoute.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

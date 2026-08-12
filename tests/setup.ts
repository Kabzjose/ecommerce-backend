import { beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../src/config/db.js';

// Mock the SMS lib globally — prevents real AT API calls during tests.
// All sendSms() calls return {success:true} instantly without network I/O.
vi.mock('../src/lib/sms.js', () => ({
  sendSms: vi.fn().mockResolvedValue({ success: true }),
}));

beforeEach(async () => {
  // TRUNCATE ... CASCADE atomically empties all tables regardless of FK order.
  // The chained deleteMany() approach fails whenever FK constraints are RESTRICT.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      notifications_log,
      booking_status_history,
      payments,
      bookings,
      zone_routes,
      zones,
      refresh_tokens,
      users
    RESTART IDENTITY CASCADE
  `);
}, 30000); // Neon has ~200-600ms round-trip; 30s gives plenty of headroom

afterAll(async () => {
  await prisma.$disconnect();
});
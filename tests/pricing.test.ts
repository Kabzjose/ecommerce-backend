import { describe, it, expect } from 'vitest';
import { request, createUserDirect, createZonesAndRoute, prisma } from './helpers.js';

describe('GET /api/pricing/zones', () => {
  it('returns list of zones — public endpoint, no auth required', async () => {
    const res = await request.get('/api/pricing/zones');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.zones)).toBe(true);
  });

  it('returns seeded zones', async () => {
    const { zoneA, zoneB } = await createZonesAndRoute();
    const res = await request.get('/api/pricing/zones');

    expect(res.status).toBe(200);
    const ids = res.body.zones.map((z: { id: string }) => z.id);
    expect(ids).toContain(zoneA.id);
    expect(ids).toContain(zoneB.id);
  });
});

describe('POST /api/pricing/quote', () => {
  it('happy path — returns calculated price for a valid route', async () => {
    const { zoneA, zoneB } = await createZonesAndRoute(350);

    const res = await request.post('/api/pricing/quote').send({
      pickupZoneId: zoneA.id,
      dropoffZoneId: zoneB.id,
      packageType: 'PARCEL',
      weightKg: 5,
    });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(350);
    // Breakdown is returned but zone IDs are in the input, not the response
    expect(res.body.breakdown.basePrice).toBe(350);
    expect(res.body.breakdown.packageType).toBe('PARCEL');
  });

  it('applies fragile surcharge (FRAGILE = base * 1.15)', async () => {
    const { zoneA, zoneB } = await createZonesAndRoute(400);

    const res = await request.post('/api/pricing/quote').send({
      pickupZoneId: zoneA.id,
      dropoffZoneId: zoneB.id,
      packageType: 'FRAGILE',
      weightKg: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(Math.round(400 * 1.15)); // 460
  });

  it('applies heavy-weight surcharge (>10kg = +20 per extra kg)', async () => {
    const { zoneA, zoneB } = await createZonesAndRoute(200);

    const res = await request.post('/api/pricing/quote').send({
      pickupZoneId: zoneA.id,
      dropoffZoneId: zoneB.id,
      packageType: 'PARCEL',
      weightKg: 15, // 5 kg over threshold = +100
    });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(300); // 200 + (5 * 20)
  });

  it('unknown route (no ZoneRoute configured) returns 404', async () => {
    const zoneA = await prisma.zone.create({ data: { name: `Isolated-${Date.now()}` } });
    const zoneB = await prisma.zone.create({ data: { name: `Isolated2-${Date.now()}` } });
    // deliberately no ZoneRoute between them

    const res = await request.post('/api/pricing/quote').send({
      pickupZoneId: zoneA.id,
      dropoffZoneId: zoneB.id,
      packageType: 'PARCEL',
      weightKg: 1,
    });

    expect(res.status).toBe(404);
  });

  it('missing required field returns 422', async () => {
    const { zoneA } = await createZonesAndRoute();

    const res = await request.post('/api/pricing/quote').send({
      pickupZoneId: zoneA.id,
      // missing dropoffZoneId, packageType, weightKg
    });

    expect(res.status).toBe(422);
  });

  it('invalid packageType returns 422', async () => {
    const { zoneA, zoneB } = await createZonesAndRoute();

    const res = await request.post('/api/pricing/quote').send({
      pickupZoneId: zoneA.id,
      dropoffZoneId: zoneB.id,
      packageType: 'FURNITURE', // not in enum
      weightKg: 10,
    });

    expect(res.status).toBe(422);
  });

  it('weightKg exceeding 500 returns 422', async () => {
    const { zoneA, zoneB } = await createZonesAndRoute();

    const res = await request.post('/api/pricing/quote').send({
      pickupZoneId: zoneA.id,
      dropoffZoneId: zoneB.id,
      packageType: 'PARCEL',
      weightKg: 501,
    });

    expect(res.status).toBe(422);
  });
});

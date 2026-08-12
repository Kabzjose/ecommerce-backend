import { describe, it, expect } from 'vitest';
import {
  request,
  createUserDirect,
  signInAs,
  createZonesAndRoute,
  prisma,
} from './helpers.js';

describe('GET /api/pricing/zones', () => {
  it('returns list of zones (empty when none seeded)', async () => {
    const customer = await createUserDirect('CUSTOMER');
    const token = signInAs(customer.id, 'CUSTOMER');

    const res = await request
      .get('/api/pricing/zones')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.zones)).toBe(true);
  });

  it('returns seeded zones', async () => {
    const { zoneA, zoneB } = await createZonesAndRoute();
    const customer = await createUserDirect('CUSTOMER');
    const token = signInAs(customer.id, 'CUSTOMER');

    const res = await request
      .get('/api/pricing/zones')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.zones.map((z: { id: string }) => z.id);
    expect(ids).toContain(zoneA.id);
    expect(ids).toContain(zoneB.id);
  });

  it('unauthenticated request is rejected — 401', async () => {
    const res = await request.get('/api/pricing/zones');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/pricing/quote', () => {
  it('happy path — returns a price for a valid route', async () => {
    const { zoneA, zoneB } = await createZonesAndRoute(350);
    const customer = await createUserDirect('CUSTOMER');
    const token = signInAs(customer.id, 'CUSTOMER');

    const res = await request
      .post('/api/pricing/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pickupZoneId: zoneA.id,
        dropoffZoneId: zoneB.id,
        packageType: 'PARCEL',
        weightKg: 5,
      });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(350);
    expect(res.body.pickupZoneId).toBe(zoneA.id);
    expect(res.body.dropoffZoneId).toBe(zoneB.id);
  });

  it('unknown route (no ZoneRoute configured) returns 404', async () => {
    const zoneA = await prisma.zone.create({ data: { name: `Isolated-${Date.now()}` } });
    const zoneB = await prisma.zone.create({ data: { name: `Isolated2-${Date.now()}` } });
    // deliberately no ZoneRoute between them
    const customer = await createUserDirect('CUSTOMER');
    const token = signInAs(customer.id, 'CUSTOMER');

    const res = await request
      .post('/api/pricing/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pickupZoneId: zoneA.id,
        dropoffZoneId: zoneB.id,
        packageType: 'PARCEL',
        weightKg: 1,
      });

    expect(res.status).toBe(404);
  });

  it('missing required field returns 422', async () => {
    const { zoneA } = await createZonesAndRoute();
    const customer = await createUserDirect('CUSTOMER');
    const token = signInAs(customer.id, 'CUSTOMER');

    const res = await request
      .post('/api/pricing/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pickupZoneId: zoneA.id,
        // missing dropoffZoneId, packageType, weightKg
      });

    expect(res.status).toBe(422);
  });

  it('invalid packageType returns 422', async () => {
    const { zoneA, zoneB } = await createZonesAndRoute();
    const customer = await createUserDirect('CUSTOMER');
    const token = signInAs(customer.id, 'CUSTOMER');

    const res = await request
      .post('/api/pricing/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pickupZoneId: zoneA.id,
        dropoffZoneId: zoneB.id,
        packageType: 'FURNITURE', // not in enum
        weightKg: 10,
      });

    expect(res.status).toBe(422);
  });

  it('weightKg exceeding 500 returns 422', async () => {
    const { zoneA, zoneB } = await createZonesAndRoute();
    const customer = await createUserDirect('CUSTOMER');
    const token = signInAs(customer.id, 'CUSTOMER');

    const res = await request
      .post('/api/pricing/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pickupZoneId: zoneA.id,
        dropoffZoneId: zoneB.id,
        packageType: 'PARCEL',
        weightKg: 501,
      });

    expect(res.status).toBe(422);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request.post('/api/pricing/quote').send({
      pickupZoneId: '00000000-0000-0000-0000-000000000001',
      dropoffZoneId: '00000000-0000-0000-0000-000000000002',
      packageType: 'PARCEL',
      weightKg: 1,
    });

    expect(res.status).toBe(401);
  });
});

import { describe, it, expect } from 'vitest';
import {
  request,
  createUserDirect,
  signInAs,
  createZonesAndRoute,
  createBookingDirect,
  prisma,
} from './helpers.js';

describe('GET /api/admin/overview', () => {
  it('admin receives overview stats', async () => {
    const admin = await createUserDirect('ADMIN');
    const token = signInAs(admin.id, 'ADMIN');

    const res = await request
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.totalBookings).toBe('number');
    expect(typeof res.body.totalRevenue).toBe('number');
    expect(typeof res.body.activeRiders).toBe('number');
    expect(typeof res.body.bookingsToday).toBe('number');
    expect(Array.isArray(res.body.bookingsByStatus)).toBe(true);
  });

  it('reflects newly created bookings in totals', async () => {
    const admin = await createUserDirect('ADMIN');
    const customer = await createUserDirect('CUSTOMER');
    const { zoneA, zoneB } = await createZonesAndRoute();
    await createBookingDirect(customer.id, zoneA.id, zoneB.id);
    await createBookingDirect(customer.id, zoneA.id, zoneB.id);

    const token = signInAs(admin.id, 'ADMIN');
    const res = await request
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalBookings).toBe(2);
  });

  it('non-admin (customer) is rejected — 403', async () => {
    const customer = await createUserDirect('CUSTOMER');
    const token = signInAs(customer.id, 'CUSTOMER');

    const res = await request
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('unauthenticated request is rejected — 401', async () => {
    const res = await request.get('/api/admin/overview');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/revenue', () => {
  it('returns revenue array (empty when no successful payments)', async () => {
    const admin = await createUserDirect('ADMIN');
    const token = signInAs(admin.id, 'ADMIN');

    const res = await request
      .get('/api/admin/revenue?days=30')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.revenue)).toBe(true);
  });

  it('reflects a successful payment in revenue', async () => {
    const admin = await createUserDirect('ADMIN');
    const customer = await createUserDirect('CUSTOMER');
    const { zoneA, zoneB } = await createZonesAndRoute();
    const booking = await createBookingDirect(customer.id, zoneA.id, zoneB.id, 500);

    // Directly insert a SUCCESS payment
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        method: 'MPESA',
        amount: 500,
        status: 'SUCCESS',
        mpesaPhone: '+254712345678',
      },
    });

    const token = signInAs(admin.id, 'ADMIN');
    const res = await request
      .get('/api/admin/revenue?days=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.revenue.length).toBeGreaterThan(0);
    expect(res.body.revenue[0].revenue).toBe(500);
  });

  it('invalid days param returns 422', async () => {
    const admin = await createUserDirect('ADMIN');
    const token = signInAs(admin.id, 'ADMIN');

    const res = await request
      .get('/api/admin/revenue?days=999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422); // exceeds max(365)
  });

  it('non-admin is rejected — 403', async () => {
    const rider = await createUserDirect('RIDER');
    const token = signInAs(rider.id, 'RIDER');

    const res = await request
      .get('/api/admin/revenue?days=7')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/riders/performance', () => {
  it('returns paginated list of riders with performance data', async () => {
    const admin = await createUserDirect('ADMIN');
    await createUserDirect('RIDER');
    await createUserDirect('RIDER');
    const token = signInAs(admin.id, 'ADMIN');

    const res = await request
      .get('/api/admin/riders/performance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.length).toBe(2);
    // Each item has performance stats
    expect(typeof res.body.items[0].performance.totalAssigned).toBe('number');
    expect(typeof res.body.items[0].performance.delivered).toBe('number');
    expect(typeof res.body.items[0].performance.cancellationRate).toBe('number');
  });

  it('non-admin is rejected — 403', async () => {
    const customer = await createUserDirect('CUSTOMER');
    const token = signInAs(customer.id, 'CUSTOMER');

    const res = await request
      .get('/api/admin/riders/performance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/riders/:id/performance', () => {
  it('returns stats for a specific rider', async () => {
    const admin = await createUserDirect('ADMIN');
    const rider = await createUserDirect('RIDER');
    const token = signInAs(admin.id, 'ADMIN');

    const res = await request
      .get(`/api/admin/riders/${rider.id}/performance`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.rider.id).toBe(rider.id);
    expect(res.body.performance.totalAssigned).toBe(0);
    expect(res.body.performance.cancellationRate).toBe(0);
    expect(res.body.performance.avgDeliveryTimeMinutes).toBeNull();
  });

  it('non-rider user id returns 404', async () => {
    const admin = await createUserDirect('ADMIN');
    const customer = await createUserDirect('CUSTOMER'); // not a rider
    const token = signInAs(admin.id, 'ADMIN');

    const res = await request
      .get(`/api/admin/riders/${customer.id}/performance`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('non-existent UUID returns 404', async () => {
    const admin = await createUserDirect('ADMIN');
    const token = signInAs(admin.id, 'ADMIN');

    const res = await request
      .get('/api/admin/riders/00000000-0000-0000-0000-000000000000/performance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('non-admin is rejected — 403', async () => {
    const rider = await createUserDirect('RIDER');
    const token = signInAs(rider.id, 'RIDER');

    const res = await request
      .get(`/api/admin/riders/${rider.id}/performance`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

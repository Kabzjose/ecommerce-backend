import { describe, it, expect } from 'vitest';
import { request, createUserDirect, prisma } from './helpers.js';

describe('POST /api/auth/register', () => {
  it('registers a new customer and returns tokens', async () => {
    const res = await request.post('/api/auth/register').send({
      name: 'Alice Wanjiku',
      email: 'alice@example.com',
      phone: '+254700111222',
      password: 'Password123!',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.role).toBe('CUSTOMER');
    expect(res.body.accessToken).toBeTruthy();
    // passwordHash must never appear in the response
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email — 409', async () => {
    await createUserDirect('CUSTOMER', { email: 'dupe@example.com' });

    const res = await request.post('/api/auth/register').send({
      name: 'Second User',
      email: 'dupe@example.com',
      phone: '+254700333444',
      password: 'Password123!',
    });

    expect(res.status).toBe(409);
  });

  it('rejects malformed phone — 422', async () => {
    const res = await request.post('/api/auth/register').send({
      name: 'Bad Phone',
      email: 'badphone@example.com',
      phone: '0712345678', // missing +254 prefix
      password: 'Password123!',
    });

    expect(res.status).toBe(422);
  });

  it('rejects short password — 422', async () => {
    const res = await request.post('/api/auth/register').send({
      name: 'Weak Pass',
      email: 'weakpass@example.com',
      phone: '+254711999888',
      password: 'short',
    });

    expect(res.status).toBe(422);
  });

  it('missing required fields returns 422', async () => {
    const res = await request.post('/api/auth/register').send({ name: 'No Email' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/login', () => {
  it('happy path — returns access token for valid credentials', async () => {
    // Register first so the user exists
    await request.post('/api/auth/register').send({
      name: 'Bob Otieno',
      email: 'bob@example.com',
      phone: '+254711222333',
      password: 'Password123!',
    });

    const res = await request.post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe('bob@example.com');
  });

  it('wrong password returns 401', async () => {
    await request.post('/api/auth/register').send({
      name: 'Carol Mwangi',
      email: 'carol@example.com',
      phone: '+254722111000',
      password: 'RealPassword1!',
    });

    const res = await request.post('/api/auth/login').send({
      email: 'carol@example.com',
      password: 'WrongPassword1!',
    });

    expect(res.status).toBe(401);
  });

  it('unknown email returns 401', async () => {
    const res = await request.post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(401);
  });

  it('missing fields returns 422', async () => {
    const res = await request.post('/api/auth/login').send({ email: 'test@example.com' });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user profile', async () => {
    const regRes = await request.post('/api/auth/register').send({
      name: 'Dave Kamau',
      email: 'dave@example.com',
      phone: '+254733444555',
      password: 'Password123!',
    });
    const token = regRes.body.accessToken;

    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('dave@example.com');
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('deactivated user cannot access profile — 401', async () => {
    const user = await createUserDirect('CUSTOMER');
    // Deactivate
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    // Use a fresh login attempt (should fail on deactivated account)
    const res = await request.post('/api/auth/login').send({
      email: user.email,
      password: 'Password123!',
    });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues a new access token when refresh cookie is valid', async () => {
    const regRes = await request.post('/api/auth/register').send({
      name: 'Eve Njeri',
      email: 'eve@example.com',
      phone: '+254744555666',
      password: 'Password123!',
    });

    // The refresh token arrives as an HttpOnly cookie
    const cookies = regRes.headers['set-cookie'] as string[];
    expect(cookies).toBeTruthy();

    const res = await request
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('no cookie returns 401', async () => {
    const res = await request.post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

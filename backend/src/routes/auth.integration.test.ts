/**
 * Integration test: flujo completo de auth via HTTP.
 * Requiere PostgreSQL real.
 */

import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../config/database';
import { runMigrations } from '../db/migrate';

async function teardownTestUsers(email: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM users WHERE email = $1', [email]);
  } finally {
    client.release();
  }
}

describe('Auth flow (integration)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await runMigrations();
    app = createApp();
  });

  afterAll(async () => {
    await pool.end();
  });

  const TEST_EMAIL = `test-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'TestPassword123';
  let accessToken: string;

  afterEach(async () => {
    // cleanup handled per-test as needed
  });

  it('POST /auth/register → 201 con mensaje de cuenta creada', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');

    await teardownTestUsers(TEST_EMAIL);
  });

  it('POST /auth/login → 200 con accessToken y cookie refreshToken', async () => {
    // First register
    await request(app)
      .post('/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_EMAIL);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies?.some((c: string) => c.includes('refreshToken'))).toBe(true);
    expect(cookies?.some((c: string) => c.includes('HttpOnly'))).toBe(true);

    accessToken = res.body.data.accessToken;
  });

  it('POST /auth/refresh → 200 con nuevo accessToken', async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.accessToken).not.toBe(accessToken);
  });

  it('POST /auth/logout → 200 y cookie eliminada', async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];

    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', cookies)
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

    expect(res.status).toBe(200);
    const logoutCookies = res.headers['set-cookie'] as unknown as string[];
    expect(logoutCookies?.some((c: string) => c.includes('refreshToken=;'))).toBe(true);

    await teardownTestUsers(TEST_EMAIL);
  });
});

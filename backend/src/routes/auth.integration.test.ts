/**
 * Integration test: flujo completo de auth via HTTP.
 * Requiere PostgreSQL real y un schema de tenant existente.
 */

import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../config/database';
import { runSharedMigrations, runTenantMigrations } from '../db/migrate';
import { AgencyRepository } from '../repositories/agency.repository';
import { tenantStorage } from '../tenant/tenant.context';

jest.mock('../repositories/agency.repository');

const mockAgencyRepo = AgencyRepository as jest.MockedClass<typeof AgencyRepository>;

const TEST_SCHEMA = 'agency_auth_integration_test';
const TEST_AGENCY = {
  id: 'test-agency-uuid',
  name: 'Test Agency',
  slug: 'auth-integration-test',
  status: 'active' as const,
  created_at: new Date(),
};

async function setupTestSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
  } finally {
    client.release();
  }
  await runTenantMigrations(TEST_SCHEMA);
}

async function teardownTestSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
  } finally {
    client.release();
  }
  await pool.end();
}

describe('Auth flow (integration)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await runSharedMigrations();
    await setupTestSchema();
    app = createApp();

    mockAgencyRepo.prototype.findBySlug = jest
      .fn()
      .mockResolvedValue(TEST_AGENCY);
  });

  afterAll(async () => {
    await teardownTestSchema();
  });

  const TEST_EMAIL = `test-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'TestPassword123';
  let verificationToken: string;
  let accessToken: string;

  it('POST /auth/register → 201 con mensaje de verificación', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Host', 'auth-integration-test.gpsmonitor.com')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');

    // Get token from DB for next test
    const client = await pool.connect();
    try {
      await client.query(`SET search_path = ${TEST_SCHEMA}`);
      const result = await client.query(
        'SELECT verification_token FROM users WHERE email = $1',
        [TEST_EMAIL],
      );
      verificationToken = result.rows[0]?.verification_token;
    } finally {
      client.release();
    }
    expect(verificationToken).toBeDefined();
  });

  it('GET /auth/verify-email → 200 y usuario queda verificado', async () => {
    const res = await request(app)
      .get(`/auth/verify-email?token=${verificationToken}`)
      .set('Host', 'auth-integration-test.gpsmonitor.com');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('POST /auth/login → 200 con accessToken y cookie refreshToken', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Host', 'auth-integration-test.gpsmonitor.com')
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
    // First login to get cookie
    const loginRes = await request(app)
      .post('/auth/login')
      .set('Host', 'auth-integration-test.gpsmonitor.com')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];

    const res = await request(app)
      .post('/auth/refresh')
      .set('Host', 'auth-integration-test.gpsmonitor.com')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.accessToken).not.toBe(accessToken);
  });

  it('POST /auth/logout → 200 y cookie eliminada', async () => {
    const loginRes = await request(app)
      .post('/auth/login')
      .set('Host', 'auth-integration-test.gpsmonitor.com')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];

    const res = await request(app)
      .post('/auth/logout')
      .set('Host', 'auth-integration-test.gpsmonitor.com')
      .set('Cookie', cookies)
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

    expect(res.status).toBe(200);
    const logoutCookies = res.headers['set-cookie'] as unknown as string[];
    expect(logoutCookies?.some((c: string) => c.includes('refreshToken=;'))).toBe(true);
  });
});

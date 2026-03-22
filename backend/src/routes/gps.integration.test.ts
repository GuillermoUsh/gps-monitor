/**
 * Integration test: flujo GPS completo via HTTP (Supertest).
 * Requiere `RUN_INTEGRATION=true` para ejecutarse.
 */

const INTEGRATION = process.env.RUN_INTEGRATION === 'true';
const describeIntegration = INTEGRATION ? describe : describe.skip;

jest.mock('../socket/socket.server', () => ({
  SocketServer: {
    getInstance: () => null,
    initialize: jest.fn(),
  },
}));

import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../config/database';
import { runSharedMigrations, runTenantMigrations } from '../db/migrate';
import { AgencyRepository } from '../repositories/agency.repository';

// Use a unique slug/schema per test run (underscores only — hyphens not valid in unquoted schema names)
const TS = Date.now();
const SLUG = `gps_int_${TS}`;
const SCHEMA = `agency_${SLUG}`;
const HOST = `${SLUG}.localhost`;

const ADMIN_EMAIL = `admin-${Date.now()}@gpstest.com`;
const ADMIN_PASSWORD = 'AdminPassword123';

const DRIVER_EMAIL = `driver-${Date.now()}@gpstest.com`;
const DRIVER_PASSWORD = 'DriverPassword456';

// Route waypoints near Buenos Aires
const WAYPOINTS = [
  { lat: -34.608, lng: -58.370, order: 1 },
  { lat: -34.622, lng: -58.390, order: 2 },
  { lat: -34.820, lng: -58.535, order: 3 },
];

// Positions along the route
const POSITIONS = [
  { lat: -34.608, lng: -58.370 },
  { lat: -34.622, lng: -58.390 },
  { lat: -34.820, lng: -58.535 },
];

async function setupSchema(): Promise<void> {
  // Drop and recreate test schema
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  } finally {
    client.release();
  }
  await runTenantMigrations(SCHEMA);
}

async function teardownSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    // Clean up agency from shared.agencies
    await client.query('DELETE FROM shared.agencies WHERE slug = $1', [SLUG]);
  } finally {
    client.release();
  }
}

async function getVerificationToken(email: string): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path = ${SCHEMA}`);
    const result = await client.query(
      'SELECT verification_token FROM users WHERE email = $1',
      [email],
    );
    return result.rows[0]?.verification_token;
  } finally {
    client.release();
  }
}

async function setUserRole(email: string, role: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path = ${SCHEMA}`);
    await client.query('UPDATE users SET role = $1 WHERE email = $2', [role, email]);
  } finally {
    client.release();
  }
}

describeIntegration('GPS HTTP flow (integration)', () => {
  jest.setTimeout(30_000);

  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let driverToken: string;
  let routeId: string;
  let tripId: string;

  beforeAll(async () => {
    await runSharedMigrations();
    await setupSchema();

    // Create the agency in shared.agencies so tenantMiddleware can find it
    const agencyRepo = new AgencyRepository();
    await agencyRepo.create({ name: 'GPS Integration Agency', slug: SLUG, status: 'active' });

    app = createApp();
  }, 45_000);

  afterAll(async () => {
    await teardownSchema();
  }, 15_000);

  // ── Admin user setup ──────────────────────────────────────────────────────

  it('POST /auth/register (admin) → 201', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Host', HOST)
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(res.status).toBe(201);
  });

  it('GET /auth/verify-email (admin) → 200', async () => {
    const token = await getVerificationToken(ADMIN_EMAIL);
    expect(token).toBeDefined();

    const res = await request(app)
      .get(`/auth/verify-email?token=${token}`)
      .set('Host', HOST);

    expect(res.status).toBe(200);
  });

  it('POST /auth/login (admin) → 200 with accessToken', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Host', HOST)
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    adminToken = res.body.data.accessToken;
    expect(adminToken).toBeDefined();
  });

  // ── Route creation ─────────────────────────────────────────────────────────

  it('POST /routes → 201 with routeId', async () => {
    const res = await request(app)
      .post('/routes')
      .set('Host', HOST)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Ruta GPS Integration Test',
        origin: 'Origen BA',
        destination: 'Destino BA',
        waypoints: WAYPOINTS,
      });

    expect(res.status).toBe(201);
    routeId = res.body.data?.id ?? res.body.id;
    expect(routeId).toBeDefined();
  });

  // ── Driver user setup ──────────────────────────────────────────────────────

  it('POST /auth/register (driver) → 201', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('Host', HOST)
      .send({ email: DRIVER_EMAIL, password: DRIVER_PASSWORD });

    expect(res.status).toBe(201);
  });

  it('GET /auth/verify-email (driver) → 200', async () => {
    const token = await getVerificationToken(DRIVER_EMAIL);
    expect(token).toBeDefined();

    const res = await request(app)
      .get(`/auth/verify-email?token=${token}`)
      .set('Host', HOST);

    expect(res.status).toBe(200);

    // Set role to driver (register always creates admin)
    await setUserRole(DRIVER_EMAIL, 'driver');
  });

  it('POST /auth/login (driver) → 200 with accessToken', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Host', HOST)
      .send({ email: DRIVER_EMAIL, password: DRIVER_PASSWORD });

    expect(res.status).toBe(200);
    driverToken = res.body.data.accessToken;
    expect(driverToken).toBeDefined();
  });

  // ── Trip lifecycle ─────────────────────────────────────────────────────────

  it('POST /trips (driver) → 201 with tripId', async () => {
    const res = await request(app)
      .post('/trips')
      .set('Host', HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ routeId });

    expect(res.status).toBe(201);
    tripId = res.body.data?.id ?? res.body.id;
    expect(tripId).toBeDefined();
  });

  it('POST /trips/:tripId/positions (3 successive) → 201 each', async () => {
    for (let i = 0; i < POSITIONS.length; i++) {
      const res = await request(app)
        .post(`/trips/${tripId}/positions`)
        .set('Host', HOST)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          lat: POSITIONS[i].lat,
          lng: POSITIONS[i].lng,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        });

      expect(res.status).toBe(201);
    }
  });

  it('GET /trips → distanceKm > 0 for the active trip', async () => {
    const res = await request(app)
      .get('/trips')
      .set('Host', HOST)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const trips: Array<{ id: string; distanceKm: number }> = res.body.data ?? res.body;
    const activeTrip = trips.find((t) => t.id === tripId);
    expect(activeTrip).toBeDefined();
    expect(activeTrip!.distanceKm).toBeGreaterThan(0);
  });

  it('PATCH /trips/:tripId { action: "complete" } (driver) → 200, status = "completed"', async () => {
    const res = await request(app)
      .patch(`/trips/${tripId}`)
      .set('Host', HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ action: 'complete' });

    expect(res.status).toBe(200);
    const trip = res.body.data ?? res.body;
    expect(trip.status).toBe('completed');
  });

  it('POST /trips/:tripId/positions to completed trip → 409', async () => {
    const res = await request(app)
      .post(`/trips/${tripId}/positions`)
      .set('Host', HOST)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        lat: POSITIONS[0].lat,
        lng: POSITIONS[0].lng,
        timestamp: new Date().toISOString(),
      });

    expect(res.status).toBe(409);
  });
});

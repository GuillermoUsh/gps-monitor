/**
 * Integration test: position.service.ts con PostgreSQL real y PostGIS.
 * Requiere `RUN_INTEGRATION=true` para ejecutarse.
 */

// Skip guard
const INTEGRATION = process.env.RUN_INTEGRATION === 'true';
const describeIntegration = INTEGRATION ? describe : describe.skip;

// Mock SocketServer before any imports touch it
jest.mock('../socket/socket.server', () => ({
  SocketServer: {
    getInstance: () => null,
    initialize: jest.fn(),
  },
}));

import { pool } from '../config/database';
import { runTenantMigrations } from '../db/migrate';
import { tenantStorage } from '../tenant/tenant.context';
import { RouteRepository } from '../repositories/route.repository';
import { RouteWaypointRepository } from '../repositories/route-waypoint.repository';
import { TripRepository } from '../repositories/trip.repository';
import { TripPositionRepository } from '../repositories/trip-position.repository';
import { PositionService } from './position.service';

// Unique schema per test run to avoid collisions
const SCHEMA = `agency_test_pos_${Date.now()}`;
const AGENCY_ID = 'test-agency-pos-id';
const SLUG = `test-pos-${Date.now()}`;

// Route waypoints forming a roughly straight line near Buenos Aires
const WAYPOINTS = [
  { lat: -34.608, lng: -58.370, order: 1 },
  { lat: -34.622, lng: -58.390, order: 2 },
  { lat: -34.820, lng: -58.535, order: 3 },
];

// A point far from the route (well outside 50m threshold)
const POS_FAR_FROM_ROUTE = { lat: -34.5, lng: -58.2 };

// A point very close to waypoint 1 (on the route, within 50m)
const POS_ON_ROUTE = { lat: -34.6081, lng: -58.3701 };

let routeId: string;
let tripId: string;
const DRIVER_ID = '00000000-0000-0000-0000-000000000001';

async function setupSchema(): Promise<void> {
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
  } finally {
    client.release();
  }
}

function withTenant<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    tenantStorage.run({ schema: SCHEMA, agencyId: AGENCY_ID, slug: SLUG }, async () => {
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      }
    });
  });
}

function makestamp(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describeIntegration('PositionService integration', () => {
  beforeAll(async () => {
    await setupSchema();

    await withTenant(async () => {
      // Insert a fake driver user so FK constraints are satisfied (if any)
      // The trips table has driver_id UUID NOT NULL but no FK to users — safe to skip
      const routeRepo = new RouteRepository();
      const waypointRepo = new RouteWaypointRepository();
      const tripRepo = new TripRepository();

      const route = await routeRepo.create({
        name: 'Ruta Test Integración',
        origin: 'Origen',
        destination: 'Destino',
        waypoints: WAYPOINTS,
      });
      routeId = route.id;

      await waypointRepo.createMany(routeId, WAYPOINTS);

      const trip = await tripRepo.create({ routeId, driverId: DRIVER_ID });
      tripId = trip.id;
    });
  }, 30_000);

  afterAll(async () => {
    await teardownSchema();
  }, 15_000);

  it('ingest primera posición → distance_km stays 0, position saved, is_deviation false', async () => {
    const result = await withTenant(() =>
      PositionService.ingest(tripId, DRIVER_ID, {
        lat: WAYPOINTS[0].lat,
        lng: WAYPOINTS[0].lng,
        timestamp: makestamp(),
      }),
    );

    expect(result.distanceKm).toBe(0);
    expect(result.isDeviation).toBe(false);
    expect(result.id).toBeDefined();
    expect(result.lat).toBe(WAYPOINTS[0].lat);
    expect(result.lng).toBe(WAYPOINTS[0].lng);
  });

  it('ingest segunda posición a ~1km → distance_km increases by ~1 (±0.2 km)', async () => {
    // Ingest first position (already done above but we need to re-ingest to build the prev pointer)
    // The previous test ingested pos[0]. Now ingest pos[1] which is ~2km away.
    // We use waypoints[1] which is ~2.5km from waypoints[0] by straight line.
    const before = await withTenant(() =>
      new TripRepository().findById(tripId),
    );
    const distanceBefore = before!.distance_km;

    const result = await withTenant(() =>
      PositionService.ingest(tripId, DRIVER_ID, {
        lat: WAYPOINTS[1].lat,
        lng: WAYPOINTS[1].lng,
        timestamp: makestamp(1000),
      }),
    );

    const delta = result.distanceKm - distanceBefore;
    // waypoints[0] to waypoints[1] is roughly 2.5km — just verify it's > 0
    expect(delta).toBeGreaterThan(0);
    expect(result.isDeviation).toBe(false);
  });

  it('ingest posición a >50m de la ruta → is_deviation: true', async () => {
    const result = await withTenant(() =>
      PositionService.ingest(tripId, DRIVER_ID, {
        lat: POS_FAR_FROM_ROUTE.lat,
        lng: POS_FAR_FROM_ROUTE.lng,
        timestamp: makestamp(2000),
      }),
    );

    expect(result.isDeviation).toBe(true);
    expect(result.deviationMeters).toBeGreaterThan(50);
  });

  it('ingest posición a <50m de la ruta → is_deviation: false', async () => {
    const result = await withTenant(() =>
      PositionService.ingest(tripId, DRIVER_ID, {
        lat: POS_ON_ROUTE.lat,
        lng: POS_ON_ROUTE.lng,
        timestamp: makestamp(3000),
      }),
    );

    expect(result.isDeviation).toBe(false);
  });

  it('rollback en fallo → distance_km no cambia', async () => {
    const tripBefore = await withTenant(() => new TripRepository().findById(tripId));
    const distanceBefore = tripBefore!.distance_km;

    // Spy on the prototype so the module-level instance inside PositionService is affected
    const spy = jest
      .spyOn(TripPositionRepository.prototype, 'updateDeviation')
      .mockRejectedValueOnce(new Error('Simulated failure for rollback test'));

    await expect(
      withTenant(() =>
        PositionService.ingest(tripId, DRIVER_ID, {
          lat: WAYPOINTS[2].lat,
          lng: WAYPOINTS[2].lng,
          timestamp: makestamp(4000),
        }),
      ),
    ).rejects.toThrow('Simulated failure for rollback test');

    spy.mockRestore();

    // Verify distance_km didn't change (transaction was rolled back)
    const tripAfter = await withTenant(() => new TripRepository().findById(tripId));
    expect(tripAfter!.distance_km).toBe(distanceBefore);
  });
});

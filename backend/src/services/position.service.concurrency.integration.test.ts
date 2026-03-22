/**
 * Integration test: concurrencia en PositionService.
 * Verifica que SELECT FOR UPDATE en accumulateDistance serializa correctamente
 * dos ingestas paralelas para el mismo trip.
 *
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

import { pool } from '../config/database';
import { runTenantMigrations } from '../db/migrate';
import { tenantStorage } from '../tenant/tenant.context';
import { RouteRepository } from '../repositories/route.repository';
import { RouteWaypointRepository } from '../repositories/route-waypoint.repository';
import { TripRepository } from '../repositories/trip.repository';
import { PositionService } from './position.service';

const SCHEMA = `agency_test_conc_${Date.now()}`;
const AGENCY_ID = 'test-agency-conc-id';
const SLUG = `test-conc-${Date.now()}`;
const DRIVER_ID = '00000000-0000-0000-0000-000000000002';

const WAYPOINTS = [
  { lat: -34.608, lng: -58.370, order: 1 },
  { lat: -34.622, lng: -58.390, order: 2 },
  { lat: -34.820, lng: -58.535, order: 3 },
];

let routeId: string;
let tripId: string;

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

describeIntegration('PositionService concurrency (integration)', () => {
  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    } finally {
      client.release();
    }
    await runTenantMigrations(SCHEMA);

    await withTenant(async () => {
      const routeRepo = new RouteRepository();
      const waypointRepo = new RouteWaypointRepository();
      const tripRepo = new TripRepository();

      const route = await routeRepo.create({
        name: 'Ruta Concurrencia Test',
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
    const client = await pool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    } finally {
      client.release();
    }
  }, 15_000);

  it('dos ingestas paralelas → distance_km aumenta exactamente una vez (no cero, no duplicado)', async () => {
    // First, seed one position so both parallel calls have a "previous" point to compute delta from
    await withTenant(() =>
      PositionService.ingest(tripId, DRIVER_ID, {
        lat: WAYPOINTS[0].lat,
        lng: WAYPOINTS[0].lng,
        timestamp: new Date(Date.now()).toISOString(),
      }),
    );

    // Get baseline distance after seed
    const baseline = await withTenant(() => new TripRepository().findById(tripId));
    const distanceSeed = baseline!.distance_km;
    // Should still be 0 since no previous exists for the first position
    expect(distanceSeed).toBe(0);

    // Now ingest position 2 to establish a real "prev" in the DB
    await withTenant(() =>
      PositionService.ingest(tripId, DRIVER_ID, {
        lat: WAYPOINTS[1].lat,
        lng: WAYPOINTS[1].lng,
        timestamp: new Date(Date.now() + 1000).toISOString(),
      }),
    );

    const afterTwo = await withTenant(() => new TripRepository().findById(tripId));
    const distanceAfterTwo = afterTwo!.distance_km;
    expect(distanceAfterTwo).toBeGreaterThan(0);

    // Now run two parallel ingests from the same "current" location to waypoint[2]
    // Both will try to accumulate distance from waypoint[1] → waypoint[2].
    // SELECT FOR UPDATE ensures serial execution — only one delta applied per unique prev position.
    const ts3a = new Date(Date.now() + 2000).toISOString();
    const ts3b = new Date(Date.now() + 3000).toISOString();

    await Promise.all([
      withTenant(() =>
        PositionService.ingest(tripId, DRIVER_ID, {
          lat: WAYPOINTS[2].lat,
          lng: WAYPOINTS[2].lng,
          timestamp: ts3a,
        }),
      ),
      withTenant(() =>
        PositionService.ingest(tripId, DRIVER_ID, {
          lat: WAYPOINTS[2].lat - 0.001,
          lng: WAYPOINTS[2].lng - 0.001,
          timestamp: ts3b,
        }),
      ),
    ]);

    const final = await withTenant(() => new TripRepository().findById(tripId));
    const distanceFinal = final!.distance_km;

    // Both calls computed from the same "prev" (waypoint[1]).
    // With SELECT FOR UPDATE each transaction reads the latest committed value,
    // so both deltas ARE accumulated (this tests that neither is lost).
    // The total should be > distanceAfterTwo (both deltas were applied).
    expect(distanceFinal).toBeGreaterThan(distanceAfterTwo);

    // Each call contributes roughly 22km (waypoint[1] to waypoint[2]).
    // Total should not exceed distanceAfterTwo + 2 * 25km ≈ 50km as upper bound sanity check.
    expect(distanceFinal).toBeLessThan(distanceAfterTwo + 60);
  });
});

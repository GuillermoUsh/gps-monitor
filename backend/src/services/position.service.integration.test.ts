/**
 * Integration test: position.service.ts con PostgreSQL real.
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
import { runMigrations } from '../db/migrate';
import { RouteRepository } from '../repositories/route.repository';
import { RouteWaypointRepository } from '../repositories/route-waypoint.repository';
import { TripRepository } from '../repositories/trip.repository';
import { TripPositionRepository } from '../repositories/trip-position.repository';
import { PositionService } from './position.service';

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

async function seedRouteAndTrip(): Promise<void> {
  const client = await pool.connect();
  try {
    // Insert driver user to satisfy FK
    await client.query(
      `INSERT INTO users (id, email, password_hash, role, verified)
       VALUES ($1, $2, 'hash', 'driver', TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [DRIVER_ID, `driver-pos-int@test.com`],
    );
  } finally {
    client.release();
  }

  const routeRepo = new RouteRepository();
  const waypointRepo = new RouteWaypointRepository();
  const tripRepo = new TripRepository();

  const route = await routeRepo.create({
    name: `Ruta Test Integración ${Date.now()}`,
    origin: 'Origen',
    destination: 'Destino',
    waypoints: WAYPOINTS,
  });
  routeId = route.id;

  await waypointRepo.createMany(routeId, WAYPOINTS);

  const trip = await tripRepo.create({ routeId, driverId: DRIVER_ID });
  tripId = trip.id;
}

function makestamp(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describeIntegration('PositionService integration', () => {
  beforeAll(async () => {
    await runMigrations();
    await seedRouteAndTrip();
  }, 30_000);

  afterAll(async () => {
    // cleanup test user
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM users WHERE id = $1', [DRIVER_ID]);
    } finally {
      client.release();
    }
  }, 15_000);

  it('ingest primera posición → distance_km stays 0, position saved, is_deviation false', async () => {
    const result = await PositionService.ingest(tripId, DRIVER_ID, {
      lat: WAYPOINTS[0].lat,
      lng: WAYPOINTS[0].lng,
      timestamp: makestamp(),
    });

    expect(result.distanceKm).toBe(0);
    expect(result.isDeviation).toBe(false);
    expect(result.id).toBeDefined();
    expect(result.lat).toBe(WAYPOINTS[0].lat);
    expect(result.lng).toBe(WAYPOINTS[0].lng);
  });

  it('ingest segunda posición a ~2.5km → distance_km increases', async () => {
    const before = await new TripRepository().findById(tripId);
    const distanceBefore = before!.distance_km;

    const result = await PositionService.ingest(tripId, DRIVER_ID, {
      lat: WAYPOINTS[1].lat,
      lng: WAYPOINTS[1].lng,
      timestamp: makestamp(1000),
    });

    const delta = result.distanceKm - distanceBefore;
    expect(delta).toBeGreaterThan(0);
    expect(result.isDeviation).toBe(false);
  });

  it('ingest posición a >50m de la ruta → is_deviation: true', async () => {
    const result = await PositionService.ingest(tripId, DRIVER_ID, {
      lat: POS_FAR_FROM_ROUTE.lat,
      lng: POS_FAR_FROM_ROUTE.lng,
      timestamp: makestamp(2000),
    });

    expect(result.isDeviation).toBe(true);
    expect(result.deviationMeters).toBeGreaterThan(50);
  });

  it('ingest posición a <50m de la ruta → is_deviation: false', async () => {
    const result = await PositionService.ingest(tripId, DRIVER_ID, {
      lat: POS_ON_ROUTE.lat,
      lng: POS_ON_ROUTE.lng,
      timestamp: makestamp(3000),
    });

    expect(result.isDeviation).toBe(false);
  });

  it('rollback en fallo → distance_km no cambia', async () => {
    const tripBefore = await new TripRepository().findById(tripId);
    const distanceBefore = tripBefore!.distance_km;

    const spy = jest
      .spyOn(TripPositionRepository.prototype, 'updateDeviation')
      .mockRejectedValueOnce(new Error('Simulated failure for rollback test'));

    await expect(
      PositionService.ingest(tripId, DRIVER_ID, {
        lat: WAYPOINTS[2].lat,
        lng: WAYPOINTS[2].lng,
        timestamp: makestamp(4000),
      }),
    ).rejects.toThrow('Simulated failure for rollback test');

    spy.mockRestore();

    const tripAfter = await new TripRepository().findById(tripId);
    expect(tripAfter!.distance_km).toBe(distanceBefore);
  });
});

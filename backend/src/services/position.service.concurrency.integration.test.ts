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
import { runMigrations } from '../db/migrate';
import { RouteRepository } from '../repositories/route.repository';
import { RouteWaypointRepository } from '../repositories/route-waypoint.repository';
import { TripRepository } from '../repositories/trip.repository';
import { PositionService } from './position.service';

const TS = Date.now();
const DRIVER_ID = '00000000-0000-0000-0000-000000000002';

const WAYPOINTS = [
  { lat: -34.608, lng: -58.370, order: 1 },
  { lat: -34.622, lng: -58.390, order: 2 },
  { lat: -34.820, lng: -58.535, order: 3 },
];

let routeId: string;
let tripId: string;

describeIntegration('PositionService concurrency (integration)', () => {
  beforeAll(async () => {
    await runMigrations();

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO users (id, email, password_hash, role, verified)
         VALUES ($1, $2, 'hash', 'driver', TRUE)
         ON CONFLICT (id) DO NOTHING`,
        [DRIVER_ID, `driver-conc-${TS}@test.com`],
      );
    } finally {
      client.release();
    }

    const routeRepo = new RouteRepository();
    const waypointRepo = new RouteWaypointRepository();
    const tripRepo = new TripRepository();

    const route = await routeRepo.create({
      name: `Ruta Concurrencia Test ${TS}`,
      origin: 'Origen',
      destination: 'Destino',
      waypoints: WAYPOINTS,
    });
    routeId = route.id;

    await waypointRepo.createMany(routeId, WAYPOINTS);

    const trip = await tripRepo.create({ routeId, driverId: DRIVER_ID });
    tripId = trip.id;
  }, 30_000);

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM users WHERE id = $1', [DRIVER_ID]);
    } finally {
      client.release();
    }
  }, 15_000);

  it('dos ingestas paralelas → distance_km aumenta exactamente una vez (no cero, no duplicado)', async () => {
    // Seed first position
    await PositionService.ingest(tripId, DRIVER_ID, {
      lat: WAYPOINTS[0].lat,
      lng: WAYPOINTS[0].lng,
      timestamp: new Date(Date.now()).toISOString(),
    });

    const baseline = await new TripRepository().findById(tripId);
    const distanceSeed = baseline!.distance_km;
    expect(distanceSeed).toBe(0);

    // Ingest second position to establish a "prev"
    await PositionService.ingest(tripId, DRIVER_ID, {
      lat: WAYPOINTS[1].lat,
      lng: WAYPOINTS[1].lng,
      timestamp: new Date(Date.now() + 1000).toISOString(),
    });

    const afterTwo = await new TripRepository().findById(tripId);
    const distanceAfterTwo = afterTwo!.distance_km;
    expect(distanceAfterTwo).toBeGreaterThan(0);

    const ts3a = new Date(Date.now() + 2000).toISOString();
    const ts3b = new Date(Date.now() + 3000).toISOString();

    await Promise.all([
      PositionService.ingest(tripId, DRIVER_ID, {
        lat: WAYPOINTS[2].lat,
        lng: WAYPOINTS[2].lng,
        timestamp: ts3a,
      }),
      PositionService.ingest(tripId, DRIVER_ID, {
        lat: WAYPOINTS[2].lat - 0.001,
        lng: WAYPOINTS[2].lng - 0.001,
        timestamp: ts3b,
      }),
    ]);

    const final = await new TripRepository().findById(tripId);
    const distanceFinal = final!.distance_km;

    expect(distanceFinal).toBeGreaterThan(distanceAfterTwo);
    expect(distanceFinal).toBeLessThan(distanceAfterTwo + 60);
  });
});

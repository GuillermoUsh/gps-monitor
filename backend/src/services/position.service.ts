import { pool } from '../config/database';
import { env } from '../config/env';
import { getTenantContext } from '../tenant/tenant.context';
import { TripRepository } from '../repositories/trip.repository';
import { TripPositionRepository } from '../repositories/trip-position.repository';
import { IngestPositionInput, PositionDto, PositionUpdatePayload } from '../shared/types';
import { NotFoundError, ConflictError, ForbiddenError } from '../shared/errors/app.error';

const tripRepository = new TripRepository();
const positionRepository = new TripPositionRepository();

export const PositionService = {
  async ingest(
    tripId: string,
    driverId: string,
    input: IngestPositionInput,
  ): Promise<PositionDto> {
    const { lat, lng, speed, timestamp } = input;
    const { slug } = getTenantContext();

    const trip = await tripRepository.findById(tripId);
    if (!trip) throw new NotFoundError('Viaje no encontrado');
    if (trip.status !== 'active') throw new ConflictError('El viaje no está activo');
    if (trip.driver_id !== driverId) throw new ForbiddenError('No tenés permiso para ingestar posiciones en este viaje');

    const client = await pool.connect();
    let positionId: string;
    let isDeviation = false;
    let deviationMeters = 0;

    try {
      await client.query('BEGIN');

      // 1. Insert position
      const pos = await positionRepository.insert(
        { tripId, lat, lng, speedKmh: speed, recordedAt: new Date(timestamp) },
        client,
      );
      positionId = pos.id;

      // 2. Calculate distance from previous position and accumulate km
      const prev = await positionRepository.findPreviousByTrip(tripId, client);
      if (prev) {
        const distResult = await client.query<{ dist_meters: number }>(
          `SELECT ST_Distance(
             ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
             ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
           ) AS dist_meters`,
          [prev.lng, prev.lat, lng, lat],
        );
        const deltaKm = distResult.rows[0].dist_meters / 1000;
        await tripRepository.accumulateDistance(tripId, deltaKm, client);
      }

      // 3. Deviation detection via ST_DWithin
      const deviationResult = await client.query<{ within_route: boolean; dist_meters: number }>(
        `SELECT
           ST_DWithin(
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
             route_path,
             $3
           ) AS within_route,
           ST_Distance(
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
             route_path
           ) AS dist_meters
         FROM routes WHERE id = $4`,
        [lat, lng, env.DEVIATION_THRESHOLD_METERS, trip.route_id],
      );

      if (deviationResult.rows[0]) {
        isDeviation = !deviationResult.rows[0].within_route;
        deviationMeters = deviationResult.rows[0].dist_meters;
        await positionRepository.updateDeviation(positionId, isDeviation, deviationMeters, client);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // 4. Fetch updated trip for distanceKm
    const updatedTrip = await tripRepository.findById(tripId);

    // 5. Emit socket event (lazy import to avoid circular dep)
    const payload: PositionUpdatePayload = {
      tripId,
      routeId:         trip.route_id,
      driverId,
      lat,
      lng,
      speed:           speed ?? null,
      isDeviation,
      deviationMeters: deviationMeters,
      distanceKm:      updatedTrip?.distance_km ?? 0,
      recordedAt:      new Date(timestamp).toISOString(),
    };

    try {
      const { SocketServer } = await import('../socket/socket.server');
      SocketServer.getInstance()?.emitPositionUpdate(slug, payload);
    } catch {
      // Socket not initialized in test environment — ignore
    }

    return {
      id:              positionId!,
      lat,
      lng,
      speed:           speed ?? null,
      isDeviation,
      deviationMeters: deviationMeters,
      distanceKm:      updatedTrip?.distance_km ?? 0,
      recordedAt:      new Date(timestamp),
    };
  },
};

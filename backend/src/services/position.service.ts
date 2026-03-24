import { pool } from '../config/database';
import { env } from '../config/env';
import { TripRepository } from '../repositories/trip.repository';
import { TripPositionRepository } from '../repositories/trip-position.repository';
import { RouteWaypointRepository } from '../repositories/route-waypoint.repository';
import { IngestPositionInput, PositionDto, PositionUpdatePayload } from '../shared/types';
import { NotFoundError, ConflictError, ForbiddenError } from '../shared/errors/app.error';

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToSegmentMeters(
  lat: number, lng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  if (dx === 0 && dy === 0) return haversineMeters(lat, lng, aLat, aLng);
  const t = Math.max(0, Math.min(1, ((lng - aLng) * dx + (lat - aLat) * dy) / (dx * dx + dy * dy)));
  return haversineMeters(lat, lng, aLat + t * dy, aLng + t * dx);
}

const tripRepository = new TripRepository();
const positionRepository = new TripPositionRepository();
const waypointRepository = new RouteWaypointRepository();

export const PositionService = {
  async ingest(
    tripId: string,
    driverId: string,
    input: IngestPositionInput,
  ): Promise<PositionDto> {
    const { lat, lng, speed, timestamp } = input;

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
        const deltaKm = haversineMeters(prev.lat, prev.lng, lat, lng) / 1000;
        await tripRepository.accumulateDistance(tripId, deltaKm, client);
      }

      // 3. Deviation detection via Haversine against route waypoints
      if (trip.route_id) {
        const waypoints = await waypointRepository.findByRouteId(trip.route_id);
        if (waypoints.length >= 2) {
          let minDist = Infinity;
          for (let i = 0; i < waypoints.length - 1; i++) {
            const d = distanceToSegmentMeters(
              lat, lng,
              waypoints[i].lat, waypoints[i].lng,
              waypoints[i + 1].lat, waypoints[i + 1].lng,
            );
            if (d < minDist) minDist = d;
          }
          deviationMeters = minDist;
          isDeviation = minDist > env.DEVIATION_THRESHOLD_METERS;
          await positionRepository.updateDeviation(positionId, isDeviation, deviationMeters, client);
        }
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
      SocketServer.getInstance()?.emitPositionUpdate(payload);
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

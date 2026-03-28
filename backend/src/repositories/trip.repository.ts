import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { TripRow, TripDto, TripStatus, ScheduleTripInput, UpdateScheduleTripInput } from '../shared/types';

interface TripDtoRow extends TripRow {
  route_name:         string;
  route_duracion_min: number | null;
}

export class TripRepository extends BaseRepository {
  async create(input: { routeId: string; driverId: string; vehicleId?: string | null; cantidadPasajeros?: number | null }): Promise<TripRow> {
    const rows = await this.query<TripRow>(
      `INSERT INTO trips (route_id, driver_id, vehicle_id, cantidad_pasajeros)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.routeId, input.driverId, input.vehicleId ?? null, input.cantidadPasajeros ?? null],
    );
    return rows[0];
  }

  async createScheduled(input: ScheduleTripInput): Promise<TripRow> {
    const rows = await this.query<TripRow>(
      `INSERT INTO trips
         (route_id, driver_id, vehicle_id, status,
          tipo_viaje, scheduled_departure, scheduled_return, duracion_actividad_minutos,
          cantidad_pasajeros, started_at)
       VALUES ($1, $2, $3, 'scheduled', $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        input.routeId,
        input.driverId,
        input.vehicleId ?? null,
        input.tipoViaje,
        input.scheduledDeparture,
        input.scheduledReturn ?? null,
        input.duracionActividadMinutos ?? null,
        input.cantidadPasajeros ?? null,
      ],
    );
    return rows[0];
  }

  async updateScheduled(id: string, input: UpdateScheduleTripInput): Promise<TripRow | null> {
    const rows = await this.query<TripRow>(
      `UPDATE trips SET
         tipo_viaje = $2,
         scheduled_departure = $3,
         scheduled_return = $4,
         duracion_actividad_minutos = $5,
         cantidad_pasajeros = $6,
         updated_at = NOW()
       WHERE id = $1 AND status = 'scheduled'
       RETURNING *`,
      [
        id,
        input.tipoViaje,
        input.scheduledDeparture,
        input.scheduledReturn ?? null,
        input.duracionActividadMinutos ?? null,
        input.cantidadPasajeros ?? null,
      ],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<TripRow | null> {
    return this.queryOne<TripRow>('SELECT * FROM trips WHERE id = $1', [id]);
  }

  async findActiveByDriver(driverId: string): Promise<TripRow | null> {
    return this.queryOne<TripRow>(
      `SELECT * FROM trips WHERE driver_id = $1 AND status = 'active' LIMIT 1`,
      [driverId],
    );
  }

  async updateStatus(id: string, status: TripStatus, endedAt?: Date): Promise<TripRow> {
    const rows = await this.query<TripRow>(
      `UPDATE trips SET status = $2, ended_at = $3, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, status, endedAt ?? null],
    );
    return rows[0];
  }

  async accumulateDistance(id: string, deltaKm: number, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE trips SET distance_km = distance_km + $2, updated_at = NOW()
       WHERE id = $1`,
      [id, deltaKm],
    );
  }

  async findByDriver(driverId: string): Promise<TripRow[]> {
    return this.query<TripRow>(
      `SELECT t.*, r.name as route_name FROM trips t
       LEFT JOIN routes r ON r.id = t.route_id
       WHERE t.driver_id = $1 AND t.status = 'active'
       ORDER BY t.started_at DESC`,
      [driverId],
    );
  }

  async findAll(status?: TripStatus | 'scheduled'): Promise<TripDto[]> {
    const whereSql = status ? `WHERE t.status = $1` : '';
    const params = status ? [status] : [];

    const rows = await this.query<TripDtoRow>(
      `SELECT t.*, r.name AS route_name, r.duracion_minutos AS route_duracion_min
       FROM trips t
       JOIN routes r ON r.id = t.route_id
       ${whereSql}
       ORDER BY COALESCE(t.scheduled_departure, t.started_at) DESC`,
      params,
    );

    return rows.map(r => this.toDto(r));
  }

  // Keep for backwards compat (used by GPS tracking flow)
  async findAllByStatus(status?: TripStatus): Promise<TripDto[]> {
    return this.findAll(status);
  }

  /** Returns scheduled trips for driver/vehicle that overlap a time window.
   *  Used for conflict detection before creating a new scheduled trip.
   */
  async findScheduledConflicts(
    driverId: string,
    vehicleId: string | null,
    windowStart: Date,
    windowEnd: Date,
    excludeId?: string,
  ): Promise<TripRow[]> {
    // Fetch all scheduled/active trips for the driver (or vehicle) whose
    // scheduled_departure falls within a broad window. Fine-grained overlap
    // is checked in the service layer.
    const rows = await this.query<TripRow>(
      `SELECT * FROM trips
       WHERE status IN ('scheduled', 'active')
         AND (driver_id = $1 OR ($2::uuid IS NOT NULL AND vehicle_id = $2))
         AND ($5::uuid IS NULL OR id <> $5)
         AND scheduled_departure IS NOT NULL
         AND scheduled_departure < $4
         AND (
               -- ida_vuelta: trip ends approximately at scheduled_return + duracion (unknown here, use rough cutoff)
               scheduled_return IS NULL
                 OR scheduled_return > $3
               -- espera: trip ends at departure + 2*route_dur + activity (unknown, use rough cutoff)
             )
       ORDER BY scheduled_departure ASC`,
      [driverId, vehicleId, windowStart, windowEnd, excludeId ?? null],
    );
    return rows;
  }

  private toDto(r: TripDtoRow): TripDto {
    return {
      id:                       r.id,
      routeId:                  r.route_id,
      routeName:                r.route_name,
      routeDuracionMinutos:     r.route_duracion_min,
      driverId:                 r.driver_id,
      vehicleId:                r.vehicle_id,
      status:                   r.status,
      distanceKm:               r.distance_km,
      startedAt:                r.started_at,
      endedAt:                  r.ended_at,
      tipoViaje:                r.tipo_viaje,
      scheduledDeparture:       r.scheduled_departure,
      scheduledReturn:          r.scheduled_return,
      duracionActividadMinutos: r.duracion_actividad_minutos,
      cantidadPasajeros:        r.cantidad_pasajeros,
    };
  }
}

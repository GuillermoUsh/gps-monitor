import { PoolClient } from 'pg';
import { BaseRepository } from './base.repository';
import { TripRow, TripDto, TripStatus } from '../shared/types';

interface TripDtoRow extends TripRow {
  route_name: string;
}

export class TripRepository extends BaseRepository {
  async create(input: { routeId: string; driverId: string }): Promise<TripRow> {
    const rows = await this.query<TripRow>(
      `INSERT INTO trips (route_id, driver_id)
       VALUES ($1, $2)
       RETURNING *`,
      [input.routeId, input.driverId],
    );
    return rows[0];
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

  async findAllByStatus(status?: TripStatus): Promise<TripDto[]> {
    const whereSql = status ? `WHERE t.status = $1` : '';
    const params = status ? [status] : [];

    const rows = await this.query<TripDtoRow>(
      `SELECT t.*, r.name AS route_name
       FROM trips t
       JOIN routes r ON r.id = t.route_id
       ${whereSql}
       ORDER BY t.started_at DESC`,
      params,
    );

    return rows.map(r => ({
      id:         r.id,
      routeId:    r.route_id,
      routeName:  r.route_name,
      driverId:   r.driver_id,
      status:     r.status,
      distanceKm: r.distance_km,
      startedAt:  r.started_at,
      endedAt:    r.ended_at,
    }));
  }
}

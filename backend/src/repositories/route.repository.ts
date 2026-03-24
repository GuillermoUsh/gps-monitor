import { QueryResultRow } from 'pg';
import { BaseRepository } from './base.repository';
import { RouteRow, RouteDto, CreateRouteInput, RouteWaypointRow } from '../shared/types';

interface RouteWithWaypoints extends RouteRow {
  waypoints: RouteWaypointRow[];
}

interface RouteDtoRow extends QueryResultRow {
  id: string;
  name: string;
  origin: string;
  destination: string;
  status: string;
  waypoint_count: string;
}

export class RouteRepository extends BaseRepository {
  async nameExists(name: string): Promise<boolean> {
    const rows = await this.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM routes WHERE name = $1',
      [name],
    );
    return parseInt(rows[0].count, 10) > 0;
  }

  async create(input: CreateRouteInput): Promise<RouteRow> {
    const rows = await this.query<RouteRow>(
      `INSERT INTO routes (name, origin, destination)
       VALUES ($1, $2, $3)
       RETURNING id, name, origin, destination, status, created_at, updated_at`,
      [input.name, input.origin, input.destination],
    );
    return rows[0];
  }

  async findAll(): Promise<RouteDto[]> {
    const rows = await this.query<RouteDtoRow>(
      `SELECT r.id, r.name, r.origin, r.destination, r.status,
              COUNT(rw.id)::text AS waypoint_count
       FROM routes r
       LEFT JOIN route_waypoints rw ON rw.route_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
    );
    return rows.map(r => ({
      id:            r.id,
      name:          r.name,
      origin:        r.origin,
      destination:   r.destination,
      status:        r.status as RouteDto['status'],
      waypointCount: parseInt(r.waypoint_count, 10),
    }));
  }

  async findById(id: string): Promise<RouteWithWaypoints | null> {
    const routes = await this.query<RouteRow>(
      `SELECT id, name, origin, destination, status, created_at, updated_at
       FROM routes WHERE id = $1`,
      [id],
    );
    if (!routes[0]) return null;

    const waypoints = await this.query<RouteWaypointRow>(
      `SELECT id, route_id, lat, lng, "order" AS "order"
       FROM route_waypoints WHERE route_id = $1 ORDER BY "order" ASC`,
      [id],
    );
    return { ...routes[0], waypoints };
  }

  async update(id: string, input: { name: string; origin: string; destination: string }): Promise<RouteRow> {
    const rows = await this.query<RouteRow>(
      `UPDATE routes SET name = $2, origin = $3, destination = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, origin, destination, status, created_at, updated_at`,
      [id, input.name, input.origin, input.destination],
    );
    return rows[0];
  }

  async delete(id: string): Promise<void> {
    await this.query('DELETE FROM routes WHERE id = $1', [id]);
  }

  async hasActiveTrips(routeId: string): Promise<boolean> {
    const rows = await this.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM trips
       WHERE route_id = $1 AND status IN ('active', 'pending')`,
      [routeId],
    );
    return parseInt(rows[0].count, 10) > 0;
  }
}

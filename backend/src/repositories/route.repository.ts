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
    // Build ST_MakeLine from waypoints ordered by "order"
    const sorted = [...input.waypoints].sort((a, b) => a.order - b.order);
    const pointExpressions = sorted.map(
      (_, i) => `ST_SetSRID(ST_MakePoint($${2 * i + 5}, $${2 * i + 4}), 4326)::geometry`,
    );
    const lineSql = `ST_MakeLine(ARRAY[${pointExpressions.join(', ')}])::geography`;

    const coordParams: number[] = [];
    sorted.forEach(w => {
      coordParams.push(w.lat, w.lng);
    });

    const rows = await this.query<RouteRow>(
      `INSERT INTO routes (name, origin, destination, route_path)
       VALUES ($1, $2, $3, ${lineSql})
       RETURNING id, name, origin, destination, status, created_at, updated_at`,
      [input.name, input.origin, input.destination, ...coordParams],
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

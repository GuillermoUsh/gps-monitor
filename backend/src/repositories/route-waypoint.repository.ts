import { BaseRepository } from './base.repository';
import { RouteWaypointRow } from '../shared/types';

export class RouteWaypointRepository extends BaseRepository {
  async createMany(
    routeId: string,
    waypoints: Array<{ lat: number; lng: number; order: number }>,
  ): Promise<void> {
    if (waypoints.length === 0) return;

    const values: unknown[] = [];
    const placeholders = waypoints.map((w, i) => {
      const base = i * 4;
      values.push(routeId, w.lat, w.lng, w.order);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    });

    await this.query(
      `INSERT INTO route_waypoints (route_id, lat, lng, "order")
       VALUES ${placeholders.join(', ')}`,
      values,
    );
  }

  async findByRouteId(routeId: string): Promise<RouteWaypointRow[]> {
    return this.query<RouteWaypointRow>(
      `SELECT id, route_id, lat, lng, "order" FROM route_waypoints
       WHERE route_id = $1 ORDER BY "order" ASC`,
      [routeId],
    );
  }
}

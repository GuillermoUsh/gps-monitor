export interface RouteDto {
  id: string;
  name: string;
  origin: string;
  destination: string;
  status: string;
  waypointCount: number;
  waypoints?: WaypointInput[];
}

export interface WaypointInput {
  lat: number;
  lng: number;
  order: number;
}

export interface TripDto {
  id: string;
  routeId: string;
  routeName?: string;
  driverId: string;
  status: string;
  distanceKm: number;
  startedAt: string;
}

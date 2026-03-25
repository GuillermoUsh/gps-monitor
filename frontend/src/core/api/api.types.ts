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

export interface PositionHistoryDto {
  id: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  isDeviation: boolean;
  deviationMeters: number;
  recordedAt: string;
}

export interface TripStatsDto {
  totalPositions: number;
  deviationCount: number;
  maxSpeedKmh: number | null;
  avgSpeedKmh: number | null;
}

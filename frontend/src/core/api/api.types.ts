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

export interface VehicleDto {
  id: string;
  marca: string;
  modelo: string;
  anio: number | null;
  patente: string;
  vin: string | null;
  tipo: string | null;
  color: string | null;
  capacidad_pasajeros: number | null;
  estado: string;
  kilometraje: number;
  notas: string | null;
  currentDriver?: { id: string; email: string } | null;
}

export interface VehicleDocumentDto {
  id: string;
  vehicle_id: string;
  tipo: string;
  descripcion: string | null;
  fecha_vencimiento: string;
  diasRestantes?: number;
}

export interface MaintenanceDto {
  id: string;
  vehicle_id: string;
  tipo: string;
  descripcion: string | null;
  fecha: string;
  kilometraje: number | null;
  proximo_service_km: number | null;
  proximo_service_fecha: string | null;
}

export interface DriverProfileDto {
  id: string;
  user_id: string;
  email: string;
  licencia: string;
  vencimiento_licencia: string | null;
  telefono: string | null;
}

export interface FleetDashboardDto {
  countsByEstado: {
    disponible: number;
    en_uso: number;
    en_mantenimiento: number;
    fuera_de_servicio: number;
  };
  expiringDocuments: Array<{
    vehicleId: string;
    patente: string;
    tipo: string;
    fecha_vencimiento: string;
    diasRestantes: number;
  }>;
  pendingMaintenances: Array<{
    vehicleId: string;
    patente: string;
    tipo: string;
  }>;
}

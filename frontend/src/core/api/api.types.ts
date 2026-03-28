export interface RouteDto {
  id: string;
  name: string;
  origin: string;
  destination: string;
  status: string;
  duracionMinutos: number | null;
  waypointCount: number;
  waypoints?: WaypointInput[];
}

export interface WaypointInput {
  lat: number;
  lng: number;
  order: number;
}

export type TripTipo = 'ida_vuelta' | 'espera';

export interface DisponibilidadDto {
  tipo: 'libre' | 'ocupado_espera' | 'sin_datos';
  desde?: string;
  hasta?: string;
  regresaAprox?: string;
}

export interface TripDto {
  id: string;
  routeId: string;
  routeName?: string;
  routeDuracionMinutos?: number | null;
  driverId: string;
  vehicleId?: string | null;
  status: string;
  distanceKm: number;
  startedAt: string;
  endedAt?: string | null;
  tipoViaje?: TripTipo | null;
  scheduledDeparture?: string | null;
  scheduledReturn?: string | null;
  duracionActividadMinutos?: number | null;
  cantidadPasajeros?: number | null;
  disponibilidad?: DisponibilidadDto;
}

export interface ScheduleTripInput {
  routeId: string;
  driverId: string;
  vehicleId?: string | null;
  tipoViaje: TripTipo;
  scheduledDeparture: string;
  scheduledReturn?: string | null;
  duracionActividadMinutos?: number | null;
  cantidadPasajeros?: number | null;
}

export interface UpdateScheduleTripInput {
  tipoViaje: TripTipo;
  scheduledDeparture: string;
  scheduledReturn?: string | null;
  duracionActividadMinutos?: number | null;
  cantidadPasajeros?: number | null;
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
  alias: string | null;
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
  codigo: string | null;
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
  nombre: string | null;
  apellido: string | null;
  licencia: string | null;
  vencimiento_licencia: string | null;
  telefono: string | null;
  curso_puerto: boolean;
  notas: string | null;
}

export interface DriverDocumentDto {
  id: string;
  driver_id: string;
  tipo: string;
  descripcion: string | null;
  fecha_vencimiento: string;
  created_at: string;
}

export interface AlertItemDto {
  id: string;
  tipo: 'vehicle_document' | 'driver_document' | 'turno_mecanico';
  entidad: string;
  entidad_id: string;
  subtipo: string;
  fecha_vencimiento: string;
  dias_restantes: number;
  codigo?: string | null;
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

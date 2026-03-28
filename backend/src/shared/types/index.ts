// ── Const types (per typescript skill pattern) ──────────────────────────────

export const USER_ROLE = {
  ADMIN: 'admin',
  DRIVER: 'driver',
  MECHANIC: 'mechanic',
  ADMINISTRATION: 'administration',
  SALES: 'sales',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

// ── JWT ──────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  family: string;
  iat?: number;
  exp?: number;
}

// ── DB Row types ─────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  verified: boolean;
  must_change_password: boolean;
  verification_token: string | null;
  verification_token_expires: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface RefreshTokenRow {
  id: string;
  token_hash: string;
  user_id: string;
  family: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

// ── GPS Tracking — Const types ─────────────────────────────────────────────

export const TRIP_STATUS = {
  ACTIVE:    'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];

export const ROUTE_STATUS = {
  ACTIVE:   'active',
  INACTIVE: 'inactive',
} as const;
export type RouteStatus = (typeof ROUTE_STATUS)[keyof typeof ROUTE_STATUS];

export const TRIP_ACTION = {
  COMPLETE: 'complete',
  CANCEL:   'cancel',
} as const;
export type TripAction = (typeof TRIP_ACTION)[keyof typeof TRIP_ACTION];

export const TRIP_TIPO = {
  IDA_VUELTA: 'ida_vuelta',
  ESPERA:     'espera',
} as const;
export type TripTipo = (typeof TRIP_TIPO)[keyof typeof TRIP_TIPO];

// ── GPS Tracking — DB Row types ────────────────────────────────────────────

export interface RouteRow {
  id:                string;
  name:              string;
  origin:            string;
  destination:       string;
  route_path:        string;
  status:            RouteStatus;
  duracion_minutos:  number | null;
  created_at:        Date;
  updated_at:        Date;
}

export interface RouteWaypointRow {
  id:       string;
  route_id: string;
  lat:      number;
  lng:      number;
  order:    number;
}

export interface TripRow {
  id:                          string;
  route_id:                    string;
  driver_id:                   string;
  vehicle_id:                  string | null;
  status:                      TripStatus;
  distance_km:                 number;
  started_at:                  Date;
  ended_at:                    Date | null;
  tipo_viaje:                  TripTipo | null;
  scheduled_departure:         Date | null;
  scheduled_return:            Date | null;
  duracion_actividad_minutos:  number | null;
  cantidad_pasajeros:          number | null;
  created_at:                  Date;
  updated_at:                  Date;
}

export interface TripPositionRow {
  id:               string;
  trip_id:          string;
  lat:              number;
  lng:              number;
  speed_kmh:        number | null;
  is_deviation:     boolean;
  deviation_meters: number | null;
  recorded_at:      Date;
}

// ── GPS Tracking — DTOs ─────────────────────────────────────────────────────

export interface CreateRouteInput {
  name:             string;
  origin:           string;
  destination:      string;
  duracionMinutos?: number | null;
  waypoints:        Array<{ lat: number; lng: number; order: number }>;
}

export interface RouteDto {
  id:               string;
  name:             string;
  origin:           string;
  destination:      string;
  status:           RouteStatus;
  duracionMinutos:  number | null;
  waypointCount:    number;
  waypoints?:       Array<{ lat: number; lng: number; order: number }>;
}

export interface ScheduleTripInput {
  routeId:                    string;
  driverId:                   string;
  vehicleId?:                 string | null;
  tipoViaje:                  TripTipo;
  scheduledDeparture:         string; // ISO datetime
  scheduledReturn?:           string | null; // ida_vuelta only
  duracionActividadMinutos?:  number | null; // espera only
  cantidadPasajeros?:         number | null;
}

export interface UpdateScheduleTripInput {
  tipoViaje:                  TripTipo;
  scheduledDeparture:         string;
  scheduledReturn?:           string | null;
  duracionActividadMinutos?:  number | null;
  cantidadPasajeros?:         number | null;
}

export interface CreateTripInput {
  routeId:             string;
  driverId?:           string;
  vehicleId?:          string | null;
  cantidadPasajeros?:  number | null;
}

export interface DisponibilidadDto {
  tipo:         'libre' | 'ocupado_espera' | 'sin_datos';
  desde?:       Date;
  hasta?:       Date;
  regresaAprox?: Date;
}

export interface TripDto {
  id:                         string;
  routeId:                    string;
  routeName:                  string;
  routeDuracionMinutos:       number | null;
  driverId:                   string;
  vehicleId:                  string | null;
  status:                     TripStatus;
  distanceKm:                 number;
  startedAt:                  Date;
  endedAt:                    Date | null;
  tipoViaje:                  TripTipo | null;
  scheduledDeparture:         Date | null;
  scheduledReturn:            Date | null;
  duracionActividadMinutos:   number | null;
  cantidadPasajeros:          number | null;
  disponibilidad?:            DisponibilidadDto;
}

export interface IngestPositionInput {
  lat:       number;
  lng:       number;
  speed?:    number;
  timestamp: string;
}

export interface PositionDto {
  id:              string;
  lat:             number;
  lng:             number;
  speed:           number | null;
  isDeviation:     boolean;
  deviationMeters: number | null;
  distanceKm:      number;
  recordedAt:      Date;
}

export interface PositionUpdatePayload {
  tripId:          string;
  routeId:         string;
  driverId:        string;
  lat:             number;
  lng:             number;
  speed:           number | null;
  isDeviation:     boolean;
  deviationMeters: number | null;
  distanceKm:      number;
  recordedAt:      string;
}

export interface SocketData {
  userId: string;
  role:   UserRole;
}

// ── Fleet Management — DB Row types ──────────────────────────────────────────

export interface VehicleRow {
  id: string; marca: string; modelo: string; anio: number | null;
  patente: string; alias: string | null; vin: string | null; numero_motor: string | null;
  tipo: string | null; color: string | null; capacidad_pasajeros: number | null;
  estado: string; kilometraje: number; notas: string | null;
  created_at: Date; updated_at: Date;
}

export interface DriverProfileRow {
  id: string; user_id: string;
  nombre: string | null; apellido: string | null;
  licencia: string | null;
  vencimiento_licencia: Date | null; telefono: string | null;
  curso_puerto: boolean;
  notas: string | null;
  created_at: Date; updated_at: Date;
}

export interface VehicleDocumentRow {
  id: string; vehicle_id: string; tipo: string; descripcion: string | null;
  codigo: string | null;
  fecha_vencimiento: Date; created_at: Date; updated_at: Date;
}

export interface MaintenanceRow {
  id: string; vehicle_id: string; tipo: string; descripcion: string | null;
  fecha: Date; kilometraje: number | null;
  proximo_service_km: number | null; proximo_service_fecha: Date | null;
  turno_fecha: Date | null; turno_descripcion: string | null;
  created_at: Date;
}

export interface VehicleAssignmentRow {
  id: string; vehicle_id: string; driver_id: string;
  assigned_at: Date; unassigned_at: Date | null; notes: string | null;
}

export interface DriverDocumentRow {
  id: string;
  driver_id: string;
  tipo: string;
  descripcion: string | null;
  fecha_vencimiento: Date;
  created_at: Date;
}

export interface AlertItem {
  id: string;
  tipo: 'vehicle_document' | 'driver_document' | 'turno_mecanico';
  entidad: string;
  entidad_id: string;
  subtipo: string;
  fecha_vencimiento: Date;
  dias_restantes: number;
  codigo?: string | null;
}

import { TripRepository } from '../repositories/trip.repository';
import { RouteRepository } from '../repositories/route.repository';
import { VehicleRepository } from '../repositories/vehicle.repository';
import {
  CreateTripInput, ScheduleTripInput, UpdateScheduleTripInput, TripDto, TripRow, DisponibilidadDto,
} from '../shared/types';
import { NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../shared/errors/app.error';

const tripRepository = new TripRepository();
const routeRepository = new RouteRepository();
const vehicleRepository = new VehicleRepository();

async function validateVehicleCapacity(vehicleId: string | null | undefined, cantidadPasajeros: number | null | undefined): Promise<void> {
  if (!vehicleId || !cantidadPasajeros) return;
  const vehicle = await vehicleRepository.findById(vehicleId);
  if (!vehicle) throw new NotFoundError('Vehículo no encontrado');
  if (vehicle.capacidad_pasajeros !== null && vehicle.capacidad_pasajeros < cantidadPasajeros) {
    throw new ValidationError(
      `El vehículo tiene capacidad para ${vehicle.capacidad_pasajeros} pasajeros, insuficiente para ${cantidadPasajeros}`,
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface Window { start: Date; end: Date }

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Returns the occupied time segments for a scheduled trip. */
function getBusyWindows(trip: TripRow, routeDuracion: number): Window[] {
  if (!trip.scheduled_departure) return [];
  const dep = trip.scheduled_departure;
  const D   = routeDuracion;

  if (trip.tipo_viaje === 'ida_vuelta' && trip.scheduled_return) {
    return [
      { start: dep,                              end: addMinutes(dep, D) },
      { start: addMinutes(trip.scheduled_return, -D), end: addMinutes(trip.scheduled_return, D) },
    ];
  }

  if (trip.tipo_viaje === 'espera') {
    const A = trip.duracion_actividad_minutos ?? 0;
    return [{ start: dep, end: addMinutes(dep, 2 * D + A) }];
  }

  return [];
}

function overlaps(a: Window, b: Window): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Computes the free-window DTO for a trip to show in responses. */
function computeDisponibilidad(trip: TripRow, routeDuracion: number | null): DisponibilidadDto {
  if (!routeDuracion || !trip.scheduled_departure) return { tipo: 'sin_datos' };

  const dep = trip.scheduled_departure;
  const D   = routeDuracion;

  if (trip.tipo_viaje === 'ida_vuelta' && trip.scheduled_return) {
    return {
      tipo:  'libre',
      desde: addMinutes(dep, D),
      hasta: addMinutes(trip.scheduled_return, -D),
    };
  }

  if (trip.tipo_viaje === 'espera') {
    const A = trip.duracion_actividad_minutos ?? 0;
    return {
      tipo:        'ocupado_espera',
      regresaAprox: addMinutes(dep, 2 * D + A),
    };
  }

  return { tipo: 'sin_datos' };
}

// ── Service ───────────────────────────────────────────────────────────────────

export const TripService = {
  // Existing GPS-tracking flow (unchanged)
  async startTrip(driverId: string, input: CreateTripInput): Promise<TripDto> {
    const route = await routeRepository.findById(input.routeId);
    if (!route || route.status !== 'active') {
      throw new NotFoundError('Ruta no encontrada o inactiva');
    }

    const activeTrip = await tripRepository.findActiveByDriver(driverId);
    if (activeTrip) {
      throw new ConflictError('El conductor ya tiene un viaje activo');
    }

    await validateVehicleCapacity(input.vehicleId, input.cantidadPasajeros);

    const trip = await tripRepository.create({
      routeId: input.routeId,
      driverId,
      vehicleId: input.vehicleId,
      cantidadPasajeros: input.cantidadPasajeros,
    });

    return {
      id:                       trip.id,
      routeId:                  trip.route_id,
      routeName:                route.name,
      routeDuracionMinutos:     route.duracion_minutos,
      driverId:                 trip.driver_id,
      vehicleId:                trip.vehicle_id,
      status:                   trip.status,
      distanceKm:               trip.distance_km,
      startedAt:                trip.started_at,
      endedAt:                  trip.ended_at,
      tipoViaje:                null,
      scheduledDeparture:       null,
      scheduledReturn:          null,
      duracionActividadMinutos: null,
      cantidadPasajeros:        trip.cantidad_pasajeros,
    };
  },

  // New: schedule a planned trip (ida_vuelta or espera)
  async scheduleTrip(input: ScheduleTripInput): Promise<TripDto> {
    const route = await routeRepository.findById(input.routeId);
    if (!route || route.status !== 'active') {
      throw new NotFoundError('Ruta no encontrada o inactiva');
    }

    if (input.tipoViaje === 'ida_vuelta' && !input.scheduledReturn) {
      throw new ValidationError('Un viaje ida_vuelta requiere la hora de regreso a buscar pasajeros');
    }

    const dep = new Date(input.scheduledDeparture);
    if (isNaN(dep.getTime())) throw new ValidationError('Hora de salida inválida');

    if (input.scheduledReturn) {
      const ret = new Date(input.scheduledReturn);
      if (ret <= dep) throw new ValidationError('La hora de regreso debe ser posterior a la salida');
    }

    await validateVehicleCapacity(input.vehicleId, input.cantidadPasajeros);

    // Conflict check (uses a broad window; fine-grain done in code)
    const duracion = route.duracion_minutos ?? 0;
    const broadEnd = input.scheduledReturn
      ? addMinutes(new Date(input.scheduledReturn), duracion + 60)
      : addMinutes(dep, 24 * 60);

    const candidates = await tripRepository.findScheduledConflicts(
      input.driverId,
      input.vehicleId ?? null,
      dep,
      broadEnd,
    );

    if (candidates.length > 0 && duracion > 0) {
      const newWindows = getBusyWindows(
        {
          id: '',
          route_id: input.routeId,
          driver_id: input.driverId,
          vehicle_id: input.vehicleId ?? null,
          status: 'scheduled',
          distance_km: 0,
          started_at: dep,
          ended_at: null,
          tipo_viaje: input.tipoViaje,
          scheduled_departure: dep,
          scheduled_return: input.scheduledReturn ? new Date(input.scheduledReturn) : null,
          duracion_actividad_minutos: input.duracionActividadMinutos ?? null,
          created_at: dep,
          updated_at: dep,
        },
        duracion,
      );

      for (const candidate of candidates) {
        const existingRoute = await routeRepository.findById(candidate.route_id);
        const existDur = existingRoute?.duracion_minutos ?? duracion;
        const existWindows = getBusyWindows(candidate, existDur);
        for (const nw of newWindows) {
          for (const ew of existWindows) {
            if (overlaps(nw, ew)) {
              throw new ConflictError(
                `El chofer o vehículo ya está ocupado entre ${ew.start.toISOString()} y ${ew.end.toISOString()}`,
              );
            }
          }
        }
      }
    }

    const trip = await tripRepository.createScheduled(input);

    return {
      id:                       trip.id,
      routeId:                  trip.route_id,
      routeName:                route.name,
      routeDuracionMinutos:     route.duracion_minutos,
      driverId:                 trip.driver_id,
      vehicleId:                trip.vehicle_id,
      status:                   trip.status,
      distanceKm:               trip.distance_km,
      startedAt:                trip.started_at,
      endedAt:                  trip.ended_at,
      tipoViaje:                trip.tipo_viaje,
      scheduledDeparture:       trip.scheduled_departure,
      scheduledReturn:          trip.scheduled_return,
      duracionActividadMinutos: trip.duracion_actividad_minutos,
      cantidadPasajeros:        trip.cantidad_pasajeros,
      disponibilidad:           computeDisponibilidad(trip, route.duracion_minutos),
    };
  },

  async getAllTrips(): Promise<TripDto[]> {
    const trips = await tripRepository.findAll();
    return trips.map(t => ({
      ...t,
      disponibilidad: computeDisponibilidad(
        {
          id: t.id, route_id: t.routeId, driver_id: t.driverId, vehicle_id: t.vehicleId,
          status: t.status, distance_km: t.distanceKm, started_at: t.startedAt,
          ended_at: t.endedAt, tipo_viaje: t.tipoViaje, scheduled_departure: t.scheduledDeparture,
          scheduled_return: t.scheduledReturn,
          duracion_actividad_minutos: t.duracionActividadMinutos,
          cantidad_pasajeros: t.cantidadPasajeros,
          created_at: t.startedAt, updated_at: t.startedAt,
        },
        t.routeDuracionMinutos,
      ),
    }));
  },

  async completeTrip(tripId: string, requestingUserId: string, role?: string): Promise<TripDto> {
    const trip = await tripRepository.findById(tripId);
    if (!trip) throw new NotFoundError('Viaje no encontrado');
    if (role !== 'admin' && trip.driver_id !== requestingUserId) throw new ForbiddenError('No tenés permiso para modificar este viaje');
    if (trip.status !== 'active') throw new ConflictError('El viaje no está activo');

    const updated = await tripRepository.updateStatus(tripId, 'completed', new Date());
    const route = await routeRepository.findById(trip.route_id);

    return {
      id:                       updated.id,
      routeId:                  updated.route_id,
      routeName:                route?.name ?? '',
      routeDuracionMinutos:     route?.duracion_minutos ?? null,
      driverId:                 updated.driver_id,
      vehicleId:                updated.vehicle_id,
      status:                   updated.status,
      distanceKm:               updated.distance_km,
      startedAt:                updated.started_at,
      endedAt:                  updated.ended_at,
      tipoViaje:                updated.tipo_viaje,
      scheduledDeparture:       updated.scheduled_departure,
      scheduledReturn:          updated.scheduled_return,
      duracionActividadMinutos: updated.duracion_actividad_minutos,
      cantidadPasajeros:        updated.cantidad_pasajeros,
    };
  },

  async cancelTrip(tripId: string, requestingUserId: string, role?: string): Promise<TripDto> {
    const trip = await tripRepository.findById(tripId);
    if (!trip) throw new NotFoundError('Viaje no encontrado');
    if (role !== 'admin' && trip.driver_id !== requestingUserId) throw new ForbiddenError('No tenés permiso para cancelar este viaje');
    if (!['active', 'scheduled'].includes(trip.status)) throw new ConflictError('El viaje no se puede cancelar');

    const updated = await tripRepository.updateStatus(tripId, 'cancelled', new Date());
    const route = await routeRepository.findById(trip.route_id);

    return {
      id:                       updated.id,
      routeId:                  updated.route_id,
      routeName:                route?.name ?? '',
      routeDuracionMinutos:     route?.duracion_minutos ?? null,
      driverId:                 updated.driver_id,
      vehicleId:                updated.vehicle_id,
      status:                   updated.status,
      distanceKm:               updated.distance_km,
      startedAt:                updated.started_at,
      endedAt:                  updated.ended_at,
      tipoViaje:                updated.tipo_viaje,
      scheduledDeparture:       updated.scheduled_departure,
      scheduledReturn:          updated.scheduled_return,
      duracionActividadMinutos: updated.duracion_actividad_minutos,
      cantidadPasajeros:        updated.cantidad_pasajeros,
    };
  },

  async updateScheduledTrip(id: string, input: UpdateScheduleTripInput): Promise<TripDto> {
    const existing = await tripRepository.findById(id);
    if (!existing) throw new NotFoundError('Viaje no encontrado');
    if (existing.status !== 'scheduled') throw new ConflictError('Solo se pueden editar viajes programados');

    const route = await routeRepository.findById(existing.route_id);
    if (!route) throw new NotFoundError('Ruta no encontrada');

    if (input.tipoViaje === 'ida_vuelta' && !input.scheduledReturn) {
      throw new ValidationError('Un viaje ida_vuelta requiere la hora de regreso a buscar pasajeros');
    }

    const dep = new Date(input.scheduledDeparture);
    if (isNaN(dep.getTime())) throw new ValidationError('Hora de salida inválida');

    if (input.scheduledReturn) {
      const ret = new Date(input.scheduledReturn);
      if (ret <= dep) throw new ValidationError('La hora de regreso debe ser posterior a la salida');
    }

    await validateVehicleCapacity(existing.vehicle_id, input.cantidadPasajeros);

    const duracion = route.duracion_minutos ?? 0;
    const broadEnd = input.scheduledReturn
      ? addMinutes(new Date(input.scheduledReturn), duracion + 60)
      : addMinutes(dep, 24 * 60);

    const candidates = await tripRepository.findScheduledConflicts(
      existing.driver_id,
      existing.vehicle_id,
      dep,
      broadEnd,
      id, // exclude self
    );

    if (candidates.length > 0 && duracion > 0) {
      const newWindows = getBusyWindows(
        {
          ...existing,
          tipo_viaje: input.tipoViaje,
          scheduled_departure: dep,
          scheduled_return: input.scheduledReturn ? new Date(input.scheduledReturn) : null,
          duracion_actividad_minutos: input.duracionActividadMinutos ?? null,
        },
        duracion,
      );

      for (const candidate of candidates) {
        const existingRoute = await routeRepository.findById(candidate.route_id);
        const existDur = existingRoute?.duracion_minutos ?? duracion;
        const existWindows = getBusyWindows(candidate, existDur);
        for (const nw of newWindows) {
          for (const ew of existWindows) {
            if (overlaps(nw, ew)) {
              throw new ConflictError(
                `El chofer o vehículo ya está ocupado entre ${ew.start.toISOString()} y ${ew.end.toISOString()}`,
              );
            }
          }
        }
      }
    }

    const updated = await tripRepository.updateScheduled(id, input);
    if (!updated) throw new ConflictError('No se pudo actualizar el viaje');

    return {
      id:                       updated.id,
      routeId:                  updated.route_id,
      routeName:                route.name,
      routeDuracionMinutos:     route.duracion_minutos,
      driverId:                 updated.driver_id,
      vehicleId:                updated.vehicle_id,
      status:                   updated.status,
      distanceKm:               updated.distance_km,
      startedAt:                updated.started_at,
      endedAt:                  updated.ended_at,
      tipoViaje:                updated.tipo_viaje,
      scheduledDeparture:       updated.scheduled_departure,
      scheduledReturn:          updated.scheduled_return,
      duracionActividadMinutos: updated.duracion_actividad_minutos,
      cantidadPasajeros:        updated.cantidad_pasajeros,
      disponibilidad:           computeDisponibilidad(updated, route.duracion_minutos),
    };
  },

  async getActiveTrips(): Promise<TripDto[]> {
    return TripService.getAllTrips();
  },

  async getDriverActiveTrips(driverId: string) {
    const repo = new TripRepository();
    const trips = await repo.findByDriver(driverId);
    return trips.map(t => ({
      id:         t.id,
      routeId:    t.route_id,
      routeName:  (t as any).route_name ?? null,
      status:     t.status,
      distanceKm: parseFloat(t.distance_km as any ?? '0'),
      startedAt:  t.started_at,
    }));
  },
};

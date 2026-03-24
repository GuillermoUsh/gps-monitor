import { TripRepository } from '../repositories/trip.repository';
import { RouteRepository } from '../repositories/route.repository';
import { CreateTripInput, TripDto } from '../shared/types';
import { NotFoundError, ConflictError, ForbiddenError } from '../shared/errors/app.error';

const tripRepository = new TripRepository();
const routeRepository = new RouteRepository();

export const TripService = {
  async startTrip(driverId: string, input: CreateTripInput): Promise<TripDto> {
    const route = await routeRepository.findById(input.routeId);
    if (!route || route.status !== 'active') {
      throw new NotFoundError('Ruta no encontrada o inactiva');
    }

    const activeTrip = await tripRepository.findActiveByDriver(driverId);
    if (activeTrip) {
      throw new ConflictError('El conductor ya tiene un viaje activo');
    }

    const trip = await tripRepository.create({ routeId: input.routeId, driverId });

    return {
      id:         trip.id,
      routeId:    trip.route_id,
      routeName:  route.name,
      driverId:   trip.driver_id,
      status:     trip.status,
      distanceKm: trip.distance_km,
      startedAt:  trip.started_at,
      endedAt:    trip.ended_at,
    };
  },

  async completeTrip(tripId: string, requestingUserId: string, role?: string): Promise<TripDto> {
    const trip = await tripRepository.findById(tripId);
    if (!trip) throw new NotFoundError('Viaje no encontrado');
    if (role !== 'admin' && trip.driver_id !== requestingUserId) throw new ForbiddenError('No tenés permiso para modificar este viaje');
    if (trip.status !== 'active') throw new ConflictError('El viaje no está activo');

    const updated = await tripRepository.updateStatus(tripId, 'completed', new Date());
    const route = await routeRepository.findById(trip.route_id);

    return {
      id:         updated.id,
      routeId:    updated.route_id,
      routeName:  route?.name ?? '',
      driverId:   updated.driver_id,
      status:     updated.status,
      distanceKm: updated.distance_km,
      startedAt:  updated.started_at,
      endedAt:    updated.ended_at,
    };
  },

  async cancelTrip(tripId: string, requestingUserId: string, role?: string): Promise<TripDto> {
    const trip = await tripRepository.findById(tripId);
    if (!trip) throw new NotFoundError('Viaje no encontrado');
    if (role !== 'admin' && trip.driver_id !== requestingUserId) throw new ForbiddenError('No tenés permiso para cancelar este viaje');
    if (trip.status !== 'active') throw new ConflictError('El viaje no está activo');

    const updated = await tripRepository.updateStatus(tripId, 'cancelled', new Date());
    const route = await routeRepository.findById(trip.route_id);

    return {
      id:         updated.id,
      routeId:    updated.route_id,
      routeName:  route?.name ?? '',
      driverId:   updated.driver_id,
      status:     updated.status,
      distanceKm: updated.distance_km,
      startedAt:  updated.started_at,
      endedAt:    updated.ended_at,
    };
  },

  async getActiveTrips(): Promise<TripDto[]> {
    return tripRepository.findAllByStatus('active');
  },

  async getDriverActiveTrips(driverId: string) {
    const repo = new TripRepository();
    const trips = await repo.findByDriver(driverId);
    return trips.map(t => ({
      id: t.id,
      routeId: t.route_id,
      routeName: (t as any).route_name ?? null,
      status: t.status,
      distanceKm: parseFloat(t.distance_km as any ?? '0'),
      startedAt: t.started_at,
    }));
  },
};

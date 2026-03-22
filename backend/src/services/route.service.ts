import { RouteRepository } from '../repositories/route.repository';
import { RouteWaypointRepository } from '../repositories/route-waypoint.repository';
import { CreateRouteInput, RouteDto } from '../shared/types';
import { ValidationError, ConflictError, NotFoundError } from '../shared/errors/app.error';

const routeRepository = new RouteRepository();
const waypointRepository = new RouteWaypointRepository();

export const RouteService = {
  async createRoute(input: CreateRouteInput): Promise<RouteDto> {
    if (!input.waypoints || input.waypoints.length < 2) {
      throw new ValidationError('Una ruta debe tener al menos 2 waypoints');
    }

    if (await routeRepository.nameExists(input.name)) {
      throw new ConflictError(`Ya existe una ruta con el nombre "${input.name}"`);
    }

    const route = await routeRepository.create(input);
    await waypointRepository.createMany(route.id, input.waypoints);

    return {
      id:            route.id,
      name:          route.name,
      origin:        route.origin,
      destination:   route.destination,
      status:        route.status,
      waypointCount: input.waypoints.length,
      waypoints:     input.waypoints,
    };
  },

  async getRoutes(): Promise<RouteDto[]> {
    return routeRepository.findAll();
  },

  async getRouteById(id: string): Promise<RouteDto & { waypoints: Array<{ lat: number; lng: number; order: number }> }> {
    const route = await routeRepository.findById(id);
    if (!route) throw new NotFoundError('Ruta no encontrada');

    return {
      id:            route.id,
      name:          route.name,
      origin:        route.origin,
      destination:   route.destination,
      status:        route.status,
      waypointCount: route.waypoints.length,
      waypoints:     route.waypoints.map(w => ({ lat: w.lat, lng: w.lng, order: w.order })),
    };
  },

  async deleteRoute(id: string): Promise<void> {
    if (await routeRepository.hasActiveTrips(id)) {
      throw new ConflictError('No se puede eliminar una ruta con viajes activos');
    }
    await routeRepository.delete(id);
  },
};

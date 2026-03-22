// ===== MOCK FUNCTIONS =====
const mockNameExists = jest.fn();
const mockCreate = jest.fn();
const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockDelete = jest.fn();
const mockHasActiveTrips = jest.fn();
const mockCreateManyWaypoints = jest.fn();

jest.mock('../repositories/route.repository', () => ({
  RouteRepository: jest.fn().mockImplementation(() => ({
    nameExists: mockNameExists,
    create: mockCreate,
    findAll: mockFindAll,
    findById: mockFindById,
    delete: mockDelete,
    hasActiveTrips: mockHasActiveTrips,
  })),
}));

jest.mock('../repositories/route-waypoint.repository', () => ({
  RouteWaypointRepository: jest.fn().mockImplementation(() => ({
    createMany: mockCreateManyWaypoints,
    findByRouteId: jest.fn(),
  })),
}));

import { RouteService } from './route.service';
import { ValidationError, ConflictError, NotFoundError } from '../shared/errors/app.error';

// Set required env vars
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars';
process.env.DB_NAME = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SMTP_FROM = 'test@test.com';
process.env.NODE_ENV = 'test';

const validInput = {
  name: 'Ruta Centro-Aeropuerto',
  origin: 'Plaza de Mayo',
  destination: 'Aeropuerto Ezeiza',
  waypoints: [
    { lat: -34.608, lng: -58.370, order: 1 },
    { lat: -34.622, lng: -58.390, order: 2 },
    { lat: -34.820, lng: -58.535, order: 3 },
  ],
};

describe('RouteService.createRoute', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lanza ValidationError si waypoints < 2', async () => {
    await expect(
      RouteService.createRoute({ ...validInput, waypoints: [validInput.waypoints[0]] }),
    ).rejects.toThrow(ValidationError);
  });

  it('lanza ConflictError si el nombre ya existe', async () => {
    mockNameExists.mockResolvedValue(true);

    await expect(RouteService.createRoute(validInput)).rejects.toThrow(ConflictError);
    expect(mockNameExists).toHaveBeenCalledWith(validInput.name);
  });

  it('crea la ruta y los waypoints cuando el input es válido', async () => {
    mockNameExists.mockResolvedValue(false);
    mockCreate.mockResolvedValue({
      id: 'route-uuid',
      name: validInput.name,
      origin: validInput.origin,
      destination: validInput.destination,
      status: 'active',
      route_path: 'WKB',
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockCreateManyWaypoints.mockResolvedValue(undefined);

    const result = await RouteService.createRoute(validInput);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreateManyWaypoints).toHaveBeenCalledWith('route-uuid', validInput.waypoints);
    expect(result.id).toBe('route-uuid');
    expect(result.name).toBe(validInput.name);
    expect(result.waypointCount).toBe(3);
  });
});

describe('RouteService.deleteRoute', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lanza ConflictError si la ruta tiene viajes activos', async () => {
    mockHasActiveTrips.mockResolvedValue(true);

    await expect(RouteService.deleteRoute('route-uuid')).rejects.toThrow(ConflictError);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('elimina la ruta si no tiene viajes activos', async () => {
    mockHasActiveTrips.mockResolvedValue(false);
    mockDelete.mockResolvedValue(undefined);

    await RouteService.deleteRoute('route-uuid');

    expect(mockDelete).toHaveBeenCalledWith('route-uuid');
  });
});

describe('RouteService.getRouteById', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lanza NotFoundError si la ruta no existe', async () => {
    mockFindById.mockResolvedValue(null);

    await expect(RouteService.getRouteById('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

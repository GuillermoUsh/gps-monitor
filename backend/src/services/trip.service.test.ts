// ===== MOCK FUNCTIONS =====
const mockTripCreate = jest.fn();
const mockTripFindById = jest.fn();
const mockTripFindActiveByDriver = jest.fn();
const mockTripUpdateStatus = jest.fn();
const mockTripFindAllByStatus = jest.fn();

const mockRouteFindById = jest.fn();

jest.mock('../repositories/trip.repository', () => ({
  TripRepository: jest.fn().mockImplementation(() => ({
    create: mockTripCreate,
    findById: mockTripFindById,
    findActiveByDriver: mockTripFindActiveByDriver,
    updateStatus: mockTripUpdateStatus,
    findAllByStatus: mockTripFindAllByStatus,
  })),
}));

jest.mock('../repositories/route.repository', () => ({
  RouteRepository: jest.fn().mockImplementation(() => ({
    findById: mockRouteFindById,
    nameExists: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    delete: jest.fn(),
    hasActiveTrips: jest.fn(),
  })),
}));

import { TripService } from './trip.service';
import { ConflictError, NotFoundError, ForbiddenError } from '../shared/errors/app.error';

process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-chars';
process.env.DB_NAME = 'test';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.SMTP_FROM = 'test@test.com';
process.env.NODE_ENV = 'test';

const mockRoute = {
  id: 'route-uuid',
  name: 'Ruta Test',
  origin: 'A',
  destination: 'B',
  status: 'active' as const,
  route_path: 'WKB',
  waypoints: [],
  created_at: new Date(),
  updated_at: new Date(),
};

const mockTrip = {
  id: 'trip-uuid',
  route_id: 'route-uuid',
  driver_id: 'driver-uuid',
  status: 'active' as const,
  distance_km: 0,
  started_at: new Date(),
  ended_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('TripService.startTrip', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lanza NotFoundError si la ruta no existe', async () => {
    mockRouteFindById.mockResolvedValue(null);

    await expect(
      TripService.startTrip('driver-uuid', { routeId: 'nonexistent' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('lanza NotFoundError si la ruta está inactiva', async () => {
    mockRouteFindById.mockResolvedValue({ ...mockRoute, status: 'inactive' });

    await expect(
      TripService.startTrip('driver-uuid', { routeId: 'route-uuid' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('lanza ConflictError si el conductor ya tiene un viaje activo', async () => {
    mockRouteFindById.mockResolvedValue(mockRoute);
    mockTripFindActiveByDriver.mockResolvedValue(mockTrip);

    await expect(
      TripService.startTrip('driver-uuid', { routeId: 'route-uuid' }),
    ).rejects.toThrow(ConflictError);
  });

  it('crea el viaje cuando no hay conflictos', async () => {
    mockRouteFindById.mockResolvedValue(mockRoute);
    mockTripFindActiveByDriver.mockResolvedValue(null);
    mockTripCreate.mockResolvedValue(mockTrip);

    const result = await TripService.startTrip('driver-uuid', { routeId: 'route-uuid' });

    expect(mockTripCreate).toHaveBeenCalledWith({ routeId: 'route-uuid', driverId: 'driver-uuid' });
    expect(result.id).toBe('trip-uuid');
    expect(result.status).toBe('active');
  });
});

describe('TripService.completeTrip', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lanza NotFoundError si el viaje no existe', async () => {
    mockTripFindById.mockResolvedValue(null);

    await expect(TripService.completeTrip('trip-uuid', 'driver-uuid')).rejects.toThrow(NotFoundError);
  });

  it('lanza ForbiddenError si el conductor no es el dueño del viaje', async () => {
    mockTripFindById.mockResolvedValue({ ...mockTrip, driver_id: 'otro-driver' });

    await expect(TripService.completeTrip('trip-uuid', 'driver-uuid')).rejects.toThrow(ForbiddenError);
  });

  it('lanza ConflictError si el viaje ya está completado', async () => {
    mockTripFindById.mockResolvedValue({ ...mockTrip, status: 'completed' });

    await expect(TripService.completeTrip('trip-uuid', 'driver-uuid')).rejects.toThrow(ConflictError);
  });

  it('completa el viaje cuando el conductor es el dueño y está activo', async () => {
    mockTripFindById.mockResolvedValue(mockTrip);
    mockRouteFindById.mockResolvedValue(mockRoute);
    mockTripUpdateStatus.mockResolvedValue({ ...mockTrip, status: 'completed', ended_at: new Date() });

    const result = await TripService.completeTrip('trip-uuid', 'driver-uuid');

    expect(mockTripUpdateStatus).toHaveBeenCalledWith('trip-uuid', 'completed', expect.any(Date));
    expect(result.status).toBe('completed');
  });
});

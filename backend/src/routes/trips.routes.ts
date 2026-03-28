import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { TripController } from '../controllers/trip.controller';
import { PositionController } from '../controllers/position.controller';
import { USER_ROLE, TRIP_ACTION, TRIP_TIPO } from '../shared/types';

const router = Router();

const createTripSchema = z.object({
  body: z.object({
    routeId:            z.string().uuid(),
    driverId:           z.string().uuid().optional(),
    vehicleId:          z.string().uuid().nullable().optional(),
    cantidadPasajeros:  z.number().int().positive().nullable().optional(),
  }),
});

const updateTripSchema = z.object({
  body: z.object({
    action: z.enum([TRIP_ACTION.COMPLETE, TRIP_ACTION.CANCEL]),
  }),
});

const ingestPositionSchema = z.object({
  body: z.object({
    lat:       z.number().min(-90).max(90),
    lng:       z.number().min(-180).max(180),
    speed:     z.number().positive().optional(),
    timestamp: z.string().datetime(),
  }),
});

router.post(
  '/',
  validate(createTripSchema),
  authenticate,
  requireRole([USER_ROLE.DRIVER, USER_ROLE.ADMIN]),
  TripController.start,
);

const scheduleTripSchema = z.object({
  body: z.object({
    routeId:                   z.string().uuid(),
    driverId:                  z.string().uuid(),
    vehicleId:                 z.string().uuid().nullable().optional(),
    tipoViaje:                 z.enum([TRIP_TIPO.IDA_VUELTA, TRIP_TIPO.ESPERA]),
    scheduledDeparture:        z.string().datetime(),
    scheduledReturn:           z.string().datetime().nullable().optional(),
    duracionActividadMinutos:  z.number().int().positive().nullable().optional(),
    cantidadPasajeros:         z.number().int().positive().nullable().optional(),
  }),
});

router.get('/', authenticate, TripController.list);

router.post(
  '/schedule',
  validate(scheduleTripSchema),
  authenticate,
  requireRole([USER_ROLE.ADMIN]),
  TripController.schedule,
);

router.get('/mine', authenticate, TripController.myTrips);

router.get('/positions/latest', authenticate, PositionController.latestPerActiveTrip);

const rescheduleSchema = z.object({
  body: z.object({
    tipoViaje:                z.enum([TRIP_TIPO.IDA_VUELTA, TRIP_TIPO.ESPERA]),
    scheduledDeparture:       z.string().datetime(),
    scheduledReturn:          z.string().datetime().nullable().optional(),
    duracionActividadMinutos: z.number().int().positive().nullable().optional(),
    cantidadPasajeros:        z.number().int().positive().nullable().optional(),
  }),
});

router.patch(
  '/:id/schedule',
  validate(rescheduleSchema),
  authenticate,
  requireRole([USER_ROLE.ADMIN]),
  TripController.reschedule,
);

router.patch(
  '/:id',
  validate(updateTripSchema),
  authenticate,
  TripController.update,
);

router.get('/:tripId/positions', authenticate, PositionController.getTripHistory);

router.post(
  '/:tripId/positions',
  validate(ingestPositionSchema),
  authenticate,
  requireRole([USER_ROLE.DRIVER, USER_ROLE.ADMIN]),
  PositionController.create,
);

export default router;

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { TripService } from '../services/trip.service';
import { ValidationError } from '../shared/errors/app.error';
import { TRIP_ACTION, TRIP_TIPO } from '../shared/types';

export const TripController = {
  async start(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const driverId = req.body.driverId ?? req.user!.sub;
      const trip = await TripService.startTrip(driverId, req.body);
      res.status(201).json({ status: 'success', data: trip });
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action } = req.body as { action: string };
      const tripId = req.params.id;
      const driverId = req.user!.sub;

      let trip;
      const role = req.user!.role;
      if (action === TRIP_ACTION.COMPLETE) {
        trip = await TripService.completeTrip(tripId, driverId, role);
      } else if (action === TRIP_ACTION.CANCEL) {
        trip = await TripService.cancelTrip(tripId, driverId, role);
      } else {
        throw new ValidationError(`Acción inválida: ${action}`);
      }

      res.json({ status: 'success', data: trip });
    } catch (err) {
      next(err);
    }
  },

  async list(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const trips = await TripService.getAllTrips();
      res.json({ status: 'success', data: trips });
    } catch (err) {
      next(err);
    }
  },

  async schedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await TripService.scheduleTrip(req.body);
      res.status(201).json({ status: 'success', data: trip });
    } catch (err) {
      next(err);
    }
  },

  async reschedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await TripService.updateScheduledTrip(req.params.id, req.body);
      res.json({ status: 'success', data: trip });
    } catch (err) {
      next(err);
    }
  },

  async myTrips(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const trips = await TripService.getDriverActiveTrips(req.user!.sub);
      res.json({ status: 'success', data: trips });
    } catch (err) {
      next(err);
    }
  },
};

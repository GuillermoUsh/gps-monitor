import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { PositionService } from '../services/position.service';
import { TripPositionRepository } from '../repositories/trip-position.repository';
import { TripRepository } from '../repositories/trip.repository';
import { NotFoundError } from '../shared/errors/app.error';

const positionRepo = new TripPositionRepository();
const tripRepo     = new TripRepository();

export const PositionController = {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const position = await PositionService.ingest(
        req.params.tripId,
        req.user!.sub,
        req.body,
      );
      res.status(201).json({ status: 'success', data: position });
    } catch (err) {
      next(err);
    }
  },

  async latestPerActiveTrip(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const positions = await positionRepo.findLatestPerActiveTrip();
      res.json({ status: 'success', data: positions });
    } catch (err) {
      next(err);
    }
  },

  async getTripHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tripId } = req.params;

      const trip = await tripRepo.findById(tripId);
      if (!trip) {
        throw new NotFoundError(`Trip with id '${tripId}' not found`);
      }

      const positions = await positionRepo.findByTripId(tripId);

      const totalPositions = positions.length;
      const deviationCount = positions.filter(p => p.isDeviation).length;
      const speeds = positions.map(p => p.speedKmh).filter((s): s is number => s !== null);
      const maxSpeedKmh  = speeds.length > 0 ? Math.max(...speeds) : null;
      const avgSpeedKmh  = speeds.length > 0
        ? Math.round((speeds.reduce((sum, s) => sum + s, 0) / speeds.length) * 10) / 10
        : null;

      res.json({
        status: 'success',
        data: {
          positions,
          stats: { totalPositions, deviationCount, maxSpeedKmh, avgSpeedKmh },
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

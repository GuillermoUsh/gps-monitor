import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { PositionService } from '../services/position.service';
import { TripPositionRepository } from '../repositories/trip-position.repository';

const positionRepo = new TripPositionRepository();

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
};

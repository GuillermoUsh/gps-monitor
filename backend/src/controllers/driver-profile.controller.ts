import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { DriverProfileService } from '../services/driver-profile.service';

export const DriverProfileController = {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await DriverProfileService.create(req.body);
      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  },

  async list(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profiles = await DriverProfileService.list();
      res.json({ status: 'success', data: profiles });
    } catch (err) {
      next(err);
    }
  },

  async upsert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await DriverProfileService.upsert(req.params.userId, req.body);
      res.json({ status: 'success', data: profile });
    } catch (err) {
      next(err);
    }
  },
};

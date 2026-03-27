import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AlertRepository } from '../repositories/alert.repository';

const alertRepository = new AlertRepository();

export const AlertController = {
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = parseInt((req.query['days'] as string) ?? '30', 10);
      const alerts = await alertRepository.findExpiring(days);
      res.json({ status: 'success', data: alerts });
    } catch (err) {
      next(err);
    }
  },
};

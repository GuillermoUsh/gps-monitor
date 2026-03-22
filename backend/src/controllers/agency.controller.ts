import { Request, Response, NextFunction } from 'express';
import { AgencyService } from '../services/agency.service';

export const AgencyController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, slug, adminEmail, adminPassword } = req.body;
      const result = await AgencyService.create(name, slug, adminEmail, adminPassword);
      res.status(201).json({
        status: 'success',
        data: { agencyId: result.agencyId },
        message: 'Agencia creada. Revisá tu email para verificar la cuenta.',
      });
    } catch (err) {
      next(err);
    }
  },
};

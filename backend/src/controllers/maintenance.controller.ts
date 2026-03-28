import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { MaintenanceService } from '../services/maintenance.service';

export const MaintenanceController = {
  async listByVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const maintenances = await MaintenanceService.listByVehicle(req.params.vehicleId);
      res.json({ status: 'success', data: maintenances });
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const maintenance = await MaintenanceService.create(req.params.vehicleId, req.body);
      res.status(201).json({ status: 'success', data: maintenance });
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const maintenance = await MaintenanceService.update(req.params.id, req.body);
      res.json({ status: 'success', data: maintenance });
    } catch (err) {
      next(err);
    }
  },
};

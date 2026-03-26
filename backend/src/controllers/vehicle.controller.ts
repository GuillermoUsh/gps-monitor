import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { VehicleService } from '../services/vehicle.service';

export const VehicleController = {
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { estado, search } = req.query as { estado?: string; search?: string };
      const vehicles = await VehicleService.list({ estado, search });
      res.json({ status: 'success', data: vehicles });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const vehicle = await VehicleService.getById(req.params.id);
      res.json({ status: 'success', data: vehicle });
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const vehicle = await VehicleService.create(req.body);
      res.status(201).json({ status: 'success', data: vehicle });
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const vehicle = await VehicleService.update(req.params.id, req.body);
      res.json({ status: 'success', data: vehicle });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await VehicleService.delete(req.params.id);
      res.json({ status: 'success', data: null });
    } catch (err) {
      next(err);
    }
  },

  async dashboard(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await VehicleService.getDashboardStats();
      res.json({ status: 'success', data: stats });
    } catch (err) {
      next(err);
    }
  },

  async assign(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { driverId, notes } = req.body as { driverId: string; notes?: string };
      const assignment = await VehicleService.assign(req.params.id, driverId, notes);
      res.status(201).json({ status: 'success', data: assignment });
    } catch (err) {
      next(err);
    }
  },

  async unassign(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignment = await VehicleService.unassign(req.params.id);
      res.json({ status: 'success', data: assignment });
    } catch (err) {
      next(err);
    }
  },
};

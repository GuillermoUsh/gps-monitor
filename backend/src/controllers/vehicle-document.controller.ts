import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { VehicleDocumentService } from '../services/vehicle-document.service';

export const VehicleDocumentController = {
  async listByVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const documents = await VehicleDocumentService.listByVehicle(req.params.vehicleId);
      res.json({ status: 'success', data: documents });
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const document = await VehicleDocumentService.create(req.params.vehicleId, req.body);
      res.status(201).json({ status: 'success', data: document });
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const document = await VehicleDocumentService.update(req.params.id, req.body);
      res.json({ status: 'success', data: document });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await VehicleDocumentService.delete(req.params.id);
      res.json({ status: 'success', data: null });
    } catch (err) {
      next(err);
    }
  },
};

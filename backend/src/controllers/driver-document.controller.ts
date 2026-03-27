import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { DriverDocumentRepository } from '../repositories/driver-document.repository';

const repo = new DriverDocumentRepository();

export const DriverDocumentController = {
  async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const docs = await repo.findByDriverId(req.params['driverProfileId']);
      res.json({ status: 'success', data: docs });
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await repo.create({ driver_id: req.params['driverProfileId'], ...req.body });
      res.status(201).json({ status: 'success', data: doc });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await repo.delete(req.params['docId']);
      res.json({ status: 'success', data: null });
    } catch (err) {
      next(err);
    }
  },
};

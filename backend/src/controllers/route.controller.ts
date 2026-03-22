import { Request, Response, NextFunction } from 'express';
import { RouteService } from '../services/route.service';

export const RouteController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const route = await RouteService.createRoute(req.body);
      res.status(201).json({ status: 'success', data: route });
    } catch (err) {
      next(err);
    }
  },

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const routes = await RouteService.getRoutes();
      res.json({ status: 'success', data: routes });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const route = await RouteService.getRouteById(req.params.id);
      res.json({ status: 'success', data: route });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await RouteService.deleteRoute(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { RouteController } from '../controllers/route.controller';
import { USER_ROLE } from '../shared/types';

const router = Router();

const waypointSchema = z.object({
  lat:   z.number().min(-90).max(90),
  lng:   z.number().min(-180).max(180),
  order: z.number().int().positive(),
});

const createRouteSchema = z.object({
  body: z.object({
    name:        z.string().min(2).max(150),
    origin:      z.string().min(2).max(150),
    destination: z.string().min(2).max(150),
    waypoints:   z.array(waypointSchema).min(2),
  }),
});

router.post(
  '/',
  validate(createRouteSchema),
  authenticate,
  requireRole([USER_ROLE.ADMIN]),
  RouteController.create,
);

router.get('/', authenticate, RouteController.list);

router.get('/:id', authenticate, RouteController.getById);

router.delete(
  '/:id',
  authenticate,
  requireRole([USER_ROLE.ADMIN]),
  RouteController.remove,
);

export default router;

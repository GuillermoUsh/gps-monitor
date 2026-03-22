import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { UsersController } from '../controllers/users.controller';
import { USER_ROLE } from '../shared/types';

const router = Router();

const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['driver', 'mechanic', 'administration', 'sales']),
  }),
});

router.get('/', authenticate, requireRole([USER_ROLE.ADMIN]), UsersController.list);
router.post('/', validate(createUserSchema), authenticate, requireRole([USER_ROLE.ADMIN]), UsersController.create);

export default router;

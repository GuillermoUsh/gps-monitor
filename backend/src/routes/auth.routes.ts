import { Router } from 'express';
import { z } from 'zod';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'El password debe tener al menos 8 caracteres'),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword:     z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
  }),
});

router.post('/register', validate(registerSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', authenticate, AuthController.logout);
router.post('/change-password', validate(changePasswordSchema), authenticate, AuthController.changePassword);

export default router;

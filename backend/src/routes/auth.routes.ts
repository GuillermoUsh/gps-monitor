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

const resendSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

router.post('/register', validate(registerSchema), AuthController.register);
router.get('/verify-email', AuthController.verifyEmail);
router.post('/resend-verification', validate(resendSchema), AuthController.resendVerification);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', authenticate, AuthController.logout);

export default router;

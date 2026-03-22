import { Router } from 'express';
import { z } from 'zod';
import { AgencyController } from '../controllers/agency.controller';
import { validate } from '../middleware/validation.middleware';

const router = Router();

const createAgencySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    slug: z.string().min(3, 'El slug debe tener al menos 3 caracteres').max(30),
    adminEmail: z.string().email('Email inválido'),
    adminPassword: z.string().min(8, 'El password debe tener al menos 8 caracteres'),
  }),
});

router.post('/', validate(createAgencySchema), AgencyController.register);

export default router;

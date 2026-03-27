import { Router } from 'express';
import { z } from 'zod';
import { validate }    from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole }  from '../middleware/role.middleware';
import { USER_ROLE }    from '../shared/types';
import { VehicleController }         from '../controllers/vehicle.controller';
import { DriverProfileController }   from '../controllers/driver-profile.controller';
import { VehicleDocumentController } from '../controllers/vehicle-document.controller';
import { MaintenanceController }     from '../controllers/maintenance.controller';
import { AlertController }           from '../controllers/alert.controller';
import { DriverDocumentController }  from '../controllers/driver-document.controller';

const router = Router();

// All fleet routes require authentication
router.use(authenticate);

// ── Vehicle schemas ───────────────────────────────────────────────────────────

const createVehicleSchema = z.object({
  body: z.object({
    marca:                z.string().min(1),
    modelo:               z.string().min(1),
    patente:              z.string().min(1),
    anio:                 z.number().int().positive().optional().nullable(),
    vin:                  z.string().optional().nullable(),
    numero_motor:         z.string().optional().nullable(),
    tipo:                 z.string().optional().nullable(),
    color:                z.string().optional().nullable(),
    capacidad_pasajeros:  z.number().int().positive().optional().nullable(),
    estado:               z.enum(['disponible', 'en_uso', 'en_mantenimiento', 'fuera_de_servicio']).optional(),
    kilometraje:          z.number().int().min(0).optional(),
    notas:                z.string().optional().nullable(),
  }),
});

const updateVehicleSchema = z.object({
  body: z.object({
    marca:                z.string().min(1).optional(),
    modelo:               z.string().min(1).optional(),
    patente:              z.string().min(1).optional(),
    anio:                 z.number().int().positive().optional().nullable(),
    vin:                  z.string().optional().nullable(),
    numero_motor:         z.string().optional().nullable(),
    tipo:                 z.string().optional().nullable(),
    color:                z.string().optional().nullable(),
    capacidad_pasajeros:  z.number().int().positive().optional().nullable(),
    estado:               z.enum(['disponible', 'en_uso', 'en_mantenimiento', 'fuera_de_servicio']).optional(),
    kilometraje:          z.number().int().min(0).optional(),
    notas:                z.string().optional().nullable(),
  }),
});

const assignSchema = z.object({
  body: z.object({
    driverId: z.string().uuid(),
    notes:    z.string().optional(),
  }),
});

// ── Driver profile schemas ────────────────────────────────────────────────────

const createDriverProfileSchema = z.object({
  body: z.object({
    nombre:               z.string().min(1),
    apellido:             z.string().min(1),
    email:                z.string().email(),
    telefono:             z.string().optional().nullable(),
    licencia:             z.string().optional().nullable(),
    vencimiento_licencia: z.string().optional().nullable(),
  }),
});

const upsertDriverProfileSchema = z.object({
  body: z.object({
    licencia:             z.string().min(1).optional().nullable(),
    vencimiento_licencia: z.string().optional().nullable(),
    telefono:             z.string().optional().nullable(),
    nombre:               z.string().optional().nullable(),
    apellido:             z.string().optional().nullable(),
    curso_puerto:         z.boolean().optional(),
    notas:                z.string().optional().nullable(),
  }),
});

// ── Driver document schemas ────────────────────────────────────────────────────

const createDriverDocumentSchema = z.object({
  body: z.object({
    tipo:              z.string().min(1),
    descripcion:       z.string().optional().nullable(),
    fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  }),
});

// ── Vehicle document schemas ──────────────────────────────────────────────────

const createDocumentSchema = z.object({
  body: z.object({
    tipo:              z.enum(['seguro', 'vtv', 'habilitacion_turistica', 'otro']),
    descripcion:       z.string().optional().nullable(),
    fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  }),
});

const updateDocumentSchema = z.object({
  body: z.object({
    tipo:              z.enum(['seguro', 'vtv', 'habilitacion_turistica', 'otro']).optional(),
    descripcion:       z.string().optional().nullable(),
    fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
  }),
});

// ── Maintenance schemas ───────────────────────────────────────────────────────

const createMaintenanceSchema = z.object({
  body: z.object({
    tipo:                  z.string().min(1),
    descripcion:           z.string().optional().nullable(),
    fecha:                 z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
    kilometraje:           z.number().int().min(0).optional().nullable(),
    proximo_service_km:    z.number().int().min(0).optional().nullable(),
    proximo_service_fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional().nullable(),
  }),
});

// ── Vehicle routes ────────────────────────────────────────────────────────────

router.get('/vehicles/dashboard', VehicleController.dashboard);

router.get('/vehicles',     VehicleController.list);
router.get('/vehicles/:id', VehicleController.getById);

router.post(
  '/vehicles',
  requireRole([USER_ROLE.ADMIN]),
  validate(createVehicleSchema),
  VehicleController.create,
);

router.patch(
  '/vehicles/:id',
  requireRole([USER_ROLE.ADMIN]),
  validate(updateVehicleSchema),
  VehicleController.update,
);

router.delete(
  '/vehicles/:id',
  requireRole([USER_ROLE.ADMIN]),
  VehicleController.delete,
);

router.post(
  '/vehicles/:id/assign',
  requireRole([USER_ROLE.ADMIN]),
  validate(assignSchema),
  VehicleController.assign,
);

router.post(
  '/vehicles/:id/unassign',
  requireRole([USER_ROLE.ADMIN]),
  VehicleController.unassign,
);

// ── Driver profile routes ─────────────────────────────────────────────────────

router.get('/drivers', DriverProfileController.list);

router.post(
  '/drivers',
  requireRole([USER_ROLE.ADMIN]),
  validate(createDriverProfileSchema),
  DriverProfileController.create,
);

router.put(
  '/drivers/:userId',
  requireRole([USER_ROLE.ADMIN]),
  validate(upsertDriverProfileSchema),
  DriverProfileController.upsert,
);

// ── Vehicle document routes ───────────────────────────────────────────────────

router.get('/vehicles/:vehicleId/documents', VehicleDocumentController.listByVehicle);

router.post(
  '/vehicles/:vehicleId/documents',
  requireRole([USER_ROLE.ADMIN]),
  validate(createDocumentSchema),
  VehicleDocumentController.create,
);

router.patch(
  '/documents/:id',
  requireRole([USER_ROLE.ADMIN]),
  validate(updateDocumentSchema),
  VehicleDocumentController.update,
);

router.delete(
  '/documents/:id',
  requireRole([USER_ROLE.ADMIN]),
  VehicleDocumentController.delete,
);

// ── Alert routes ──────────────────────────────────────────────────────────────

router.get('/alerts', AlertController.list);

// ── Driver document routes ────────────────────────────────────────────────────

router.get('/drivers/:driverProfileId/documents', DriverDocumentController.list);

router.post(
  '/drivers/:driverProfileId/documents',
  requireRole([USER_ROLE.ADMIN]),
  validate(createDriverDocumentSchema),
  DriverDocumentController.create,
);

router.delete(
  '/drivers/documents/:docId',
  requireRole([USER_ROLE.ADMIN]),
  DriverDocumentController.delete,
);

// ── Maintenance routes ────────────────────────────────────────────────────────

router.get('/vehicles/:vehicleId/maintenances', MaintenanceController.listByVehicle);

router.post(
  '/vehicles/:vehicleId/maintenances',
  requireRole([USER_ROLE.ADMIN]),
  validate(createMaintenanceSchema),
  MaintenanceController.create,
);

export default router;

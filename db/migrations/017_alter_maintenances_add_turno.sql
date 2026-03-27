ALTER TABLE maintenances ADD COLUMN IF NOT EXISTS turno_fecha DATE;
ALTER TABLE maintenances ADD COLUMN IF NOT EXISTS turno_descripcion VARCHAR(200);

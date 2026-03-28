-- Agrega duración estimada de un tramo (minutos) a las rutas
ALTER TABLE routes ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER;

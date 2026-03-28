-- Agrega campos de programación de viajes
-- tipo_viaje: 'ida_vuelta' (vuelve a buscar) | 'espera' (espera en destino)
-- scheduled_departure: hora de salida programada
-- scheduled_return: (ida_vuelta) hora programada para ir a buscar pasajeros
-- duracion_actividad_minutos: (espera) duración de la actividad/excursión

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS tipo_viaje               VARCHAR(20),
  ADD COLUMN IF NOT EXISTS scheduled_departure      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_return         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duracion_actividad_minutos INTEGER;

CREATE INDEX IF NOT EXISTS idx_trips_scheduled_departure ON trips(scheduled_departure)
  WHERE scheduled_departure IS NOT NULL;

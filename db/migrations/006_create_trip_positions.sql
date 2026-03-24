CREATE TABLE IF NOT EXISTS trip_positions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  speed_kmh   NUMERIC(6,2),
  is_deviation BOOLEAN    NOT NULL DEFAULT FALSE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_positions_trip ON trip_positions(trip_id);

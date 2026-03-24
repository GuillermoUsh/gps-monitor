CREATE TABLE trip_positions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  speed_kmh        DOUBLE PRECISION,
  is_deviation     BOOLEAN NOT NULL DEFAULT FALSE,
  deviation_meters DOUBLE PRECISION,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trip_positions_trip_id     ON trip_positions (trip_id);
CREATE INDEX idx_trip_positions_recorded_at ON trip_positions (trip_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS trips (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id    UUID        NOT NULL REFERENCES routes(id),
  driver_id   UUID        NOT NULL REFERENCES users(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  distance_km NUMERIC(10,3) NOT NULL DEFAULT 0,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

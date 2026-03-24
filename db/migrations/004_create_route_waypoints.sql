CREATE TABLE IF NOT EXISTS route_waypoints (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  lat      DOUBLE PRECISION NOT NULL,
  lng      DOUBLE PRECISION NOT NULL,
  "order"  INTEGER NOT NULL,
  UNIQUE(route_id, "order")
);
CREATE INDEX IF NOT EXISTS idx_waypoints_route ON route_waypoints(route_id);

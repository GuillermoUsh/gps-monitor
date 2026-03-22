CREATE TABLE route_waypoints (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id  UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  lat       DOUBLE PRECISION NOT NULL,
  lng       DOUBLE PRECISION NOT NULL,
  "order"   INTEGER NOT NULL,
  position  GEOGRAPHY(POINT, 4326) NOT NULL,
  CONSTRAINT uq_route_waypoint_order UNIQUE (route_id, "order")
);
CREATE INDEX idx_route_waypoints_route_id ON route_waypoints (route_id);
CREATE INDEX idx_route_waypoints_position ON route_waypoints USING GIST (position);

CREATE TABLE IF NOT EXISTS routes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) UNIQUE NOT NULL,
  origin      VARCHAR(150) NOT NULL,
  destination VARCHAR(150) NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

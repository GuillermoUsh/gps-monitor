CREATE TABLE IF NOT EXISTS users (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email                       VARCHAR(255) UNIQUE NOT NULL,
  password_hash               TEXT         NOT NULL,
  role                        VARCHAR(30)  NOT NULL DEFAULT 'admin',
  verified                    BOOLEAN      NOT NULL DEFAULT FALSE,
  verification_token          TEXT,
  verification_token_expires  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

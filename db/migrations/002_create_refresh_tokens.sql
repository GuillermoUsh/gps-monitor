CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   TEXT        UNIQUE NOT NULL,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family       UUID        NOT NULL,
  used         BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash   ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family);

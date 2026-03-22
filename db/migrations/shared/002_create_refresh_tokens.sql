CREATE TABLE IF NOT EXISTS shared.refresh_tokens (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash     TEXT        NOT NULL,
  user_id        UUID        NOT NULL,
  tenant_schema  VARCHAR(60) NOT NULL,
  family         UUID        NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  used           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON shared.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family     ON shared.refresh_tokens(family);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON shared.refresh_tokens(user_id);

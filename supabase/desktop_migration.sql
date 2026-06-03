-- ── Desktop tokens ─────────────────────────────────────────────────────────────
-- Cada usuario puede tener un token activo para conectar MeetBox Desktop.
-- El token tiene formato MBOX-XXXXXXXX (8 hex chars uppercase).

CREATE TABLE IF NOT EXISTS desktop_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS desktop_tokens_user_id_idx ON desktop_tokens(user_id);

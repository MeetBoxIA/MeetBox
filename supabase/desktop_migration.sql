-- ── Desktop tokens (DEPRECATED) ──────────────────────────────────────────────
-- Superseded by `desktop_sessions` in desktop_pipeline_migration.sql, which is
-- what src/lib/desktop-auth.ts actually reads/writes today. Nothing in the
-- codebase queries `desktop_tokens` anymore. Kept only for installs that
-- already ran this file — do not run on new installs.

CREATE TABLE IF NOT EXISTS desktop_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS desktop_tokens_user_id_idx ON desktop_tokens(user_id);

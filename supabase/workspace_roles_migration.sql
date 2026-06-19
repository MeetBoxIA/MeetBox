-- ─────────────────────────────────────────────────────────────────────────────
-- Workspace roles migration
-- Ejecuta en Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Añadir columna role a room_members
ALTER TABLE room_members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('owner', 'admin', 'member', 'guest'));

-- 2. Tabla de invitaciones a workspaces
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id     UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'member'
              CHECK (role IN ('admin', 'member', 'guest')),
  token       TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_invitations_room_idx  ON workspace_invitations(room_id);
CREATE INDEX IF NOT EXISTS workspace_invitations_email_idx ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS workspace_invitations_token_idx ON workspace_invitations(token);

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON workspace_invitations USING (true) WITH CHECK (true);

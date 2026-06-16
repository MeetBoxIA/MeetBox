-- ═══════════════════════════════════════════════════════════════════════════
-- Zoom OAuth — columnas en la tabla users
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS zoom_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS zoom_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS zoom_token_expiry  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS zoom_user_id       TEXT,
  ADD COLUMN IF NOT EXISTS zoom_email         TEXT;

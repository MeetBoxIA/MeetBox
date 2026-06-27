-- ═══════════════════════════════════════════════════════════════════════════
-- DEPRECATED: Zoom ya no usa OAuth por usuario, sino Server-to-Server OAuth
-- configurado a nivel de cuenta vía variables de entorno (ZOOM_ACCOUNT_ID,
-- ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_USER_EMAIL). Estas columnas ya no
-- se leen ni se escriben desde la aplicación — se deja este archivo solo por
-- compatibilidad con instalaciones que ya lo ejecutaron. No ejecutar en
-- instalaciones nuevas.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS zoom_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS zoom_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS zoom_token_expiry  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS zoom_user_id       TEXT,
  ADD COLUMN IF NOT EXISTS zoom_email         TEXT;

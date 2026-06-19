-- ─────────────────────────────────────────────────────────────────────────────
-- Workspace scope migration
-- Añade room_id a reminders y notebooks para separar datos por workspace.
-- Ejecuta en Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_room ON reminders(room_id)
  WHERE room_id IS NOT NULL;

ALTER TABLE notebooks
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notebooks_room ON notebooks(room_id)
  WHERE room_id IS NOT NULL;

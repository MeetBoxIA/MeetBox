-- Vincula meet_action_sessions a una sala (rooms) para poder analizar
-- la coincidencia entre personas mencionadas en la reunión y miembros de la sala.
ALTER TABLE meet_action_sessions
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meet_action_sessions_room ON meet_action_sessions(room_id)
  WHERE room_id IS NOT NULL;

-- Rooms migration — run in Supabase Dashboard → SQL Editor

-- ── Rooms ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  color       TEXT        NOT NULL DEFAULT '#050040',
  emoji       TEXT        NOT NULL DEFAULT '🏢',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rooms_user_id_idx ON rooms(user_id);
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON rooms USING (true) WITH CHECK (true);

-- ── Link meetings to rooms ─────────────────────────────────────────────────────
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS calendar_events_room_id_idx ON calendar_events(room_id) WHERE room_id IS NOT NULL;

-- ── Meeting attendees ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_attendees (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_event_id UUID        NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  email             TEXT        NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meeting_attendees_event_idx ON meeting_attendees(calendar_event_id);
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON meeting_attendees USING (true) WITH CHECK (true);

-- ── Room members (personas de la sala) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id    UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS room_members_room_idx ON room_members(room_id);
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON room_members USING (true) WITH CHECK (true);

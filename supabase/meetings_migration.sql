-- Meetings section migration — run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS meeting_recordings (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id     UUID        REFERENCES calendar_events(id) ON DELETE SET NULL,
  title        TEXT        NOT NULL,
  file_name    TEXT        NOT NULL,
  file_size    BIGINT,
  mime_type    TEXT,
  storage_path TEXT,
  status       TEXT        NOT NULL DEFAULT 'ready',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meeting_recordings_user_idx  ON meeting_recordings(user_id);
CREATE INDEX IF NOT EXISTS meeting_recordings_event_idx ON meeting_recordings(event_id) WHERE event_id IS NOT NULL;

ALTER TABLE meeting_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON meeting_recordings USING (true) WITH CHECK (true);

-- Supabase Storage: create a bucket named "recordings" in Storage settings
-- (Dashboard → Storage → New bucket → name: "recordings", public: false)

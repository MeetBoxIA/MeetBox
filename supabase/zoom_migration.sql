-- Zoom integration migration
-- Run in: Supabase Dashboard -> SQL Editor -> New query

-- Add Zoom columns to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT UNIQUE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS zoom_join_url    TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS zoom_status      TEXT
  CHECK (zoom_status IN ('created','recording_ready','processing','processed','failed'));

CREATE INDEX IF NOT EXISTS calendar_events_zoom_meeting_id_idx ON calendar_events(zoom_meeting_id)
  WHERE zoom_meeting_id IS NOT NULL;

-- Table to track incoming Zoom webhook events (audit trail)
CREATE TABLE IF NOT EXISTS zoom_webhook_events (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type      TEXT        NOT NULL,
  zoom_meeting_id TEXT,
  payload         JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received','processing','processed','failed')),
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS zoom_webhook_events_type_idx  ON zoom_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS zoom_webhook_events_meeting_idx ON zoom_webhook_events(zoom_meeting_id)
  WHERE zoom_meeting_id IS NOT NULL;

ALTER TABLE zoom_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON zoom_webhook_events USING (true) WITH CHECK (true);

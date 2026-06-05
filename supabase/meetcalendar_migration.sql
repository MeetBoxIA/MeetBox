-- MeetCalendar migration
-- Run in: Supabase Dashboard → SQL Editor → New query

-- Add Google OAuth token columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expiry  TIMESTAMPTZ;

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  description     TEXT,
  location        TEXT,
  type            TEXT        NOT NULL DEFAULT 'meeting',  -- 'meeting' | 'event' | 'reminder'
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  all_day         BOOLEAN     NOT NULL DEFAULT false,
  color           TEXT        NOT NULL DEFAULT '#050040',
  notify_email    BOOLEAN     NOT NULL DEFAULT false,
  notify_minutes  INTEGER     NOT NULL DEFAULT 15,
  google_event_id TEXT        UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calendar_events_user_id_idx       ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS calendar_events_start_at_idx      ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS calendar_events_google_event_id_idx ON calendar_events(google_event_id)
  WHERE google_event_id IS NOT NULL;

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON calendar_events USING (true) WITH CHECK (true);

-- Share token for public calendar link
ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_share_token TEXT UNIQUE;

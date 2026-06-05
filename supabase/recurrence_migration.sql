-- Recurrence support for calendar events
-- Run in: Supabase Dashboard → SQL Editor → New query

-- Recurrence rule columns
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_freq  TEXT;        -- NULL | 'daily' | 'weekly'
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_days  SMALLINT[];  -- 0=Mon, 1=Tue, ..., 6=Sun (used for 'weekly')
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ; -- NULL = never ends

-- Useful for expansion queries that span large ranges
CREATE INDEX IF NOT EXISTS calendar_events_recurrence_idx
  ON calendar_events(user_id, recurrence_freq)
  WHERE recurrence_freq IS NOT NULL;

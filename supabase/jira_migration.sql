-- Jira OAuth2 integration migration
-- Run in: Supabase Dashboard → SQL Editor → New query

-- Add Jira OAuth token columns to users (mirrors google_* columns)
ALTER TABLE users ADD COLUMN IF NOT EXISTS jira_access_token   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS jira_refresh_token  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS jira_token_expiry   TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS jira_cloud_id       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS jira_site_url       TEXT;

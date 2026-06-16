-- Notion OAuth integration migration
-- Run in: Supabase Dashboard → SQL Editor → New query

-- Add Notion OAuth token columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_access_token   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_workspace_id   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_workspace_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_bot_id         TEXT;

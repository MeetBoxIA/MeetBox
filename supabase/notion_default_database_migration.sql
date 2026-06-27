-- Notion auto-provisioned database migration
-- Run in: Supabase Dashboard → SQL Editor → New query
--
-- Stores the id of the "MeetBox · Acciones" database MeetBox auto-creates
-- for a user when they haven't shared any usable database with the
-- integration (only Notion's special "People" collection, or none at all).

ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_default_database_id TEXT;

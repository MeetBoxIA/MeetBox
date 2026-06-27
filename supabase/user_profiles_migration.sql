-- ═══════════════════════════════════════════════════════════════════════════
-- user_profiles — onboarding data + per-user integration toggle list
--
-- This table was previously created ad-hoc directly in the Supabase dashboard
-- (never had a migration file), so a fresh install following the documented
-- migration order was missing it entirely — breaking /dashboard, /api/user/profile,
-- and the Slack integration callback, all of which depend on it.
--
-- `integrations` here is a simple list of integration IDs ("slack", "zoom", etc.)
-- used purely to render "connected" badges in the Integrations UI — it does NOT
-- store credentials (those live in `meeting_integrations.credentials_enc`, or
-- per-provider columns on `users` for Jira/Notion/Google Calendar).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  org_name      TEXT,
  team_size     TEXT,
  meeting_types TEXT[]      DEFAULT '{}',
  integrations  TEXT[]      DEFAULT '{}',
  onboarded_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles (user_id);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY "service_role_only" ON user_profiles USING (true) WITH CHECK (true);
  END IF;
END $$;

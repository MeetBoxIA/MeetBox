-- ═══════════════════════════════════════════════════════════════════════════
-- password_reset_tokens — persists password-reset tokens across requests.
--
-- Previously these lived in an in-process Map (src/lib/reset-token-store.ts).
-- In a serverless deployment (Vercel) the request that creates the token and
-- the request that validates it can land on different instances, so the
-- token would randomly appear "invalid" even though the user just clicked
-- the link from their email. Persisting in Supabase fixes this.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  email      TEXT        PRIMARY KEY,
  token      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'password_reset_tokens' AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY "service_role_only" ON password_reset_tokens USING (true) WITH CHECK (true);
  END IF;
END $$;

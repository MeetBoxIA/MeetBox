-- ═══════════════════════════════════════════════════════════════════════════
-- otp_codes — persists email-verification OTP codes across requests.
--
-- Same rationale as password_reset_tokens_migration.sql: the in-process Map
-- in src/lib/otp-store.ts does not survive across serverless instances or
-- redeploys, which can make "send code" / "verify code" intermittently fail
-- in production.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS otp_codes (
  email      TEXT        PRIMARY KEY,
  code       TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'otp_codes' AND policyname = 'service_role_only'
  ) THEN
    CREATE POLICY "service_role_only" ON otp_codes USING (true) WITH CHECK (true);
  END IF;
END $$;

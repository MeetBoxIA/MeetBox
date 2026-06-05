-- ═══════════════════════════════════════════════════════════════════════════
-- MeetBox — Desktop → Backend → MeetAction processing pipeline
--
-- This migration wires the full async pipeline that turns a recorded meeting
-- (uploaded from MeetBox Desktop) into a reviewable MeetAction session:
--
--   upload → transcribe → analyze → match calendar → create actions → review
--
-- It builds ON TOP of the existing meetaction_migration.sql (meet_action_*
-- tables) and meetings_migration.sql (meeting_recordings). Run those first.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. desktop_sessions ─────────────────────────────────────────────────────
-- Stateful bearer tokens for the desktop client (expiration / rotation /
-- revocation). The raw token is NEVER stored — only its SHA-256 hash.
-- Raw token format: mbox_live_<43-char base64url>.
CREATE TABLE IF NOT EXISTS desktop_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT        NOT NULL UNIQUE,         -- sha256(raw token)
  token_prefix    TEXT        NOT NULL,                -- first 12 chars, for display
  device_label    TEXT,                                -- e.g. "MacBook Pro · Chrome 120"
  platform        TEXT,                                -- darwin | win32 | linux
  app_version     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,                -- default 90 days
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,                         -- null = active
  rotated_from    UUID        REFERENCES desktop_sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_desktop_sessions_user      ON desktop_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_desktop_sessions_hash      ON desktop_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_desktop_sessions_active    ON desktop_sessions(user_id) WHERE revoked_at IS NULL;

-- ── 2. meeting_processing_jobs ──────────────────────────────────────────────
-- The state machine for one recording's processing lifecycle.
CREATE TABLE IF NOT EXISTS meeting_processing_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_id    UUID        NOT NULL REFERENCES meeting_recordings(id) ON DELETE CASCADE,
  desktop_session_id UUID     REFERENCES desktop_sessions(id) ON DELETE SET NULL,

  -- Correlation id ties every log line / event of one run together.
  correlation_id  TEXT        NOT NULL,

  status          TEXT        NOT NULL DEFAULT 'uploaded'
                    CHECK (status IN ('uploaded','queued','transcribing','analyzing',
                                      'matching_calendar','creating_actions','completed','failed')),
  progress_pct    SMALLINT    NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),

  -- Result pointers (filled as the pipeline advances)
  transcript_id   UUID,
  analysis_id     UUID,
  session_id      UUID,                                -- the created meet_action_sessions row

  attempts        SMALLINT    NOT NULL DEFAULT 0,
  last_error      TEXT,
  error_step      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_user        ON meeting_processing_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status      ON meeting_processing_jobs(status) WHERE status NOT IN ('completed','failed');
CREATE INDEX IF NOT EXISTS idx_jobs_recording   ON meeting_processing_jobs(recording_id);
CREATE INDEX IF NOT EXISTS idx_jobs_correlation ON meeting_processing_jobs(correlation_id);

-- ── 3. meeting_transcripts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_id      UUID        NOT NULL REFERENCES meeting_recordings(id) ON DELETE CASCADE,
  job_id            UUID        REFERENCES meeting_processing_jobs(id) ON DELETE SET NULL,

  full_text         TEXT        NOT NULL,
  language          TEXT,                              -- ISO 639-1, detected
  duration_seconds  INTEGER     CHECK (duration_seconds >= 0),
  word_count        INTEGER     DEFAULT 0,
  provider          TEXT        DEFAULT 'openai-whisper',
  -- Optional timestamped segments: [{ start, end, text, speaker }]
  segments          JSONB       DEFAULT '[]',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_recording ON meeting_transcripts(recording_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_user      ON meeting_transcripts(user_id, created_at DESC);

-- ── 4. meeting_analysis ─────────────────────────────────────────────────────
-- Parent record for one AI analysis run. Normalized children live in the
-- meeting_summaries / decisions / risks / mentions tables below.
CREATE TABLE IF NOT EXISTS meeting_analysis (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_id    UUID        NOT NULL REFERENCES meeting_recordings(id) ON DELETE CASCADE,
  transcript_id   UUID        REFERENCES meeting_transcripts(id) ON DELETE SET NULL,
  job_id          UUID        REFERENCES meeting_processing_jobs(id) ON DELETE SET NULL,

  model           TEXT        DEFAULT 'gpt-4o-mini',
  tokens_used     INTEGER,
  -- Counts (denormalized for quick display)
  tasks_count     SMALLINT    DEFAULT 0,
  decisions_count SMALLINT    DEFAULT 0,
  risks_count     SMALLINT    DEFAULT 0,
  mentions_count  SMALLINT    DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_recording ON meeting_analysis(recording_id);

-- ── 5. meeting_summaries ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_summaries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id   UUID        NOT NULL REFERENCES meeting_analysis(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary       TEXT        NOT NULL,
  headline      TEXT,                                  -- one-line TL;DR
  next_steps    TEXT[]      DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_summaries_analysis ON meeting_summaries(analysis_id);

-- ── 6. meeting_decisions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_decisions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id   UUID        NOT NULL REFERENCES meeting_analysis(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  detail        TEXT,
  decided_by    TEXT,                                  -- person name if attributed
  sort_order    SMALLINT    DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_decisions_analysis ON meeting_decisions(analysis_id, sort_order);

-- ── 7. meeting_risks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_risks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id   UUID        NOT NULL REFERENCES meeting_analysis(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  detail        TEXT,
  severity      TEXT        DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  owner_name    TEXT,
  sort_order    SMALLINT    DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risks_analysis ON meeting_risks(analysis_id, sort_order);

-- ── 8. meeting_mentions ─────────────────────────────────────────────────────
-- People mentioned in the meeting, with optional resolution to a real user
-- or room member by email.
CREATE TABLE IF NOT EXISTS meeting_mentions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id     UUID        NOT NULL REFERENCES meeting_analysis(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  email           TEXT,                                -- resolved if possible
  resolved_user_id UUID       REFERENCES users(id) ON DELETE SET NULL,
  mention_count   SMALLINT    DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mentions_analysis ON meeting_mentions(analysis_id);

-- ── 9. meeting_calendar_matches ─────────────────────────────────────────────
-- Candidate calendar events the recording might belong to, scored 0-100.
CREATE TABLE IF NOT EXISTS meeting_calendar_matches (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_id      UUID        NOT NULL REFERENCES meeting_recordings(id) ON DELETE CASCADE,
  calendar_event_id UUID        NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  score             SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 100),
  -- Breakdown of how the score was computed: { name, time, participants, content }
  score_breakdown   JSONB       DEFAULT '{}',
  is_selected       BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cal_matches_recording ON meeting_calendar_matches(recording_id, score DESC);

-- ── 10. meeting_integrations ────────────────────────────────────────────────
-- Per-user integration configuration & (encrypted) credentials used by the
-- Execution Center to dispatch approved actions.
CREATE TABLE IF NOT EXISTS meeting_integrations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT        NOT NULL
                    CHECK (provider IN ('jira','slack','notion','teams','meetcalendar','meetbook')),
  is_enabled      BOOLEAN     NOT NULL DEFAULT false,
  -- Non-secret config: { project_key, default_channel, database_id, ... }
  config          JSONB       DEFAULT '{}',
  -- Secrets are stored encrypted at rest (AES via app layer), never plaintext.
  credentials_enc TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_integrations_user ON meeting_integrations(user_id);

-- ── 11. meeting_events ──────────────────────────────────────────────────────
-- Append-only observability/audit log for the entire meeting lifecycle.
-- Also doubles as the source for Supabase Realtime fan-out to the web client.
CREATE TABLE IF NOT EXISTS meeting_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  correlation_id  TEXT        NOT NULL,
  job_id          UUID        REFERENCES meeting_processing_jobs(id) ON DELETE CASCADE,
  recording_id    UUID,
  session_id      UUID,

  -- Event name, e.g. meeting.processing.updated | meeting.analysis.completed
  --                   meeting.actions.created   | meeting.failed
  event_type      TEXT        NOT NULL,
  level           TEXT        NOT NULL DEFAULT 'info' CHECK (level IN ('debug','info','warn','error')),
  message         TEXT,
  payload         JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_user        ON meeting_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON meeting_events(correlation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_job         ON meeting_events(job_id, created_at);

-- ── 12. Link existing tables into the pipeline ──────────────────────────────
-- meet_action_sessions gains pointers to job/transcript/analysis so the
-- existing MeetAction UI can drill back into the pipeline data.
ALTER TABLE meet_action_sessions ADD COLUMN IF NOT EXISTS job_id        UUID REFERENCES meeting_processing_jobs(id) ON DELETE SET NULL;
ALTER TABLE meet_action_sessions ADD COLUMN IF NOT EXISTS transcript_id UUID REFERENCES meeting_transcripts(id)    ON DELETE SET NULL;
ALTER TABLE meet_action_sessions ADD COLUMN IF NOT EXISTS analysis_id   UUID REFERENCES meeting_analysis(id)       ON DELETE SET NULL;
ALTER TABLE meet_action_sessions ADD COLUMN IF NOT EXISTS correlation_id TEXT;

-- meeting_recordings gains processing metadata used by the pipeline.
ALTER TABLE meeting_recordings ADD COLUMN IF NOT EXISTS duration_seconds  INTEGER;
ALTER TABLE meeting_recordings ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';
ALTER TABLE meeting_recordings ADD COLUMN IF NOT EXISTS source            TEXT DEFAULT 'web';  -- web | desktop

-- ── 13. Row Level Security ──────────────────────────────────────────────────
-- The app exclusively uses the service-role key from server-side route
-- handlers, so a permissive service-role policy matches the existing pattern
-- (see meeting_recordings). User-level isolation is enforced in the API layer
-- by always filtering on user_id.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'desktop_sessions','meeting_processing_jobs','meeting_transcripts',
    'meeting_analysis','meeting_summaries','meeting_decisions','meeting_risks',
    'meeting_mentions','meeting_calendar_matches','meeting_integrations','meeting_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($p$
      DROP POLICY IF EXISTS "service_role_all" ON %I;
      CREATE POLICY "service_role_all" ON %I USING (true) WITH CHECK (true);
    $p$, t, t);
  END LOOP;
END $$;

-- ── 14. Realtime publication ────────────────────────────────────────────────
-- Expose job + event tables to Supabase Realtime so the web client can
-- subscribe to processing updates without polling.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_processing_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE meeting_processing_jobs;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'meeting_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE meeting_events;
  END IF;
END $$;

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Reuses the existing "recordings" bucket (see meetings_migration.sql).
-- Desktop uploads are stored under: <user_id>/desktop/<timestamp>-<name>.webm

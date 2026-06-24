-- Tabla de recordatorios (reemplaza MeetCalendar para el usuario)
CREATE TABLE IF NOT EXISTS reminders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  source      TEXT        NOT NULL DEFAULT 'manual', -- 'manual' | 'ai'
  session_id  UUID        REFERENCES meet_action_sessions(id) ON DELETE SET NULL,
  deadline    TIMESTAMPTZ,
  completed   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS reminders_user_email_idx ON reminders(user_email);
CREATE INDEX IF NOT EXISTS reminders_completed_idx  ON reminders(user_email, completed);
CREATE INDEX IF NOT EXISTS reminders_deadline_idx   ON reminders(user_email, deadline) WHERE deadline IS NOT NULL;

-- RLS: cada usuario solo ve sus propios recordatorios
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_select" ON reminders
  FOR SELECT USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "reminders_insert" ON reminders
  FOR INSERT WITH CHECK (user_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "reminders_update" ON reminders
  FOR UPDATE USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "reminders_delete" ON reminders
  FOR DELETE USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- ═══════════════════════════════════════════════════════════════════════════
-- MeetAction — Sistema de revisión y aprobación de acciones IA post-reunión
-- Conceptualmente funciona como un "Pull Request" de GitHub aplicado a reuniones:
-- la IA propone acciones, el usuario revisa/edita/aprueba y el sistema las ejecuta.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Sesiones de revisión ──────────────────────────────────────────────────
-- Una sesión corresponde a UNA grabación procesada por la IA.
-- Contiene el análisis completo antes de cualquier ejecución.
CREATE TABLE IF NOT EXISTS meet_action_sessions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Grabación que originó esta sesión (puede ser null si se creó manualmente)
  recording_id         UUID        REFERENCES meeting_recordings(id) ON DELETE SET NULL,

  -- Evento del calendario propuesto por la IA como match (puede cambiarse)
  calendar_event_id    UUID        REFERENCES calendar_events(id) ON DELETE SET NULL,
  calendar_match_pct   SMALLINT    CHECK (calendar_match_pct BETWEEN 0 AND 100),

  -- Metadatos de la reunión
  meeting_name         TEXT        NOT NULL,
  meeting_date         TIMESTAMPTZ,
  duration_seconds     INTEGER     CHECK (duration_seconds > 0),

  -- Estado del ciclo de vida:
  --   processing     → la IA está analizando la transcripción
  --   pending_review → lista para que el usuario revise
  --   approved       → el usuario aprobó y el sistema inició la ejecución
  --   executed       → todas las acciones se ejecutaron correctamente
  --   partial        → algunas acciones fallaron
  --   rejected       → el usuario rechazó la sesión completa
  status               TEXT        NOT NULL DEFAULT 'pending_review'
                         CHECK (status IN ('processing','pending_review','approved','executed','partial','rejected')),

  -- Análisis IA: resumen + contadores de lo detectado
  summary_ai           TEXT,
  decisions_count      SMALLINT    DEFAULT 0,
  tasks_count          SMALLINT    DEFAULT 0,
  risks_count          SMALLINT    DEFAULT 0,
  next_steps_count     SMALLINT    DEFAULT 0,

  -- Personas mencionadas en la reunión (nombres extraídos por la IA)
  people_mentioned     TEXT[]      DEFAULT '{}',

  -- Riesgos detectados: [{ title, severity, description }]
  risks_detected       JSONB       DEFAULT '[]',

  -- Timestamps del ciclo de vida
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at          TIMESTAMPTZ,
  executed_at          TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Ítems de acción individuales ─────────────────────────────────────────
-- Cada ítem es una acción propuesta por la IA dentro de una sesión.
-- El usuario puede editar, aprobar o rechazar cada uno independientemente.
CREATE TABLE IF NOT EXISTS meet_action_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES meet_action_sessions(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tipo de ítem:
  --   task       → tarea asignable (crea ticket Jira, to-do Notion, etc.)
  --   decision   → decisión tomada en la reunión
  --   risk       → riesgo identificado
  --   next_step  → siguiente paso acordado
  --   event      → evento a agendar (crea en MeetCalendar)
  --   note       → nota de referencia (crea en MeetBook)
  type            TEXT        NOT NULL
                    CHECK (type IN ('task','decision','risk','next_step','event','note')),

  -- Destino de ejecución:
  --   jira          → crea un Issue en Jira
  --   slack         → envía mensaje a un canal
  --   notion        → crea/actualiza página en Notion
  --   teams         → envía mensaje en Teams
  --   meetcalendar  → crea evento en el calendario interno
  --   meetbook      → crea nota en MeetBook
  destination     TEXT        NOT NULL
                    CHECK (destination IN ('jira','slack','notion','teams','meetcalendar','meetbook')),

  -- Estado del ítem:
  --   pending   → esperando revisión del usuario
  --   approved  → aprobado por el usuario, listo para ejecutar
  --   rejected  → rechazado por el usuario
  --   executing → en proceso de ejecución (estado transitorio)
  --   executed  → ejecutado exitosamente en el destino
  --   failed    → falló la ejecución (ver error_message)
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','executing','executed','failed')),

  -- Contenido (editable por el usuario antes de aprobar)
  title           TEXT        NOT NULL,
  description     TEXT,
  assignee_name   TEXT,
  assignee_email  TEXT,
  priority        TEXT        DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','critical')),

  -- Orden de visualización dentro de la sesión
  sort_order      SMALLINT    DEFAULT 0,

  -- Metadatos específicos del destino, ej.:
  --   Jira:    { "project": "MEET", "issue_type": "Task", "labels": [...] }
  --   Slack:   { "channel": "#general", "thread_ts": null }
  --   Notion:  { "database_id": "xxx", "page_id": null }
  --   Event:   { "start_at": "...", "end_at": "...", "attendees": [...] }
  destination_meta JSONB      DEFAULT '{}',

  -- Resultado de la ejecución
  external_id     TEXT,       -- ID del recurso creado en el sistema externo
  external_url    TEXT,       -- URL al recurso (para mostrar en historial)
  error_message   TEXT,       -- Mensaje de error si status = 'failed'

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ,
  executed_at     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Ejecuciones ──────────────────────────────────────────────────────────
-- Registro de cada vez que se ejecutó una sesión completa.
-- Una sesión puede re-ejecutarse parcialmente (sólo los ítems fallidos).
CREATE TABLE IF NOT EXISTS meet_action_executions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES meet_action_sessions(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status          TEXT        NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','completed','partial','failed')),

  -- Estadísticas de la ejecución
  total_items     SMALLINT    DEFAULT 0,
  approved_items  SMALLINT    DEFAULT 0,
  executed_items  SMALLINT    DEFAULT 0,
  failed_items    SMALLINT    DEFAULT 0,

  -- Destinos involucrados (para el summary)
  destinations_used TEXT[]    DEFAULT '{}',

  -- Personas asignadas (para el summary)
  assignees       TEXT[]      DEFAULT '{}',

  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  error_log       JSONB       DEFAULT '[]'  -- [{ item_id, error, timestamp }]
);

-- ── 4. Historial de ejecuciones individuales ────────────────────────────────
-- Log granular por ítem — permite ver exactamente qué se creó, dónde y cuándo.
CREATE TABLE IF NOT EXISTS meet_action_execution_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id    UUID        NOT NULL REFERENCES meet_action_executions(id) ON DELETE CASCADE,
  item_id         UUID        NOT NULL REFERENCES meet_action_items(id) ON DELETE CASCADE,
  session_id      UUID        NOT NULL REFERENCES meet_action_sessions(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  destination     TEXT        NOT NULL,
  status          TEXT        NOT NULL CHECK (status IN ('success','failed','skipped')),
  title           TEXT        NOT NULL,       -- snapshot del título al momento de ejecutar
  external_id     TEXT,
  external_url    TEXT,
  error_message   TEXT,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Índices de rendimiento ───────────────────────────────────────────────────
-- Consultas frecuentes: sesiones del usuario, ítems por sesión, historial reciente
CREATE INDEX IF NOT EXISTS idx_meet_action_sessions_user    ON meet_action_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meet_action_sessions_status  ON meet_action_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_meet_action_items_session    ON meet_action_items(session_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_meet_action_items_status     ON meet_action_items(session_id, status);
CREATE INDEX IF NOT EXISTS idx_meet_action_execs_session    ON meet_action_executions(session_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_meet_action_log_user         ON meet_action_execution_log(user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_meet_action_log_session      ON meet_action_execution_log(session_id);

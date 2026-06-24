-- ============================================================
-- MeetBox — Sistema de planes y límites
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Tabla de suscripciones activas por usuario
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id       TEXT        NOT NULL DEFAULT 'free',
  -- 'free' | 'plan_sala' | 'plan_empresa'
  status        TEXT        NOT NULL DEFAULT 'active',
  -- 'active' | 'cancelled' | 'expired'
  mp_preference_id  TEXT,   -- ID de preferencia Mercado Pago
  mp_payment_id     TEXT,   -- ID de pago confirmado por el webhook
  activated_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,  -- NULL = no expira (empresa)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT user_subscriptions_user_unique UNIQUE (user_id)
);

-- Índice para buscar por user_id rápido
CREATE INDEX IF NOT EXISTS user_subscriptions_user_idx ON user_subscriptions (user_id);
-- Índice para buscar pagos por mp_payment_id (webhook)
CREATE INDEX IF NOT EXISTS user_subscriptions_mp_payment_idx ON user_subscriptions (mp_payment_id);

-- RLS igual que users
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON user_subscriptions
  USING (true) WITH CHECK (true);

-- ── Función helper: retorna el plan activo de un usuario ──
-- Retorna 'free' si no tiene suscripción o está expirada
CREATE OR REPLACE FUNCTION get_user_plan(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_plan   TEXT;
  v_status TEXT;
  v_exp    TIMESTAMPTZ;
BEGIN
  SELECT plan_id, status, expires_at
  INTO v_plan, v_status, v_exp
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  -- Sin fila → free
  IF NOT FOUND THEN RETURN 'free'; END IF;

  -- Cancelado o expirado → free
  IF v_status <> 'active' THEN RETURN 'free'; END IF;
  IF v_exp IS NOT NULL AND v_exp < NOW() THEN RETURN 'free'; END IF;

  RETURN v_plan;
END;
$$;

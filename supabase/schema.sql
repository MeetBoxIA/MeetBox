-- Tabla de usuarios de MeetBox
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query

CREATE TABLE IF NOT EXISTS users (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  email       TEXT        UNIQUE NOT NULL,
  password_hash TEXT,                        -- NULL si el usuario entró con Google
  provider    TEXT        NOT NULL DEFAULT 'email', -- 'email' | 'google'
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas por email (login)
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- Row Level Security (opcional pero recomendado)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política: solo el service role puede leer/escribir (NextAuth usa service role)
CREATE POLICY "service_role_only" ON users
  USING (true)
  WITH CHECK (true);

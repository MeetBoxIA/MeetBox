-- Meety chat (conversations + messages)
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS chat_conversations (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'Nueva conversación',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_conversations_user_idx       ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS chat_conversations_user_updated_idx ON chat_conversations(user_id, updated_at DESC);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON chat_conversations USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID        NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL,                  -- 'user' | 'assistant'
  content         TEXT        NOT NULL,
  mode            TEXT,                                  -- 'normal' | 'think' | 'deep' (optional)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_conv_idx ON chat_messages(conversation_id, created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON chat_messages USING (true) WITH CHECK (true);

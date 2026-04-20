-- ═══════════════════════════════════════════════════════
-- RIDA SUPREME SYSTEM — Chat en Vivo + Tablas faltantes
-- ═══════════════════════════════════════════════════════

-- 1. TABLA: support_chats (Conversaciones de soporte)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_role TEXT NOT NULL DEFAULT 'client' CHECK (user_role IN ('client', 'driver', 'vendor', 'courier')),
  subject TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT DEFAULT '',
  unread_by_admin INTEGER DEFAULT 1,
  unread_by_user INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_support_chats_user ON support_chats(user_id);
CREATE INDEX idx_support_chats_status ON support_chats(status);
CREATE INDEX idx_support_chats_last_msg ON support_chats(last_message_at DESC);

ALTER TABLE support_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chats"
  ON support_chats FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chats"
  ON support_chats FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chats"
  ON support_chats FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can view all chats"
  ON support_chats FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update all chats"
  ON support_chats FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. TABLA: chat_messages (Mensajes del chat)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES support_chats(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'user' CHECK (sender_type IN ('user', 'admin')),
  sender_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_chat ON chat_messages(chat_id, created_at ASC);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON chat_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM support_chats WHERE id = chat_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert own messages"
  ON chat_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM support_chats WHERE id = chat_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can view all messages"
  ON chat_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert messages"
  ON chat_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Habilitar Realtime para chat
ALTER PUBLICATION supabase_realtime ADD TABLE support_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- 4. TABLA: saved_cards (Tarjetas guardadas por usuario)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  card_holder TEXT NOT NULL,
  card_expiry TEXT NOT NULL,
  card_brand TEXT NOT NULL DEFAULT 'other' CHECK (card_brand IN ('visa', 'mastercard', 'amex', 'other')),
  last_four TEXT GENERATED ALWAYS AS (RIGHT(card_number, 4)) STORED,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_cards_user ON saved_cards(user_id);

ALTER TABLE saved_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cards"
  ON saved_cards FOR ALL USING (user_id = auth.uid());

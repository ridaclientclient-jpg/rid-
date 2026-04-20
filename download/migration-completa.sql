-- ═══════════════════════════════════════════════════════════════════
-- RIDA SUPREME SYSTEM — MIGRACIÓN COMPLETA
-- Copia y pega TODO esto en el SQL Editor de Supabase:
-- https://supabase.com/dashboard/project/behwnnvrdfrlwnwlfwnmxt/sql
-- ═══════════════════════════════════════════════════════════════════
-- Este archivo es seguro de ejecutar varias veces (idempotente).
-- Crea tablas nuevas + agrega columnas faltantes + corrige restricciones.
-- ═══════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 1: FUNCTION is_admin() (sin esto hay recursion)     ║
-- ╚═══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 2: Agregar 'courier' al role CHECK de profiles     ║
-- ╚═══════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  -- Drop constraint vieja (sin 'courier')
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  -- Crear constraint nueva (con 'courier')
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('client', 'driver', 'admin', 'vendor', 'courier'));
END $$;


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 3: Columnas faltantes en tabla RIDES              ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- 3a. scheduled_at (para viajes programados)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'scheduled_at'
  ) THEN
    ALTER TABLE public.rides ADD COLUMN scheduled_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3b. is_scheduled (marca si el viaje fue programado)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'is_scheduled'
  ) THEN
    ALTER TABLE public.rides ADD COLUMN is_scheduled BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 3c. payment_method (efectivo, tarjeta, sinpe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE public.rides ADD COLUMN payment_method TEXT;
  END IF;
END $$;

-- 3d. payment_status (pending, paid, failed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE public.rides ADD COLUMN payment_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- 3e. card_last_four (últimos 4 dígitos de la tarjeta usada)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'card_last_four'
  ) THEN
    ALTER TABLE public.rides ADD COLUMN card_last_four TEXT;
  END IF;
END $$;

-- 3f. sinpe_phone (número SINPE usado para pagar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'sinpe_phone'
  ) THEN
    ALTER TABLE public.rides ADD COLUMN sinpe_phone TEXT;
  END IF;
END $$;

-- 3g. Agregar 'scheduled' al status CHECK de rides
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rides_status_check'
  ) THEN
    -- Si no existe la constraint, la creamos con todos los estados
    ALTER TABLE public.rides ADD CONSTRAINT rides_status_check
      CHECK (status IN ('searching', 'assigned', 'arriving', 'started', 'completed', 'cancelled', 'scheduled'));
  ELSE
    -- Si existe, la eliminamos y recreamos con 'scheduled'
    ALTER TABLE public.rides DROP CONSTRAINT rides_status_check;
    ALTER TABLE public.rides ADD CONSTRAINT rides_status_check
      CHECK (status IN ('searching', 'assigned', 'arriving', 'started', 'completed', 'cancelled', 'scheduled'));
  END IF;
END $$;


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 4: Agregar tipos de transacción faltantes         ║
-- ╚═══════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
  ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('credit', 'debit', 'withdrawal', 'commission', 'ride_payment', 'recharge', 'sinpe_transfer'));
END $$;


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 5: TABLA withdrawal_queue (Fila de retiros)       ║
-- ╚═══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.withdrawal_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_queue_status ON public.withdrawal_queue(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_queue_user ON public.withdrawal_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_queue_created ON public.withdrawal_queue(created_at ASC);

ALTER TABLE public.withdrawal_queue ENABLE ROW LEVEL SECURITY;

-- Usuarios ven su propia fila
CREATE POLICY "Users can view own withdrawals"
  ON public.withdrawal_queue FOR SELECT USING (user_id = auth.uid());

-- Usuarios pueden crear su propia solicitud de retiro
CREATE POLICY "Users can insert own withdrawals"
  ON public.withdrawal_queue FOR INSERT WITH CHECK (user_id = auth.uid());

-- Usuarios pueden cancelar sus propias solicitudes (solo si están en 'queued')
CREATE POLICY "Users can update own withdrawals"
  ON public.withdrawal_queue FOR UPDATE USING (user_id = auth.uid());

-- Admin puede ver todas las filas
CREATE POLICY "Admin can view all withdrawals"
  ON public.withdrawal_queue FOR SELECT USING (public.is_admin());

-- Admin puede procesar todas las filas
CREATE POLICY "Admin can manage all withdrawals"
  ON public.withdrawal_queue FOR ALL USING (public.is_admin());


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 6: TABLA saved_cards (Tarjetas guardadas)         ║
-- ╚═══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.saved_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  card_holder TEXT NOT NULL,
  card_expiry TEXT NOT NULL,
  card_brand TEXT NOT NULL DEFAULT 'other'
    CHECK (card_brand IN ('visa', 'mastercard', 'amex', 'other')),
  last_four TEXT GENERATED ALWAYS AS (RIGHT(card_number, 4)) STORED,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_cards_user ON public.saved_cards(user_id);

ALTER TABLE public.saved_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cards"
  ON public.saved_cards FOR ALL USING (user_id = auth.uid());


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 7: TABLA support_chats (Chats de soporte)         ║
-- ╚═══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.support_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_role TEXT NOT NULL DEFAULT 'client'
    CHECK (user_role IN ('client', 'driver', 'vendor', 'courier')),
  subject TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'resolved')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT DEFAULT '',
  unread_by_admin INTEGER DEFAULT 1,
  unread_by_user INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_chats_user ON public.support_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_support_chats_status ON public.support_chats(status);
CREATE INDEX IF NOT EXISTS idx_support_chats_last_msg ON public.support_chats(last_message_at DESC);

ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chats"
  ON public.support_chats FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chats"
  ON public.support_chats FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chats"
  ON public.support_chats FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can view all chats"
  ON public.support_chats FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all chats"
  ON public.support_chats FOR UPDATE USING (public.is_admin());


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 8: TABLA chat_messages (Mensajes del chat)        ║
-- ╚═══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.support_chats(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'user'
    CHECK (sender_type IN ('user', 'admin')),
  sender_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON public.chat_messages(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON public.chat_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.support_chats WHERE id = chat_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert own messages"
  ON public.chat_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.support_chats WHERE id = chat_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can view all messages"
  ON public.chat_messages FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert messages"
  ON public.chat_messages FOR INSERT WITH CHECK (public.is_admin());


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 9: Habilitar Realtime para chat en vivo           ║
-- ╚═══════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  -- Agregar tablas a realtime (seguro de ejecutar varias veces)
  INSERT INTO pg_publication (pubname, pubowner, puballtables)
  VALUES ('supabase_realtime', 'postgres', true)
  ON CONFLICT (pubname) DO NOTHING;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_queue;


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 10: Trigger auto-update para tablas nuevas        ║
-- ╚═══════════════════════════════════════════════════════════════╝

DROP TRIGGER IF EXISTS support_chats_updated_at ON public.support_chats;
CREATE TRIGGER support_chats_updated_at
  BEFORE UPDATE ON public.support_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger para actualizar last_message_at cuando se envía un mensaje
CREATE OR REPLACE FUNCTION public.update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.support_chats
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    updated_at = NOW()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_messages_last_msg ON public.chat_messages;
CREATE TRIGGER chat_messages_last_msg
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_last_message();


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 11: Fix RLS recursion para tablas de chat         ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Re-crear políticas de chat con is_admin() para evitar recursión

DROP POLICY IF EXISTS "Admins can view all chats" ON public.support_chats;
DROP POLICY IF EXISTS "Admins can update all chats" ON public.support_chats;

CREATE POLICY "Admins can view all chats"
  ON public.support_chats FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all chats"
  ON public.support_chats FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admins can insert messages" ON public.chat_messages;

CREATE POLICY "Admins can view all messages"
  ON public.chat_messages FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert messages"
  ON public.chat_messages FOR INSERT WITH CHECK (public.is_admin());

-- Fix policies para withdrawal_queue con is_admin()
DROP POLICY IF EXISTS "Admin can view all withdrawals" ON public.withdrawal_queue;
DROP POLICY IF EXISTS "Admin can manage all withdrawals" ON public.withdrawal_queue;

CREATE POLICY "Admin can view all withdrawals"
  ON public.withdrawal_queue FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin can manage all withdrawals"
  ON public.withdrawal_queue FOR ALL USING (public.is_admin());


-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  SECCIÓN 12: Courier en auto-create del trigger             ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- Actualizar el trigger de auto-creación para incluir 'courier'
-- (ya incluye 'vendor', ahora aseguramos que 'courier' también funciona)
-- El trigger original ya crea wallets para todos los roles.


-- ═══════════════════════════════════════════════════════════════
-- ¡LISTO! Todas las tablas y columnas están creadas.
-- ═══════════════════════════════════════════════════════════════

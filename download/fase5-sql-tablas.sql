-- ╔══════════════════════════════════════════════════════════════╗
-- ║            FASE 5 — RIDA SUPREME SYSTEM                    ║
-- ║  Tablas: ride_messages                                       ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── 1. Ride Messages (Chat en Vivo durante viaje) ─────────────
CREATE TABLE IF NOT EXISTS ride_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'driver')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ride_messages ENABLE ROW LEVEL SECURITY;

-- El cliente puede ver mensajes de su viaje
CREATE POLICY "Ride messages: client can read own ride"
  ON ride_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_messages.ride_id
      AND rides.rider_id = auth.uid()
    )
  );

-- El conductor puede ver mensajes de su viaje
CREATE POLICY "Ride messages: driver can read own ride"
  ON ride_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_messages.ride_id
      AND rides.driver_id = auth.uid()
    )
  );

-- Admin puede ver todo
CREATE POLICY "Ride messages: admin can read all"
  ON ride_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Cliente puede insertar mensajes en su viaje
CREATE POLICY "Ride messages: client can insert"
  ON ride_messages FOR INSERT WITH CHECK (
    sender_role = 'client'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_messages.ride_id
      AND rides.rider_id = auth.uid()
      AND rides.status IN ('accepted', 'in_progress', 'arriving')
    )
  );

-- Conductor puede insertar mensajes en su viaje
CREATE POLICY "Ride messages: driver can insert"
  ON ride_messages FOR INSERT WITH CHECK (
    sender_role = 'driver'
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_messages.ride_id
      AND rides.driver_id = auth.uid()
      AND rides.status IN ('accepted', 'in_progress', 'arriving')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ride_messages_ride ON ride_messages(ride_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ride_messages_sender ON ride_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ride_messages_read ON ride_messages(is_read) WHERE is_read = FALSE;

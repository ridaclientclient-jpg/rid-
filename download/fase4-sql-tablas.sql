-- ╔══════════════════════════════════════════════════════════════╗
-- ║            FASE 4 — RIDA SUPREME SYSTEM                    ║
-- ║  Tablas: referrals, courier_notifications                 ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── 1. Referrals (Invita Amigos) ───────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code VARCHAR(12) NOT NULL UNIQUE,
  referred_email VARCHAR(255),
  referred_phone VARCHAR(30),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'first_ride_completed', 'rewarded', 'expired')),
  reward_amount DECIMAL(10,2) DEFAULT 0,
  reward_type VARCHAR(20) DEFAULT 'wallet_credit' CHECK (reward_type IN ('wallet_credit', 'ride_credit', 'cashback')),
  referrer_reward_amount DECIMAL(10,2) DEFAULT 0,
  referred_reward_amount DECIMAL(10,2) DEFAULT 0,
  first_ride_id UUID,
  first_ride_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrals: anyone can read their own"
  ON referrals FOR SELECT USING (
    referrer_id = auth.uid() OR referred_id = auth.uid()
  );

CREATE POLICY "Referrals: insert own"
  ON referrals FOR INSERT WITH CHECK (
    referrer_id = auth.uid()
  );

CREATE POLICY "Referrals: update own"
  ON referrals FOR UPDATE USING (
    referrer_id = auth.uid() OR referred_id = auth.uid()
  );

-- Admin can see all
CREATE POLICY "Referrals: admins read all"
  ON referrals FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- ─── 2. Courier Notifications ───────────────────────────────────
-- Reuse existing app_notifications table but add courier-specific channel
-- No new table needed — app_notifications already handles all user types


-- ─── 3. Referral Settings (en settings table) ───────────────────
INSERT INTO settings (key, value, description) VALUES
  ('referral_enabled', 'true', 'Activar sistema de referidos'),
  ('referrer_reward', '3000', 'Recompensa para quien invita (colones)'),
  ('referred_reward', '1500', 'Recompensa para el invitado (colones)'),
  ('referral_expires_days', '30', 'Dias para que el referido complete primer viaje')
ON CONFLICT (key) DO NOTHING;

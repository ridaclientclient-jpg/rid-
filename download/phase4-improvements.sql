-- ╔══════════════════════════════════════════════════════════════════╗
-- ║     RIDA SUPREME SYSTEM — PHASE 4: 10 Uber/Didi Improvements   ║
-- ║                                                              ║
-- ║  1. Ride verification PIN (Client/Driver)                     ║
-- ║  2. Fare comparison by vehicle type (Client)                  ║
-- ║  3. Match retry with radius expansion (Client)                ║
-- ║  4. Emergency contacts (Client)                                ║
-- ║  5. Driver break enforcement (Driver)                         ║
-- ║  6. Wallet recharge via SINPE (Client/Driver)                 ║
-- ║  7. Monthly passenger stats (Client)                          ║
-- ║  8. Driver earnings detail by period (Driver)                 ║
-- ║  9. User achievements/gamification (Client/Driver)            ║
-- ║ 10. Vehicle maintenance tracking (Driver/Admin)               ║
-- ║                                                              ║
-- ║  REGLAS: settings solo tiene key, value, type                 ║
-- ║  No admins table. sos_events is TABLE. Moneda: CRC (₡)       ║
-- ╚══════════════════════════════════════════════════════════════════╝


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 1: Nuevas tablas                                      ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── 1. emergency_contacts ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  relation VARCHAR(20) DEFAULT 'familiar' CHECK (relation IN ('familiar','amigo','trabajo','otro')),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "EC: read own" ON emergency_contacts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "EC: insert own" ON emergency_contacts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "EC: update own" ON emergency_contacts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "EC: delete own" ON emergency_contacts
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON emergency_contacts(user_id);

-- ─── 2. user_achievements ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id VARCHAR(50) NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "UA: read own" ON user_achievements
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "UA: upsert own" ON user_achievements
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "UA: update own" ON user_achievements
  FOR UPDATE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);

-- ─── 3. vehicle_maintenance ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(30) NOT NULL DEFAULT 'general_inspection'
    CHECK (maintenance_type IN ('oil_change','tire_rotation','brake_service','engine_service','general_inspection','battery_replacement','other')),
  description TEXT,
  odometer_km INTEGER,
  cost DECIMAL(10,2),
  maintenance_date DATE,
  next_maintenance_km INTEGER,
  next_maintenance_date DATE,
  shop_name VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VM: read own" ON vehicle_maintenance
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "VM: insert own" ON vehicle_maintenance
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "VM: update own" ON vehicle_maintenance
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "VM: delete own" ON vehicle_maintenance
  FOR DELETE USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_driver ON vehicle_maintenance(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_vehicle ON vehicle_maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_status ON vehicle_maintenance(status);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 2: Nuevas columnas en tablas existentes              ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── rides: columnas para verificacion PIN y match retry ──────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'verification_pin') THEN
    ALTER TABLE rides ADD COLUMN verification_pin VARCHAR(6);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'pin_verified') THEN
    ALTER TABLE rides ADD COLUMN pin_verified BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'match_retry_count') THEN
    ALTER TABLE rides ADD COLUMN match_retry_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'max_match_retries') THEN
    ALTER TABLE rides ADD COLUMN max_match_retries INTEGER DEFAULT 3;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'match_radius_km') THEN
    ALTER TABLE rides ADD COLUMN match_radius_km DECIMAL(6,2) DEFAULT 5.00;
  END IF;
END $$;

-- ─── drivers: columnas para descansos obligatorios ─────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'break_until') THEN
    ALTER TABLE drivers ADD COLUMN break_until TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'total_break_time_min') THEN
    ALTER TABLE drivers ADD COLUMN total_break_time_min INTEGER DEFAULT 0;
  END IF;
END $$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 3: Settings (SOLO key, value, type)                 ║
-- ╚══════════════════════════════════════════════════════════════╝

INSERT INTO settings (key, value, type) VALUES
  ('ride_verification_enabled', 'true', 'boolean'),
  ('ride_verification_pin_length', '4', 'number'),
  ('match_retry_enabled', 'true', 'boolean'),
  ('match_max_retries', '3', 'number'),
  ('match_initial_radius_km', '5', 'number'),
  ('match_radius_increment_km', '3', 'number'),
  ('driver_break_enabled', 'true', 'boolean'),
  ('driver_break_interval_min', '240', 'number'),
  ('driver_break_duration_min', '20', 'number'),
  ('wallet_min_recharge', '1000', 'number'),
  ('wallet_max_recharge', '100000', 'number'),
  ('achievements_enabled', 'true', 'boolean'),
  ('maintenance_reminder_km', '500', 'number')
ON CONFLICT (key) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 4: Funciones RPC                                     ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── 1. generate_verification_pin ──────────────────────────────
CREATE OR REPLACE FUNCTION generate_verification_pin(p_ride_id UUID)
RETURNS VARCHAR(6)
LANGUAGE plpgsql
AS $$
DECLARE
  v_pin VARCHAR(6);
  v_pin_length INTEGER := 4;
BEGIN
  -- Read pin length from settings
  SELECT ABS(value::INTEGER) INTO v_pin_length
  FROM settings WHERE key = 'ride_verification_pin_length'
  LIMIT 1;
  IF v_pin_length IS NULL OR v_pin_length < 4 THEN v_pin_length := 4; END IF;
  IF v_pin_length > 6 THEN v_pin_length := 6; END IF;

  -- Generate random numeric PIN
  v_pin := LPAD(FLOOR(RANDOM() * POWER(10, v_pin_length))::TEXT, v_pin_length, '0');

  -- Update the ride
  UPDATE rides SET verification_pin = v_pin, pin_verified = false
  WHERE id = p_ride_id AND driver_id IS NOT NULL;

  RETURN v_pin;
END;
$$;

-- ─── 2. verify_ride_pin ────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_ride_pin(p_ride_id UUID, p_pin VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_stored_pin VARCHAR(6);
  v_enabled BOOLEAN := true;
BEGIN
  -- Check if feature is enabled
  SELECT (value = 'true') INTO v_enabled
  FROM settings WHERE key = 'ride_verification_enabled'
  LIMIT 1;
  IF v_enabled IS NULL THEN v_enabled := true; END IF;

  IF NOT v_enabled THEN RETURN true; END IF;

  -- Get stored PIN
  SELECT verification_pin INTO v_stored_pin
  FROM rides
  WHERE id = p_ride_id AND driver_id IS NOT NULL;

  IF v_stored_pin IS NULL THEN RETURN false; END IF;

  -- Compare
  IF v_stored_pin = p_pin THEN
    UPDATE rides SET pin_verified = true WHERE id = p_ride_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ─── 3. compare_fare_by_type ───────────────────────────────────
CREATE OR REPLACE FUNCTION compare_fare_by_type(
  p_origin_lat DECIMAL(10,7),
  p_origin_lng DECIMAL(10,7),
  p_dest_lat DECIMAL(10,7),
  p_dest_lng DECIMAL(10,7)
)
RETURNS TABLE(
  type TEXT,
  price NUMERIC,
  distance NUMERIC,
  duration NUMERIC,
  eta_min NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_distance_km NUMERIC;
  v_base_price NUMERIC := 800;
  v_price_per_km NUMERIC := 650;
  v_speed_kmh NUMERIC := 30;
BEGIN
  -- Haversine distance
  SELECT
    6371 * 2 * ASIN(SQRT(
      LEAST(1,
        SIN(RADIANS(p_dest_lat - p_origin_lat) / 2) * SIN(RADIANS(p_dest_lat - p_origin_lat) / 2) +
        COS(RADIANS(p_origin_lat)) * COS(RADIANS(p_dest_lat)) *
        SIN(RADIANS(p_dest_lng - p_origin_lng) / 2) * SIN(RADIANS(p_dest_lng - p_origin_lng) / 2)
      )
    ))
  INTO v_distance_km;

  IF v_distance_km IS NULL OR v_distance_km < 0.1 THEN
    v_distance_km := 0.5;
  END IF;

  -- Return estimates for each ride type with multipliers
  RETURN QUERY
  SELECT
    rt.type,
    ROUND(LEAST(GREATEST(
      v_base_price * rt.multiplier + v_distance_km * v_price_per_km * rt.multiplier,
      500
    ), 500000)) AS price,
    ROUND(v_distance_km, 2) AS distance,
    ROUND((v_distance_km / v_speed_kmh) * 60 * rt.duration_factor) AS duration,
    ROUND((v_distance_km / v_speed_kmh) * 60 * rt.duration_factor * 0.3 + 3) AS eta_min
  FROM (
    VALUES
      ('economico', 1.0, 1.0),
      ('premium',   2.0, 0.9),
      ('suv',       2.5, 1.1),
      ('moto',      0.6, 0.6),
      ('moto_express', 0.5, 0.5)
  ) AS rt(type, multiplier, duration_factor);
END;
$$;

-- ─── 4. get_monthly_passenger_stats ────────────────────────────
CREATE OR REPLACE FUNCTION get_monthly_passenger_stats(
  p_user_id UUID,
  p_month VARCHAR(7)
)
RETURNS TABLE(
  total_rides BIGINT,
  total_spent NUMERIC,
  total_tips NUMERIC,
  total_distance_km NUMERIC,
  avg_fare NUMERIC,
  completed BIGINT,
  cancelled BIGINT,
  most_common_type TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_month_start TIMESTAMPTZ := (p_month || '-01T00:00:00')::TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ := (p_month || '-01T00:00:00')::TIMESTAMPTZ + INTERVAL '1 month' - INTERVAL '1 second';
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.price ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.status = 'completed' THEN COALESCE(r.tip_amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.distance ELSE 0 END), 0),
    CASE WHEN COUNT(*) FILTER (WHERE r.status = 'completed') > 0
      THEN AVG(r.price) FILTER (WHERE r.status = 'completed')
      ELSE 0
    END,
    COUNT(*) FILTER (WHERE r.status = 'completed')::BIGINT,
    COUNT(*) FILTER (WHERE r.status = 'cancelled')::BIGINT,
    (
      SELECT r2.ride_type
      FROM rides r2
      WHERE r2.rider_id = p_user_id
        AND r2.status = 'completed'
        AND r2.created_at >= v_month_start
        AND r2.created_at <= v_month_end
      GROUP BY r2.ride_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    )
  FROM rides r
  WHERE r.rider_id = p_user_id
    AND r.created_at >= v_month_start
    AND r.created_at <= v_month_end;
END;
$$;

-- ─── 5. get_driver_earnings_detail ──────────────────────────────
CREATE OR REPLACE FUNCTION get_driver_earnings_detail(
  p_driver_id UUID,
  p_period TEXT DEFAULT 'week'
)
RETURNS TABLE(
  total_rides BIGINT,
  total_earnings NUMERIC,
  total_tips NUMERIC,
  total_distance_km NUMERIC,
  daily JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  -- Calculate date range from period
  CASE p_period
    WHEN 'today' THEN
      v_start := date_trunc('day', now());
      v_end := v_start + INTERVAL '1 day';
    WHEN 'week' THEN
      v_start := date_trunc('week', now());
      v_end := v_start + INTERVAL '1 week';
    WHEN 'month' THEN
      v_start := date_trunc('month', now());
      v_end := v_start + INTERVAL '1 month';
    WHEN 'year' THEN
      v_start := date_trunc('year', now());
      v_end := v_start + INTERVAL '1 year';
    ELSE
      v_start := date_trunc('week', now());
      v_end := v_start + INTERVAL '1 week';
  END CASE;

  -- Build daily breakdown as JSONB array
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(SUM(r.price), 0),
    COALESCE(SUM(COALESCE(r.tip_amount, 0)), 0),
    COALESCE(SUM(COALESCE(r.distance, 0)), 0),
    (
      SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::JSONB)
      FROM (
        SELECT
          dd.date::TEXT,
          COALESCE(dd.rides, 0)::BIGINT AS rides,
          COALESCE(dd.earnings, 0)::NUMERIC AS earnings,
          COALESCE(dd.tips, 0)::NUMERIC AS tips,
          COALESCE(dd.distance, 0)::NUMERIC AS distance,
          CASE WHEN dd.rides > 0 THEN dd.earnings / dd.rides ELSE 0 END AS avg_fare
        FROM (
          SELECT
            created_at::date AS date,
            COUNT(*) AS rides,
            SUM(price) AS earnings,
            SUM(COALESCE(tip_amount, 0)) AS tips,
            SUM(COALESCE(distance, 0)) AS distance
          FROM rides
          WHERE driver_id = p_driver_id
            AND status = 'completed'
            AND completed_at >= v_start
            AND completed_at <= v_end
          GROUP BY created_at::date
        ) dd
        ORDER BY dd.date
      ) d
    )
  FROM rides r
  WHERE r.driver_id = p_driver_id
    AND r.status = 'completed'
    AND r.completed_at >= v_start
    AND r.completed_at <= v_end;
END;
$$;

-- ─── 6. recharge_wallet ────────────────────────────────────────
CREATE OR REPLACE FUNCTION recharge_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_method TEXT DEFAULT 'sinpe'
)
RETURNS TABLE(new_balance NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance NUMERIC;
  v_min_amount NUMERIC := 1000;
  v_max_amount NUMERIC := 100000;
BEGIN
  -- Read limits from settings
  SELECT value::NUMERIC INTO v_min_amount FROM settings WHERE key = 'wallet_min_recharge' LIMIT 1;
  SELECT value::NUMERIC INTO v_max_amount FROM settings WHERE key = 'wallet_max_recharge' LIMIT 1;
  IF v_min_amount IS NULL THEN v_min_amount := 1000; END IF;
  IF v_max_amount IS NULL THEN v_max_amount := 100000; END IF;

  -- Validate amount
  IF p_amount IS NULL OR p_amount < v_min_amount THEN
    RAISE EXCEPTION 'Monto minimo de recarga: %', v_min_amount;
  END IF;
  IF p_amount > v_max_amount THEN
    RAISE EXCEPTION 'Monto maximo de recarga: %', v_max_amount;
  END IF;

  -- Find or create wallet
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id LIMIT 1;

  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, total_earnings, total_withdrawn)
    VALUES (p_user_id, p_amount, 0, 0)
    RETURNING id INTO v_wallet_id;
    v_new_balance := p_amount;
  ELSE
    UPDATE wallets SET balance = balance + p_amount WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;
  END IF;

  -- Create transaction record
  INSERT INTO transactions (wallet_id, amount, type, status, description)
  VALUES (v_wallet_id, p_amount, 'credit', 'completed',
    'Recarga via ' || COALESCE(p_method, 'sinpe') || ' - ₡' || p_amount);

  RETURN QUERY SELECT v_new_balance;
END;
$$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 5: Triggers                                         ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── Trigger: Auto-generate PIN when driver is assigned ────────
CREATE OR REPLACE FUNCTION fn_on_ride_assigned_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_enabled BOOLEAN := true;
BEGIN
  -- Check if feature is enabled
  SELECT (value = 'true') INTO v_enabled
  FROM settings WHERE key = 'ride_verification_enabled'
  LIMIT 1;
  IF v_enabled IS NULL THEN v_enabled := true; END IF;

  IF v_enabled AND NEW.driver_id IS NOT NULL AND NEW.verification_pin IS NULL THEN
    -- Auto-generate PIN
    UPDATE rides
    SET verification_pin = LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
        pin_verified = false
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_ride_assigned_pin ON rides;
CREATE TRIGGER trg_on_ride_assigned_pin
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.driver_id IS NULL AND NEW.driver_id IS NOT NULL)
  EXECUTE FUNCTION fn_on_ride_assigned_pin();

-- ─── Trigger: Enforce driver rest breaks ────────────────────────
CREATE OR REPLACE FUNCTION fn_check_driver_break()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_enabled BOOLEAN := true;
  v_interval_min INTEGER := 240;
  v_duration_min INTEGER := 20;
  v_rides_since_break INTEGER;
BEGIN
  -- Only check on status changes to 'completed'
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Check if feature is enabled
  SELECT (value = 'true') INTO v_enabled FROM settings WHERE key = 'driver_break_enabled' LIMIT 1;
  IF v_enabled IS NULL THEN v_enabled := true; END IF;
  IF NOT v_enabled THEN RETURN NEW; END IF;

  -- Read settings
  SELECT ABS(value::INTEGER) INTO v_interval_min FROM settings WHERE key = 'driver_break_interval_min' LIMIT 1;
  SELECT ABS(value::INTEGER) INTO v_duration_min FROM settings WHERE key = 'driver_break_duration_min' LIMIT 1;
  IF v_interval_min IS NULL THEN v_interval_min := 240; END IF;
  IF v_duration_min IS NULL THEN v_duration_min := 20; END IF;

  -- Count completed rides since last break
  SELECT COUNT(*) INTO v_rides_since_break
  FROM rides
  WHERE driver_id = NEW.driver_id
    AND status = 'completed'
    AND created_at > COALESCE(
      (SELECT break_until FROM drivers WHERE id = NEW.driver_id),
      '1970-01-01'::TIMESTAMPTZ
    );

  -- If threshold reached, set break
  IF v_rides_since_break >= 6 THEN
    UPDATE drivers
    SET break_until = now() + (v_duration_min || ' minutes')::INTERVAL,
        total_break_time_min = COALESCE(total_break_time_min, 0) + v_duration_min
    WHERE id = NEW.driver_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_driver_break ON rides;
CREATE TRIGGER trg_check_driver_break
  AFTER UPDATE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_driver_break();


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  BLOQUE 6: Verificacion rapida                              ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Verify all objects exist
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Tables
  SELECT COUNT(*) INTO v_count FROM information_schema.tables
  WHERE table_name IN ('emergency_contacts','user_achievements','vehicle_maintenance');
  RAISE NOTICE 'Phase 4 tables found: %/3', v_count;

  -- Columns on rides
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'rides' AND column_name IN ('verification_pin','pin_verified','match_retry_count','max_match_retries','match_radius_km');
  RAISE NOTICE 'Phase 4 ride columns found: %/5', v_count;

  -- Columns on drivers
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'drivers' AND column_name IN ('break_until','total_break_time_min');
  RAISE NOTICE 'Phase 4 driver columns found: %/2', v_count;

  -- Settings
  SELECT COUNT(*) INTO v_count FROM settings
  WHERE key IN ('ride_verification_enabled','ride_verification_pin_length','match_retry_enabled','match_max_retries',
    'match_initial_radius_km','match_radius_increment_km','driver_break_enabled','driver_break_interval_min',
    'driver_break_duration_min','wallet_min_recharge','wallet_max_recharge','achievements_enabled','maintenance_reminder_km');
  RAISE NOTICE 'Phase 4 settings found: %/13', v_count;

  -- Functions
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname IN (
    'generate_verification_pin','verify_ride_pin','compare_fare_by_type',
    'get_monthly_passenger_stats','get_driver_earnings_detail','recharge_wallet');
  RAISE NOTICE 'Phase 4 functions found: %/6', v_count;

  -- Triggers
  SELECT COUNT(*) INTO v_count FROM pg_trigger WHERE tgname IN ('trg_on_ride_assigned_pin','trg_check_driver_break');
  RAISE NOTICE 'Phase 4 triggers found: %/2', v_count;

  RAISE NOTICE '=== PHASE 4 COMPLETE ===';
END;
$$;

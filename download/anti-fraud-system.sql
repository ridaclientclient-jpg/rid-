-- ═══════════════════════════════════════════════════════════════
-- RIDA SUPREME SYSTEM – Anti-Fraud System
-- ═══════════════════════════════════════════════════════════════
-- 1. Tables: fraud_rules, fraud_alerts, fraud_user_scores, fraud_rule_hits
-- 2. Seed default rules for clients, vendors, couriers, drivers
-- 3. RPC functions for automatic detection + admin actions
-- 4. RLS policies
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Fraud Rules ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  user_type TEXT NOT NULL CHECK (user_type IN ('client','vendor','courier','driver')),
  condition_key TEXT NOT NULL,
  threshold_params JSONB NOT NULL DEFAULT '{}',
  points INTEGER NOT NULL DEFAULT 10,
  auto_action TEXT NOT NULL DEFAULT 'alert' CHECK (auto_action IN ('none','alert','block','freeze_withdrawals')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Fraud Alerts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('client','vendor','courier','driver')),
  rule_id UUID REFERENCES public.fraud_rules(id),
  alert_type TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
  description TEXT,
  details JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','under_review','approved','dismissed','blocked')),
  risk_score INTEGER DEFAULT 0,
  withdrawals_frozen BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT
);

-- ─── 3. Fraud User Scores ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_user_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('client','vendor','courier','driver')),
  risk_score INTEGER NOT NULL DEFAULT 0,
  alert_count INTEGER NOT NULL DEFAULT 0,
  resolved_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  last_alert_at TIMESTAMPTZ,
  last_score_update TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal','suspicious','high_risk','blocked')),
  withdrawals_frozen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, user_type)
);

-- ─── 4. Fraud Rule Hits ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fraud_rule_hits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.fraud_alerts(id),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('client','vendor','courier','driver')),
  rule_id UUID REFERENCES public.fraud_rules(id),
  points_added INTEGER NOT NULL DEFAULT 0,
  new_total_score INTEGER NOT NULL DEFAULT 0,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. RLS ─────────────────────────────────────────────────────
ALTER TABLE public.fraud_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_user_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_rule_hits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins full access fraud_rules"
    ON public.fraud_rules FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins full access fraud_alerts"
    ON public.fraud_alerts FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins full access fraud_user_scores"
    ON public.fraud_user_scores FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins full access fraud_rule_hits"
    ON public.fraud_rule_hits FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

-- ─── 6. Seed Default Fraud Rules ────────────────────────────────
-- Client rules
INSERT INTO public.fraud_rules (name, description, user_type, condition_key, threshold_params, points, auto_action) VALUES
('Pedidos excesivos en poco tiempo', 'Cliente realiza mas de N pedidos en M minutos', 'client', 'rapid_orders',
 '{"count": 5, "minutes": 60}', 20, 'alert'),
('Pagos fallidos repetidos', 'Cliente tiene mas de N pagos fallidos en 24h', 'client', 'failed_payments',
 '{"count": 3, "hours": 24}', 15, 'alert'),
('Cuenta nueva con actividad alta', 'Cuenta menor a N dias con pedidos por mas de X monto', 'client', 'new_account_high_value',
 '{"days": 7, "amount": 50000}', 25, 'alert'),
('Multiples reembolsos', 'Cliente solicita mas de N reembolsos en 24h', 'client', 'rapid_refunds',
 '{"count": 3, "hours": 24}', 20, 'alert'),
('Misma ubicacion sospechosa', 'Multiples pedidos desde la misma ubicacion con diferentes usuarios', 'client', 'same_location',
 '{"count": 3, "radius_meters": 100}', 15, 'alert'),

-- Vendor rules
('Auto-compras detectadas', 'Negocio realiza pedidos a su propia tienda', 'vendor', 'self_purchase',
 '{}', 30, 'alert'),
('Cuentas nuevas multiples', 'Multiples cuentas nuevas ordenando del mismo negocio', 'vendor', 'fake_accounts',
 '{"count": 3, "days": 7}', 20, 'alert'),
('Alta tasa de reembolsos', 'Negocio con tasa de reembolso mayor al N%', 'vendor', 'high_refund_rate',
 '{"percent": 30}', 25, 'alert'),
('Pico inusual de pedidos', 'Aumento repentino de pedidos (N veces el promedio)', 'vendor', 'sudden_spike',
 '{"multiplier": 10}', 20, 'alert'),

-- Courier rules
('Entregas sin movimiento', 'Repartidor completa entregas con distancia 0', 'courier', 'zero_distance',
 '{"count": 3, "days": 1}', 25, 'alert'),
('Mismo punto de recogida', 'Multiples entregas desde el mismo punto', 'courier', 'same_pickup',
 '{"count": 5, "days": 1}', 20, 'alert'),
('Cuenta nueva muy activa', 'Repartidor nuevo con mas de N entregas en 24h', 'courier', 'new_courier_burst',
 '{"count": 20, "days": 7}', 30, 'alert'),

-- Driver rules
('Viajes sin distancia', 'Conductor completa viajes con 0 KM', 'driver', 'zero_distance_ride',
 '{"count": 3, "days": 1}', 25, 'alert'),
('GPS sospechoso', 'Saltos GPS imposibles entre ubicaciones', 'driver', 'gps_jumps',
 '{"count": 3, "hours": 1}', 30, 'alert'),
('Cuenta nueva con muchos viajes', 'Conductor nuevo con mas de N viajes en 7 dias', 'driver', 'new_driver_burst',
 '{"count": 30, "days": 7}', 25, 'alert'),
('Viajes desde mismo origen', 'Multiples viajes desde la misma ubicacion', 'driver', 'same_origin',
 '{"count": 5, "days": 1}', 15, 'alert')
ON CONFLICT DO NOTHING;

-- ─── 7. RPC: Get or Create User Score ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_fraud_score(p_user_id UUID, p_user_type TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.fraud_user_scores (user_id, user_type)
  VALUES (p_user_id, p_user_type)
  ON CONFLICT (user_id, user_type) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.fraud_user_scores
    WHERE user_id = p_user_id AND user_type = p_user_type;
  END IF;

  RETURN v_id;
END;
$$;

-- ─── 8. RPC: Create Fraud Alert ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_fraud_alert(
  p_user_id UUID,
  p_user_type TEXT,
  p_rule_id UUID,
  p_alert_type TEXT,
  p_risk_level TEXT DEFAULT 'medium',
  p_description TEXT DEFAULT '',
  p_details JSONB DEFAULT '{}',
  p_points INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_alert_id UUID;
  v_score_id UUID;
  v_new_score INTEGER;
  v_new_status TEXT;
BEGIN
  -- Create alert
  INSERT INTO public.fraud_alerts (user_id, user_type, rule_id, alert_type, risk_level, description, details, risk_score)
  VALUES (p_user_id, p_user_type, p_rule_id, p_alert_type, p_risk_level, p_description, p_details, p_points)
  RETURNING id INTO v_alert_id;

  -- Update user score
  v_score_id := public.get_or_create_fraud_score(p_user_id, p_user_type);

  UPDATE public.fraud_user_scores
  SET risk_score = LEAST(100, risk_score + p_points),
      alert_count = alert_count + 1,
      last_alert_at = now(),
      last_score_update = now(),
      status = CASE
        WHEN LEAST(100, risk_score + p_points) > 60 THEN 'high_risk'
        WHEN LEAST(100, risk_score + p_points) > 30 THEN 'suspicious'
        ELSE 'normal'
      END
  WHERE id = v_score_id
  RETURNING risk_score INTO v_new_score;

  -- Record rule hit
  INSERT INTO public.fraud_rule_hits (alert_id, user_id, user_type, rule_id, points_added, new_total_score, details)
  VALUES (v_alert_id, p_user_id, p_user_type, p_rule_id, p_points, v_new_score, p_details);

  -- Auto-action based on new score
  IF v_new_score > 60 THEN
    -- High risk: freeze withdrawals
    UPDATE public.fraud_user_scores
    SET withdrawals_frozen = true
    WHERE id = v_score_id;

    UPDATE public.fraud_alerts
    SET withdrawals_frozen = true
    WHERE id = v_alert_id;
  END IF;

  RETURN v_alert_id;
END;
$$;

-- ─── 9. RPC: Run Fraud Check (General) ──────────────────────────
CREATE OR REPLACE FUNCTION public.run_fraud_check(
  p_user_id UUID,
  p_user_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB := '[]'::JSONB;
  v_triggered INTEGER := 0;
BEGIN
  -- Client checks
  IF p_user_type = 'client' THEN
    -- Check 1: Rapid orders
    DECLARE
      v_order_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_order_count
      FROM public.deliveries
      WHERE customer_id = p_user_id
        AND created_at > now() - INTERVAL '60 minutes';
      IF v_order_count >= 5 THEN
        PERFORM public.create_fraud_alert(
          p_user_id, 'client',
          (SELECT id FROM public.fraud_rules WHERE condition_key = 'rapid_orders' AND is_active LIMIT 1),
          'rapid_orders', 'medium',
          'Cliente realizo ' || v_order_count || ' pedidos en la ultima hora',
          jsonb_build_object('order_count', v_order_count, 'window_minutes', 60),
          20
        );
        v_triggered := v_triggered + 1;
      END IF;
    END;
  END IF;

  -- Vendor checks
  IF p_user_type = 'vendor' THEN
    -- Check: Self-purchase
    DECLARE
      v_self_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_self_count
      FROM public.deliveries d
      JOIN public.couriers c ON c.id = d.courier_id
      WHERE d.vendor_id = p_user_id
        AND c.user_id = p_user_id
        AND d.created_at > now() - INTERVAL '24 hours';
      IF v_self_count > 0 THEN
        PERFORM public.create_fraud_alert(
          p_user_id, 'vendor',
          (SELECT id FROM public.fraud_rules WHERE condition_key = 'self_purchase' AND is_active LIMIT 1),
          'self_purchase', 'high',
          'Negocio detectado con auto-compras: ' || v_self_count || ' pedidos',
          jsonb_build_object('self_purchase_count', v_self_count),
          30
        );
        v_triggered := v_triggered + 1;
      END IF;
    END;
  END IF;

  -- Courier checks
  IF p_user_type = 'courier' THEN
    -- Check: Zero distance deliveries
    DECLARE
      v_zero_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_zero_count
      FROM public.deliveries
      WHERE courier_id = p_user_id
        AND (distance IS NULL OR distance = 0)
        AND status = 'delivered'
        AND created_at > now() - INTERVAL '1 day';
      IF v_zero_count >= 3 THEN
        PERFORM public.create_fraud_alert(
          p_user_id, 'courier',
          (SELECT id FROM public.fraud_rules WHERE condition_key = 'zero_distance' AND is_active LIMIT 1),
          'zero_distance', 'high',
          'Repartidor completo ' || v_zero_count || ' entregas sin distancia',
          jsonb_build_object('zero_distance_count', v_zero_count),
          25
        );
        v_triggered := v_triggered + 1;
      END IF;
    END;
  END IF;

  -- Driver checks
  IF p_user_type = 'driver' THEN
    -- Check: Zero distance rides
    DECLARE
      v_zero_rides INTEGER;
      v_driver_user_id UUID;
    BEGIN
      SELECT user_id INTO v_driver_user_id FROM public.drivers WHERE id = p_user_id;
      SELECT COUNT(*) INTO v_zero_rides
      FROM public.rides
      WHERE driver_id = v_driver_user_id
        AND (distance IS NULL OR distance = 0)
        AND status = 'completed'
        AND created_at > now() - INTERVAL '1 day';
      IF v_zero_rides >= 3 THEN
        PERFORM public.create_fraud_alert(
          v_driver_user_id, 'driver',
          (SELECT id FROM public.fraud_rules WHERE condition_key = 'zero_distance_ride' AND is_active LIMIT 1),
          'zero_distance_ride', 'high',
          'Conductor completo ' || v_zero_rides || ' viajes sin distancia',
          jsonb_build_object('zero_distance_count', v_zero_rides),
          25
        );
        v_triggered := v_triggered + 1;
      END IF;
    END;
  END IF;

  -- Check new account with high activity
  IF p_user_type IN ('client','vendor','courier','driver') THEN
    DECLARE
      v_account_days INTEGER;
      v_activity_count INTEGER;
    BEGIN
      SELECT EXTRACT(DAY FROM now() - created_at)::INTEGER INTO v_account_days
      FROM public.profiles WHERE id = p_user_id;
      IF v_account_days IS NULL THEN v_account_days := 999; END IF;

      IF v_account_days <= 7 THEN
        IF p_user_type = 'client' THEN
          SELECT COUNT(*) INTO v_activity_count FROM public.deliveries WHERE customer_id = p_user_id AND created_at > now() - INTERVAL '7 days';
          IF v_activity_count > 10 THEN
            PERFORM public.create_fraud_alert(
              p_user_id, p_user_type,
              (SELECT id FROM public.fraud_rules WHERE condition_key = 'new_account_high_value' AND is_active LIMIT 1),
              'new_account_activity', 'high',
              'Cuenta de ' || v_account_days || ' dias con ' || v_activity_count || ' pedidos',
              jsonb_build_object('account_days', v_account_days, 'activity_count', v_activity_count),
              25
            );
            v_triggered := v_triggered + 1;
          END IF;
        ELSIF p_user_type = 'courier' THEN
          SELECT COUNT(*) INTO v_activity_count FROM public.deliveries WHERE courier_id = p_user_id AND status = 'delivered' AND created_at > now() - INTERVAL '7 days';
          IF v_activity_count > 20 THEN
            PERFORM public.create_fraud_alert(
              p_user_id, p_user_type,
              (SELECT id FROM public.fraud_rules WHERE condition_key = 'new_courier_burst' AND is_active LIMIT 1),
              'new_account_activity', 'high',
              'Repartidor nuevo de ' || v_account_days || ' dias con ' || v_activity_count || ' entregas',
              jsonb_build_object('account_days', v_account_days, 'activity_count', v_activity_count),
              30
            );
            v_triggered := v_triggered + 1;
          END IF;
        ELSIF p_user_type = 'driver' THEN
          SELECT COUNT(*) INTO v_activity_count FROM public.rides WHERE driver_id = p_user_id AND status = 'completed' AND created_at > now() - INTERVAL '7 days';
          IF v_activity_count > 30 THEN
            PERFORM public.create_fraud_alert(
              p_user_id, p_user_type,
              (SELECT id FROM public.fraud_rules WHERE condition_key = 'new_driver_burst' AND is_active LIMIT 1),
              'new_account_activity', 'high',
              'Conductor nuevo de ' || v_account_days || ' dias con ' || v_activity_count || ' viajes',
              jsonb_build_object('account_days', v_account_days, 'activity_count', v_activity_count),
              25
            );
            v_triggered := v_triggered + 1;
          END IF;
        END IF;
      END IF;
    END;
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'user_type', p_user_type,
    'alerts_triggered', v_triggered
  );
END;
$$;

-- ─── 10. RPC: Get Fraud Dashboard Stats ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_fraud_dashboard()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'active_alerts', COALESCE((SELECT COUNT(*) FROM public.fraud_alerts WHERE status = 'active'), 0),
    'under_review', COALESCE((SELECT COUNT(*) FROM public.fraud_alerts WHERE status = 'under_review'), 0),
    'blocked_users', COALESCE((SELECT COUNT(*) FROM public.fraud_user_scores WHERE status = 'blocked'), 0),
    'frozen_withdrawals', COALESCE((SELECT COUNT(*) FROM public.fraud_user_scores WHERE withdrawals_frozen = true), 0),
    'high_risk_users', COALESCE((SELECT COUNT(*) FROM public.fraud_user_scores WHERE status = 'high_risk'), 0),
    'suspicious_users', COALESCE((SELECT COUNT(*) FROM public.fraud_user_scores WHERE status = 'suspicious'), 0),
    'total_alerts_today', COALESCE((SELECT COUNT(*) FROM public.fraud_alerts WHERE created_at > now() - INTERVAL '24 hours'), 0),
    'total_rules', COALESCE((SELECT COUNT(*) FROM public.fraud_rules WHERE is_active = true), 0),
    'client_high_risk', COALESCE((SELECT COUNT(*) FROM public.fraud_user_scores WHERE user_type = 'client' AND status IN ('suspicious','high_risk','blocked')), 0),
    'vendor_high_risk', COALESCE((SELECT COUNT(*) FROM public.fraud_user_scores WHERE user_type = 'vendor' AND status IN ('suspicious','high_risk','blocked')), 0),
    'courier_high_risk', COALESCE((SELECT COUNT(*) FROM public.fraud_user_scores WHERE user_type = 'courier' AND status IN ('suspicious','high_risk','blocked')), 0),
    'driver_high_risk', COALESCE((SELECT COUNT(*) FROM public.fraud_user_scores WHERE user_type = 'driver' AND status IN ('suspicious','high_risk','blocked')), 0)
  );
$$;

-- ─── 11. RPC: Get Fraud Alerts (filtered) ───────────────────────
CREATE OR REPLACE FUNCTION public.get_fraud_alerts(
  p_user_type TEXT DEFAULT NULL,
  p_risk_level TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  user_type TEXT,
  user_role TEXT,
  rule_name TEXT,
  alert_type TEXT,
  risk_level TEXT,
  description TEXT,
  status TEXT,
  risk_score INTEGER,
  withdrawals_frozen BOOLEAN,
  user_risk_score INTEGER,
  user_status TEXT,
  details JSONB,
  created_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    fa.id,
    fa.user_id,
    p.name AS user_name,
    p.email AS user_email,
    p.phone AS user_phone,
    fa.user_type,
    p.role AS user_role,
    fr.name AS rule_name,
    fa.alert_type,
    fa.risk_level,
    fa.description,
    fa.status,
    fa.risk_score,
    fa.withdrawals_frozen,
    COALESCE(fus.risk_score, 0) AS user_risk_score,
    COALESCE(fus.status, 'normal') AS user_status,
    fa.details,
    fa.created_at,
    fa.resolved_at,
    fa.resolution_notes
  FROM public.fraud_alerts fa
  LEFT JOIN public.profiles p ON p.id = fa.user_id
  LEFT JOIN public.fraud_rules fr ON fr.id = fa.rule_id
  LEFT JOIN public.fraud_user_scores fus ON fus.user_id = fa.user_id AND fus.user_type = fa.user_type
  WHERE
    (p_user_type IS NULL OR fa.user_type = p_user_type)
    AND (p_risk_level IS NULL OR fa.risk_level = p_risk_level)
    AND (p_status IS NULL OR fa.status = p_status)
  ORDER BY
    CASE WHEN fa.status = 'active' THEN 0
         WHEN fa.status = 'under_review' THEN 1
         ELSE 2 END,
    fa.risk_score DESC,
    fa.created_at DESC
  LIMIT p_limit;
$$;

-- ─── 12. RPC: Get User Fraud History ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_fraud_history(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'score_id', fus.id,
      'risk_score', fus.risk_score,
      'status', fus.status,
      'alert_count', fus.alert_count,
      'resolved_count', fus.resolved_count,
      'blocked_count', fus.blocked_count,
      'withdrawals_frozen', fus.withdrawals_frozen,
      'last_alert_at', fus.last_alert_at,
      'created_at', fus.created_at
    )
  ), '[]'::JSONB) AS scores
  FROM public.fraud_user_scores fus
  WHERE fus.user_id = p_user_id;
$$;

-- ─── 13. RPC: Resolve Fraud Alert ───────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_fraud_alert(
  p_alert_id UUID,
  p_action TEXT,
  p_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_alert RECORD;
  v_score_id UUID;
BEGIN
  SELECT * INTO v_alert FROM public.fraud_alerts WHERE id = p_alert_id;
  IF v_alert IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Alerta no encontrada');
  END IF;

  -- Update alert
  UPDATE public.fraud_alerts
  SET status = p_action,
      resolved_at = now(),
      resolved_by = auth.uid(),
      resolution_notes = p_notes
  WHERE id = p_alert_id;

  -- Update user score
  SELECT id INTO v_score_id FROM public.fraud_user_scores
  WHERE user_id = v_alert.user_id AND user_type = v_alert.user_type;

  IF v_score_id IS NOT NULL THEN
    IF p_action = 'blocked' THEN
      UPDATE public.fraud_user_scores
      SET blocked_count = blocked_count + 1,
          status = 'blocked',
          withdrawals_frozen = true,
          resolved_count = resolved_count + 1,
          updated_at = now()
      WHERE id = v_score_id;

      -- Deactivate user
      UPDATE public.profiles SET is_active = false WHERE id = v_alert.user_id;

    ELSIF p_action = 'approved' THEN
      UPDATE public.fraud_user_scores
      SET risk_score = GREATEST(0, risk_score - v_alert.risk_score),
          resolved_count = resolved_count + 1,
          status = CASE
            WHEN GREATEST(0, risk_score - v_alert.risk_score) <= 30 THEN 'normal'
            WHEN GREATEST(0, risk_score - v_alert.risk_score) <= 60 THEN 'suspicious'
            ELSE 'high_risk'
          END,
          updated_at = now()
      WHERE id = v_score_id;

    ELSIF p_action = 'dismissed' THEN
      UPDATE public.fraud_user_scores
      SET resolved_count = resolved_count + 1,
          updated_at = now()
      WHERE id = v_score_id;

    ELSIF p_action = 'under_review' THEN
      UPDATE public.fraud_user_scores
      SET status = CASE
        WHEN risk_score > 60 THEN 'high_risk'
        WHEN risk_score > 30 THEN 'suspicious'
        ELSE 'normal'
      END,
          updated_at = now()
      WHERE id = v_score_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'action', p_action, 'alert_id', p_alert_id);
END;
$$;

-- ─── 14. RPC: Freeze / Unfreeze Withdrawals ─────────────────────
CREATE OR REPLACE FUNCTION public.toggle_withdrawal_freeze(
  p_user_id UUID,
  p_user_type TEXT,
  p_freeze BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_score_id UUID;
BEGIN
  v_score_id := public.get_or_create_fraud_score(p_user_id, p_user_type);

  UPDATE public.fraud_user_scores
  SET withdrawals_frozen = p_freeze,
      status = CASE
        WHEN p_freeze AND risk_score > 60 THEN 'high_risk'
        WHEN p_freeze AND risk_score > 30 THEN 'suspicious'
        WHEN NOT p_freeze AND risk_score <= 30 THEN 'normal'
        WHEN NOT p_freeze AND risk_score <= 60 THEN 'suspicious'
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_score_id;

  RETURN jsonb_build_object('success', true, 'frozen', p_freeze);
END;
$$;

-- ─── 15. RPC: Get Fraud Rules ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_fraud_rules()
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  user_type TEXT,
  condition_key TEXT,
  threshold_params JSONB,
  points INTEGER,
  auto_action TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT * FROM public.fraud_rules ORDER BY user_type, points DESC;
$$;

-- ─── 16. RPC: Toggle Rule Active ────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_fraud_rule(p_rule_id UUID, p_active BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.fraud_rules SET is_active = p_active WHERE id = p_rule_id;
  RETURN jsonb_build_object('success', true, 'active', p_active);
END;
$$;

-- ─── 17. RPC: Run All Pending Fraud Checks ──────────────────────
-- Admin can trigger a batch scan of all recent activity
CREATE OR REPLACE FUNCTION public.run_fraud_scan_all()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_alerts_before INTEGER;
  v_alerts_after INTEGER;
  v_scanned INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO v_alerts_before FROM public.fraud_alerts WHERE status = 'active';

  -- Scan clients with recent activity
  FOR rec IN
    SELECT DISTINCT customer_id AS uid FROM public.deliveries
    WHERE created_at > now() - INTERVAL '24 hours' AND customer_id IS NOT NULL
  LOOP
    PERFORM public.run_fraud_check(rec.uid, 'client');
    v_scanned := v_scanned + 1;
  END LOOP;

  -- Scan vendors with recent activity
  FOR rec IN
    SELECT DISTINCT vendor_id AS uid FROM public.deliveries
    WHERE created_at > now() - INTERVAL '24 hours' AND vendor_id IS NOT NULL
  LOOP
    PERFORM public.run_fraud_check(rec.uid, 'vendor');
    v_scanned := v_scanned + 1;
  END LOOP;

  -- Scan couriers with recent activity
  FOR rec IN
    SELECT DISTINCT courier_id AS uid FROM public.deliveries
    WHERE created_at > now() - INTERVAL '24 hours' AND courier_id IS NOT NULL
  LOOP
    PERFORM public.run_fraud_check(rec.uid, 'courier');
    v_scanned := v_scanned + 1;
  END LOOP;

  -- Scan drivers with recent activity
  FOR rec IN
    SELECT DISTINCT id AS uid FROM public.drivers
    WHERE last_online_at > now() - INTERVAL '24 hours'
  LOOP
    PERFORM public.run_fraud_check(rec.uid, 'driver');
    v_scanned := v_scanned + 1;
  END LOOP;

  SELECT COUNT(*) INTO v_alerts_after FROM public.fraud_alerts WHERE status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'users_scanned', v_scanned,
    'new_alerts', v_alerts_after - v_alerts_before,
    'total_active_alerts', v_alerts_after
  );
END;
$$;

-- ─── 18. RPC: Get Top Risk Users ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_top_risk_users(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  user_type TEXT,
  risk_score INTEGER,
  status TEXT,
  alert_count INTEGER,
  blocked_count INTEGER,
  withdrawals_frozen BOOLEAN,
  last_alert_at TIMESTAMPTZ,
  user_is_active BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    fus.user_id,
    p.name AS user_name,
    p.email AS user_email,
    p.phone AS user_phone,
    fus.user_type,
    fus.risk_score,
    fus.status,
    fus.alert_count,
    fus.blocked_count,
    fus.withdrawals_frozen,
    fus.last_alert_at,
    p.is_active AS user_is_active
  FROM public.fraud_user_scores fus
  LEFT JOIN public.profiles p ON p.id = fus.user_id
  ORDER BY fus.risk_score DESC, fus.alert_count DESC
  LIMIT p_limit;
$$;

-- ─── 19. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user ON public.fraud_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON public.fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_risk ON public.fraud_alerts(risk_level);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_type ON public.fraud_alerts(user_type);
CREATE INDEX IF NOT EXISTS idx_fraud_scores_user ON public.fraud_user_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_scores_status ON public.fraud_user_scores(status);
CREATE INDEX IF NOT EXISTS idx_fraud_rule_hits_user ON public.fraud_rule_hits(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_rules_type ON public.fraud_rules(user_type);

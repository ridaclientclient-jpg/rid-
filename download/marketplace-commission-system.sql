-- ═══════════════════════════════════════════════════════════════════
-- RIDA SUPREME SYSTEM — Marketplace Commission + Courier Withdrawal
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Marketplace Commission Settings ─────────────────────────
INSERT INTO settings (key, value, type) VALUES
  ('marketplace_commission_pct', '15', 'number'),
  ('marketplace_commission_fixed', '0', 'number'),
  ('courier_withdrawal_min', '10000', 'number'),
  ('courier_withdrawal_step', '10', 'number'),
  ('courier_withdrawal_hold_hours', '48', 'number'),
  ('courier_withdrawal_max_per_day', '5', 'number')
ON CONFLICT (key) DO NOTHING;


-- ─── 2. Courier Wallets ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courier_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) DEFAULT 0,
  available_balance NUMERIC(12,2) DEFAULT 0,
  pending_balance NUMERIC(12,2) DEFAULT 0,
  total_earned NUMERIC(12,2) DEFAULT 0,
  total_withdrawn NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(courier_id)
);

-- Auto-create wallet when a courier is created/updated
CREATE OR REPLACE FUNCTION public.ensure_courier_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.courier_wallets (courier_id)
  VALUES (NEW.id)
  ON CONFLICT (courier_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_courier_wallet ON public.couriers;
CREATE TRIGGER trg_ensure_courier_wallet
  AFTER INSERT ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.ensure_courier_wallet();

-- Backfill existing couriers
INSERT INTO public.courier_wallets (courier_id)
  SELECT id FROM public.couriers
  ON CONFLICT (courier_id) DO NOTHING;


-- ─── 3. Courier Withdrawal Queue ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.courier_withdrawals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  courier_id UUID NOT NULL REFERENCES public.couriers(id),
  wallet_id UUID NOT NULL REFERENCES public.courier_wallets(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  queue_position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  payment_method TEXT DEFAULT 'card',
  error_message TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  processable_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '48 hours'),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assign next queue position on insert
CREATE OR REPLACE FUNCTION public.assign_withdrawal_queue_position()
RETURNS TRIGGER AS $$
DECLARE
  next_pos INTEGER;
BEGIN
  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO next_pos
  FROM public.courier_withdrawals
  WHERE status IN ('queued','processing');
  NEW.queue_position := next_pos;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_queue_position ON public.courier_withdrawals;
CREATE TRIGGER trg_assign_queue_position
  BEFORE INSERT ON public.courier_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.assign_withdrawal_queue_position();


-- ─── 4. Courier Wallet Transactions ────────────────────────────
CREATE TABLE IF NOT EXISTS public.courier_wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  courier_id UUID NOT NULL REFERENCES public.couriers(id),
  wallet_id UUID NOT NULL REFERENCES public.courier_wallets(id),
  withdrawal_id UUID REFERENCES public.courier_withdrawals(id),
  delivery_id UUID REFERENCES public.deliveries(id),
  type TEXT NOT NULL DEFAULT 'earning'
    CHECK (type IN ('earning','withdrawal','adjustment','commission')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'completed'
    CHECK (status IN ('completed','pending','failed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);


-- ─── 5. RLS Policies ───────────────────────────────────────────

-- courier_wallets
ALTER TABLE public.courier_wallets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Courier can view own wallet" ON public.courier_wallets
    FOR SELECT USING (courier_id = (SELECT id FROM public.couriers WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Courier can update own wallet" ON public.courier_wallets
    FOR UPDATE USING (courier_id = (SELECT id FROM public.couriers WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all courier wallets" ON public.courier_wallets
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update all courier wallets" ON public.courier_wallets
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- courier_withdrawals
ALTER TABLE public.courier_withdrawals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Courier can view own withdrawals" ON public.courier_withdrawals
    FOR SELECT USING (courier_id = (SELECT id FROM public.couriers WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Courier can insert own withdrawals" ON public.courier_withdrawals
    FOR INSERT WITH CHECK (courier_id = (SELECT id FROM public.couriers WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Courier can update own withdrawals" ON public.courier_withdrawals
    FOR UPDATE USING (courier_id = (SELECT id FROM public.couriers WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all withdrawals" ON public.courier_withdrawals
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update all withdrawals" ON public.courier_withdrawals
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- courier_wallet_transactions
ALTER TABLE public.courier_wallet_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Courier can view own transactions" ON public.courier_wallet_transactions
    FOR SELECT USING (courier_id = (SELECT id FROM public.couriers WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all courier transactions" ON public.courier_wallet_transactions
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── 6. RPC: Submit Courier Withdrawal ─────────────────────────
CREATE OR REPLACE FUNCTION public.submit_courier_withdrawal(
  p_courier_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
  v_min_amount NUMERIC;
  v_step NUMERIC;
  v_max_daily INTEGER;
  v_hold_hours INTEGER;
  v_today_count INTEGER;
  v_withdrawal_id UUID;
  v_result JSONB;
BEGIN
  -- Get wallet
  SELECT * INTO v_wallet FROM public.courier_wallets WHERE courier_id = p_courier_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Billetera no encontrada');
  END IF;

  -- Get settings
  SELECT COALESCE(value::numeric, 10000) INTO v_min_amount FROM public.settings WHERE key = 'courier_withdrawal_min';
  SELECT COALESCE(value::numeric, 10) INTO v_step FROM public.settings WHERE key = 'courier_withdrawal_step';
  SELECT COALESCE(value::numeric, 5) INTO v_max_daily FROM public.settings WHERE key = 'courier_withdrawal_max_per_day';
  SELECT COALESCE(value::numeric, 48) INTO v_hold_hours FROM public.settings WHERE key = 'courier_withdrawal_hold_hours';

  -- Validate min amount
  IF p_amount < v_min_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monto minimo de retiro: ' || v_min_amount::text || ' colones');
  END IF;

  -- Validate multiples
  IF v_step > 0 AND (p_amount % v_step) != 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El monto debe ser multiplo de ' || v_step::text || ' colones');
  END IF;

  -- Validate available balance
  IF v_wallet.available_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo disponible insuficiente');
  END IF;

  -- Validate daily limit
  SELECT COUNT(*) INTO v_today_count
  FROM public.courier_withdrawals
  WHERE courier_id = p_courier_id
    AND status IN ('queued','processing','completed')
    AND requested_at::date = now()::date;

  IF v_today_count >= v_max_daily THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite diario de retiros alcanzado (' || v_max_daily::text || ' por dia)');
  END IF;

  -- Deduct from wallet
  UPDATE public.courier_wallets
  SET balance = balance - p_amount,
      available_balance = available_balance - p_amount,
      total_withdrawn = total_withdrawn + p_amount,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Insert withdrawal (trigger assigns queue_position)
  INSERT INTO public.courier_withdrawals (courier_id, wallet_id, amount, processable_at)
  VALUES (p_courier_id, v_wallet.id, p_amount, now() + (v_hold_hours || ' hours')::INTERVAL)
  RETURNING id INTO v_withdrawal_id;

  -- Record transaction
  INSERT INTO public.courier_wallet_transactions (courier_id, wallet_id, withdrawal_id, type, amount, description, status)
  VALUES (p_courier_id, v_wallet.id, v_withdrawal_id, 'withdrawal', -p_amount, 'Retiro solicitado - en fila de espera', 'completed');

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'message', 'Retiro en fila de espera - disponible en ' || v_hold_hours || ' horas'
  );
END;
$$;


-- ─── 7. RPC: Process Withdrawal Queue ──────────────────────────
CREATE OR REPLACE FUNCTION public.process_withdrawal_queue()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_withdrawal RECORD;
BEGIN
  FOR v_withdrawal IN
    SELECT * FROM public.courier_withdrawals
    WHERE status = 'queued'
      AND processable_at <= now()
    ORDER BY queue_position ASC
    LIMIT 3
  LOOP
    UPDATE public.courier_withdrawals
    SET status = 'completed',
        processed_at = now()
    WHERE id = v_withdrawal.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('processed', v_count, 'message', v_count || ' retiros procesados');
END;
$$;


-- ─── 8. RPC: Get Courier Wallet Dashboard ──────────────────────
CREATE OR REPLACE FUNCTION public.get_courier_wallet(p_courier_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'wallet', row_to_json(w.*),
    'recent_transactions', (
      SELECT COALESCE(jsonb_agg(row_to_json(t.*)), '[]'::jsonb)
      FROM (
        SELECT * FROM public.courier_wallet_transactions
        WHERE courier_id = p_courier_id
        ORDER BY created_at DESC
        LIMIT 20
      ) t
    ),
    'pending_withdrawals', (
      SELECT COALESCE(jsonb_agg(row_to_json(wd.*)), '[]'::jsonb)
      FROM (
        SELECT * FROM public.courier_withdrawals
        WHERE courier_id = p_courier_id AND status IN ('queued','processing')
        ORDER BY queue_position ASC
      ) wd
    ),
    'queue_position', (
      SELECT MIN(queue_position)
      FROM public.courier_withdrawals
      WHERE status IN ('queued','processing')
    )
  )
  FROM public.courier_wallets w
  WHERE w.courier_id = p_courier_id;
$$;


-- ─── 9. RPC: Admin Get All Withdrawals ─────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_all_withdrawals()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', wd.id,
      'courier_id', wd.courier_id,
      'courier_name', p.name,
      'amount', wd.amount,
      'queue_position', wd.queue_position,
      'status', wd.status,
      'payment_method', wd.payment_method,
      'requested_at', wd.requested_at,
      'processable_at', wd.processable_at,
      'processed_at', wd.processed_at,
      'error_message', wd.error_message
    )
    ORDER BY CASE WHEN wd.status = 'queued' THEN 0 WHEN wd.status = 'processing' THEN 1 ELSE 2 END,
             wd.queue_position ASC
  ), '[]'::jsonb)
  FROM public.courier_withdrawals wd
  LEFT JOIN public.couriers c ON c.id = wd.courier_id
  LEFT JOIN public.profiles p ON p.id = c.user_id;
$$;


-- ─── 10. RPC: Apply Marketplace Commission on Order ────────────
CREATE OR REPLACE FUNCTION public.apply_marketplace_commission(
  p_delivery_id UUID,
  p_vendor_id UUID,
  p_courier_id UUID,
  p_total NUMERIC,
  p_payment_method TEXT DEFAULT 'card'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_commission_pct NUMERIC;
  v_commission_fixed NUMERIC;
  v_platform_commission NUMERIC;
  v_vendor_earning NUMERIC;
  v_courier_fee NUMERIC;
  v_delivery_fee NUMERIC;
BEGIN
  -- Get commission settings
  SELECT COALESCE(value::numeric, 15) INTO v_commission_pct FROM public.settings WHERE key = 'marketplace_commission_pct';
  SELECT COALESCE(value::numeric, 0) INTO v_commission_fixed FROM public.settings WHERE key = 'marketplace_commission_fixed';

  -- Calculate commission
  v_platform_commission := ROUND((p_total * v_commission_pct / 100) + v_commission_fixed, 2);
  v_vendor_earning := ROUND(p_total - v_platform_commission, 2);

  -- Update delivery with commission info
  UPDATE public.deliveries
  SET commission_rate = v_commission_pct,
      commission = v_platform_commission,
      vendor_earning = v_vendor_earning
  WHERE id = p_delivery_id;

  -- Credit vendor wallet
  IF p_vendor_id IS NOT NULL THEN
    INSERT INTO public.vendor_wallets (vendor_id)
    VALUES (p_vendor_id)
    ON CONFLICT (vendor_id) DO NOTHING;

    UPDATE public.vendor_wallets
    SET balance = balance + v_vendor_earning,
        total_earned = total_earned + v_vendor_earning,
        updated_at = now()
    WHERE vendor_id = p_vendor_id;

    INSERT INTO public.vendor_transactions (vendor_id, wallet_id, type, amount, description, delivery_id, status)
    SELECT p_vendor_id, vw.id, 'earning', v_vendor_earning,
           'Pedido completado - comision ' || v_commission_pct || '% aplicada',
           p_delivery_id,
           CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'completed' END
    FROM public.vendor_wallets vw WHERE vw.vendor_id = p_vendor_id;
  END IF;

  -- Credit courier wallet (delivery fee portion)
  IF p_courier_id IS NOT NULL THEN
    INSERT INTO public.courier_wallets (courier_id)
    VALUES (p_courier_id)
    ON CONFLICT (courier_id) DO NOTHING;

    -- Get delivery fee from the delivery record
    SELECT COALESCE(delivery_fee, 0) INTO v_courier_fee
    FROM public.deliveries WHERE id = p_delivery_id;

    IF p_payment_method = 'card' THEN
      -- Card payment: courier earns go to available balance after 48h hold
      UPDATE public.courier_wallets
      SET balance = balance + v_courier_fee,
          pending_balance = pending_balance + v_courier_fee,
          total_earned = total_earned + v_courier_fee,
          updated_at = now()
      WHERE courier_id = p_courier_id;

      INSERT INTO public.courier_wallet_transactions (courier_id, wallet_id, delivery_id, type, amount, description, status)
      SELECT p_courier_id, cw.id, p_delivery_id, 'earning', v_courier_fee,
             'Delivery completado - pago tarjeta (retirable en 48h)',
             'pending'
      FROM public.courier_wallets cw WHERE cw.courier_id = p_courier_id;
    ELSE
      -- Cash payment: courier gets cash directly, platform only gets data
      INSERT INTO public.courier_wallet_transactions (courier_id, wallet_id, delivery_id, type, amount, description, status)
      SELECT p_courier_id, cw.id, p_delivery_id, 'earning', v_courier_fee,
             'Delivery completado - pago en efectivo',
             'completed'
      FROM public.courier_wallets cw WHERE cw.courier_id = p_courier_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'platform_commission', v_platform_commission,
    'vendor_earning', v_vendor_earning,
    'courier_fee', v_courier_fee,
    'payment_method', p_payment_method
  );
END;
$$;


-- ─── 11. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courier_wallets_courier_id ON public.courier_wallets(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_withdrawals_courier_id ON public.courier_withdrawals(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_withdrawals_status ON public.courier_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_courier_withdrawals_queue ON public.courier_withdrawals(status, queue_position);
CREATE INDEX IF NOT EXISTS idx_courier_wallet_tx_courier_id ON public.courier_wallet_transactions(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_wallet_tx_wallet_id ON public.courier_wallet_transactions(wallet_id);

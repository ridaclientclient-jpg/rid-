-- ═══════════════════════════════════════════════════════════════
-- RIDA SUPREME SYSTEM – Marketplace Commission + Courier Withdrawals
-- ═══════════════════════════════════════════════════════════════
-- 1. Courier wallets & transactions
-- 2. Withdrawal queue (48h wait, ₡10,000 min, multiples of 10,000)
-- 3. Marketplace commission settings
-- 4. Commission auto-calculation on delivery completion
-- 5. RLS policies
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Courier Wallets ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courier_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  available_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(courier_id)
);

-- ─── 2. Courier Transactions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courier_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.courier_wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earning','withdrawal','adjustment','commission')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  delivery_id UUID REFERENCES public.deliveries(id),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','processing','completed','failed','queued')),
  queue_position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. Withdrawal Queue ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.courier_wallets(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  queue_position INTEGER,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processable_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  processed_at TIMESTAMPTZ,
  notes TEXT
);

-- ─── 4. Auto-create courier wallet ──────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_courier_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.courier_wallets (courier_id)
  SELECT NEW.id
  WHERE NOT EXISTS (SELECT 1 FROM public.courier_wallets WHERE courier_id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_courier_wallet ON public.couriers;
CREATE TRIGGER trg_ensure_courier_wallet
  AFTER INSERT ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.ensure_courier_wallet();

-- Backfill wallets for existing couriers
INSERT INTO public.courier_wallets (courier_id)
SELECT c.id FROM public.couriers c
WHERE NOT EXISTS (SELECT 1 FROM public.courier_wallets cw WHERE cw.courier_id = c.id);

-- ─── 5. Marketplace Commission Settings ─────────────────────────
INSERT INTO public.settings (key, value, type) VALUES
  ('marketplace_commission_pct', '15', 'number'),
  ('marketplace_min_withdrawal', '10000', 'number'),
  ('withdrawal_step', '10000', 'number'),
  ('withdrawal_delay_hours', '48', 'number'),
  ('withdrawals_per_batch', '5', 'number')
ON CONFLICT (key) DO NOTHING;

-- ─── 6. RLS ─────────────────────────────────────────────────────
ALTER TABLE public.courier_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Admin can see all
DO $$ BEGIN
  CREATE POLICY "Admins see all courier wallets"
    ON public.courier_wallets FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins see all courier transactions"
    ON public.courier_transactions FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins see all withdrawal requests"
    ON public.withdrawal_requests FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

-- Courier sees own wallet via SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_my_courier_wallet_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT cw.id FROM public.courier_wallets cw
  JOIN public.couriers c ON c.id = cw.courier_id
  WHERE c.user_id = auth.uid();
$$;

DO $$ BEGIN
  CREATE POLICY "Courier sees own wallet"
    ON public.courier_wallets FOR SELECT
    USING (id = public.get_my_courier_wallet_id());
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Courier sees own transactions"
    ON public.courier_transactions FOR SELECT
    USING (courier_id IN (
      SELECT c.id FROM public.couriers c WHERE c.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Courier sees own withdrawals"
    ON public.withdrawal_requests FOR SELECT
    USING (courier_id IN (
      SELECT c.id FROM public.couriers c WHERE c.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Courier can insert own withdrawals"
    ON public.withdrawal_requests FOR INSERT
    WITH CHECK (courier_id IN (
      SELECT c.id FROM public.couriers c WHERE c.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

DO $$ BEGIN
  CREATE POLICY "Courier can update own withdrawals"
    ON public.withdrawal_requests FOR UPDATE
    USING (courier_id IN (
      SELECT c.id FROM public.couriers c WHERE c.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'policy exists';
END $$;

-- ─── 7. RPC: Request Withdrawal ─────────────────────────────────
-- Validates: min ₡10,000, multiples of 10,000, sufficient balance, only from available_balance
CREATE OR REPLACE FUNCTION public.request_courier_withdrawal(p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_courier_id UUID;
  v_wallet RECORD;
  v_min NUMERIC;
  v_step NUMERIC;
  v_queue_pos INTEGER;
  v_request_id UUID;
  v_err_msg TEXT;
BEGIN
  -- Get courier id
  SELECT c.id INTO v_courier_id
  FROM public.couriers c WHERE c.user_id = auth.uid();
  IF v_courier_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No eres repartidor');
  END IF;

  -- Get wallet
  SELECT * INTO v_wallet FROM public.courier_wallets WHERE courier_id = v_courier_id;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Billetera no encontrada');
  END IF;

  -- Get settings
  SELECT COALESCE(s.value::NUMERIC, 10000) INTO v_min FROM public.settings s WHERE s.key = 'marketplace_min_withdrawal';
  SELECT COALESCE(s.value::NUMERIC, 10000) INTO v_step FROM public.settings s WHERE s.key = 'withdrawal_step';

  -- Validate min amount
  IF p_amount < v_min THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monto minimo de retiro: ₡' || v_min);
  END IF;

  -- Validate multiples
  IF p_amount % v_step != 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'El monto debe ser multiplo de ₡' || v_step);
  END IF;

  -- Validate balance
  IF v_wallet.available_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo disponible insuficiente', 'available', v_wallet.available_balance);
  END IF;

  -- Calculate queue position
  SELECT COALESCE(MAX(queue_position), 0) INTO v_queue_pos
  FROM public.withdrawal_requests
  WHERE status IN ('queued', 'processing');

  v_queue_pos := v_queue_pos + 1;

  -- Deduct from available, keep in pending
  UPDATE public.courier_wallets
  SET available_balance = available_balance - p_amount,
      pending_balance = pending_balance + p_amount,
      updated_at = now()
  WHERE courier_id = v_courier_id;

  -- Create withdrawal request
  INSERT INTO public.withdrawal_requests (courier_id, wallet_id, amount, queue_position)
  VALUES (v_courier_id, v_wallet.id, p_amount, v_queue_pos)
  RETURNING id INTO v_request_id;

  -- Record transaction
  INSERT INTO public.courier_transactions (courier_id, wallet_id, type, amount, description, status, queue_position)
  VALUES (v_courier_id, v_wallet.id, 'withdrawal', p_amount, 'Retiro solicitado - Fila #' || v_queue_pos, 'queued', v_queue_pos);

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'queue_position', v_queue_pos,
    'amount', p_amount,
    'message', 'Retiro en fila #' || v_queue_pos || '. Se procesara en 48 horas.'
  );
END;
$$;

-- ─── 8. RPC: Get Withdrawal Queue (Admin) ───────────────────────
CREATE OR REPLACE FUNCTION public.get_withdrawal_queue()
RETURNS TABLE (
  id UUID,
  courier_id UUID,
  courier_name TEXT,
  courier_phone TEXT,
  amount NUMERIC,
  status TEXT,
  queue_position INTEGER,
  requested_at TIMESTAMPTZ,
  processable_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  notes TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    wr.id,
    wr.courier_id,
    p.name AS courier_name,
    p.phone AS courier_phone,
    wr.amount,
    wr.status,
    wr.queue_position,
    wr.requested_at,
    wr.processable_at,
    wr.processed_at,
    wr.notes
  FROM public.withdrawal_requests wr
  JOIN public.couriers c ON c.id = wr.courier_id
  JOIN public.profiles p ON p.id = c.user_id
  ORDER BY
    CASE WHEN wr.status IN ('queued','processing') THEN 0 ELSE 1 END,
    wr.queue_position ASC,
    wr.requested_at DESC;
$$;

-- ─── 9. RPC: Process Next Withdrawals (Admin) ───────────────────
CREATE OR REPLACE FUNCTION public.process_next_withdrawals(p_count INTEGER DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_batch RECORD;
  v_processed INTEGER := 0;
  v_delay_hours INTEGER;
BEGIN
  SELECT COALESCE(s.value::INTEGER, 48) INTO v_delay_hours FROM public.settings s WHERE s.key = 'withdrawal_delay_hours';

  FOR v_batch IN
    SELECT wr.*
    FROM public.withdrawal_requests wr
    WHERE wr.status = 'queued'
      AND wr.processable_at <= now()
    ORDER BY wr.queue_position ASC
    LIMIT p_count
  LOOP
    UPDATE public.withdrawal_requests
    SET status = 'completed',
        processed_at = now(),
        notes = COALESCE(notes, '') || ' Procesado automaticamente'
    WHERE id = v_batch.id;

    -- Update wallet: reduce pending, reduce total
    UPDATE public.courier_wallets
    SET pending_balance = GREATEST(0, pending_balance - v_batch.amount),
        total_withdrawn = total_withdrawn + v_batch.amount,
        balance = balance - v_batch.amount,
        updated_at = now()
    WHERE courier_id = v_batch.courier_id;

    -- Mark transaction completed
    UPDATE public.courier_transactions
    SET status = 'completed',
        description = COALESCE(description, '') || ' - Completado'
    WHERE withdrawal_id = v_batch.id OR (type = 'withdrawal' AND status = 'queued' AND amount = v_batch.amount);

    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_processed);
END;
$$;

-- ─── 10. RPC: Cancel Withdrawal ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_withdrawal(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_wr RECORD;
BEGIN
  SELECT * INTO v_wr FROM public.withdrawal_requests WHERE id = p_request_id;
  IF v_wr IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retiro no encontrado');
  END IF;
  IF v_wr.status NOT IN ('queued') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden cancelar retiros en fila');
  END IF;

  -- Restore available balance
  UPDATE public.courier_wallets
  SET available_balance = available_balance + v_wr.amount,
      pending_balance = GREATEST(0, pending_balance - v_wr.amount),
      updated_at = now()
  WHERE courier_id = v_wr.courier_id;

  UPDATE public.withdrawal_requests
  SET status = 'cancelled', notes = 'Cancelado por el repartidor'
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Retiro cancelado, saldo restaurado');
END;
$$;

-- ─── 11. RPC: Apply Marketplace Commission on Delivery ──────────
-- Call this when a delivery is completed (status → 'delivered')
CREATE OR REPLACE FUNCTION public.apply_marketplace_commission(p_delivery_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_del RECORD;
  v_comm_pct NUMERIC;
  v_commission NUMERIC;
  v_vendor_net NUMERIC;
  v_courier_fee NUMERIC;
BEGIN
  SELECT * INTO v_del FROM public.deliveries WHERE id = p_delivery_id;
  IF v_del IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;
  IF v_del.status != 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido no esta entregado');
  END IF;

  -- Get commission % from settings
  SELECT COALESCE(s.value::NUMERIC, 15) INTO v_comm_pct FROM public.settings s WHERE s.key = 'marketplace_commission_pct';

  -- Calculate
  v_commission := ROUND(v_del.total * v_comm_pct / 100, 2);
  v_vendor_net := v_del.total - v_commission;
  v_courier_fee := COALESCE(v_del.delivery_fee, 0);

  -- Credit vendor wallet (vendor net)
  IF v_del.vendor_id IS NOT NULL THEN
    INSERT INTO public.vendor_wallets (vendor_id)
    SELECT v_del.vendor_id
    WHERE NOT EXISTS (SELECT 1 FROM public.vendor_wallets WHERE vendor_id = v_del.vendor_id);

    UPDATE public.vendor_wallets
    SET balance = balance + v_vendor_net,
        total_earned = total_earned + v_vendor_net,
        updated_at = now()
    WHERE vendor_id = v_del.vendor_id;

    INSERT INTO public.vendor_transactions (vendor_id, wallet_id, type, amount, description, delivery_id, status)
    SELECT
      v_del.vendor_id,
      vw.id,
      'earning',
      v_vendor_net,
      'Pedido #' || LEFT(p_delivery_id::TEXT, 8) || ' - Ganancia neta (comision ' || v_comm_pct || '% aplicada)',
      p_delivery_id,
      'completed'
    FROM public.vendor_wallets vw WHERE vw.vendor_id = v_del.vendor_id;
  END IF;

  -- Credit courier wallet (delivery fee)
  IF v_del.courier_id IS NOT NULL AND v_courier_fee > 0 THEN
    -- Ensure wallet exists
    INSERT INTO public.courier_wallets (courier_id)
    SELECT v_del.courier_id
    WHERE NOT EXISTS (SELECT 1 FROM public.courier_wallets WHERE courier_id = v_del.courier_id);

    UPDATE public.courier_wallets
    SET balance = balance + v_courier_fee,
        total_earned = total_earned + v_courier_fee,
        pending_balance = pending_balance + v_courier_fee,
        updated_at = now()
    WHERE courier_id = v_del.courier_id;

    INSERT INTO public.courier_transactions (courier_id, wallet_id, type, amount, description, delivery_id, status)
    SELECT
      v_del.courier_id,
      cw.id,
      'earning',
      v_courier_fee,
      CASE
        WHEN v_del.payment_method = 'cash' THEN
          'Envio #' || LEFT(p_delivery_id::TEXT, 8) || ' - Cobro efectivo (comision pendiente del negocio)'
        ELSE
          'Envio #' || LEFT(p_delivery_id::TEXT, 8) || ' - Tarjeta (disponible en 48h)'
      END,
      p_delivery_id,
      CASE
        WHEN v_del.payment_method = 'cash' THEN 'completed'
        ELSE 'pending'
      END
    FROM public.courier_wallets cw WHERE cw.courier_id = v_del.courier_id;

    -- If cash: courier gets delivery_fee immediately (available)
    IF v_del.payment_method = 'cash' THEN
      UPDATE public.courier_wallets
      SET available_balance = available_balance + v_courier_fee,
          pending_balance = GREATEST(0, pending_balance - v_courier_fee)
      WHERE courier_id = v_del.courier_id;
    END IF;
  END IF;

  -- Update delivery record with commission info
  UPDATE public.deliveries
  SET items = COALESCE(items, '[]'::JSONB) ||
    jsonb_build_object('_commission_pct', v_comm_pct, '_platform_commission', v_commission, '_vendor_net', v_vendor_net)
  WHERE id = p_delivery_id;

  RETURN jsonb_build_object(
    'success', true,
    'commission_pct', v_comm_pct,
    'platform_commission', v_commission,
    'vendor_net', v_vendor_net,
    'courier_fee', v_courier_fee,
    'payment_method', v_del.payment_method
  );
END;
$$;

-- ─── 12. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courier_wallets_courier ON public.courier_wallets(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_transactions_courier ON public.courier_transactions(courier_id);
CREATE INDEX IF NOT EXISTS idx_courier_transactions_wallet ON public.courier_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_courier ON public.withdrawal_requests(courier_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_processable ON public.withdrawal_requests(processable_at) WHERE status = 'queued';

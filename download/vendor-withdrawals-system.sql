-- ============================================================
-- RIDA SUPREME SYSTEM - VENDOR WITHDRAWALS SYSTEM
-- Allows vendors to request payouts and admin to process them
-- ============================================================

-- ─── 1. Vendor Withdrawals Table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.vendor_wallets(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  bank_details JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. RLS ─────────────────────────────────────────────────────
ALTER TABLE public.vendor_withdrawals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Vendors can view own withdrawals" ON public.vendor_withdrawals
    FOR SELECT USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Vendors can insert own withdrawals" ON public.vendor_withdrawals
    FOR INSERT WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all vendor withdrawals" ON public.vendor_withdrawals
    FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. RPC: Request Vendor Withdrawal ──────────────────────────
DROP FUNCTION IF EXISTS public.request_vendor_withdrawal(UUID, NUMERIC, JSONB);
CREATE OR REPLACE FUNCTION public.request_vendor_withdrawal(
  p_vendor_id UUID,
  p_amount NUMERIC,
  p_bank_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
  v_min_amount NUMERIC;
  v_withdrawal_id UUID;
BEGIN
  -- Get wallet
  SELECT * INTO v_wallet FROM public.vendor_wallets WHERE vendor_id = p_vendor_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Billetera no encontrada');
  END IF;

  -- Security check: user must own the vendor
  IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id = p_vendor_id AND user_id = auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
  END IF;

  -- Get min amount from settings (default 10,000)
  SELECT COALESCE(value::numeric, 10000) INTO v_min_amount FROM public.settings WHERE key = 'marketplace_min_withdrawal';

  -- Validate amount
  IF p_amount < v_min_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Monto minimo de retiro: ' || v_min_amount::text || ' colones');
  END IF;

  -- Validate balance (must be in available balance, which for vendors currently is just balance)
  -- If we implement a hold period later, we would use available_balance.
  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insuficiente');
  END IF;

  -- 1. Deduct from balance, move to pending
  UPDATE public.vendor_wallets
  SET balance = balance - p_amount,
      pending_balance = pending_balance + p_amount,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- 2. Insert withdrawal request
  INSERT INTO public.vendor_withdrawals (vendor_id, wallet_id, amount, bank_details)
  VALUES (p_vendor_id, v_wallet.id, p_amount, p_bank_details)
  RETURNING id INTO v_withdrawal_id;

  -- 3. Record transaction
  INSERT INTO public.vendor_transactions (vendor_id, wallet_id, type, amount, description, status)
  VALUES (p_vendor_id, v_wallet.id, 'withdrawal', p_amount, 'Retiro solicitado - en proceso', 'pending');

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'message', 'Solicitud de retiro enviada exitosamente'
  );
END;
$$;

-- ─── 4. RPC: Admin Process Vendor Withdrawal ────────────────────
DROP FUNCTION IF EXISTS public.admin_process_vendor_withdrawal(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_process_vendor_withdrawal(
  p_withdrawal_id UUID,
  p_status TEXT, -- 'completed' or 'failed'
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_wr RECORD;
BEGIN
  -- Admin check
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
  END IF;

  SELECT * INTO v_wr FROM public.vendor_withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retiro no encontrado');
  END IF;

  IF v_wr.status != 'queued' AND v_wr.status != 'processing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este retiro ya fue procesado');
  END IF;

  IF p_status = 'completed' THEN
    UPDATE public.vendor_withdrawals
    SET status = 'completed',
        processed_at = now(),
        notes = COALESCE(p_notes, notes)
    WHERE id = p_withdrawal_id;

    -- Update wallet: remove from pending, add to total_withdrawn
    UPDATE public.vendor_wallets
    SET pending_balance = GREATEST(0, pending_balance - v_wr.amount),
        total_withdrawn = total_withdrawn + v_wr.amount,
        updated_at = now()
    WHERE id = v_wr.wallet_id;

    -- Update transaction
    UPDATE public.vendor_transactions
    SET status = 'completed',
        description = 'Retiro completado exitosamente'
    WHERE vendor_id = v_wr.vendor_id AND type = 'withdrawal' AND amount = v_wr.amount AND status = 'pending';

  ELSIF p_status = 'failed' THEN
    UPDATE public.vendor_withdrawals
    SET status = 'failed',
        notes = COALESCE(p_notes, 'Error al procesar el retiro')
    WHERE id = p_withdrawal_id;

    -- Restore balance
    UPDATE public.vendor_wallets
    SET balance = balance + v_wr.amount,
        pending_balance = GREATEST(0, pending_balance - v_wr.amount),
        updated_at = now()
    WHERE id = v_wr.wallet_id;

    -- Update transaction
    UPDATE public.vendor_transactions
    SET status = 'failed',
        description = 'Retiro fallido: ' || COALESCE(p_notes, 'Ver detalles')
    WHERE vendor_id = v_wr.vendor_id AND type = 'withdrawal' AND amount = v_wr.amount AND status = 'pending';
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_status);
END;
$$;

-- ─── 5. Realtime ────────────────────────────────────────────────
-- La publicación ya está configurada para todas las tablas.

NOTIFY pgrst, 'reload schema';

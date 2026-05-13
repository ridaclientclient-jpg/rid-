-- ============================================================
-- RIDA SUPREME SYSTEM - PROCESS MARKETPLACE PAYMENT RPC
-- Deducts balance from user wallet and records transaction
-- ============================================================

DROP FUNCTION IF EXISTS public.process_marketplace_payment(UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.process_marketplace_payment(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT, new_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC;
BEGIN
  -- 1. Get wallet and lock for update
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Billetera no encontrada'::TEXT, 0::NUMERIC;
    RETURN;
  END IF;

  -- 2. Check balance
  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT FALSE, 'Saldo insuficiente'::TEXT, v_current_balance;
    RETURN;
  END IF;

  -- 3. Deduct balance
  UPDATE public.wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_current_balance;

  -- 4. Record transaction
  INSERT INTO public.transactions (
    wallet_id,
    amount,
    type,
    status,
    description
  ) VALUES (
    v_wallet_id,
    p_amount,
    'debit',
    'completed',
    p_description
  );

  RETURN QUERY SELECT TRUE, 'Pago procesado exitosamente'::TEXT, v_current_balance;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.process_marketplace_payment(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_marketplace_payment(UUID, NUMERIC, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

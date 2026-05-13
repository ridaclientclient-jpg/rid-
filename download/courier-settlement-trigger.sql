-- ============================================================
-- RIDA SUPREME SYSTEM - COURIER SETTLEMENT TRIGGER
-- Automatically pays the courier the delivery fee when delivered
-- ============================================================

DROP FUNCTION IF EXISTS public.record_vendor_and_courier_earning() CASCADE;

CREATE OR REPLACE FUNCTION public.record_vendor_and_courier_earning()
RETURNS TRIGGER AS $$
DECLARE
  v_v_wallet_id UUID;
  v_c_wallet_id UUID;
  v_vendor_share DECIMAL(12,2);
  v_courier_share DECIMAL(12,2);
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    
    -- 1. VENDOR EARNING (85% of subtotal)
    IF NEW.vendor_id IS NOT NULL THEN
      SELECT id INTO v_v_wallet_id FROM public.vendor_wallets WHERE vendor_id = NEW.vendor_id;

      IF v_v_wallet_id IS NOT NULL THEN
        v_vendor_share := (NEW.subtotal::DECIMAL * 0.85);

        UPDATE public.vendor_wallets
        SET
          balance = balance + v_vendor_share,
          total_earned = total_earned + v_vendor_share,
          pending_balance = pending_balance + v_vendor_share
        WHERE id = v_v_wallet_id;

        INSERT INTO public.vendor_transactions (vendor_id, wallet_id, type, amount, description, delivery_id, status)
        VALUES (NEW.vendor_id, v_v_wallet_id, 'earning', v_vendor_share, 'Ganancia por pedido #' || LEFT(NEW.id::TEXT, 8), NEW.id, 'completed');

        -- Update product sold counts
        IF NEW.items IS NOT NULL AND jsonb_array_length(NEW.items) > 0 THEN
          BEGIN
            UPDATE public.products p
            SET sold_count = COALESCE(p.sold_count, 0) + (item->>'qty')::INT
            FROM jsonb_array_elements(NEW.items) AS item
            WHERE p.id = (item->>'id')::UUID;
          EXCEPTION WHEN OTHERS THEN
            NULL; -- Ignore errors in sold_count update
          END;
        END IF;
      END IF;
    END IF;

    -- 2. COURIER EARNING (100% of delivery_fee for now)
    IF NEW.courier_id IS NOT NULL THEN
      -- Get the user_id of the courier to find their wallet
      SELECT w.id INTO v_c_wallet_id 
      FROM public.wallets w
      JOIN public.couriers c ON c.user_id = w.user_id
      WHERE c.id = NEW.courier_id;

      IF v_c_wallet_id IS NOT NULL THEN
        v_courier_share := NEW.delivery_fee::DECIMAL;

        UPDATE public.wallets
        SET balance = balance + v_courier_share
        WHERE id = v_c_wallet_id;

        INSERT INTO public.transactions (wallet_id, amount, type, status, description)
        VALUES (v_c_wallet_id, v_courier_share, 'credit', 'completed', 'Pago por entrega #' || LEFT(NEW.id::TEXT, 8));
        
        -- Also update courier stats
        UPDATE public.couriers
        SET total_earnings = total_earnings + v_courier_share,
            total_deliveries = total_deliveries + 1
        WHERE id = NEW.courier_id;
      END IF;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger
DROP TRIGGER IF EXISTS on_delivery_completed_earning ON public.deliveries;
CREATE TRIGGER on_delivery_completed_earning
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.record_vendor_and_courier_earning();

NOTIFY pgrst, 'reload schema';

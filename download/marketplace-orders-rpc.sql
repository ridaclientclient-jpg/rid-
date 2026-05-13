-- ============================================================
-- RIDA SUPREME SYSTEM - GET VENDOR ORDERS RPC (SECURITY DEFINER)
-- Bypass RLS to allow vendors to see their orders with details
-- ============================================================

DROP FUNCTION IF EXISTS public.get_vendor_orders(UUID);

CREATE OR REPLACE FUNCTION public.get_vendor_orders(p_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'customer_id', d.customer_id,
      'vendor_id', d.vendor_id,
      'courier_id', d.courier_id,
      'status', d.status,
      'delivery_address', d.delivery_address,
      'pickup_address', d.pickup_address,
      'items', d.items,
      'subtotal', d.subtotal,
      'delivery_fee', d.delivery_fee,
      'total', d.total,
      'payment_method', d.payment_method,
      'notes', d.notes,
      'created_at', d.created_at,
      'profiles', (
        SELECT jsonb_build_object(
          'name', p.name,
          'phone', p.phone,
          'email', p.email
        )
        FROM public.profiles p
        WHERE p.id = d.customer_id
      ),
      'couriers', (
        SELECT jsonb_build_object(
          'id', c.id,
          'user_id', c.user_id,
          'status', c.status,
          'vehicle_type', c.vehicle_type,
          'profiles', (
            SELECT jsonb_build_object(
              'name', cp.name,
              'phone', cp.phone
            )
            FROM public.profiles cp
            WHERE cp.id = c.user_id
          )
        )
        FROM public.couriers c
        WHERE c.id = d.courier_id
      )
    )
    ORDER BY d.created_at DESC
  ) INTO v_result
  FROM public.deliveries d
  WHERE d.vendor_id = p_vendor_id;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_vendor_orders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_orders(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';

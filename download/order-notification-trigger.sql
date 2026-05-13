-- ============================================================
-- RIDA SUPREME SYSTEM - ORDER NOTIFICATION TRIGGER
-- Automatically notifies Vendor, Courier, and Customer on status changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_vendor_user_id UUID;
  v_courier_user_id UUID;
  v_customer_user_id UUID;
  v_notif_title TEXT;
  v_notif_body TEXT;
  v_notif_type TEXT := 'info';
BEGIN
  -- Get User IDs for the participants
  -- 1. Customer
  v_customer_user_id := NEW.customer_id;
  
  -- 2. Vendor
  SELECT user_id INTO v_vendor_user_id FROM public.vendors WHERE id = NEW.vendor_id;
  
  -- 3. Courier (if assigned)
  IF NEW.courier_id IS NOT NULL THEN
    SELECT user_id INTO v_courier_user_id FROM public.couriers WHERE id = NEW.courier_id;
  END IF;

  -- Logic based on status
  CASE NEW.status
    WHEN 'pending' THEN
      -- Notify Vendor only if it's new
      IF OLD.status IS NULL OR OLD.status != 'pending' THEN
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
          v_vendor_user_id,
          '¡Nuevo Pedido!',
          'Has recibido un nuevo pedido #' || LEFT(NEW.id::TEXT, 8),
          'order_new',
          jsonb_build_object('delivery_id', NEW.id, 'status', NEW.status)
        );
      END IF;

    WHEN 'assigned' THEN
      -- Notify Customer
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        v_customer_user_id,
        'Pedido Asignado',
        'Un repartidor ha tomado tu pedido y va en camino al comercio.',
        'order_assigned',
        jsonb_build_object('delivery_id', NEW.id, 'status', NEW.status)
      );
      
      -- Notify Courier
      IF v_courier_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
          v_courier_user_id,
          'Nueva Entrega',
          'Se te ha asignado el pedido #' || LEFT(NEW.id::TEXT, 8),
          'order_assigned',
          jsonb_build_object('delivery_id', NEW.id, 'status', NEW.status)
        );
      END IF;

    WHEN 'picked_up' THEN
      -- Notify Customer
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        v_customer_user_id,
        'Pedido Recogido',
        'Tu pedido ya está con el repartidor y va hacia tu ubicación.',
        'order_transit',
        jsonb_build_object('delivery_id', NEW.id, 'status', NEW.status)
      );

    WHEN 'delivered' THEN
      -- Notify Customer
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        v_customer_user_id,
        '¡Pedido Entregado!',
        '¡Buen provecho! Tu pedido ha sido entregado exitosamente.',
        'order_delivered',
        jsonb_build_object('delivery_id', NEW.id, 'status', NEW.status)
      );
      
      -- Notify Vendor
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        v_vendor_user_id,
        'Pedido Completado',
        'El pedido #' || LEFT(NEW.id::TEXT, 8) || ' ha sido entregado.',
        'order_delivered',
        jsonb_build_object('delivery_id', NEW.id, 'status', NEW.status)
      );

    WHEN 'cancelled' THEN
      -- Notify participants
      v_notif_body := 'El pedido #' || LEFT(NEW.id::TEXT, 8) || ' ha sido cancelado.';
      
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (v_customer_user_id, 'Pedido Cancelado', v_notif_body, 'order_cancelled', jsonb_build_object('delivery_id', NEW.id));
      
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (v_vendor_user_id, 'Pedido Cancelado', v_notif_body, 'order_cancelled', jsonb_build_object('delivery_id', NEW.id));
      
      IF v_courier_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (v_courier_user_id, 'Pedido Cancelado', v_notif_body, 'order_cancelled', jsonb_build_object('delivery_id', NEW.id));
      END IF;

    ELSE
      -- Do nothing for other states
  END CASE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS on_delivery_status_notification ON public.deliveries;
CREATE TRIGGER on_delivery_status_notification
  AFTER INSERT OR UPDATE OF status ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

NOTIFY pgrst, 'reload schema';

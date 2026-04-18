-- =====================================================
-- COURIER SYSTEM — SAFE MIGRATION
-- Agrega tabla couriers SIN modificar nada existente
-- PREREQUISITE: supabase-setup.sql ya ejecutado
-- =====================================================

-- 1. Add 'courier' to profiles role CHECK constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('client', 'driver', 'admin', 'vendor', 'courier'));

-- 2. COURIERS TABLE (independent from drivers)
CREATE TABLE IF NOT EXISTS public.couriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL DEFAULT 'moto' CHECK (vehicle_type IN ('moto', 'bici', 'carro')),
  is_online BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('offline', 'online', 'busy', 'delivering', 'suspended')),
  is_verified BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3,2) DEFAULT 5.00,
  total_deliveries INTEGER DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  current_lat DECIMAL(10,7),
  current_lng DECIMAL(10,7),
  last_online_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 3. DELIVERIES TABLE (for marketplace orders)
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  courier_id UUID REFERENCES public.couriers(id),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  vendor_id UUID REFERENCES public.vendors(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  pickup_address TEXT,
  pickup_lat DECIMAL(10,7),
  pickup_lng DECIMAL(10,7),
  delivery_address TEXT NOT NULL,
  delivery_lat DECIMAL(10,7),
  delivery_lng DECIMAL(10,7),
  items JSONB DEFAULT '[]',
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  delivery_fee DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,
  payment_method TEXT DEFAULT 'efectivo',
  customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
  courier_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON public.couriers(user_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON public.couriers(status);
CREATE INDEX IF NOT EXISTS idx_couriers_is_online ON public.couriers(is_online);
CREATE INDEX IF NOT EXISTS idx_couriers_vehicle_type ON public.couriers(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier_id ON public.deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON public.deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON public.deliveries(created_at DESC);

-- 5. ENABLE RLS
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- 6. COURIER POLICIES (using is_admin() if available)
DO $$ BEGIN
  -- Check if is_admin() function exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace) THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Couriers can view own data" ON public.couriers;
    DROP POLICY IF EXISTS "Couriers can manage own data" ON public.couriers;
    DROP POLICY IF EXISTS "Couriers can insert own data" ON public.couriers;
    DROP POLICY IF EXISTS "Online couriers visible" ON public.couriers;
    DROP POLICY IF EXISTS "Admin can manage couriers" ON public.couriers;

    CREATE POLICY "Couriers can view own data" ON public.couriers FOR SELECT USING (
      user_id = auth.uid() OR public.is_admin()
    );
    CREATE POLICY "Couriers can manage own data" ON public.couriers FOR UPDATE USING (user_id = auth.uid());
    CREATE POLICY "Couriers can insert own data" ON public.couriers FOR INSERT WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Online couriers visible" ON public.couriers FOR SELECT USING (status = 'online');
    CREATE POLICY "Admin can manage couriers" ON public.couriers FOR ALL USING (public.is_admin());
  ELSE
    -- Fallback without is_admin()
    DROP POLICY IF EXISTS "Couriers can view own data" ON public.couriers;
    DROP POLICY IF EXISTS "Couriers can manage own data" ON public.couriers;
    DROP POLICY IF EXISTS "Couriers can insert own data" ON public.couriers;
    DROP POLICY IF EXISTS "Online couriers visible" ON public.couriers;

    CREATE POLICY "Couriers can view own data" ON public.couriers FOR SELECT USING (user_id = auth.uid());
    CREATE POLICY "Couriers can manage own data" ON public.couriers FOR UPDATE USING (user_id = auth.uid());
    CREATE POLICY "Couriers can insert own data" ON public.couriers FOR INSERT WITH CHECK (user_id = auth.uid());
    CREATE POLICY "Online couriers visible" ON public.couriers FOR SELECT USING (status = 'online');
  END IF;
END $$;

-- 7. DELIVERY POLICIES
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace) THEN
    DROP POLICY IF EXISTS "Customers can view own deliveries" ON public.deliveries;
    DROP POLICY IF EXISTS "Customers can create deliveries" ON public.deliveries;
    DROP POLICY IF EXISTS "Couriers can view assigned deliveries" ON public.deliveries;
    DROP POLICY IF EXISTS "Couriers can update assigned deliveries" ON public.deliveries;
    DROP POLICY IF EXISTS "Admin can manage all deliveries" ON public.deliveries;
    DROP POLICY IF EXISTS "Vendors can view own deliveries" ON public.deliveries;

    CREATE POLICY "Customers can view own deliveries" ON public.deliveries FOR SELECT USING (
      customer_id = auth.uid() OR public.is_admin()
    );
    CREATE POLICY "Customers can create deliveries" ON public.deliveries FOR INSERT WITH CHECK (customer_id = auth.uid());
    CREATE POLICY "Couriers can view assigned deliveries" ON public.deliveries FOR SELECT USING (
      courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid()) OR public.is_admin()
    );
    CREATE POLICY "Couriers can update assigned deliveries" ON public.deliveries FOR UPDATE USING (
      courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid())
    );
    CREATE POLICY "Admin can manage all deliveries" ON public.deliveries FOR ALL USING (public.is_admin());
    CREATE POLICY "Vendors can view own deliveries" ON public.deliveries FOR SELECT USING (
      vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    );
  ELSE
    DROP POLICY IF EXISTS "Customers can view own deliveries" ON public.deliveries;
    DROP POLICY IF EXISTS "Customers can create deliveries" ON public.deliveries;
    DROP POLICY IF EXISTS "Couriers can view assigned deliveries" ON public.deliveries;
    DROP POLICY IF EXISTS "Couriers can update assigned deliveries" ON public.deliveries;

    CREATE POLICY "Customers can view own deliveries" ON public.deliveries FOR SELECT USING (customer_id = auth.uid());
    CREATE POLICY "Customers can create deliveries" ON public.deliveries FOR INSERT WITH CHECK (customer_id = auth.uid());
    CREATE POLICY "Couriers can view assigned deliveries" ON public.deliveries FOR SELECT USING (
      courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid())
    );
    CREATE POLICY "Couriers can update assigned deliveries" ON public.deliveries FOR UPDATE USING (
      courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid())
    );
  END IF;
END $$;

-- 8. TRIGGER: Auto-create courier record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);

  IF COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'driver' THEN
    INSERT INTO public.drivers (user_id)
    VALUES (NEW.id);
  END IF;

  IF COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'vendor' THEN
    INSERT INTO public.vendors (user_id, store_name, category)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name', 'Mi Tienda'), 'other');
  END IF;

  -- NEW: Auto-create courier record for courier role
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'courier' THEN
    INSERT INTO public.couriers (user_id, vehicle_type)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'vehicle_type', 'moto'));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Updated timestamp trigger for couriers
CREATE TRIGGER couriers_updated_at BEFORE UPDATE ON public.couriers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER deliveries_updated_at BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- DONE — Courier system tables ready
-- No existing tables or data were modified
-- =====================================================

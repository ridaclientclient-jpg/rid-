-- ============================================================
-- RIDA SUPREME SYSTEM - SQL CONSOLIDADO DE LA SESION
-- Todas las mejoras y arreglos aplicados en esta sesion
-- Ejecutar en SQL Editor de Supabase
-- ============================================================
-- Contenido:
--   1. Funciones SECURITY DEFINER (is_admin, is_admin_or_super_admin)
--   2. RLS fixes para vendors (select/insert/update propias)
--   3. RLS fixes para deliveries (politica unificada para todas las partes)
--   4. RLS fixes para profiles y couriers (visibilidad para vendors en pedidos)
--   5. Marketplace Overhaul completo (tablas, columnas, triggers, RLS, settings, indices, realtime)
--   6. RLS fixes generales para recursion (todos los admin policies)
-- ============================================================


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  1. FUNCIONES SECURITY DEFINER (sin recursion en RLS)                         ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- is_admin(): Checkea si el usuario autenticado es admin O super_admin
-- SECURITY DEFINER = se ejecuta como owner de la tabla, bypass RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$;

-- is_admin_or_super_admin(): Version explicita para checks directos
CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$;


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  2. RLS FIXES PARA VENDORS (lectura/escritura propias + admin completo)      ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Vendors pueden ver su propio registro
DO $$ BEGIN
  CREATE POLICY "vendors_select_own" ON public.vendors
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendors pueden insertar su propio registro (auto-creacion desde hook)
DO $$ BEGIN
  CREATE POLICY "vendors_insert_own" ON public.vendors
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendors pueden actualizar su propio registro
DO $$ BEGIN
  CREATE POLICY "vendors_update_own" ON public.vendors
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin puede ver todos los vendors
DO $$ BEGIN
  CREATE POLICY "vendors_admin_select_all" ON public.vendors
    FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin puede actualizar vendors (aprobar/suspender)
DO $$ BEGIN
  CREATE POLICY "vendors_admin_update" ON public.vendors
    FOR UPDATE USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  3. RLS FIXES PARA DELIVERIES (politica unificada para todas las partes)     ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- Primero eliminar politicas viejas restrictivas que causaban 412
DROP POLICY IF EXISTS "Delivery customers can view own" ON public.deliveries;
DROP POLICY IF EXISTS "Delivery customers can update own" ON public.deliveries;
DROP POLICY IF EXISTS "Delivery vendors can view assigned" ON public.deliveries;
DROP POLICY IF EXISTS "Delivery vendors can update assigned" ON public.deliveries;
DROP POLICY IF EXISTS "Delivery couriers can view assigned" ON public.deliveries;
DROP POLICY IF EXISTS "Delivery couriers can update assigned" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_parties_update" ON public.deliveries;

-- Politica SELECT unificada: customer, vendor, courier, admin pueden ver
DO $$ BEGIN
  CREATE POLICY "deliveries_parties_select" ON public.deliveries
    FOR SELECT USING (
      customer_id = auth.uid()
      OR vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
      OR courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid())
      OR public.is_admin()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Politica UPDATE unificada: customer, vendor, courier, admin pueden actualizar
DO $$ BEGIN
  CREATE POLICY "deliveries_parties_update" ON public.deliveries
    FOR UPDATE USING (
      customer_id = auth.uid()
      OR vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
      OR courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid())
      OR public.is_admin()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Politica INSERT: cualquier usuario autenticado puede crear delivery
DO $$ BEGIN
  CREATE POLICY "deliveries_authenticated_insert" ON public.deliveries
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin puede hacer todo
DO $$ BEGIN
  CREATE POLICY "deliveries_admin_all" ON public.deliveries
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  4. RLS FIXES PARA PROFILES Y COURIERS (visibilidad para vendors)          ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- Permite a vendors leer profiles de clientes que tienen deliveries con su vendor
DO $$ BEGIN
  CREATE POLICY "profiles_visible_for_vendor_orders" ON public.profiles
    FOR SELECT USING (
      id = auth.uid()
      OR public.is_admin()
      OR id IN (
        SELECT d.customer_id FROM public.deliveries d
        WHERE d.vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Permite a vendors leer datos de couriers asignados a sus deliveries
DO $$ BEGIN
  CREATE POLICY "couriers_visible_for_vendor_deliveries" ON public.couriers
    FOR SELECT USING (
      user_id = auth.uid()
      OR public.is_admin()
      OR id IN (
        SELECT d.courier_id FROM public.deliveries d
        WHERE d.vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  5. RLS FIXES GENERALES - TODAS LAS TABLAS (sin recursion)                  ║
-- ║     Asegura que TODOS los admin policies usen is_admin()                     ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- Profiles
DO $$ BEGIN
  CREATE POLICY "Admin can view all profiles" ON public.profiles
    FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can update all profiles" ON public.profiles
    FOR UPDATE USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drivers
DROP POLICY IF EXISTS "Drivers can view own data" ON public.drivers;
DROP POLICY IF EXISTS "Admin can manage drivers" ON public.drivers;
DROP POLICY IF EXISTS "Active drivers visible for ride matching" ON public.drivers;

DO $$ BEGIN
  CREATE POLICY "Drivers can view own data" ON public.drivers FOR SELECT USING (
    user_id = auth.uid() OR public.is_admin()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can manage drivers" ON public.drivers FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Active drivers visible for ride matching" ON public.drivers FOR SELECT USING (status = 'online');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vehicles
DROP POLICY IF EXISTS "Vehicle access via driver" ON public.vehicles;
DO $$ BEGIN
  CREATE POLICY "Vehicle access via driver" ON public.vehicles FOR ALL USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
    OR public.is_admin()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rides
DROP POLICY IF EXISTS "Riders can view own rides" ON public.rides;
DROP POLICY IF EXISTS "Admin can manage all rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can view available rides" ON public.rides;

DO $$ BEGIN
  CREATE POLICY "Riders can view own rides" ON public.rides FOR SELECT USING (
    rider_id = auth.uid()
    OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
    OR public.is_admin()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can manage all rides" ON public.rides FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Drivers can view available rides" ON public.rides FOR SELECT USING (status = 'searching');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Wallets
DROP POLICY IF EXISTS "Admin can view all wallets" ON public.wallets;
DO $$ BEGIN
  CREATE POLICY "Admin can view all wallets" ON public.wallets FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Documents
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Admin can manage documents" ON public.documents;
DO $$ BEGIN
  CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING (
    user_id = auth.uid() OR public.is_admin()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admin can manage documents" ON public.documents FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reports
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
DROP POLICY IF EXISTS "Admin can manage reports" ON public.reports;
DO $$ BEGIN
  CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT USING (
    user_id = auth.uid() OR public.is_admin()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admin can manage reports" ON public.reports FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Products (vendor + admin)
DO $$ BEGIN
  CREATE POLICY "products_vendor_update_own" ON public.products
    FOR UPDATE USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()))
    WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "products_vendor_delete_own" ON public.products
    FOR DELETE USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "products_admin_all" ON public.products
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DO $$ BEGIN
  CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (
    user_id = auth.uid() OR public.is_admin()
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Settings
DROP POLICY IF EXISTS "Settings visible to all authenticated" ON public.settings;
DROP POLICY IF EXISTS "Admin can manage settings" ON public.settings;
DO $$ BEGIN
  CREATE POLICY "Settings visible to all authenticated" ON public.settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admin can manage settings" ON public.settings FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- SOS Events
DROP POLICY IF EXISTS "Admin can view all SOS" ON public.sos_events;
DROP POLICY IF EXISTS "Admin can resolve SOS" ON public.sos_events;
DO $$ BEGIN
  CREATE POLICY "Admin can view all SOS" ON public.sos_events FOR SELECT USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admin can resolve SOS" ON public.sos_events FOR UPDATE USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Couriers (admin manage)
DO $$ BEGIN
  CREATE POLICY "Admin can manage couriers" ON public.couriers FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  6. MARKETPLACE OVERHAUL COMPLETO                                           ║
-- ║     (Tablas nuevas, columnas nuevas, triggers, RLS, settings, indices,      ║
-- ║      realtime)                                                               ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ──────────────────────────────────────────────────────────────────
-- 6.1 TABLA marketplace_categories
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketplace_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.marketplace_categories (name, icon, sort_order) VALUES
  ('Comida', 'UtensilsCrossed', 1),
  ('Farmacia', 'Pill', 2),
  ('Tiendas', 'ShoppingBag', 3),
  ('Bebidas', 'Wine', 4),
  ('Panaderia', 'Croissant', 5),
  ('Supermercado', 'ShoppingCart', 6),
  ('Mascotas', 'PawPrint', 7),
  ('Otros', 'Package', 99)
ON CONFLICT (name) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────
-- 6.2 TABLA vendor_wallets + vendor_transactions
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_earned DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_withdrawn DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  pending_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendor_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES public.vendor_wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earning', 'withdrawal', 'adjustment')),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  delivery_id UUID REFERENCES public.deliveries(id),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────
-- 6.3 TABLA product_reviews
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES public.deliveries(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, product_id, delivery_id)
);

-- ──────────────────────────────────────────────────────────────────
-- 6.4 Columnas nuevas en vendors
-- ──────────────────────────────────────────────────────────────────
DO $$ BEGIN ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS logo_url TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS phone TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS address TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{"mon":{"open":"08:00","close":"22:00","active":true},"tue":{"open":"08:00","close":"22:00","active":true},"wed":{"open":"08:00","close":"22:00","active":true},"thu":{"open":"08:00","close":"22:00","active":true},"fri":{"open":"08:00","close":"22:00","active":true},"sat":{"open":"08:00","close":"22:00","active":true},"sun":{"open":"08:00","close":"22:00","active":true}}'::JSONB; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10,2) DEFAULT 0.00; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS delivery_radius_km INT DEFAULT 10; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0.00; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────
-- 6.5 Columnas nuevas en products
-- ──────────────────────────────────────────────────────────────────
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold_count INT DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.products ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0.00; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────
-- 6.6 TRIGGERS
-- ──────────────────────────────────────────────────────────────────

-- Funcion updated_at generica
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- vendors updated_at
DO $$ BEGIN
  CREATE TRIGGER vendors_updated_at
    BEFORE UPDATE ON public.vendors
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- products updated_at
DO $$ BEGIN
  CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- vendor_wallets updated_at
DO $$ BEGIN
  CREATE TRIGGER vendor_wallets_updated_at
    BEFORE UPDATE ON public.vendor_wallets
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-crear wallet cuando se crea un vendor
CREATE OR REPLACE FUNCTION public.create_vendor_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.vendor_wallets (vendor_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER on_vendor_created_wallet
    AFTER INSERT ON public.vendors
    FOR EACH ROW EXECUTE FUNCTION public.create_vendor_wallet();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-actualizar avg_rating en producto cuando se inserta review
CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET avg_rating = COALESCE(
    (SELECT AVG(rating) FROM public.product_reviews WHERE product_id = NEW.product_id), 0
  )
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER on_review_insert_update_rating
    AFTER INSERT ON public.product_reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_product_rating();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-registrar ganancia del vendor cuando delivery se marca delivered (85% comision)
CREATE OR REPLACE FUNCTION public.record_vendor_earning()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_id UUID;
  v_vendor_share DECIMAL(12,2);
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    IF NEW.vendor_id IS NOT NULL THEN
      SELECT id INTO v_wallet_id FROM public.vendor_wallets WHERE vendor_id = NEW.vendor_id;

      IF v_wallet_id IS NOT NULL THEN
        v_vendor_share := (NEW.subtotal::DECIMAL * 0.85);

        UPDATE public.vendor_wallets
        SET
          balance = balance + v_vendor_share,
          total_earned = total_earned + v_vendor_share,
          pending_balance = pending_balance + v_vendor_share
        WHERE id = v_wallet_id;

        INSERT INTO public.vendor_transactions (vendor_id, wallet_id, type, amount, description, delivery_id, status)
        VALUES (NEW.vendor_id, v_wallet_id, 'earning', v_vendor_share, 'Ganancia por pedido #' || LEFT(NEW.id::TEXT, 8), NEW.id, 'completed');

        IF NEW.items IS NOT NULL AND jsonb_array_length(NEW.items) > 0 THEN
          FOR item_rec IN SELECT * FROM jsonb_array_elements(NEW.items) AS elem
          LOOP
            IF item_rec->>'id' IS NOT NULL THEN
              UPDATE public.products
              SET sold_count = COALESCE(sold_count, 0) + COALESCE((item_rec->>'qty')::INT, 1)
              WHERE id = (item_rec->>'id')::UUID;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER on_delivery_completed_earning
    AFTER UPDATE ON public.deliveries
    FOR EACH ROW EXECUTE FUNCTION public.record_vendor_earning();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- 6.7 RLS para tablas nuevas del marketplace
-- ──────────────────────────────────────────────────────────────────

-- marketplace_categories: lectura publica, admin gestiona
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "categories_public_read" ON public.marketplace_categories
    FOR SELECT USING (is_active = TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "categories_admin_all" ON public.marketplace_categories
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- vendor_wallets: vendor ve propias, admin todo
ALTER TABLE public.vendor_wallets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "wallets_vendor_read_own" ON public.vendor_wallets
    FOR SELECT USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "wallets_admin_all" ON public.vendor_wallets
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- vendor_transactions: vendor ve propias, admin todo
ALTER TABLE public.vendor_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "transactions_vendor_read_own" ON public.vendor_transactions
    FOR SELECT USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "transactions_admin_all" ON public.vendor_transactions
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- product_reviews: lectura publica, customer inserta, vendor elimina, admin todo
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "reviews_public_read" ON public.product_reviews
    FOR SELECT USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reviews_customer_insert" ON public.product_reviews
    FOR INSERT WITH CHECK (customer_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reviews_vendor_delete" ON public.product_reviews
    FOR DELETE USING (
      product_id IN (SELECT id FROM public.products WHERE vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reviews_admin_all" ON public.product_reviews
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- 6.8 SETTINGS del marketplace
-- ──────────────────────────────────────────────────────────────────
INSERT INTO public.settings (key, value, type) VALUES
  ('marketplace_commission_rate', '15', 'number'),
  ('marketplace_min_delivery_fee', '500', 'number'),
  ('marketplace_max_delivery_fee', '3000', 'number'),
  ('marketplace_delivery_fee_percentage', '10', 'number'),
  ('marketplace_is_active', 'true', 'boolean'),
  ('marketplace_default_delivery_radius', '10', 'number')
ON CONFLICT (key) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────
-- 6.9 INDEXES para performance
-- ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON public.products(in_stock);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_deliveries_vendor_id ON public.deliveries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON public.deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_vendor_wallets_vendor_id ON public.vendor_wallets(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_transactions_vendor_id ON public.vendor_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_id ON public.product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_categories_sort ON public.marketplace_categories(sort_order);

-- ──────────────────────────────────────────────────────────────────
-- 6.10 REALTIME para tablas del marketplace
-- ──────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_reviews;


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  7. SUPER_ADMIN: Asegurar que kardellridclient@outlook.com sea super_admin  ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'kardellridclient@outlook.com';


-- ============================================================
-- FIN - SQL CONSOLIDADO COMPLETO
-- Todas las mejoras y arreglos de la sesion aplicados
-- ============================================================

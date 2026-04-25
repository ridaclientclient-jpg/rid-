-- ============================================================
-- RIDA SUPREME SYSTEM - MARKETPLACE OVERHAUL
-- Mejora completa estilo Uber Eats / DiDi Food
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  1. TABLA marketplace_categories                             ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.marketplace_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar categorías iniciales
INSERT INTO public.marketplace_categories (name, icon, sort_order) VALUES
  ('Comida', 'UtensilsCrossed', 1),
  ('Farmacia', 'Pill', 2),
  ('Tiendas', 'ShoppingBag', 3),
  ('Bebidas', 'Wine', 4),
  ('Panadería', 'Croissant', 5),
  ('Supermercado', 'ShoppingCart', 6),
  ('Mascotas', 'PawPrint', 7),
  ('Otros', 'Package', 99)
ON CONFLICT (name) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2. TABLA vendor_wallets + vendor_transactions               ║
-- ╚══════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  3. TABLA product_reviews                                    ║
-- ╚══════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  4. Agregar columnas faltantes a vendors                     ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Logo/store image
DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS logo_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Phone
DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS phone TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Address
DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS address TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Opening hours (JSONB)
DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{"mon":{"open":"08:00","close":"22:00","active":true},"tue":{"open":"08:00","close":"22:00","active":true},"wed":{"open":"08:00","close":"22:00","active":true},"thu":{"open":"08:00","close":"22:00","active":true},"fri":{"open":"08:00","close":"22:00","active":true},"sat":{"open":"08:00","close":"22:00","active":true},"sun":{"open":"08:00","close":"22:00","active":true}}'::JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Is active
DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Minimum order amount
DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10,2) DEFAULT 0.00;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Delivery radius in km
DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS delivery_radius_km INT DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Delivery fee (vendor-specific)
DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0.00;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Lat/Lng for vendor location
DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  5. Agregar columnas faltantes a products                    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Stock quantity
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Sold count (denormalized for performance)
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold_count INT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Is featured
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Average rating (denormalized)
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0.00;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  6. TRIGGERS: updated_at auto-update                         ║
-- ╚══════════════════════════════════════════════════════════════╝

-- vendors updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  7. TRIGGER: Auto-create vendor_wallet on vendor creation    ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE OR REPLACE FUNCTION public.create_vendor_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.vendor_wallets (vendor_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER on_vendor_created_wallet
    AFTER INSERT ON public.vendors
    FOR EACH ROW EXECUTE FUNCTION public.create_vendor_wallet();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  8. TRIGGER: Auto-update product avg_rating from reviews     ║
-- ╚══════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  9. TRIGGER: Auto-record vendor earnings on delivery         ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE OR REPLACE FUNCTION public.record_vendor_earning()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_id UUID;
  v_vendor_share DECIMAL(12,2);
BEGIN
  -- Solo cuando se marca como delivered
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    IF NEW.vendor_id IS NOT NULL THEN
      -- Obtener wallet del vendor
      SELECT id INTO v_wallet_id FROM public.vendor_wallets WHERE vendor_id = NEW.vendor_id;

      IF v_wallet_id IS NOT NULL THEN
        -- Calcular ganancia del vendor (subtotal - 15% comisión)
        v_vendor_share := (NEW.subtotal::DECIMAL * 0.85);

        -- Actualizar wallet
        UPDATE public.vendor_wallets
        SET
          balance = balance + v_vendor_share,
          total_earned = total_earned + v_vendor_share,
          pending_balance = pending_balance + v_vendor_share
        WHERE id = v_wallet_id;

        -- Registrar transacción
        INSERT INTO public.vendor_transactions (vendor_id, wallet_id, type, amount, description, delivery_id, status)
        VALUES (NEW.vendor_id, v_wallet_id, 'earning', v_vendor_share, 'Ganancia por pedido #' || LEFT(NEW.id::TEXT, 8), NEW.id, 'completed');

        -- Actualizar sold_count en productos
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  10. RLS POLICIES                                           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- marketplace_categories: public read, admin manage
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

-- vendor_wallets
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

-- vendor_transactions
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

-- product_reviews
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

-- products: asegurar que vendor puede hacer UPDATE completo
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

-- Vendors: admin puede UPDATE (para aprobar/suspender)
DO $$ BEGIN
  CREATE POLICY "vendors_admin_update" ON public.vendors
    FOR UPDATE USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  11. SETTINGS del marketplace                                ║
-- ╚══════════════════════════════════════════════════════════════╝
INSERT INTO public.settings (key, value, type) VALUES
  ('marketplace_commission_rate', '15', 'number'),
  ('marketplace_min_delivery_fee', '500', 'number'),
  ('marketplace_max_delivery_fee', '3000', 'number'),
  ('marketplace_delivery_fee_percentage', '10', 'number'),
  ('marketplace_is_active', 'true', 'boolean'),
  ('marketplace_default_delivery_radius', '10', 'number')
ON CONFLICT (key) DO NOTHING;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  12. INDEXES para performance                                ║
-- ╚══════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  13. REALTIME: Habilitar para tablas del marketplace          ║
-- ╚══════════════════════════════════════════════════════════════╝
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_reviews;

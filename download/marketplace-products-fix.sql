-- ============================================================
-- RIDA SUPREME SYSTEM - MARKETPLACE PRODUCTS - SQL COMPLETO
-- Copiar y pegar TODO en el SQL Editor de Supabase
-- Corrige: productos no visibles, CSV roto, columna image_path
-- ============================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  1. COLUMNAS FALTANTES EN products                          ║
-- ╚══════════════════════════════════════════════════════════════╝

-- image_path (ruta en Storage para URLs firmadas)
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_path TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- stock_quantity
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- sold_count (denormalizado para performance)
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold_count INT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- is_featured
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- avg_rating (denormalizado)
DO $$ BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0.00;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2. COLUMNAS FALTANTES EN vendors                            ║
-- ╚══════════════════════════════════════════════════════════════╝

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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  3. TABLA marketplace_categories (si no existe)             ║
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  4. TABLA vendor_wallets + vendor_transactions              ║
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
-- ║  5. TABLA product_reviews                                   ║
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
-- ║  6. TRIGGERS                                                ║
-- ╚══════════════════════════════════════════════════════════════╝

-- updated_at auto-update
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

DO $$ BEGIN
  CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER vendor_wallets_updated_at
    BEFORE UPDATE ON public.vendor_wallets
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-create wallet on vendor creation
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

-- Auto-update product avg_rating from reviews
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
-- ║  7. RLS POLICIES                                            ║
-- ╚══════════════════════════════════════════════════════════════╝

-- marketplace_categories
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "categories_public_read" ON public.marketplace_categories
    FOR SELECT USING (TRUE);
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

-- products: asegurar RLS activo y policies correctas
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Products visible: todos pueden ver productos en stock, vendors ven los suyos
DO $$ BEGIN
  CREATE POLICY "products_visible_to_all" ON public.products
    FOR SELECT USING (in_stock = TRUE OR vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()) OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendors pueden insertar productos propios
DO $$ BEGIN
  CREATE POLICY "products_vendor_insert_own" ON public.products
    FOR INSERT WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendors pueden actualizar productos propios
DO $$ BEGIN
  CREATE POLICY "products_vendor_update_own" ON public.products
    FOR UPDATE USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()))
    WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendors pueden eliminar productos propios
DO $$ BEGIN
  CREATE POLICY "products_vendor_delete_own" ON public.products
    FOR DELETE USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin puede hacer todo en products
DO $$ BEGIN
  CREATE POLICY "products_admin_all" ON public.products
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendors: asegurar que puede crear su propio registro
DO $$ BEGIN
  CREATE POLICY "vendors_insert_own" ON public.vendors
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "vendors_admin_update" ON public.vendors
    FOR UPDATE USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  8. STORAGE BUCKET: products                                ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Crear bucket si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Vendors pueden subir imágenes
DO $$ BEGIN
  CREATE POLICY "Vendors can upload products" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'products' AND
      (storage.foldername(name))[1] IN (
        SELECT auth.uid()::TEXT
        UNION
        SELECT 'products'  -- allow products/ prefix
      )
      OR EXISTS (SELECT 1 FROM public.vendors WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendors pueden ver y actualizar imágenes propias
DO $$ BEGIN
  CREATE POLICY "Vendors can manage product images" ON storage.objects
    FOR ALL USING (
      bucket_id = 'products'
      AND EXISTS (SELECT 1 FROM public.vendors WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Público puede ver imágenes (bucket es public)
DO $$ BEGIN
  CREATE POLICY "Public read product images" ON storage.objects
    FOR SELECT USING (bucket_id = 'products');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  9. SETTINGS DEL MARKETPLACE                                ║
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
-- ║  10. INDEXES PARA PERFORMANCE                               ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON public.products(in_stock);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_deliveries_vendor_id ON public.deliveries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_vendor_wallets_vendor_id ON public.vendor_wallets(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_transactions_vendor_id ON public.vendor_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_id ON public.product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_categories_sort ON public.marketplace_categories(sort_order);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  11. REALTIME                                               ║
-- ╚══════════════════════════════════════════════════════════════╝

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_categories;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_wallets;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.product_reviews;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ╔═════════════════════════════════════════════════════════════════════════════════════════════════════════
-- ║  ★★★  12. RPCs VENDOR PRODUCTS (SECURITY DEFINER) — ESTO ES LO PRINCIPAL  ★★★                    ║
-- ║  Sin estas funciones, el panel de productos NO funciona.                                                 ║
-- ║  SECURITY DEFINER = bypass RLS, el vendor puede ver/sus productos sin importar las policies.            ║
-- ╚═════════════════════════════════════════════════════════════════════════════════════════════════════════

-- ─── 12.1 GET VENDOR PRODUCTS ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_vendor_products(p_vendor_id UUID)
RETURNS TABLE (
  id UUID,
  vendor_id UUID,
  name TEXT,
  description TEXT,
  price NUMERIC,
  category TEXT,
  image_url TEXT,
  image_path TEXT,
  in_stock BOOLEAN,
  stock_quantity INT,
  sold_count INT,
  is_featured BOOLEAN,
  avg_rating NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id,
    p.vendor_id,
    p.name,
    p.description,
    p.price,
    p.category,
    p.image_url,
    p.image_path,
    p.in_stock,
    p.stock_quantity,
    p.sold_count,
    p.is_featured,
    p.avg_rating,
    p.created_at,
    p.updated_at
  FROM public.products p
  WHERE p.vendor_id = p_vendor_id
  ORDER BY p.created_at DESC;
$$;

-- ─── 12.2 INSERT VENDOR PRODUCT ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.insert_vendor_product(
  p_vendor_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_price NUMERIC,
  p_category TEXT DEFAULT 'General',
  p_in_stock BOOLEAN DEFAULT TRUE,
  p_stock_quantity INT DEFAULT 0,
  p_is_featured BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  vendor_id UUID,
  name TEXT,
  description TEXT,
  price NUMERIC,
  category TEXT,
  image_url TEXT,
  image_path TEXT,
  in_stock BOOLEAN,
  stock_quantity INT,
  sold_count INT,
  is_featured BOOLEAN,
  avg_rating NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
VOLATILE
AS $$
  INSERT INTO public.products (
    vendor_id, name, description, price, category,
    in_stock, stock_quantity, is_featured
  ) VALUES (
    p_vendor_id, p_name, p_description, p_price, p_category,
    p_in_stock, p_stock_quantity, p_is_featured
  )
  RETURNING
    id, vendor_id, name, description, price, category,
    image_url, image_path, in_stock, stock_quantity,
    sold_count, is_featured, avg_rating, created_at, updated_at;
$$;

-- ─── 12.3 UPDATE VENDOR PRODUCT ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_vendor_product(
  p_product_id UUID,
  p_vendor_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_in_stock BOOLEAN DEFAULT NULL,
  p_stock_quantity INT DEFAULT NULL,
  p_is_featured BOOLEAN DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_image_path TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  vendor_id UUID,
  name TEXT,
  description TEXT,
  price NUMERIC,
  category TEXT,
  image_url TEXT,
  image_path TEXT,
  in_stock BOOLEAN,
  stock_quantity INT,
  sold_count INT,
  is_featured BOOLEAN,
  avg_rating NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
VOLATILE
AS $$
  UPDATE public.products
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    price = COALESCE(p_price, price),
    category = COALESCE(p_category, category),
    in_stock = COALESCE(p_in_stock, in_stock),
    stock_quantity = COALESCE(p_stock_quantity, stock_quantity),
    is_featured = COALESCE(p_is_featured, is_featured),
    image_url = COALESCE(p_image_url, image_url),
    image_path = COALESCE(p_image_path, image_path),
    updated_at = NOW()
  WHERE id = p_product_id AND vendor_id = p_vendor_id
  RETURNING
    id, vendor_id, name, description, price, category,
    image_url, image_path, in_stock, stock_quantity,
    sold_count, is_featured, avg_rating, created_at, updated_at;
$$;

-- ─── 12.4 TOGGLE STOCK ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_vendor_product_stock(
  p_product_id UUID,
  p_vendor_id UUID
)
RETURNS TABLE (
  id UUID,
  vendor_id UUID,
  name TEXT,
  in_stock BOOLEAN,
  stock_quantity INT,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
VOLATILE
AS $$
  UPDATE public.products
  SET
    in_stock = NOT in_stock,
    stock_quantity = CASE WHEN NOT in_stock THEN GREATEST(stock_quantity, 0) ELSE 0 END,
    updated_at = NOW()
  WHERE id = p_product_id AND vendor_id = p_vendor_id
  RETURNING id, vendor_id, name, in_stock, stock_quantity, updated_at;
$$;

-- ─── 12.5 TOGGLE FEATURED ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_vendor_product_featured(
  p_product_id UUID,
  p_vendor_id UUID
)
RETURNS TABLE (
  id UUID,
  is_featured BOOLEAN,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
VOLATILE
AS $$
  UPDATE public.products
  SET
    is_featured = NOT is_featured,
    updated_at = NOW()
  WHERE id = p_product_id AND vendor_id = p_vendor_id
  RETURNING id, is_featured, updated_at;
$$;

-- ─── 12.6 DELETE VENDOR PRODUCT ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_vendor_product(
  p_product_id UUID,
  p_vendor_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
VOLATILE
AS $$
  DELETE FROM public.products
  WHERE id = p_product_id AND vendor_id = p_vendor_id;
  SELECT FOUND();
$$;

-- ─── 12.7 BULK INSERT (CSV) ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_insert_vendor_products(
  p_vendor_id UUID,
  p_products JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  name TEXT,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_product JSONB;
  v_idx INT := 0;
  v_name TEXT;
  v_price NUMERIC;
  v_description TEXT;
  v_category TEXT;
  v_in_stock BOOLEAN;
BEGIN
  FOR v_product IN SELECT * FROM jsonb_array_elements(p_products) LOOP
    v_idx := v_idx + 1;
    v_name := NULLIF(v_product->>'nombre', '');
    v_price := NULLIF(v_product->>'precio', '')::NUMERIC;
    v_description := NULLIF(v_product->>'descripcion', '');
    v_category := COALESCE(NULLIF(v_product->>'categoria', ''), 'General');
    v_in_stock := COALESCE(
      (v_product->>'en_stock')::BOOLEAN,
      (LOWER(v_product->>'en_stock') IN ('true', '1', 'si', 'yes')),
      TRUE
    );

    IF v_name IS NULL OR v_price IS NULL OR v_price < 0 THEN
      success := FALSE;
      name := COALESCE(v_name, 'Fila ' || v_idx);
      error := 'Nombre o precio invalido';
      RETURN NEXT;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.products (
        vendor_id, name, description, price, category, in_stock
      ) VALUES (
        p_vendor_id, v_name, v_description, v_price, v_category, v_in_stock
      );
      success := TRUE;
      name := v_name;
      error := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      success := FALSE;
      name := v_name;
      error := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- ─── 12.8 BULK ACTION (stock/featured/delete) ───────────────────
CREATE OR REPLACE FUNCTION public.bulk_vendor_product_action(
  p_vendor_id UUID,
  p_product_ids UUID[],
  p_action TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  CASE p_action
    WHEN 'enable_stock' THEN
      UPDATE public.products SET in_stock = TRUE, stock_quantity = GREATEST(stock_quantity, 1), updated_at = NOW()
        WHERE id = ANY(p_product_ids) AND vendor_id = p_vendor_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'disable_stock' THEN
      UPDATE public.products SET in_stock = FALSE, stock_quantity = 0, updated_at = NOW()
        WHERE id = ANY(p_product_ids) AND vendor_id = p_vendor_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'featured' THEN
      UPDATE public.products SET is_featured = TRUE, updated_at = NOW()
        WHERE id = ANY(p_product_ids) AND vendor_id = p_vendor_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'unfeatured' THEN
      UPDATE public.products SET is_featured = FALSE, updated_at = NOW()
        WHERE id = ANY(p_product_ids) AND vendor_id = p_vendor_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    WHEN 'delete' THEN
      DELETE FROM public.products
        WHERE id = ANY(p_product_ids) AND vendor_id = p_vendor_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
  END CASE;
  RETURN v_count;
END;
$$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  13. REFRESH SCHEMA PARA POSTGREST                         ║
-- ╚══════════════════════════════════════════════════════════════╝

NOTIFY pgrst, 'reload schema';

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  14. VERIFICACION RAPIDA                                    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Verificar que todo quedo bien
SELECT
  'products columns' AS check_name,
  COUNT(*) AS total_columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
UNION ALL
SELECT 'vendor RPCs', COUNT(*)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'get_vendor_products', 'insert_vendor_product', 'update_vendor_product',
    'toggle_vendor_product_stock', 'toggle_vendor_product_featured',
    'delete_vendor_product', 'bulk_insert_vendor_products', 'bulk_vendor_product_action'
  )
UNION ALL
SELECT 'marketplace tables', COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('marketplace_categories', 'vendor_wallets', 'vendor_transactions', 'product_reviews');

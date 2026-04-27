-- ============================================================
-- RIDA SUPREME SYSTEM - VENDOR PRODUCTS RPC (SECURITY DEFINER)
-- Bypass RLS para operaciones CRUD de productos del vendor
-- Ejecutar en SQL Editor de Supabase
-- ============================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  1. GET VENDOR PRODUCTS                                      ║
-- ╚══════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  2. INSERT VENDOR PRODUCT                                    ║
-- ╚══════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  3. UPDATE VENDOR PRODUCT                                    ║
-- ╚══════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  4. TOGGLE STOCK (quick toggle)                              ║
-- ╚══════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  5. TOGGLE FEATURED                                         ║
-- ╚══════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  6. DELETE VENDOR PRODUCT                                    ║
-- ╚══════════════════════════════════════════════════════════════╝
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  7. BULK INSERT (para CSV)                                   ║
-- ╚══════════════════════════════════════════════════════════════╝
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

    -- Validate
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

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  8. BULK UPDATE STOCK/FEATURED/DELETE                       ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE OR REPLACE FUNCTION public.bulk_vendor_product_action(
  p_vendor_id UUID,
  p_product_ids UUID[],
  p_action TEXT  -- 'enable_stock', 'disable_stock', 'featured', 'unfeatured', 'delete'
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
-- ║  9. REFRESH SCHEMA                                          ║
-- ╚══════════════════════════════════════════════════════════════╝
NOTIFY pgrst, 'reload schema';

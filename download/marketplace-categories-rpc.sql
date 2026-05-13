-- ============================================================
-- RIDA SUPREME SYSTEM - MARKETPLACE CATEGORIES RPC
-- Allows authorized users to manage categories
-- ============================================================

-- ─── 1. CREATE CATEGORY ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_marketplace_category(TEXT, TEXT, INT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.create_marketplace_category(
  p_name TEXT,
  p_icon TEXT DEFAULT 'Package',
  p_sort_order INT DEFAULT 0,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_category_id UUID;
BEGIN
  -- Insert the category
  INSERT INTO public.marketplace_categories (name, icon, sort_order, is_active)
  VALUES (p_name, p_icon, p_sort_order, p_is_active)
  RETURNING id INTO v_category_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_category_id,
    'message', 'Categoría creada exitosamente'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- ─── 2. DELETE CATEGORY ──────────────────────────────────────
-- Note: You might want to handle products linked to this category first.
DROP FUNCTION IF EXISTS public.delete_marketplace_category(UUID);
CREATE OR REPLACE FUNCTION public.delete_marketplace_category(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.marketplace_categories WHERE id = p_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Categoría eliminada'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- ─── 3. UPDATE CATEGORY (Optional bypass) ────────────────────
DROP FUNCTION IF EXISTS public.update_marketplace_category(UUID, JSONB);
CREATE OR REPLACE FUNCTION public.update_marketplace_category(
  p_id UUID,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.marketplace_categories
  SET
    name = COALESCE(p_updates->>'name', name),
    icon = COALESCE(p_updates->>'icon', icon),
    sort_order = COALESCE((p_updates->>'sort_order')::INT, sort_order),
    is_active = COALESCE((p_updates->>'is_active')::BOOLEAN, is_active)
  WHERE id = p_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ============================================
-- RIDA SUPREME SYSTEM - SUPER ADMIN (CORREGIDO)
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. CORREGIR CHECK constraint de profiles.role
-- (agregar super_admin y courier)
-- ============================================
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Buscar y eliminar el CHECK constraint viejo en role
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND conkey = (
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.profiles'::regclass
        AND attname = 'role'
    );

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || constraint_name;
    RAISE NOTICE 'CHECK constraint eliminado: %', constraint_name;
  END IF;

  -- Crear CHECK constraint nuevo con todos los roles
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('client', 'driver', 'admin', 'super_admin', 'vendor', 'courier'));

  RAISE NOTICE 'CHECK constraint nuevo creado con todos los roles';
END $$;

-- ============================================
-- 2. Agregar columnas de bloqueo a profiles
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_blocked') THEN
    ALTER TABLE public.profiles ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'blocked_at') THEN
    ALTER TABLE public.profiles ADD COLUMN blocked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'blocked_reason') THEN
    ALTER TABLE public.profiles ADD COLUMN blocked_reason TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'blocked_by') THEN
    ALTER TABLE public.profiles ADD COLUMN blocked_by UUID REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'login_count') THEN
    ALTER TABLE public.profiles ADD COLUMN login_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login_at') THEN
    ALTER TABLE public.profiles ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;

  RAISE NOTICE 'Columnas de bloqueo verificadas en profiles';
END $$;

-- ============================================
-- 3. Tabla de log de actividades del Super Admin
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_email TEXT,
  details JSONB DEFAULT '{}'::JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_super_admin ON public.admin_activity_log(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON public.admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_target ON public.admin_activity_log(target_user_id);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads own activity log" ON public.admin_activity_log
  FOR SELECT USING (
    super_admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "No direct insert on activity log" ON public.admin_activity_log
  FOR INSERT WITH CHECK (false);

-- ============================================
-- 4. Funcion auxiliar: verificar super admin
-- ============================================
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_role IS NULL THEN RETURN FALSE; END IF;
  IF v_role = 'super_admin' THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 5. RPC: Verificar si usuario esta bloqueado
-- ============================================
CREATE OR REPLACE FUNCTION public.check_user_blocked(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_blocked BOOLEAN;
  v_reason TEXT;
BEGIN
  SELECT is_blocked, COALESCE(blocked_reason, 'Cuenta bloqueada') INTO v_blocked, v_reason
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_blocked IS NULL THEN
    RETURN jsonb_build_object('blocked', false);
  END IF;

  RETURN jsonb_build_object(
    'blocked', v_blocked,
    'reason', v_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. RPC: Bloquear admin (solo super admin)
-- ============================================
CREATE OR REPLACE FUNCTION public.block_admin_user(
  p_target_user_id UUID,
  p_reason TEXT DEFAULT 'Bloqueado por Super Admin'
) RETURNS JSONB AS $$
DECLARE
  v_super_id UUID;
  v_target_email TEXT;
  v_target_role TEXT;
BEGIN
  v_super_id := auth.uid();
  IF v_super_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.is_super_admin(v_super_id) THEN
    RAISE EXCEPTION 'Acceso denegado - Solo Super Admin puede bloquear';
  END IF;

  IF p_target_user_id = v_super_id THEN
    RAISE EXCEPTION 'No puedes bloquearte a ti mismo';
  END IF;

  SELECT email, role INTO v_target_email, v_target_role
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  IF v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'No puedes bloquear a otro Super Admin';
  END IF;

  UPDATE public.profiles
  SET is_blocked = TRUE,
      blocked_at = now(),
      blocked_reason = p_reason,
      blocked_by = v_super_id
  WHERE id = p_target_user_id;

  INSERT INTO public.admin_activity_log (super_admin_id, action, target_user_id, target_user_email, details)
  VALUES (v_super_id, 'block_admin', p_target_user_id, v_target_email,
    jsonb_build_object('reason', p_reason, 'target_role', v_target_role));

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Administrador bloqueado exitosamente',
    'email', v_target_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. RPC: Desbloquear admin (solo super admin)
-- ============================================
CREATE OR REPLACE FUNCTION public.unblock_admin_user(
  p_target_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_super_id UUID;
  v_target_email TEXT;
BEGIN
  v_super_id := auth.uid();
  IF v_super_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.is_super_admin(v_super_id) THEN
    RAISE EXCEPTION 'Acceso denegado - Solo Super Admin puede desbloquear';
  END IF;

  SELECT email INTO v_target_email
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  UPDATE public.profiles
  SET is_blocked = FALSE,
      blocked_at = NULL,
      blocked_reason = NULL,
      blocked_by = NULL
  WHERE id = p_target_user_id;

  INSERT INTO public.admin_activity_log (super_admin_id, action, target_user_id, target_user_email, details)
  VALUES (v_super_id, 'unblock_admin', p_target_user_id, v_target_email, '{}');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Administrador desbloqueado exitosamente',
    'email', v_target_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. RPC: Eliminar admin (cambiar rol a client)
-- Solo super admin puede hacerlo
-- ============================================
CREATE OR REPLACE FUNCTION public.remove_admin_access(
  p_target_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_super_id UUID;
  v_target_email TEXT;
  v_target_role TEXT;
BEGIN
  v_super_id := auth.uid();
  IF v_super_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.is_super_admin(v_super_id) THEN
    RAISE EXCEPTION 'Acceso denegado - Solo Super Admin puede eliminar';
  END IF;

  IF p_target_user_id = v_super_id THEN
    RAISE EXCEPTION 'No puedes eliminar tu propio acceso';
  END IF;

  SELECT email, role INTO v_target_email, v_target_role
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  IF v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'No puedes eliminar a otro Super Admin';
  END IF;

  UPDATE public.profiles
  SET role = 'client',
      is_blocked = FALSE,
      blocked_at = NULL,
      blocked_reason = NULL,
      blocked_by = NULL
  WHERE id = p_target_user_id
    AND role IN ('admin', 'super_admin');

  INSERT INTO public.admin_activity_log (super_admin_id, action, target_user_id, target_user_email, details)
  VALUES (v_super_id, 'remove_admin', p_target_user_id, v_target_email,
    jsonb_build_object('previous_role', v_target_role));

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Acceso de administrador eliminado para ' || v_target_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. RPC: Log al crear nuevo admin (CORREGIDO)
-- ============================================
CREATE OR REPLACE FUNCTION public.create_new_admin(
  p_name TEXT,
  p_email TEXT
) RETURNS JSONB AS $$
DECLARE
  v_super_id UUID;
  v_existing UUID;
  v_clean_email TEXT;
BEGIN
  v_super_id := auth.uid();
  IF v_super_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.is_super_admin(v_super_id) THEN
    RAISE EXCEPTION 'Acceso denegado - Solo Super Admin puede crear admins';
  END IF;

  v_clean_email := LOWER(TRIM(p_email));

  SELECT id INTO v_existing FROM public.profiles WHERE email = v_clean_email;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Este correo ya esta registrado en el sistema';
  END IF;

  -- Log de actividad (CORREGIDO: 4 columnas = 4 valores)
  INSERT INTO public.admin_activity_log (super_admin_id, action, target_user_email, details)
  VALUES (v_super_id, 'create_admin', v_clean_email,
    jsonb_build_object('name', TRIM(p_name), 'email', v_clean_email));

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Log de creacion de admin registrado',
    'email', v_clean_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. RPC: Obtener log de actividades
-- ============================================
CREATE OR REPLACE FUNCTION public.get_admin_activity_log(
  p_limit INT DEFAULT 50
) RETURNS TABLE (
  id UUID,
  action TEXT,
  target_user_email TEXT,
  details JSONB,
  created_at TIMESTAMPTZ,
  super_admin_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.target_user_email,
    al.details,
    al.created_at,
    p.name AS super_admin_name
  FROM public.admin_activity_log al
  LEFT JOIN public.profiles p ON p.id = al.super_admin_id
  ORDER BY al.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. Establecer Super Admin por email
-- ============================================
CREATE OR REPLACE FUNCTION public.ensure_super_admin(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE email = LOWER(TRIM(p_email));

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No se encontro perfil con ese email');
  END IF;

  UPDATE public.profiles SET role = 'super_admin' WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Super Admin establecido correctamente',
    'user_id', v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. ACTIVAR tu cuenta como SUPER ADMIN
-- kardellridclient@outlook.com
-- ============================================
SELECT ensure_super_admin('kardellridclient@outlook.com');

-- ============================================
-- VERIFICACION FINAL
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'SUPER ADMIN SYSTEM - INSTALACION COMPLETADA';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'CHECK constraint corregido (super_admin + courier)';
  RAISE NOTICE 'Columnas de bloqueo en profiles: OK';
  RAISE NOTICE 'Tabla admin_activity_log: OK';
  RAISE NOTICE 'RPCs: block_admin_user, unblock_admin_user';
  RAISE NOTICE 'RPCs: remove_admin_access, create_new_admin';
  RAISE NOTICE 'RPCs: get_admin_activity_log, check_user_blocked';
  RAISE NOTICE 'RPCs: is_super_admin, ensure_super_admin';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Tu cuenta kardellridclient@outlook.com';
  RAISE NOTICE 'ahora es SUPER ADMIN';
  RAISE NOTICE '============================================';
END $$;

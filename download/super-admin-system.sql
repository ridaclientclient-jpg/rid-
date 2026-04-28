-- ============================================
-- RIDA SUPREME SYSTEM - SUPER ADMIN SYSTEM
-- Bloqueo/Desbloqueo de admins + Log de actividades
-- ============================================

-- ============================================
-- 1. Agregar columna is_blocked a profiles
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
END $$;

-- ============================================
-- 2. Tabla de log de actividades del Super Admin
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

-- Solo super_admin puede leer su propio log
CREATE POLICY "Super admin reads own activity log" ON public.admin_activity_log
  FOR SELECT USING (
    super_admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Nadie puede insertar directamente (solo via RPC)
CREATE POLICY "No direct insert on activity log" ON public.admin_activity_log
  FOR INSERT WITH CHECK (false);

-- ============================================
-- 3. Funcion auxiliar para verificar super admin
-- ============================================
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  SELECT role, email INTO v_role, v_email
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_role IS NULL THEN RETURN FALSE; END IF;
  IF v_role = 'super_admin' THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 4. RPC: Bloquear admin
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
  -- Verificar que el que ejecuta es super_admin
  v_super_id := auth.uid();
  IF v_super_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.is_super_admin(v_super_id) THEN
    RAISE EXCEPTION 'Acceso denegado - Solo Super Admin puede bloquear';
  END IF;

  -- No puedes bloquearte a ti mismo
  IF p_target_user_id = v_super_id THEN
    RAISE EXCEPTION 'No puedes bloquearte a ti mismo';
  END IF;

  -- Verificar que el target existe y obtener datos
  SELECT email, role INTO v_target_email, v_target_role
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- No puedes bloquear otro super_admin
  IF v_target_role = 'super_admin' THEN
    RAISE EXCEPTION 'No puedes bloquear a otro Super Admin';
  END IF;

  -- Bloquear
  UPDATE public.profiles
  SET is_blocked = TRUE,
      blocked_at = now(),
      blocked_reason = p_reason,
      blocked_by = v_super_id
  WHERE id = p_target_user_id;

  -- Log de actividad
  INSERT INTO public.admin_activity_log (super_admin_id, action, target_user_id, target_user_email, details)
  VALUES (v_super_id, 'block_admin', p_target_user_id, v_target_email,
    jsonb_build_object('reason', p_reason, 'target_role', v_target_role));

  -- Invalidar sesiones del usuario bloqueado
  -- (Se hace desde el cliente al detectar is_blocked en el proximo login)

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Administrador bloqueado exitosamente',
    'email', v_target_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. RPC: Desbloquear admin
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
-- 6. RPC: Eliminar admin (cambiar rol a client)
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

  -- Cambiar rol a client y desbloquear
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
-- 7. RPC: Crear nuevo admin (con log)
-- ============================================
CREATE OR REPLACE FUNCTION public.create_new_admin(
  p_name TEXT,
  p_email TEXT
) RETURNS JSONB AS $$
DECLARE
  v_super_id UUID;
  v_existing UUID;
BEGIN
  v_super_id := auth.uid();
  IF v_super_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.is_super_admin(v_super_id) THEN
    RAISE EXCEPTION 'Acceso denegado - Solo Super Admin puede crear admins';
  END IF;

  -- Verificar que el email no existe
  SELECT id INTO v_existing FROM public.profiles WHERE email = LOWER(TRIM(p_email));
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Este correo ya esta registrado en el sistema';
  END IF;

  -- Crear usuario en auth (se necesita service role)
  -- Este RPC solo prepara el perfil. La creacion real del auth user
  -- se hace desde el API route con service role.
  INSERT INTO public.admin_activity_log (super_admin_id, action, target_user_email, details)
  VALUES (v_super_id, 'create_admin', NULL, LOWER(TRIM(p_email)),
    jsonb_build_object('name', p_name, 'email', LOWER(TRIM(p_email))));

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Solicitud de creacion de admin registrada',
    'email', LOWER(TRIM(p_email))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. RPC: Obtener log de actividades
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
-- 9. RPC: Verificar si un usuario esta bloqueado
-- (para usar en login)
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
-- 10. Establecer Super Admin por email
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
-- VERIFICACION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ is_blocked, blocked_at, blocked_reason, blocked_by agregados a profiles';
  RAISE NOTICE '✅ Tabla admin_activity_log creada';
  RAISE NOTICE '✅ RPCs: block_admin_user, unblock_admin_user, remove_admin_access';
  RAISE NOTICE '✅ RPCs: create_new_admin, get_admin_activity_log, check_user_blocked';
  RAISE NOTICE '✅ RPCs: is_super_admin, ensure_super_admin';
END $$;

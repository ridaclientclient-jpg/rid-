-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  RIDA SUPREME — RESTAURACIÓN COMPLETA DE DATOS                        ║
-- ║  Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor → New query)  ║
-- ║  Este script corrige constraints y recrea los datos esenciales         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ══════════════════════════════════════════════════════════════
-- 1. CORREGIR CHECK constraints (el RIDA-COMPLETE.sql los puso mal)
-- ══════════════════════════════════════════════════════════════

-- 1a. profiles.role: agregar super_admin y courier
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
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
  END IF;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('client', 'driver', 'admin', 'super_admin', 'vendor', 'courier'));
END $$;

-- 1b. drivers.status: agregar pending, verified, rejected
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.drivers'::regclass
    AND contype = 'c'
    AND conkey = (
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.drivers'::regclass
        AND attname = 'status'
    );

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.drivers DROP CONSTRAINT ' || constraint_name;
  END IF;

  ALTER TABLE public.drivers
    ADD CONSTRAINT drivers_status_check
    CHECK (status IN ('offline', 'online', 'busy', 'suspended', 'pending', 'verified', 'rejected'));
END $$;

-- 1c. Agregar columnas faltantes a drivers si no existen
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'current_lat') THEN
    ALTER TABLE public.drivers ADD COLUMN current_lat DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'current_lng') THEN
    ALTER TABLE public.drivers ADD COLUMN current_lng DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'vehicle_type') THEN
    ALTER TABLE public.drivers ADD COLUMN vehicle_type TEXT DEFAULT 'conductor';
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 2. RECREAR PROFILE DEL SUPER ADMIN (kardellridclient@outlook.com)
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.profiles (id, name, email, role, is_verified, is_active, phone_verified)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'kardellridclient@outlook.com' LIMIT 1),
  'Admin',
  'kardellridclient@outlook.com',
  'super_admin',
  true,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  role = 'super_admin',
  is_verified = true,
  is_active = true;

-- ══════════════════════════════════════════════════════════════
-- 3. RECREAR REGISTROS DE CONDUCTORES
--    (wayne = wmarsh601@gmail.com, minky = way01conductor@outlook.com)
-- ══════════════════════════════════════════════════════════════

-- 3a. Asegurar que los profiles de conductor existen y tienen role correcto
INSERT INTO public.profiles (id, name, email, role, is_verified, is_active, phone)
VALUES
  ('9b2db8eb-6be5-4b38-a13e-0a4dd926c5f3', 'wayne', 'wmarsh601@gmail.com', 'driver', true, true, NULL),
  ('53e332b9-1b67-49cd-8dc2-e37ea492cbfa', 'minky', 'way01conductor@outlook.com', 'driver', true, true, '55588888')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  email = EXCLUDED.email;

-- 3b. Insertar registros en tabla drivers
INSERT INTO public.drivers (id, user_id, status, is_verified, rating, total_rides, total_earnings, vehicle_type)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '9b2db8eb-6be5-4b38-a13e-0a4dd926c5f3', 'offline', false, 5.00, 0, 0, 'conductor'),
  ('a1000000-0000-0000-0000-000000000002', '53e332b9-1b67-49cd-8dc2-e37ea492cbfa', 'offline', false, 5.00, 0, 0, 'conductor')
ON CONFLICT (id) DO NOTHING;

-- Si los IDs predefinidos no funcionan, crear con UUIDs generados
INSERT INTO public.drivers (user_id, status, is_verified, rating, total_rides, total_earnings, vehicle_type)
SELECT '9b2db8eb-6be5-4b38-a13e-0a4dd926c5f3', 'offline', false, 5.00, 0, 0, 'conductor'
WHERE NOT EXISTS (SELECT 1 FROM public.drivers WHERE user_id = '9b2db8eb-6be5-4b38-a13e-0a4dd926c5f3');

INSERT INTO public.drivers (user_id, status, is_verified, rating, total_rides, total_earnings, vehicle_type)
SELECT '53e332b9-1b67-49cd-8dc2-e37ea492cbfa', 'offline', false, 5.00, 0, 0, 'conductor'
WHERE NOT EXISTS (SELECT 1 FROM public.drivers WHERE user_id = '53e332b9-1b67-49cd-8dc2-e37ea492cbfa');

-- ══════════════════════════════════════════════════════════════
-- 4. VERIFICACIÓN: Confirmar que los datos quedaron correctos
-- ══════════════════════════════════════════════════════════════
SELECT 'PROFILES' as tabla, count(*) as total FROM public.profiles
UNION ALL
SELECT 'DRIVERS', count(*) FROM public.drivers
UNION ALL
SELECT 'VEHICLES', count(*) FROM public.vehicles
UNION ALL
SELECT 'RIDES', count(*) FROM public.rides;

SELECT '--- Perfiles ---' as info;
SELECT id, name, email, role, is_verified FROM public.profiles ORDER BY created_at;

SELECT '--- Conductores ---' as info;
SELECT d.id, d.user_id, p.name, d.status, d.is_verified, d.vehicle_type
FROM public.drivers d
JOIN public.profiles p ON p.id = d.user_id;

-- ══════════════════════════════════════════════════════════════
-- 5. LIMPIAR rides huérfanos (searching sin conductor)
-- ══════════════════════════════════════════════════════════════
DELETE FROM public.rides WHERE status = 'searching' AND driver_id IS NULL AND created_at < NOW() - INTERVAL '1 hour';

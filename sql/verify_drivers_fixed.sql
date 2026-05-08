-- Script corregido para verificar conductores
-- Ejecuta este script en Supabase SQL Editor

-- PASO 1: Buscar conductores pendientes de verificación
SELECT
  d.id,
  d.user_id,
  p.name,
  p.email,
  d.status,
  d.is_verified,
  COUNT(doc.id) as documentos_subidos,
  COUNT(CASE WHEN doc.status = 'pending' THEN 1 END) as documentos_pendientes,
  COUNT(CASE WHEN doc.status = 'approved' THEN 1 END) as documentos_aprobados
FROM drivers d
JOIN profiles p ON d.user_id = p.id
LEFT JOIN documents doc ON d.user_id = doc.user_id
WHERE d.status IN ('pending', 'offline')
GROUP BY d.id, d.user_id, p.name, p.email, d.status, d.is_verified
ORDER BY d.created_at DESC;

-- PASO 2: Para verificar un conductor específico, reemplaza 'USER_ID_AQUI' con el user_id real
-- Ejemplo: UPDATE drivers SET is_verified = true, status = 'verified' WHERE user_id = '123e4567-e89b-12d3-a456-426614174000';

-- UPDATE drivers
-- SET is_verified = true, status = 'verified'
-- WHERE user_id = 'USER_ID_AQUI';

-- UPDATE vehicles
-- SET verified = true
-- WHERE driver_id IN (
--   SELECT id FROM drivers WHERE user_id = 'USER_ID_AQUI'
-- );

-- PASO 3: Verificar que el conductor quedó verificado
-- SELECT d.id, d.user_id, p.name, d.is_verified, v.verified as vehicle_verified
-- FROM drivers d
-- JOIN profiles p ON d.user_id = p.id
-- LEFT JOIN vehicles v ON d.id = v.driver_id
-- WHERE d.user_id = 'USER_ID_AQUI';
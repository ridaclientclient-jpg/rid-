-- =====================================================
-- SCRIPT COMPLETO PARA SOLUCIONAR PROBLEMAS DE CONDUCTORES
-- Ejecuta este script paso a paso en Supabase SQL Editor
-- =====================================================

-- PASO 1: Verificar estado actual de conductores
SELECT
  'Conductores totales' as tipo,
  COUNT(*) as cantidad
FROM drivers
UNION ALL
SELECT
  'Conductores verificados' as tipo,
  COUNT(*) as cantidad
FROM drivers
WHERE is_verified = true
UNION ALL
SELECT
  'Conductores online' as tipo,
  COUNT(*) as cantidad
FROM drivers
WHERE status = 'online'
UNION ALL
SELECT
  'Vehículos verificados' as tipo,
  COUNT(*) as cantidad
FROM vehicles
WHERE verified = true;

-- PASO 2: Buscar conductores con documentos subidos
SELECT
  d.id as driver_id,
  d.user_id,
  p.name,
  p.email,
  d.status,
  d.is_verified,
  COUNT(doc.id) as total_documentos,
  COUNT(CASE WHEN doc.status = 'approved' THEN 1 END) as documentos_aprobados,
  COUNT(CASE WHEN doc.status = 'pending' THEN 1 END) as documentos_pendientes,
  COUNT(CASE WHEN doc.status = 'rejected' THEN 1 END) as documentos_rechazados
FROM drivers d
JOIN profiles p ON d.user_id = p.id
LEFT JOIN documents doc ON d.user_id = doc.user_id
GROUP BY d.id, d.user_id, p.name, p.email, d.status, d.is_verified
HAVING COUNT(doc.id) > 0
ORDER BY COUNT(doc.id) DESC, d.created_at DESC;

-- PASO 3: Verificar bucket de documentos
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN 'Bucket documents existe'
    ELSE 'Bucket documents NO existe - créalo manualmente'
  END as estado_bucket
FROM storage.buckets
WHERE id = 'documents';

-- PASO 4: Función de matching mejorada (ya debería estar ejecutada)
-- Si no está, ejecuta el script enhanced_match_driver_with_vehicle_verification.sql

-- PASO 5: Para verificar conductores manualmente (descomenta y reemplaza USER_ID)
-- Reemplaza 'TU_USER_ID_AQUI' con el user_id real del conductor

-- UPDATE drivers
-- SET is_verified = true, status = 'verified'
-- WHERE user_id = 'TU_USER_ID_AQUI';

-- UPDATE vehicles
-- SET verified = true
-- WHERE driver_id IN (
--   SELECT id FROM drivers WHERE user_id = 'TU_USER_ID_AQUI'
-- );

-- PASO 6: Verificar que funciona
-- Después de verificar conductores, ejecuta esta consulta:
-- SELECT d.id, p.name, d.is_verified, d.status, v.verified as vehiculo_verificado
-- FROM drivers d
-- JOIN profiles p ON d.user_id = p.id
-- LEFT JOIN vehicles v ON d.id = v.driver_id
-- WHERE d.is_verified = true;
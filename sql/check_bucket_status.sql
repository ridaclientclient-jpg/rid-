-- Script simplificado para verificar bucket de documentos
-- Ejecuta este script en Supabase SQL Editor

-- Verificar si el bucket 'documents' existe
SELECT id, name, public
FROM storage.buckets
WHERE id = 'documents';

-- Si no existe, puedes crearlo desde el Dashboard de Supabase:
-- 1. Ve a Storage en el panel lateral
-- 2. Crea un nuevo bucket llamado 'documents'
-- 3. Asegúrate de que NO sea público

-- Verificar políticas existentes en el bucket
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;

-- Si no hay políticas, el bucket podría tener permisos por defecto
-- Los usuarios deberían poder subir sus propios documentos
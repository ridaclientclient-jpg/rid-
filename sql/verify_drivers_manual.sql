-- Script to verify drivers and vehicles for testing
-- Run this in Supabase SQL Editor to manually verify drivers

-- 1. Mark a driver as verified
-- Replace 'driver-user-id-here' with the actual user_id of the driver
UPDATE drivers
SET is_verified = true, status = 'verified'
WHERE user_id = 'driver-user-id-here';

-- 2. Mark all vehicles of that driver as verified
UPDATE vehicles
SET verified = true
WHERE driver_id IN (
  SELECT id FROM drivers WHERE user_id = 'driver-user-id-here'
);

-- 3. Check current verified drivers
SELECT
  d.id,
  d.user_id,
  p.name,
  d.status,
  d.is_verified,
  COUNT(v.id) as vehicle_count,
  COUNT(CASE WHEN v.verified THEN 1 END) as verified_vehicles
FROM drivers d
JOIN profiles p ON d.user_id = p.id
LEFT JOIN vehicles v ON d.id = v.driver_id
WHERE d.is_verified = true
GROUP BY d.id, d.user_id, p.name, d.status, d.is_verified;

-- 4. Check documents status for a driver
SELECT
  type,
  status,
  created_at
FROM documents
WHERE user_id = 'driver-user-id-here'
ORDER BY created_at DESC;
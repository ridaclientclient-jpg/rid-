-- Enhanced Driver Matching Function with Vehicle Verification
-- This function should replace the existing enhanced_match_driver in Supabase

-- Drop existing function first (required because return type changed)
DROP FUNCTION IF EXISTS enhanced_match_driver(uuid);

CREATE OR REPLACE FUNCTION enhanced_match_driver(p_ride_id UUID)
RETURNS JSON AS $$
DECLARE
    v_ride RECORD;
    v_driver RECORD;
    v_distance_km NUMERIC;
    v_eta_minutes INTEGER;
    v_score NUMERIC;
    v_result JSON;
BEGIN
    -- Get ride details
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id AND status = 'searching';

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Viaje no encontrado o ya asignado');
    END IF;

    -- Find best driver with verified vehicles
    SELECT
        d.id,
        d.user_id,
        p.name as driver_name,
        d.rating,
        d.current_lat,
        d.current_lng,
        -- Calculate distance and ETA
        (6371 * acos(cos(radians(v_ride.origin_lat)) * cos(radians(d.current_lat)) *
         cos(radians(d.current_lng) - radians(v_ride.origin_lng)) +
         sin(radians(v_ride.origin_lat)) * sin(radians(d.current_lat)))) as distance_km,
        GREATEST(1, ROUND((6371 * acos(cos(radians(v_ride.origin_lat)) * cos(radians(d.current_lat)) *
         cos(radians(d.current_lng) - radians(v_ride.origin_lng)) +
         sin(radians(v_ride.origin_lat)) * sin(radians(d.current_lat)))) / 30 * 60)) as eta_minutes,
        -- Scoring: rating + distance penalty
        (d.rating * 10) - (6371 * acos(cos(radians(v_ride.origin_lat)) * cos(radians(d.current_lat)) *
         cos(radians(d.current_lng) - radians(v_ride.origin_lng)) +
         sin(radians(v_ride.origin_lat)) * sin(radians(d.current_lat)))) as score
    INTO v_driver
    FROM drivers d
    JOIN profiles p ON d.user_id = p.id
    JOIN vehicles v ON d.id = v.driver_id
    WHERE d.status = 'online'
      AND d.is_verified = true
      AND v.verified = true  -- Only drivers with verified vehicles
      AND d.current_lat IS NOT NULL
      AND d.current_lng IS NOT NULL
      AND d.id NOT IN (
          SELECT driver_id FROM rides
          WHERE status IN ('assigned', 'arriving', 'started')
          AND created_at > NOW() - INTERVAL '2 hours'
      )
    ORDER BY score DESC, distance_km ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'No hay conductores disponibles con vehiculos verificados');
    END IF;

    -- Update ride with selected driver
    UPDATE rides
    SET driver_id = v_driver.id,
        status = 'assigned'
    WHERE id = p_ride_id;

    -- Update driver status to busy
    UPDATE drivers
    SET status = 'busy',
        accepted_rides = COALESCE(accepted_rides, 0) + 1
    WHERE id = v_driver.id;

    RETURN json_build_object(
        'success', true,
        'driver_id', v_driver.id,
        'driver_name', v_driver.driver_name,
        'distance_km', ROUND(v_driver.distance_km::numeric, 2),
        'eta_minutes', v_driver.eta_minutes,
        'message', 'Conductor asignado exitosamente'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', 'Error interno del sistema');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
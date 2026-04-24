-- ═══════════════════════════════════════════════════════════════
-- RIDA SUPREME SYSTEM - FIX COMPLETO MAPA DE ZONAS
-- Tablas: location_areas + heat_map_data + funciones + triggers
-- ═══════════════════════════════════════════════════════════════

-- ============================================================
-- 1. TABLA location_areas (zonas geográficas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.location_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  area_type VARCHAR(30) NOT NULL DEFAULT 'service_area'
    CHECK (area_type IN ('restriction', 'surge_zone', 'hotspot', 'service_area', 'airport_zone')),
  country VARCHAR(100) DEFAULT 'Costa Rica',
  coordinates TEXT NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT DEFAULT '',
  surge_multiplier NUMERIC(4,2) DEFAULT 1.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_areas_type ON public.location_areas(area_type);
CREATE INDEX IF NOT EXISTS idx_location_areas_active ON public.location_areas(is_active);

ALTER TABLE public.location_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage location_areas" ON public.location_areas FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Users can read active areas" ON public.location_areas FOR SELECT
  USING (is_active = TRUE OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Zonas iniciales de Costa Rica (San José GAM)
INSERT INTO public.location_areas (name, area_type, country, coordinates, is_active, notes, surge_multiplier) VALUES
  ('Zona Central San Jose', 'service_area', 'Costa Rica',
   '[[9.9365,-84.0795],[9.9480,-84.0650],[9.9530,-84.0900],[9.9450,-84.1020],[9.9330,-84.0980],[9.9280,-84.0850]]',
   TRUE, 'Area central de servicio del GAM', 1.00),

  ('Aeropuerto Juan Santamaria', 'airport_zone', 'Costa Rica',
   '[[9.9930,-84.2180],[10.0030,-84.2080],[10.0080,-84.2150],[10.0040,-84.2250],[9.9950,-84.2240]]',
   TRUE, 'Zona del aeropuerto internacional SJO - supplemento aeropuerto', 1.50),

  ('San Pedro - Montes de Oca', 'hotspot', 'Costa Rica',
   '[[9.9330,-84.0480],[9.9420,-84.0420],[9.9440,-84.0520],[9.9380,-84.0580],[9.9310,-84.0550]]',
   TRUE, 'Zona universitaria de alta demanda', 1.00),

  ('Multiplaza Escazu', 'hotspot', 'Costa Rica',
   '[[9.9210,-84.1390],[9.9270,-84.1340],[9.9300,-84.1400],[9.9250,-84.1460],[9.9190,-84.1430]]',
   TRUE, 'Centro comercial de alta demanda', 1.00),

  ('Surge Nocturno Fin de Semana', 'surge_zone', 'Costa Rica',
   '[[9.9350,-84.0750],[9.9500,-84.0680],[9.9550,-84.0850],[9.9470,-84.0950],[9.9370,-84.0900]]',
   TRUE, 'Surge automatico zona centros/barrios nocturnos FS', 1.80),

  ('Reserva Natural Protegida', 'restriction', 'Costa Rica',
   '[[9.9700,-84.0300],[9.9850,-84.0200],[9.9900,-84.0400],[9.9800,-84.0500],[9.9720,-84.0420]]',
   TRUE, 'Zona restringida - no se permiten viajes', 0),

  ('Zona Este - Curridabat', 'service_area', 'Costa Rica',
   '[[9.9180,-84.0350],[9.9300,-84.0280],[9.9350,-84.0420],[9.9280,-84.0500],[9.9200,-84.0450]]',
   TRUE, 'Area de servicio zona este del GAM', 1.00),

  ('Hospital CIMA Escazu', 'hotspot', 'Costa Rica',
   '[[9.9490,-84.1350],[9.9540,-84.1310],[9.9560,-84.1360],[9.9530,-84.1400],[9.9490,-84.1380]]',
   TRUE, 'Zona hospitalaria de alta demanda', 1.00);

-- ============================================================
-- 2. TABLA heat_map_data (datos de calor de viajes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.heat_map_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  weight NUMERIC(5,2) DEFAULT 1.00,
  location_type VARCHAR(20) NOT NULL DEFAULT 'pickup'
    CHECK (location_type IN ('pickup', 'dropoff', 'search')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heat_map_type ON public.heat_map_data(location_type);
CREATE INDEX IF NOT EXISTS idx_heat_map_created ON public.heat_map_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_heat_map_location ON public.heat_map_data(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_heat_map_ride ON public.heat_map_data(ride_id);

ALTER TABLE public.heat_map_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read heat_map_data" ON public.heat_map_data FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "System can insert heat data" ON public.heat_map_data FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- ============================================================
-- 3. FUNCIÓN: insertar heat_map_data al completar un viaje
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_ride_heat_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo registrar cuando el viaje se completa
  IF NEW.status = 'completed' THEN
    -- Insertar punto de recogida
    IF NEW.origin_lat IS NOT NULL AND NEW.origin_lng IS NOT NULL THEN
      INSERT INTO public.heat_map_data (ride_id, latitude, longitude, weight, location_type)
      VALUES (NEW.id, NEW.origin_lat, NEW.origin_lng, 2.00, 'pickup');
    END IF;
    -- Insertar punto de destino
    IF NEW.dest_lat IS NOT NULL AND NEW.dest_lng IS NOT NULL THEN
      INSERT INTO public.heat_map_data (ride_id, latitude, longitude, weight, location_type)
      VALUES (NEW.id, NEW.dest_lat, NEW.dest_lng, 2.00, 'dropoff');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger en rides
DROP TRIGGER IF EXISTS trg_record_ride_heat ON public.rides;
CREATE TRIGGER trg_record_ride_heat
  AFTER UPDATE OF status ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.record_ride_heat_data();

-- ============================================================
-- 4. FUNCIÓN: poblar heat_map_data con viajes ya completados
-- ============================================================
CREATE OR REPLACE FUNCTION public.backfill_heat_map_data()
RETURNS void AS $$
BEGIN
  INSERT INTO public.heat_map_data (ride_id, latitude, longitude, weight, location_type)
  SELECT
    r.id, r.origin_lat, r.origin_lng, 2.00, 'pickup'
  FROM public.rides r
  WHERE r.status = 'completed'
    AND r.origin_lat IS NOT NULL AND r.origin_lng IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.heat_map_data h
      WHERE h.ride_id = r.id AND h.location_type = 'pickup'
    );

  INSERT INTO public.heat_map_data (ride_id, latitude, longitude, weight, location_type)
  SELECT
    r.id, r.dest_lat, r.dest_lng, 2.00, 'dropoff'
  FROM public.rides r
  WHERE r.status = 'completed'
    AND r.dest_lat IS NOT NULL AND r.dest_lng IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.heat_map_data h
      WHERE h.ride_id = r.id AND h.location_type = 'dropoff'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar backfill
SELECT public.backfill_heat_map_data();

-- ============================================================
-- 5. FUNCIÓN: verificar si un punto está dentro de un polígono
-- ============================================================
CREATE OR REPLACE FUNCTION public.point_in_polygon(
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_coordinates TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  coords JSONB;
  n INTEGER;
  inside BOOLEAN DEFAULT FALSE;
  j INTEGER;
  i INTEGER;
  xi NUMERIC; yi NUMERIC; xj NUMERIC; yj NUMERIC;
BEGIN
  coords := p_coordinates::JSONB;
  n := jsonb_array_length(coords);
  IF n < 3 THEN RETURN FALSE; END IF;

  j := n - 1;
  FOR i IN 0..n-1 LOOP
    xi := (coords->>i)::JSONB->>0;
    yi := (coords->>i)::JSONB->>1;
    xj := (coords->>j)::JSONB->>0;
    yj := (coords->>j)::JSONB->>1;

    IF ((yi > p_lng) != (yj > p_lng))
       AND (p_lat < (xj - xi) * (p_lng - yi) / (yj - yi) + xi) THEN
      inside := NOT inside;
    END IF;

    j := i;
  END LOOP;

  RETURN inside;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- ============================================================
-- 6. FUNCIÓN RPC: obtener zonas que contienen un punto
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_zones_for_point(
  p_lat NUMERIC,
  p_lng NUMERIC
) RETURNS TABLE(
  zone_id UUID,
  zone_name VARCHAR,
  area_type VARCHAR,
  is_active BOOLEAN,
  surge_multiplier NUMERIC,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    la.id AS zone_id,
    la.name AS zone_name,
    la.area_type,
    la.is_active,
    la.surge_multiplier,
    la.notes
  FROM public.location_areas la
  WHERE la.is_active = TRUE
    AND public.point_in_polygon(p_lat, p_lng, la.coordinates) = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. FUNCIÓN RPC: obtener surge multiplicador para un viaje
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_surge_multiplier(
  p_origin_lat NUMERIC,
  p_origin_lng NUMERIC,
  p_dest_lat NUMERIC,
  p_dest_lng NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  max_surge NUMERIC DEFAULT 1.00;
  surge NUMERIC;
BEGIN
  -- Verificar origen
  SELECT MAX(surge_multiplier) INTO max_surge
  FROM public.location_areas
  WHERE is_active = TRUE
    AND area_type = 'surge_zone'
    AND public.point_in_polygon(p_origin_lat, p_origin_lng, coordinates) = TRUE;

  -- Verificar destino
  SELECT MAX(surge_multiplier) INTO surge
  FROM public.location_areas
  WHERE is_active = TRUE
    AND area_type = 'surge_zone'
    AND public.point_in_polygon(p_dest_lat, p_dest_lng, coordinates) = TRUE;

  IF surge > max_surge THEN max_surge := surge; END IF;

  RETURN COALESCE(max_surge, 1.00);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. FUNCIÓN RPC: verificar restricciones para un punto
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_point_restriction(
  p_lat NUMERIC,
  p_lng NUMERIC
) RETURNS TABLE(
  is_restricted BOOLEAN,
  zone_name VARCHAR,
  zone_notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE AS is_restricted,
    la.name AS zone_name,
    la.notes AS zone_notes
  FROM public.location_areas la
  WHERE la.is_active = TRUE
    AND la.area_type = 'restriction'
    AND public.point_in_polygon(p_lat, p_lng, la.coordinates) = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. FUNCIÓN: limpiar heat_map_data viejo (mantener 90 días)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_heat_map_data()
RETURNS void AS $$
BEGIN
  DELETE FROM public.heat_map_data
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

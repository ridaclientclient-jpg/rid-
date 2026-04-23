-- ============================================================
-- RIDA SUPREME SYSTEM - SQL PARA APP DEL CONDUCTOR
-- Mejoras completas estilo Uber/Didi - Todo REAL, sin demo
-- Copiar y pegar en Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. COLUMNAS FALTANTES EN TABLA drivers
-- ============================================================

-- Coordenadas separadas (las APIs update-location y toggle-status las necesitan)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS current_lat NUMERIC(10,7);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS current_lng NUMERIC(10,7);

-- Tipo de vehículo del conductor (conductor/repartidor/ambos)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50) DEFAULT 'carro';

-- Meta diaria de ganancias
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS daily_goal NUMERIC(12,2) DEFAULT 50000;

-- Total de propinas recibidas
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS total_tips NUMERIC(12,2) DEFAULT 0;

-- Cantidad de viajes cancelados por el conductor
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS cancelled_rides INTEGER DEFAULT 0;

-- Aceptaciones totales (para calcular tasa de aceptación)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS accepted_rides INTEGER DEFAULT 0;

-- Rechazos totales
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS rejected_rides INTEGER DEFAULT 0;

-- Nivel/recompensa actual del conductor
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS reward_level VARCHAR(50) DEFAULT 'basico';

-- Última ubicación actualizada (timestamp)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

-- Índice para búsqueda rápida de conductores online
CREATE INDEX IF NOT EXISTS idx_drivers_status_online ON drivers(status) WHERE status IN ('online', 'busy');
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers USING GIST(current_location) WHERE current_location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);

-- ============================================================
-- 2. COLUMNAS FALTANTES EN TABLA rides
-- ============================================================

-- Tipo de viaje (estándar, premium, etc.)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_type VARCHAR(20) DEFAULT 'standard';

-- Verificar que tiene columnas de coordenadas
ALTER TABLE rides ADD COLUMN IF NOT EXISTS origin_lat NUMERIC(10,7);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS origin_lng NUMERIC(10,7);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS dest_lat NUMERIC(10,7);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS dest_lng NUMERIC(10,7);

-- Método de pago
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cash';
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';

-- Paradas intermedias
ALTER TABLE rides ADD COLUMN IF NOT EXISTS stops JSONB DEFAULT '[]'::jsonb;

-- Programación
ALTER TABLE rides ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE;

-- Propina del pasajero
ALTER TABLE rides ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,2) DEFAULT 0;

-- Tarifa de comisión (porcentaje)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 15;

-- Duración real del viaje (en minutos)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS actual_duration INTEGER;

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_rides_driver_status ON rides(driver_id, status) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_rider_status ON rides(rider_id, status);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status) WHERE status IN ('searching', 'assigned', 'arriving', 'started');
CREATE INDEX IF NOT EXISTS idx_rides_created ON rides(created_at DESC);

-- ============================================================
-- 3. TABLA app_notifications (si no existe)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_notif_user ON app_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notif_unread ON app_notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================================
-- 4. FUNCIÓN increment_driver_stats (necesaria para API rides/update-status)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_driver_stats(p_driver_id UUID, p_earnings NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE drivers SET
    total_rides = COALESCE(total_rides, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + p_earnings,
    updated_at = NOW()
  WHERE id = p_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. FUNCIÓN get_available_drivers (para matching de rides)
-- ============================================================
CREATE OR REPLACE FUNCTION get_nearby_drivers(
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_max_distance_km NUMERIC DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  rating NUMERIC,
  current_lat NUMERIC,
  current_lng NUMERIC,
  distance_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.user_id,
    d.rating,
    d.current_lat,
    d.current_lng,
    ST_Distance(
      d.current_location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) / 1000.0 AS distance_km
  FROM drivers d
  WHERE d.status = 'online'
    AND d.is_verified = true
    AND d.current_lat IS NOT NULL
    AND d.current_lng IS NOT NULL
  ORDER BY distance_km ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. CONFIGURACIÓN (settings) PARA APP DEL CONDUCTOR
-- ============================================================

-- Precios base
INSERT INTO settings (key, value, type) VALUES
  ('base_price', '1500', 'number'),
  ('price_per_km', '500', 'number'),
  ('price_per_minute', '50', 'number'),
  ('min_withdrawal_amount', '10000', 'number'),
  ('max_daily_withdrawal', '200000', 'number')
ON CONFLICT (key) DO NOTHING;

-- Configuración del conductor
INSERT INTO settings (key, value, type) VALUES
  ('driver_max_work_hours', '12', 'number'),
  ('driver_rest_hours', '6', 'number'),
  ('driver_default_commission', '15', 'number'),
  ('driver_cancel_penalty', '500', 'number'),
  ('driver_min_rating', '4.0', 'number'),
  ('driver_accept_timeout', '15', 'number'),
  ('driver_max_rejections', '5', 'number'),
  ('driver_daily_goal', '50000', 'number'),
  ('surge_enabled', 'true', 'boolean'),
  ('surge_min_multiplier', '1.2', 'number'),
  ('surge_max_multiplier', '3.0', 'number')
ON CONFLICT (key) DO NOTHING;

-- RLS para settings (lectura pública, escritura solo admin)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings readable by all" ON settings FOR SELECT USING (true);
CREATE POLICY "Settings writable by admin" ON settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Settings insertable by admin" ON settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- 7. TABLA driver_activity_log (registro de actividad)
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_activity_driver ON driver_activity_log(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_activity_user ON driver_activity_log(user_id, created_at DESC);

ALTER TABLE driver_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver can read own activity" ON driver_activity_log FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Admin can read all activity" ON driver_activity_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Drivers can insert own activity" ON driver_activity_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 8. TABLA ride_tracking_points (tracking GPS durante viaje)
-- ============================================================
CREATE TABLE IF NOT EXISTS ride_tracking_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  speed NUMERIC(5,2),
  heading NUMERIC(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ride_tracking_ride ON ride_tracking_points(ride_id, recorded_at ASC);

ALTER TABLE ride_tracking_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ride participants can read tracking" ON ride_tracking_points FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rides r
      WHERE r.id = ride_id
      AND (r.rider_id = auth.uid() OR r.driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()))
    )
  );
CREATE POLICY "Drivers can insert tracking" ON ride_tracking_points FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rides r
      WHERE r.id = ride_id
      AND r.driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    )
  );

-- ============================================================
-- 9. TABLA location_shares (compartir ubicación en tiempo real)
-- ============================================================
CREATE TABLE IF NOT EXISTS location_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_code VARCHAR(10) NOT NULL UNIQUE,
  ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_shares_code ON location_shares(share_code) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_location_shares_user ON location_shares(user_id);

ALTER TABLE location_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read shares by code" ON location_shares FOR SELECT
  USING (is_active = TRUE);
CREATE POLICY "Users can create own shares" ON location_shares FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Función para obtener datos de compartido
CREATE OR REPLACE FUNCTION get_share_data(p_code VARCHAR)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  current_lat NUMERIC,
  current_lng NUMERIC,
  ride_id UUID,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ls.user_id,
    p.name,
    COALESCE(d.current_lat, 0),
    COALESCE(d.current_lng, 0),
    ls.ride_id,
    ls.expires_at
  FROM location_shares ls
  JOIN profiles p ON p.id = ls.user_id
  LEFT JOIN drivers d ON d.user_id = ls.user_id
  WHERE ls.share_code = p_code
    AND ls.is_active = TRUE
    AND ls.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. FUNCIÓN limpiar location_shares expirados
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS void AS $$
BEGIN
  UPDATE location_shares SET is_active = FALSE WHERE expires_at <= NOW() AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger para limpiar al completar viaje
CREATE OR REPLACE FUNCTION deactivate_ride_shares()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' OR NEW.status = 'cancelled' THEN
    UPDATE location_shares SET is_active = FALSE, expires_at = NOW() WHERE ride_id = NEW.id AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deactivate_ride_shares ON rides;
CREATE TRIGGER trigger_deactivate_ride_shares
  AFTER UPDATE OF status ON rides
  FOR EACH ROW EXECUTE FUNCTION deactivate_ride_shares();

-- ============================================================
-- 11. TABLA cancel_reasons (motivos de cancelación)
-- ============================================================
CREATE TABLE IF NOT EXISTS cancel_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO cancel_reasons (role, reason, sort_order) VALUES
  ('driver', 'Pasajero no se presentó', 1),
  ('driver', 'No puedo llegar al punto de recogida', 2),
  ('driver', 'Pasajero no responde', 3),
  ('driver', 'Problema con el vehículo', 4),
  ('driver', 'Tráfico severo o accidente', 5),
  ('driver', 'Pasajero solicitó cancelar', 6),
  ('driver', 'Destino demasiado lejos', 7),
  ('driver', 'Otro motivo', 99),
  ('rider', 'El conductor tarda mucho', 1),
  ('rider', 'No necesito el viaje', 2),
  ('rider', 'Encontré otro transporte', 3),
  ('rider', 'Precio muy alto', 4),
  ('rider', 'El conductor no llegó', 5),
  ('rider', 'Otro motivo', 99)
ON CONFLICT DO NOTHING;

ALTER TABLE cancel_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cancel reasons readable by all" ON cancel_reasons FOR SELECT USING (true);

-- ============================================================
-- 12. NIVELES DE RECOMPENSA (reward_levels)
-- ============================================================
CREATE TABLE IF NOT EXISTS reward_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  min_rides INTEGER NOT NULL DEFAULT 0,
  max_rides INTEGER,
  commission_discount NUMERIC(5,2) DEFAULT 0,
  bonus_per_ride NUMERIC(10,2) DEFAULT 0,
  priority_matching BOOLEAN DEFAULT FALSE,
  icon VARCHAR(50) DEFAULT 'star',
  color VARCHAR(20) DEFAULT '#6B7280',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO reward_levels (name, min_rides, max_rides, commission_discount, bonus_per_ride, priority_matching, icon, color, sort_order) VALUES
  ('Basico', 0, 19, 0, 0, false, 'star', '#6B7280', 1),
  ('Bronce', 20, 49, 1, 100, false, 'award', '#CD7F32', 2),
  ('Plata', 50, 99, 2, 250, false, 'shield', '#C0C0C0', 3),
  ('Oro', 100, 199, 3, 500, true, 'crown', '#FFD700', 4),
  ('Platino', 200, 499, 5, 750, true, 'gem', '#E5E4E2', 5),
  ('Diamante', 500, NULL, 7, 1000, true, 'diamond', '#B9F2FF', 6)
ON CONFLICT DO NOTHING;

ALTER TABLE reward_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reward levels readable by all" ON reward_levels FOR SELECT USING (true);

-- ============================================================
-- 13. FUNCIÓN actualizar nivel de recompensa
-- ============================================================
CREATE OR REPLACE FUNCTION update_driver_reward_level()
RETURNS TRIGGER AS $$
DECLARE
  new_level VARCHAR(50) := 'basico';
  lvl RECORD;
BEGIN
  SELECT name INTO new_level FROM reward_levels
  WHERE is_active = TRUE
    AND COALESCE(NEW.total_rides, 0) >= min_rides
    AND (max_rides IS NULL OR COALESCE(NEW.total_rides, 0) < max_rides)
  ORDER BY min_rides DESC LIMIT 1;

  IF new_level IS NULL THEN new_level := 'basico'; END IF;

  NEW.reward_level := new_level;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_driver_reward ON drivers;
CREATE TRIGGER trigger_update_driver_reward
  BEFORE UPDATE OF total_rides ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_driver_reward_level();

-- ============================================================
-- 14. NOTIFICACIONES REALTIME - Habilitar en tablas clave
-- ============================================================

-- Verificar y habilitar Realtime para las tablas del conductor
ALTER PUBLICATION supabase_realtime ADD TABLE rides;
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE ride_tracking_points;

-- ============================================================
-- 15. SINCRONIZAR drivers.current_location con PostGIS
-- ============================================================

-- Trigger para actualizar current_location PostGIS cuando cambian lat/lng
CREATE OR REPLACE FUNCTION sync_driver_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL THEN
    NEW.current_location := ST_SetSRID(ST_MakePoint(NEW.current_lng, NEW.current_lat), 4326);
    NEW.location_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_driver_location ON drivers;
CREATE TRIGGER trigger_sync_driver_location
  BEFORE UPDATE OF current_lat, current_lng ON drivers
  FOR EACH ROW EXECUTE FUNCTION sync_driver_location();

-- ============================================================
-- 16. ÍNDICES DE RENDIMIENTO ADICIONALES
-- ============================================================

-- Para búsqueda de rides activos por conductor
CREATE INDEX IF NOT EXISTS idx_rides_driver_active ON rides(driver_id) WHERE status IN ('assigned', 'arriving', 'started');

-- Para rides en estado searching (que los conductores pueden aceptar)
CREATE INDEX IF NOT EXISTS idx_rides_searching ON rides(created_at DESC) WHERE status = 'searching';

-- Para wallets
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- Para transacciones recientes
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_created ON transactions(wallet_id, created_at DESC);

-- Para documentos del conductor
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, type);

-- Para mensajes del ride
CREATE INDEX IF NOT EXISTS idx_ride_messages_ride ON ride_messages(ride_id, created_at ASC);

-- ============================================================
-- 17. TABLA recent_destinations (destinos frecuentes del conductor)
-- ============================================================
CREATE TABLE IF NOT EXISTS recent_destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  destination_type VARCHAR(20) DEFAULT 'other',
  visit_count INTEGER DEFAULT 1,
  last_used TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recent_dest_user ON recent_destinations(user_id, last_used DESC);

ALTER TABLE recent_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own destinations" ON recent_destinations FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- 18. FUNCIÓN actualizar recent_destinations al completar ride
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_recent_destination()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.dest_lat IS NOT NULL AND NEW.dest_lng IS NOT NULL THEN
    INSERT INTO recent_destinations (user_id, address, latitude, longitude, destination_type)
    VALUES (NEW.driver_id, NEW.destination, NEW.dest_lat, NEW.dest_lng, 'ride_destination')
    ON CONFLICT DO NOTHING;

    UPDATE recent_destinations
    SET visit_count = visit_count + 1, last_used = NOW()
    WHERE user_id = NEW.driver_id
      AND ABS(latitude - NEW.dest_lat) < 0.001
      AND ABS(longitude - NEW.dest_lng) < 0.001;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_upsert_recent_dest ON rides;
CREATE TRIGGER trigger_upsert_recent_dest
  AFTER UPDATE OF status ON rides
  FOR EACH ROW EXECUTE FUNCTION upsert_recent_destination();

-- ============================================================
-- 19. TABLA ride_splits (viajes compartidos)
-- ============================================================
CREATE TABLE IF NOT EXISTS ride_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type VARCHAR(20) DEFAULT 'split_fare',
  amount NUMERIC(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ride_splits_ride ON ride_splits(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_splits_user ON ride_splits(user_id);

-- ============================================================
-- 20. CLIENT_PREFERENCES (preferencias de usuarios)
-- ============================================================
CREATE TABLE IF NOT EXISTS client_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_temperature VARCHAR(10) DEFAULT 'cool',
  preferred_music VARCHAR(20) DEFAULT 'none',
  conversation_level VARCHAR(20) DEFAULT 'quiet',
  pet_friendly BOOLEAN DEFAULT false,
  smoking_allowed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON client_preferences FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- 21. FUNCIÓN penalización por cancelación del conductor
-- ============================================================
CREATE OR REPLACE FUNCTION handle_driver_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'cancelled') AND (OLD.status IN ('assigned', 'arriving')) AND (NEW.driver_id IS NOT NULL) THEN
    UPDATE drivers SET
      cancelled_rides = COALESCE(cancelled_rides, 0) + 1,
      status = 'online'
    WHERE id = NEW.driver_id;

    INSERT INTO driver_activity_log (driver_id, user_id, action, details)
    VALUES (NEW.driver_id, NEW.driver_id, 'ride_cancelled',
      jsonb_build_object('ride_id', NEW.id, 'previous_status', OLD.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_driver_cancellation ON rides;
CREATE TRIGGER trigger_driver_cancellation
  AFTER UPDATE OF status ON rides
  FOR EACH ROW EXECUTE FUNCTION handle_driver_cancellation();

-- ============================================================
-- 22. RLS PARA app_notifications
-- ============================================================
CREATE POLICY "Users can read own notifications" ON app_notifications FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own notifications" ON app_notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON app_notifications FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "Admin can read all notifications" ON app_notifications FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- ============================================================
-- 23. VERIFICAR Y CREAR Storage Bucket para documentos del conductor
-- ============================================================
-- (Ejecutar solo si no existe el bucket 'documents')
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('documents', 'documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
-- ON CONFLICT DO NOTHING;

-- ============================================================
-- 24. SINCRONIZACIÓN DE TABLA notifications (compatibilidad)
-- ============================================================
-- Asegurar que notifications tiene las mismas columnas que app_notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Crear vista unificada para que ambas tablas funcionen
CREATE OR REPLACE VIEW unified_notifications AS
SELECT id, user_id, title, message, type, is_read, data, created_at, read_at FROM app_notifications
UNION ALL
SELECT id, user_id, title, message, type, is_read, COALESCE(data, '{}'::jsonb), created_at, read_at FROM notifications
WHERE NOT EXISTS (SELECT 1 FROM app_notifications n WHERE n.id = notifications.id);

-- ============================================================
-- 25. LIMPIEZA AUTOMÁTICA DE DATOS VIEJOS
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Limpiar tracking points de más de 30 días
  DELETE FROM ride_tracking_points WHERE recorded_at < NOW() - INTERVAL '30 days';
  -- Limpiar location_shares inactivos de más de 7 días
  DELETE FROM location_shares WHERE is_active = FALSE AND created_at < NOW() - INTERVAL '7 days';
  -- Limpiar activity logs de más de 90 días
  DELETE FROM driver_activity_log WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 26. TRIGGER: auto-marcar notificaciones como leídas después de 7 días
-- ============================================================
CREATE OR REPLACE FUNCTION auto_mark_old_notifications_read()
RETURNS void AS $$
BEGIN
  UPDATE app_notifications SET is_read = TRUE, read_at = created_at + INTERVAL '7 days'
  WHERE is_read = FALSE AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ✅ COMPLETADO - SQL LISTO PARA EJECUTAR
-- ============================================================
-- Ejecutar TODO el SQL de arriba en el Supabase SQL Editor
-- Luego copiar y pegar TODO como un solo bloque
-- ============================================================

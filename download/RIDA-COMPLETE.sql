-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  RIDA SUPREME SYSTEM — DATABASE COMPLETA (Fase 1+2+3+4+5+Courier+Referrals)  ║
-- ║  INSTRUCCIONES: Copiar TODO y pegar en el SQL Editor de Supabase            ║
-- ║  Este archivo es IDEMPOTENTE: seguro de ejecutar varias veces                ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 0: Extensiones requeridas                          ║
-- ╚══════════════════════════════════════════════════════════════╝
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  LIMPIEZA: Borrar tablas existentes para empezar fresco       ║
-- ╚══════════════════════════════════════════════════════════════╝
DROP TABLE IF EXISTS public.deliveries CASCADE;
DROP TABLE IF EXISTS public.couriers CASCADE;
DROP TABLE IF EXISTS public.ride_messages CASCADE;
DROP TABLE IF EXISTS public.referrals CASCADE;
DROP TABLE IF EXISTS public.vehicle_maintenance CASCADE;
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.emergency_contacts CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.support_chats CASCADE;
DROP TABLE IF EXISTS public.saved_cards CASCADE;
DROP TABLE IF EXISTS public.withdrawal_queue CASCADE;
DROP TABLE IF EXISTS public.client_preferences CASCADE;
DROP TABLE IF EXISTS public.ride_splits CASCADE;
DROP TABLE IF EXISTS public.recent_destinations CASCADE;
DROP TABLE IF EXISTS public.cancel_reasons CASCADE;
DROP TABLE IF EXISTS public.location_shares CASCADE;
DROP TABLE IF EXISTS public.ride_tracking_points CASCADE;
DROP TABLE IF EXISTS public.driver_activity_log CASCADE;
DROP TABLE IF EXISTS public.app_notifications CASCADE;
DROP TABLE IF EXISTS public.location_areas CASCADE;
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.reward_levels CASCADE;
DROP TABLE IF EXISTS public.service_categories CASCADE;
DROP TABLE IF EXISTS public.vehicle_types CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.promo_code_usage CASCADE;
DROP TABLE IF EXISTS public.promo_codes CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.sos_events CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.terms_accepted CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.rides CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;
DROP TABLE IF EXISTS public.drivers CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP VIEW IF EXISTS public.unified_notifications CASCADE;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 1: Tablas Base (Fase 1)                            ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 1.1 PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'driver', 'admin', 'vendor', 'courier')),
  avatar TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 DRIVERS
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('offline', 'online', 'busy', 'suspended')),
  is_verified BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3,2) DEFAULT 5.00,
  total_rides INTEGER DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  work_hours_today DECIMAL(4,2) DEFAULT 0.00,
  is_on_break BOOLEAN DEFAULT FALSE,
  last_online_at TIMESTAMPTZ,
  current_location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 1.3 VEHICLES
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  model TEXT NOT NULL,
  color TEXT NOT NULL,
  year INTEGER,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id)
);

-- 1.4 RIDES (con TODAS las columnas de Fase 1+2+3+4 incluidas)
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL REFERENCES public.profiles(id),
  driver_id UUID REFERENCES public.drivers(id),
  status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'assigned', 'arriving', 'started', 'completed', 'cancelled', 'scheduled')),
  origin TEXT NOT NULL,
  origin_address TEXT,
  origin_lat DECIMAL(10,7),
  origin_lng DECIMAL(10,7),
  destination TEXT NOT NULL,
  dest_address TEXT,
  dest_lat DECIMAL(10,7),
  dest_lng DECIMAL(10,7),
  price DECIMAL(10,2) NOT NULL,
  distance DECIMAL(8,2),
  duration INTEGER,
  surge_multiplier DECIMAL(4,2) DEFAULT 1.00,
  commission_rate DECIMAL(5,2) DEFAULT 15.00,
  driver_earnings DECIMAL(10,2),
  rider_rating INTEGER CHECK (rider_rating >= 1 AND rider_rating <= 5),
  driver_rating INTEGER CHECK (driver_rating >= 1 AND driver_rating <= 5),
  review TEXT,
  is_third_party BOOLEAN DEFAULT FALSE,
  third_party_accepted BOOLEAN DEFAULT FALSE,
  -- Fase 2/3 columnas
  ride_type VARCHAR(20) DEFAULT 'standard',
  payment_method TEXT DEFAULT 'cash',
  payment_status TEXT DEFAULT 'pending',
  card_last_four TEXT,
  sinpe_phone TEXT,
  stops JSONB DEFAULT '[]',
  scheduled_at TIMESTAMPTZ,
  is_scheduled BOOLEAN DEFAULT FALSE,
  tip_amount NUMERIC(10,2) DEFAULT 0,
  actual_duration INTEGER,
  -- Fase 4 columnas
  verification_pin VARCHAR(6),
  pin_verified BOOLEAN DEFAULT false,
  match_retry_count INTEGER DEFAULT 0,
  max_match_retries INTEGER DEFAULT 3,
  match_radius_km DECIMAL(6,2) DEFAULT 5.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 WALLET
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance DECIMAL(12,2) DEFAULT 0.00,
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  total_withdrawn DECIMAL(12,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 1.6 TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'withdrawal', 'commission', 'ride_payment', 'recharge', 'sinpe_transfer')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  description TEXT,
  ride_id UUID REFERENCES public.rides(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.7 DOCUMENTS
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('selfie', 'id_front', 'id_back', 'license_front', 'license_back', 'vehicle_front', 'vehicle_back', 'vehicle_side', 'plate')),
  url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.8 REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  ride_id UUID REFERENCES public.rides(id),
  type TEXT NOT NULL CHECK (type IN ('incident', 'fraud', 'sos', 'complaint', 'driver_report', 'rider_report')),
  description TEXT NOT NULL,
  images TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.9 TERMS ACCEPTED
CREATE TABLE IF NOT EXISTS public.terms_accepted (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  terms_type TEXT NOT NULL CHECK (terms_type IN ('terms', 'privacy', 'third_party', 'driver_terms')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.10 VENDORS
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('pharmacy', 'food', 'stores', 'other')),
  is_approved BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3,2) DEFAULT 5.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 1.11 PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  in_stock BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.12 NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'ride', 'payment', 'sos', 'system')),
  is_read BOOLEAN DEFAULT FALSE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- 1.13 SETTINGS (SOLO key, value, type)
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.14 SOS EVENTS (es TABLE, no vista)
CREATE TABLE IF NOT EXISTS public.sos_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  ride_id UUID REFERENCES public.rides(id),
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 2: Tablas Fase 2                                   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 2.1 PROMO CODES
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  max_uses INTEGER DEFAULT NULL,
  current_uses INTEGER DEFAULT 0,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount DECIMAL(10,2) DEFAULT NULL,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 PROMO CODE USAGE
CREATE TABLE IF NOT EXISTS public.promo_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  ride_id UUID,
  discount_applied DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(promo_code_id, user_id, ride_id)
);

-- 2.3 REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  reviewee_id UUID NOT NULL REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 VEHICLE TYPES
CREATE TABLE IF NOT EXISTS public.vehicle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 500,
  price_per_km DECIMAL(10,2) NOT NULL DEFAULT 100,
  price_per_min DECIMAL(10,2) NOT NULL DEFAULT 10,
  icon TEXT DEFAULT 'car',
  capacity INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 SERVICE CATEGORIES
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'car',
  base_fare DECIMAL(10,2) NOT NULL DEFAULT 500,
  fare_per_km DECIMAL(10,2) NOT NULL DEFAULT 100,
  fare_per_min DECIMAL(10,2) NOT NULL DEFAULT 10,
  surge_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 REWARD LEVELS (versión Fase 3 - más completa para conductores)
CREATE TABLE IF NOT EXISTS public.reward_levels (
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

-- 2.7 ORGANIZATIONS
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'business' CHECK (org_type IN ('business', 'government', 'nonprofit', 'other')),
  payment_method TEXT NOT NULL DEFAULT 'organization' CHECK (payment_method IN ('organization', 'personal', 'mixed')),
  email TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 ORGANIZATION MEMBERS
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role_in_org TEXT NOT NULL DEFAULT 'employee' CHECK (role_in_org IN ('admin', 'manager', 'employee')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- 2.9 LOCATION AREAS
CREATE TABLE IF NOT EXISTS public.location_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  area_type TEXT NOT NULL DEFAULT 'restriction' CHECK (area_type IN ('restriction', 'surge_zone', 'hotspot', 'service_area', 'airport_zone')),
  country TEXT DEFAULT 'Costa Rica',
  coordinates TEXT NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 3: Tablas Fase 3 (App del Conductor)               ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 3.1 Columnas adicionales en DRIVERS
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_lat NUMERIC(10,7);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_lng NUMERIC(10,7);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50) DEFAULT 'carro';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS daily_goal NUMERIC(12,2) DEFAULT 50000;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS total_tips NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS cancelled_rides INTEGER DEFAULT 0;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS accepted_rides INTEGER DEFAULT 0;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS rejected_rides INTEGER DEFAULT 0;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS reward_level VARCHAR(50) DEFAULT 'basico';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS break_until TIMESTAMPTZ;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS total_break_time_min INTEGER DEFAULT 0;

-- 3.2 APP NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.app_notifications (
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

-- 3.3 DRIVER ACTIVITY LOG
CREATE TABLE IF NOT EXISTS public.driver_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.4 RIDE TRACKING POINTS
CREATE TABLE IF NOT EXISTS public.ride_tracking_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  speed NUMERIC(5,2),
  heading NUMERIC(5,2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 LOCATION SHARES
CREATE TABLE IF NOT EXISTS public.location_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_code VARCHAR(10) NOT NULL UNIQUE,
  ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.6 CANCEL REASONS
CREATE TABLE IF NOT EXISTS public.cancel_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);

-- 3.7 RECENT DESTINATIONS
CREATE TABLE IF NOT EXISTS public.recent_destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  destination_type VARCHAR(20) DEFAULT 'other',
  visit_count INTEGER DEFAULT 1,
  last_used TIMESTAMPTZ DEFAULT NOW()
);

-- 3.8 RIDE SPLITS
CREATE TABLE IF NOT EXISTS public.ride_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type VARCHAR(20) DEFAULT 'split_fare',
  amount NUMERIC(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.9 CLIENT PREFERENCES
CREATE TABLE IF NOT EXISTS public.client_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferred_temperature VARCHAR(10) DEFAULT 'cool',
  preferred_music VARCHAR(20) DEFAULT 'none',
  conversation_level VARCHAR(20) DEFAULT 'quiet',
  pet_friendly BOOLEAN DEFAULT false,
  smoking_allowed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 4: Tablas Migration                                 ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 4.1 WITHDRAWAL QUEUE
CREATE TABLE IF NOT EXISTS public.withdrawal_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.2 SAVED CARDS
CREATE TABLE IF NOT EXISTS public.saved_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  card_holder TEXT NOT NULL,
  card_expiry TEXT NOT NULL,
  card_brand TEXT NOT NULL DEFAULT 'other' CHECK (card_brand IN ('visa', 'mastercard', 'amex', 'other')),
  last_four TEXT GENERATED ALWAYS AS (RIGHT(card_number, 4)) STORED,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.3 SUPPORT CHATS
CREATE TABLE IF NOT EXISTS public.support_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_role TEXT NOT NULL DEFAULT 'client' CHECK (user_role IN ('client', 'driver', 'vendor', 'courier')),
  subject TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT DEFAULT '',
  unread_by_admin INTEGER DEFAULT 1,
  unread_by_user INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.4 CHAT MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.support_chats(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'user' CHECK (sender_type IN ('user', 'admin')),
  sender_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 5: Tablas Fase 4                                    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 5.1 EMERGENCY CONTACTS
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  relation VARCHAR(20) DEFAULT 'familiar' CHECK (relation IN ('familiar','amigo','trabajo','otro')),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5.2 USER ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id VARCHAR(50) NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- 5.3 VEHICLE MAINTENANCE
CREATE TABLE IF NOT EXISTS public.vehicle_maintenance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(30) NOT NULL DEFAULT 'general_inspection'
    CHECK (maintenance_type IN ('oil_change','tire_rotation','brake_service','engine_service','general_inspection','battery_replacement','other')),
  description TEXT,
  odometer_km INTEGER,
  cost DECIMAL(10,2),
  maintenance_date DATE,
  next_maintenance_km INTEGER,
  next_maintenance_date DATE,
  shop_name VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5.4 REFERRALS (Invita Amigos)
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code VARCHAR(12) NOT NULL UNIQUE,
  referred_email VARCHAR(255),
  referred_phone VARCHAR(30),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'first_ride_completed', 'rewarded', 'expired')),
  reward_amount DECIMAL(10,2) DEFAULT 0,
  reward_type VARCHAR(20) DEFAULT 'wallet_credit' CHECK (reward_type IN ('wallet_credit', 'ride_credit', 'cashback')),
  referrer_reward_amount DECIMAL(10,2) DEFAULT 0,
  referred_reward_amount DECIMAL(10,2) DEFAULT 0,
  first_ride_id UUID,
  first_ride_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 6: Tablas Fase 5                                    ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 6.1 RIDE MESSAGES (Chat en Vivo durante viaje)
CREATE TABLE IF NOT EXISTS public.ride_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'driver')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 7: Courier System                                   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 7.1 COURIERS
CREATE TABLE IF NOT EXISTS public.couriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL DEFAULT 'moto' CHECK (vehicle_type IN ('moto', 'bici', 'carro')),
  is_online BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('offline', 'online', 'busy', 'delivering', 'suspended')),
  is_verified BOOLEAN DEFAULT FALSE,
  rating DECIMAL(3,2) DEFAULT 5.00,
  total_deliveries INTEGER DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  current_lat DECIMAL(10,7),
  current_lng DECIMAL(10,7),
  last_online_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 7.2 DELIVERIES
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  courier_id UUID REFERENCES public.couriers(id),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  vendor_id UUID REFERENCES public.vendors(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  pickup_address TEXT,
  pickup_lat DECIMAL(10,7),
  pickup_lng DECIMAL(10,7),
  delivery_address TEXT NOT NULL,
  delivery_lat DECIMAL(10,7),
  delivery_lng DECIMAL(10,7),
  items JSONB DEFAULT '[]',
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  delivery_fee DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,
  payment_method TEXT DEFAULT 'efectivo',
  customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
  courier_rating INTEGER CHECK (courier_rating >= 1 AND courier_rating <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 8: INDICES                                          ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_location ON public.drivers USING GIST(current_location);
CREATE INDEX IF NOT EXISTS idx_drivers_status_online ON public.drivers(status) WHERE status IN ('online', 'busy');
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON public.rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_driver_status ON public.rides(driver_id, status) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rides_rider_status ON public.rides(rider_id, status);
CREATE INDEX IF NOT EXISTS idx_rides_searching ON public.rides(created_at DESC) WHERE status = 'searching';
CREATE INDEX IF NOT EXISTS idx_rides_driver_active ON public.rides(driver_id) WHERE status IN ('assigned', 'arriving', 'started');
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_created ON public.transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id, type);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON public.promo_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_promo ON public.promo_code_usage(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_usage_user ON public.promo_code_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_ride ON public.reviews(ride_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_types_active ON public.vehicle_types(is_active);
CREATE INDEX IF NOT EXISTS idx_service_categories_active ON public.service_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_reward_levels_active ON public.reward_levels(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON public.organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_location_areas_active ON public.location_areas(is_active);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_app_notif_user ON public.app_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notif_unread ON public.app_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_driver_activity_driver ON public.driver_activity_log(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_activity_user ON public.driver_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_tracking_ride ON public.ride_tracking_points(ride_id, recorded_at ASC);
CREATE INDEX IF NOT EXISTS idx_location_shares_code ON public.location_shares(share_code) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_location_shares_user ON public.location_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_dest_user ON public.recent_destinations(user_id, last_used DESC);
CREATE INDEX IF NOT EXISTS idx_ride_splits_ride ON public.ride_splits(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_splits_user ON public.ride_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_queue_status ON public.withdrawal_queue(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_queue_user ON public.withdrawal_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_queue_created ON public.withdrawal_queue(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_saved_cards_user ON public.saved_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_support_chats_user ON public.support_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_support_chats_status ON public.support_chats(status);
CREATE INDEX IF NOT EXISTS idx_support_chats_last_msg ON public.support_chats(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON public.chat_messages(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user ON public.emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_driver ON public.vehicle_maintenance(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_vehicle ON public.vehicle_maintenance(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_status ON public.vehicle_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_ride_messages_ride ON public.ride_messages(ride_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ride_messages_sender ON public.ride_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ride_messages_read ON public.ride_messages(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON public.couriers(user_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON public.couriers(status);
CREATE INDEX IF NOT EXISTS idx_couriers_is_online ON public.couriers(is_online);
CREATE INDEX IF NOT EXISTS idx_couriers_vehicle_type ON public.couriers(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier_id ON public.deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON public.deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON public.deliveries(created_at DESC);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 9: Funcion is_admin() (sin recursion)               ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 10: RLS - Habilitar en todas las tablas             ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_accepted ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_tracking_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancel_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 11: POLITICAS RLS                                   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Drop policies existentes (seguro de re-ejecutar)
DO $$ DECLARE r RECORD;
BEGIN FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
END LOOP; END $$;

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin can update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Drivers can be viewed by anyone" ON public.profiles FOR SELECT USING (role = 'driver');

-- Drivers
CREATE POLICY "Drivers can view own data" ON public.drivers FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Drivers can update own data" ON public.drivers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin can manage drivers" ON public.drivers FOR ALL USING (public.is_admin());
CREATE POLICY "Drivers can insert own data" ON public.drivers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Active drivers visible for ride matching" ON public.drivers FOR SELECT USING (status = 'online');

-- Vehicles
CREATE POLICY "Vehicle access via driver" ON public.vehicles FOR ALL USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin()
);

-- Rides
CREATE POLICY "Riders can view own rides" ON public.rides FOR SELECT USING (
  rider_id = auth.uid() OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin()
);
CREATE POLICY "Riders can create rides" ON public.rides FOR INSERT WITH CHECK (rider_id = auth.uid());
CREATE POLICY "Riders can update own rides" ON public.rides FOR UPDATE USING (
  rider_id = auth.uid() OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
);
CREATE POLICY "Admin can manage all rides" ON public.rides FOR ALL USING (public.is_admin());
CREATE POLICY "Drivers can view available rides" ON public.rides FOR SELECT USING (status = 'searching');

-- Wallets
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin can view all wallets" ON public.wallets FOR SELECT USING (public.is_admin());

-- Transactions
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (
  wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
);
CREATE POLICY "System can insert transactions" ON public.transactions FOR INSERT WITH CHECK (
  wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
);

-- Documents
CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can upload documents" ON public.documents FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin can manage documents" ON public.documents FOR ALL USING (public.is_admin());

-- Reports
CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin can manage reports" ON public.reports FOR ALL USING (public.is_admin());

-- Terms
CREATE POLICY "Users can view own terms" ON public.terms_accepted FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can accept terms" ON public.terms_accepted FOR INSERT WITH CHECK (user_id = auth.uid());

-- Vendors
CREATE POLICY "Vendors can view own data" ON public.vendors FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Vendors can manage own data" ON public.vendors FOR ALL USING (user_id = auth.uid());

-- Products
CREATE POLICY "Products visible to all" ON public.products FOR SELECT USING (in_stock = TRUE OR EXISTS (SELECT 1 FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "Vendors can manage own products" ON public.products FOR ALL USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "Admin can manage all products" ON public.products FOR ALL USING (public.is_admin());

-- Notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Settings
CREATE POLICY "Settings visible to all authenticated" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage settings" ON public.settings FOR ALL USING (public.is_admin());

-- SOS
CREATE POLICY "Users can create SOS" ON public.sos_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin can view all SOS" ON public.sos_events FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin can resolve SOS" ON public.sos_events FOR UPDATE USING (public.is_admin());

-- Promo codes
CREATE POLICY "Admins manage promo codes" ON public.promo_codes FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone view active promos" ON public.promo_codes FOR SELECT USING (is_active = true);

-- Promo usage
CREATE POLICY "Users view own promo usage" ON public.promo_code_usage FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins manage promo usage" ON public.promo_code_usage FOR ALL USING (public.is_admin());

-- Reviews
CREATE POLICY "Anyone can read reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT WITH CHECK (reviewer_id = auth.uid());

-- Vehicle types
CREATE POLICY "Anyone view vehicle types" ON public.vehicle_types FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage vehicle types" ON public.vehicle_types FOR ALL USING (public.is_admin());

-- Service categories
CREATE POLICY "Anyone view service categories" ON public.service_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage service categories" ON public.service_categories FOR ALL USING (public.is_admin());

-- Reward levels
CREATE POLICY "Anyone view reward levels" ON public.reward_levels FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage reward levels" ON public.reward_levels FOR ALL USING (public.is_admin());

-- Organizations
CREATE POLICY "Admins manage organizations" ON public.organizations FOR ALL USING (public.is_admin());
CREATE POLICY "Org members view own org" ON public.organizations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND organization_id = id)
);

-- Organization members
CREATE POLICY "Admins manage org members" ON public.organization_members FOR ALL USING (public.is_admin());
CREATE POLICY "Users view own org membership" ON public.organization_members FOR SELECT USING (user_id = auth.uid());

-- Location areas
CREATE POLICY "Admins manage location areas" ON public.location_areas FOR ALL USING (public.is_admin());

-- App notifications
CREATE POLICY "Users can read own app notifs" ON public.app_notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own app notifs" ON public.app_notifications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own app notifs" ON public.app_notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin can read all app notifs" ON public.app_notifications FOR SELECT USING (public.is_admin());

-- Driver activity log
CREATE POLICY "Driver can read own activity" ON public.driver_activity_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin can read all activity" ON public.driver_activity_log FOR SELECT USING (public.is_admin());
CREATE POLICY "Drivers can insert own activity" ON public.driver_activity_log FOR INSERT WITH CHECK (user_id = auth.uid());

-- Ride tracking points
CREATE POLICY "Ride participants can read tracking" ON public.ride_tracking_points FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND (r.rider_id = auth.uid() OR r.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())))
);
CREATE POLICY "Drivers can insert tracking" ON public.ride_tracking_points FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_id AND r.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
);

-- Location shares
CREATE POLICY "Users can read shares by code" ON public.location_shares FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Users can create own shares" ON public.location_shares FOR INSERT WITH CHECK (user_id = auth.uid());

-- Cancel reasons
CREATE POLICY "Cancel reasons readable by all" ON public.cancel_reasons FOR SELECT USING (true);

-- Recent destinations
CREATE POLICY "Users can manage own destinations" ON public.recent_destinations FOR ALL USING (user_id = auth.uid());

-- Client preferences
CREATE POLICY "Users manage own preferences" ON public.client_preferences FOR ALL USING (user_id = auth.uid());

-- Withdrawal queue
CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_queue FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own withdrawals" ON public.withdrawal_queue FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own withdrawals" ON public.withdrawal_queue FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin can manage all withdrawals" ON public.withdrawal_queue FOR ALL USING (public.is_admin());

-- Saved cards
CREATE POLICY "Users can manage own cards" ON public.saved_cards FOR ALL USING (user_id = auth.uid());

-- Support chats
CREATE POLICY "Users can view own chats" ON public.support_chats FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own chats" ON public.support_chats FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own chats" ON public.support_chats FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can view all chats" ON public.support_chats FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all chats" ON public.support_chats FOR UPDATE USING (public.is_admin());

-- Chat messages
CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.support_chats WHERE id = chat_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own messages" ON public.chat_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.support_chats WHERE id = chat_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can view all messages" ON public.chat_messages FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert messages" ON public.chat_messages FOR INSERT WITH CHECK (public.is_admin());

-- Emergency contacts
CREATE POLICY "EC: read own" ON public.emergency_contacts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "EC: insert own" ON public.emergency_contacts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "EC: update own" ON public.emergency_contacts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "EC: delete own" ON public.emergency_contacts FOR DELETE USING (user_id = auth.uid());

-- User achievements
CREATE POLICY "UA: read own" ON public.user_achievements FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "UA: upsert own" ON public.user_achievements FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "UA: update own" ON public.user_achievements FOR UPDATE USING (user_id = auth.uid());

-- Vehicle maintenance
CREATE POLICY "VM: read own" ON public.vehicle_maintenance FOR SELECT USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin()
);
CREATE POLICY "VM: insert own" ON public.vehicle_maintenance FOR INSERT WITH CHECK (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
);
CREATE POLICY "VM: update own" ON public.vehicle_maintenance FOR UPDATE USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin()
);
CREATE POLICY "VM: delete own" ON public.vehicle_maintenance FOR DELETE USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin()
);

-- Referrals
CREATE POLICY "Referrals: read own" ON public.referrals FOR SELECT USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_admin());
CREATE POLICY "Referrals: insert own" ON public.referrals FOR INSERT WITH CHECK (referrer_id = auth.uid());
CREATE POLICY "Referrals: update own" ON public.referrals FOR UPDATE USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- Ride messages
CREATE POLICY "Ride msg: client can read" ON public.ride_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.rides WHERE rides.id = ride_messages.ride_id AND rides.rider_id = auth.uid())
);
CREATE POLICY "Ride msg: driver can read" ON public.ride_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.rides WHERE rides.id = ride_messages.ride_id AND rides.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
);
CREATE POLICY "Ride msg: admin can read" ON public.ride_messages FOR SELECT USING (public.is_admin());
CREATE POLICY "Ride msg: client can insert" ON public.ride_messages FOR INSERT WITH CHECK (
  sender_role = 'client' AND sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.rides WHERE rides.id = ride_messages.ride_id AND rides.rider_id = auth.uid() AND rides.status IN ('assigned','arriving','started'))
);
CREATE POLICY "Ride msg: driver can insert" ON public.ride_messages FOR INSERT WITH CHECK (
  sender_role = 'driver' AND sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.rides WHERE rides.id = ride_messages.ride_id AND rides.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) AND rides.status IN ('assigned','arriving','started'))
);

-- Couriers
CREATE POLICY "Couriers can view own data" ON public.couriers FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Couriers can manage own data" ON public.couriers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Couriers can insert own data" ON public.couriers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Online couriers visible" ON public.couriers FOR SELECT USING (status = 'online');
CREATE POLICY "Admin can manage couriers" ON public.couriers FOR ALL USING (public.is_admin());

-- Deliveries
CREATE POLICY "Customers can view own deliveries" ON public.deliveries FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());
CREATE POLICY "Customers can create deliveries" ON public.deliveries FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Couriers can view assigned deliveries" ON public.deliveries FOR SELECT USING (
  courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid()) OR public.is_admin()
);
CREATE POLICY "Couriers can update assigned deliveries" ON public.deliveries FOR UPDATE USING (
  courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid())
);
CREATE POLICY "Vendors can view own deliveries" ON public.deliveries FOR SELECT USING (
  vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 12: Storage Buckets                                  ║
-- ╚══════════════════════════════════════════════════════════════╝

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('documents', 'documents', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']),
  ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp']),
  ('products', 'products', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('reports', 'reports', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies
DO $$ DECLARE r RECORD;
BEGIN FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage') LOOP
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
END LOOP; END $$;

CREATE POLICY "Users can upload own documents" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can view own documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Admin can view all documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND public.is_admin()
);
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Anyone can view products" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Vendors can upload products" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'products' AND EXISTS (SELECT 1 FROM public.vendors WHERE user_id = auth.uid())
);
CREATE POLICY "Users can upload own reports" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'reports' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Documents unique constraint
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_user_type_unique;
ALTER TABLE public.documents ADD CONSTRAINT documents_user_type_unique UNIQUE (user_id, type);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 13: Triggers                                        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Auto-create profile on signup (version completa con courier)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'driver' THEN
    INSERT INTO public.drivers (user_id) VALUES (NEW.id);
  END IF;
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'vendor' THEN
    INSERT INTO public.vendors (user_id, store_name, category) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name', 'Mi Tienda'), 'other');
  END IF;
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'courier' THEN
    INSERT INTO public.couriers (user_id, vehicle_type) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'vehicle_type', 'moto'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS drivers_updated_at ON public.drivers;
DROP TRIGGER IF EXISTS vehicles_updated_at ON public.vehicles;
DROP TRIGGER IF EXISTS rides_updated_at ON public.rides;
DROP TRIGGER IF EXISTS wallets_updated_at ON public.wallets;
DROP TRIGGER IF EXISTS vendors_updated_at ON public.vendors;
DROP TRIGGER IF EXISTS products_updated_at ON public.products;
DROP TRIGGER IF EXISTS settings_updated_at ON public.settings;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER rides_updated_at BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Sync driver location (lat/lng -> PostGIS)
CREATE OR REPLACE FUNCTION public.sync_driver_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL THEN
    NEW.current_location := ST_SetSRID(ST_MakePoint(NEW.current_lng, NEW.current_lat), 4326);
    NEW.location_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_driver_location ON public.drivers;
CREATE TRIGGER trigger_sync_driver_location BEFORE UPDATE OF current_lat, current_lng ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.sync_driver_location();

-- Support chat last message trigger
CREATE OR REPLACE FUNCTION public.update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.support_chats SET last_message_at = NEW.created_at, last_message_preview = LEFT(NEW.content, 100), updated_at = NOW() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_messages_last_msg ON public.chat_messages;
CREATE TRIGGER chat_messages_last_msg AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_chat_last_message();

-- Driver cancellation trigger
CREATE OR REPLACE FUNCTION public.handle_driver_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'cancelled') AND (OLD.status IN ('assigned', 'arriving')) AND (NEW.driver_id IS NOT NULL) THEN
    UPDATE public.drivers SET cancelled_rides = COALESCE(cancelled_rides, 0) + 1, status = 'online' WHERE id = NEW.driver_id;
    INSERT INTO public.driver_activity_log (driver_id, user_id, action, details)
    VALUES (NEW.driver_id, NEW.driver_id, 'ride_cancelled', jsonb_build_object('ride_id', NEW.id, 'previous_status', OLD.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_driver_cancellation ON public.rides;
CREATE TRIGGER trigger_driver_cancellation AFTER UPDATE OF status ON public.rides FOR EACH ROW EXECUTE FUNCTION public.handle_driver_cancellation();

-- Ride completed -> recent destinations
CREATE OR REPLACE FUNCTION public.upsert_recent_destination()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.dest_lat IS NOT NULL AND NEW.dest_lng IS NOT NULL THEN
    INSERT INTO public.recent_destinations (user_id, address, latitude, longitude, destination_type)
    VALUES (NEW.rider_id, NEW.destination, NEW.dest_lat, NEW.dest_lng, 'ride_destination')
    ON CONFLICT DO NOTHING;
    UPDATE public.recent_destinations SET visit_count = visit_count + 1, last_used = NOW()
    WHERE user_id = NEW.rider_id AND ABS(latitude - NEW.dest_lat) < 0.001 AND ABS(longitude - NEW.dest_lng) < 0.001;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_upsert_recent_dest ON public.rides;
CREATE TRIGGER trigger_upsert_recent_dest AFTER UPDATE OF status ON public.rides FOR EACH ROW EXECUTE FUNCTION public.upsert_recent_destination();

-- Deactivate location shares on ride complete
CREATE OR REPLACE FUNCTION public.deactivate_ride_shares()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' OR NEW.status = 'cancelled' THEN
    UPDATE public.location_shares SET is_active = FALSE, expires_at = NOW() WHERE ride_id = NEW.id AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deactivate_ride_shares ON public.rides;
CREATE TRIGGER trigger_deactivate_ride_shares AFTER UPDATE OF status ON public.rides FOR EACH ROW EXECUTE FUNCTION public.deactivate_ride_shares();

-- Driver reward level trigger
CREATE OR REPLACE FUNCTION public.update_driver_reward_level()
RETURNS TRIGGER AS $$
DECLARE new_level VARCHAR(50) := 'basico';
BEGIN
  SELECT name INTO new_level FROM public.reward_levels WHERE is_active = TRUE AND COALESCE(NEW.total_rides, 0) >= min_rides AND (max_rides IS NULL OR COALESCE(NEW.total_rides, 0) < max_rides) ORDER BY min_rides DESC LIMIT 1;
  IF new_level IS NULL THEN new_level := 'basico'; END IF;
  NEW.reward_level := new_level;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_driver_reward ON public.drivers;
CREATE TRIGGER trigger_update_driver_reward BEFORE UPDATE OF total_rides ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.update_driver_reward_level();

-- Fase 4: Auto-generate PIN when driver assigned
CREATE OR REPLACE FUNCTION public.fn_on_ride_assigned_pin()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_enabled BOOLEAN := true;
BEGIN
  SELECT (value = 'true') INTO v_enabled FROM public.settings WHERE key = 'ride_verification_enabled' LIMIT 1;
  IF v_enabled IS NULL THEN v_enabled := true; END IF;
  IF v_enabled AND NEW.driver_id IS NOT NULL AND NEW.verification_pin IS NULL THEN
    UPDATE public.rides SET verification_pin = LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'), pin_verified = false WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_ride_assigned_pin ON public.rides;
CREATE TRIGGER trg_on_ride_assigned_pin AFTER UPDATE ON public.rides FOR EACH ROW WHEN (OLD.driver_id IS NULL AND NEW.driver_id IS NOT NULL) EXECUTE FUNCTION public.fn_on_ride_assigned_pin();

-- Fase 4: Enforce driver rest breaks
CREATE OR REPLACE FUNCTION public.fn_check_driver_break()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_enabled BOOLEAN; v_interval_min INTEGER; v_duration_min INTEGER; v_rides_since_break INTEGER;
BEGIN
  IF NEW.status != 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;
  SELECT (value = 'true') INTO v_enabled FROM public.settings WHERE key = 'driver_break_enabled' LIMIT 1;
  IF v_enabled IS NULL THEN v_enabled := true; END IF;
  IF NOT v_enabled THEN RETURN NEW; END IF;
  SELECT ABS(value::INTEGER) INTO v_interval_min FROM public.settings WHERE key = 'driver_break_interval_min' LIMIT 1;
  SELECT ABS(value::INTEGER) INTO v_duration_min FROM public.settings WHERE key = 'driver_break_duration_min' LIMIT 1;
  IF v_interval_min IS NULL THEN v_interval_min := 240; END IF;
  IF v_duration_min IS NULL THEN v_duration_min := 20; END IF;
  SELECT COUNT(*) INTO v_rides_since_break FROM public.rides WHERE driver_id = NEW.driver_id AND status = 'completed' AND created_at > COALESCE((SELECT break_until FROM public.drivers WHERE id = NEW.driver_id), '1970-01-01'::TIMESTAMPTZ);
  IF v_rides_since_break >= 6 THEN
    UPDATE public.drivers SET break_until = now() + (v_duration_min || ' minutes')::INTERVAL, total_break_time_min = COALESCE(total_break_time_min, 0) + v_duration_min WHERE id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_driver_break ON public.rides;
CREATE TRIGGER trg_check_driver_break AFTER UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.fn_check_driver_break();


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 14: Funciones RPC                                   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- increment_driver_stats
CREATE OR REPLACE FUNCTION public.increment_driver_stats(p_driver_id UUID, p_earnings NUMERIC)
RETURNS void AS $$
BEGIN UPDATE public.drivers SET total_rides = COALESCE(total_rides, 0) + 1, total_earnings = COALESCE(total_earnings, 0) + p_earnings, updated_at = NOW() WHERE id = p_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_nearby_drivers
CREATE OR REPLACE FUNCTION public.get_nearby_drivers(p_lat NUMERIC, p_lng NUMERIC, p_max_distance_km NUMERIC DEFAULT 30)
RETURNS TABLE (id UUID, user_id UUID, rating NUMERIC, current_lat NUMERIC, current_lng NUMERIC, distance_km NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.user_id, d.rating, d.current_lat, d.current_lng,
    ST_Distance(d.current_location::geography, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000.0 AS distance_km
  FROM public.drivers d
  WHERE d.status = 'online' AND d.is_verified = true AND d.current_lat IS NOT NULL AND d.current_lng IS NOT NULL
  ORDER BY distance_km ASC LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_share_data
CREATE OR REPLACE FUNCTION public.get_share_data(p_code VARCHAR)
RETURNS TABLE (user_id UUID, name TEXT, current_lat NUMERIC, current_lng NUMERIC, ride_id UUID, expires_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT ls.user_id, p.name, COALESCE(d.current_lat, 0), COALESCE(d.current_lng, 0), ls.ride_id, ls.expires_at
  FROM public.location_shares ls JOIN public.profiles p ON p.id = ls.user_id LEFT JOIN public.drivers d ON d.user_id = ls.user_id
  WHERE ls.share_code = p_code AND ls.is_active = TRUE AND ls.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- cleanup_old_data
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void AS $$
BEGIN
  DELETE FROM public.ride_tracking_points WHERE recorded_at < NOW() - INTERVAL '30 days';
  DELETE FROM public.location_shares WHERE is_active = FALSE AND created_at < NOW() - INTERVAL '7 days';
  DELETE FROM public.driver_activity_log WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Fase 4: generate_verification_pin
CREATE OR REPLACE FUNCTION public.generate_verification_pin(p_ride_id UUID)
RETURNS VARCHAR(6) LANGUAGE plpgsql AS $$
DECLARE v_pin VARCHAR(6); v_pin_length INTEGER := 4;
BEGIN
  SELECT ABS(value::INTEGER) INTO v_pin_length FROM public.settings WHERE key = 'ride_verification_pin_length' LIMIT 1;
  IF v_pin_length IS NULL OR v_pin_length < 4 THEN v_pin_length := 4; END IF;
  IF v_pin_length > 6 THEN v_pin_length := 6; END IF;
  v_pin := LPAD(FLOOR(RANDOM() * POWER(10, v_pin_length))::TEXT, v_pin_length, '0');
  UPDATE public.rides SET verification_pin = v_pin, pin_verified = false WHERE id = p_ride_id AND driver_id IS NOT NULL;
  RETURN v_pin;
END;
$$;

-- Fase 4: verify_ride_pin
CREATE OR REPLACE FUNCTION public.verify_ride_pin(p_ride_id UUID, p_pin VARCHAR)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_stored_pin VARCHAR(6); v_enabled BOOLEAN := true;
BEGIN
  SELECT (value = 'true') INTO v_enabled FROM public.settings WHERE key = 'ride_verification_enabled' LIMIT 1;
  IF v_enabled IS NULL THEN v_enabled := true; END IF;
  IF NOT v_enabled THEN RETURN true; END IF;
  SELECT verification_pin INTO v_stored_pin FROM public.rides WHERE id = p_ride_id AND driver_id IS NOT NULL;
  IF v_stored_pin IS NULL THEN RETURN false; END IF;
  IF v_stored_pin = p_pin THEN UPDATE public.rides SET pin_verified = true WHERE id = p_ride_id; RETURN true; END IF;
  RETURN false;
END;
$$;

-- Fase 4: compare_fare_by_type
CREATE OR REPLACE FUNCTION public.compare_fare_by_type(
  p_origin_lat DECIMAL(10,7), p_origin_lng DECIMAL(10,7), p_dest_lat DECIMAL(10,7), p_dest_lng DECIMAL(10,7)
)
RETURNS TABLE(type TEXT, price NUMERIC, distance NUMERIC, duration NUMERIC, eta_min NUMERIC) LANGUAGE plpgsql AS $$
DECLARE v_distance_km NUMERIC; v_base_price NUMERIC := 800; v_price_per_km NUMERIC := 650; v_speed_kmh NUMERIC := 30;
BEGIN
  SELECT 6371 * 2 * ASIN(SQRT(LEAST(1, SIN(RADIANS(p_dest_lat - p_origin_lat) / 2) * SIN(RADIANS(p_dest_lat - p_origin_lat) / 2) + COS(RADIANS(p_origin_lat)) * COS(RADIANS(p_dest_lat)) * SIN(RADIANS(p_dest_lng - p_origin_lng) / 2) * SIN(RADIANS(p_dest_lng - p_origin_lng) / 2)))) INTO v_distance_km;
  IF v_distance_km IS NULL OR v_distance_km < 0.1 THEN v_distance_km := 0.5; END IF;
  RETURN QUERY
  SELECT rt.type, ROUND(LEAST(GREATEST(v_base_price * rt.multiplier + v_distance_km * v_price_per_km * rt.multiplier, 500), 500000)) AS price,
    ROUND(v_distance_km, 2) AS distance, ROUND((v_distance_km / v_speed_kmh) * 60 * rt.duration_factor) AS duration,
    ROUND((v_distance_km / v_speed_kmh) * 60 * rt.duration_factor * 0.3 + 3) AS eta_min
  FROM (VALUES ('economico', 1.0, 1.0), ('premium', 2.0, 0.9), ('suv', 2.5, 1.1), ('moto', 0.6, 0.6), ('moto_express', 0.5, 0.5)) AS rt(type, multiplier, duration_factor);
END;
$$;

-- Fase 4: get_monthly_passenger_stats
CREATE OR REPLACE FUNCTION public.get_monthly_passenger_stats(p_user_id UUID, p_month VARCHAR(7))
RETURNS TABLE(total_rides BIGINT, total_spent NUMERIC, total_tips NUMERIC, total_distance_km NUMERIC, avg_fare NUMERIC, completed BIGINT, cancelled BIGINT, most_common_type TEXT) LANGUAGE plpgsql STABLE AS $$
DECLARE v_month_start TIMESTAMPTZ := (p_month || '-01T00:00:00')::TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ := (p_month || '-01T00:00:00')::TIMESTAMPTZ + INTERVAL '1 month' - INTERVAL '1 second';
BEGIN
  RETURN QUERY
  SELECT COUNT(*)::BIGINT,
    COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.price ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.status = 'completed' THEN COALESCE(r.tip_amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.distance ELSE 0 END), 0),
    CASE WHEN COUNT(*) FILTER (WHERE r.status = 'completed') > 0 THEN AVG(r.price) FILTER (WHERE r.status = 'completed') ELSE 0 END,
    COUNT(*) FILTER (WHERE r.status = 'completed')::BIGINT,
    COUNT(*) FILTER (WHERE r.status = 'cancelled')::BIGINT,
    (SELECT r2.ride_type FROM public.rides r2 WHERE r2.rider_id = p_user_id AND r2.status = 'completed' AND r2.created_at >= v_month_start AND r2.created_at <= v_month_end GROUP BY r2.ride_type ORDER BY COUNT(*) DESC LIMIT 1)
  FROM public.rides r WHERE r.rider_id = p_user_id AND r.created_at >= v_month_start AND r.created_at <= v_month_end;
END;
$$;

-- Fase 4: get_driver_earnings_detail
CREATE OR REPLACE FUNCTION public.get_driver_earnings_detail(p_driver_id UUID, p_period TEXT DEFAULT 'week')
RETURNS TABLE(total_rides BIGINT, total_earnings NUMERIC, total_tips NUMERIC, total_distance_km NUMERIC, daily JSONB) LANGUAGE plpgsql STABLE AS $$
DECLARE v_start TIMESTAMPTZ; v_end TIMESTAMPTZ;
BEGIN
  CASE p_period
    WHEN 'today' THEN v_start := date_trunc('day', now()); v_end := v_start + INTERVAL '1 day';
    WHEN 'week' THEN v_start := date_trunc('week', now()); v_end := v_start + INTERVAL '1 week';
    WHEN 'month' THEN v_start := date_trunc('month', now()); v_end := v_start + INTERVAL '1 month';
    WHEN 'year' THEN v_start := date_trunc('year', now()); v_end := v_start + INTERVAL '1 year';
    ELSE v_start := date_trunc('week', now()); v_end := v_start + INTERVAL '1 week';
  END CASE;
  RETURN QUERY
  SELECT COUNT(*)::BIGINT, COALESCE(SUM(r.price), 0), COALESCE(SUM(COALESCE(r.tip_amount, 0)), 0), COALESCE(SUM(COALESCE(r.distance, 0)), 0),
    (SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::JSONB) FROM (
      SELECT dd.date::TEXT, COALESCE(dd.rides, 0)::BIGINT AS rides, COALESCE(dd.earnings, 0)::NUMERIC AS earnings,
        COALESCE(dd.tips, 0)::NUMERIC AS tips, COALESCE(dd.distance, 0)::NUMERIC AS distance,
        CASE WHEN dd.rides > 0 THEN dd.earnings / dd.rides ELSE 0 END AS avg_fare
      FROM (SELECT created_at::date AS date, COUNT(*) AS rides, SUM(price) AS earnings, SUM(COALESCE(tip_amount, 0)) AS tips, SUM(COALESCE(distance, 0)) AS distance
        FROM public.rides WHERE driver_id = p_driver_id AND status = 'completed' AND completed_at >= v_start AND completed_at <= v_end GROUP BY created_at::date) dd ORDER BY dd.date
    ) d)
  FROM public.rides r WHERE r.driver_id = p_driver_id AND r.status = 'completed' AND r.completed_at >= v_start AND r.completed_at <= v_end;
END;
$$;

-- Fase 4: recharge_wallet
CREATE OR REPLACE FUNCTION public.recharge_wallet(p_user_id UUID, p_amount NUMERIC, p_method TEXT DEFAULT 'sinpe')
RETURNS TABLE(new_balance NUMERIC) LANGUAGE plpgsql AS $$
DECLARE v_wallet_id UUID; v_new_balance NUMERIC; v_min_amount NUMERIC := 1000; v_max_amount NUMERIC := 100000;
BEGIN
  SELECT value::NUMERIC INTO v_min_amount FROM public.settings WHERE key = 'wallet_min_recharge' LIMIT 1;
  SELECT value::NUMERIC INTO v_max_amount FROM public.settings WHERE key = 'wallet_max_recharge' LIMIT 1;
  IF v_min_amount IS NULL THEN v_min_amount := 1000; END IF;
  IF v_max_amount IS NULL THEN v_max_amount := 100000; END IF;
  IF p_amount IS NULL OR p_amount < v_min_amount THEN RAISE EXCEPTION 'Monto minimo de recarga: %', v_min_amount; END IF;
  IF p_amount > v_max_amount THEN RAISE EXCEPTION 'Monto maximo de recarga: %', v_max_amount; END IF;
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_user_id LIMIT 1;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance, total_earnings, total_withdrawn) VALUES (p_user_id, p_amount, 0, 0) RETURNING id INTO v_wallet_id;
    v_new_balance := p_amount;
  ELSE
    UPDATE public.wallets SET balance = balance + p_amount WHERE id = v_wallet_id RETURNING balance INTO v_new_balance;
  END IF;
  INSERT INTO public.transactions (wallet_id, amount, type, status, description) VALUES (v_wallet_id, p_amount, 'credit', 'completed', 'Recarga via ' || COALESCE(p_method, 'sinpe') || ' - C' || p_amount);
  RETURN QUERY SELECT v_new_balance;
END;
$$;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 15: Realtime                                        ║
-- ╚══════════════════════════════════════════════════════════════╝

DO $$ BEGIN
  INSERT INTO pg_publication (pubname, pubowner, puballtables) VALUES ('supabase_realtime', 'postgres', true) ON CONFLICT (pubname) DO NOTHING;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_tracking_points;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 16: Settings (TODAS las configuraciones)             ║
-- ╚══════════════════════════════════════════════════════════════╝

INSERT INTO public.settings (key, value, type) VALUES
  -- Fase 1
  ('base_price', '1500', 'number'),
  ('price_per_km', '500', 'number'),
  ('price_per_minute', '50', 'number'),
  ('commission_rate', '15', 'number'),
  ('surge_enabled', 'true', 'boolean'),
  ('registration_open', 'true', 'boolean'),
  ('auto_assign_rides', 'true', 'boolean'),
  ('sos_enabled', 'true', 'boolean'),
  ('maintenance_mode', 'false', 'boolean'),
  ('max_login_attempts', '5', 'number'),
  ('lockout_duration_minutes', '15', 'number'),
  ('min_withdrawal_amount', '10000', 'number'),
  ('max_daily_withdrawals', '1', 'number'),
  ('max_work_hours', '12', 'number'),
  ('min_break_hours', '6', 'number'),
  -- Fase 2/3
  ('driver_max_work_hours', '12', 'number'),
  ('driver_rest_hours', '6', 'number'),
  ('driver_default_commission', '15', 'number'),
  ('driver_cancel_penalty', '500', 'number'),
  ('driver_min_rating', '4.0', 'number'),
  ('driver_accept_timeout', '15', 'number'),
  ('driver_max_rejections', '5', 'number'),
  ('driver_daily_goal', '50000', 'number'),
  ('surge_min_multiplier', '1.2', 'number'),
  ('surge_max_multiplier', '3.0', 'number'),
  ('max_daily_withdrawal', '200000', 'number'),
  -- Fase 4
  ('ride_verification_enabled', 'true', 'boolean'),
  ('ride_verification_pin_length', '4', 'number'),
  ('match_retry_enabled', 'true', 'boolean'),
  ('match_max_retries', '3', 'number'),
  ('match_initial_radius_km', '5', 'number'),
  ('match_radius_increment_km', '3', 'number'),
  ('driver_break_enabled', 'true', 'boolean'),
  ('driver_break_interval_min', '240', 'number'),
  ('driver_break_duration_min', '20', 'number'),
  ('wallet_min_recharge', '1000', 'number'),
  ('wallet_max_recharge', '100000', 'number'),
  ('achievements_enabled', 'true', 'boolean'),
  ('maintenance_reminder_km', '500', 'number'),
  -- Referrals
  ('referral_enabled', 'true', 'boolean'),
  ('referrer_reward', '3000', 'number'),
  ('referred_reward', '1500', 'number'),
  ('referral_expires_days', '30', 'number')
ON CONFLICT (key) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 17: Datos Iniciales (Seed Data)                     ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Vehicle Types
INSERT INTO public.vehicle_types (name, description, base_price, price_per_km, price_per_min, icon, capacity, sort_order) VALUES
  ('Moto', 'Mototaxi rapido para una persona', 300, 60, 5, 'bike', 1, 1),
  ('Sedan', 'Auto estandar hasta 4 pasajeros', 500, 100, 10, 'car', 4, 2),
  ('SUV', 'Vehiculo grande hasta 6 pasajeros', 800, 150, 15, 'truck', 6, 3),
  ('Van', 'Van para grupos grandes hasta 12', 1200, 200, 20, 'bus', 12, 4),
  ('Premium', 'Auto de lujo con conductor profesional', 1500, 250, 25, 'gem', 4, 5)
ON CONFLICT (name) DO NOTHING;

-- Service Categories
INSERT INTO public.service_categories (name, description, icon, base_fare, fare_per_km, fare_per_min, sort_order) VALUES
  ('Basic', 'Taxi estandar economico', 'car', 500, 100, 10, 1),
  ('SUV', 'Vehiculo grande para familias y grupos', 'truck', 800, 150, 15, 2),
  ('Luxurious', 'Vehiculo premium con conductor profesional', 'gem', 1500, 250, 25, 3),
  ('Electric', 'Vehiculo electrico ecologico', 'zap', 600, 110, 10, 4),
  ('Express', 'Servicio rapido de entrega', 'package', 300, 80, 5, 5),
  ('Shared', 'Viaje compartido con otros pasajeros', 'users', 300, 60, 5, 6)
ON CONFLICT (name) DO NOTHING;

-- Reward Levels
INSERT INTO public.reward_levels (name, min_rides, max_rides, commission_discount, bonus_per_ride, priority_matching, icon, color, sort_order) VALUES
  ('Basico', 0, 19, 0, 0, false, 'star', '#6B7280', 1),
  ('Bronce', 20, 49, 1, 100, false, 'award', '#CD7F32', 2),
  ('Plata', 50, 99, 2, 250, false, 'shield', '#C0C0C0', 3),
  ('Oro', 100, 199, 3, 500, true, 'crown', '#FFD700', 4),
  ('Platino', 200, 499, 5, 750, true, 'gem', '#E5E4E2', 5),
  ('Diamante', 500, NULL, 7, 1000, true, 'diamond', '#B9F2FF', 6)
ON CONFLICT DO NOTHING;

-- Cancel Reasons
INSERT INTO public.cancel_reasons (role, reason, sort_order) VALUES
  ('driver', 'Pasajero no se presento', 1),
  ('driver', 'No puedo llegar al punto de recogida', 2),
  ('driver', 'Pasajero no responde', 3),
  ('driver', 'Problema con el vehiculo', 4),
  ('driver', 'Trafico severo o accidente', 5),
  ('driver', 'Pasajero solicito cancelar', 6),
  ('driver', 'Destino demasiado lejos', 7),
  ('driver', 'Otro motivo', 99),
  ('rider', 'El conductor tarda mucho', 1),
  ('rider', 'No necesito el viaje', 2),
  ('rider', 'Encontre otro transporte', 3),
  ('rider', 'Precio muy alto', 4),
  ('rider', 'El conductor no llego', 5),
  ('rider', 'Otro motivo', 99)
ON CONFLICT DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 18: Vista unificada de notificaciones               ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW public.unified_notifications AS
SELECT id, user_id, title, message, type, is_read, data, created_at, read_at FROM public.app_notifications
UNION ALL
SELECT id, user_id, title, message, type, is_read, COALESCE(data, '{}'::jsonb), created_at, read_at FROM public.notifications
WHERE NOT EXISTS (SELECT 1 FROM public.app_notifications n WHERE n.id = public.notifications.id);


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  SECCION 19: Verificacion Final                               ║
-- ╚══════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  v_tables INTEGER;
  v_cols_rides INTEGER;
  v_cols_drivers INTEGER;
  v_settings INTEGER;
  v_functions INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_tables FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  RAISE NOTICE 'Total tables: %', v_tables;

  SELECT COUNT(*) INTO v_cols_rides FROM information_schema.columns
  WHERE table_name = 'rides';
  RAISE NOTICE 'Rides columns: %', v_cols_rides;

  SELECT COUNT(*) INTO v_cols_drivers FROM information_schema.columns
  WHERE table_name = 'drivers';
  RAISE NOTICE 'Drivers columns: %', v_cols_drivers;

  SELECT COUNT(*) INTO v_settings FROM public.settings;
  RAISE NOTICE 'Settings count: %', v_settings;

  SELECT COUNT(*) INTO v_functions FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND prokind = 'f';
  RAISE NOTICE 'Public functions: %', v_functions;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RIDA SUPREME SYSTEM: DATABASE COMPLETE!';
  RAISE NOTICE '========================================';
END;
$$;

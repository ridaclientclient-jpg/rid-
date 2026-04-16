-- =====================================================
-- RIDA SUPREME SYSTEM — SUPABASE DATABASE SETUP
-- =====================================================
-- Run this SQL in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/behwnnvrdfrlwnwlfmxt/sql
-- =====================================================

-- 1. ENABLE REQUIRED EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. PROFILES TABLE (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'driver', 'admin', 'vendor')),
  avatar TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DRIVERS TABLE
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

-- 4. VEHICLES TABLE
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

-- 5. RIDES TABLE
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL REFERENCES public.profiles(id),
  driver_id UUID REFERENCES public.drivers(id),
  status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'assigned', 'arriving', 'started', 'completed', 'cancelled')),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. WALLET TABLE
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

-- 7. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'withdrawal', 'commission', 'ride_payment')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  description TEXT,
  ride_id UUID REFERENCES public.rides(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. DOCUMENTS TABLE
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

-- 9. REPORTS TABLE
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

-- 10. TERMS ACCEPTED TABLE
CREATE TABLE IF NOT EXISTS public.terms_accepted (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  terms_type TEXT NOT NULL CHECK (terms_type IN ('terms', 'privacy', 'third_party', 'driver_terms')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. VENDORS TABLE
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

-- 12. PRODUCTS TABLE
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

-- 13. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'ride', 'payment', 'sos', 'system')),
  is_read BOOLEAN DEFAULT FALSE,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. SOS EVENTS TABLE
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

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON public.drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_location ON public.drivers USING GIST(current_location);
CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON public.rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
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

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin can update all profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Drivers can be viewed by anyone" ON public.profiles FOR SELECT USING (role = 'driver');

-- Drivers policies
CREATE POLICY "Drivers can view own data" ON public.drivers FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Drivers can update own data" ON public.drivers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin can manage drivers" ON public.drivers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Drivers can insert own data" ON public.drivers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Active drivers visible for ride matching" ON public.drivers FOR SELECT USING (status = 'online');

-- Vehicles policies
CREATE POLICY "Vehicle access via driver" ON public.vehicles FOR ALL USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Rides policies
CREATE POLICY "Riders can view own rides" ON public.rides FOR SELECT USING (
  rider_id = auth.uid() OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Riders can create rides" ON public.rides FOR INSERT WITH CHECK (rider_id = auth.uid());
CREATE POLICY "Riders can update own rides" ON public.rides FOR UPDATE USING (
  rider_id = auth.uid() OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
);
CREATE POLICY "Admin can manage all rides" ON public.rides FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Drivers can view available rides" ON public.rides FOR SELECT USING (status = 'searching');

-- Wallets policies
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admin can view all wallets" ON public.wallets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (
  wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
);
CREATE POLICY "System can insert transactions" ON public.transactions FOR INSERT WITH CHECK (
  wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
);

-- Documents policies
CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can upload documents" ON public.documents FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin can manage documents" ON public.documents FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Reports policies
CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin can manage reports" ON public.reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Terms policies
CREATE POLICY "Users can view own terms" ON public.terms_accepted FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can accept terms" ON public.terms_accepted FOR INSERT WITH CHECK (user_id = auth.uid());

-- Vendor policies
CREATE POLICY "Vendors can view own data" ON public.vendors FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Vendors can manage own data" ON public.vendors FOR ALL USING (user_id = auth.uid());

-- Products policies
CREATE POLICY "Products visible to all" ON public.products FOR SELECT USING (in_stock = TRUE OR EXISTS (SELECT 1 FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "Vendors can manage own products" ON public.products FOR ALL USING (
  vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
);
CREATE POLICY "Admin can manage all products" ON public.products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Settings policies
CREATE POLICY "Settings visible to all authenticated" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage settings" ON public.settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- SOS policies
CREATE POLICY "Users can create SOS" ON public.sos_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin can view all SOS" ON public.sos_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin can resolve SOS" ON public.sos_events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- TRIGGER: Auto-create profile on signup
-- =====================================================
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
  
  -- Create wallet for new user
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);
  
  -- If driver, create driver record
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'driver' THEN
    INSERT INTO public.drivers (user_id)
    VALUES (NEW.id);
  END IF;
  
  -- If vendor, create vendor record
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'client') = 'vendor' THEN
    INSERT INTO public.vendors (user_id, store_name, category)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'store_name', 'Mi Tienda'), 'other');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TRIGGER: Auto-update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER rides_updated_at BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- DEFAULT SETTINGS
-- =====================================================
INSERT INTO public.settings (key, value, type) VALUES
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
  ('min_break_hours', '6', 'number')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- SUPABASE STORAGE: Create buckets
-- =====================================================
-- Run these in Supabase Dashboard > Storage:
-- 1. Create bucket: "documents" (public: false)
-- 2. Create bucket: "avatars" (public: true)
-- 3. Create bucket: "products" (public: true)
-- 4. Create bucket: "reports" (public: false)

-- =====================================================
-- DONE! Database is ready.
-- =====================================================

-- ============================================================
-- RIDA SUPREME SYSTEM - FASE 2: Todas las tablas nuevas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. PROMO CODES (Códigos promocionales)
-- ============================================================
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

-- 2. PROMO CODE USAGE (Uso de códigos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promo_code_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    ride_id UUID,
    discount_applied DECIMAL(10,2) NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(promo_code_id, user_id, ride_id)
);

-- 3. REVIEWS (Reseñas de viajes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id),
    reviewee_id UUID NOT NULL REFERENCES auth.users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VEHICLE TYPES (Tipos de vehículo)
-- ============================================================
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

-- 5. SERVICE CATEGORIES (Categorías de servicio - Basic, SUV, etc.)
-- ============================================================
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

-- 6. REWARD LEVELS (Niveles de recompensa - Silver, Gold, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reward_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    level_type TEXT NOT NULL CHECK (level_type IN ('silver', 'gold', 'platinum', 'diamond')),
    is_active BOOLEAN DEFAULT true,
    min_trips INTEGER NOT NULL DEFAULT 0,
    min_rating DECIMAL(3,2) NOT NULL DEFAULT 4.0,
    max_cancellation_rate DECIMAL(5,2) NOT NULL DEFAULT 30,
    min_acceptance_rate DECIMAL(5,2) NOT NULL DEFAULT 70,
    reward_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    bonus_per_ride DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ORGANIZATIONS (Cuentas corporativas)
-- ============================================================
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

-- Tabla pivote: miembros de organizaciones
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    role_in_org TEXT NOT NULL DEFAULT 'employee' CHECK (role_in_org IN ('admin', 'manager', 'employee')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 8. LOCATION AREAS (Áreas geográficas)
-- ============================================================
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

-- ============================================================
-- ÍNDICES
-- ============================================================
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

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_areas ENABLE ROW LEVEL SECURITY;

-- Promo codes: admins pueden todo, usuarios pueden ver activos
CREATE POLICY "Admins manage promo codes" ON public.promo_codes FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Anyone view active promos" ON public.promo_codes FOR SELECT
USING (is_active = true);

-- Promo usage: usuarios ven los suyos, admins ven todos
CREATE POLICY "Users view own promo usage" ON public.promo_code_usage FOR SELECT
USING (user_id = auth.uid());
CREATE POLICY "Admins manage promo usage" ON public.promo_code_usage FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Reviews: cualquiera puede ver, usuarios pueden crear
CREATE POLICY "Anyone can read reviews" ON public.reviews FOR SELECT
USING (true);
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT
WITH CHECK (reviewer_id = auth.uid());

-- Vehicle types: admins gestionan, cualquiera puede ver
CREATE POLICY "Anyone view vehicle types" ON public.vehicle_types FOR SELECT
USING (is_active = true);
CREATE POLICY "Admins manage vehicle types" ON public.vehicle_types FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Service categories: admins gestionan, cualquiera puede ver
CREATE POLICY "Anyone view service categories" ON public.service_categories FOR SELECT
USING (is_active = true);
CREATE POLICY "Admins manage service categories" ON public.service_categories FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Reward levels: admins gestionan
CREATE POLICY "Admins manage reward levels" ON public.reward_levels FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Anyone view reward levels" ON public.reward_levels FOR SELECT
USING (is_active = true);

-- Organizations: admins gestionan
CREATE POLICY "Admins manage organizations" ON public.organizations FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Org members view own org" ON public.organizations FOR SELECT
USING (EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND organization_id = id));

-- Organization members
CREATE POLICY "Admins manage org members" ON public.organization_members FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users view own org membership" ON public.organization_members FOR SELECT
USING (user_id = auth.uid());

-- Location areas: admins gestionan
CREATE POLICY "Admins manage location areas" ON public.location_areas FOR ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- TRIGGERS: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER promo_codes_updated_at BEFORE UPDATE ON public.promo_codes
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER vehicle_types_updated_at BEFORE UPDATE ON public.vehicle_types
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER service_categories_updated_at BEFORE UPDATE ON public.service_categories
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER reward_levels_updated_at BEFORE UPDATE ON public.reward_levels
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER location_areas_updated_at BEFORE UPDATE ON public.location_areas
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ============================================================
-- DATOS INICIALES (Seed data)
-- ============================================================

-- Vehicle Types iniciales
INSERT INTO public.vehicle_types (name, description, base_price, price_per_km, price_per_min, icon, capacity, sort_order) VALUES
('Moto', 'Mototaxi rapido para una persona', 300, 60, 5, 'bike', 1, 1),
('Sedan', 'Auto estandar hasta 4 pasajeros', 500, 100, 10, 'car', 4, 2),
('SUV', 'Vehiculo grande hasta 6 pasajeros', 800, 150, 15, 'truck', 6, 3),
('Van', 'Van para grupos grandes hasta 12', 1200, 200, 20, 'bus', 12, 4),
('Premium', 'Auto de lujo con conductor profesional', 1500, 250, 25, 'gem', 4, 5)
ON CONFLICT (name) DO NOTHING;

-- Service Categories iniciales
INSERT INTO public.service_categories (name, description, icon, base_fare, fare_per_km, fare_per_min, sort_order) VALUES
('Basic', 'Taxi estandar economico', 'car', 500, 100, 10, 1),
('SUV', 'Vehiculo grande para familias y grupos', 'truck', 800, 150, 15, 2),
('Luxurious', 'Vehiculo premium con conductor profesional', 'gem', 1500, 250, 25, 3),
('Electric', 'Vehiculo electrico ecologico', 'zap', 600, 110, 10, 4),
('Express', 'Servicio rapido de entrega', 'package', 300, 80, 5, 5),
('Shared', 'Viaje compartido con otros pasajeros', 'users', 300, 60, 5, 6)
ON CONFLICT (name) DO NOTHING;

-- Reward Levels iniciales
INSERT INTO public.reward_levels (name, description, level_type, min_trips, min_rating, max_cancellation_rate, min_acceptance_rate, reward_multiplier, bonus_per_ride) VALUES
('Silver', 'Conductor nivel Silver - beneficios basicos', 'silver', 13, 4.00, 30, 70, 1.00, 0),
('Gold', 'Conductor nivel Gold - beneficios premium', 'gold', 15, 4.50, 20, 80, 1.10, 200),
('Platinum', 'Conductor nivel Platinum - maximos beneficios', 'platinum', 25, 4.70, 15, 85, 1.20, 400),
('Diamond', 'Conductor nivel Diamond - exclusivo', 'diamond', 50, 4.90, 10, 90, 1.30, 600)
ON CONFLICT (name) DO NOTHING;

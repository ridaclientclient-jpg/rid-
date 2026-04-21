-- =====================================================
-- RIDA SUPREME SYSTEM — NEW ADMIN PAGES MIGRATION
-- Tables: reward_levels, organizations, organization_members, location_areas
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. REWARD LEVELS TABLE
CREATE TABLE IF NOT EXISTS public.reward_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  level_type TEXT NOT NULL DEFAULT 'silver' CHECK (level_type IN ('silver', 'gold', 'platinum', 'diamond')),
  is_active BOOLEAN DEFAULT TRUE,
  min_trips INTEGER DEFAULT 0,
  min_rating DECIMAL(3,2) DEFAULT 4.00,
  max_cancellation_rate DECIMAL(5,2) DEFAULT 10.00,
  min_acceptance_rate DECIMAL(5,2) DEFAULT 80.00,
  reward_multiplier DECIMAL(4,2) DEFAULT 1.00,
  bonus_per_ride DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  org_type TEXT NOT NULL DEFAULT 'negocio' CHECK (org_type IN ('negocio', 'gobierno', 'ong', 'otro')),
  payment_method TEXT NOT NULL DEFAULT 'factura' CHECK (payment_method IN ('factura', 'tarjeta_corporativa', 'sinpe_empresarial', 'transferencia', 'credito')),
  email TEXT,
  phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ORGANIZATION MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_org TEXT NOT NULL DEFAULT 'miembro' CHECK (role_in_org IN ('admin', 'gerente', 'miembro')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- 4. LOCATION AREAS TABLE
CREATE TABLE IF NOT EXISTS public.location_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  area_type TEXT NOT NULL DEFAULT 'service_area' CHECK (area_type IN ('restriction', 'surge_zone', 'hotspot', 'service_area', 'airport_zone')),
  country TEXT DEFAULT 'Costa Rica',
  coordinates TEXT DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_reward_levels_type ON public.reward_levels(level_type);
CREATE INDEX IF NOT EXISTS idx_reward_levels_active ON public.reward_levels(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON public.organizations(org_type);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON public.organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_location_areas_type ON public.location_areas(area_type);
CREATE INDEX IF NOT EXISTS idx_location_areas_active ON public.location_areas(is_active);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.reward_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_areas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe to re-run)
DO $$ BEGIN DROP POLICY IF EXISTS "Admin can manage reward_levels" ON public.reward_levels; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Anyone can view reward_levels" ON public.reward_levels; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Admin can manage organizations" ON public.organizations; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Anyone can view organizations" ON public.organizations; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Admin can manage org_members" ON public.organization_members; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Anyone can view org_members" ON public.organization_members; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Admin can manage location_areas" ON public.location_areas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Anyone can view location_areas" ON public.location_areas; END $$;

-- Reward levels policies
CREATE POLICY "Anyone can view reward_levels" ON public.reward_levels FOR SELECT USING (true);
CREATE POLICY "Admin can manage reward_levels" ON public.reward_levels FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Organizations policies
CREATE POLICY "Anyone can view organizations" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Admin can manage organizations" ON public.organizations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Organization members policies
CREATE POLICY "Anyone can view org_members" ON public.organization_members FOR SELECT USING (true);
CREATE POLICY "Admin can manage org_members" ON public.organization_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Location areas policies
CREATE POLICY "Anyone can view location_areas" ON public.location_areas FOR SELECT USING (true);
CREATE POLICY "Admin can manage location_areas" ON public.location_areas FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- TRIGGERS: Auto-update timestamps
-- =====================================================
CREATE TRIGGER reward_levels_updated_at BEFORE UPDATE ON public.reward_levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER location_areas_updated_at BEFORE UPDATE ON public.location_areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- SEED DATA: Default reward levels
-- =====================================================
INSERT INTO public.reward_levels (name, description, level_type, is_active, min_trips, min_rating, max_cancellation_rate, min_acceptance_rate, reward_multiplier, bonus_per_ride) VALUES
  ('Plata', 'Nivel basico para conductores nuevos', 'silver', true, 0, 4.00, 15.00, 70.00, 1.00, 0),
  ('Oro', 'Conductores con buen rendimiento', 'gold', true, 100, 4.50, 10.00, 80.00, 1.10, 100),
  ('Platino', 'Conductores destacados', 'platinum', true, 500, 4.70, 5.00, 90.00, 1.25, 250),
  ('Diamante', 'Elite de conductores', 'diamond', true, 1000, 4.90, 2.00, 95.00, 1.50, 500)
ON CONFLICT DO NOTHING;

-- =====================================================
-- DONE! New admin pages tables are ready.
-- =====================================================

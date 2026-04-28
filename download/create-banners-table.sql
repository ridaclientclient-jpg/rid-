-- ═══════════════════════════════════════════════════════════════
-- BANNERS TABLE — Tabla de banners promocionales para las apps
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.banners (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  description   TEXT,
  image_url     TEXT NOT NULL,
  link_url      TEXT,
  position      INTEGER DEFAULT 0,
  target        TEXT NOT NULL DEFAULT 'app' CHECK (target IN ('app', 'driver', 'courier', 'all')),
  is_active     BOOLEAN DEFAULT true,
  start_date    TIMESTAMPTZ,
  end_date      TIMESTAMPTZ,
  clicks        INTEGER DEFAULT 0,
  impressions   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Enable
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone authenticated can read active banners
CREATE POLICY "banners_select" ON public.banners
  FOR SELECT USING (auth.role() = 'authenticated');

-- RLS: Only admins can insert/update/delete
CREATE POLICY "banners_insert" ON public.banners
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "banners_update" ON public.banners
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "banners_delete" ON public.banners
  FOR DELETE USING (public.is_admin());

-- Index for querying active banners efficiently
CREATE INDEX IF NOT EXISTS idx_banners_active_target
  ON public.banners (is_active, target, position);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS banners_updated_at ON public.banners;
CREATE TRIGGER banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

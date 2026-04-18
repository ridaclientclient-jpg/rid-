-- =====================================================
-- MODULE 12: SECURITY AUDIT LOGS
-- Crea la tabla de logs de seguridad para auditoría
-- =====================================================

CREATE TABLE IF NOT EXISTS public.security_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'sos')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_action ON public.security_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON public.security_logs(severity);

-- Enable RLS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ BEGIN DROP POLICY IF EXISTS "Users can view own security logs" ON public.security_logs; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Admin can view all security logs" ON public.security_logs; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "System can insert security logs" ON public.security_logs; END $$;

-- Policies
CREATE POLICY "Users can view own security logs" ON public.security_logs FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "Admin can view all security logs" ON public.security_logs FOR SELECT USING (
  public.is_admin()
);
CREATE POLICY "System can insert security logs" ON public.security_logs FOR INSERT WITH CHECK (true);

-- =====================================================
-- Helper function to log security events
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action TEXT,
  p_details JSONB DEFAULT '{}',
  p_severity TEXT DEFAULT 'info'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.security_logs (user_id, action, details, severity, ip_address, user_agent)
  VALUES (
    auth.uid(),
    p_action,
    p_details,
    p_severity,
    current_setting('request.headers.x-forwarded-for', true),
    current_setting('request.headers.user-agent', true)
  );
END;
$$;

-- =====================================================
-- DONE — Security logs table ready
-- =====================================================

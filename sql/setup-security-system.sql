-- Setup Security System
-- Includes account lockout columns for profiles and security_logs table

-- 1. Update profiles table with security columns
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS login_attempts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS login_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Create security_logs table
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'login_success', 'login_failed', 'account_locked', 'account_unlocked', 'suspicious_activity', 'password_change', 'profile_update'
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS on security_logs
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for security_logs
-- Admins can read all logs
CREATE POLICY "Admins can read all security logs"
ON public.security_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Users can read their own logs
CREATE POLICY "Users can read own security logs"
ON public.security_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- System can insert logs (via service role or defined functions)
-- For now, allow authenticated users to insert their own logs (the app handles this)
CREATE POLICY "Users can insert own security logs"
ON public.security_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at);

-- 6. Helper for Anti-Fraud Dashboard (if not exists)
-- This facilitates the queries in the Anti-Fraud page
CREATE OR REPLACE FUNCTION get_security_summary(p_user_id UUID)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_build_object(
            'total_logs', count(*),
            'last_login_at', max(created_at) FILTER (WHERE event_type = 'login_success'),
            'failed_attempts_last_hour', count(*) FILTER (WHERE event_type = 'login_failed' AND created_at > now() - interval '1 hour'),
            'is_locked', EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND (locked_until > now() OR is_active = false))
        )
        FROM public.security_logs
        WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Helper to check if a user is blocked (used by AuthGuard)
CREATE OR REPLACE FUNCTION check_user_blocked(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
BEGIN
    SELECT is_active, locked_until INTO v_profile FROM public.profiles WHERE id = p_user_id;
    
    IF v_profile IS NULL THEN
        RETURN jsonb_build_object('blocked', false);
    END IF;

    IF v_profile.is_active = false THEN
        RETURN jsonb_build_object('blocked', true, 'reason', 'Tu cuenta ha sido desactivada o bloqueada permanentemente.');
    END IF;

    IF v_profile.locked_until IS NOT NULL AND v_profile.locked_until > now() THEN
        RETURN jsonb_build_object('blocked', true, 'reason', 'Cuenta bloqueada temporalmente por seguridad.');
    END IF;

    RETURN jsonb_build_object('blocked', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface SecurityLog {
  id: string;
  user_id: string;
  event_type: 'login_success' | 'login_failed' | 'account_locked' | 'account_unlocked' | 'suspicious_activity' | 'password_change' | 'profile_update';
  ip_address?: string;
  user_agent?: string;
  details?: string;
  created_at: string;
}

interface SecurityState {
  isChecking: boolean;
  securityLogs: SecurityLog[];
  fraudAlerts: number;

  /** Enforce DB-level lockout: sync authStore state with DB */
  checkAccountLock: (email: string) => Promise<{ locked: boolean; lockedUntil: string | null; attempts: number; userId: string | null }>;
  /** Record failed login attempt in DB */
  recordFailedAttempt: (userId: string, ipAddress?: string, userAgent?: string) => Promise<void>;
  /** Record successful login */
  recordSuccessLogin: (userId: string, ipAddress?: string, userAgent?: string) => Promise<void>;
  /** Lock account via DB */
  lockAccount: (userId: string, reason?: string) => Promise<void>;
  /** Admin: unlock a user account */
  unlockAccount: (userId: string) => Promise<{ success: boolean; error?: string }>;
  /** Admin: fetch security logs for a user */
  fetchSecurityLogs: (userId: string) => Promise<SecurityLog[]>;
  /** Admin: fetch all fraud alerts */
  fetchFraudAlerts: () => Promise<void>;
  /** Check for suspicious activity patterns */
  checkSuspiciousActivity: (userId: string) => Promise<boolean>;
}

export const useSecurityStore = create<SecurityState>((set) => ({
  isChecking: false,
  securityLogs: [],
  fraudAlerts: 0,

  checkAccountLock: async (email: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, login_attempts, locked_until, is_active')
        .eq('email', email)
        .single();

      if (!profile) return { locked: false, lockedUntil: null, attempts: 0, userId: null };

      const isLocked = profile.locked_until && new Date(profile.locked_until) > new Date();
      const isActuallyLocked = !!isLocked || profile.is_active === false;

      return {
        locked: isActuallyLocked,
        lockedUntil: profile.locked_until,
        attempts: profile.login_attempts || 0,
        userId: profile.id,
      };
    } catch {
      return { locked: false, lockedUntil: null, attempts: 0, userId: null };
    }
  },

  recordFailedAttempt: async (userId: string, ipAddress?: string, userAgent?: string) => {
    try {
      // 1. Increment login_attempts in DB
      const { data: profile } = await supabase
        .from('profiles')
        .select('login_attempts')
        .eq('id', userId)
        .single();

      const attempts = (profile?.login_attempts || 0) + 1;

      // 2. Fetch max attempts and duration from settings (with defaults)
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['max_login_attempts', 'lockout_duration_minutes']);
      
      const maxAttempts = Number(settings?.find(s => s.key === 'max_login_attempts')?.value) || 5;
      const lockoutMinutes = Number(settings?.find(s => s.key === 'lockout_duration_minutes')?.value) || 15;

      const shouldLock = attempts >= maxAttempts;
      const lockedUntil = shouldLock ? new Date(Date.now() + lockoutMinutes * 60 * 1000).toISOString() : null;

      // 3. Update profile
      const updateData: any = { login_attempts: attempts };
      if (shouldLock) {
        updateData.locked_until = lockedUntil;
        // Optional: you might not want to set is_active=false for a temporary lockout
        // but the current logic does it. I'll keep it but maybe we should only use locked_until.
        // updateData.is_active = false; 
      }

      await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      // 4. Log the security event
      await supabase.from('security_logs').insert({
        user_id: userId,
        event_type: shouldLock ? 'account_locked' : 'login_failed',
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        details: shouldLock 
          ? `Cuenta bloqueada temporalmente tras ${attempts} intentos fallidos` 
          : `Intento fallido #${attempts}`,
      });
    } catch (err: any) {
      console.error('[Security] Record failed attempt error:', err?.message);
    }
  },

  recordSuccessLogin: async (userId: string, ipAddress?: string, userAgent?: string) => {
    try {
      // 1. Get current profile to increment count
      const { data: profile } = await supabase
        .from('profiles')
        .select('login_count')
        .eq('id', userId)
        .single();

      // 2. Reset login attempts and update last login
      await supabase
        .from('profiles')
        .update({
          login_attempts: 0,
          locked_until: null,
          is_active: true,
          last_login_at: new Date().toISOString(),
          login_count: (profile?.login_count || 0) + 1,
        })
        .eq('id', userId);

      // 3. Log success
      await supabase.from('security_logs').insert({
        user_id: userId,
        event_type: 'login_success',
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        details: 'Inicio de sesión exitoso',
      });
    } catch (err: any) {
      console.error('[Security] Record success login error:', err?.message);
    }
  },

  lockAccount: async (userId: string, reason?: string) => {
    try {
      await supabase
        .from('profiles')
        .update({
          is_active: false,
          locked_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h lock
          login_attempts: 99,
        })
        .eq('id', userId);

      await supabase.from('security_logs').insert({
        user_id: userId,
        event_type: 'account_locked',
        details: reason || 'Cuenta bloqueada por actividad sospechosa',
      });
    } catch (err: any) {
      console.error('[Security] Lock account error:', err?.message);
    }
  },

  unlockAccount: async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          login_attempts: 0,
          locked_until: null,
          is_active: true,
        })
        .eq('id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      await supabase.from('security_logs').insert({
        user_id: userId,
        event_type: 'account_unlocked',
        details: 'Cuenta desbloqueada por administrador',
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al desbloquear' };
    }
  },

  fetchSecurityLogs: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('security_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        set({ securityLogs: data as SecurityLog[] });
        return data as SecurityLog[];
      }
      return [];
    } catch {
      return [];
    }
  },

  fetchFraudAlerts: async () => {
    try {
      const { data } = await supabase
        .from('security_logs')
        .select('*')
        .eq('event_type', 'suspicious_activity')
        .order('created_at', { ascending: false })
        .limit(20);

      set({ fraudAlerts: data?.length || 0 });
    } catch {
      // Ignore
    }
  },

  checkSuspiciousActivity: async (userId: string) => {
    try {
      // Check for rapid failed logins in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('security_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'login_failed')
        .gte('created_at', oneHourAgo);

      // More than 10 failed attempts in 1 hour = suspicious
      if (data && data.length >= 10) {
        await supabase.from('security_logs').insert({
          user_id: userId,
          event_type: 'suspicious_activity',
          details: `${data.length} intentos fallidos en la ultima hora`,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));

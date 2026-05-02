import { create } from 'zustand';
import { supabase, type Profile } from '@/lib/supabase';
import type { User as SupaUser, Session } from '@supabase/supabase-js';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'driver' | 'admin' | 'vendor' | 'courier';
  avatar?: string;
  isVerified?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  supaUser: SupaUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAttempts: number;
  isLocked: boolean;
  lockedUntil: Date | null;

  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, phone: string, password: string, role: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
}

function profileToUser(profile: Profile): AuthUser {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
    avatar: profile.avatar,
    isVerified: profile.is_verified,
  };
}

// Shared promise to deduplicate concurrent initAuth() calls
// Prevents Supabase auth lock contention (5000ms warning)
let _initAuthPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  supaUser: null,
  session: null,
  isAuthenticated: false,
  isLoading: false,
  loginAttempts: 0,
  isLocked: false,
  lockedUntil: null,

  initAuth: async () => {
    // If initAuth is already running, return the same promise (prevents lock contention)
    if (_initAuthPromise) return _initAuthPromise;

    _initAuthPromise = (async () => {
      // Always fetch current session and profile
      const alreadyAuthed = get().isAuthenticated;
      if (!alreadyAuthed) {
        set({ isLoading: true });
      }

      try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const sessionUser = session.user;
        let profile = null;

        try {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionUser.id)
            .single();

          if (existingProfile) {
            profile = existingProfile;
          } else {
            // Auto-create profile if missing
            const meta = sessionUser.user_metadata || {};
            const newProfile = {
              id: sessionUser.id,
              name: meta.name || sessionUser.email?.split('@')[0] || 'Usuario',
              email: sessionUser.email || '',
              phone: meta.phone || '',
              role: meta.role || 'client',
              is_verified: sessionUser.email_confirmed_at ? true : false,
            };
            const { data: createdProfile } = await supabase
              .from('profiles')
              .upsert(newProfile, { onConflict: 'id' })
              .select()
              .single();
            profile = createdProfile;
          }
        } catch (profileErr) {
          console.warn('Profile fetch failed, using session metadata:', profileErr);
        }

        if (profile) {
          set({
            user: profileToUser(profile),
            supaUser: sessionUser,
            session,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          // Session is valid but profile not available — create fallback user from metadata
          // This prevents the user from being logged out when the profiles table has issues
          const meta = sessionUser.user_metadata || {};
          const fallbackUser: AuthUser = {
            id: sessionUser.id,
            name: meta.name || sessionUser.email?.split('@')[0] || 'Usuario',
            email: sessionUser.email || '',
            phone: meta.phone || '',
            role: (meta.role || 'client') as AuthUser['role'],
            isVerified: sessionUser.email_confirmed_at ? true : false,
          };
          console.warn('Using fallback user from session metadata:', fallbackUser.email, 'role:', fallbackUser.role);
          set({
            user: fallbackUser,
            supaUser: sessionUser,
            session,
            isAuthenticated: true,
            isLoading: false,
          });
        }
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Auth init error:', error);
      set({ isLoading: false });
    }

    // Only set up the auth state change listener ONCE
    if ((get() as any)._authListenerSetup) return;
    (get() as any)._authListenerSetup = true;

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
        const sessionUser = session.user;
        let profile = null;

        try {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionUser.id)
            .single();

          if (existingProfile) {
            profile = existingProfile;
          } else {
            // Auto-create profile if missing
            const meta = sessionUser.user_metadata || {};
            const newProfile = {
              id: sessionUser.id,
              name: meta.name || sessionUser.email?.split('@')[0] || 'Usuario',
              email: sessionUser.email || '',
              phone: meta.phone || '',
              role: meta.role || 'client',
              is_verified: sessionUser.email_confirmed_at ? true : false,
            };
            const { data: createdProfile } = await supabase
              .from('profiles')
              .upsert(newProfile, { onConflict: 'id' })
              .select()
              .single();
            profile = createdProfile;
          }
        } catch (profileErr) {
          console.warn('Profile fetch in onAuthStateChange failed:', profileErr);
        }

        if (profile) {
          set({
            user: profileToUser(profile),
            supaUser: sessionUser,
            session,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          // Fallback: use session metadata
          const meta = sessionUser.user_metadata || {};
          const fallbackUser: AuthUser = {
            id: sessionUser.id,
            name: meta.name || sessionUser.email?.split('@')[0] || 'Usuario',
            email: sessionUser.email || '',
            phone: meta.phone || '',
            role: (meta.role || 'client') as AuthUser['role'],
            isVerified: sessionUser.email_confirmed_at ? true : false,
          };
          set({
            user: fallbackUser,
            supaUser: sessionUser,
            session,
            isAuthenticated: true,
            isLoading: false,
          });
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Update session when token is refreshed to prevent premature logout
        set({
          supaUser: session.user,
          session,
          isAuthenticated: true,
        });
      } else if (event === 'SIGNED_OUT') {
        // Skip if logout was already handled manually (prevents double state change)
        if ((get() as any)._isLoggingOut) return;
        // Try to recover session before clearing state — sometimes SIGNED_OUT fires
        // spuriously during token refresh on mobile browsers
        if (get().isAuthenticated) {
          console.warn('[AuthStore] SIGNED_OUT received while authenticated, attempting session recovery...');
          supabase.auth.getSession().then(({ data: { session: recoveredSession } }) => {
            if (recoveredSession) {
              console.log('[AuthStore] Session recovered after SIGNED_OUT event');
              set({ supaUser: recoveredSession.user, session: recoveredSession, isAuthenticated: true });
            } else {
              // Session truly gone — clear state
              set({ user: null, supaUser: null, session: null, isAuthenticated: false, isLoading: false });
            }
          }).catch(() => {
            set({ user: null, supaUser: null, session: null, isAuthenticated: false, isLoading: false });
          });
        } else {
          set({ user: null, supaUser: null, session: null, isAuthenticated: false, isLoading: false });
        }
      }
    });
    })()
    .finally(() => { _initAuthPromise = null; });
  },

  login: async (email: string, password: string) => {
    const state = get();
    if (state.isLocked) {
      const now = new Date();
      if (state.lockedUntil && now < state.lockedUntil) {
        return { success: false, error: `Cuenta bloqueada. Intenta en ${Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 60000)} minutos.` };
      }
      set({ isLocked: false, lockedUntil: null, loginAttempts: 0 });
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const newAttempts = state.loginAttempts + 1;
        if (newAttempts >= 5) {
          set({
            loginAttempts: newAttempts,
            isLocked: true,
            lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
            isLoading: false,
          });
          // Log blocked attempt
          supabase.from('login_logs').insert({
            email,
            method: 'email',
            status: 'blocked',
          }).then(() => {}).catch(() => {});
          return { success: false, error: 'Cuenta bloqueada por 15 minutos. Demasiados intentos.' };
        }
        set({ loginAttempts: newAttempts, isLoading: false });
        // Log failed attempt
        supabase.from('login_logs').insert({
          email,
          method: 'email',
          status: 'failed',
        }).then(() => {}).catch(() => {});
        return { success: false, error: error.message === 'Invalid login credentials'
          ? `Credenciales incorrectas. Intentos restantes: ${5 - newAttempts}`
          : error.message
        };
      }

      if (data.session?.user) {
        const sessionUser = data.session.user;
        let profile = null;

        // Try to fetch existing profile
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .single();

        if (existingProfile) {
          profile = existingProfile;
        } else {
          // Profile doesn't exist yet — create it (upsert)
          const meta = sessionUser.user_metadata || {};
          const newProfile = {
            id: sessionUser.id,
            name: meta.name || sessionUser.email?.split('@')[0] || 'Usuario',
            email: sessionUser.email || '',
            phone: meta.phone || '',
            role: meta.role || 'client',
            is_verified: sessionUser.email_confirmed_at ? true : false,
          };
          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .upsert(newProfile, { onConflict: 'id' })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError.message, createError.details);
            set({ isLoading: false });
            return { success: false, error: 'Error al crear perfil: ' + createError.message };
          }
          profile = createdProfile;
        }

        if (profile) {
          set({
            user: profileToUser(profile),
            supaUser: sessionUser,
            session: data.session,
            isAuthenticated: true,
            isLoading: false,
            loginAttempts: 0,
          });
          // Update last_login_at and login_count
          supabase.from('profiles').update({
            last_login_at: new Date().toISOString(),
            login_count: (profile.login_count || 0) + 1,
          }).eq('id', sessionUser.id).then(() => {}).catch(() => {});
          // Log successful login
          supabase.from('login_logs').insert({
            user_id: sessionUser.id,
            email,
            method: 'email',
            status: 'success',
          }).then(() => {}).catch(() => {});
          return { success: true };
        }
      }

      set({ isLoading: false });
      return { success: false, error: 'Error al obtener perfil' };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: 'Error de conexion' };
    }
  },

  register: async (name: string, email: string, phone: string, password: string, role: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
            role,
          },
        },
      });

      if (error) {
        set({ isLoading: false });
        return { success: false, error: error.message };
      }

      if (data.user) {
        set({
          user: {
            id: data.user.id,
            name,
            email,
            phone,
            role: role as AuthUser['role'],
            isVerified: false,
          },
          supaUser: data.user,
          session: data.session,
          isAuthenticated: !!data.session,
          isLoading: false,
        });
        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: 'Error al crear cuenta' };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: 'Error de conexion' };
    }
  },

  logout: async () => {
    (get() as any)._isLoggingOut = true;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out from Supabase:', err);
    }
    // Always clear state, even if signOut fails
    set({
      user: null,
      supaUser: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      loginAttempts: 0,
    });
    // Clear flag after a short delay so onAuthStateChange doesn't fire a second redirect
    setTimeout(() => { (get() as any)._isLoggingOut = false; }, 500);
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  updateProfile: async (updates: Partial<AuthUser>) => {
    const state = get();
    if (!state.user) return;

    const updatesDB: Record<string, unknown> = {};
    if (updates.name) updatesDB.name = updates.name;
    if (updates.phone) updatesDB.phone = updates.phone;
    if (updates.avatar) updatesDB.avatar = updates.avatar;

    const { error } = await supabase
      .from('profiles')
      .update(updatesDB)
      .eq('id', state.user.id);

    if (!error) {
      set({ user: { ...state.user, ...updates } });
    }
  },
}));

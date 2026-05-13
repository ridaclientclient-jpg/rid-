import { create } from 'zustand';
import { supabase, type Profile } from '@/lib/supabase';
import type { User as SupaUser, Session } from '@supabase/supabase-js';
import { useSecurityStore } from './securityStore';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'driver' | 'admin' | 'vendor' | 'courier' | 'super_admin';
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
  register: (name: string, email: string, phone: string, password: string, role: string, extraData?: any) => Promise<{ success: boolean; error?: string }>;
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
    // If initAuth is already running or user is already fully authenticated, skip redundant work
    if (_initAuthPromise) return _initAuthPromise;
    const currentState = get();
    if (currentState.isAuthenticated && currentState.user && currentState.session) {
      return;
    }

    _initAuthPromise = (async () => {
      // Avoid flickering loading screen if we think we might be authenticated
      const maybeAuthed = typeof window !== 'undefined' && !!window.localStorage.getItem('sb-rida-auth-token');
      if (!get().isAuthenticated && !maybeAuthed) {
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
      if (isInvalidRefreshTokenError(error)) {
        console.warn('[AuthStore] Invalid refresh token detected, clearing local auth session');
        try {
          await supabase.auth.signOut();
        } catch (signOutErr) {
          console.warn('[AuthStore] Failed to sign out during refresh token cleanup:', signOutErr);
        }
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('rida-auth-token');
        }
        set({ user: null, supaUser: null, session: null, isAuthenticated: false, isLoading: false });
      } else {
        set({ isLoading: false });
      }
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
    const security = useSecurityStore.getState();
    
    // 1. Check DB-level lockout first
    const lockStatus = await security.checkAccountLock(email);
    
    if (lockStatus.locked) {
      const now = new Date();
      const lockedUntil = lockStatus.lockedUntil ? new Date(lockStatus.lockedUntil) : null;
      
      if (lockedUntil && now < lockedUntil) {
        const diff = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);
        set({ isLocked: true, lockedUntil });
        return { 
          success: false, 
          error: `Cuenta bloqueada temporalmente. Intenta en ${diff} minutos.` 
        };
      }
      
      // If it was locked but time expired, we can proceed, but checkAccountLock should have reset it if it was just a timer.
      // However, if is_active is false, it stays locked.
      if (lockStatus.userId) {
        // If still locked (e.g. is_active is false), return error
        set({ isLocked: true });
        return { success: false, error: 'Esta cuenta ha sido desactivada o bloqueada permanentemente.' };
      }
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        // 2. Record failed attempt in DB if user exists
        if (lockStatus.userId) {
          await security.recordFailedAttempt(lockStatus.userId);
          // Re-fetch lock status to update local state
          const newLock = await security.checkAccountLock(email);
          set({ 
            isLocked: newLock.locked, 
            lockedUntil: newLock.lockedUntil ? new Date(newLock.lockedUntil) : null,
            loginAttempts: newLock.attempts 
          });
          
          if (newLock.locked) {
            set({ isLoading: false });
            return { success: false, error: 'Demasiados intentos fallidos. Cuenta bloqueada.' };
          }
          
          set({ isLoading: false });
          return { 
            success: false, 
            error: `Credenciales incorrectas. Intentos restantes: ${5 - newLock.attempts}` 
          };
        }

        set({ isLoading: false });
        return { success: false, error: 'Credenciales incorrectas' };
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
            isLocked: false,
            lockedUntil: null
          });
          
          // 3. Record success in security system
          await security.recordSuccessLogin(sessionUser.id);
          
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

  register: async (name: string, email: string, phone: string, password: string, role: string, extraData?: any) => {
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
        // If role is driver, courier, both or vendor, we need to create extra records
        if (role === 'driver' || role === 'courier' || role === 'ambos' || role === 'conductor' || role === 'repartidor' || role === 'vendor') {
          const isDriver = role === 'driver' || role === 'ambos' || role === 'conductor';
          const isCourier = role === 'courier' || role === 'ambos' || role === 'repartidor';
          const isVendor = role === 'vendor';

          // 1. Create Profile
          await supabase.from('profiles').upsert({
            id: data.user.id,
            name,
            email,
            phone,
            role: isVendor ? 'vendor' : (isDriver ? 'driver' : 'courier'),
            is_verified: false
          });

          let driverRecordId = null;

          // 2. Create Driver record if applicable
          if (isDriver) {
            const { data: driverRecord, error: driverError } = await supabase
              .from('drivers')
              .insert({
                user_id: data.user.id,
                status: 'offline',
                rating: 5.0,
                total_rides: 0,
                total_earnings: 0
              })
              .select()
              .single();

            if (driverError) console.error('Error creating driver record:', driverError);
            if (driverRecord) driverRecordId = driverRecord.id;
          }

          // 3. Create Courier record if applicable
          if (isCourier) {
            const { error: courierError } = await supabase
              .from('couriers')
              .insert({
                user_id: data.user.id,
                status: 'offline',
                vehicle_type: extraData?.vehicleType || 'moto',
                rating: 5.0,
                total_deliveries: 0,
                total_earnings: 0
              });

            if (courierError) console.error('Error creating courier record:', courierError);
          }

          // 4. Create Vendor record if applicable
          if (isVendor) {
            const { data: vendorRecord, error: vendorError } = await supabase
              .from('vendors')
              .insert({
                user_id: data.user.id,
                store_name: name,
                category: 'other', // Default
                is_approved: false,
                rating: 5.0
              })
              .select()
              .single();

            if (vendorError) {
              console.error('Error creating vendor record:', vendorError);
            } else if (vendorRecord) {
              // Create vendor wallet
              await supabase.from('vendor_wallets').insert({
                vendor_id: vendorRecord.id,
                balance: 0,
                total_earned: 0
              });
            }
          }

          // 5. Create Vehicle record if driver record exists and plate is provided
          if (driverRecordId && extraData?.plate) {
            const { error: vehicleError } = await supabase
              .from('vehicles')
              .insert({
                driver_id: driverRecordId,
                plate: extraData.plate,
                model: extraData.model || '',
                color: extraData.color || '',
                verified: false
              });
            
            if (vehicleError) console.error('Error creating vehicle record:', vehicleError);
          }
        }

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
    
    // Clear any persistent storage that might cause hydration issues
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('rida-auth-token');
      // Force redirect to login/home page and reload to clear all state/cache
      window.location.href = '/';
    }

    // Clear flag after a short delay
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

import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'driver' | 'admin' | 'vendor';
  avatar?: string;
  isVerified?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAttempts: number;
  isLocked: boolean;
  lockedUntil: Date | null;
  
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, phone: string, password: string, role: string) => Promise<boolean>;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  resetLoginAttempts: () => void;
}

// Demo users for preview
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  'cliente@rida.com': { password: '123456', user: { id: '1', name: 'Maria Rodriguez', email: 'cliente@rida.com', phone: '+506 8888 0001', role: 'client', isVerified: true } },
  'conductor@rida.com': { password: '123456', user: { id: '2', name: 'Carlos Mendez', email: 'conductor@rida.com', phone: '+506 8888 0002', role: 'driver', isVerified: true } },
  'admin@rida.com': { password: 'admin123', user: { id: '3', name: 'Admin RIDA', email: 'admin@rida.com', phone: '+506 8888 0000', role: 'admin', isVerified: true } },
  'vendedor@rida.com': { password: '123456', user: { id: '4', name: 'Farmacia Central', email: 'vendedor@rida.com', phone: '+506 8888 0003', role: 'vendor', isVerified: true } },
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  loginAttempts: 0,
  isLocked: false,
  lockedUntil: null,

  login: async (email: string, password: string) => {
    const state = get();
    if (state.isLocked) {
      const now = new Date();
      if (state.lockedUntil && now < state.lockedUntil) {
        return false;
      }
      set({ isLocked: false, lockedUntil: null, loginAttempts: 0 });
    }

    set({ isLoading: true });
    await new Promise(resolve => setTimeout(resolve, 800));

    const demoUser = DEMO_USERS[email.toLowerCase()];
    if (demoUser && demoUser.password === password) {
      set({ user: demoUser.user, isAuthenticated: true, isLoading: false, loginAttempts: 0 });
      if (typeof window !== 'undefined') {
        localStorage.setItem('rida_user', JSON.stringify(demoUser.user));
        localStorage.setItem('rida_session', 'active');
      }
      return true;
    }

    const newAttempts = state.loginAttempts + 1;
    if (newAttempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      set({ loginAttempts: newAttempts, isLocked: true, lockedUntil: lockUntil, isLoading: false });
    } else {
      set({ loginAttempts: newAttempts, isLoading: false });
    }
    return false;
  },

  register: async (name: string, email: string, phone: string, password: string, role: string) => {
    set({ isLoading: true });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      phone,
      role: role as User['role'],
      isVerified: false,
    };
    
    set({ user: newUser, isAuthenticated: true, isLoading: false });
    if (typeof window !== 'undefined') {
      localStorage.setItem('rida_user', JSON.stringify(newUser));
      localStorage.setItem('rida_session', 'active');
    }
    return true;
  },

  logout: () => {
    set({ user: null, isAuthenticated: false, loginAttempts: 0 });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rida_user');
      localStorage.removeItem('rida_session');
    }
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
  resetLoginAttempts: () => set({ loginAttempts: 0, isLocked: false, lockedUntil: null }),
}));

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Ban } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: string;
  authPage?: string;
}

export default function AuthGuard({ children, requiredRole, authPage }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, initAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');

  useEffect(() => {
    let cancelled = false;

    // Optimización: Si ya estamos autenticados, saltamos la pantalla de carga inmediatamente
    if (isAuthenticated) {
      setChecked(true);
    }

    // Safety timeout: force show content after 8s even if initAuth hangs
    const safetyTimeout = setTimeout(() => {
      if (!cancelled) {
        setChecked(true);
        if (!isAuthenticated) {
          setAuthError('Tiempo de espera agotado. Recarga la pagina.');
        }
      }
    }, 8000);

    initAuth()
      .then(() => { if (!cancelled) setChecked(true); })
      .catch((err) => {
        if (!cancelled) {
          setChecked(true);
          if (!isAuthenticated) {
            setAuthError('Error de conexion. Verifica tu internet.');
          }
          console.error('[AuthGuard] initAuth failed:', err);
        }
      });

    return () => { cancelled = true; clearTimeout(safetyTimeout); };
  }, [initAuth, isAuthenticated]);

  // Check if user is blocked (after auth is verified)
  useEffect(() => {
    if (!checked || !isAuthenticated || !user?.id) return;

    const checkBlocked = async () => {
      try {
        const { data } = await supabase.rpc('check_user_blocked', { p_user_id: user.id });
        if (data?.blocked) {
          setIsBlocked(true);
          setBlockedReason(data.reason || 'Tu cuenta ha sido bloqueada');
          // Force logout after showing message
          setTimeout(async () => {
            await useAuthStore.getState().logout();
            if (authPage) router.replace(authPage);
          }, 3000);
        }
      } catch {
        // If RPC doesn't exist yet, skip
      }
    };

    checkBlocked();
  }, [checked, isAuthenticated, user?.id, authPage, router]);

  // Track if user was ever authenticated to prevent premature redirect on brief auth loss
  const wasAuthenticatedRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated) wasAuthenticatedRef.current = true;
  }, [isAuthenticated]);

  // Redirect unauthenticated users to login — with session recovery attempt
  const redirectAttemptedRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);
  useEffect(() => {
    if (!checked || isBlocked) return;
    if (redirectAttemptedRef.current) return;

    if (!isAuthenticated && authPage) {
      if (pathname === authPage) return;

      // If user was previously authenticated, try to recover session before redirecting
      if (wasAuthenticatedRef.current && !recoveryAttemptedRef.current) {
        recoveryAttemptedRef.current = true;
        console.log('[AuthGuard] Session lost, attempting recovery...');
        initAuth().then(() => {
          // If initAuth recovered the session, isAuthenticated will be true → no redirect
          if (!useAuthStore.getState().isAuthenticated) {
            // Recovery failed — redirect now
            redirectAttemptedRef.current = true;
            router.replace(authPage);
          }
        }).catch(() => {
          redirectAttemptedRef.current = true;
          router.replace(authPage);
        });
        return;
      }

      redirectAttemptedRef.current = true;
      router.replace(authPage);
    }
  }, [checked, isAuthenticated, isBlocked, router, authPage, pathname, initAuth]);

  // Show blocked screen
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-rida-dark flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <Ban className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-lg text-red-400 font-semibold">Cuenta Bloqueada</p>
          <p className="text-sm text-gray-400 mt-2">{blockedReason}</p>
          <p className="text-xs text-gray-600 mt-1">Seras redirigido al inicio de sesion...</p>
        </div>
      </div>
    );
  }

  // Show loading spinner only while checking auth
  if (!checked) {
    return (
      <div className="min-h-screen bg-rida-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (requiredRole && user && user.role !== requiredRole && user.role !== 'admin' && user.role !== 'super_admin') {
    const handleForceLogout = async () => {
      await useAuthStore.getState().logout();
      if (authPage) {
        router.replace(authPage);
      } else {
        router.replace('/');
      }
    };

    return (
      <div className="min-h-screen bg-rida-dark flex items-center justify-center">
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-lg text-red-400 font-semibold">Acceso denegado</p>
          <p className="text-sm text-gray-400 mt-2">No tienes permisos para esta seccion</p>
          <p className="text-xs text-gray-600 mt-1">Tu rol actual: <span className="text-yellow-400">{user.role}</span> | Requerido: <span className="text-cyan-400">{requiredRole}</span></p>
          <div className="flex flex-col gap-2 mt-5">
            <button
              onClick={handleForceLogout}
              className="px-5 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-sm font-medium hover:bg-cyan-500/25 transition-all"
            >
              Cerrar sesion e intentar de nuevo
            </button>
            {authPage && (
              <button
                onClick={() => router.push(authPage)}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Ir a login
              </button>
            )}
            <button onClick={() => router.push('/')} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <ErrorBoundary>{children}</ErrorBoundary>;
}

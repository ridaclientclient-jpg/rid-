'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

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

  useEffect(() => {
    // Safety timeout: force show content after 8s even if initAuth hangs
    const safetyTimeout = setTimeout(() => {
      setChecked(true);
    }, 8000);

    initAuth()
      .then(() => setChecked(true))
      .catch(() => setChecked(true));

    return () => clearTimeout(safetyTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect unauthenticated users to login (only once)
  const redirectAttemptedRef = useRef(false);
  useEffect(() => {
    if (!checked) return;
    if (redirectAttemptedRef.current) return;

    if (!isAuthenticated && authPage) {
      if (pathname === authPage) return;
      redirectAttemptedRef.current = true;
      router.replace(authPage);
    }
  }, [checked, isAuthenticated, router, authPage, pathname]);

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

  if (requiredRole && user && user.role !== requiredRole && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-rida-dark flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-400 font-semibold">Acceso denegado</p>
          <p className="text-sm text-gray-400 mt-2">No tienes permisos para esta seccion</p>
          <div className="mt-4 space-y-2">
            <button
              onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/admin/login'; }}
              className="block w-full px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors"
            >
              Limpiar sesion y reintentar
            </button>
            <button onClick={() => router.push('/')} className="block w-full text-gray-400 hover:underline text-sm">
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

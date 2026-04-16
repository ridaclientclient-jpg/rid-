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
  const { user, isAuthenticated, isLoading, initAuth } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    initAuth().finally(() => setChecked(true));
  }, [initAuth]);

  useEffect(() => {
    if (!checked || isLoading) return;
    if (isNavigatingRef.current) return;

    if (!isAuthenticated && authPage) {
      // Don't redirect if already on the auth page
      if (pathname === authPage) return;
      isNavigatingRef.current = true;
      router.replace(authPage);
    }
  }, [checked, isLoading, isAuthenticated, router, authPage, pathname]);

  if (isLoading || !checked) {
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
          <button onClick={() => router.push('/')} className="mt-4 text-cyan-400 hover:underline text-sm">Volver al inicio</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Car, Wallet, User as UserIcon, Zap, ArrowLeft, LogOut, Bell } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { toast } from 'sonner';

const navItems = [
  { icon: Home, label: 'Inicio', href: '/driver' },
  { icon: Car, label: 'Viajes', href: '/driver/rides' },
  { icon: Wallet, label: 'Ganancias', href: '/driver/earnings' },
  { icon: UserIcon, label: 'Perfil', href: '/driver/profile' },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const isAuthPage = pathname?.includes('/driver/login') || pathname?.includes('/driver/register') || pathname?.includes('/driver/recovery');

  useEffect(() => {
    if (!isAuthPage && !isAuthenticated) {
      router.replace('/driver/login');
    }
  }, [isAuthPage, isAuthenticated, router, pathname]);

  if (!isAuthPage && !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-rida-dark flex flex-col max-w-md mx-auto relative">
      {!isAuthPage && isAuthenticated && (
        <>
          {/* Top Bar */}
          <header className="sticky top-0 z-50 glass-strong border-b border-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
              {pathname !== '/driver' ? (
                <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-white">RIDA CONDUCTOR</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => toast.info('No tienes notificaciones nuevas')} className="relative p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <Bell className="w-5 h-5 text-gray-400" />
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400" />
                </button>
                <button onClick={() => { logout(); router.push('/driver/login'); }} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <LogOut className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 pb-20 overflow-y-auto">
            <AnimatePresence mode="wait">
              {children}
            </AnimatePresence>
          </main>

          {/* Bottom Navigation */}
          <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md glass-strong border-t border-white/10 z-50">
            <div className="flex items-center justify-around py-2 px-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className={`relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all ${
                      isActive ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="driver-nav-active"
                        className="absolute inset-0 bg-cyan-500/10 rounded-xl"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <item.icon className="w-5 h-5 relative z-10" />
                    <span className="text-[10px] font-medium relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </>
      )}
      {(isAuthPage || !isAuthenticated) && children}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, LayoutDashboard, Package, Grid3X3, ShoppingCart,
  Upload, User, LogOut, Menu, X, ChevronRight, Zap
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import AuthGuard from '@/components/AuthGuard';
import { toast } from 'sonner';

const navItems = [
  { label: 'Dashboard', href: '/marketplace', icon: LayoutDashboard, exact: true },
  { label: 'Productos', href: '/marketplace/products', icon: Package },
  { label: 'Categorías', href: '/marketplace/categories', icon: Grid3X3 },
  { label: 'Pedidos', href: '/marketplace/orders', icon: ShoppingCart },
  { label: 'CSV Import', href: '/marketplace/import', icon: Upload },
  { label: 'Perfil', href: '/marketplace/profile', icon: User },
];

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPublicPage = pathname === '/marketplace/login' || pathname === '/marketplace/recovery';

  const handleLogout = async () => {
    toast.success('Sesión cerrada');
    await logout();
    router.replace('/marketplace/login');
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  if (isPublicPage) {
    return <>{children}</>;
  }

  return (
    <AuthGuard requiredRole="vendor" authPage="/marketplace/login">
    <div className="min-h-screen bg-[#050811] flex overflow-hidden">
      
      {/* ─── Premium Mobile Overlay ─── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Super-App Sidebar ─── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-[110] w-72 bg-[#0a0f1d] border-r border-white/5 flex flex-col transition-all duration-500 ease-in-out shadow-2xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo Section */}
        <div className="p-8 border-b border-white/5 relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.2rem] bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-[0_10px_20px_rgba(6,182,212,0.3)]">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tighter leading-none">RIDA <span className="text-cyan-400">MARKET</span></h1>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1.5">PRO VENDOR PANEL</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 rounded-xl bg-white/5 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-10 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <motion.button
                key={item.href}
                onClick={() => {
                  router.push(item.href);
                  setSidebarOpen(false);
                }}
                className={`w-full group relative flex items-center gap-4 px-5 py-4 rounded-[1.5rem] transition-all duration-500 overflow-hidden ${
                  active
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/5 text-white shadow-xl ring-1 ring-cyan-500/30'
                    : 'text-slate-500 hover:text-white hover:bg-white/[0.03]'
                }`}
                whileHover={{ x: 6 }}
                whileTap={{ scale: 0.98 }}
              >
                {active && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute left-0 w-1.5 h-6 bg-cyan-500 rounded-r-full shadow-[0_0_15px_rgba(6,182,212,0.8)]"
                  />
                )}
                <item.icon className={`w-6 h-6 transition-all duration-500 ${active ? 'text-cyan-400 scale-110 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'group-hover:text-cyan-300'}`} />
                <span className={`flex-1 text-left font-black tracking-tight text-base ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>{item.label}</span>
                {active && <ChevronRight className="w-4 h-4 text-cyan-500/50" />}
              </motion.button>
            );
          })}
        </nav>

        {/* Footer / User Profile */}
        <div className="p-6 border-t border-white/5 bg-[#0d1220]/50 backdrop-blur-xl">
          <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/[0.03] border border-white/5 mb-6 group hover:bg-white/[0.05] transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:scale-110 transition-transform">
              {user?.name?.charAt(0) || 'V'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white truncate tracking-tight">{user?.name || 'Vendedor Pro'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Online</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-slate-500 font-black text-sm hover:text-red-400 hover:bg-red-400/10 transition-all active:scale-95 group"
          >
            <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <span>CERRAR SESIÓN</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Content Wrapper ─── */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Premium Mobile Top Bar */}
        <header className="lg:hidden sticky top-0 z-[90] bg-[#0a0f1d]/80 backdrop-blur-2xl border-b border-white/5 px-6 py-5 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="p-3 rounded-2xl bg-white/5 text-slate-400">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-black text-white tracking-tight">RIDA MARKET</span>
          </div>
          <div className="w-12" /> {/* Spacer */}
        </header>

        {/* Dynamic Scroll Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#050811] relative">
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-cyan-500/5 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-blue-600/5 blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 px-4 py-8 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
            {children}
          </div>
        </div>
      </main>
    </div>

    <style jsx global>{`
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .tracking-tightest { letter-spacing: -0.05em; }
      .glass {
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .glass-strong {
        background: rgba(10, 15, 29, 0.7);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
      }
      .glow-cyan { box-shadow: 0 0 30px rgba(6, 182, 212, 0.2); }
      .glow-indigo { box-shadow: 0 0 30px rgba(79, 70, 229, 0.2); }
    `}</style>
    </AuthGuard>
  );
}

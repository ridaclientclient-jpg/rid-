'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, LayoutDashboard, Users, Car, MapPin, DollarSign,
  BarChart3, FileText, Settings, LogOut, ChevronLeft, Zap,
  Menu, X, Store, Package, ShoppingCart, Truck, MessageSquare,
  Receipt, Star, AlertTriangle, Trophy, Building2, MapPinned,
  Tag, CarFront, Grid3X3, Image, Eye, Flame, Map, UserCog, Siren, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import AuthGuard from '@/components/AuthGuard';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/drivers', label: 'Conductores', icon: Car },
  { href: '/admin/rides', label: 'Viajes', icon: MapPin },
  { href: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/reports', label: 'Reportes', icon: FileText },
  { href: '/admin/marketplace', label: 'Marketplace', icon: Store },
  { href: '/admin/marketplace/vendors', label: 'Vendedores', icon: Users },
  { href: '/admin/marketplace/products', label: 'Productos', icon: Package },
  { href: '/admin/marketplace/orders', label: 'Pedidos MKT', icon: ShoppingCart },
  { href: '/admin/payment-report', label: 'Reporte Pagos', icon: Receipt },
  { href: '/admin/reviews', label: 'Resenas', icon: Star },
  { href: '/admin/driver-alerts', label: 'SOS Alertas', icon: Siren },
  { href: '/admin/anti-fraud', label: 'Anti-Fraude', icon: ShieldAlert },
  { href: '/admin/couriers', label: 'Repartidores', icon: Truck },
  { href: '/admin/chat', label: 'Chat Soporte', icon: MessageSquare },
  { href: '/admin/rewards', label: 'Recompensas', icon: Trophy },
  { href: '/admin/organizations', label: 'Organizaciones', icon: Building2 },
  { href: '/admin/locations', label: 'Areas Geo.', icon: MapPinned },
  { href: '/admin/promo-codes', label: 'Codigos Promo', icon: Tag },
  { href: '/admin/vehicle-types', label: 'Tipos Vehiculo', icon: CarFront },
  { href: '/admin/services/categories', label: 'Cat. Servicio', icon: Grid3X3 },
  { href: '/admin/banners', label: 'Banners', icon: Image },
  { href: '/admin/geo-map', label: 'Mapa Zonas', icon: Map },
  { href: '/admin/gods-view', label: "God's View", icon: Eye },
  { href: '/admin/heat-map', label: 'Heat Map', icon: Flame },
  { href: '/admin/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/admin/settings', label: 'Configuración', icon: Settings },
  { href: '/admin/admins', label: 'Admins', icon: UserCog, superAdminOnly: true },
];

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Using a timeout to avoid the strict sync setState rule
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return hydrated;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const hydrated = useHydrated();

  const publicPaths = ['/admin/login', '/admin/register', '/admin/recovery'];
  const isPublicPath = publicPaths.includes(pathname);

  // Don't show sidebar on public pages (AuthGuard handles auth redirects)
  if (isPublicPath) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Sesión cerrada');
    } catch (err) {
      console.error('Logout error:', err);
    }
    // Force full page navigation to ensure clean state
    window.location.href = '/admin/login';
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <AuthGuard requiredRole="admin" authPage="/admin/login">
    <div className="min-h-screen bg-rida-dark flex">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen z-50 flex flex-col transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} bg-[#0d1117] border-r border-white/10`}
      >
        {/* Logo */}
        <div className="p-5 flex items-center justify-between border-b border-white/5">
          <Link href="/admin" className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center glow-cyan flex-shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="whitespace-nowrap"
              >
                <h1 className="text-lg font-bold text-white glow-text">RIDA ADMIN</h1>
                <p className="text-[10px] text-cyan-400/60 uppercase tracking-widest">Supreme System</p>
              </motion.div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-7 h-7 rounded-lg bg-white/5 items-center justify-center text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item: any) => {
            // Hide super_admin-only items if user is not super_admin
            if (item.superAdminOnly && user?.role !== 'super_admin') return null;

            const active = isActive(item.href);
            const isSuperBadge = item.superAdminOnly;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  active
                    ? 'text-cyan-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="admin-nav-active"
                    className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/20 rounded-xl"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <item.icon className={`w-5 h-5 flex-shrink-0 relative z-10 ${active ? 'text-cyan-400' : ''}`} />
                {!collapsed && (
                  <span className="relative z-10 whitespace-nowrap">{item.label}</span>
                )}
                {!collapsed && isSuperBadge && (
                  <span className="relative z-10 ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                    Super
                  </span>
                )}
                {active && !collapsed && !isSuperBadge && (
                  <div className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="p-3 border-t border-white/5">
          {!collapsed && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-gray-500">Conectado como</p>
              <p className="text-sm text-white font-medium truncate">{user?.name}</p>
              <p className="text-xs text-cyan-400/60 truncate">{user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-rida-dark/80 backdrop-blur-xl border-b border-white/5 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">Sistema Online</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 glass rounded-lg px-3 py-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-gray-400">v1.0.0</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
    </AuthGuard>
  );
}

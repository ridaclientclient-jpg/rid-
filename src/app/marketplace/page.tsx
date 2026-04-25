'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Package, ShoppingCart, DollarSign, Star, TrendingUp, ArrowUpRight,
  Clock, Truck, AlertCircle, BarChart3, Store
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { supabase, type Vendor, type Delivery, type Product } from '@/lib/supabase';

/* ── Helpers ──────────────────────────────────────────────────── */

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  picked_up: 'Recogido',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  assigned: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  picked_up: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  in_transit: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr} hora${diffHr > 1 ? 's' : ''}`;
  if (diffDay < 7) return `Hace ${diffDay} día${diffDay > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
}

/* ── Types ────────────────────────────────────────────────────── */

interface DashboardStats {
  totalProducts: number;
  ordersToday: number;
  totalRevenue: number;
  rating: number;
  pendingOrders: number;
  activeDeliveries: number;
}

interface TopProduct {
  name: string;
  category: string;
  price: number;
  sold: number;
}

interface CategoryCount {
  name: string;
  count: number;
  color: string;
  percentage: number;
}

interface RecentOrder {
  id: string;
  customer: string;
  itemCount: number;
  total: number;
  status: string;
  createdAt: string;
}

const categoryColorMap: Record<string, string> = {
  farmacia: 'bg-emerald-500',
  food: 'bg-amber-500',
  comida: 'bg-amber-500',
  stores: 'bg-blue-500',
  tiendas: 'bg-blue-500',
  other: 'bg-purple-500',
  otro: 'bg-purple-500',
  bebidas: 'bg-cyan-500',
  snacks: 'bg-orange-500',
  cuidado_personal: 'bg-pink-500',
  limpieza: 'bg-teal-500',
  suplementos: 'bg-lime-500',
  medicina: 'bg-red-500',
};

const categoryLabelMap: Record<string, string> = {
  farmacia: 'Farmacia',
  food: 'Comida',
  comida: 'Comida',
  stores: 'Tiendas',
  tiendas: 'Tiendas',
  other: 'Otro',
  otro: 'Otro',
  bebidas: 'Bebidas',
  snacks: 'Snacks',
  cuidado_personal: 'Cuidado Personal',
  limpieza: 'Limpieza',
  suplementos: 'Suplementos',
  medicina: 'Medicina',
};

/* ── Animation ────────────────────────────────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/* ── Skeleton ─────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-64 bg-white/5 rounded-lg" />
          <div className="h-4 w-40 bg-white/5 rounded-lg mt-2" />
        </div>
        <div className="h-10 w-36 bg-white/5 rounded-xl" />
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/5" />
              <div className="w-12 h-4 bg-white/5 rounded" />
            </div>
            <div className="h-7 w-20 bg-white/5 rounded-lg" />
            <div className="h-3 w-16 bg-white/5 rounded mt-2" />
          </div>
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="h-6 w-32 bg-white/5 rounded-lg mb-5" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-xl mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/5" />
              <div className="flex-1">
                <div className="h-4 w-40 bg-white/5 rounded" />
                <div className="h-3 w-24 bg-white/5 rounded mt-1" />
              </div>
              <div className="h-4 w-16 bg-white/5 rounded" />
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="h-6 w-28 bg-white/5 rounded-lg mb-5" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 w-20 bg-white/5 rounded" />
                <div className="h-4 w-8 bg-white/5 rounded" />
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      {/* Orders skeleton */}
      <div className="glass rounded-2xl p-6">
        <div className="h-6 w-36 bg-white/5 rounded-lg mb-5" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-white/5">
            <div className="h-4 w-24 bg-white/5 rounded" />
            <div className="h-4 w-20 bg-white/5 rounded" />
            <div className="h-4 w-8 bg-white/5 rounded" />
            <div className="h-4 w-16 bg-white/5 rounded" />
            <div className="h-5 w-20 bg-white/5 rounded-full" />
            <div className="h-4 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function MarketplaceDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    ordersToday: 0,
    totalRevenue: 0,
    rating: 0,
    pendingOrders: 0,
    activeDeliveries: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    async function fetchDashboard() {
      try {
        setLoading(true);

        // 1. Get vendor info
        if (!user?.id) return;
        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (vendorError && vendorError.code !== 'PGRST116') {
          console.error('Error fetching vendor:', vendorError);
          toast.error('Error al cargar datos del vendedor');
          return;
        }

        if (!vendorData) {
          toast.error('No se encontró la tienda asociada');
          router.push('/marketplace/profile');
          return;
        }

        if (cancelled) return;
        setVendor(vendorData as Vendor);

        const vendorId = vendorData.id;

        // 2. Count total products
        const { count: totalProducts } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId);

        // 3. Orders today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { count: ordersToday } = await supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .gte('created_at', todayStart.toISOString());

        // 4. Total revenue (delivered)
        const { data: revenueData } = await supabase
          .from('deliveries')
          .select('total')
          .eq('vendor_id', vendorId)
          .eq('status', 'delivered');

        const totalRevenue = revenueData?.reduce((sum, d) => sum + (Number(d.total) || 0), 0) ?? 0;

        // 5. Pending orders
        const { count: pendingOrders } = await supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .eq('status', 'pending');

        // 6. Active deliveries
        const { count: activeDeliveries } = await supabase
          .from('deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .in('status', ['assigned', 'picked_up', 'in_transit']);

        if (cancelled) return;

        setStats({
          totalProducts: totalProducts ?? 0,
          ordersToday: ordersToday ?? 0,
          totalRevenue,
          rating: vendorData.rating ?? 5,
          pendingOrders: pendingOrders ?? 0,
          activeDeliveries: activeDeliveries ?? 0,
        });

        // 7. Fetch products for top products calculation
        const { data: products } = await supabase
          .from('products')
          .select('id, name, category, price')
          .eq('vendor_id', vendorId);

        // 8. Fetch delivered deliveries for top products
        const { data: deliveredDeliveries } = await supabase
          .from('deliveries')
          .select('items')
          .eq('vendor_id', vendorId)
          .eq('status', 'delivered');

        if (cancelled) return;

        // Calculate top products by counting items in delivered orders
        const soldMap: Record<string, number> = {};
        if (deliveredDeliveries && products) {
          for (const delivery of deliveredDeliveries) {
            const items = delivery.items as Array<{ id?: string; name?: string; price?: number; qty?: number; category?: string }>;
            if (Array.isArray(items)) {
              for (const itm of items) {
                const key = itm.id || itm.name || '';
                if (key) {
                  soldMap[key] = (soldMap[key] || 0) + (itm.qty || 1);
                }
              }
            }
          }

          const productSales: TopProduct[] = (products || []).map((p) => ({
            name: p.name,
            category: categoryLabelMap[p.category?.toLowerCase()] || p.category,
            price: Number(p.price),
            sold: soldMap[p.id] || 0,
          }));

          productSales.sort((a, b) => b.sold - a.sold);
          setTopProducts(productSales.slice(0, 5));
        }

        // 9. Category distribution
        if (products && products.length > 0) {
          const catMap: Record<string, number> = {};
          for (const p of products) {
            const cat = p.category?.toLowerCase() || 'otro';
            catMap[cat] = (catMap[cat] || 0) + 1;
          }

          const total = products.length;
          const catEntries = Object.entries(catMap)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => ({
              name: categoryLabelMap[cat] || cat,
              count,
              color: categoryColorMap[cat] || 'bg-gray-500',
              percentage: Math.round((count / total) * 100),
            }));

          setCategories(catEntries);
        }

        // 10. Recent orders with customer name
        const { data: recentData, error: recentError } = await supabase
          .from('deliveries')
          .select('id, items, total, status, created_at, profiles!deliveries_customer_id_fkey(name)')
          .eq('vendor_id', vendorId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (cancelled) return;

        if (recentError) {
          console.error('Error fetching recent orders:', recentError);
        } else {
          const orders: RecentOrder[] = (recentData || []).map((d) => {
            const profileData = d.profiles as { name?: string } | null;
            const itemsArr = (d.items || []) as unknown[];
            return {
              id: d.id,
              customer: profileData?.name || 'Cliente',
              itemCount: itemsArr.length,
              total: Number(d.total) || 0,
              status: d.status,
              createdAt: d.created_at,
            };
          });
          setRecentOrders(orders);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        toast.error('Error al cargar el dashboard');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [user?.id, router]);

  /* ── Stat cards config ──────────────────────────────────────── */
  const statCards = useMemo(() => [
    {
      label: 'Productos',
      value: stats.totalProducts.toString(),
      icon: Package,
      color: 'from-blue-600 to-cyan-500',
    },
    {
      label: 'Pedidos Hoy',
      value: stats.ordersToday.toString(),
      icon: ShoppingCart,
      color: 'from-emerald-500 to-green-500',
    },
    {
      label: 'Ingresos',
      value: formatCRC(stats.totalRevenue),
      icon: DollarSign,
      color: 'from-amber-500 to-orange-500',
    },
    {
      label: 'Rating',
      value: stats.rating.toFixed(1),
      icon: Star,
      color: 'from-purple-500 to-pink-500',
    },
    {
      label: 'Pendientes',
      value: stats.pendingOrders.toString(),
      icon: AlertCircle,
      color: 'from-amber-600 to-yellow-500',
    },
    {
      label: 'Activos',
      value: stats.activeDeliveries.toString(),
      icon: Truck,
      color: 'from-cyan-500 to-blue-500',
    },
  ], [stats]);

  if (loading) return <Skeleton />;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Marketplace <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Dashboard</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Bienvenido, {vendor?.store_name || user?.name || 'Vendedor'}. Aquí está tu resumen.
          </p>
        </div>
        <motion.button
          onClick={() => router.push('/marketplace/orders')}
          className="btn-neon text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 self-start"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <TrendingUp className="w-4 h-4" />
          Ver Reporte
        </motion.button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass rounded-2xl p-5 group hover:glow-cyan transition-all duration-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Selling Products */}
        <motion.div variants={item} className="lg:col-span-2 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Top Productos</h2>
              <p className="text-xs text-gray-500 mt-0.5">Los más vendidos</p>
            </div>
            <button
              onClick={() => router.push('/marketplace/products')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Sin datos de ventas aún</p>
              </div>
            ) : (
              topProducts.map((product, i) => (
                <motion.div
                  key={product.name}
                  className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors group cursor-pointer"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  onClick={() => router.push('/marketplace/products')}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatCRC(product.price)}</p>
                    <p className="text-xs text-emerald-400">{product.sold} vendidos</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Category Distribution */}
        <motion.div variants={item} className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Categorías</h2>
              <p className="text-xs text-gray-500 mt-0.5">Distribución de productos</p>
            </div>
            <button
              onClick={() => router.push('/marketplace/categories')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              Gestionar <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-5">
            {categories.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Sin categorías</p>
              </div>
            ) : (
              categories.map((cat) => (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                      <span className="text-sm text-gray-300">{cat.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{cat.count}</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${cat.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.percentage}%` }}
                      transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">{cat.percentage}% del total</p>
                </motion.div>
              ))
            )}
          </div>

          {/* Quick stats */}
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-white">{stats.totalProducts}</p>
              <p className="text-[10px] text-gray-500">Total SKUs</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">{categories.length}</p>
              <p className="text-[10px] text-gray-500">Categorías</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Orders */}
      <motion.div variants={item} className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Pedidos Recientes</h2>
            <p className="text-xs text-gray-500 mt-0.5">Últimas transacciones</p>
          </div>
          <button
            onClick={() => router.push('/marketplace/orders')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            Ver todos <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aún no hay pedidos</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">Pedido</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">Cliente</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">Items</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">Total</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">Estado</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentOrders.map((order, i) => (
                    <motion.tr
                      key={order.id}
                      className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      onClick={() => router.push('/marketplace/orders')}
                    >
                      <td className="py-3 pr-4 text-sm font-mono text-cyan-400">
                        #{order.id.slice(0, 8)}
                      </td>
                      <td className="py-3 pr-4 text-sm text-white">{order.customer}</td>
                      <td className="py-3 pr-4 text-sm text-gray-400">{order.itemCount}</td>
                      <td className="py-3 pr-4 text-sm font-semibold text-white">{formatCRC(order.total)}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusColors[order.status] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
                          {statusLabel[order.status] || order.status}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-gray-500 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {relativeTime(order.createdAt)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white/[0.03] rounded-xl p-4 cursor-pointer"
                  onClick={() => router.push('/marketplace/orders')}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-cyan-400">#{order.id.slice(0, 8)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[order.status] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
                      {statusLabel[order.status] || order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white font-medium">{order.customer}</p>
                      <p className="text-xs text-gray-500">{order.itemCount} items · {relativeTime(order.createdAt)}</p>
                    </div>
                    <p className="text-sm font-bold text-white">{formatCRC(order.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

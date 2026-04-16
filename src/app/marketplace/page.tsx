'use client';

import { motion } from 'framer-motion';
import {
  Package, ShoppingCart, DollarSign, Star, TrendingUp, ArrowUpRight,
  ArrowDownRight, Clock, MoreHorizontal, Eye
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const stats = [
  { label: 'Productos', value: '156', change: '+12', trend: 'up', icon: Package, color: 'from-blue-600 to-cyan-500' },
  { label: 'Pedidos Hoy', value: '23', change: '+8', trend: 'up', icon: ShoppingCart, color: 'from-emerald-500 to-green-500' },
  { label: 'Ingresos', value: '₡185,000', change: '+15%', trend: 'up', icon: DollarSign, color: 'from-amber-500 to-orange-500' },
  { label: 'Rating', value: '4.7', change: '+0.2', trend: 'up', icon: Star, color: 'from-purple-500 to-pink-500' },
];

const topProducts = [
  { name: 'Ibuprofeno 600mg', category: 'Farmacia', price: '₡3,500', sold: 145 },
  { name: 'Paracetamol 500mg', category: 'Farmacia', price: '₡2,200', sold: 128 },
  { name: 'Casado Tradicional', category: 'Comida', price: '₡4,500', sold: 98 },
  { name: 'Arroz Integral 1kg', category: 'Tiendas', price: '₡2,800', sold: 87 },
  { name: 'Vitamina C 1000mg', category: 'Farmacia', price: '₡5,100', sold: 76 },
];

const recentOrders = [
  { id: '#ORD-2847', customer: 'Ana García', items: 3, total: '₡12,500', status: 'Completed', date: 'Hace 5 min' },
  { id: '#ORD-2846', customer: 'Luis Rojas', items: 1, total: '₡3,500', status: 'Processing', date: 'Hace 12 min' },
  { id: '#ORD-2845', customer: 'María López', items: 5, total: '₡28,900', status: 'Pending', date: 'Hace 25 min' },
  { id: '#ORD-2844', customer: 'Pedro Sánchez', items: 2, total: '₡8,200', status: 'Completed', date: 'Hace 40 min' },
  { id: '#ORD-2843', customer: 'Laura Martínez', items: 1, total: '₡4,500', status: 'Cancelled', date: 'Hace 1 hr' },
];

const categories = [
  { name: 'Farmacia', count: 68, color: 'bg-emerald-500', percentage: 44 },
  { name: 'Comida', count: 52, color: 'bg-amber-500', percentage: 33 },
  { name: 'Tiendas', count: 36, color: 'bg-blue-500', percentage: 23 },
];

const statusColors: Record<string, string> = {
  Completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function MarketplaceDashboard() {
  const { user } = useAuthStore();

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Marketplace <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Dashboard</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Bienvenido, {user?.name || 'Vendedor'}. Aquí está tu resumen.</p>
        </div>
        <motion.button
          onClick={() => toast.info('Reporte semanal descargado')}
          className="btn-neon text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 self-start"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <TrendingUp className="w-4 h-4" />
          Ver Reporte
        </motion.button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
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
              <div className={`flex items-center gap-1 text-xs font-medium ${stat.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.change}
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
              <p className="text-xs text-gray-500 mt-0.5">Los más vendidos esta semana</p>
            </div>
            <button
              onClick={() => toast.info('Redirigiendo a productos...')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {topProducts.map((product, i) => (
              <motion.div
                key={product.name}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors group cursor-pointer"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                onClick={() => toast.info(`Ver: ${product.name}`)}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{product.price}</p>
                  <p className="text-xs text-emerald-400">{product.sold} vendidos</p>
                </div>
              </motion.div>
            ))}
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
              onClick={() => toast.info('Redirigiendo a categorías...')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              Gestionar <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-5">
            {categories.map((cat) => (
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
            ))}
          </div>

          {/* Quick stats */}
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-white">156</p>
              <p className="text-[10px] text-gray-500">Total SKUs</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">3</p>
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
            onClick={() => toast.info('Redirigiendo a pedidos...')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            Ver todos <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-500 pb-3 pr-4">Order ID</th>
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
                  onClick={() => toast.info(`Ver pedido ${order.id}`)}
                >
                  <td className="py-3 pr-4 text-sm font-mono text-cyan-400">{order.id}</td>
                  <td className="py-3 pr-4 text-sm text-white">{order.customer}</td>
                  <td className="py-3 pr-4 text-sm text-gray-400">{order.items}</td>
                  <td className="py-3 pr-4 text-sm font-semibold text-white">{order.total}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusColors[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-gray-500 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {order.date}
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
              onClick={() => toast.info(`Ver pedido ${order.id}`)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-cyan-400">{order.id}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[order.status]}`}>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">{order.customer}</p>
                  <p className="text-xs text-gray-500">{order.items} items · {order.date}</p>
                </div>
                <p className="text-sm font-bold text-white">{order.total}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

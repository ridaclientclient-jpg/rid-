'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Store, Package, ShoppingCart, DollarSign, TrendingUp,
  ArrowUpRight, Clock, Users, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const stats = [
  { label: 'Total Vendedores', value: '8', change: '+3', icon: Store, color: 'from-amber-500 to-orange-500', bgGlow: 'shadow-amber-500/20' },
  { label: 'Productos Activos', value: '156', change: '+12', icon: Package, color: 'from-blue-600 to-cyan-500', bgGlow: 'shadow-cyan-500/20' },
  { label: 'Pedidos Hoy', value: '23', change: '+8', icon: ShoppingCart, color: 'from-emerald-500 to-green-500', bgGlow: 'shadow-emerald-500/20' },
  { label: 'Ingresos Marketplace', value: '₡185,000', change: '+15%', icon: DollarSign, color: 'from-purple-500 to-pink-500', bgGlow: 'shadow-purple-500/20' },
];

const topProducts = [
  { name: 'Ibuprofeno 600mg', category: 'Farmacia', price: '₡3,500', sold: 145 },
  { name: 'Paracetamol 500mg', category: 'Farmacia', price: '₡2,200', sold: 128 },
  { name: 'Casado Tradicional', category: 'Comida', price: '₡4,500', sold: 98 },
  { name: 'Arroz Integral 1kg', category: 'Tiendas', price: '₡2,800', sold: 87 },
  { name: 'Vitamina C 1000mg', category: 'Farmacia', price: '₡5,100', sold: 76 },
  { name: 'Sopa de Mariscos', category: 'Comida', price: '₡6,500', sold: 52 },
];

const recentOrders = [
  { id: '#ORD-2847', customer: 'Ana García', total: '₡12,500', status: 'Completed', date: 'Hace 5 min' },
  { id: '#ORD-2846', customer: 'Luis Rojas', total: '₡3,500', status: 'Processing', date: 'Hace 12 min' },
  { id: '#ORD-2845', customer: 'María López', total: '₡28,900', status: 'Pending', date: 'Hace 25 min' },
  { id: '#ORD-2844', customer: 'Pedro Sánchez', total: '₡8,200', status: 'Completed', date: 'Hace 40 min' },
  { id: '#ORD-2843', customer: 'Laura Martínez', total: '₡4,500', status: 'Cancelled', date: 'Hace 1 hr' },
];

const statusColors: Record<string, string> = {
  Completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const categoryBadgeColors: Record<string, string> = {
  Farmacia: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Comida: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Tiendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AdminMarketplaceDashboard() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Marketplace
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestión del marketplace</p>
        </div>
        <div className="flex gap-2 self-start">
          <Link href="/admin/marketplace/vendors">
            <motion.button
              className="btn-neon text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Users className="w-4 h-4" />
              Vendedores
            </motion.button>
          </Link>
          <Link href="/admin/marketplace/products">
            <motion.button
              className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Package className="w-4 h-4" />
              Productos
            </motion.button>
          </Link>
          <Link href="/admin/marketplace/orders">
            <motion.button
              className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <ShoppingCart className="w-4 h-4" />
              Pedidos
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass rounded-2xl p-5 hover:glow-cyan/30 transition-all duration-300 group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg ${stat.bgGlow}`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-gray-400 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top Products Table */}
        <motion.div
          variants={item}
          className="xl:col-span-2 glass rounded-2xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              Productos Destacados
            </h2>
            <Link href="/admin/marketplace/products" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Producto</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">Categoría</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Precio</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Vendidos</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, i) => (
                  <motion.tr
                    key={product.name}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    onClick={() => toast.info(`Ver: ${product.name}`)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold">
                          {i + 1}
                        </div>
                        <span className="text-sm text-white font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${categoryBadgeColors[product.category]}`}>
                        {product.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-white font-medium hidden md:table-cell">{product.price}</td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-emerald-400 font-medium">{product.sold}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={item} className="glass rounded-2xl p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" />
            Gestión Rápida
          </h2>
          <div className="space-y-2">
            <Link href="/admin/marketplace/vendors">
              <motion.div
                className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer group"
                whileHover={{ x: 4 }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <Store className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Vendedores</p>
                  <p className="text-xs text-gray-500">8 vendedores registrados</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
              </motion.div>
            </Link>
            <Link href="/admin/marketplace/products">
              <motion.div
                className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer group"
                whileHover={{ x: 4 }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-500/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Productos</p>
                  <p className="text-xs text-gray-500">156 productos activos</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
              </motion.div>
            </Link>
            <Link href="/admin/marketplace/orders">
              <motion.div
                className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer group"
                whileHover={{ x: 4 }}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Pedidos</p>
                  <p className="text-xs text-gray-500">23 pedidos hoy</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
              </motion.div>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Recent Orders */}
      <motion.div variants={item} className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-cyan-400" />
            Pedidos Recientes
          </h2>
          <Link href="/admin/marketplace/orders" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
            Ver todos <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ID Pedido</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Total</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order, i) => (
                <motion.tr
                  key={order.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  onClick={() => toast.info(`Ver pedido ${order.id}`)}
                >
                  <td className="px-5 py-3 text-sm font-mono text-cyan-400">{order.id}</td>
                  <td className="px-5 py-3 text-sm text-white">{order.customer}</td>
                  <td className="px-5 py-3 text-sm text-white font-medium">{order.total}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusColors[order.status]}`}>
                      {order.status === 'Completed' ? 'Completado' : order.status === 'Processing' ? 'Procesando' : order.status === 'Pending' ? 'Pendiente' : 'Cancelado'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {order.date}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-4 space-y-3">
          {recentOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white/[0.03] rounded-xl p-4 cursor-pointer"
              onClick={() => toast.info(`Ver pedido ${order.id}`)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-cyan-400">{order.id}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[order.status]}`}>
                  {order.status === 'Completed' ? 'Completado' : order.status === 'Processing' ? 'Procesando' : order.status === 'Pending' ? 'Pendiente' : 'Cancelado'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">{order.customer}</p>
                  <p className="text-xs text-gray-500">{order.date}</p>
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

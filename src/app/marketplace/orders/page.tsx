'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, Eye, Clock, ChevronDown, Check,
  Package, User, Calendar, Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customer: string;
  customerPhone: string;
  items: OrderItem[];
  total: number;
  status: 'Pending' | 'Processing' | 'Completed' | 'Cancelled';
  date: string;
  address: string;
}

const initialOrders: Order[] = [
  {
    id: 'ORD-2847',
    customer: 'Ana García',
    customerPhone: '+506 8888 1001',
    items: [{ name: 'Ibuprofeno 600mg', quantity: 2, price: 3500 }, { name: 'Vitamina C', quantity: 1, price: 5100 }],
    total: 12100,
    status: 'Completed',
    date: '2024-01-15 14:32',
    address: 'San José, Costa Rica',
  },
  {
    id: 'ORD-2846',
    customer: 'Luis Rojas',
    customerPhone: '+506 8888 1002',
    items: [{ name: 'Casado Tradicional', quantity: 1, price: 4500 }],
    total: 4500,
    status: 'Processing',
    date: '2024-01-15 14:18',
    address: 'Heredia, Costa Rica',
  },
  {
    id: 'ORD-2845',
    customer: 'María López',
    customerPhone: '+506 8888 1003',
    items: [
      { name: 'Arroz Integral', quantity: 2, price: 2800 },
      { name: 'Aceite de Oliva', quantity: 1, price: 7500 },
      { name: 'Café Molido', quantity: 2, price: 3200 },
      { name: 'Jabón de Avena', quantity: 3, price: 1800 },
      { name: 'Crema Hidratante', quantity: 1, price: 4500 },
    ],
    total: 28900,
    status: 'Pending',
    date: '2024-01-15 13:55',
    address: 'Cartago, Costa Rica',
  },
  {
    id: 'ORD-2844',
    customer: 'Pedro Sánchez',
    customerPhone: '+506 8888 1004',
    items: [{ name: 'Paracetamol 500mg', quantity: 2, price: 2200 }, { name: 'Omeprazol 20mg', quantity: 1, price: 4200 }],
    total: 8600,
    status: 'Completed',
    date: '2024-01-15 12:40',
    address: 'Alajuela, Costa Rica',
  },
  {
    id: 'ORD-2843',
    customer: 'Laura Martínez',
    customerPhone: '+506 8888 1005',
    items: [{ name: 'Sopa de Mariscos', quantity: 1, price: 6500 }],
    total: 6500,
    status: 'Cancelled',
    date: '2024-01-15 11:22',
    address: 'San José, Costa Rica',
  },
  {
    id: 'ORD-2842',
    customer: 'Carlos Vega',
    customerPhone: '+506 8888 1006',
    items: [
      { name: 'Ibuprofeno 600mg', quantity: 3, price: 3500 },
      { name: 'Ensalada César', quantity: 1, price: 3800 },
    ],
    total: 14300,
    status: 'Completed',
    date: '2024-01-15 10:15',
    address: 'Limón, Costa Rica',
  },
  {
    id: 'ORD-2841',
    customer: 'Sofia Herrera',
    customerPhone: '+506 8888 1007',
    items: [{ name: 'Casado Tradicional', quantity: 2, price: 4500 }, { name: 'Café Molido', quantity: 1, price: 3200 }],
    total: 12200,
    status: 'Processing',
    date: '2024-01-15 09:45',
    address: 'Puntarenas, Costa Rica',
  },
  {
    id: 'ORD-2840',
    customer: 'Diego Morales',
    customerPhone: '+506 8888 1008',
    items: [{ name: 'Vitamina C 1000mg', quantity: 1, price: 5100 }],
    total: 5100,
    status: 'Pending',
    date: '2024-01-15 09:10',
    address: 'Guanacaste, Costa Rica',
  },
];

const statusConfig: Record<string, { color: string; dotColor: string; next?: string }> = {
  Pending: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dotColor: 'bg-amber-400', next: 'Processing' },
  Processing: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dotColor: 'bg-blue-400', next: 'Completed' },
  Completed: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dotColor: 'bg-emerald-400' },
  Cancelled: { color: 'bg-red-500/15 text-red-400 border-red-500/30', dotColor: 'bg-red-400' },
};

const filters = ['All', 'Pending', 'Processing', 'Completed', 'Cancelled'];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = activeFilter === 'All' || o.status === activeFilter;
      const matchSearch = o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.customer.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [orders, activeFilter, search]);

  const updateStatus = (orderId: string, newStatus: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o))
    );
    setOpenDropdown(null);
    toast.success(`Pedido ${orderId} actualizado a ${newStatus}`);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: orders.length };
    filters.forEach((f) => { if (f !== 'All') counts[f] = orders.filter((o) => o.status === f).length; });
    return counts;
  }, [orders]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Pedidos</h1>
          <p className="text-gray-400 text-sm mt-1">{orders.length} pedidos en total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID o cliente..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                activeFilter === f
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {f}
              <span className="text-[10px] bg-white/10 rounded-full px-1.5 py-0.5">{statusCounts[f] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table (Desktop) */}
      <div className="hidden lg:block glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs font-medium text-gray-500 pb-3 px-6">Pedido</th>
              <th className="text-left text-xs font-medium text-gray-500 pb-3 px-6">Cliente</th>
              <th className="text-left text-xs font-medium text-gray-500 pb-3 px-6">Items</th>
              <th className="text-left text-xs font-medium text-gray-500 pb-3 px-6">Total</th>
              <th className="text-left text-xs font-medium text-gray-500 pb-3 px-6">Estado</th>
              <th className="text-left text-xs font-medium text-gray-500 pb-3 px-6">Fecha</th>
              <th className="text-left text-xs font-medium text-gray-500 pb-3 px-6">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((order, i) => (
              <motion.tr
                key={order.id}
                className="hover:bg-white/[0.03] transition-colors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <td className="py-4 px-6">
                  <span className="text-sm font-mono text-cyan-400">#{order.id}</span>
                </td>
                <td className="py-4 px-6">
                  <div>
                    <p className="text-sm text-white font-medium">{order.customer}</p>
                    <p className="text-[11px] text-gray-600">{order.customerPhone}</p>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-300">{order.items.length}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="text-sm font-semibold text-white">₡{order.total.toLocaleString()}</span>
                </td>
                <td className="py-4 px-6">
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === order.id ? null : order.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${statusConfig[order.status].color}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${statusConfig[order.status].dotColor}`} />
                      {order.status}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <AnimatePresence>
                      {openDropdown === order.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute top-full mt-1 left-0 z-20 glass-strong rounded-xl py-1 min-w-[140px]"
                        >
                          {['Pending', 'Processing', 'Completed', 'Cancelled'].map((s) => (
                            <button
                              key={s}
                              onClick={() => updateStatus(order.id, s)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors ${
                                s === order.status ? 'text-cyan-400' : 'text-gray-400'
                              }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${statusConfig[s].dotColor}`} />
                              {s}
                              {s === order.status && <Check className="w-3 h-3 ml-auto" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {order.date}
                  </div>
                </td>
                <td className="py-4 px-6">
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Orders Cards (Mobile) */}
      <div className="lg:hidden space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((order) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass rounded-2xl p-4 cursor-pointer"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono text-cyan-400">#{order.id}</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${statusConfig[order.status].color}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${statusConfig[order.status].dotColor}`} />
                  {order.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">{order.customer}</p>
                  <p className="text-xs text-gray-500">{order.items.length} items · {order.date}</p>
                </div>
                <p className="text-base font-bold text-white">₡{order.total.toLocaleString()}</p>
              </div>

              {/* Quick action buttons */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                {order.status === 'Pending' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'Processing'); }}
                    className="flex-1 py-2 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                  >
                    Procesar
                  </button>
                )}
                {order.status === 'Processing' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'Completed'); }}
                    className="flex-1 py-2 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                  >
                    Completar
                  </button>
                )}
                {order.status !== 'Completed' && order.status !== 'Cancelled' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'Cancelled'); }}
                    className="flex-1 py-2 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Detalles
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No se encontraron pedidos</p>
        </div>
      )}

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
            <motion.div
              className="relative w-full max-w-lg glass-strong rounded-2xl p-6 z-10"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Pedido #{selectedOrder.id}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedOrder.date}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusConfig[selectedOrder.status].color}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${statusConfig[selectedOrder.status].dotColor}`} />
                  {selectedOrder.status}
                </span>
              </div>

              {/* Customer info */}
              <div className="bg-white/[0.03] rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-white font-medium">{selectedOrder.customer}</p>
                    <p className="text-xs text-gray-500">{selectedOrder.customerPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  {selectedOrder.address}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2 mb-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Productos</p>
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03]">
                    <div>
                      <p className="text-sm text-white">{item.name}</p>
                      <p className="text-xs text-gray-500">x{item.quantity} · ₡{item.price.toLocaleString()} c/u</p>
                    </div>
                    <p className="text-sm font-semibold text-white">₡{(item.quantity * item.price).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between py-3 border-t border-white/10 mb-4">
                <p className="text-sm text-gray-400 font-medium">Total</p>
                <p className="text-xl font-bold text-white">₡{selectedOrder.total.toLocaleString()}</p>
              </div>

              {/* Status update buttons */}
              <div className="flex gap-2">
                {selectedOrder.status === 'Pending' && (
                  <button
                    onClick={() => { updateStatus(selectedOrder.id, 'Processing'); setSelectedOrder(null); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity"
                  >
                    Marcar En Proceso
                  </button>
                )}
                {selectedOrder.status === 'Processing' && (
                  <button
                    onClick={() => { updateStatus(selectedOrder.id, 'Completed'); setSelectedOrder(null); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-green-500 hover:opacity-90 transition-opacity"
                  >
                    Marcar Completado
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

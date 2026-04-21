'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ShoppingCart, Clock, X, Eye, ChevronDown,
  Package, User, MapPin, Check, XCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  dbId: string;
  customer: string;
  email: string;
  phone: string;
  address: string;
  items: OrderItem[];
  total: number;
  status: 'Pending' | 'Processing' | 'Completed' | 'Cancelled';
  date: string;
}

// Map DB status → UI status
const dbStatusToUi: Record<string, 'Pending' | 'Processing' | 'Completed' | 'Cancelled'> = {
  pending: 'Pending',
  assigned: 'Processing',
  picked_up: 'Processing',
  in_transit: 'Processing',
  delivered: 'Completed',
  cancelled: 'Cancelled',
};

// Map UI status → DB status
const uiStatusToDb: Record<string, string> = {
  Pending: 'pending',
  Processing: 'assigned',
  Completed: 'delivered',
  Cancelled: 'cancelled',
};

const statusLabels: Record<string, string> = {
  Pending: 'Pendiente',
  Processing: 'Procesando',
  Completed: 'Completado',
  Cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  Completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const statusOptions = ['All', 'Pending', 'Processing', 'Completed', 'Cancelled'];
const statusFilterLabels: Record<string, string> = {
  All: 'Todos',
  Pending: 'Pendientes',
  Processing: 'Procesando',
  Completed: 'Completados',
  Cancelled: 'Cancelados',
};

const PAGE_SIZE = 20;

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
      <p className="text-gray-400 text-sm">Cargando pedidos...</p>
    </div>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fetchOrders = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*, profiles(name, email, phone), vendors(store_name)')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      const mappedOrders: Order[] = (data || []).map((d) => {
        const profile = d.profiles as { name?: string; email?: string; phone?: string } | null;
        const items = (d.items || []) as OrderItem[];

        const uiStatus = dbStatusToUi[d.status] || 'Pending';

        const createdAt = d.created_at
          ? new Date(d.created_at)
          : new Date();
        const dateStr = createdAt.toLocaleDateString('es-CR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }) + ' ' + createdAt.toLocaleTimeString('es-CR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        return {
          id: '#ORD-' + d.id.slice(-4).toUpperCase(),
          dbId: d.id,
          customer: profile?.name || 'Sin nombre',
          email: profile?.email || '',
          phone: profile?.phone || '',
          address: d.delivery_address || '',
          items,
          total: d.total || 0,
          status: uiStatus,
          date: dateStr,
        };
      });

      if (append) {
        setOrders((prev) => [...prev, ...mappedOrders]);
      } else {
        setOrders(mappedOrders);
      }

      setHasMore((data || []).length === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.customer.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'All' || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, search, filterStatus]);

  const handleStatusChange = async (orderId: string, dbId: string, newStatus: Order['status']) => {
    const prevOrders = [...orders];
    const dbStatus = uiStatusToDb[newStatus];

    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.dbId === dbId ? { ...o, status: newStatus } : o))
    );

    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ status: dbStatus })
        .eq('id', dbId);

      if (error) throw error;

      toast.success(`Pedido ${orderId} actualizado a "${statusLabels[newStatus]}"`);
    } catch (err) {
      console.error('Error updating order status:', err);
      setOrders(prevOrders);
      toast.error('Error al actualizar el estado del pedido');
    }
  };

  const counts = useMemo(() => ({
    All: orders.length,
    Pending: orders.filter((o) => o.status === 'Pending').length,
    Processing: orders.filter((o) => o.status === 'Processing').length,
    Completed: orders.filter((o) => o.status === 'Completed').length,
    Cancelled: orders.filter((o) => o.status === 'Cancelled').length,
  }), [orders]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Pedidos Marketplace</h1>
          <p className="text-gray-400 text-sm mt-1">Gestión de pedidos del marketplace</p>
        </div>
        <LoadingState />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Pedidos Marketplace</h1>
        <p className="text-gray-400 text-sm mt-1">Gestión de pedidos del marketplace</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID o nombre del cliente..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                filterStatus === status
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {statusFilterLabels[status]}
              <span className="ml-1.5 text-[10px] opacity-70">{counts[status as keyof typeof counts]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ID Pedido</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Items</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Total</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order, i) => (
                <motion.tr
                  key={order.dbId}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.03 }}
                >
                  <td className="px-5 py-3 text-sm font-mono text-cyan-400">{order.id}</td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-white font-medium">{order.customer}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-300 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-gray-500" />
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-white font-semibold">₡{order.total.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, order.dbId, e.target.value as Order['status'])}
                        className={`appearance-none text-[11px] font-medium px-2.5 py-1 rounded-full border pr-7 cursor-pointer focus:outline-none transition-colors ${statusColors[order.status]}`}
                      >
                        {statusOptions.filter((s) => s !== 'All').map((s) => (
                          <option key={s} value={s} className="bg-gray-900 text-white">
                            {statusLabels[s]}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-70" />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {order.date}
                  </td>
                  <td className="px-5 py-3">
                    <motion.button
                      onClick={() => setSelectedOrder(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Eye className="w-3 h-3" />
                      Ver
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((order, i) => (
            <motion.div
              key={order.dbId}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-cyan-400">{order.id}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[order.status]}`}>
                  {statusLabels[order.status]}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-white font-medium">{order.customer}</p>
                <p className="text-sm font-bold text-white">₡{order.total.toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {order.date}
                </span>
              </div>
              <div className="flex gap-2 pt-3 border-t border-white/10">
                <motion.button
                  onClick={() => setSelectedOrder(order)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  <Eye className="w-3 h-3" />
                  Ver Detalle
                </motion.button>
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, order.dbId, e.target.value as Order['status'])}
                    className={`appearance-none text-[11px] font-medium px-3 py-2 rounded-lg border pr-7 cursor-pointer focus:outline-none transition-colors bg-white/5 ${statusColors[order.status]}`}
                  >
                    {statusOptions.filter((s) => s !== 'All').map((s) => (
                      <option key={s} value={s} className="bg-gray-900 text-white">
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-70" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && orders.length === 0 && (
        <div className="text-center py-16">
          <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No se encontraron pedidos</p>
        </div>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <motion.button
            onClick={() => fetchOrders(orders.length, true)}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: loadingMore ? 1 : 1.02 }}
            whileTap={{ scale: loadingMore ? 1 : 0.98 }}
          >
            {loadingMore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            {loadingMore ? 'Cargando...' : 'Cargar más'}
          </motion.button>
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
              className="relative w-full max-w-lg glass-strong rounded-2xl z-10 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedOrder.id}</h2>
                    <p className="text-sm text-gray-400 mt-0.5">{selectedOrder.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusColors[selectedOrder.status]}`}>
                      {statusLabels[selectedOrder.status]}
                    </span>
                    <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Customer Info */}
                <div className="glass rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-cyan-400" />
                    Información del Cliente
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Nombre</span>
                    <span className="text-sm text-white">{selectedOrder.customer}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Email</span>
                    <span className="text-sm text-gray-300">{selectedOrder.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Teléfono</span>
                    <span className="text-sm text-gray-300">{selectedOrder.phone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Dirección</span>
                    <span className="text-sm text-gray-300">{selectedOrder.address}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-cyan-400" />
                    Productos ({selectedOrder.items.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <div>
                          <p className="text-sm text-white">{item.name}</p>
                          <p className="text-[11px] text-gray-500">Cant: {item.quantity}</p>
                        </div>
                        <p className="text-sm text-white font-medium">₡{(item.price * item.quantity).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/10">
                    <span className="text-sm font-semibold text-white">Total</span>
                    <span className="text-lg font-bold text-emerald-400">₡{selectedOrder.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Status Actions */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Cambiar Estado</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      onClick={() => {
                        handleStatusChange(selectedOrder.id, selectedOrder.dbId, 'Pending');
                        setSelectedOrder(null);
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                        selectedOrder.status === 'Pending'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Pendiente
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        handleStatusChange(selectedOrder.id, selectedOrder.dbId, 'Processing');
                        setSelectedOrder(null);
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                        selectedOrder.status === 'Processing'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Package className="w-3.5 h-3.5" />
                      Procesando
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        handleStatusChange(selectedOrder.id, selectedOrder.dbId, 'Completed');
                        setSelectedOrder(null);
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                        selectedOrder.status === 'Completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Completado
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        handleStatusChange(selectedOrder.id, selectedOrder.dbId, 'Cancelled');
                        setSelectedOrder(null);
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                        selectedOrder.status === 'Cancelled'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancelado
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, Eye, Clock, ChevronDown, Check,
  Package, User, MapPin, RefreshCw, Phone, Truck, X, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Delivery, type Vendor, type Courier, type Profile } from '@/lib/supabase';
import { type RealtimeChannel } from '@supabase/supabase-js';
import { useVendorId } from '@/hooks/useVendorId';

/* ── Helpers ──────────────────────────────────────────────────── */

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  picked_up: 'Recogido',
  in_transit: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const statusConfig: Record<string, { color: string; dotColor: string }> = {
  pending: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dotColor: 'bg-amber-400' },
  assigned: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dotColor: 'bg-blue-400' },
  picked_up: { color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dotColor: 'bg-purple-400' },
  in_transit: { color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30', dotColor: 'bg-cyan-400' },
  delivered: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dotColor: 'bg-emerald-400' },
  cancelled: { color: 'bg-red-500/15 text-red-400 border-red-500/30', dotColor: 'bg-red-400' },
};

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  return formatDateTime(dateStr);
}

/* ── Types ────────────────────────────────────────────────────── */

interface OrderItem {
  id?: string;
  name: string;
  price: number;
  qty: number;
  category?: string;
}

interface OrderWithDetails {
  id: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  createdAt: string;
  deliveryAddress: string;
  pickupAddress?: string;
  paymentMethod: string;
  notes?: string;
  courierId?: string;
  courierName?: string;
  courierPhone?: string;
  courierVehicle?: string;
}

type FilterTab = 'all' | 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';

interface FilterTabConfig {
  key: FilterTab;
  label: string;
  statusValue?: string;
}

const filterTabs: FilterTabConfig[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendiente', statusValue: 'pending' },
  { key: 'assigned', label: 'Asignado', statusValue: 'assigned' },
  { key: 'in_transit', label: 'En Camino', statusValue: 'in_transit' },
  { key: 'delivered', label: 'Entregado', statusValue: 'delivered' },
  { key: 'cancelled', label: 'Cancelado', statusValue: 'cancelled' },
];

/* ── Skeleton ─────────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-white/5 rounded-lg" />
          <div className="h-4 w-32 bg-white/5 rounded-lg mt-2" />
        </div>
        <div className="h-10 w-36 bg-white/5 rounded-xl" />
      </div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="h-10 flex-1 bg-white/5 rounded-xl" />
        <div className="flex gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 w-24 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
      {/* Table skeleton */}
      <div className="glass rounded-2xl p-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-4 border-b border-white/5">
            <div className="h-4 w-24 bg-white/5 rounded" />
            <div className="h-4 w-20 bg-white/5 rounded" />
            <div className="h-4 w-8 bg-white/5 rounded" />
            <div className="h-4 w-16 bg-white/5 rounded" />
            <div className="h-5 w-20 bg-white/5 rounded-full" />
            <div className="h-4 w-20 bg-white/5 rounded" />
            <div className="h-4 w-12 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function OrdersPage() {
  const { user } = useAuthStore();
  const { vendorId, loading: vendorLoading, error: vendorError } = useVendorId();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  /* ── Fetch orders via RPC (SECURITY DEFINER — bypasses all RLS) */
  const fetchOrders = useCallback(async (showLoading = false) => {
    if (!user?.id || !vendorId) return;

    if (showLoading) setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_vendor_orders', {
        p_vendor_id: vendorId,
      });

      if (error) {
        console.error('Error fetching orders:', error);
        toast.error('Error al cargar pedidos');
        return;
      }

      const mapped: OrderWithDetails[] = (data || []).map((d: any) => {
        const customerProfile = d.profiles as { name?: string; phone?: string } | null;
        const courierData = d.couriers as {
          id?: string;
          user_id?: string;
          vehicle_type?: string;
          rating?: number;
          profiles?: { name?: string; phone?: string };
        } | null;

        return {
          id: d.id,
          customerName: customerProfile?.name || 'Cliente',
          customerPhone: customerProfile?.phone || '',
          items: (d.items || []) as OrderItem[],
          subtotal: Number(d.subtotal) || 0,
          deliveryFee: Number(d.delivery_fee) || 0,
          total: Number(d.total) || 0,
          status: d.status,
          createdAt: d.created_at,
          deliveryAddress: d.delivery_address || '',
          pickupAddress: d.pickup_address || '',
          paymentMethod: d.payment_method || 'efectivo',
          notes: d.notes || '',
          courierId: courierData?.user_id || courierData?.id || undefined,
          courierName: courierData?.profiles?.name || undefined,
          courierPhone: courierData?.profiles?.phone || undefined,
          courierVehicle: courierData?.vehicle_type || undefined,
        };
      });

      setOrders(mapped);
    } catch (err) {
      console.error('Orders fetch error:', err);
      toast.error('Error al cargar pedidos');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user?.id, vendorId]);

  /* ── vendorId is now provided by useVendorId hook ──────────── */

  /* ── Fetch orders when vendorId is set ─────────────────────── */
  useEffect(() => {
    if (!vendorId) return;

    setLoading(true);
    fetchOrders(true);
  }, [vendorId, fetchOrders]);

  /* ── Realtime subscription ────────────────────────────────── */
  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor-deliveries-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            fetchOrders(false);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [vendorId, fetchOrders]);

  /* ── Auto-refresh every 30 seconds ───────────────────────── */
  useEffect(() => {
    if (!vendorId) return;

    const interval = setInterval(() => {
      fetchOrders(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [vendorId, fetchOrders]);

  /* ── Update status ────────────────────────────────────────── */
  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order:', error);
        toast.error('Error al actualizar el pedido');
        return;
      }

      toast.success(`Pedido actualizado a ${statusLabel[newStatus] || newStatus}`);

      // Update local state optimistically
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );

      // Update selected order if it's the same
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null);
      }

      setOpenDropdown(null);
    } catch (err) {
      console.error('Update status error:', err);
      toast.error('Error al actualizar el pedido');
    } finally {
      setUpdating(null);
    }
  };

  /* ── Available transitions for vendor ─────────────────────── */
  const getVendorTransitions = (status: string): Array<{ value: string; label: string }> => {
    const transitions: Array<{ value: string; label: string }> = [];
    switch (status) {
      case 'pending':
        transitions.push({ value: 'assigned', label: 'Preparar para recojo' });
        transitions.push({ value: 'cancelled', label: 'Cancelar' });
        break;
      case 'assigned':
        transitions.push({ value: 'picked_up', label: 'Marcar como recogido' });
        transitions.push({ value: 'cancelled', label: 'Cancelar' });
        break;
      case 'picked_up':
        transitions.push({ value: 'cancelled', label: 'Cancelar' });
        break;
      case 'in_transit':
        // Courier-only, vendor cannot change
        break;
      case 'delivered':
        // Final state
        break;
      case 'cancelled':
        // Final state
        break;
    }
    return transitions;
  };

  const canCancel = (status: string) => status !== 'delivered' && status !== 'cancelled';

  /* ── Filtered orders ──────────────────────────────────────── */
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = activeFilter === 'all' || o.status === activeFilter;
      const matchSearch =
        search === '' ||
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.customerName.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [orders, activeFilter, search]);

  /* ── Status counts ────────────────────────────────────────── */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  /* ── Handle refresh ───────────────────────────────────────── */
  const handleRefresh = async () => {
    toast.info('Actualizando pedidos...');
    await fetchOrders(false);
    toast.success('Pedidos actualizados');
  };

  if (vendorLoading || loading) return <LoadingSkeleton />;

  if (vendorError) {
    return (
      <div className="text-center py-16">
        <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">{vendorError}</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Pedidos</h1>
          <p className="text-gray-400 text-sm mt-1">{orders.length} pedidos en total</p>
        </div>
        <motion.button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </motion.button>
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
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                activeFilter === tab.key
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {tab.label}
              <span className="text-[10px] bg-white/10 rounded-full px-1.5 py-0.5">
                {statusCounts[tab.key] || 0}
              </span>
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
                  <span className="text-sm font-mono text-cyan-400">#{order.id.slice(0, 8)}</span>
                </td>
                <td className="py-4 px-6">
                  <div>
                    <p className="text-sm text-white font-medium">{order.customerName}</p>
                    <p className="text-[11px] text-gray-600">{order.customerPhone || '—'}</p>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-300">{order.items.length}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="text-sm font-semibold text-white">{formatCRC(order.total)}</span>
                </td>
                <td className="py-4 px-6">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdown(openDropdown === order.id ? null : order.id);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        statusConfig[order.status]?.color || 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${statusConfig[order.status]?.dotColor || 'bg-gray-400'}`} />
                      {statusLabel[order.status] || order.status}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <AnimatePresence>
                      {openDropdown === order.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute top-full mt-1 left-0 z-20 glass-strong rounded-xl py-1 min-w-[180px] shadow-xl"
                        >
                          {getVendorTransitions(order.status).map((t) => (
                            <button
                              key={t.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(order.id, t.value);
                              }}
                              disabled={updating === order.id}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-gray-400 disabled:opacity-50"
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${statusConfig[t.value]?.dotColor || 'bg-gray-400'}`} />
                              {t.label}
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
                    {relativeTime(order.createdAt)}
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
                <span className="text-sm font-mono text-cyan-400">#{order.id.slice(0, 8)}</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                    statusConfig[order.status]?.color || 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${statusConfig[order.status]?.dotColor || 'bg-gray-400'}`} />
                  {statusLabel[order.status] || order.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">{order.customerName}</p>
                  <p className="text-xs text-gray-500">
                    {order.items.length} items · {relativeTime(order.createdAt)}
                  </p>
                </div>
                <p className="text-base font-bold text-white">{formatCRC(order.total)}</p>
              </div>

              {/* Quick action buttons */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                {order.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateStatus(order.id, 'assigned');
                    }}
                    disabled={updating === order.id}
                    className="flex-1 py-2 rounded-lg text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                  >
                    Preparar
                  </button>
                )}
                {order.status === 'assigned' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateStatus(order.id, 'picked_up');
                    }}
                    disabled={updating === order.id}
                    className="flex-1 py-2 rounded-lg text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                  >
                    Recogido
                  </button>
                )}
                {canCancel(order.status) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateStatus(order.id, 'cancelled');
                    }}
                    disabled={updating === order.id}
                    className="flex-1 py-2 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOrder(order);
                  }}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Detalles
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && !loading && (
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
              className="relative w-full max-w-lg glass-strong rounded-2xl p-6 z-10 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Pedido #{selectedOrder.id.slice(0, 8)}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(selectedOrder.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                      statusConfig[selectedOrder.status]?.color || 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${statusConfig[selectedOrder.status]?.dotColor || 'bg-gray-400'}`} />
                    {statusLabel[selectedOrder.status] || selectedOrder.status}
                  </span>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Customer info */}
              <div className="bg-white/[0.03] rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{selectedOrder.customerName}</p>
                    {selectedOrder.customerPhone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedOrder.customerPhone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="break-all">{selectedOrder.deliveryAddress || 'Dirección no proporcionada'}</span>
                </div>
                {selectedOrder.pickupAddress && (
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <Package className="w-3 h-3 flex-shrink-0" />
                    <span className="break-all">Recojo: {selectedOrder.pickupAddress}</span>
                  </div>
                )}
                {selectedOrder.paymentMethod && (
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <DollarSign className="w-3 h-3 flex-shrink-0" />
                    <span>Pago: {selectedOrder.paymentMethod === 'efectivo' ? 'Efectivo' : selectedOrder.paymentMethod}</span>
                  </div>
                )}
              </div>

              {/* Courier info (if assigned) */}
              {selectedOrder.courierName && (
                <div className="bg-white/[0.03] rounded-xl p-4 mb-4">
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-2">Mensajero</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{selectedOrder.courierName}</p>
                      {selectedOrder.courierPhone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedOrder.courierPhone}
                        </p>
                      )}
                      {selectedOrder.courierVehicle && (
                        <p className="text-xs text-gray-500">
                          {selectedOrder.courierVehicle === 'moto' ? '🏍️ Moto' :
                           selectedOrder.courierVehicle === 'bici' ? '🚲 Bicicleta' : '🚗 Carro'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="space-y-2 mb-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Productos</p>
                {selectedOrder.items.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin productos</p>
                ) : (
                  selectedOrder.items.map((itm, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03]"
                    >
                      <div>
                        <p className="text-sm text-white">{itm.name}</p>
                        <p className="text-xs text-gray-500">
                          x{itm.qty || 1} · {formatCRC(itm.price || 0)} c/u
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {formatCRC((itm.qty || 1) * (itm.price || 0))}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="bg-white/[0.03] rounded-xl p-4 mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white">{formatCRC(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Envío</span>
                  <span className="text-white">{formatCRC(selectedOrder.deliveryFee)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-white/10">
                  <p className="text-sm text-gray-300 font-medium">Total</p>
                  <p className="text-xl font-bold text-white">{formatCRC(selectedOrder.total)}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4">
                  <p className="text-[10px] text-amber-400 font-medium uppercase tracking-wider mb-1">Notas</p>
                  <p className="text-sm text-gray-300">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Status update buttons */}
              <div className="flex gap-2">
                {selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => {
                      updateStatus(selectedOrder.id, 'assigned');
                      setSelectedOrder(null);
                    }}
                    disabled={updating === selectedOrder.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Preparar para Recojo
                  </button>
                )}
                {selectedOrder.status === 'assigned' && (
                  <button
                    onClick={() => {
                      updateStatus(selectedOrder.id, 'picked_up');
                      setSelectedOrder(null);
                    }}
                    disabled={updating === selectedOrder.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Marcar como Recogido
                  </button>
                )}
                {canCancel(selectedOrder.status) && (
                  <button
                    onClick={() => {
                      updateStatus(selectedOrder.id, 'cancelled');
                      setSelectedOrder(null);
                    }}
                    disabled={updating === selectedOrder.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    Cancelar Pedido
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

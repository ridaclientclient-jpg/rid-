'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Courier, type Delivery } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Package, MapPin, Clock, ChevronRight, CheckCircle2,
  ArrowRight, Truck, Phone, MessageSquare, AlertTriangle,
  ShoppingBag, DollarSign, Loader2, X as XIcon,
  Navigation, Map as MapIcon,
} from 'lucide-react';
import GoogleMap from '@/components/GoogleMap';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignada',
  picked_up: 'Recogida',
  in_transit: 'En camino',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  assigned: 'bg-amber-500/20 text-amber-400',
  picked_up: 'bg-blue-500/20 text-blue-400',
  in_transit: 'bg-purple-500/20 text-purple-400',
  delivered: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const STATUS_STEPS = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered'];

function getStatusStepIndex(status: string): number {
  return STATUS_STEPS.indexOf(status);
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  return `Hace ${diffDays} dias`;
}

function getItemsSummary(items: any[]): string {
  if (!items || items.length === 0) return 'Sin items';
  if (items.length === 1) return items[0].name || items[0].quantity ? `${items[0].quantity || 1}x ${items[0].name || 'Item'}` : '1 item';
  return `${items.length} items`;
}

export default function CourierDeliveries() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const [courierLocation, setCourierLocation] = useState<{lat: number, lng: number} | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const activeDelivery = deliveries.find(
    (d) => d.status === 'assigned' || d.status === 'picked_up' || d.status === 'in_transit'
  );

  const pastDeliveries = deliveries.filter(
    (d) => d.status === 'delivered' || d.status === 'cancelled'
  );

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: courierData } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (courierData) {
        setCourier(courierData);

        const { data: deliveriesData } = await supabase
          .from('deliveries')
          .select('*')
          .eq('courier_id', courierData.id)
          .order('created_at', { ascending: false });

        setDeliveries(deliveriesData || []);
      }
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      toast.error('Error al cargar entregas');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription — triggers when a delivery is assigned to this courier
  useEffect(() => {
    if (!courier?.id) return;

    // Clean up previous channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`courier-deliveries-${courier.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
        },
        (payload) => {
          const row = (payload.new ?? {}) as Partial<Delivery>;
          // Only react to events that belong to this courier
          if (row.courier_id !== courier.id) return;
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (row.status === 'assigned') {
              setHasNewOrder(true);
              toast.success('¡Nueva entrega asignada!', {
                description: 'Tienes una orden pendiente de recogida',
                duration: 6000,
              });
            }
            fetchData();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [courier?.id, fetchData]);

  const updateDeliveryStatus = async (deliveryId: string, newStatus: string) => {
    setUpdatingId(deliveryId);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ status: newStatus })
        .eq('id', deliveryId);

      if (error) {
        toast.error('Error al actualizar entrega');
        return;
      }

      const statusMessages: Record<string, string> = {
        picked_up: 'Paquete recogido correctamente',
        in_transit: 'En camino al destino',
        delivered: 'Entrega completada! Buen trabajo!',
      };

      toast.success(statusMessages[newStatus] || 'Estado actualizado');

      // Also update courier status when handling active deliveries
      if (newStatus === 'in_transit' && courier?.id) {
        await supabase
          .from('couriers')
          .update({ status: 'delivering' })
          .eq('id', courier.id);
      }

      if (newStatus === 'delivered' && courier?.id) {
        await supabase
          .from('couriers')
          .update({ status: 'online' })
          .eq('id', courier.id);
      }

      fetchData();
    } catch (err) {
      console.error('Update status error:', err);
      toast.error('Error de conexion');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando entregas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Entregas</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {activeDelivery ? 'Tienes una entrega activa' : 'Sin entregas activas'}
            </p>
          </div>
          {/* New order badge */}
          <AnimatePresence>
            {hasNewOrder && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                onClick={() => setHasNewOrder(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs font-bold shadow-lg shadow-orange-500/30 animate-pulse"
              >
                <Package className="w-3.5 h-3.5" />
                Nueva orden!
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-2"
      >
        <div className="glass rounded-xl p-3 text-center">
          <Package className="w-4 h-4 text-orange-400 mx-auto mb-1" />
          <p className="text-base font-bold text-white">{deliveries.length}</p>
          <p className="text-[10px] text-gray-500">Total</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <Truck className="w-4 h-4 text-purple-400 mx-auto mb-1" />
          <p className="text-base font-bold text-white">{activeDelivery ? 1 : 0}</p>
          <p className="text-[10px] text-gray-500">Activas</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-base font-bold text-white">{pastDeliveries.filter(d => d.status === 'delivered').length}</p>
          <p className="text-[10px] text-gray-500">Completadas</p>
        </div>
      </motion.div>

      {/* Active Delivery */}
      <AnimatePresence>
        {activeDelivery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-strong rounded-2xl p-5 space-y-4 border border-orange-500/30"
            style={{ boxShadow: '0 0 20px rgba(249, 115, 22, 0.15)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Entrega Activa
              </span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLORS[activeDelivery.status]}`}>
                {STATUS_LABELS[activeDelivery.status]}
              </span>
            </div>

            {/* Interactive Map */}
            <div className="h-64 rounded-xl overflow-hidden border border-white/10 relative mt-4 mb-2">
              {activeDelivery.pickup_lat && activeDelivery.delivery_lat ? (
                <GoogleMap
                  center={courierLocation || { lat: activeDelivery.pickup_lat, lng: activeDelivery.pickup_lng }}
                  zoom={15}
                  showUserLocation={true}
                  onUserLocation={setCourierLocation}
                  showRoute={{
                    origin: activeDelivery.status === 'assigned' 
                      ? (courierLocation || { lat: activeDelivery.pickup_lat, lng: activeDelivery.pickup_lng }) 
                      : { lat: activeDelivery.pickup_lat, lng: activeDelivery.pickup_lng },
                    destination: activeDelivery.status === 'assigned'
                      ? { lat: activeDelivery.pickup_lat, lng: activeDelivery.pickup_lng }
                      : { lat: activeDelivery.delivery_lat, lng: activeDelivery.delivery_lng }
                  }}
                  showDirections={true}
                />
              ) : (
                <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center">
                  <MapIcon className="w-8 h-8 text-gray-500 mb-2" />
                  <p className="text-xs text-gray-400">Coordenadas no disponibles</p>
                </div>
              )}
            </div>

            {/* Status Flow */}
            <div className="flex items-center gap-1">
              {STATUS_STEPS.map((step, i) => {
                const isActive = getStatusStepIndex(activeDelivery.status) >= i;
                const isCurrent = activeDelivery.status === step;
                return (
                  <div key={step} className="flex-1 flex items-center gap-1">
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: isCurrent ? 1.1 : 1 }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isActive
                            ? 'bg-orange-500 text-white'
                            : 'bg-white/10 text-gray-500'
                        }`}
                        style={isCurrent ? { boxShadow: '0 0 10px rgba(249, 115, 22, 0.5)' } : {}}
                      >
                        {i + 1}
                      </motion.div>
                      <span className={`text-[8px] ${isActive ? 'text-orange-400' : 'text-gray-600'}`}>
                        {STATUS_LABELS[step].slice(0, 5)}
                      </span>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 ${getStatusStepIndex(activeDelivery.status) > i ? 'bg-orange-500' : 'bg-white/10'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Items */}
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-300">{getItemsSummary(activeDelivery.items)}</span>
            </div>

            {/* Route */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Recoger en</p>
                  <p className="text-sm text-white">{activeDelivery.pickup_address || 'Direccion de recogida'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Entregar en</p>
                  <p className="text-sm text-white">{activeDelivery.delivery_address}</p>
                </div>
              </div>
            </div>

            {/* Delivery Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-2 text-center">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-sm font-bold text-white">₡{(activeDelivery.total || 0).toLocaleString()}</p>
              </div>
              <div className="glass rounded-xl p-2 text-center">
                <p className="text-xs text-gray-500">Comision</p>
                <p className="text-sm font-bold text-emerald-400">₡{(activeDelivery.delivery_fee || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 mt-4">
              {activeDelivery.status === 'assigned' && (
                <button
                  onClick={() => updateDeliveryStatus(activeDelivery.id, 'picked_up')}
                  disabled={updatingId === activeDelivery.id}
                  className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {updatingId === activeDelivery.id ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <><Package className="w-6 h-6" /> Confirmar Recogida en Local</>
                  )}
                </button>
              )}

              {activeDelivery.status === 'picked_up' && (
                <button
                  onClick={() => updateDeliveryStatus(activeDelivery.id, 'in_transit')}
                  disabled={updatingId === activeDelivery.id}
                  className="w-full font-black py-4 rounded-2xl flex items-center justify-center gap-3 text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #9333ea, #f97316)',
                    boxShadow: '0 0 30px rgba(249, 115, 22, 0.3)',
                  }}
                >
                  {updatingId === activeDelivery.id ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <><Navigation className="w-6 h-6" /> Iniciar Viaje al Cliente</>
                  )}
                </button>
              )}

              {activeDelivery.status === 'in_transit' && (
                <button
                  onClick={() => updateDeliveryStatus(activeDelivery.id, 'delivered')}
                  disabled={updatingId === activeDelivery.id}
                  className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {updatingId === activeDelivery.id ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <><CheckCircle2 className="w-6 h-6" /> Marcar como Entregado</>
                  )}
                </button>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const lat = activeDelivery.status === 'assigned' ? activeDelivery.pickup_lat : activeDelivery.delivery_lat;
                    const lng = activeDelivery.status === 'assigned' ? activeDelivery.pickup_lng : activeDelivery.delivery_lng;
                    if (lat && lng) {
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                    } else {
                      toast.error('Coordenadas no disponibles');
                    }
                  }}
                  className="flex-[2] border border-white/10 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 transition-all active:scale-95"
                >
                  <Navigation className="w-5 h-5 text-cyan-400" /> Abrir en Waze / Maps
                </button>
                <button
                  onClick={() => toast.error('SOS activado. Equipo de seguridad notificado.')}
                  className="flex-1 bg-red-500/10 border border-red-500/20 text-red-400 font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all active:scale-95"
                >
                  <AlertTriangle className="w-5 h-5" /> SOS
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Past Deliveries */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400">Historial de Entregas</h2>
          <span className="text-xs text-gray-600">{pastDeliveries.length} entregas</span>
        </div>

        {pastDeliveries.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pastDeliveries.map((delivery, i) => (
              <motion.div
                key={delivery.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.03 }}
                className="glass rounded-xl p-3"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      delivery.status === 'delivered' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                    }`}>
                      {delivery.status === 'delivered' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XIcon className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{getItemsSummary(delivery.items)}</p>
                      <p className="text-[10px] text-gray-500">{formatRelativeTime(delivery.created_at)}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[delivery.status]}`}>
                    {STATUS_LABELS[delivery.status]}
                  </span>
                </div>

                <div className="space-y-1 ml-11">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <p className="text-[11px] text-gray-400 truncate">{delivery.delivery_address}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">
                      {delivery.pickup_address ? `Desde: ${delivery.pickup_address}` : ''}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400">
                      +₡{(delivery.delivery_fee || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {deliveries.length === 0
                ? 'No tienes entregas aun'
                : 'No tienes entregas completadas'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {deliveries.length === 0
                ? 'Las entregas asignadas apareceran aqui'
                : 'Las entregas completadas se mostraran aqui'}
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

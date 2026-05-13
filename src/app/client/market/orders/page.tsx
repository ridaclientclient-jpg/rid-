'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Package, Clock, CheckCircle2, ChevronRight, Truck, Navigation, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import GoogleMap from '@/components/GoogleMap';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  picked_up: 'En Camino',
  in_transit: 'En Camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  picked_up: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  in_transit: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  delivered: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_STEPS = [
  { id: 'pending', label: 'Orden Recibida', icon: Package },
  { id: 'assigned', label: 'Preparando', icon: Clock },
  { id: 'picked_up', label: 'Recogido', icon: Truck },
  { id: 'delivered', label: 'Entregado', icon: CheckCircle2 },
];

export default function ClientOrders() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('deliveries')
        .select(`
          *,
          vendors (
            id,
            business_name,
            logo_url
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setDeliveries(data);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast.error('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();

    if (!user?.id) return;
    const channel = supabase
      .channel(`client-orders-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries', filter: `customer_id=eq.${user.id}` },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchData]);

  const activeDeliveries = deliveries.filter(
    (d) => !['delivered', 'cancelled'].includes(d.status)
  );

  const pastDeliveries = deliveries.filter(
    (d) => ['delivered', 'cancelled'].includes(d.status)
  );

  return (
    <div className="p-4 space-y-6 max-w-md mx-auto relative pb-24">
      <div>
        <h1 className="text-2xl font-black text-white">Mis Pedidos</h1>
        <p className="text-sm text-gray-400 mt-1">Sigue tus ordenes del Marketplace en tiempo real</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : deliveries.length === 0 ? (
        <div className="glass-strong rounded-2xl p-8 text-center border border-white/5">
          <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-cyan-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No tienes pedidos aun</h3>
          <p className="text-sm text-gray-400">
            Explora el Marketplace y realiza tu primera compra
          </p>
        </div>
      ) : (
        <>
          <AnimatePresence>
            {activeDeliveries.map((delivery) => {
              const currentStepIdx = STATUS_STEPS.findIndex(s => s.id === delivery.status) || 0;
              const normalizedStepIdx = currentStepIdx === -1 ? (delivery.status === 'in_transit' ? 2 : 0) : currentStepIdx;

              return (
                <motion.div
                  key={delivery.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-strong rounded-2xl overflow-hidden border border-cyan-500/30"
                  style={{ boxShadow: '0 0 30px rgba(6, 182, 212, 0.15)' }}
                >
                  <div className="p-4 flex items-center justify-between border-b border-white/5 bg-cyan-500/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{delivery.vendors?.business_name || 'Tienda'}</p>
                        <p className="text-xs text-cyan-400 font-medium">Pedido #{delivery.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLORS[delivery.status] || STATUS_COLORS.pending}`}>
                      {STATUS_LABELS[delivery.status] || 'Desconocido'}
                    </span>
                  </div>

                  {/* Active Map View */}
                  <div className="h-48 relative border-b border-white/5">
                    {delivery.pickup_lat && delivery.delivery_lat ? (
                      <GoogleMap
                        center={{ lat: delivery.delivery_lat, lng: delivery.delivery_lng }}
                        zoom={14}
                        showRoute={{
                          origin: { lat: delivery.pickup_lat, lng: delivery.pickup_lng },
                          destination: { lat: delivery.delivery_lat, lng: delivery.delivery_lng }
                        }}
                        showDirections={true}
                        showUserLocation={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-900/50 flex flex-col items-center justify-center">
                        <MapPin className="w-6 h-6 text-gray-500 mb-2" />
                        <p className="text-xs text-gray-400">Mapa no disponible</p>
                      </div>
                    )}
                    
                    {/* ETA Overlay */}
                    <div className="absolute bottom-3 right-3 glass-strong rounded-xl px-3 py-2 flex items-center gap-2 border border-white/10 z-10 shadow-lg">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">Llegada est.</p>
                        <p className="text-xs font-bold text-white">15-20 min</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Status Tracker */}
                    <div className="relative">
                      <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-800" />
                      <div 
                        className="absolute top-4 left-4 h-0.5 bg-cyan-400 transition-all duration-500" 
                        style={{ width: \`\${(normalizedStepIdx / (STATUS_STEPS.length - 1)) * 100}%\` }} 
                      />
                      <div className="relative flex justify-between">
                        {STATUS_STEPS.map((step, idx) => {
                          const Icon = step.icon;
                          const isCompleted = idx <= normalizedStepIdx;
                          const isActive = idx === normalizedStepIdx;
                          return (
                            <div key={step.id} className="flex flex-col items-center gap-2">
                              <div className={\`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors duration-500 \${isCompleted ? 'bg-cyan-500 text-white' : 'bg-gray-800 text-gray-500 border border-gray-700'}\`}>
                                <Icon className={\`w-4 h-4 \${isActive ? 'animate-pulse' : ''}\`} />
                              </div>
                              <span className={\`text-[10px] font-medium \${isCompleted ? 'text-cyan-400' : 'text-gray-500'}\`}>
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] text-gray-500">Direccion de entrega</p>
                          <p className="text-sm text-gray-300 line-clamp-2">{delivery.delivery_address}</p>
                        </div>
                      </div>
                      
                      {delivery.delivery_instructions && (
                        <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                          <Package className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-gray-500">Instrucciones</p>
                            <p className="text-xs text-gray-300">{delivery.delivery_instructions}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {pastDeliveries.length > 0 && (
            <div className="mt-8 space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Historial de Pedidos</h2>
              <div className="space-y-3">
                {pastDeliveries.map((delivery) => (
                  <div key={delivery.id} className="glass rounded-2xl p-4 flex items-center gap-4 hover:bg-white/5 transition-colors border border-white/5 cursor-pointer">
                    <div className={\`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 \${delivery.status === 'delivered' ? 'bg-emerald-500/10' : 'bg-red-500/10'}\`}>
                      <Package className={\`w-6 h-6 \${delivery.status === 'delivered' ? 'text-emerald-400' : 'text-red-400'}\`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-bold text-white truncate">{delivery.vendors?.business_name || 'Marketplace'}</p>
                        <span className={\`text-[10px] font-bold px-2 py-0.5 rounded-md \${delivery.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}\`}>
                          {delivery.status === 'delivered' ? 'Entregado' : 'Cancelado'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{delivery.delivery_address}</p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {new Date(delivery.created_at).toLocaleDateString('es-CR', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

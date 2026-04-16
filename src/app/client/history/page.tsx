'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MapPin, Star, ChevronRight, Car, Loader2 } from 'lucide-react';
import { useRideStore } from '@/store/rideStore';
import { useAuthStore } from '@/store/authStore';
import { useState, useEffect } from 'react';

const rideTypeNames: Record<string, string> = {
  standard: 'Economico',
  premium: 'Premium',
  suv: 'SUV',
  moto: 'Moto',
  moto_express: 'Moto Express',
  grua: 'Grua',
  flete: 'Flete',
};

export default function ClientHistory() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { rideHistory, fetchRideHistory } = useRideStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (user?.id) {
      fetchRideHistory(user.id).then(() => {
        if (!cancelled) setLoading(false);
      }).catch(() => {
        if (!cancelled) setLoading(false);
      });
    }
    return () => { cancelled = true; };
  }, [user?.id, fetchRideHistory]);

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    completed: { label: 'Completado', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
    cancelled: { label: 'Cancelado', color: 'text-red-400', bgColor: 'bg-red-500/20' },
    searching: { label: 'Buscando', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
    assigned: { label: 'Asignado', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    arriving: { label: 'En camino', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    started: { label: 'En viaje', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-white">Historial de Viajes</h1>
        </motion.div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Historial de Viajes</h1>
        <p className="text-sm text-gray-400 mt-1">{rideHistory.length} viajes</p>
      </motion.div>

      <div className="space-y-3">
        {rideHistory.map((ride: any, i: number) => {
          const sc = statusConfig[ride.status] || statusConfig.completed;
          const typeName = rideTypeNames[ride.ride_type || ''] || 'Economico';
          return (
            <motion.button
              key={ride.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => router.push(`/client/ride/${ride.id}`)}
              className="w-full glass rounded-xl p-4 text-left hover:bg-white/5 transition-colors"
            >
              {/* Top Row: Status + Date + Arrow */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.bgColor} ${sc.color}`}>
                    {sc.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <Car className="w-3 h-3 text-gray-500" />
                    <span className="text-[10px] text-gray-500">{typeName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {ride.date || (ride.created_at ? new Date(ride.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' }) : '')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>

              {/* Route */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div className="w-0.5 h-6 bg-white/10" />
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <p className="text-sm text-white truncate">{ride.origin}</p>
                  <p className="text-sm text-gray-400 truncate">{ride.destination}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-bold text-white">₡{Number(ride.price).toLocaleString()}</p>
                  {ride.distance && (
                    <p className="text-[10px] text-gray-500">{ride.distance} km</p>
                  )}
                </div>
              </div>

              {/* Rating row for completed */}
              {ride.status === 'completed' && ride.rider_rating && (
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={`w-3 h-3 ${idx < ride.rider_rating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`}
                    />
                  ))}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {rideHistory.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-8 text-center"
        >
          <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No tienes viajes aun</p>
          <p className="text-xs text-gray-600 mt-1">Tus viajes apareceran aqui</p>
        </motion.div>
      )}
    </div>
  );
}

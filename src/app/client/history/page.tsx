'use client';

import { motion } from 'framer-motion';
import { MapPin, Clock, Star, ChevronRight } from 'lucide-react';
import { useRideStore } from '@/store/rideStore';
import { toast } from 'sonner';

export default function ClientHistory() {
  const { rideHistory } = useRideStore();
  
  const demoHistory = rideHistory.length > 0 ? rideHistory : [
    { id: 'R-001', origin: 'San Jose Centro', destination: 'Escazu', price: 2800, status: 'completed' as const, date: '2026-04-14' },
    { id: 'R-002', origin: 'Santa Ana', destination: 'Heredia', price: 3500, status: 'completed' as const, date: '2026-04-13' },
    { id: 'R-003', origin: 'Alajuela', destination: 'San Jose Centro', price: 1800, status: 'cancelled' as const, date: '2026-04-12' },
    { id: 'R-004', origin: 'Cartago', destination: 'Curridabat', price: 4200, status: 'completed' as const, date: '2026-04-11' },
  ];

  return (
    <div className="p-4 space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Historial de Viajes</h1>
        <p className="text-sm text-gray-400 mt-1">{demoHistory.length} viajes</p>
      </motion.div>

      <div className="space-y-3">
        {demoHistory.map((ride, i) => (
          <motion.div
            key={ride.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                ride.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {ride.status === 'completed' ? 'Completado' : 'Cancelado'}
              </span>
              <span className="text-xs text-gray-500">{ride.date}</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="w-0.5 h-6 bg-white/10" />
                <div className="w-2 h-2 rounded-full bg-red-400" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm text-white">{ride.origin}</p>
                <p className="text-sm text-gray-400">{ride.destination}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">₡{ride.price.toLocaleString()}</p>
              </div>
            </div>
            {ride.status === 'completed' && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-xs text-gray-400">Calificar conductor</span>
                <ChevronRight className="w-3 h-3 text-gray-600 ml-auto" />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

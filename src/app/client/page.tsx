'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MapPin, Clock, Star, Shield, ChevronRight, Zap, Car, Wallet, Bell, Headphones, Store } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useRideStore } from '@/store/rideStore';
import FavoritePlaces from '@/components/FavoritePlaces';

export default function ClientHome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentRide } = useRideStore();

  const quickActions = [
    { icon: Car, label: 'Pedir Viaje', desc: 'Transporte ahora', href: '/client/ride', color: 'from-blue-600 to-cyan-500' },
    { icon: Clock, label: 'Programar', desc: 'Agendar viaje', href: '/client/ride', color: 'from-purple-600 to-blue-600' },
    { icon: Wallet, label: 'Billetera', desc: 'Ver saldo', href: '/client/wallet', color: 'from-emerald-600 to-cyan-600' },
    { icon: Store, label: 'Marketplace', desc: 'Comprar productos', href: '/client/market', color: 'from-amber-500 to-orange-500' },
    { icon: Headphones, label: 'Soporte', desc: '24/7 ayuda', href: '/client/support', color: 'from-amber-500 to-orange-500' },
  ];

  // Favorite places are now handled by the FavoritePlaces component (real data from Supabase)

  return (
    <div className="p-4 space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white">Hola, {user?.name?.split(' ')[0] || 'Usuario'}</h1>
        <p className="text-sm text-gray-400 mt-1">A donde vas hoy?</p>
      </motion.div>

      {/* Active Ride Banner */}
      {currentRide && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-strong rounded-2xl p-4 border border-cyan-500/30 glow-cyan"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-cyan-400">Viaje en curso</span>
            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">{currentRide.status}</span>
          </div>
          <p className="text-sm text-white">{currentRide.origin} → {currentRide.destination}</p>
          <p className="text-lg font-bold text-white mt-1">₡{currentRide.price.toLocaleString()}</p>
          <button onClick={() => router.push(`/client/ride/${currentRide.id}`)} className="w-full mt-3 btn-neon text-white text-sm font-medium py-2 rounded-xl">
            Ver detalles
          </button>
        </motion.div>
      )}

      {/* Search Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-4"
      >
        <button 
          onClick={() => router.push('/client/ride')}
          className="w-full flex items-center gap-3 bg-white/5 rounded-xl p-3 hover:bg-white/10 transition-colors"
        >
          <MapPin className="w-5 h-5 text-cyan-400" />
          <span className="text-sm text-gray-400">A donde quieres ir?</span>
          <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
        </button>
      </motion.div>

      {/* Quick Actions */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Acciones Rapidas</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => router.push(action.href)}
              className="glass rounded-2xl p-4 text-left hover:glow-cyan transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-white">{action.label}</p>
              <p className="text-xs text-gray-500">{action.desc}</p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Favorite Places */}
      <FavoritePlaces />

      {/* Safety Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-2xl p-4 border border-emerald-500/20"
      >
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-white">Tu seguridad es primero</p>
            <p className="text-xs text-gray-400">Comparte tu viaje con contactos de confianza</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

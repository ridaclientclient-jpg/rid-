'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  Power, PowerOff, MapPin, Clock, Star, Car, Navigation,
  AlertTriangle, ChevronRight, Shield,
} from 'lucide-react';

export default function DriverHome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isOnline, setIsOnline] = useState(false);

  const stats = [
    { label: 'Viajes hoy', value: '8', icon: Car, color: 'from-blue-600 to-cyan-500' },
    { label: 'Ganancias hoy', value: '₡25,500', icon: Star, color: 'from-emerald-600 to-cyan-600' },
    { label: 'Rating', value: '4.8', icon: Star, color: 'from-amber-500 to-orange-500' },
    { label: 'Horas', value: '6.5h', icon: Clock, color: 'from-purple-600 to-pink-600' },
  ];

  const quickActions = [
    { icon: Car, label: 'Aceptar Viaje', desc: 'Nuevo viaje disponible', href: '/driver/rides', color: 'from-emerald-600 to-cyan-600' },
    { icon: Navigation, label: 'Navegar', desc: 'Abrir GPS', action: () => toast.info('Abriendo navegador GPS...'), color: 'from-blue-600 to-cyan-500' },
    { icon: AlertTriangle, label: 'Reportar', desc: 'Reportar incidencia', action: () => toast.info('Formulario de reporte abierto'), color: 'from-red-500 to-orange-500' },
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white">Hola, {user?.name?.split(' ')[0] || 'Carlos'}</h1>
        <p className="text-sm text-gray-400 mt-1">{isOnline ? 'Estas en linea y recibiendo viajes' : 'Conectate para comenzar a recibir viajes'}</p>
      </motion.div>

      {/* Big Online/Offline Toggle */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        className="flex justify-center"
      >
        <button
          onClick={() => {
            setIsOnline(!isOnline);
            toast.success(isOnline ? 'Has pasado a fuera de linea' : 'Estas en linea! Recibiras solicitudes.');
          }}
          className="relative"
        >
          {/* Glow ring when online */}
          {isOnline && (
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-500/20"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ margin: '-8px' }}
            />
          )}
          <div className={`relative w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 transition-all ${
            isOnline
              ? 'bg-emerald-500'
              : 'bg-red-500/20 border-2 border-red-500/40'
          }`}>
            {isOnline ? (
              <Power className="w-10 h-10 text-white" />
            ) : (
              <PowerOff className="w-10 h-10 text-red-400" />
            )}
            <span className={`text-sm font-bold ${isOnline ? 'text-white' : 'text-red-400'}`}>
              {isOnline ? 'EN LINEA' : 'FUERA DE LINEA'}
            </span>
          </div>
        </button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Estadisticas de Hoy</h2>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.05 }}
              className="glass rounded-2xl p-4"
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-2`}>
                <stat.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Acciones Rapidas</h2>
        <div className="space-y-2">
          {quickActions.map((action, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.32 + i * 0.05 }}
              onClick={() => action.href ? router.push(action.href) : action.action?.()}
              className="w-full glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/5 transition-colors group"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-white">{action.label}</p>
                <p className="text-xs text-gray-500">{action.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </motion.button>
          ))}
        </div>
      </motion.div>

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
            <p className="text-xs text-gray-400">Boton SOS disponible en cada viaje activo</p>
          </div>
        </div>
      </motion.div>

      {/* Map Placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="h-40 bg-gradient-to-br from-white/5 to-white/[0.02] flex flex-col items-center justify-center gap-2">
          <MapPin className="w-8 h-8 text-cyan-400/50" />
          <p className="text-xs text-gray-500">Mapa de tu ubicacion</p>
          <p className="text-[10px] text-gray-600">San Jose, Costa Rica</p>
        </div>
      </motion.div>
    </div>
  );
}

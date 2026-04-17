'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver } from '@/lib/supabase';
import { toast } from 'sonner';
import GoogleMap from '@/components/GoogleMap';
import {
  Power, Star, Car, Clock, TrendingUp, ChevronRight,
  Shield, Trophy, Diamond, Target, Wallet,
  Navigation, BarChart3, Zap, Award, Eye, Bell,
} from 'lucide-react';

// Level system
const LEVELS = [
  { name: 'Basico', icon: Zap, minTrips: 0, color: 'from-gray-500 to-gray-400', textColor: 'text-gray-300', bgColor: 'bg-gray-500/20' },
  { name: 'Bronce', icon: Award, minTrips: 20, color: 'from-amber-700 to-amber-600', textColor: 'text-amber-500', bgColor: 'bg-amber-500/20' },
  { name: 'Plata', icon: Shield, minTrips: 50, color: 'from-gray-300 to-gray-200', textColor: 'text-gray-200', bgColor: 'bg-gray-300/20' },
  { name: 'Oro', icon: Trophy, minTrips: 100, color: 'from-yellow-500 to-amber-400', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  { name: 'Platino', icon: Diamond, minTrips: 200, color: 'from-cyan-400 to-blue-400', textColor: 'text-cyan-400', bgColor: 'bg-cyan-400/20' },
  { name: 'Diamante', icon: Diamond, minTrips: 500, color: 'from-purple-400 to-pink-400', textColor: 'text-purple-400', bgColor: 'bg-purple-400/20' },
];

function getDriverLevel(totalRides: number) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (totalRides >= l.minTrips) level = l;
  }
  return level;
}

function getNextLevel(totalRides: number) {
  for (const l of LEVELS) {
    if (totalRides < l.minTrips) return l;
  }
  return null;
}

export default function DriverHome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isOnline, setIsOnline] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayTrips, setTodayTrips] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{ day: string; amount: number }[]>([]);
  const [showFullMap, setShowFullMap] = useState(false);

  const level = getDriverLevel(driver?.total_rides || 0);
  const nextLevel = getNextLevel(driver?.total_rides || 0);
  const progressToNext = nextLevel
    ? ((driver?.total_rides || 0) / nextLevel.minTrips) * 100
    : 100;
  const rating = driver?.rating || 0;
  const dailyGoal = 75660;

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (driverData) setDriver(driverData);

      if (driverData?.id) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: todayRides } = await supabase
          .from('rides')
          .select('driver_earnings, price')
          .eq('driver_id', driverData.id)
          .in('status', ['completed'])
          .gte('created_at', today.toISOString());

        if (todayRides && todayRides.length > 0) {
          const sum = todayRides.reduce((acc, r) => acc + (r.driver_earnings || r.price * 0.85), 0);
          setTodayEarnings(sum);
          setTodayTrips(todayRides.length);
        }
      }
    } catch (err) {
      console.error('Error fetching driver home data:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-4">
      {/* Map Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative"
      >
        <div className={`${showFullMap ? 'h-[85vh]' : 'h-52'} rounded-b-3xl overflow-hidden relative transition-all duration-500`}>
          <GoogleMap
            center={{ lat: 9.9281, lng: -84.0907 }}
            zoom={14}
            showUserLocation={true}
            className="w-full h-full"
          />
          {/* Map overlay gradient */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-rida-dark to-transparent pointer-events-none" />
        </div>
        {/* Expand/collapse map button */}
        <button
          onClick={() => setShowFullMap(!showFullMap)}
          className="absolute top-3 right-3 w-9 h-9 rounded-xl glass-strong flex items-center justify-center z-10 hover:bg-white/10 transition-colors"
        >
          <Eye className="w-4 h-4 text-white" />
        </button>
      </motion.div>

      <div className="px-4 space-y-4">
        {/* Header with Level */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">
                Hola, {user?.name?.split(' ')[0] || 'Carlos'}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {isOnline ? 'Estas en linea y recibiendo viajes' : 'Conectate para recibir viajes'}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${level.bgColor}`}>
              <level.icon className={`w-3.5 h-3.5 ${level.textColor}`} />
              <span className={`text-xs font-bold ${level.textColor}`}>{level.name}</span>
            </div>
          </div>

          {/* Level Progress Bar */}
          {nextLevel && (
            <div className="mt-3 glass rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Tu nivel esta semana</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-white font-medium">{driver?.total_rides || 0}</span>
                  <span className="text-xs text-gray-500">viajes a {nextLevel.name}</span>
                </div>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progressToNext, 100)}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className={`h-2 rounded-full bg-gradient-to-r ${nextLevel.color}`}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1.5">
                Manten tu calificacion 4.85+ para subir de nivel
              </p>
              <button
                onClick={() => toast.info('Funcion de beneficios proximamente')}
                className="mt-2 w-full py-1.5 rounded-lg bg-white/5 text-xs text-gray-300 font-medium hover:bg-white/10 transition-colors"
              >
                Ver beneficios
              </button>
            </div>
          )}
        </motion.div>

        {/* Today's Earnings Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Ingresos de hoy</p>
              <p className="text-2xl font-bold text-white mt-0.5">
                ₡{Math.round(todayEarnings).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-sm font-bold text-white">{rating > 0 ? rating.toFixed(2) : '5.00'}</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">{driver?.total_rides || 0} viajes totales</p>
            </div>
          </div>
          {/* Daily Goal */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500">Objetivo diario</span>
              <span className="text-xs text-gray-400">
                ₡{Math.round(todayEarnings).toLocaleString()} / ₡{dailyGoal.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((todayEarnings / dailyGoal) * 100, 100)}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
              />
            </div>
          </div>
        </motion.div>

        {/* Opportunities Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-white">Oportunidades</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Ganancias de viajes en tu zona</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </div>
          <p className="text-xs text-gray-300 mb-3">
            Explora los mejores horarios y lugares para conducir hoy
          </p>
          {/* Mini earnings trend chart */}
          <div className="flex items-end gap-1 h-12">
            {[35, 55, 45, 70, 85, 60, 40].map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.05 }}
                className="flex-1 rounded-t-sm bg-gradient-to-t from-cyan-600 to-cyan-400 opacity-60"
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {['6am', '9am', '12m', '3pm', '6pm', '9pm', '12a'].map((t) => (
              <span key={t} className="text-[8px] text-gray-600">{t}</span>
            ))}
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-2"
        >
          <div className="glass rounded-xl p-3 text-center">
            <Car className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <p className="text-base font-bold text-white">{todayTrips}</p>
            <p className="text-[10px] text-gray-500">Viajes hoy</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <Wallet className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-base font-bold text-white">
              ₡{(driver?.total_earnings || 0) >= 1000000
                ? `${((driver?.total_earnings || 0) / 1000000).toFixed(1)}M`
                : `${Math.round((driver?.total_earnings || 0) / 1000)}k`}
            </p>
            <p className="text-[10px] text-gray-500">Total ganado</p>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-base font-bold text-white">{driver?.work_hours_today || 0}h</p>
            <p className="text-[10px] text-gray-500">Horas hoy</p>
          </div>
        </motion.div>

        {/* Connect/Disconnect Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => {
              setIsOnline(!isOnline);
              toast.success(isOnline ? 'Has pasado a fuera de linea' : 'Estas en linea! Recibiras solicitudes.');
            }}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all ${
              isOnline
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20'
            }`}
          >
            {isOnline ? (
              <>
                <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                Desconectarse
              </>
            ) : (
              <>
                <Navigation className="w-5 h-5" />
                Conectarse
              </>
            )}
          </button>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="grid grid-cols-2 gap-2"
        >
          <button
            onClick={() => router.push('/driver/earnings')}
            className="glass rounded-xl p-3 flex items-center gap-2.5 hover:bg-white/5 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-cyan-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-white">Ganancias</p>
              <p className="text-[10px] text-gray-500">Ver detalle</p>
            </div>
          </button>
          <button
            onClick={() => router.push('/driver/rides')}
            className="glass rounded-xl p-3 flex items-center gap-2.5 hover:bg-white/5 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-white">Viajes</p>
              <p className="text-[10px] text-gray-500">Historial</p>
            </div>
          </button>
          <button
            onClick={() => toast.info('Navegando con GPS...')}
            className="glass rounded-xl p-3 flex items-center gap-2.5 hover:bg-white/5 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-white">GPS</p>
              <p className="text-[10px] text-gray-500">Navegar</p>
            </div>
          </button>
          <button
            onClick={() => toast.info('Reportando incidencia...')}
            className="glass rounded-xl p-3 flex items-center gap-2.5 hover:bg-white/5 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-white">Reportar</p>
              <p className="text-[10px] text-gray-500">Incidencia</p>
            </div>
          </button>
        </motion.div>

        {/* Safety Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-3 border border-emerald-500/20"
        >
          <div className="flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-white">Tu seguridad es primero</p>
              <p className="text-[10px] text-gray-400">Boton SOS disponible en cada viaje activo</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

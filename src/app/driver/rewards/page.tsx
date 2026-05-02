'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver } from '@/lib/supabase';
import {
  Zap, Award, Shield, Trophy, Diamond, Star, Car,
  Wallet, Target, ChevronUp, Lock, CheckCircle2,
  Lightbulb, TrendingUp, Loader2, Percent, CircleDollarSign,
  Rocket, Timer, Heart, ThumbsUp, MapPin, Sparkles,
} from 'lucide-react';

// ─── Level System ─────────────────────────────────────
const LEVELS = [
  { name: 'Basico', icon: Zap, minTrips: 0, color: 'from-gray-500 to-gray-400', textColor: 'text-gray-300', bgColor: 'bg-gray-500/20', borderGlow: '' },
  { name: 'Bronce', icon: Award, minTrips: 20, color: 'from-amber-700 to-amber-600', textColor: 'text-amber-500', bgColor: 'bg-amber-500/20', borderGlow: 'shadow-amber-600/20' },
  { name: 'Plata', icon: Shield, minTrips: 50, color: 'from-gray-300 to-gray-200', textColor: 'text-gray-200', bgColor: 'bg-gray-300/20', borderGlow: 'shadow-gray-300/20' },
  { name: 'Oro', icon: Trophy, minTrips: 100, color: 'from-yellow-500 to-amber-400', textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderGlow: 'shadow-yellow-500/20' },
  { name: 'Platino', icon: Diamond, minTrips: 200, color: 'from-cyan-400 to-blue-400', textColor: 'text-cyan-400', bgColor: 'bg-cyan-400/20', borderGlow: 'shadow-cyan-400/20' },
  { name: 'Diamante', icon: Diamond, minTrips: 500, color: 'from-purple-400 to-pink-400', textColor: 'text-purple-400', bgColor: 'bg-purple-400/20', borderGlow: 'shadow-purple-400/20' },
];

// Benefits per level (fallback values)
const LEVEL_BENEFITS = [
  { commissionDiscount: 0, bonusPerRide: 0, priorityMatching: false },
  { commissionDiscount: 2, bonusPerRide: 50, priorityMatching: false },
  { commissionDiscount: 3, bonusPerRide: 100, priorityMatching: false },
  { commissionDiscount: 5, bonusPerRide: 200, priorityMatching: true },
  { commissionDiscount: 7, bonusPerRide: 350, priorityMatching: true },
  { commissionDiscount: 10, bonusPerRide: 500, priorityMatching: true },
];

// Supabase reward level type
interface RewardLevel {
  id: string;
  name: string;
  min_rides: number;
  max_rides: number | null;
  commission_discount: number;
  bonus_per_ride: number;
  priority_matching: boolean;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

// Tips data
const LEVEL_UP_TIPS = [
  { icon: Star, text: 'Mantén tu calificación arriba de 4.85', color: 'text-amber-400' },
  { icon: Car, text: 'Completa más viajes para subir de nivel', color: 'text-cyan-400' },
  { icon: ThumbsUp, text: 'Evita cancelaciones para mantener tu progreso', color: 'text-emerald-400' },
  { icon: Timer, text: 'Conduce en horarios pico para más solicitudes', color: 'text-blue-400' },
  { icon: Heart, text: 'Mantén una buena actitud con los pasajeros', color: 'text-pink-400' },
  { icon: MapPin, text: 'Conduce en zonas de alta demanda', color: 'text-orange-400' },
];

function getDriverLevel(totalRides: number) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (totalRides >= l.minTrips) level = l;
  }
  return level;
}

function getDriverLevelIndex(totalRides: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalRides >= LEVELS[i].minTrips) idx = i;
  }
  return idx;
}

function getNextLevel(totalRides: number) {
  for (const l of LEVELS) {
    if (totalRides < l.minTrips) return l;
  }
  return null;
}

function getLevelBenefits(levelIndex: number, dbLevels: RewardLevel[], totalRides: number) {
  if (dbLevels.length > 0) {
    const sorted = [...dbLevels].filter(l => l.is_active).sort((a, b) => a.min_rides - b.min_rides);
    const matching = sorted.filter(l => totalRides >= l.min_rides);
    if (matching.length > 0) {
      const current = matching[matching.length - 1];
      return {
        commissionDiscount: current.commission_discount || 0,
        bonusPerRide: current.bonus_per_ride || 0,
        priorityMatching: current.priority_matching || false,
      };
    }
  }
  return LEVEL_BENEFITS[levelIndex] || LEVEL_BENEFITS[0];
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function DriverRewards() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [dbLevels, setDbLevels] = useState<RewardLevel[]>([]);

  const totalRides = driver?.total_rides || 0;
  const rating = driver?.rating || 5.0;
  const totalEarnings = driver?.total_earnings || 0;

  const currentLevelIndex = getDriverLevelIndex(totalRides);
  const currentLevel = LEVELS[currentLevelIndex];
  const nextLevel = getNextLevel(totalRides);
  const currentBenefits = getLevelBenefits(currentLevelIndex, dbLevels, totalRides);

  const progressPercent = nextLevel
    ? ((totalRides - currentLevel.minTrips) / (nextLevel.minTrips - currentLevel.minTrips)) * 100
    : 100;

  const tripsToNext = nextLevel ? nextLevel.minTrips - totalRides : 0;

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch driver data
      const { data: driverData } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (driverData) setDriver(driverData);

      // Fetch reward levels from Supabase
      const { data: levelsData } = await supabase
        .from('reward_levels')
        .select('*')
        .eq('is_active', true)
        .order('min_rides', { ascending: true });

      if (levelsData && levelsData.length > 0) {
        setDbLevels(levelsData);
      }
    } catch (err) {
      console.error('Error fetching rewards data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando premios...</p>
        </div>
      </div>
    );
  }

  const CurrentLevelIcon = currentLevel.icon;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 space-y-4"
    >
      {/* ─── Page Header ─────────────────────────────── */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-purple-600 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Premios & Niveles</h1>
            <p className="text-xs text-gray-400">Gana beneficios por tu rendimiento</p>
          </div>
        </div>
      </motion.div>

      {/* ─── A) Current Level Card ───────────────────── */}
      <motion.div
        variants={item}
        className={`relative overflow-hidden rounded-2xl border ${
          currentLevel.borderGlow
            ? `border-white/10 shadow-lg ${currentLevel.borderGlow}`
            : 'border-white/10'
        }`}
      >
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${currentLevel.color} opacity-15`} />
        <div className="relative p-5">
          {/* Level badge + icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${currentLevel.color} flex items-center justify-center shadow-lg`}>
              <CurrentLevelIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Tu nivel actual</p>
              <p className={`text-2xl font-extrabold ${currentLevel.textColor}`}>{currentLevel.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{totalRides} viajes completados</p>
            </div>
          </div>

          {/* Progress bar to next level */}
          {nextLevel ? (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-400">Progreso a {nextLevel.name}</span>
                <span className="text-xs font-bold text-white">
                  {tripsToNext > 0 ? `${tripsToNext} viajes restantes` : 'Nivel máximo'}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progressPercent, 100)}%` }}
                  transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
                  className={`h-3 rounded-full bg-gradient-to-r ${nextLevel.color} relative`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                </motion.div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                {totalRides} / {nextLevel.minTrips} viajes
              </p>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-purple-300">Has alcanzado el nivel máximo</span>
              </div>
            </div>
          )}

          {/* Current benefits preview */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded-xl p-2.5 text-center">
              <Percent className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{currentBenefits.commissionDiscount}%</p>
              <p className="text-[9px] text-gray-500">Desc. comisión</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 text-center">
              <CircleDollarSign className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">+₡{currentBenefits.bonusPerRide}</p>
              <p className="text-[9px] text-gray-500">Bono/viaje</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2.5 text-center">
              <Rocket className={`w-3.5 h-3.5 mx-auto mb-1 ${currentBenefits.priorityMatching ? 'text-cyan-400' : 'text-gray-500'}`} />
              <p className={`text-sm font-bold ${currentBenefits.priorityMatching ? 'text-white' : 'text-gray-500'}`}>
                {currentBenefits.priorityMatching ? 'Si' : 'No'}
              </p>
              <p className="text-[9px] text-gray-500">Prioridad</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── D) Stats Summary ────────────────────────── */}
      <motion.div variants={item} className="grid grid-cols-2 gap-2">
        <div className="glass rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Car className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] text-gray-500">Total viajes</span>
          </div>
          <p className="text-xl font-bold text-white">{totalRides}</p>
        </div>
        <div className="glass rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-[10px] text-gray-500">Rating promedio</span>
          </div>
          <p className="text-xl font-bold text-white">{rating > 0 ? rating.toFixed(2) : '\u2014'}</p>
        </div>
        <div className="glass rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] text-gray-500">Ganancias totales</span>
          </div>
          <p className="text-lg font-bold text-white">
            ₡{totalEarnings >= 1000000
              ? `${(totalEarnings / 1000000).toFixed(1)}M`
              : `${Math.round(totalEarnings / 1000)}k`}
          </p>
        </div>
        <div className="glass rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <ChevronUp className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] text-gray-500">Para siguiente nivel</span>
          </div>
          <p className="text-xl font-bold text-white">
            {tripsToNext > 0 ? tripsToNext : '—'}
          </p>
        </div>
      </motion.div>

      {/* ─── C) Level Benefits Detail ────────────────── */}
      <motion.div variants={item} className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${currentLevel.color} flex items-center justify-center`}>
            <CurrentLevelIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Beneficios: {currentLevel.name}</h2>
            <p className="text-[10px] text-gray-500">Tu nivel actual otorga estos beneficios</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {/* Commission */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Percent className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">Comisión reducida</p>
                <p className="text-[10px] text-gray-500">Normal es 15%</p>
              </div>
            </div>
            <span className={`text-sm font-bold ${currentBenefits.commissionDiscount > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
              {15 - currentBenefits.commissionDiscount}%
            </span>
          </div>
          {/* Bonus per ride */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <CircleDollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">Bono por viaje</p>
                <p className="text-[10px] text-gray-500">Por cada viaje completado</p>
              </div>
            </div>
            <span className={`text-sm font-bold ${currentBenefits.bonusPerRide > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
              {currentBenefits.bonusPerRide > 0 ? `+₡${currentBenefits.bonusPerRide}` : '—'}
            </span>
          </div>
          {/* Priority matching */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentBenefits.priorityMatching ? 'bg-cyan-500/15' : 'bg-white/5'}`}>
                <Rocket className={`w-4 h-4 ${currentBenefits.priorityMatching ? 'text-cyan-400' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-white">Preferencia en matching</p>
                <p className="text-[10px] text-gray-500">Recibe solicitudes antes</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              currentBenefits.priorityMatching
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-white/5 text-gray-500'
            }`}>
              {currentBenefits.priorityMatching ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ─── B) All Levels Ladder ────────────────────── */}
      <motion.div variants={item} className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-bold text-white">Todos los Niveles</span>
        </div>

        <div className="relative">
          {/* Vertical line connecting levels */}
          <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-white/10" />

          <div className="space-y-1">
            {LEVELS.map((level, index) => {
              const isCurrentLevel = index === currentLevelIndex;
              const isCompleted = index < currentLevelIndex;
              const isLocked = index > currentLevelIndex;
              const LevelIcon = level.icon;
              const levelBenefits = getLevelBenefits(index, dbLevels, level.minTrips);

              return (
                <motion.div
                  key={level.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.08 }}
                  className={`relative flex items-start gap-3 p-3 rounded-xl transition-all ${
                    isCurrentLevel
                      ? `bg-gradient-to-r ${level.bgColor} border border-white/10 shadow-lg ${level.borderGlow || ''}`
                      : isCompleted
                        ? 'opacity-70 hover:opacity-100'
                        : isLocked
                          ? 'opacity-40'
                          : 'hover:bg-white/5'
                  }`}
                >
                  {/* Level icon circle */}
                  <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isCurrentLevel
                      ? `bg-gradient-to-br ${level.color} shadow-lg`
                      : isCompleted
                        ? 'bg-emerald-500/20'
                        : isLocked
                          ? 'bg-white/5'
                          : 'bg-white/10'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : isLocked ? (
                      <Lock className="w-4 h-4 text-gray-500" />
                    ) : (
                      <LevelIcon className="w-5 h-5 text-white" />
                    )}
                  </div>

                  {/* Level info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold ${
                        isCurrentLevel
                          ? level.textColor
                          : isLocked
                            ? 'text-gray-500'
                            : 'text-gray-300'
                      }`}>
                        {level.name}
                      </p>
                      {isCurrentLevel && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r ${level.color} text-white`}>
                          ACTUAL
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          COMPLETADO
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {level.minTrips} viajes mínimo
                    </p>

                    {/* Mini benefits row */}
                    <div className="flex items-center gap-3 mt-1.5">
                      {levelBenefits.commissionDiscount > 0 && (
                        <span className={`text-[10px] font-medium ${isLocked ? 'text-gray-600' : 'text-emerald-400'}`}>
                          -{levelBenefits.commissionDiscount}% comisión
                        </span>
                      )}
                      {levelBenefits.bonusPerRide > 0 && (
                        <span className={`text-[10px] font-medium ${isLocked ? 'text-gray-600' : 'text-amber-400'}`}>
                          +₡{levelBenefits.bonusPerRide}/viaje
                        </span>
                      )}
                      {levelBenefits.priorityMatching && (
                        <span className={`text-[10px] font-medium ${isLocked ? 'text-gray-600' : 'text-cyan-400'}`}>
                          Prioridad
                        </span>
                      )}
                      {!levelBenefits.commissionDiscount && !levelBenefits.bonusPerRide && !levelBenefits.priorityMatching && (
                        <span className="text-[10px] text-gray-600">Sin beneficios especiales</span>
                      )}
                    </div>
                  </div>

                  {/* Right arrow or status */}
                  <div className="flex-shrink-0 pt-1">
                    {isCurrentLevel && (
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${level.color} animate-pulse`} />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ─── E) Tips to Level Up ─────────────────────── */}
      <motion.div variants={item} className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-white">Tips para Subir de Nivel</span>
        </div>
        <div className="space-y-2">
          {LEVEL_UP_TIPS.map((tip, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.06 }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/8 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <tip.icon className={`w-3.5 h-3.5 ${tip.color}`} />
              </div>
              <p className="text-xs text-gray-300">{tip.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ─── Bottom spacing ──────────────────────────── */}
      <div className="h-4" />
    </motion.div>
  );
}

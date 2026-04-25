'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Star, Medal, Plus, Save, Loader2, Award,
  ChevronDown, ChevronUp, Trash2, AlertTriangle, X,
  ArrowLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface RewardLevel {
  id: string;
  name: string;
  description: string;
  level_type: 'silver' | 'gold' | 'platinum' | 'diamond';
  is_active: boolean;
  min_trips: number;
  min_rating: number;
  max_cancellation_rate: number;
  min_acceptance_rate: number;
  reward_multiplier: number;
  bonus_per_ride: number;
  created_at: string;
  updated_at: string;
  saving?: boolean;
}

const levelConfig: Record<string, {
  gradient: string;
  headerBg: string;
  headerBorder: string;
  textAccent: string;
  starColor: string;
  medalColor: string;
  label: string;
}> = {
  silver: {
    gradient: 'from-gray-500/20 to-gray-400/20',
    headerBg: 'from-gray-500/30 to-gray-600/20',
    headerBorder: 'border-gray-500/30',
    textAccent: 'text-gray-400',
    starColor: 'text-gray-400',
    medalColor: 'text-gray-300',
    label: 'Silver',
  },
  gold: {
    gradient: 'from-amber-500/20 to-yellow-400/20',
    headerBg: 'from-amber-500/30 to-yellow-500/20',
    headerBorder: 'border-amber-500/30',
    textAccent: 'text-amber-400',
    starColor: 'text-amber-400',
    medalColor: 'text-amber-300',
    label: 'Gold',
  },
  platinum: {
    gradient: 'from-cyan-500/20 to-blue-400/20',
    headerBg: 'from-cyan-500/30 to-blue-500/20',
    headerBorder: 'border-cyan-500/30',
    textAccent: 'text-cyan-400',
    starColor: 'text-cyan-400',
    medalColor: 'text-cyan-300',
    label: 'Platinum',
  },
  diamond: {
    gradient: 'from-violet-500/20 to-purple-400/20',
    headerBg: 'from-violet-500/30 to-purple-500/20',
    headerBorder: 'border-violet-500/30',
    textAccent: 'text-violet-400',
    starColor: 'text-violet-400',
    medalColor: 'text-violet-300',
    label: 'Diamond',
  },
};

const emptyLevel = (): Omit<RewardLevel, 'id' | 'created_at' | 'updated_at'> => ({
  name: '',
  description: '',
  level_type: 'silver',
  is_active: true,
  min_trips: 0,
  min_rating: 4.0,
  max_cancellation_rate: 10.0,
  min_acceptance_rate: 80.0,
  reward_multiplier: 1.0,
  bonus_per_ride: 0,
});

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-4 w-96 max-w-full bg-white/5 rounded-lg animate-pulse" />
        </div>
        <div className="h-7 w-32 bg-white/5 rounded-full animate-pulse" />
      </div>
      {/* Button skeleton */}
      <div className="h-12 w-40 bg-white/5 rounded-xl animate-pulse" />
      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-5 w-28 bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-5 w-16 bg-white/5 rounded-full animate-pulse" />
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-white/5 animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
                    <div className="h-9 bg-white/5 rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
              <div className="flex gap-3">
                <div className="flex-1 h-10 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-10 w-10 bg-white/5 rounded-xl animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RewardsPage() {
  const [levels, setLevels] = useState<RewardLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<RewardLevel | null>(null);

  const loadLevels = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reward_levels')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Error al cargar niveles de recompensa');
      console.error(error);
    } else {
      setLevels(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLevels();
  }, [loadLevels]);

  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateLevel = (id: string, field: keyof RewardLevel, value: any) => {
    setLevels(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const saveLevel = async (level: RewardLevel) => {
    setLevels(prev => prev.map(l => l.id === level.id ? { ...l, saving: true } : l));
    try {
      const payload = {
        name: level.name,
        description: level.description,
        level_type: level.level_type,
        is_active: level.is_active,
        min_trips: level.min_trips,
        min_rating: level.min_rating,
        max_cancellation_rate: level.max_cancellation_rate,
        min_acceptance_rate: level.min_acceptance_rate,
        reward_multiplier: level.reward_multiplier,
        bonus_per_ride: level.bonus_per_ride,
      };

      const { error } = await supabase
        .from('reward_levels')
        .update(payload)
        .eq('id', level.id);

      if (error) throw error;
      toast.success(`Nivel "${level.name}" guardado correctamente`);
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar nivel');
    } finally {
      setLevels(prev => prev.map(l => l.id === level.id ? { ...l, saving: false } : l));
    }
  };

  const createLevel = async () => {
    try {
      const newLevelData = emptyLevel();
      const { data, error } = await supabase
        .from('reward_levels')
        .insert(newLevelData)
        .select()
        .single();

      if (error) throw error;
      setLevels(prev => [...prev, { ...data, saving: false }]);
      setExpandedCards(prev => new Set([...prev, data.id]));
      toast.success('Nuevo nivel creado');
    } catch (err: any) {
      toast.error(err.message || 'Error al crear nivel');
    }
  };

  const deleteLevel = async (level: RewardLevel) => {
    try {
      const { error } = await supabase
        .from('reward_levels')
        .delete()
        .eq('id', level.id);

      if (error) throw error;
      setLevels(prev => prev.filter(l => l.id !== level.id));
      toast.success(`Nivel "${level.name}" eliminado`);
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar nivel');
    }
  };

  const formatColones = (val: number) => `₡${Math.round(val).toLocaleString()}`;



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Configuracion de Recompensas</h1>
          <p className="text-gray-400 mt-1">Admin puede definir la duracion y criterios para las campanas de recompensas de conductores</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-500 hidden sm:inline">Niveles Activos:</span>
          <span className="glass rounded-full px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            {levels.filter(l => l.is_active).length} de {levels.length}
          </span>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Panel
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-white font-medium">Recompensas</span>
      </div>

      {/* Loading Skeleton */}
      {loading && <LoadingSkeleton />}

      {/* Create Button */}
      <motion.button
        type="button"
        onClick={createLevel}
        className="w-full sm:w-auto py-3 px-6 rounded-xl btn-neon text-white font-semibold text-sm flex items-center justify-center gap-2"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Plus className="w-4 h-4" />
        CREAR NIVEL
      </motion.button>

      {/* Reward Level Cards Grid */}
      {!loading && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {levels.map((level, index) => {
            const config = levelConfig[level.level_type] || levelConfig.silver;
            const isExpanded = expandedCards.has(level.id);

            return (
              <motion.div
                key={level.id}
                className={`glass rounded-2xl overflow-hidden border ${config.headerBorder}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.08 }}
              >
                {/* Card Header */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(level.id)}
                  className={`w-full bg-gradient-to-r ${config.headerBg} p-4 flex items-center justify-between cursor-pointer`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                      <Star className={`w-5 h-5 ${config.starColor}`} />
                    </div>
                    <div className="text-left">
                      <h3 className={`text-lg font-bold ${config.textAccent}`}>{level.name || 'Sin nombre'}</h3>
                      <p className="text-xs text-gray-500">{config.label} Nivel</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      level.is_active
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-gray-500/20 text-gray-500'
                    }`}>
                      {level.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Card Body */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 space-y-5">
                        {/* Medal Icon */}
                        <div className="flex justify-center">
                          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center border border-white/10`}>
                            <Medal className={`w-8 h-8 ${config.medalColor}`} />
                          </div>
                        </div>

                        {/* Form Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Name */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Nombre</label>
                            <input
                              type="text"
                              value={level.name}
                              onChange={e => updateLevel(level.id, 'name', e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                              placeholder="Nombre del nivel"
                            />
                          </div>

                          {/* Level Type */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Tipo de Nivel</label>
                            <select
                              value={level.level_type}
                              onChange={e => updateLevel(level.id, 'level_type', e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none"
                            >
                              <option value="silver" className="bg-[#111827] text-white">Silver</option>
                              <option value="gold" className="bg-[#111827] text-white">Gold</option>
                              <option value="platinum" className="bg-[#111827] text-white">Platinum</option>
                              <option value="diamond" className="bg-[#111827] text-white">Diamond</option>
                            </select>
                          </div>

                          {/* Description */}
                          <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-xs font-medium text-gray-400">Descripcion</label>
                            <input
                              type="text"
                              value={level.description}
                              onChange={e => updateLevel(level.id, 'description', e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                              placeholder="Descripcion del nivel"
                            />
                          </div>

                          {/* Status */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Estado</label>
                            <select
                              value={level.is_active ? 'active' : 'inactive'}
                              onChange={e => updateLevel(level.id, 'is_active', e.target.value === 'active')}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none"
                            >
                              <option value="active" className="bg-[#111827] text-white">Activo</option>
                              <option value="inactive" className="bg-[#111827] text-white">Inactivo</option>
                            </select>
                          </div>

                          {/* Min Trips */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Viajes Minimos</label>
                            <input
                              type="number"
                              value={level.min_trips}
                              onChange={e => updateLevel(level.id, 'min_trips', Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                              min={0}
                            />
                          </div>

                          {/* Min Rating */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Rating Minimo</label>
                            <input
                              type="number"
                              value={level.min_rating}
                              onChange={e => updateLevel(level.id, 'min_rating', Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                              min={0}
                              max={5}
                              step={0.1}
                            />
                          </div>

                          {/* Max Cancellation Rate */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Tasa Cancelacion Max %</label>
                            <input
                              type="number"
                              value={level.max_cancellation_rate}
                              onChange={e => updateLevel(level.id, 'max_cancellation_rate', Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                              min={0}
                              max={100}
                              step={0.5}
                            />
                          </div>

                          {/* Min Acceptance Rate */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Tasa Aceptacion Min %</label>
                            <input
                              type="number"
                              value={level.min_acceptance_rate}
                              onChange={e => updateLevel(level.id, 'min_acceptance_rate', Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                              min={0}
                              max={100}
                              step={0.5}
                            />
                          </div>

                          {/* Reward Multiplier */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Multiplicador Recompensa</label>
                            <input
                              type="number"
                              value={level.reward_multiplier}
                              onChange={e => updateLevel(level.id, 'reward_multiplier', Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                              min={1}
                              step={0.05}
                            />
                          </div>

                          {/* Bonus per Ride */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400">Bonus por Viaje</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">₡</span>
                              <input
                                type="number"
                                value={level.bonus_per_ride}
                                onChange={e => updateLevel(level.id, 'bonus_per_ride', Number(e.target.value))}
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                                min={0}
                                step={50}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Summary */}
                        <div className={`bg-gradient-to-r ${config.gradient} rounded-xl p-3`}>
                          <div className="flex items-center gap-2 mb-2">
                            <Trophy className={`w-4 h-4 ${config.textAccent}`} />
                            <span className="text-xs font-medium text-gray-300">Resumen de Nivel</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">Viajes:</span>{' '}
                              <span className="text-white font-medium">{level.min_trips.toLocaleString()}+</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Rating:</span>{' '}
                              <span className="text-white font-medium">{Number(level.min_rating).toFixed(1)}+</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Bonus:</span>{' '}
                              <span className={`font-medium ${config.textAccent}`}>{formatColones(level.bonus_per_ride)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Multiplier:</span>{' '}
                              <span className={`font-medium ${config.textAccent}`}>{level.reward_multiplier}x</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => saveLevel(level)}
                            disabled={level.saving}
                            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-cyan-500/20 transition-all"
                          >
                            {level.saving ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                            ) : (
                              <><Save className="w-4 h-4" /> Guardar</>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(level)}
                            className="py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      )}

      {levels.length === 0 && (
        <motion.div
          className="glass rounded-2xl p-12 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Award className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No hay niveles de recompensa creados</p>
          <p className="text-gray-600 text-xs mt-1">Haz clic en &quot;CREAR NIVEL&quot; para agregar uno</p>
        </motion.div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-sm z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Eliminar Nivel</h2>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-300">
                    ¿Estas seguro de eliminar este nivel?
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="text-white font-medium">{deleteConfirm.name || 'Sin nombre'}</span> — Esta accion no se puede deshacer.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteLevel(deleteConfirm);
                    setDeleteConfirm(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

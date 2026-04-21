'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Search, Plus, Edit2, Trash2, Loader2, X,
  ChevronDown, Filter, ToggleLeft, ToggleRight, MapPinned, Crosshair
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface LocationArea {
  id: string;
  name: string;
  area_type: 'restriction' | 'surge_zone' | 'hotspot' | 'service_area' | 'airport_zone';
  country: string;
  coordinates: string; // JSON string of [[lat,lng],...]
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

type AreaTypeFilter = 'todos' | 'restriction' | 'surge_zone' | 'hotspot' | 'service_area' | 'airport_zone';
type StatusFilter = 'todos' | 'activas' | 'inactivas';

const areaTypeLabels: Record<string, string> = {
  restriction: 'Zona Restringida',
  surge_zone: 'Zona Surge',
  hotspot: 'Zona Popular',
  service_area: 'Area de Servicio',
  airport_zone: 'Zona Aeropuerto',
};

const areaTypeColors: Record<string, { bg: string; text: string; dot: string }> = {
  restriction: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400' },
  surge_zone: { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400' },
  hotspot: { bg: 'bg-orange-500/15', text: 'text-orange-400', dot: 'bg-orange-400' },
  service_area: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  airport_zone: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', dot: 'bg-cyan-400' },
};

interface CoordPair {
  lat: string;
  lng: string;
}

function parseCoords(jsonStr: string): CoordPair[] {
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map((c: any) => ({
        lat: String(c[0] ?? ''),
        lng: String(c[1] ?? ''),
      }));
    }
  } catch {
    // ignore
  }
  return [];
}

function stringifyCoords(pairs: CoordPair[]): string {
  return JSON.stringify(pairs.map(p => [Number(p.lat) || 0, Number(p.lng) || 0]));
}

const emptyArea = (): Omit<LocationArea, 'id' | 'created_at' | 'updated_at'> => ({
  name: '',
  area_type: 'service_area',
  country: 'Costa Rica',
  coordinates: '[]',
  is_active: true,
  notes: '',
});

export default function LocationsPage() {
  const [areas, setAreas] = useState<LocationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AreaTypeFilter>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingArea, setEditingArea] = useState<LocationArea | null>(null);
  const [formData, setFormData] = useState(emptyArea());
  const [coords, setCoords] = useState<CoordPair[]>([]);
  const [formSaving, setFormSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadAreas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('location_areas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar areas geograficas');
      console.error(error);
    } else {
      setAreas(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  const filteredAreas = areas.filter(area => {
    const matchSearch = !search || area.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'todos' || area.area_type === typeFilter;
    const matchStatus = statusFilter === 'todos' ||
      (statusFilter === 'activas' && area.is_active) ||
      (statusFilter === 'inactivas' && !area.is_active);
    return matchSearch && matchType && matchStatus;
  });

  const openCreateModal = () => {
    setEditingArea(null);
    setFormData(emptyArea());
    setCoords([]);
    setShowModal(true);
  };

  const openEditModal = (area: LocationArea) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      area_type: area.area_type,
      country: area.country || 'Costa Rica',
      coordinates: area.coordinates,
      is_active: area.is_active,
      notes: area.notes || '',
    });
    setCoords(parseCoords(area.coordinates));
    setShowModal(true);
  };

  const addCoordPair = () => {
    setCoords(prev => [...prev, { lat: '', lng: '' }]);
  };

  const removeCoordPair = (index: number) => {
    setCoords(prev => prev.filter((_, i) => i !== index));
  };

  const updateCoord = (index: number, field: 'lat' | 'lng', value: string) => {
    setCoords(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        name: formData.name,
        area_type: formData.area_type,
        country: formData.country,
        coordinates: stringifyCoords(coords),
        is_active: formData.is_active,
        notes: formData.notes,
      };

      if (editingArea) {
        const { error } = await supabase
          .from('location_areas')
          .update(payload)
          .eq('id', editingArea.id);
        if (error) throw error;
        toast.success('Area actualizada');
      } else {
        const { error } = await supabase
          .from('location_areas')
          .insert(payload);
        if (error) throw error;
        toast.success('Area creada');
      }
      setShowModal(false);
      loadAreas();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setFormSaving(false);
    }
  };

  const toggleActive = async (area: LocationArea) => {
    try {
      const { error } = await supabase
        .from('location_areas')
        .update({ is_active: !area.is_active })
        .eq('id', area.id);
      if (error) throw error;
      toast.success(`"${area.name}" ${area.is_active ? 'desactivada' : 'activada'}`);
      loadAreas();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar estado');
    }
  };

  const deleteArea = async (id: string) => {
    try {
      const { error } = await supabase
        .from('location_areas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Area eliminada');
      setDeleteConfirm(null);
      loadAreas();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  const getCoordCount = (jsonStr: string): number => {
    return parseCoords(jsonStr).length;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
        <p className="text-sm">Cargando areas geograficas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Areas Geograficas</h1>
        <p className="text-gray-400 mt-1">Gestion de zonas de servicio, restricciones y areas especiales</p>
      </div>

      {/* Filters */}
      <motion.div
        className="glass rounded-2xl p-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar area por nombre..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as AreaTypeFilter)}
              className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-8 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[160px]"
            >
              <option value="todos" className="bg-[#111827]">Todos</option>
              <option value="restriction" className="bg-[#111827]">Restriccion</option>
              <option value="surge_zone" className="bg-[#111827]">Zona Surge</option>
              <option value="hotspot" className="bg-[#111827]">Hotspot</option>
              <option value="service_area" className="bg-[#111827]">Area Servicio</option>
              <option value="airport_zone" className="bg-[#111827]">Zona Aeropuerto</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer min-w-[130px]"
            >
              <option value="todos" className="bg-[#111827]">Todos</option>
              <option value="activas" className="bg-[#111827]">Activas</option>
              <option value="inactivas" className="bg-[#111827]">Inactivas</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Create Button */}
          <button
            type="button"
            onClick={openCreateModal}
            className="py-2.5 px-5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center gap-2 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            CREAR AREA
          </button>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Nombre</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Tipo</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Coordenadas</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Estado</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Creado</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAreas.map((area, i) => {
                const typeColor = areaTypeColors[area.area_type] || areaTypeColors.service_area;

                return (
                  <motion.tr
                    key={area.id}
                    className="hover:bg-white/[0.02] transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${typeColor.bg} flex items-center justify-center flex-shrink-0`}>
                          <MapPinned className={`w-4 h-4 ${typeColor.text}`} />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-white">{area.name}</span>
                          {area.country && (
                            <p className="text-[10px] text-gray-600">{area.country}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${typeColor.bg} ${typeColor.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${typeColor.dot}`} />
                        {areaTypeLabels[area.area_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className="text-xs text-gray-400">{getCoordCount(area.coordinates)} puntos</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(area)}
                        className="inline-flex items-center"
                      >
                        {area.is_active ? (
                          <ToggleRight className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-500" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-gray-500">{formatDate(area.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(area)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {deleteConfirm === area.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => deleteArea(area.id)}
                              className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(null)}
                              className="text-[10px] px-2 py-1 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(area.id)}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredAreas.length === 0 && (
          <div className="p-12 text-center">
            <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No se encontraron areas geograficas</p>
          </div>
        )}
      </motion.div>

      {/* ===================== FORM MODAL ===================== */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
            <motion.div
              className="relative glass-strong rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">
                  {editingArea ? 'Editar Area' : 'Crear Area'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Nombre *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="Nombre del area"
                  />
                </div>

                {/* Area Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Tipo de Area</label>
                  <select
                    value={formData.area_type}
                    onChange={e => setFormData(prev => ({ ...prev, area_type: e.target.value as any }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none"
                  >
                    <option value="service_area" className="bg-[#111827]">Area de Servicio</option>
                    <option value="restriction" className="bg-[#111827]">Zona Restringida</option>
                    <option value="surge_zone" className="bg-[#111827]">Zona Surge</option>
                    <option value="hotspot" className="bg-[#111827]">Zona Popular</option>
                    <option value="airport_zone" className="bg-[#111827]">Zona Aeropuerto</option>
                  </select>
                </div>

                {/* Country */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Pais</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    placeholder="Costa Rica"
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                  <div>
                    <p className="text-sm text-white font-medium">Estado Activo</p>
                    <p className="text-xs text-gray-500">El area estara disponible para el sistema</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                      formData.is_active ? 'bg-cyan-500' : 'bg-white/10'
                    }`}
                  >
                    <motion.div
                      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                      animate={{ left: formData.is_active ? 'calc(100% - 22px)' : '2px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                    placeholder="Notas adicionales..."
                  />
                </div>

                {/* Coordinates Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-cyan-400" />
                      <label className="text-sm font-medium text-white">Coordenadas</label>
                    </div>
                    <button
                      type="button"
                      onClick={addCoordPair}
                      className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Agregar punto
                    </button>
                  </div>

                  {coords.length === 0 ? (
                    <div className="bg-white/[0.03] rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-500">No hay coordenadas. Haz clic en &quot;Agregar punto&quot; para iniciar.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {coords.map((coord, idx) => (
                        <motion.div
                          key={idx}
                          className="flex items-center gap-2"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                        >
                          <span className="text-[10px] text-gray-600 w-5 text-right flex-shrink-0">{idx + 1}.</span>
                          <input
                            type="text"
                            value={coord.lat}
                            onChange={e => updateCoord(idx, 'lat', e.target.value)}
                            placeholder="Lat (ej: 9.9281)"
                            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                          />
                          <input
                            type="text"
                            value={coord.lng}
                            onChange={e => updateCoord(idx, 'lng', e.target.value)}
                            placeholder="Lng (ej: -84.0907)"
                            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => removeCoordPair(idx)}
                            className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={formSaving}
                  className="flex-1 py-2.5 rounded-xl btn-neon text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {formSaving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  ) : (
                    <>{editingArea ? 'Actualizar' : 'Crear'}</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

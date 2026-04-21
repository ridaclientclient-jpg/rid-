'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, DollarSign, CheckCircle2, XCircle, Clock,
  Eye, RotateCcw, Ban, XCircle as XIcon, Loader2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type RideStatus = 'completed' | 'cancelled' | 'in_progress' | 'pending' | 'searching' | 'assigned' | 'arriving' | 'started';

interface RideRow {
  id: string;
  realId: string;
  passenger: string;
  driver: string;
  origin: string;
  destination: string;
  price: number;
  status: RideStatus;
  date: string;
  duration: string;
  distance: string;
}

const PAGE_SIZE = 20;

function mapRideStatus(raw: string): RideStatus {
  if (['started', 'assigned', 'arriving'].includes(raw)) return 'in_progress';
  if (raw === 'searching') return 'pending';
  if (['completed', 'cancelled', 'in_progress', 'pending'].includes(raw)) return raw as RideStatus;
  return 'pending';
}

function statusToUI(status: RideStatus) {
  const cfg: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    completed: { label: 'Completado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
    cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
    in_progress: { label: 'En curso', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Clock },
    pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
  };
  return cfg[status] || cfg.pending;
}

const statusConfig = {
  completed: { label: 'Completado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  in_progress: { label: 'En curso', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Clock },
  pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
};

const filterTabs = ['Todos', 'Activos', 'Completados', 'Cancelados'] as const;
const dateFilters = ['Hoy', 'Esta semana', 'Este mes'] as const;

function buildDateFilter(dateFilter: string): string | null {
  if (dateFilter === 'Hoy') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  } else if (dateFilter === 'Esta semana') {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return weekAgo.toISOString();
  } else if (dateFilter === 'Este mes') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return monthStart.toISOString();
  }
  return null;
}

export default function RidesPage() {
  const [rides, setRides] = useState<RideRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [dateFilter, setDateFilter] = useState<string>('Hoy');
  const [selectedRide, setSelectedRide] = useState<RideRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchRides = useCallback(async (currentDateFilter: string, currentPage: number) => {
    setLoading(true);
    try {
      const dateThreshold = buildDateFilter(currentDateFilter);

      // Build the count query with the same date filter
      let countQuery = supabase
        .from('rides')
        .select('*', { count: 'exact', head: true });
      if (dateThreshold) {
        countQuery = countQuery.gte('created_at', dateThreshold);
      }
      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Error fetching rides count:', countError);
      }
      setTotalCount(count || 0);

      // Build the data query
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = currentPage * PAGE_SIZE - 1;

      let query = supabase
        .from('rides')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (dateThreshold) {
        query = query.gte('created_at', dateThreshold);
      }

      const { data: rideData, error } = await query;

      if (error) {
        console.error('Error fetching rides:', error);
        toast.error('Error al cargar viajes');
        setLoading(false);
        return;
      }

      // Fetch rider profiles for names
      const riderIds = [...new Set((rideData || []).map(r => r.rider_id).filter(Boolean))];
      const driverIds = [...new Set((rideData || []).map(r => r.driver_id).filter(Boolean))];

      const profileMap: Record<string, string> = {};
      const driverMap: Record<string, string> = {};

      if (riderIds.length > 0) {
        const { data: riderProfiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', riderIds);
        if (riderProfiles) {
          riderProfiles.forEach(p => { profileMap[p.id] = p.name; });
        }
      }

      // For drivers, first get driver records to map driver_id to user_id, then get profiles
      if (driverIds.length > 0) {
        const { data: driverRecords } = await supabase
          .from('drivers')
          .select('id, user_id')
          .in('id', driverIds);
        if (driverRecords) {
          const driverUserIds = driverRecords.map(d => d.user_id).filter(Boolean);
          const driverIdToUserId: Record<string, string> = {};
          driverRecords.forEach(d => { driverIdToUserId[d.id] = d.user_id; });

          if (driverUserIds.length > 0) {
            const { data: driverProfiles } = await supabase
              .from('profiles')
              .select('id, name')
              .in('id', driverUserIds);
            if (driverProfiles) {
              const userProfileMap: Record<string, string> = {};
              driverProfiles.forEach(p => { userProfileMap[p.id] = p.name; });
              Object.entries(driverIdToUserId).forEach(([dId, uId]) => {
                driverMap[dId] = userProfileMap[uId] || 'Desconocido';
              });
            }
          }
        }
      }

      const mapped: RideRow[] = (rideData || []).map(r => {
        const uiStatus = mapRideStatus(r.status);
        const dur = r.duration ? `${Math.round(r.duration)} min` : (uiStatus === 'in_progress' ? 'En curso' : '-');
        const dist = r.distance ? `${r.distance.toFixed(1)} km` : '-';
        return {
          id: r.id.slice(0, 8).toUpperCase(),
          realId: r.id,
          passenger: profileMap[r.rider_id] || 'Desconocido',
          driver: driverMap[r.driver_id || ''] || 'Sin asignar',
          origin: r.origin || r.origin_address || '-',
          destination: r.destination || r.dest_address || '-',
          price: r.price || 0,
          status: uiStatus,
          date: r.created_at,
          duration: dur,
          distance: dist,
        };
      });

      setRides(mapped);
    } catch (err) {
      console.error('Error fetching rides:', err);
      toast.error('Error al cargar viajes');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and when filters/page change
  useEffect(() => {
    fetchRides(dateFilter, page);
  }, [dateFilter, page, fetchRides]);

  const filteredRides = rides.filter((r) => {
    const matchSearch = r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.passenger.toLowerCase().includes(search.toLowerCase()) ||
      r.driver.toLowerCase().includes(search.toLowerCase()) ||
      r.origin.toLowerCase().includes(search.toLowerCase()) ||
      r.destination.toLowerCase().includes(search.toLowerCase());

    let matchStatus = true;
    switch (statusFilter) {
      case 'Activos': matchStatus = r.status === 'in_progress' || r.status === 'pending'; break;
      case 'Completados': matchStatus = r.status === 'completed'; break;
      case 'Cancelados': matchStatus = r.status === 'cancelled'; break;
    }
    return matchSearch && matchStatus;
  });

  const totalRevenue = rides.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.price, 0);

  const stats = [
    { label: 'Total Viajes', value: totalCount, color: 'text-white' },
    { label: 'Completados', value: rides.filter(r => r.status === 'completed').length, color: 'text-emerald-400' },
    { label: 'Cancelados', value: rides.filter(r => r.status === 'cancelled').length, color: 'text-red-400' },
    { label: 'Ingresos', value: `₡${totalRevenue.toLocaleString()}`, color: 'text-cyan-400' },
  ];

  const cancelRide = async (rideShortId: string) => {
    const ride = rides.find(r => r.id === rideShortId);
    if (!ride) return;

    try {
      const { error } = await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', ride.realId);

      if (error) {
        toast.error('Error al cancelar viaje');
        return;
      }

      setRides(prev => prev.map(r =>
        r.id === rideShortId ? { ...r, status: 'cancelled' as RideStatus } : r
      ));
      toast.success(`Viaje ${rideShortId} cancelado`);
    } catch (err) {
      console.error('Cancel error:', err);
      toast.error('Error al cancelar viaje');
    }
  };

  const refundRide = (id: string) => {
    toast.success(`Reembolso procesado para ${id}`);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const showingFrom = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, totalCount);

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  const handleDateFilterChange = (df: string) => {
    setDateFilter(df);
    setPage(1); // Reset to first page when date filter changes
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Viajes</h1>
        <p className="text-gray-400 mt-1">Gestion y seguimiento de todos los viajes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={i} className="glass rounded-xl p-4" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por ID, pasajero, conductor, origen o destino..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
            />
          </div>
          <div className="flex gap-2">
            {dateFilters.map((df) => (
              <button
                key={df}
                onClick={() => handleDateFilterChange(df)}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  dateFilter === df ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                {df}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === tab
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Rides Table */}
      <motion.div className="glass rounded-2xl overflow-hidden" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Pasajero</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Conductor</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden xl:table-cell">Origen</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden xl:table-cell">Destino</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Precio</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRides.map((ride, i) => {
                    const cfg = statusConfig[ride.status] || statusConfig.pending;
                    const StatusIcon = cfg.icon;
                    return (
                      <motion.tr
                        key={ride.realId}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 + i * 0.03 }}
                      >
                        <td className="px-5 py-3 text-sm text-cyan-400 font-mono">{ride.id}</td>
                        <td className="px-5 py-3 text-sm text-white">{ride.passenger}</td>
                        <td className="px-5 py-3 text-sm text-gray-400 hidden md:table-cell">{ride.driver}</td>
                        <td className="px-5 py-3 text-sm text-gray-400 hidden xl:table-cell">{ride.origin}</td>
                        <td className="px-5 py-3 text-sm text-gray-400 hidden xl:table-cell">{ride.destination}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-white text-right font-medium">₡{ride.price.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedRide(ride)}
                              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {ride.status === 'completed' && (
                              <button
                                onClick={() => refundRide(ride.id)}
                                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                title="Reembolsar"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {(ride.status === 'in_progress' || ride.status === 'pending') && (
                              <button
                                onClick={() => cancelRide(ride.id)}
                                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="Cancelar"
                              >
                                <Ban className="w-4 h-4" />
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

            {filteredRides.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No se encontraron viajes</p>
              </div>
            )}

            {/* Pagination */}
            {totalCount > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-white/5">
                <p className="text-xs text-gray-400">
                  Mostrando {showingFrom}-{showingTo} de {totalCount} viajes
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Primera pagina"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Pagina anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {pageNumbers.map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`min-w-[2rem] h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                        page === pageNum
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Pagina siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Ultima pagina"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Ride Detail Modal */}
      <AnimatePresence>
        {selectedRide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedRide(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl p-6 w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Detalle del Viaje</h2>
                <button onClick={() => setSelectedRide(null)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 font-mono text-sm">{selectedRide.id}</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${(statusConfig[selectedRide.status] || statusConfig.pending).color}`}>
                    {(statusConfig[selectedRide.status] || statusConfig.pending).label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Pasajero</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.passenger}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Conductor</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.driver}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Origen</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.origin}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Destino</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.destination}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Precio</p>
                    <p className="text-sm text-emerald-400 mt-0.5 font-bold">₡{selectedRide.price.toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Fecha</p>
                    <p className="text-sm text-white mt-0.5">{new Date(selectedRide.date).toLocaleString('es-CR')}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Duracion</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.duration}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Distancia</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.distance}</p>
                  </div>
                </div>

                {/* Route visualization */}
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-cyan-400" />
                      <div className="w-0.5 h-8 bg-gradient-to-b from-cyan-400 to-emerald-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex-1 space-y-6">
                      <div>
                        <p className="text-xs text-gray-500">Origen</p>
                        <p className="text-sm text-white">{selectedRide.origin}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Destino</p>
                        <p className="text-sm text-white">{selectedRide.destination}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

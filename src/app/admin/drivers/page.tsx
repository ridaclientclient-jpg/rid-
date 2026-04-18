'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Car, Star, CheckCircle2, XCircle, Clock,
  Eye, ShieldCheck, ShieldX, MoreHorizontal, FileCheck,
  AlertCircle, ChevronDown, Loader2,
} from 'lucide-react';
import { supabase, type Driver, type Profile, type Vehicle } from '@/lib/supabase';
import { toast } from 'sonner';

type DriverStatus = 'pending' | 'verified' | 'rejected' | 'online' | 'offline' | 'suspended' | 'busy';
type DocStatus = 'pending' | 'approved' | 'rejected';

interface DriverData {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  rating: number;
  totalRides: number;
  status: DriverStatus;
  joined: string;
  avatar: string;
  documents: {
    license: DocStatus;
    insurance: DocStatus;
    registration: DocStatus;
  };
  earnings: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
  verified: { label: 'Verificado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  rejected: { label: 'Rechazado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  online: { label: 'En linea', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: CheckCircle2 },
  offline: { label: 'Desconectado', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock },
  suspended: { label: 'Suspendido', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  busy: { label: 'Ocupado', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
};

const docStatusConfig: Record<DocStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'text-amber-400', icon: Clock },
  approved: { label: 'Aprobado', color: 'text-emerald-400', icon: CheckCircle2 },
  rejected: { label: 'Rechazado', color: 'text-red-400', icon: XCircle },
};

const filterTabs = ['Todos', 'Pendientes', 'Verificados', 'Rechazados', 'En linea', 'Desconectados'] as const;

function getInitials(name: string): string {
  return name.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
}

function formatEarnings(amount: number): string {
  if (amount >= 1000000) return `₡${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `₡${(amount / 1000).toFixed(0)}k`;
  return `₡${amount.toLocaleString()}`;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('Todos');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: driverRecords, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching drivers:', error);
        toast.error('Error al cargar conductores');
        setLoading(false);
        return;
      }

      if (!driverRecords || driverRecords.length === 0) {
        setDrivers([]);
        setLoading(false);
        return;
      }

      // Collect all user_ids and driver_ids for batch queries
      const userIds = driverRecords.map(d => d.user_id).filter(Boolean);
      const driverIds = driverRecords.map(d => d.id).filter(Boolean);

      // Fetch profiles
      const profileMap: Record<string, Profile> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        if (profiles) {
          profiles.forEach(p => { profileMap[p.id] = p; });
        }
      }

      // Fetch vehicles
      const vehicleMap: Record<string, Vehicle> = {};
      if (driverIds.length > 0) {
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('*')
          .in('driver_id', driverIds);
        if (vehicles) {
          vehicles.forEach(v => { vehicleMap[v.driver_id] = v; });
        }
      }

      const mapped: DriverData[] = driverRecords.map(d => {
        const profile = profileMap[d.user_id || ''];
        const vehicle = vehicleMap[d.id || ''];
        const status = d.status || 'offline';
        const isVerified = d.is_verified || false;
        const docStatus: DocStatus = isVerified ? 'approved' : 'pending';

        return {
          id: d.id,
          name: profile?.name || 'Desconocido',
          phone: profile?.phone || 'N/A',
          vehicle: vehicle ? `${vehicle.model} ${vehicle.year || ''}`.trim() : 'Sin vehiculo',
          plate: vehicle?.plate || '-',
          rating: d.rating || 0,
          totalRides: d.total_rides || 0,
          status: status as DriverStatus,
          joined: d.created_at || '',
          avatar: getInitials(profile?.name || 'D'),
          documents: {
            license: docStatus,
            insurance: docStatus,
            registration: docStatus,
          },
          earnings: formatEarnings(d.total_earnings || 0),
        };
      });

      setDrivers(mapped);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      toast.error('Error al cargar conductores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const filteredDrivers = drivers.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.plate.toLowerCase().includes(search.toLowerCase());
    let matchFilter = true;
    switch (activeFilter) {
      case 'Pendientes': matchFilter = d.status === 'pending'; break;
      case 'Verificados': matchFilter = d.status === 'verified' || d.status === 'online'; break;
      case 'Rechazados': matchFilter = d.status === 'rejected'; break;
      case 'En linea': matchFilter = d.status === 'online'; break;
      case 'Desconectados': matchFilter = d.status === 'offline'; break;
    }
    return matchSearch && matchFilter;
  });

  const approveDriver = async (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          is_verified: true,
          status: 'verified',
        })
        .eq('id', driverId);

      if (error) {
        toast.error('Error al aprobar conductor');
        return;
      }

      toast.success(`Conductor ${driver.name} aprobado`);
      setDrivers(prev => prev.map(d =>
        d.id === driverId ? {
          ...d,
          status: 'verified' as DriverStatus,
          documents: { license: 'approved' as DocStatus, insurance: 'approved' as DocStatus, registration: 'approved' as DocStatus },
        } : d
      ));
    } catch (err) {
      console.error('Approve error:', err);
      toast.error('Error al aprobar conductor');
    }
    setOpenMenu(null);
  };

  const rejectDriver = async (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'rejected' })
        .eq('id', driverId);

      if (error) {
        toast.error('Error al rechazar conductor');
        return;
      }

      toast.success(`Conductor ${driver.name} rechazado`);
      setDrivers(prev => prev.map(d =>
        d.id === driverId ? { ...d, status: 'rejected' as DriverStatus } : d
      ));
    } catch (err) {
      console.error('Reject error:', err);
      toast.error('Error al rechazar conductor');
    }
    setOpenMenu(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Conductores</h1>
          <p className="text-gray-400 mt-1">{loading ? 'Cargando...' : `${drivers.length} conductores registrados`}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /><span className="text-cyan-400">{drivers.filter(d => d.status === 'online').length} en linea</span></span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-amber-400">{drivers.filter(d => d.status === 'pending').length} pendientes</span></span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
          />
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === tab
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Driver Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredDrivers.map((driver, i) => {
                const cfg = statusConfig[driver.status] || statusConfig.offline;
                const DriverIcon = cfg.icon;
                return (
                  <motion.div
                    key={driver.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass rounded-2xl p-5 hover:bg-white/[0.07] transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${
                          driver.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          driver.status === 'online' ? 'bg-gradient-to-br from-cyan-600 to-emerald-500 text-white' :
                          driver.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-white/10 text-gray-400'
                        }`}>
                          {driver.avatar}
                        </div>
                        {driver.status === 'online' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0a0e1a]" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white">{driver.name}</h3>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${cfg.color}`}>
                            <DriverIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{driver.vehicle} • {driver.plate}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="flex items-center gap-1 text-amber-400"><Star className="w-3 h-3 fill-amber-400" /> {driver.rating.toFixed(1)}</span>
                          <span className="text-gray-500">{driver.totalRides} viajes</span>
                          <span className="text-emerald-400 font-medium">{driver.earnings}</span>
                        </div>

                        {/* Documents */}
                        <div className="flex items-center gap-3 mt-3">
                          {(['license', 'insurance', 'registration'] as const).map((doc) => {
                            const docCfg = docStatusConfig[driver.documents[doc]];
                            const DocIcon = docCfg.icon;
                            return (
                              <span key={doc} className={`flex items-center gap-1 text-[10px] ${docCfg.color}`}>
                                <DocIcon className="w-3 h-3" />
                                <span className="capitalize hidden sm:inline">{doc === 'license' ? 'Licencia' : doc === 'insurance' ? 'Seguro' : 'Patente'}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setOpenMenu(openMenu === driver.id ? null : driver.id)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {openMenu === driver.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -5, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -5, scale: 0.95 }}
                              className="absolute right-0 top-10 w-48 glass-strong rounded-xl py-1.5 z-20 shadow-xl"
                            >
                              <button onClick={() => { setSelectedDriver(driver); setOpenMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                                <Eye className="w-4 h-4 text-cyan-400" /> Ver detalles
                              </button>
                              {driver.status !== 'verified' && driver.status !== 'suspended' && (
                                <button onClick={() => approveDriver(driver.id)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                                  <ShieldCheck className="w-4 h-4" /> Aprobar
                                </button>
                              )}
                              {driver.status !== 'rejected' && driver.status !== 'suspended' && (
                                <button onClick={() => rejectDriver(driver.id)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                                  <ShieldX className="w-4 h-4" /> Rechazar
                                </button>
                              )}
                              <button onClick={() => { toast.info(`Documentos de ${driver.name}`); setOpenMenu(null); }} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                                <FileCheck className="w-4 h-4 text-blue-400" /> Documentos
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredDrivers.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No se encontraron conductores</p>
            </div>
          )}
        </>
      )}

      {/* Driver Detail Modal */}
      <AnimatePresence>
        {selectedDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDriver(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl p-6 w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Detalle del Conductor</h2>
                <button onClick={() => setSelectedDriver(null)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold ${
                    selectedDriver.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                    selectedDriver.status === 'online' ? 'bg-gradient-to-br from-cyan-600 to-emerald-500 text-white' :
                    selectedDriver.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-white/10 text-gray-400'
                  }`}>{selectedDriver.avatar}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedDriver.name}</h3>
                    <p className="text-sm text-gray-400">{selectedDriver.phone}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border mt-1 ${(statusConfig[selectedDriver.status] || statusConfig.offline).color}`}>
                      {(statusConfig[selectedDriver.status] || statusConfig.offline).label}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Vehiculo</p>
                    <p className="text-sm text-white mt-0.5">{selectedDriver.vehicle}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Placa</p>
                    <p className="text-sm text-white mt-0.5">{selectedDriver.plate}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Calificacion</p>
                    <p className="text-sm text-amber-400 mt-0.5 flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400" /> {selectedDriver.rating.toFixed(1)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Total Viajes</p>
                    <p className="text-sm text-white mt-0.5">{selectedDriver.totalRides}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Ganancias</p>
                    <p className="text-sm text-emerald-400 mt-0.5">{selectedDriver.earnings}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Registro</p>
                    <p className="text-sm text-white mt-0.5">{selectedDriver.joined ? new Date(selectedDriver.joined).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Documentos</h4>
                  <div className="space-y-2">
                    {(['license', 'insurance', 'registration'] as const).map((doc) => {
                      const cfg = docStatusConfig[selectedDriver.documents[doc]];
                      const Icon = cfg.icon;
                      return (
                        <div key={doc} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2.5">
                          <span className="text-sm text-gray-300">{doc === 'license' ? 'Licencia de conducir' : doc === 'insurance' ? 'Seguro del vehiculo' : 'Patente'}</span>
                          <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}><Icon className="w-3.5 h-3.5" /> {cfg.label}</span>
                        </div>
                      );
                    })}
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

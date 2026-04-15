'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Car, Star, CheckCircle2, XCircle, Clock,
  Eye, ShieldCheck, ShieldX, MoreHorizontal, FileCheck,
  AlertCircle, ChevronDown, Filter
} from 'lucide-react';
import { toast } from 'sonner';

type DriverStatus = 'pending' | 'verified' | 'rejected' | 'online' | 'offline';
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

const initialDrivers: DriverData[] = [
  {
    id: 'D-001', name: 'Carlos Mendez Rojas', phone: '+506 8888 2345', vehicle: 'Toyota Corolla 2022', plate: 'ABC-123',
    rating: 4.9, totalRides: 1250, status: 'online', joined: '2025-11-20', avatar: 'CM',
    documents: { license: 'approved', insurance: 'approved', registration: 'approved' }, earnings: '₡2,450,000'
  },
  {
    id: 'D-002', name: 'Ana Rodríguez Vega', phone: '+506 8888 3456', vehicle: 'Honda Civic 2023', plate: 'DEF-456',
    rating: 4.8, totalRides: 980, status: 'online', joined: '2025-10-05', avatar: 'AR',
    documents: { license: 'approved', insurance: 'approved', registration: 'approved' }, earnings: '₡1,890,000'
  },
  {
    id: 'D-003', name: 'Roberto Vega Torres', phone: '+506 8888 6789', vehicle: 'Nissan Sentra 2021', plate: 'GHI-789',
    rating: 4.5, totalRides: 320, status: 'pending', joined: '2026-04-10', avatar: 'RV',
    documents: { license: 'pending', insurance: 'pending', registration: 'rejected' }, earnings: '₡0'
  },
  {
    id: 'D-004', name: 'Miguel Torres Acosta', phone: '+506 8888 8901', vehicle: 'Hyundai Accent 2020', plate: 'JKL-012',
    rating: 4.7, totalRides: 750, status: 'offline', joined: '2025-12-01', avatar: 'MT',
    documents: { license: 'approved', insurance: 'approved', registration: 'approved' }, earnings: '₡1,560,000'
  },
  {
    id: 'D-005', name: 'Luis Campos Hernández', phone: '+506 8888 9012', vehicle: 'Kia Rio 2022', plate: 'MNO-345',
    rating: 4.3, totalRides: 210, status: 'rejected', joined: '2026-03-15', avatar: 'LC',
    documents: { license: 'rejected', insurance: 'pending', registration: 'pending' }, earnings: '₡0'
  },
  {
    id: 'D-006', name: 'Josué Arias Mora', phone: '+506 8888 0123', vehicle: 'Toyota Yaris 2023', plate: 'PQR-678',
    rating: 4.6, totalRides: 540, status: 'online', joined: '2026-01-22', avatar: 'JA',
    documents: { license: 'approved', insurance: 'approved', registration: 'approved' }, earnings: '₡980,000'
  },
];

const statusConfig: Record<DriverStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
  verified: { label: 'Verificado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  rejected: { label: 'Rechazado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  online: { label: 'En línea', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: CheckCircle2 },
  offline: { label: 'Desconectado', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock },
};

const docStatusConfig: Record<DocStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'text-amber-400', icon: Clock },
  approved: { label: 'Aprobado', color: 'text-emerald-400', icon: CheckCircle2 },
  rejected: { label: 'Rechazado', color: 'text-red-400', icon: XCircle },
};

const filterTabs = ['Todos', 'Pendientes', 'Verificados', 'Rechazados', 'En línea', 'Desconectados'] as const;

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverData[]>(initialDrivers);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('Todos');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);

  const filteredDrivers = drivers.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.plate.toLowerCase().includes(search.toLowerCase());
    let matchFilter = true;
    switch (activeFilter) {
      case 'Pendientes': matchFilter = d.status === 'pending'; break;
      case 'Verificados': matchFilter = d.status === 'verified' || d.status === 'online'; break;
      case 'Rechazados': matchFilter = d.status === 'rejected'; break;
      case 'En línea': matchFilter = d.status === 'online'; break;
      case 'Desconectados': matchFilter = d.status === 'offline'; break;
    }
    return matchSearch && matchFilter;
  });

  const approveDriver = (id: string) => {
    setDrivers((prev) => prev.map((d) => {
      if (d.id === id) {
        toast.success(`Conductor ${d.name} aprobado`);
        return { ...d, status: 'verified' as DriverStatus, documents: { license: 'approved' as DocStatus, insurance: 'approved' as DocStatus, registration: 'approved' as DocStatus } };
      }
      return d;
    }));
    setOpenMenu(null);
  };

  const rejectDriver = (id: string) => {
    setDrivers((prev) => prev.map((d) => {
      if (d.id === id) {
        toast.success(`Conductor ${d.name} rechazado`);
        return { ...d, status: 'rejected' as DriverStatus };
      }
      return d;
    }));
    setOpenMenu(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Conductores</h1>
          <p className="text-gray-400 mt-1">{drivers.length} conductores registrados</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /><span className="text-cyan-400">{drivers.filter(d => d.status === 'online').length} en línea</span></span>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredDrivers.map((driver, i) => (
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
                    {(() => {
                      const DriverIcon = statusConfig[driver.status].icon;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${statusConfig[driver.status].color}`}>
                          <DriverIcon className="w-3 h-3" />
                          {statusConfig[driver.status].label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{driver.vehicle} • {driver.plate}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="flex items-center gap-1 text-amber-400"><Star className="w-3 h-3 fill-amber-400" /> {driver.rating}</span>
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
                        {(driver.status === 'pending' || driver.status === 'rejected') && (
                          <button onClick={() => approveDriver(driver.id)} className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                            <ShieldCheck className="w-4 h-4" /> Aprobar
                          </button>
                        )}
                        {(driver.status === 'pending' || driver.status === 'verified' || driver.status === 'online') && (
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
          ))}
        </AnimatePresence>
      </div>

      {filteredDrivers.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No se encontraron conductores</p>
        </div>
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
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-600 to-emerald-500 flex items-center justify-center text-xl font-bold text-white">{selectedDriver.avatar}</div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{selectedDriver.name}</h3>
                    <p className="text-sm text-gray-400">{selectedDriver.phone}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border mt-1 ${statusConfig[selectedDriver.status].color}`}>
                      {statusConfig[selectedDriver.status].label}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Vehículo</p>
                    <p className="text-sm text-white mt-0.5">{selectedDriver.vehicle}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Placa</p>
                    <p className="text-sm text-white mt-0.5">{selectedDriver.plate}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Calificación</p>
                    <p className="text-sm text-amber-400 mt-0.5 flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-400" /> {selectedDriver.rating}</p>
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
                    <p className="text-sm text-white mt-0.5">{selectedDriver.joined}</p>
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
                          <span className="text-sm text-gray-300">{doc === 'license' ? 'Licencia de conducir' : doc === 'insurance' ? 'Seguro del vehículo' : 'Patente'}</span>
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

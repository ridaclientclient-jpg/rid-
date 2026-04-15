'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, DollarSign, CheckCircle2, XCircle, Clock,
  Eye, RotateCcw, Ban, XCircle as XIcon
} from 'lucide-react';
import { toast } from 'sonner';

type RideStatus = 'completed' | 'cancelled' | 'in_progress' | 'pending';

interface RideData {
  id: string;
  passenger: string;
  driver: string;
  origin: string;
  destination: string;
  price: string;
  status: RideStatus;
  date: string;
  duration: string;
  distance: string;
}

const initialRides: RideData[] = [
  { id: 'R-12345', passenger: 'María García', driver: 'Carlos Mendez', origin: 'San José Centro', destination: 'Escazú', price: '₡3,500', status: 'completed', date: '2026-04-15 14:30', duration: '18 min', distance: '8.2 km' },
  { id: 'R-12346', passenger: 'Juan Pérez', driver: 'Ana Rodríguez', origin: 'Heredia Centro', destination: 'Alajuela', price: '₡4,200', status: 'in_progress', date: '2026-04-15 15:45', duration: 'En curso', distance: '12.5 km' },
  { id: 'R-12347', passenger: 'Laura Sánchez', driver: 'Roberto Vega', origin: 'Cartago Centro', destination: 'San José', price: '₡2,800', status: 'cancelled', date: '2026-04-15 13:20', duration: '-', distance: '6.1 km' },
  { id: 'R-12348', passenger: 'Pedro Jiménez', driver: 'Miguel Torres', origin: 'Santa Ana', destination: 'Cariari', price: '₡5,100', status: 'completed', date: '2026-04-15 12:00', duration: '25 min', distance: '15.3 km' },
  { id: 'R-12349', passenger: 'Sofia Hernández', driver: 'Luis Campos', origin: 'Pavas', destination: 'Moravia', price: '₡3,200', status: 'completed', date: '2026-04-15 11:15', duration: '15 min', distance: '7.4 km' },
  { id: 'R-12350', passenger: 'Diego Mora', driver: 'Josué Arias', origin: 'Tres Ríos', destination: 'Curridabat', price: '₡2,100', status: 'completed', date: '2026-04-15 10:30', duration: '12 min', distance: '5.8 km' },
  { id: 'R-12351', passenger: 'Valentina Rojas', driver: 'Carlos Mendez', origin: 'Desamparados', destination: 'San Pedro', price: '₡2,600', status: 'completed', date: '2026-04-15 09:45', duration: '14 min', distance: '6.7 km' },
  { id: 'R-12352', passenger: 'Andrés Castillo', driver: 'Ana Rodríguez', origin: 'Guadalupe', destination: 'Sabanilla', price: '₡1,900', status: 'cancelled', date: '2026-04-15 09:10', duration: '-', distance: '4.2 km' },
  { id: 'R-12353', passenger: 'Camila Vargas', driver: 'Miguel Torres', origin: 'Alajuela Centro', destination: 'Airport Juan Santamaría', price: '₡6,800', status: 'completed', date: '2026-04-14 22:30', duration: '30 min', distance: '18.9 km' },
  { id: 'R-12354', passenger: 'Felipe Quesada', driver: 'Luis Campos', origin: 'San José Centro', destination: 'Belén', price: '₡4,500', status: 'completed', date: '2026-04-14 18:00', duration: '22 min', distance: '11.2 km' },
  { id: 'R-12355', passenger: 'Isabella Chaves', driver: 'Josué Arias', origin: 'Escazú', destination: 'Santa Ana', price: '₡2,400', status: 'pending', date: '2026-04-15 16:00', duration: '-', distance: '5.1 km' },
  { id: 'R-12356', passenger: 'Gabriel Solano', driver: 'Carlos Mendez', origin: 'Puntarenas', destination: 'Jacó', price: '₡15,000', status: 'completed', date: '2026-04-14 14:00', duration: '75 min', distance: '85.3 km' },
];

const statusConfig: Record<RideStatus, { label: string; color: string; icon: React.ElementType }> = {
  completed: { label: 'Completado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  in_progress: { label: 'En curso', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Clock },
  pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
};

const filterTabs = ['Todos', 'Activos', 'Completados', 'Cancelados'] as const;
const dateFilters = ['Hoy', 'Esta semana', 'Este mes'] as const;

export default function RidesPage() {
  const [rides, setRides] = useState<RideData[]>(initialRides);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [dateFilter, setDateFilter] = useState<string>('Hoy');
  const [selectedRide, setSelectedRide] = useState<RideData | null>(null);

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

  const totalRevenue = rides.filter(r => r.status === 'completed').reduce((sum, r) => {
    const val = parseInt(r.price.replace(/[₡,]/g, ''));
    return sum + val;
  }, 0);

  const stats = [
    { label: 'Total Viajes', value: rides.length, color: 'text-white' },
    { label: 'Completados', value: rides.filter(r => r.status === 'completed').length, color: 'text-emerald-400' },
    { label: 'Cancelados', value: rides.filter(r => r.status === 'cancelled').length, color: 'text-red-400' },
    { label: 'Ingresos', value: `₡${totalRevenue.toLocaleString()}`, color: 'text-cyan-400' },
  ];

  const cancelRide = (id: string) => {
    setRides((prev) => prev.map((r) => {
      if (r.id === id) {
        toast.success(`Viaje ${r.id} cancelado`);
        return { ...r, status: 'cancelled' as RideStatus };
      }
      return r;
    }));
  };

  const refundRide = (id: string) => {
    toast.success(`Reembolso procesado para ${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Viajes</h1>
        <p className="text-gray-400 mt-1">Gestión y seguimiento de todos los viajes</p>
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
                onClick={() => setDateFilter(df)}
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
                const cfg = statusConfig[ride.status];
                const StatusIcon = cfg.icon;
                return (
                  <motion.tr
                    key={ride.id}
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
                    <td className="px-5 py-3 text-sm text-white text-right font-medium">{ride.price}</td>
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
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig[selectedRide.status].color}`}>
                    {statusConfig[selectedRide.status].label}
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
                    <p className="text-sm text-emerald-400 mt-0.5 font-bold">{selectedRide.price}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Fecha</p>
                    <p className="text-sm text-white mt-0.5">{selectedRide.date}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Duración</p>
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

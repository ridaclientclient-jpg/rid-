'use client';

import { motion } from 'framer-motion';
import {
  Users, MapPin, Car, DollarSign, TrendingUp, Activity,
  AlertTriangle, CheckCircle2, Clock, Eye
} from 'lucide-react';

const stats = [
  {
    label: 'Total Usuarios',
    value: '12,450',
    change: '+12%',
    icon: Users,
    color: 'from-blue-600 to-cyan-500',
    bgGlow: 'shadow-blue-500/20',
  },
  {
    label: 'Viajes Hoy',
    value: '3,280',
    change: '+8%',
    icon: MapPin,
    color: 'from-cyan-500 to-emerald-500',
    bgGlow: 'shadow-emerald-500/20',
  },
  {
    label: 'Conductores Online',
    value: '856',
    change: null,
    icon: Car,
    color: 'from-amber-500 to-orange-500',
    bgGlow: 'shadow-amber-500/20',
  },
  {
    label: 'Ingresos Hoy',
    value: '₡4,200,000',
    change: '+15%',
    icon: DollarSign,
    color: 'from-purple-600 to-blue-600',
    bgGlow: 'shadow-purple-500/20',
  },
];

const recentRides = [
  { id: 'R-12345', passenger: 'María García', driver: 'Carlos Mendez', origin: 'San José Centro', destination: 'Escazú', status: 'completed', price: '₡3,500' },
  { id: 'R-12346', passenger: 'Juan Pérez', driver: 'Ana Rodríguez', origin: 'Heredia', destination: 'Alajuela', status: 'in_progress', price: '₡4,200' },
  { id: 'R-12347', passenger: 'Laura Sánchez', driver: 'Roberto Vega', origin: 'Cartago', destination: 'San José', status: 'cancelled', price: '₡2,800' },
  { id: 'R-12348', passenger: 'Pedro Jiménez', driver: 'Miguel Torres', origin: 'Santa Ana', destination: 'Cariari', status: 'completed', price: '₡5,100' },
  { id: 'R-12349', passenger: 'Sofia Hernández', driver: 'Luis Campos', origin: 'Pavas', destination: 'Moravia', status: 'completed', price: '₡3,200' },
];

const activityFeed = [
  { text: 'Conductor Carlos M. se conectó', time: 'Hace 2 min', type: 'online', icon: Car },
  { text: 'Viaje R-12345 completado', time: 'Hace 5 min', type: 'success', icon: CheckCircle2 },
  { text: 'Nuevo usuario registrado: sofia@mail.com', time: 'Hace 12 min', type: 'info', icon: Users },
  { text: 'SOS activado - investigando', time: 'Hace 15 min', type: 'alert', icon: AlertTriangle },
  { text: 'Conductor Ana R. completó 50 viajes', time: 'Hace 22 min', type: 'success', icon: Trophy },
  { text: 'Pago recibido: ₡4,500', time: 'Hace 30 min', type: 'info', icon: DollarSign },
  { text: 'Viaje R-12340 cancelado por pasajero', time: 'Hace 35 min', type: 'warning', icon: Clock },
  { text: 'Review 5★ de María G.', time: 'Hace 42 min', type: 'success', icon: Star },
];

const heatmapData = [
  [1, 2, 3, 2, 1, 0, 1, 2, 3, 2],
  [2, 4, 5, 4, 2, 1, 2, 3, 5, 4],
  [3, 5, 7, 6, 3, 2, 3, 5, 7, 5],
  [2, 4, 6, 8, 5, 3, 2, 4, 6, 4],
  [1, 3, 5, 7, 6, 4, 3, 3, 5, 3],
  [1, 2, 3, 4, 3, 2, 1, 2, 3, 2],
  [0, 1, 2, 3, 2, 1, 1, 1, 2, 1],
  [1, 2, 3, 3, 2, 1, 2, 2, 3, 2],
];

function getHeatColor(value: number) {
  if (value === 0) return 'bg-white/5';
  if (value <= 2) return 'bg-emerald-500/20';
  if (value <= 4) return 'bg-emerald-500/40';
  if (value <= 6) return 'bg-amber-500/50';
  return 'bg-red-500/60';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Completado
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          En curso
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Cancelado
        </span>
      );
    default:
      return null;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'online': return 'border-l-cyan-500 bg-cyan-500/5';
    case 'success': return 'border-l-emerald-500 bg-emerald-500/5';
    case 'info': return 'border-l-blue-500 bg-blue-500/5';
    case 'alert': return 'border-l-red-500 bg-red-500/5';
    case 'warning': return 'border-l-amber-500 bg-amber-500/5';
    default: return 'border-l-gray-500 bg-gray-500/5';
  }
}

function getActivityIconColor(type: string) {
  switch (type) {
    case 'online': return 'text-cyan-400';
    case 'success': return 'text-emerald-400';
    case 'info': return 'text-blue-400';
    case 'alert': return 'text-red-400';
    case 'warning': return 'text-amber-400';
    default: return 'text-gray-400';
  }
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Panel de Administración</h1>
        <p className="text-gray-400 mt-1">Bienvenido de vuelta. Aquí tienes el resumen del sistema.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            className="glass rounded-2xl p-5 hover:glow-cyan/30 transition-all duration-300 group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -2 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg ${stat.bgGlow}`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              {stat.change && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  {stat.change}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-gray-400 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Rides Table */}
        <motion.div
          className="xl:col-span-2 glass rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Viajes Recientes
            </h2>
            <button className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">Ver todos</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Pasajero</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Origen</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Destino</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Precio</th>
                </tr>
              </thead>
              <tbody>
                {recentRides.map((ride, i) => (
                  <motion.tr
                    key={ride.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                  >
                    <td className="px-5 py-3 text-sm text-cyan-400 font-mono">{ride.id}</td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-white">{ride.passenger}</p>
                      <p className="text-xs text-gray-500">{ride.driver}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-300 hidden md:table-cell">{ride.origin}</td>
                    <td className="px-5 py-3 text-sm text-gray-300 hidden lg:table-cell">{ride.destination}</td>
                    <td className="px-5 py-3">{getStatusBadge(ride.status)}</td>
                    <td className="px-5 py-3 text-sm text-white text-right font-medium">{ride.price}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          className="glass rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Actividad en Vivo
            </h2>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {activityFeed.map((item, i) => (
              <motion.div
                key={i}
                className={`flex items-start gap-3 px-5 py-3 border-l-2 ${getActivityColor(item.type)}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.05 }}
              >
                <item.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${getActivityIconColor(item.type)}`} />
                <div className="min-w-0">
                  <p className="text-sm text-gray-300">{item.text}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Heatmap */}
      <motion.div
        className="glass rounded-2xl p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" />
            Mapa de Demanda
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/20" /> Baja</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/40" /> Media</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/50" /> Alta</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/60" /> Muy Alta</span>
          </div>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${heatmapData[0].length}, 1fr)` }}>
          {heatmapData.map((row, ri) =>
            row.map((val, ci) => (
              <motion.div
                key={`${ri}-${ci}`}
                className={`aspect-square rounded-md ${getHeatColor(val)} transition-colors`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + (ri * heatmapData[0].length + ci) * 0.01 }}
                whileHover={{ scale: 1.2, zIndex: 10 }}
              />
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

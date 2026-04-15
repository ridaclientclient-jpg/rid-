'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Users, MapPin, Clock, DollarSign,
  Star, Trophy, ArrowUpRight, ArrowDownRight, Globe
} from 'lucide-react';

const revenueData = [
  { day: 'Lun', value: 3800000 },
  { day: 'Mar', value: 4200000 },
  { day: 'Mie', value: 3600000 },
  { day: 'Jue', value: 5100000 },
  { day: 'Vie', value: 4800000 },
  { day: 'Sab', value: 6200000 },
  { day: 'Dom', value: 4500000 },
];

const ridesData = [
  { day: 'Lun', value: 2800 },
  { day: 'Mar', value: 3200 },
  { day: 'Mie', value: 2600 },
  { day: 'Jue', value: 3800 },
  { day: 'Vie', value: 3600 },
  { day: 'Sab', value: 4500 },
  { day: 'Dom', value: 3100 },
];

const userGrowthData = [
  { month: 'Ene', value: 8200 },
  { month: 'Feb', value: 8900 },
  { month: 'Mar', value: 9800 },
  { month: 'Abr', value: 10500 },
  { month: 'May', value: 11200 },
  { month: 'Jun', value: 11800 },
];

const topRoutes = [
  { from: 'San José Centro', to: 'Escazú', trips: 1250, avgPrice: '₡3,500' },
  { from: 'Heredia', to: 'Alajuela', trips: 980, avgPrice: '₡4,200' },
  { from: 'San José', to: 'Cartago', trips: 860, avgPrice: '₡3,800' },
  { from: 'Santa Ana', to: 'San José', trips: 750, avgPrice: '₡2,800' },
  { from: 'Alajuela', to: 'Airport', trips: 680, avgPrice: '₡6,500' },
];

const driverLeaderboard = [
  { name: 'Carlos Mendez', rides: 1250, rating: 4.9, earnings: '₡2,450,000' },
  { name: 'Ana Rodríguez', rides: 980, rating: 4.8, earnings: '₡1,890,000' },
  { name: 'Miguel Torres', rides: 750, rating: 4.7, earnings: '₡1,560,000' },
  { name: 'Josué Arias', rides: 540, rating: 4.6, earnings: '₡980,000' },
  { name: 'Luis Campos', rides: 420, rating: 4.5, earnings: '₡850,000' },
];

const geoDistribution = [
  { zone: 'San José Metro', percentage: 45 },
  { zone: 'Heredia', percentage: 18 },
  { zone: 'Alajuela', percentage: 15 },
  { zone: 'Cartago', percentage: 12 },
  { zone: 'Otros', percentage: 10 },
];

const geoColors = ['#06b6d4', '#2563eb', '#8b5cf6', '#f59e0b', '#64748b'];

const keyMetrics = [
  { label: 'Tiempo promedio de viaje', value: '22 min', icon: Clock, trend: '+2 min', trendUp: false },
  { label: 'Tarifa promedio', value: '₡3,200', icon: DollarSign, trend: '+8%', trendUp: true },
  { label: 'Utilización de conductores', value: '78%', icon: TrendingUp, trend: '+5%', trendUp: true },
  { label: 'Retención de usuarios', value: '65%', icon: Users, trend: '+3%', trendUp: true },
];

function formatMillions(val: number) {
  return `₡${(val / 1000000).toFixed(1)}M`;
}

function SimpleBarChart({ data, color = 'from-cyan-500 to-blue-600', formatValue }: { data: { day: string; value: number }[]; color?: string; formatValue?: (v: number) => string }) {
  const maxVal = Math.max(...data.map(d => d.value));

  return (
    <div className="flex items-end gap-2 h-48 px-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <span className="text-[10px] text-gray-400 font-medium">
            {formatValue ? formatValue(d.value) : d.value.toLocaleString()}
          </span>
          <motion.div
            className={`w-full rounded-t-lg bg-gradient-to-t ${color} min-h-[4px] relative group cursor-pointer`}
            initial={{ height: 0 }}
            animate={{ height: `${(d.value / maxVal) * 100}%` }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.6, ease: 'easeOut' }}
            whileHover={{ opacity: 0.8 }}
          />
          <span className="text-xs text-gray-500">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Métricas y análisis del sistema</p>
        </div>
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                timeRange === range
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {range === 'week' ? 'Esta Semana' : range === 'month' ? 'Este Mes' : 'Este Año'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {keyMetrics.map((metric, i) => (
          <motion.div
            key={i}
            className="glass rounded-2xl p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <metric.icon className="w-5 h-5 text-cyan-400" />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-medium ${metric.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {metric.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {metric.trend}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{metric.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{metric.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Ingresos (7 días)
            </h3>
            <span className="text-sm font-bold text-emerald-400">
              ₡{(revenueData.reduce((s, d) => s + d.value, 0) / 1000000).toFixed(1)}M total
            </span>
          </div>
          <SimpleBarChart data={revenueData} color="from-emerald-500 to-cyan-600" formatValue={formatMillions} />
        </motion.div>

        {/* Rides Chart */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Viajes (7 días)
            </h3>
            <span className="text-sm font-bold text-cyan-400">
              {ridesData.reduce((s, d) => s + d.value, 0).toLocaleString()} total
            </span>
          </div>
          <SimpleBarChart data={ridesData} color="from-cyan-500 to-blue-600" />
        </motion.div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-400" />
            Crecimiento de Usuarios
          </h3>
          <SimpleBarChart data={userGrowthData} color="from-purple-500 to-blue-600" />
        </motion.div>

        {/* Geographic Distribution */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-blue-400" />
            Distribución Geográfica
          </h3>
          <div className="space-y-3">
            {geoDistribution.map((geo, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300">{geo.zone}</span>
                  <span className="text-sm font-medium text-white">{geo.percentage}%</span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: geoColors[i] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${geo.percentage}%` }}
                    transition={{ delay: 0.6 + i * 0.1, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Routes */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-amber-400" />
            Rutas Más Populares
          </h3>
          <div className="space-y-3">
            {topRoutes.map((route, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.05 }}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-sm font-bold text-amber-400">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{route.from} → {route.to}</p>
                  <p className="text-xs text-gray-500">{route.trips.toLocaleString()} viajes</p>
                </div>
                <span className="text-sm font-medium text-emerald-400">{route.avgPrice}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Driver Leaderboard */}
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-400" />
            Ranking de Conductores
          </h3>
          <div className="space-y-3">
            {driverLeaderboard.map((driver, i) => (
              <motion.div
                key={i}
                className={`flex items-center gap-3 rounded-xl p-3 ${
                  i === 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/5'
                }`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.05 }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                  i === 0 ? 'bg-amber-500/30 text-amber-400' :
                  i === 1 ? 'bg-gray-400/30 text-gray-300' :
                  i === 2 ? 'bg-orange-500/30 text-orange-400' :
                  'bg-white/10 text-gray-400'
                }`}>
                  {i === 0 ? <Trophy className="w-4 h-4" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{driver.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{driver.rides} viajes</span>
                    <span className="flex items-center gap-0.5 text-amber-400"><Star className="w-3 h-3 fill-amber-400" /> {driver.rating}</span>
                  </div>
                </div>
                <span className="text-sm font-medium text-emerald-400">{driver.earnings}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

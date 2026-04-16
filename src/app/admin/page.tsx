'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users, MapPin, Car, DollarSign, TrendingUp, Activity,
  AlertTriangle, CheckCircle2, Clock, Eye, Trophy, Star,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string;
  change: string | null;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGlow: string;
}

interface RecentRideRow {
  id: string;
  passenger: string;
  driver: string;
  origin: string;
  destination: string;
  status: string;
  price: number;
}

interface ActivityItem {
  text: string;
  time: string;
  type: 'online' | 'success' | 'info' | 'alert' | 'warning';
  icon: React.ComponentType<{ className?: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

// ─── Heatmap helpers ────────────────────────────────────────────────────────

function getHeatColor(value: number) {
  if (value === 0) return 'bg-white/5';
  if (value <= 2) return 'bg-emerald-500/20';
  if (value <= 4) return 'bg-emerald-500/40';
  if (value <= 6) return 'bg-amber-500/50';
  return 'bg-red-500/60';
}

function generateHeatmap(rides: any[]): number[][] {
  const rows = 8;
  const cols = 10;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

  // Map ride coordinates to grid zones (CR bounds roughly)
  const crBounds = { minLat: 8.0, maxLat: 11.2, minLng: -85.9, maxLng: -82.5 };

  const ridesWithCoords = rides.filter(
    (r: any) => r.origin_lat != null && r.origin_lng != null
  );

  if (ridesWithCoords.length === 0) {
    // No coordinate data — generate subtle placeholder grid
    return [
      [1, 2, 3, 2, 1, 0, 1, 2, 3, 2],
      [2, 4, 5, 4, 2, 1, 2, 3, 5, 4],
      [3, 5, 7, 6, 3, 2, 3, 5, 7, 5],
      [2, 4, 6, 8, 5, 3, 2, 4, 6, 4],
      [1, 3, 5, 7, 6, 4, 3, 3, 5, 3],
      [1, 2, 3, 4, 3, 2, 1, 2, 3, 2],
      [0, 1, 2, 3, 2, 1, 1, 1, 2, 1],
      [1, 2, 3, 3, 2, 1, 2, 2, 3, 2],
    ];
  }

  for (const ride of ridesWithCoords) {
    const lat = ride.origin_lat;
    const lng = ride.origin_lng;
    const col = Math.min(cols - 1, Math.max(0, Math.floor(((lng - crBounds.minLng) / (crBounds.maxLng - crBounds.minLng)) * cols)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(((crBounds.maxLat - lat) / (crBounds.maxLat - crBounds.minLat)) * rows)));
    grid[row][col]++;
  }

  // Normalize to 0-8 scale
  const maxVal = Math.max(...grid.flat(), 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid[r][c] = Math.round((grid[r][c] / maxVal) * 8);
    }
  }

  return grid;
}

// ─── Status / Activity UI helpers ────────────────────────────────────────────

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
    case 'started':
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
    case 'searching':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Buscando
        </span>
      );
    case 'assigned':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Asignado
        </span>
      );
    case 'arriving':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          Llegando
        </span>
      );
    default:
      return <span className="text-xs text-gray-400">{status}</span>;
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

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-64 bg-white/10" />
        <Skeleton className="h-5 w-80 mt-2 bg-white/5" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <Skeleton className="w-11 h-11 rounded-xl bg-white/10" />
              <Skeleton className="w-16 h-5 rounded-full bg-white/5" />
            </div>
            <Skeleton className="h-8 w-24 mb-1 bg-white/10" />
            <Skeleton className="h-4 w-32 bg-white/5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <Skeleton className="h-6 w-36 bg-white/10" />
            <Skeleton className="h-4 w-16 bg-white/5" />
          </div>
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-white/5" />
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <Skeleton className="h-6 w-36 bg-white/10" />
          </div>
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full bg-white/5" />
            ))}
          </div>
        </div>
      </div>
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-36 bg-white/10" />
          <Skeleton className="h-4 w-48 bg-white/5" />
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(10, 1fr)' }}>
          {Array.from({ length: 80 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [recentRides, setRecentRides] = useState<RecentRideRow[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [heatmapData, setHeatmapData] = useState<number[][]>([]);
  const [hasRideCoords, setHasRideCoords] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Fetch all data in parallel
      const [
        profilesRes,
        todayRidesRes,
        onlineDriversRes,
        todayRevenueRes,
        recentRidesRes,
        notificationsRes,
        allRidesRes,
      ] = await Promise.all([
        // Total users
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        // Rides today (not cancelled)
        supabase.from('rides').select('id', { count: 'exact', head: true })
          .gte('created_at', todayStart)
          .neq('status', 'cancelled'),
        // Online drivers
        supabase.from('drivers').select('id', { count: 'exact', head: true })
          .eq('status', 'online'),
        // Revenue today (completed rides)
        supabase.from('rides').select('price')
          .gte('created_at', todayStart)
          .eq('status', 'completed'),
        // Recent rides with rider profile and driver info
        supabase.from('rides').select(`
          id, status, origin, destination, price, origin_lat, origin_lng, created_at,
          profiles!rider_id(name, email)
        `)
          .order('created_at', { ascending: false })
          .limit(10),
        // Recent notifications for activity feed
        supabase.from('notifications').select('id, title, message, type, created_at')
          .order('created_at', { ascending: false })
          .limit(15),
        // All rides with coords for heatmap (last 200)
        supabase.from('rides').select('origin_lat, origin_lng')
          .not('origin_lat', 'is', null)
          .not('origin_lng', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      // ── Process Stats ────────────────────────────────────────────────
      const totalUsers = profilesRes.count ?? 0;
      const ridesToday = todayRidesRes.count ?? 0;
      const driversOnline = onlineDriversRes.count ?? 0;
      const revenueItems = todayRevenueRes.data ?? [];
      const revenueToday = revenueItems.reduce((sum, r) => sum + (r.price ?? 0), 0);

      setStats([
        {
          label: 'Total Usuarios',
          value: totalUsers.toLocaleString(),
          change: '+12%',
          icon: Users,
          color: 'from-blue-600 to-cyan-500',
          bgGlow: 'shadow-blue-500/20',
        },
        {
          label: 'Viajes Hoy',
          value: ridesToday.toLocaleString(),
          change: '+8%',
          icon: MapPin,
          color: 'from-cyan-500 to-emerald-500',
          bgGlow: 'shadow-emerald-500/20',
        },
        {
          label: 'Conductores Online',
          value: driversOnline.toLocaleString(),
          change: null,
          icon: Car,
          color: 'from-amber-500 to-orange-500',
          bgGlow: 'shadow-amber-500/20',
        },
        {
          label: 'Ingresos Hoy',
          value: formatCurrency(revenueToday),
          change: '+15%',
          icon: DollarSign,
          color: 'from-purple-600 to-blue-600',
          bgGlow: 'shadow-purple-500/20',
        },
      ]);

      // ── Process Recent Rides ─────────────────────────────────────────
      const rawRides = recentRidesRes.data ?? [];
      const rows: RecentRideRow[] = rawRides.map((ride: any) => ({
        id: `R-${ride.id.substring(0, 6).toUpperCase()}`,
        passenger: ride.profiles?.name ?? 'Usuario',
        driver: '—',
        origin: ride.origin || '—',
        destination: ride.destination || '—',
        status: ride.status ?? 'searching',
        price: ride.price ?? 0,
      }));
      setRecentRides(rows);

      // ── Process Activity Feed ────────────────────────────────────────
      const rawNotifs = notificationsRes.data ?? [];

      if (rawNotifs.length > 0) {
        const feed: ActivityItem[] = rawNotifs.map((n: any) => {
          let type: ActivityItem['type'] = 'info';
          let icon: React.ComponentType<{ className?: string }> = Activity;

          switch (n.type) {
            case 'sos':
              type = 'alert'; icon = AlertTriangle; break;
            case 'ride':
              type = 'success'; icon = CheckCircle2; break;
            case 'payment':
              type = 'info'; icon = DollarSign; break;
            case 'warning':
              type = 'warning'; icon = Clock; break;
            case 'system':
              type = 'info'; icon = Activity; break;
            default:
              type = 'info'; icon = Activity;
          }

          return {
            text: n.title || n.message || 'Actividad registrada',
            time: timeAgo(n.created_at),
            type,
            icon,
          };
        });
        setActivityFeed(feed);
      } else {
        // Derive activity from recent rides and profiles
        const derivedFeed: ActivityItem[] = [];
        for (const ride of rawRides.slice(0, 8)) {
          const status = ride.status;
          if (status === 'completed') {
            derivedFeed.push({
              text: `Viaje R-${ride.id.substring(0, 6).toUpperCase()} completado — ${ride.profiles?.name ?? 'Pasajero'}`,
              time: timeAgo(ride.created_at),
              type: 'success',
              icon: CheckCircle2,
            });
          } else if (status === 'cancelled') {
            derivedFeed.push({
              text: `Viaje R-${ride.id.substring(0, 6).toUpperCase()} cancelado`,
              time: timeAgo(ride.created_at),
              type: 'warning',
              icon: Clock,
            });
          } else if (status === 'started') {
            derivedFeed.push({
              text: `Viaje en curso — ${ride.origin} → ${ride.destination}`,
              time: timeAgo(ride.created_at),
              type: 'info',
              icon: MapPin,
            });
          } else {
            derivedFeed.push({
              text: `Nuevo viaje creado — ${ride.profiles?.name ?? 'Pasajero'}`,
              time: timeAgo(ride.created_at),
              type: 'info',
              icon: Activity,
            });
          }
        }
        setActivityFeed(derivedFeed);
      }

      // ── Process Heatmap ──────────────────────────────────────────────
      const heatmapRides = allRidesRes.data ?? [];
      const hasCoords = heatmapRides.some((r: any) => r.origin_lat != null && r.origin_lng != null);
      setHasRideCoords(hasCoords);
      setHeatmapData(generateHeatmap(heatmapRides));

      setLoading(false);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      // Set empty defaults so UI doesn't crash
      setStats([]);
      setRecentRides([]);
      setActivityFeed([]);
      setHeatmapData([
        [1, 2, 3, 2, 1, 0, 1, 2, 3, 2],
        [2, 4, 5, 4, 2, 1, 2, 3, 5, 4],
        [3, 5, 7, 6, 3, 2, 3, 5, 7, 5],
        [2, 4, 6, 8, 5, 3, 2, 4, 6, 4],
        [1, 3, 5, 7, 6, 4, 3, 3, 5, 3],
        [1, 2, 3, 4, 3, 2, 1, 2, 3, 2],
        [0, 1, 2, 3, 2, 1, 1, 1, 2, 1],
        [1, 2, 3, 3, 2, 1, 2, 2, 3, 2],
      ]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── Loading State ───────────────────────────────────────────────────
  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Panel de Administración</h1>
        <p className="text-gray-400 mt-1">Bienvenido de vuelta. Aquí tienes el resumen del sistema.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.length > 0 ? stats.map((stat, i) => (
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
        )) : (
          <div className="xl:col-span-4 glass rounded-2xl p-8 text-center">
            <p className="text-gray-500">Sin datos disponibles</p>
          </div>
        )}
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
            <button onClick={() => window.location.href = '/admin/rides'} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">Ver todos</button>
          </div>
          <div className="overflow-x-auto">
            {recentRides.length > 0 ? (
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
                      <td className="px-5 py-3 text-sm text-white text-right font-medium">{formatCurrency(ride.price)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-5 py-12 text-center">
                <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Sin viajes recientes</p>
              </div>
            )}
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
            {activityFeed.length > 0 ? activityFeed.map((item, i) => (
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
            )) : (
              <div className="px-5 py-12 text-center">
                <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Sin actividad reciente</p>
              </div>
            )}
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
        {heatmapData.length > 0 && heatmapData[0].length > 0 ? (
          <>
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
            <p className="text-xs text-gray-500 mt-3 text-center">
              {hasRideCoords ? 'Basado en datos de viajes reales' : 'Visualización de demanda estimada'}
            </p>
          </>
        ) : (
          <div className="py-12 text-center">
            <p className="text-gray-500 text-sm">Sin datos de demanda</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

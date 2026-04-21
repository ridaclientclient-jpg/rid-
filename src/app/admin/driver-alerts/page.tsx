'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Ban, ShieldAlert, Search, Loader2, Eye,
  CheckCircle2, XCircle, Bell, Clock, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Send, Filter, User, Car,
  TriangleAlert, MessageSquareWarning,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type AlertType = 'cancel' | 'reject' | 'sos';
type AlertStatus = 'new' | 'reviewed' | 'dismissed';

interface AlertRow {
  id: string;
  date: string;
  driverName: string;
  driverUserId: string | null;
  driverId: string | null;
  type: AlertType;
  rideId: string;
  reason: string;
  status: AlertStatus;
  rideCreatedAt: string;
}

const ALERT_TYPE_CONFIG: Record<AlertType, { label: string; color: string; icon: React.ElementType }> = {
  cancel: { label: 'Cancelacion', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Ban },
  reject: { label: 'Rechazo', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: XCircle },
  sos: { label: 'SOS', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: ShieldAlert },
};

const STATUS_CONFIG: Record<AlertStatus, { label: string; color: string }> = {
  new: { label: 'Nueva', color: 'bg-emerald-500/20 text-emerald-400' },
  reviewed: { label: 'Revisada', color: 'bg-blue-500/20 text-blue-400' },
  dismissed: { label: 'Descartada', color: 'bg-gray-500/20 text-gray-400' },
};

const TYPE_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'cancel', label: 'Cancelaciones' },
  { key: 'reject', label: 'Rechazos' },
  { key: 'sos', label: 'SOS' },
];

const TIME_FILTERS = ['Hoy', 'Esta semana', 'Este mes'] as const;

const PAGE_SIZE = 20;

function formatCreatedAt(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildDateFilter(timeFilter: string): string | null {
  if (timeFilter === 'Hoy') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  } else if (timeFilter === 'Esta semana') {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return weekAgo.toISOString();
  } else if (timeFilter === 'Este mes') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return monthStart.toISOString();
  }
  return null;
}

export default function DriverAlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<string>('Esta semana');
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [warningDialog, setWarningDialog] = useState<{
    open: boolean;
    alert: AlertRow | null;
    message: string;
  }>({ open: false, alert: null, message: '' });
  const [sendingWarning, setSendingWarning] = useState(false);

  const fetchAlerts = useCallback(async (currentTimeFilter: string) => {
    setLoading(true);
    try {
      const dateThreshold = buildDateFilter(currentTimeFilter);

      // --- 1. Fetch cancelled rides ---
      let cancelQuery = supabase
        .from('rides')
        .select('id, driver_id, created_at, status')
        .eq('status', 'cancelled');
      if (dateThreshold) {
        cancelQuery = cancelQuery.gte('created_at', dateThreshold);
      }
      const { data: cancelledRides, error: cancelError } = await cancelQuery;
      if (cancelError) throw cancelError;

      // --- 2. Fetch rides that may be "rejections" ---
      // A rejection is a ride that was assigned to a driver but then cancelled within 2 minutes
      let rejectQuery = supabase
        .from('rides')
        .select('id, driver_id, created_at, status, updated_at')
        .eq('status', 'cancelled')
        .not('driver_id', 'is', null);
      if (dateThreshold) {
        rejectQuery = rejectQuery.gte('created_at', dateThreshold);
      }
      const { data: allCancelledRides } = await rejectQuery;

      const rejectionRides = (allCancelledRides || []).filter(r => {
        const created = new Date(r.created_at).getTime();
        const updated = new Date(r.updated_at || r.created_at).getTime();
        const diff = updated - created;
        return diff >= 0 && diff <= 2 * 60 * 1000; // Within 2 minutes
      });

      // Exclude rejections from cancellations to avoid duplicates
      const rejectionIds = new Set(rejectionRides.map(r => r.id));
      const pureCancellations = (cancelledRides || []).filter(r => !rejectionIds.has(r.id));

      // --- 3. Fetch SOS alerts ---
      let sosQuery = supabase
        .from('sos')
        .select('id, user_id, ride_id, created_at, status');
      if (dateThreshold) {
        sosQuery = sosQuery.gte('created_at', dateThreshold);
      }
      const { data: sosAlerts } = await sosQuery;

      // --- Gather all driver IDs and user IDs ---
      const allDriverIds = new Set([
        ...pureCancellations.map(r => r.driver_id),
        ...rejectionRides.map(r => r.driver_id),
      ].filter(Boolean) as string[]);

      const sosUserIds = new Set((sosAlerts || []).map(s => s.user_id).filter(Boolean));

      // Map driver IDs to user IDs
      const driverToUserMap: Record<string, string> = {};
      const driverIdSet = [...allDriverIds];

      if (driverIdSet.length > 0) {
        const { data: driverRecords } = await supabase
          .from('drivers')
          .select('id, user_id')
          .in('id', driverIdSet);
        if (driverRecords) {
          driverRecords.forEach(d => { driverToUserMap[d.id] = d.user_id; });
        }
      }

      // Fetch all profile IDs (driver users + SOS users)
      const allUserIdsToFetch = new Set([
        ...Object.values(driverToUserMap),
        ...sosUserIds,
      ].filter(Boolean));

      const profileMap: Record<string, string> = {};
      if (allUserIdsToFetch.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', [...allUserIdsToFetch]);
        if (profiles) {
          profiles.forEach(p => { profileMap[p.id] = p.name; });
        }
      }

      // Map SOS user IDs to driver IDs for notification purposes
      const sosUserToDriverMap: Record<string, string | null> = {};
      if (sosUserIds.size > 0) {
        const { data: sosDriverRecords } = await supabase
          .from('drivers')
          .select('id, user_id')
          .in('user_id', [...sosUserIds]);
        if (sosDriverRecords) {
          const map: Record<string, string> = {};
          sosDriverRecords.forEach(d => { map[d.user_id] = d.id; });
          (sosAlerts || []).forEach(s => {
            sosUserToDriverMap[s.user_id] = map[s.user_id] || null;
          });
        }
      }

      // Build alert rows
      const alertRows: AlertRow[] = [];

      // Cancellations
      pureCancellations.forEach(r => {
        const userId = driverToUserMap[r.driver_id || ''];
        alertRows.push({
          id: `cancel-${r.id}`,
          date: formatCreatedAt(r.created_at),
          driverName: profileMap[userId || ''] || 'Desconocido',
          driverUserId: userId || null,
          driverId: r.driver_id || null,
          type: 'cancel',
          rideId: r.id,
          reason: 'Viaje cancelado por el conductor',
          status: 'new',
          rideCreatedAt: r.created_at,
        });
      });

      // Rejections
      rejectionRides.forEach(r => {
        const userId = driverToUserMap[r.driver_id || ''];
        alertRows.push({
          id: `reject-${r.id}`,
          date: formatCreatedAt(r.created_at),
          driverName: profileMap[userId || ''] || 'Desconocido',
          driverUserId: userId || null,
          driverId: r.driver_id || null,
          type: 'reject',
          rideId: r.id,
          reason: 'Viaje rechazado rapidamente despues de asignacion',
          status: 'new',
          rideCreatedAt: r.created_at,
        });
      });

      // SOS
      (sosAlerts || []).forEach(s => {
        const driverId = sosUserToDriverMap[s.user_id] || null;
        alertRows.push({
          id: `sos-${s.id}`,
          date: formatCreatedAt(s.created_at),
          driverName: profileMap[s.user_id] || 'Desconocido',
          driverUserId: s.user_id,
          driverId,
          type: 'sos',
          rideId: s.ride_id || '',
          reason: 'Alerta de emergencia activada',
          status: s.status === 'resolved' ? 'reviewed' : 'new',
          rideCreatedAt: s.created_at,
        });
      });

      // Sort by date descending
      alertRows.sort((a, b) => new Date(b.rideCreatedAt).getTime() - new Date(a.rideCreatedAt).getTime());

      setAlerts(alertRows);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al cargar alertas: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts(timeFilter);
  }, [timeFilter, fetchAlerts]);

  // Filtered data
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      const matchSearch = !search ||
        a.driverName.toLowerCase().includes(search.toLowerCase()) ||
        a.rideId.toLowerCase().includes(search.toLowerCase()) ||
        a.reason.toLowerCase().includes(search.toLowerCase());

      const matchType = typeFilter === 'all' || a.type === typeFilter;

      return matchSearch && matchType;
    });
  }, [alerts, search, typeFilter]);

  // Stats
  const stats = useMemo(() => {
    const cancellationsToday = alerts.filter(a => {
      if (a.type !== 'cancel') return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(a.rideCreatedAt) >= today;
    }).length;

    const rejectionsToday = alerts.filter(a => {
      if (a.type !== 'reject') return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(a.rideCreatedAt) >= today;
    }).length;

    const driversWithAlert = new Set(alerts.map(a => a.driverId).filter(Boolean)).size;

    const typeFilteredAlerts = typeFilter === 'all'
      ? alerts.filter(a => a.type === 'cancel' || a.type === 'reject')
      : alerts.filter(a => a.type === typeFilter);

    const driverAlertCounts: Record<string, number> = {};
    typeFilteredAlerts.forEach(a => {
      const driver = a.driverId || 'unknown';
      driverAlertCounts[driver] = (driverAlertCounts[driver] || 0) + 1;
    });

    const totalRidesForDrivers = Object.values(driverAlertCounts).reduce((s, c) => s + c, 0);
    const avgRate = Object.keys(driverAlertCounts).length > 0
      ? ((typeFilteredAlerts.filter(a => a.type === 'cancel').length / Math.max(typeFilteredAlerts.length, 1)) * 100).toFixed(1)
      : '0.0';

    return {
      cancellationsToday,
      rejectionsToday,
      driversWithAlert,
      avgCancelRate: `${avgRate}%`,
    };
  }, [alerts, typeFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / PAGE_SIZE));
  const paginatedAlerts = filteredAlerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = filteredAlerts.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, filteredAlerts.length);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, typeFilter]);

  // Actions
  const markAsReviewed = async (alertId: string) => {
    setUpdatingId(alertId);
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, status: 'reviewed' as AlertStatus } : a
    ));
    toast.success('Alerta marcada como revisada');
    setUpdatingId(null);
  };

  const dismissAlert = async (alertId: string) => {
    setUpdatingId(alertId);
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, status: 'dismissed' as AlertStatus } : a
    ));
    toast.success('Alerta descartada');
    setUpdatingId(null);
  };

  const openWarningDialog = (alert: AlertRow) => {
    const typeMessages: Record<AlertType, string> = {
      cancel: 'Hemos notado multiples cancelaciones en tu cuenta. Por favor, ten en cuenta que las cancelaciones frecuentes pueden afectar tu calificacion y estatus en la plataforma.',
      reject: 'Hemos detectado que has rechazado varios viajes recientemente. Te recordamos que aceptar viajes es importante para mantener un buen servicio.',
      sos: 'Se ha registrado una alerta de emergencia. Nuestro equipo de soporte revisara la situacion. Si necesitas ayuda, comunicate con nosotros.',
    };
    setWarningDialog({
      open: true,
      alert,
      message: typeMessages[alert.type],
    });
  };

  const sendWarning = async () => {
    if (!warningDialog.alert || !warningDialog.alert.driverUserId) {
      toast.error('No se puede enviar la notificacion: usuario no encontrado');
      return;
    }

    setSendingWarning(true);
    try {
      const { error } = await supabase.from('app_notifications').insert({
        user_id: warningDialog.alert.driverUserId,
        title: 'Alerta de Administracion',
        message: warningDialog.message,
        type: 'warning',
        is_read: false,
      });

      if (error) throw error;

      // Mark alert as reviewed
      setAlerts(prev => prev.map(a =>
        a.id === warningDialog.alert!.id ? { ...a, status: 'reviewed' as AlertStatus } : a
      ));

      toast.success(`Advertencia enviada a ${warningDialog.alert.driverName}`);
      setWarningDialog({ open: false, alert: null, message: '' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al enviar advertencia: ${message}`);
    } finally {
      setSendingWarning(false);
    }
  };

  const handleTimeFilterChange = (tf: string) => {
    setTimeFilter(tf);
    setPage(1);
  };

  const statCards = [
    { label: 'Cancelaciones Hoy', value: stats.cancellationsToday, color: 'text-red-400', icon: Ban },
    { label: 'Rechazos Hoy', value: stats.rejectionsToday, color: 'text-amber-400', icon: XCircle },
    { label: 'Conductores con Alerta', value: stats.driversWithAlert, color: 'text-purple-400', icon: Car },
    { label: 'Tasa de Cancelacion', value: stats.avgCancelRate, color: 'text-cyan-400', icon: TriangleAlert },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Alertas de Conductores</h1>
        <p className="text-gray-400 mt-1">Monitoreo de cancelaciones y rechazos de conductores</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              className="glass rounded-xl p-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <Icon className={`w-4 h-4 ${stat.color} opacity-60`} />
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">Filtros</span>
        </div>

        {/* Search + Time filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por conductor, ID de viaje o motivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
            />
          </div>
          <div className="flex gap-2">
            {TIME_FILTERS.map((tf) => (
              <button
                key={tf}
                onClick={() => handleTimeFilterChange(tf)}
                className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  timeFilter === tf
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Alert type filters */}
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((tf) => {
            const cfg = tf.key !== 'all' ? ALERT_TYPE_CONFIG[tf.key as AlertType] : null;
            const Icon = cfg?.icon || AlertTriangle;
            return (
              <button
                key={tf.key}
                onClick={() => setTypeFilter(tf.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  typeFilter === tf.key
                    ? cfg
                      ? `${cfg.color.split(' ')[0]} ${cfg.color.split(' ')[1]} border ${cfg.color.split(' ')[2]}`
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
            <p className="text-sm">Cargando alertas...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Conductor</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Tipo</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Viaje ID</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Motivo</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {paginatedAlerts.map((alert, i) => {
                      const typeCfg = ALERT_TYPE_CONFIG[alert.type];
                      const statusCfg = STATUS_CONFIG[alert.status];
                      const TypeIcon = typeCfg.icon;
                      const isUpdating = updatingId === alert.id;

                      return (
                        <motion.tr
                          key={alert.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 + i * 0.02 }}
                        >
                          <td className="px-5 py-3 text-sm text-gray-400 whitespace-nowrap">{alert.date}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                                <User className="w-3.5 h-3.5 text-gray-400" />
                              </div>
                              <span className="text-sm text-white">{alert.driverName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeCfg.color}`}>
                              <TypeIcon className="w-3 h-3" />
                              {typeCfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-cyan-400 font-mono hidden md:table-cell">
                            {alert.rideId ? alert.rideId.slice(0, 8).toUpperCase() : 'N/A'}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-400 hidden lg:table-cell max-w-[200px] truncate">{alert.reason}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {alert.status === 'new' && (
                                <>
                                  <button
                                    onClick={() => markAsReviewed(alert.id)}
                                    disabled={isUpdating}
                                    className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                                    title="Marcar como revisada"
                                  >
                                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => dismissAlert(alert.id)}
                                    disabled={isUpdating}
                                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50"
                                    title="Descartar"
                                  >
                                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => openWarningDialog(alert)}
                                    disabled={isUpdating || !alert.driverUserId}
                                    className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                                    title="Enviar advertencia"
                                  >
                                    <Bell className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {alert.status === 'reviewed' && (
                                <span className="text-xs text-blue-400 flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  Revisada
                                </span>
                              )}
                              {alert.status === 'dismissed' && (
                                <span className="text-xs text-gray-500">Descartada</span>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {filteredAlerts.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron alertas</p>
              </div>
            )}

            {/* Pagination */}
            {filteredAlerts.length > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-white/5">
                <p className="text-xs text-gray-400">
                  Mostrando {showingFrom}-{showingTo} de {filteredAlerts.length} alertas
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Warning Dialog */}
      <AnimatePresence>
        {warningDialog.open && warningDialog.alert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setWarningDialog({ open: false, alert: null, message: '' })}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <MessageSquareWarning className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Enviar Advertencia</h2>
                  <p className="text-xs text-gray-400">Conductor: {warningDialog.alert.driverName}</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Mensaje de advertencia</label>
                <textarea
                  value={warningDialog.message}
                  onChange={(e) => setWarningDialog(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-amber-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all resize-none"
                  placeholder="Escribe el mensaje de advertencia..."
                />
              </div>

              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setWarningDialog({ open: false, alert: null, message: '' })}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:text-white hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={sendWarning}
                  disabled={sendingWarning || !warningDialog.message.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {sendingWarning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Enviar Advertencia
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

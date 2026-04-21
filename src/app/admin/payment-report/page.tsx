'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp, Wallet, CreditCard, Smartphone,
  Download, Search, Calendar, Loader2, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Filter, FileDown, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type PaymentMethod = 'cash' | 'wallet' | 'card' | 'sinpe';

interface PaymentRow {
  id: string;
  date: string;
  passenger: string;
  driver: string;
  price: number;
  commissionRate: number;
  commission: number;
  driverEarnings: number;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  wallet: 'Billetera',
  card: 'Tarjeta',
  sinpe: 'SINPE',
};

const PAYMENT_METHOD_ICONS: Record<PaymentMethod, React.ElementType> = {
  cash: DollarSign,
  wallet: Wallet,
  card: CreditCard,
  sinpe: Smartphone,
};

const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  wallet: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  card: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  sinpe: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const METHOD_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'cash', label: 'Efectivo' },
  { key: 'wallet', label: 'Billetera' },
  { key: 'card', label: 'Tarjeta' },
  { key: 'sinpe', label: 'SINPE' },
];

const PAGE_SIZE = 20;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDateString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function PaymentReportPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('rides')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query = query.lte('created_at', to.toISOString());
      }

      const { data: rideData, error } = await query;

      if (error) throw error;

      if (!rideData || rideData.length === 0) {
        setPayments([]);
        setLoading(false);
        return;
      }

      // Fetch rider profiles
      const riderIds = [...new Set(rideData.map(r => r.rider_id).filter(Boolean))];
      const profileMap: Record<string, string> = {};

      if (riderIds.length > 0) {
        const { data: riderProfiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', riderIds);
        if (riderProfiles) {
          riderProfiles.forEach(p => { profileMap[p.id] = p.name; });
        }
      }

      // Fetch driver records → profiles
      const driverIds = [...new Set(rideData.map(r => r.driver_id).filter(Boolean))];
      const driverMap: Record<string, string> = {};

      if (driverIds.length > 0) {
        const { data: driverRecords } = await supabase
          .from('drivers')
          .select('id, user_id')
          .in('id', driverIds);
        if (driverRecords) {
          const driverIdToUserId: Record<string, string> = {};
          driverRecords.forEach(d => { driverIdToUserId[d.id] = d.user_id; });
          const driverUserIds = Object.values(driverIdToUserId).filter(Boolean);

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

      const mapped: PaymentRow[] = rideData.map(r => {
        const rate = r.commission_rate || 0.15;
        const price = r.price || 0;
        const commission = price * rate;
        const driverEarnings = r.driver_earnings ?? (price - commission);
        return {
          id: r.id,
          date: formatDate(r.created_at),
          passenger: profileMap[r.rider_id] || 'Desconocido',
          driver: driverMap[r.driver_id || ''] || 'Sin asignar',
          price,
          commissionRate: rate,
          commission: Math.round(commission),
          driverEarnings: Math.round(driverEarnings),
          paymentMethod: (r.payment_method as PaymentMethod) || 'cash',
          paymentStatus: r.payment_status || 'paid',
        };
      });

      setPayments(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al cargar pagos: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Filtered data
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const matchSearch = !search ||
        p.passenger.toLowerCase().includes(search.toLowerCase()) ||
        p.driver.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase());

      const matchMethod = methodFilter === 'all' || p.paymentMethod === methodFilter;

      return matchSearch && matchMethod;
    });
  }, [payments, search, methodFilter]);

  // Stats from ALL payments (before client-side filter for search, but after date filter)
  const stats = useMemo(() => {
    const methodFiltered = methodFilter === 'all'
      ? payments
      : payments.filter(p => p.paymentMethod === methodFilter);
    return {
      totalIngresos: methodFiltered.reduce((sum, p) => sum + p.price, 0),
      totalComisiones: methodFiltered.reduce((sum, p) => sum + p.commission, 0),
      totalGananciasConductores: methodFiltered.reduce((sum, p) => sum + p.driverEarnings, 0),
      viajesPagados: methodFiltered.length,
    };
  }, [payments, methodFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const paginatedPayments = filteredPayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = filteredPayments.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(page * PAGE_SIZE, filteredPayments.length);

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
  useEffect(() => { setPage(1); }, [search, methodFilter]);

  // CSV Export
  const exportCSV = async () => {
    setExporting(true);
    try {
      const dataToExport = methodFilter === 'all'
        ? payments
        : payments.filter(p => p.paymentMethod === methodFilter);

      if (dataToExport.length === 0) {
        toast.error('No hay datos para exportar');
        setExporting(false);
        return;
      }

      const headers = [
        'Fecha', 'Pasajero', 'Conductor', 'Tarifa (CRC)', 'Comision (%)',
        'Comision (CRC)', 'Ganancia Conductor (CRC)', 'Metodo de Pago', 'Estado Pago'
      ];
      const rows = dataToExport.map(p => [
        p.date,
        `"${p.passenger}"`,
        `"${p.driver}"`,
        p.price.toString(),
        `${(p.commissionRate * 100).toFixed(1)}%`,
        p.commission.toString(),
        p.driverEarnings.toString(),
        PAYMENT_METHOD_LABELS[p.paymentMethod],
        p.paymentStatus,
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reporte-pagos-${toLocalDateString(new Date())}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('CSV exportado correctamente');
    } catch {
      toast.error('Error al exportar CSV');
    } finally {
      setExporting(false);
    }
  };

  const statCards = [
    { label: 'Total Ingresos', value: `₡${stats.totalIngresos.toLocaleString()}`, color: 'text-cyan-400', icon: DollarSign },
    { label: 'Total Comisiones', value: `₡${stats.totalComisiones.toLocaleString()}`, color: 'text-purple-400', icon: TrendingUp },
    { label: 'Ganancias Conductores', value: `₡${stats.totalGananciasConductores.toLocaleString()}`, color: 'text-emerald-400', icon: Wallet },
    { label: 'Viajes Pagados', value: stats.viajesPagados.toLocaleString(), color: 'text-amber-400', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Reporte de Pagos</h1>
          <p className="text-gray-400 mt-1">Analisis detallado de ingresos, comisiones y pagos de viajes completados</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={exporting || payments.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Exportar CSV
        </button>
      </div>

      {/* Stats Cards */}
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
              <p className={`text-xl lg:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
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

        {/* Date range + Search */}
        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por pasajero, conductor o ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white text-sm outline-none transition-all [color-scheme:dark]"
              />
            </div>
            <span className="text-gray-500 text-xs">a</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white text-sm outline-none transition-all [color-scheme:dark]"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="px-3 py-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white text-xs hover:bg-white/10 transition-all"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Payment method filters */}
        <div className="flex flex-wrap gap-2">
          {METHOD_FILTERS.map((mf) => (
            <button
              key={mf.key}
              onClick={() => setMethodFilter(mf.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                methodFilter === mf.key
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {mf.key !== 'all' && (() => {
                const Icon = PAYMENT_METHOD_ICONS[mf.key as PaymentMethod];
                return <Icon className="w-3.5 h-3.5" />;
              })()}
              {mf.label}
            </button>
          ))}
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
            <p className="text-sm">Cargando pagos...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Pasajero</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">Conductor</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Tarifa</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Comision</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">Ganancia</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Metodo</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {paginatedPayments.map((p, i) => {
                      const MethodIcon = PAYMENT_METHOD_ICONS[p.paymentMethod];
                      return (
                        <motion.tr
                          key={p.id}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 + i * 0.02 }}
                        >
                          <td className="px-5 py-3 text-sm text-gray-400 whitespace-nowrap">{p.date}</td>
                          <td className="px-5 py-3 text-sm text-white">{p.passenger}</td>
                          <td className="px-5 py-3 text-sm text-gray-400 hidden md:table-cell">{p.driver}</td>
                          <td className="px-5 py-3 text-sm text-white text-right font-medium">₡{p.price.toLocaleString()}</td>
                          <td className="px-5 py-3 text-sm text-purple-400 text-right hidden lg:table-cell">
                            <div>₡{p.commission.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-500">{(p.commissionRate * 100).toFixed(1)}%</div>
                          </td>
                          <td className="px-5 py-3 text-sm text-emerald-400 text-right hidden lg:table-cell">₡{p.driverEarnings.toLocaleString()}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${PAYMENT_METHOD_COLORS[p.paymentMethod]}`}>
                              <MethodIcon className="w-3 h-3" />
                              {PAYMENT_METHOD_LABELS[p.paymentMethod]}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {filteredPayments.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron pagos con los filtros seleccionados</p>
              </div>
            )}

            {/* Pagination */}
            {filteredPayments.length > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-white/5">
                <p className="text-xs text-gray-400">
                  Mostrando {showingFrom}-{showingTo} de {filteredPayments.length} pagos
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
    </div>
  );
}

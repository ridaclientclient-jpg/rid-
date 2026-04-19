'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
  Search, FileText, AlertTriangle, Shield, AlertCircle,
  MessageSquare, CheckCircle2, Eye, Clock, ChevronDown,
  ChevronUp, Headphones, Loader2, RefreshCw, User
} from 'lucide-react';
import { toast } from 'sonner';

type ReportStatus = 'pending' | 'reviewed' | 'resolved';

interface ReportData {
  id: string;
  type: string;
  user_id: string;
  user_name: string;
  description: string;
  status: ReportStatus;
  created_at: string;
  source: string;
}

const typeConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  incident: { label: 'Incidente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: AlertTriangle },
  fraud: { label: 'Fraude', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: Shield },
  sos: { label: 'SOS', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle },
  complaint: { label: 'Queja', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: MessageSquare },
};

const statusConfig: Record<ReportStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400' },
  reviewed: { label: 'Revisado', color: 'bg-blue-500/20 text-blue-400' },
  resolved: { label: 'Resuelto', color: 'bg-emerald-500/20 text-emerald-400' },
};

const sourceColors: Record<string, string> = {
  'Cliente': 'text-cyan-400',
  'Conductor': 'text-blue-400',
  'Courier': 'text-orange-400',
  'Marketplace': 'text-amber-400',
};

const typeFilters: string[] = ['Todos', 'Cliente', 'Conductor', 'Courier', 'Marketplace'];
const statusFilters: string[] = ['Todos', 'Pendientes', 'Revisados', 'Resueltos'];

function extractSource(description: string): string {
  if (description.includes('[Soporte Cliente]')) return 'Cliente';
  if (description.includes('[Soporte Conductor]')) return 'Conductor';
  if (description.includes('[Soporte Courier]')) return 'Courier';
  if (description.includes('[Soporte Marketplace]')) return 'Marketplace';
  return 'Otro';
}

function extractSubject(description: string): string {
  const match = description.match(/\[Soporte \w+\]\s*(.+)/);
  if (match) return match[1].split('\n')[0].trim();
  return description.split('\n')[0].substring(0, 80);
}

export default function SupportPage() {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching reports:', error);
        toast.error('Error al cargar reportes');
        setReports([]);
        return;
      }

      if (data) {
        // Enrich with user names
        const userIds = [...new Set(data.map((r: any) => r.user_id).filter(Boolean))];
        const userNames: Record<string, string> = {};

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

          if (profiles) {
            profiles.forEach((p: any) => {
              userNames[p.id] = p.name || 'Usuario';
            });
          }
        }

        const enriched: ReportData[] = data.map((r: any) => {
          const source = extractSource(r.description || '');
          return {
            id: r.id,
            type: r.type || 'complaint',
            user_id: r.user_id,
            user_name: userNames[r.user_id] || 'Usuario',
            description: r.description || '',
            status: (r.status as ReportStatus) || 'pending',
            created_at: r.created_at,
            source,
          };
        });

        setReports(enriched);
      }
    } catch (err) {
      console.error('Fetch reports error:', err);
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const updateStatus = async (id: string, newStatus: ReportStatus) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
      toast.success(`Reporte marcado como ${statusConfig[newStatus].label}`);
    } catch (err) {
      console.error('Update status error:', err);
      toast.error('Error al actualizar estado');
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchSearch = r.user_name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      r.source.toLowerCase().includes(search.toLowerCase());

    let matchSource = true;
    if (typeFilter !== 'Todos') {
      matchSource = r.source === typeFilter;
    }

    let matchStatus = true;
    switch (statusFilter) {
      case 'Pendientes': matchStatus = r.status === 'pending'; break;
      case 'Revisados': matchStatus = r.status === 'reviewed'; break;
      case 'Resueltos': matchStatus = r.status === 'resolved'; break;
    }

    return matchSearch && matchSource && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Soporte RIDA</h1>
            <p className="text-gray-400 mt-0.5">Mensajes de clientes, conductores, couriers y vendedores</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchReports}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl glass hover:bg-white/10 transition-all text-sm text-gray-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-amber-400">{reports.filter(r => r.status === 'pending').length} pendientes</span>
            <span className="flex items-center gap-1.5 text-blue-400">{reports.filter(r => r.status === 'reviewed').length} revisados</span>
            <span className="flex items-center gap-1.5 text-emerald-400">{reports.filter(r => r.status === 'resolved').length} resueltos</span>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por usuario, mensaje o fuente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {typeFilters.map((tab) => (
            <button
              key={tab}
              onClick={() => setTypeFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === tab
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="w-px bg-white/10 mx-1" />
          {statusFilters.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="ml-3 text-gray-400">Cargando reportes...</span>
        </div>
      )}

      {/* Reports List */}
      {!loading && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredReports.map((report, i) => {
              const sourceColor = sourceColors[report.source] || 'text-gray-400';
              const statusCfg = statusConfig[report.status];
              const subject = extractSubject(report.description);
              const isExpanded = expandedId === report.id;

              return (
                <motion.div
                  key={report.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass rounded-xl overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5`}>
                        <MessageSquare className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${sourceColor}`}>
                            {report.source}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                          <span className="text-[10px] text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(report.created_at).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-white mt-1">{subject}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          <span>{report.user_name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {report.status !== 'resolved' && (
                          <button
                            onClick={() => updateStatus(report.id, 'resolved')}
                            className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-all"
                            title="Marcar resuelto"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {report.status === 'pending' && (
                          <button
                            onClick={() => updateStatus(report.id, 'reviewed')}
                            className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all"
                            title="Marcar revisado"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : report.id)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 border-t border-white/5 pt-3">
                          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Detalle del Mensaje</h4>
                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{report.description}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {!loading && filteredReports.length === 0 && reports.length > 0 && (
            <div className="text-center py-16 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No se encontraron resultados para tu busqueda</p>
            </div>
          )}

          {!loading && reports.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Headphones className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Sin mensajes de soporte</p>
              <p className="text-sm mt-1">Los mensajes de clientes, conductores, couriers y vendedores apareceran aqui</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

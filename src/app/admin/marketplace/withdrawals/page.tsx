'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote, Search, CheckCircle2, XCircle, Clock,
  ChevronDown, RefreshCw, AlertTriangle, Building2,
  Wallet, ShieldCheck, User
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Withdrawal {
  id: string;
  amount: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  requested_at: string;
  processed_at: string | null;
  bank_details: any;
  notes: string | null;
  vendor_id: string;
  vendors: {
    store_name: string;
    profiles?: {
      name?: string;
      phone?: string;
      email?: string;
    };
  };
}

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  queued: { label: 'En Fila', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  processing: { label: 'Procesando', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', icon: RefreshCw },
  completed: { label: 'Completado', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  failed: { label: 'Fallido', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: XCircle },
  cancelled: { label: 'Cancelado', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', icon: XCircle },
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('queued');
  
  // Modals
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ id: string; type: 'approve' | 'reject'; amount: number; store: string } | null>(null);
  const [actionNotes, setActionNotes] = useState('');

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vendor_withdrawals')
        .select(`
          *,
          vendors:vendor_id (
            store_name,
            profiles:user_id (name, phone, email)
          )
        `)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setWithdrawals(data as any);
    } catch (err: any) {
      toast.error('Error al cargar retiros: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const filtered = useMemo(() => {
    return withdrawals.filter(w => {
      const matchesSearch = w.vendors?.store_name?.toLowerCase().includes(search.toLowerCase()) || 
                            w.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'all' ? true : w.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [withdrawals, search, filterStatus]);

  const handleProcessAction = async () => {
    if (!actionModal) return;
    setProcessingId(actionModal.id);
    
    try {
      const { data, error } = await supabase.rpc('admin_process_vendor_withdrawal', {
        p_withdrawal_id: actionModal.id,
        p_status: actionModal.type === 'approve' ? 'completed' : 'failed',
        p_notes: actionNotes || (actionModal.type === 'approve' ? 'Transferencia exitosa' : 'Rechazado por administrador')
      });

      if (error) throw error;
      
      const res = data as any;
      if (res.success) {
        toast.success(actionModal.type === 'approve' ? 'Retiro aprobado y marcado como completado' : 'Retiro rechazado. El saldo ha sido devuelto.');
        fetchWithdrawals();
        setActionModal(null);
        setActionNotes('');
      } else {
        toast.error(res.error || 'Error al procesar el retiro');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setProcessingId(null);
    }
  };

  const formatCRC = (amount: number) => `₡${Math.round(amount).toLocaleString('es-CR')}`;
  const formatDate = (date: string) => new Date(date).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-inner">
              <Banknote className="w-7 h-7 text-cyan-400" />
            </div>
            Gestión de Retiros
          </h1>
          <p className="text-slate-400 mt-2 text-lg">Revisa y aprueba las transferencias de ganancias de los vendedores.</p>
        </div>
        
        <button 
          onClick={fetchWithdrawals}
          className="p-4 rounded-2xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Sincronizar
        </button>
      </div>

      {/* ─── FILTERS ─── */}
      <div className="glass rounded-[2rem] p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID o tienda..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
          {['all', 'queued', 'completed', 'failed'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-6 py-4 rounded-xl font-bold whitespace-nowrap transition-all ${
                filterStatus === status 
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' 
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {status === 'all' ? 'Todos' : status === 'queued' ? 'Pendientes' : status === 'completed' ? 'Completados' : 'Fallidos'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── LIST ─── */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-500 animate-pulse">Cargando solicitudes...</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-[3rem] py-20 text-center border-2 border-dashed border-white/10">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Todo al Día</h3>
            <p className="text-slate-400">No hay retiros que coincidan con los filtros actuales.</p>
          </div>
        ) : (
          filtered.map(w => {
            const StatusIcon = statusMap[w.status].icon;
            const profile = w.vendors?.profiles;
            
            return (
              <motion.div 
                key={w.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-[2rem] p-6 border border-white/5 hover:border-white/10 transition-all flex flex-col xl:flex-row gap-6"
              >
                {/* Info Vendedor */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                      <Building2 className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tight">{w.vendors?.store_name || 'Tienda Desconocida'}</h3>
                      <p className="text-slate-500 text-sm flex items-center gap-2">
                        <User className="w-4 h-4" /> {profile?.name || 'N/A'} • {profile?.phone || 'Sin tel'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Datos Bancarios */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Datos para Transferencia</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-400">Banco</p>
                        <p className="text-white font-bold">{w.bank_details?.bank_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Cuenta IBAN</p>
                        <p className="text-cyan-400 font-bold font-mono text-sm tracking-widest">{w.bank_details?.account_number || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detalles Retiro */}
                <div className="xl:w-[400px] flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Monto a Enviar</p>
                      <p className="text-3xl font-black text-white tracking-tighter">{formatCRC(w.amount)}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 border ${statusMap[w.status].color}`}>
                      <StatusIcon className="w-4 h-4" />
                      {statusMap[w.status].label}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-slate-500"><span className="font-bold text-slate-400">Solicitado:</span> {formatDate(w.requested_at)}</p>
                    <p className="text-xs text-slate-500"><span className="font-bold text-slate-400">ID:</span> {w.id.split('-')[0]}</p>
                  </div>

                  {w.status === 'queued' ? (
                    <div className="flex gap-3 mt-4 pt-4 border-t border-white/10">
                      <button 
                        onClick={() => setActionModal({ id: w.id, type: 'reject', amount: w.amount, store: w.vendors?.store_name })}
                        className="flex-1 py-3 rounded-xl bg-white/5 text-red-400 font-bold hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/30"
                      >
                        Rechazar
                      </button>
                      <button 
                        onClick={() => setActionModal({ id: w.id, type: 'approve', amount: w.amount, store: w.vendors?.store_name })}
                        className="flex-[2] py-3 rounded-xl bg-cyan-500 text-white font-black shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        Aprobar y Marcar
                      </button>
                    </div>
                  ) : w.notes ? (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-xs text-slate-500"><span className="font-bold text-slate-400">Notas:</span> {w.notes}</p>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* ─── ACTION MODAL ─── */}
      <AnimatePresence>
        {actionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActionModal(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#0d1220] border border-white/10 rounded-[3rem] p-8 w-full max-w-md shadow-2xl">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${actionModal.type === 'approve' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-red-500/10 text-red-400'}`}>
                {actionModal.type === 'approve' ? <CheckCircle2 className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
              </div>
              <h3 className="text-2xl font-black text-white text-center mb-2 tracking-tight">
                {actionModal.type === 'approve' ? 'Aprobar Retiro' : 'Rechazar Retiro'}
              </h3>
              <p className="text-slate-400 text-center text-sm mb-6">
                ¿Estás seguro de {actionModal.type === 'approve' ? 'marcar como transferido' : 'rechazar'} <span className="font-bold text-white">{formatCRC(actionModal.amount)}</span> para <span className="font-bold text-white">{actionModal.store}</span>?
              </p>
              
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 mb-2">Notas (Opcional)</label>
                <textarea 
                  value={actionNotes}
                  onChange={e => setActionNotes(e.target.value)}
                  placeholder={actionModal.type === 'approve' ? 'Ej: Transferencia #123456' : 'Ej: IBAN incorrecto'}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-cyan-500/50 resize-none h-24"
                />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setActionModal(null)} className="flex-1 py-4 rounded-xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-all">Cancelar</button>
                <button 
                  onClick={handleProcessAction}
                  disabled={processingId !== null}
                  className={`flex-[2] py-4 rounded-xl text-white font-black transition-all flex items-center justify-center ${
                    actionModal.type === 'approve' ? 'bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20' : 'bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/20'
                  }`}
                >
                  {processingId === actionModal.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .glass {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

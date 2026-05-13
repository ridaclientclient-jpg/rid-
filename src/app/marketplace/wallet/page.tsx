'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  DollarSign, 
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Banknote
} from 'lucide-react';
import { supabase, type VendorWallet, type VendorTransaction } from '@/lib/supabase';
import { useVendorId } from '@/hooks/useVendorId';
import { toast } from 'sonner';

/* ─── HELPERS ─── */
const formatCRC = (amount: number) => {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-CR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/* ─── TYPES ─── */
interface WithdrawalRequest {
  id: string;
  amount: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  requested_at: string;
  bank_details: any;
}

export default function VendorWalletPage() {
  const { vendorId, loading: vendorLoading } = useVendorId();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState<VendorWallet | null>(null);
  const [transactions, setTransactions] = useState<VendorTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!vendorId) return;
    
    try {
      setLoading(true);
      
      // 1. Wallet
      const { data: walletData } = await supabase
        .from('vendor_wallets')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();
      
      if (walletData) setWallet(walletData);

      // 2. Transactions
      const { data: txData } = await supabase
        .from('vendor_transactions')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (txData) setTransactions(txData);

      // 3. Withdrawals
      const { data: wrData } = await supabase
        .from('vendor_withdrawals')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('requested_at', { ascending: false });
      
      if (wrData) setWithdrawals(wrData);

    } catch (err) {
      console.error('Wallet fetch error:', err);
      toast.error('Error al cargar la billetera');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleWithdrawalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId || !wallet) return;

    const amount = Number(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Monto inválido');
      return;
    }

    if (amount > wallet.balance) {
      toast.error('Saldo insuficiente');
      return;
    }

    if (amount < 10000) {
      toast.error('El monto mínimo de retiro es ₡10,000');
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await supabase.rpc('request_vendor_withdrawal', {
        p_vendor_id: vendorId,
        p_amount: amount,
        p_bank_details: {
          bank_name: bankName,
          account_number: accountNumber
        }
      });

      if (error) throw error;

      const res = data as any;
      if (res.success) {
        toast.success(res.message || 'Solicitud enviada correctamente');
        setIsWithdrawing(false);
        setWithdrawAmount('');
        setBankName('');
        setAccountNumber('');
        fetchData();
      } else {
        toast.error(res.error || 'Error al procesar solicitud');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  if (vendorLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Wallet className="w-8 h-8 text-cyan-400" />
            Billetera <span className="text-cyan-400">RIDA</span>
          </h1>
          <p className="text-slate-400 mt-2">Gestiona tus ganancias y solicita retiros bancarios.</p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsWithdrawing(true)}
          className="px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black shadow-[0_10px_30px_rgba(6,182,212,0.3)] flex items-center gap-3"
        >
          <Banknote className="w-5 h-5" />
          RETIRAR GANANCIAS
        </motion.button>
      </div>

      {/* ─── BALANCE CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Balance */}
        <div className="glass rounded-[2rem] p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-20 h-20 text-white" />
          </div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Saldo Disponible</p>
          <h2 className="text-4xl font-black text-white tracking-tight">
            {formatCRC(wallet?.balance || 0)}
          </h2>
          <div className="mt-6 flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl w-fit border border-emerald-500/20">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold">Listos para retirar</span>
          </div>
        </div>

        {/* Total Earned */}
        <div className="glass rounded-[2rem] p-8 relative overflow-hidden group">
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">Ganancias Totales</p>
          <h2 className="text-4xl font-black text-white tracking-tight">
            {formatCRC(wallet?.total_earned || 0)}
          </h2>
          <p className="mt-6 text-slate-500 text-xs font-medium">Acumulado desde la apertura</p>
        </div>

        {/* Pending / In Queue */}
        <div className="glass rounded-[2rem] p-8 relative overflow-hidden group">
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-2">En Proceso de Retiro</p>
          <h2 className="text-4xl font-black text-amber-400 tracking-tight">
            {formatCRC(wallet?.pending_balance || 0)}
          </h2>
          <div className="mt-6 flex items-center gap-2 text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl w-fit border border-amber-500/20">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold">Validando transferencias</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ─── RECENT TRANSACTIONS ─── */}
        <div className="glass rounded-[2.5rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
                <History className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Historial Reciente</h3>
            </div>
          </div>

          <div className="space-y-4">
            {transactions.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <History className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-slate-500 font-medium">No hay transacciones registradas</p>
              </div>
            ) : (
              transactions.map((tx) => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      tx.type === 'earning' 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {tx.type === 'earning' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-white font-black text-sm tracking-tight">{tx.description || 'Transacción'}</p>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black tracking-tighter ${
                      tx.type === 'earning' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {tx.type === 'earning' ? '+' : '-'}{formatCRC(Math.abs(Number(tx.amount)))}
                    </p>
                    <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── WITHDRAWAL REQUESTS ─── */}
        <div className="glass rounded-[2.5rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Estado de Retiros</h3>
            </div>
          </div>

          <div className="space-y-4">
            {withdrawals.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Banknote className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-slate-500 font-medium">Aún no has solicitado retiros</p>
              </div>
            ) : (
              withdrawals.map((wr) => (
                <div 
                  key={wr.id}
                  className="p-5 rounded-3xl bg-white/[0.02] border border-white/5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        wr.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        wr.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        wr.status === 'cancelled' ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                      }`}>
                        {wr.status === 'queued' ? 'En Fila' : wr.status === 'processing' ? 'Procesando' : 
                         wr.status === 'completed' ? 'Completado' : wr.status === 'failed' ? 'Fallido' : 'Cancelado'}
                      </div>
                      <span className="text-slate-500 text-[10px] font-bold tracking-widest uppercase">
                        {formatDate(wr.requested_at)}
                      </span>
                    </div>
                    <p className="text-xl font-black text-white tracking-tighter">
                      {formatCRC(wr.amount)}
                    </p>
                  </div>
                  
                  {wr.status === 'queued' && (
                    <div className="bg-white/[0.03] rounded-2xl p-4 flex items-center gap-4">
                      <AlertCircle className="w-5 h-5 text-amber-400" />
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        Tu retiro está siendo validado. Las transferencias se procesan los días hábiles.
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── WITHDRAWAL MODAL ─── */}
      <AnimatePresence>
        {isWithdrawing && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWithdrawing(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg glass-strong rounded-[3rem] border border-white/10 p-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Building2 className="w-32 h-32 text-white" />
              </div>

              <div className="relative z-10">
                <h2 className="text-2xl font-black text-white tracking-tight mb-2">Solicitar Retiro</h2>
                <p className="text-slate-400 text-sm mb-8">El monto mínimo es de ₡10,000.</p>

                <form onSubmit={handleWithdrawalRequest} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 px-1">
                      Monto a Retirar
                    </label>
                    <div className="relative">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-cyan-500 font-bold">₡</div>
                      <input 
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="10000"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-5 text-white font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 px-1">
                        Nombre del Banco
                      </label>
                      <input 
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="Ej: BCR, BNCR, BAC"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 px-1">
                        Número de Cuenta (IBAN)
                      </label>
                      <input 
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="CR00..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button
                      type="button"
                      onClick={() => setIsWithdrawing(false)}
                      className="flex-1 py-4 rounded-2xl bg-white/5 text-slate-300 font-black hover:bg-white/10 transition-all"
                    >
                      CANCELAR
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>ENVIAR SOLICITUD <ArrowRight className="w-5 h-5" /></>
                      )}
                    </button>
                  </div>
                </form>
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
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .glass-strong {
          background: rgba(10, 15, 29, 0.95);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }
        .glow-cyan:hover {
          box-shadow: 0 0 40px rgba(6, 182, 212, 0.15);
        }
      `}</style>
    </div>
  );
}

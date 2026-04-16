'use client';

import { motion } from 'framer-motion';
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft, CreditCard, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Wallet, type Transaction } from '@/lib/supabase';
import { useState, useEffect, useCallback } from 'react';

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  if (diffDay === 1) return 'Ayer';
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return date.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

function getTransactionIcon(type: string) {
  switch (type) {
    case 'credit':
      return { icon: ArrowDownLeft, color: 'bg-emerald-500/20', textColor: 'text-emerald-400' };
    case 'debit':
    case 'ride_payment':
    case 'withdrawal':
      return { icon: ArrowUpRight, color: 'bg-red-500/20', textColor: 'text-red-400' };
    case 'commission':
      return { icon: ArrowUpRight, color: 'bg-amber-500/20', textColor: 'text-amber-400' };
    default:
      return { icon: ArrowUpRight, color: 'bg-gray-500/20', textColor: 'text-gray-400' };
  }
}

function getTransactionSign(type: string): number {
  return type === 'credit' ? 1 : -1;
}

export default function ClientWallet() {
  const { user } = useAuthStore();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletAndTransactions = useCallback(async (userId: string) => {
    try {
      setError(null);

      // Try to fetch wallet
      let { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      // If wallet doesn't exist, auto-create one
      if (walletError || !walletData) {
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .upsert({
            user_id: userId,
            balance: 0,
            total_earnings: 0,
            total_withdrawn: 0,
          }, { onConflict: 'user_id' })
          .select()
          .single();

        if (createError) {
          console.error('Error creating wallet:', createError);
          setError('No se pudo crear la billetera');
          setLoading(false);
          return;
        }
        walletData = newWallet;
      }

      setWallet(walletData);

      // Fetch transactions
      if (walletData) {
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (txError) {
          console.error('Error fetching transactions:', txError);
          setTransactions([]);
        } else {
          setTransactions(txData || []);
        }
      }
    } catch (err) {
      console.error('Wallet fetch error:', err);
      setError('Error al cargar la billetera');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchWalletAndTransactions(user.id);
    }
  }, [user?.id, fetchWalletAndTransactions]);

  const handleRecargar = async () => {
    if (!wallet || actionLoading) return;
    setActionLoading(true);
    try {
      // Insert credit transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          amount: 5000,
          type: 'credit',
          status: 'completed',
          description: 'Recarga de saldo',
        });

      if (txError) throw txError;

      // Update wallet balance
      const newBalance = wallet.balance + 5000;
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', wallet.id);

      if (updateError) throw updateError;

      setWallet({ ...wallet, balance: newBalance });
      setTransactions(prev => [{
        id: `temp-${Date.now()}`,
        wallet_id: wallet.id,
        amount: 5000,
        type: 'credit' as const,
        status: 'completed' as const,
        description: 'Recarga de saldo',
        created_at: new Date().toISOString(),
      }, ...prev]);

      toast.success('Recarga exitosa: +₡5,000');
    } catch (err: any) {
      console.error('Recargar error:', err);
      toast.error('Error al recargar saldo');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetirar = async () => {
    if (!wallet || actionLoading) return;
    if (wallet.balance < 10000) {
      toast.error('Saldo insuficiente. Minimo ₡10,000 para retirar');
      return;
    }
    setActionLoading(true);
    try {
      const withdrawalAmount = wallet.balance;

      // Insert withdrawal transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          amount: withdrawalAmount,
          type: 'withdrawal',
          status: 'completed',
          description: 'Retiro de saldo',
        });

      if (txError) throw txError;

      // Update wallet balance
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          balance: 0,
          total_withdrawn: wallet.total_withdrawn + withdrawalAmount,
        })
        .eq('id', wallet.id);

      if (updateError) throw updateError;

      setWallet({ ...wallet, balance: 0, total_withdrawn: wallet.total_withdrawn + withdrawalAmount });
      setTransactions(prev => [{
        id: `temp-${Date.now()}`,
        wallet_id: wallet.id,
        amount: withdrawalAmount,
        type: 'withdrawal' as const,
        status: 'completed' as const,
        description: 'Retiro de saldo',
        created_at: new Date().toISOString(),
      }, ...prev]);

      toast.info('Retiro procesado en 24h');
    } catch (err: any) {
      console.error('Retirar error:', err);
      toast.error('Error al procesar retiro');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-white">Billetera</h1>
        </motion.div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-white">Billetera</h1>
        </motion.div>
        <div className="glass rounded-2xl p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{error}</p>
          <button onClick={() => user?.id && fetchWalletAndTransactions(user.id)} className="mt-3 text-xs text-cyan-400 hover:underline">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Billetera</h1>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-blue-600/30 to-cyan-500/30 glass-strong rounded-2xl p-6 text-center border border-cyan-500/20">
        <WalletIcon className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Saldo disponible</p>
        <p className="text-3xl font-bold text-white mt-1">₡{(wallet?.balance ?? 0).toLocaleString()}</p>
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleRecargar}
            disabled={actionLoading}
            className="flex-1 btn-neon text-white text-sm font-medium py-2.5 rounded-xl flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Recargar
          </button>
          <button
            onClick={handleRetirar}
            disabled={actionLoading || (wallet?.balance ?? 0) < 10000}
            className="flex-1 border border-cyan-500/30 text-cyan-400 text-sm font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            Retirar
          </button>
        </div>
      </motion.div>

      <div className="flex gap-3">
        <button onClick={() => toast.success('Metodo de pago agregado')} className="flex-1 glass rounded-xl p-3 flex items-center gap-2 hover:bg-white/5">
          <CreditCard className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-gray-300">Agregar tarjeta</span>
        </button>
        <button onClick={() => toast.info('Transferencia no disponible')} className="flex-1 glass rounded-xl p-3 flex items-center gap-2 hover:bg-white/5">
          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-gray-300">Transferir</span>
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Transacciones</h3>
        <div className="space-y-2">
          {transactions.length === 0 && (
            <div className="glass rounded-xl p-6 text-center">
              <p className="text-xs text-gray-500">No hay transacciones</p>
            </div>
          )}
          {transactions.map(tx => {
            const config = getTransactionIcon(tx.type);
            const sign = getTransactionSign(tx.type);
            const IconComponent = config.icon;
            return (
              <div key={tx.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}>
                  <IconComponent className={`w-4 h-4 ${config.textColor}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white">{tx.description || tx.type}</p>
                  <p className="text-xs text-gray-500">{formatRelativeTime(tx.created_at)}</p>
                </div>
                <span className={`text-sm font-semibold ${sign > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {sign > 0 ? '+' : ''}₡{tx.amount.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

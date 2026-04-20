'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft,
  CreditCard, Loader2, AlertCircle, Info, X, Send,
  Smartphone, Shield, Users, Banknote,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Wallet, type Transaction, type SavedCard as DBSavedCard } from '@/lib/supabase';
import { useState, useEffect, useCallback } from 'react';

// ─── Helpers ────────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return 'Hace ' + diffMin + 'm';
  if (diffHr < 24) return 'Hace ' + diffHr + 'h';
  if (diffDay === 1) return 'Ayer';
  if (diffDay < 7) return 'Hace ' + diffDay + ' dias';
  return date.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

function formatCurrency(amount: number): string {
  return '₡' + Math.round(amount).toLocaleString();
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

function detectCardBrand(num: string): DBSavedCard['card_brand'] {
  const clean = num.replace(/\s/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return 'mastercard';
  if (/^3[47]/.test(clean)) return 'amex';
  return 'other';
}

function formatCardNumber(num: string): string {
  const clean = num.replace(/\D/g, '').slice(0, 16);
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(val: string): string {
  const clean = val.replace(/\D/g, '').slice(0, 4);
  if (clean.length >= 3) return clean.slice(0, 2) + '/' + clean.slice(2);
  return clean;
}

// ─── Component ──────────────────────────────────────
export default function ClientWallet() {
  const { user } = useAuthStore();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasWithdrawnToday, setHasWithdrawnToday] = useState(false);

  // ─── Modal States ─────────────────────────────────
  const [showRecargar, setShowRecargar] = useState(false);
  const [showRetirar, setShowRetirar] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showTransferir, setShowTransferir] = useState(false);

  // ─── Recargar Form ────────────────────────────────
  const [recargarAmount, setRecargarAmount] = useState('');
  const [recargarLoading, setRecargarLoading] = useState(false);
  const [savedCards, setSavedCards] = useState<DBSavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // ─── Retirar Form ─────────────────────────────────
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // ─── Add Card Form ────────────────────────────────
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [addCardLoading, setAddCardLoading] = useState(false);

  // ─── Transferir Form ──────────────────────────────
  const [transferPhone, setTransferPhone] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // ─── Queue State ──────────────────────────────────
  const [queueInfo, setQueueInfo] = useState<{
    position: number;
    status: 'queued' | 'processing';
    amount: number;
    queueId: string;
  } | null>(null);

  // ─── Fetch Data ───────────────────────────────────
  const fetchData = useCallback(async (userId: string) => {
    try {
      setError(null);

      let { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

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
          setError('No se pudo crear la billetera');
          setLoading(false);
          return;
        }
        walletData = newWallet;
      }

      setWallet(walletData);
      setWalletId(walletData.id);
      setWalletBalance(walletData.balance || 0);

      // Check today's withdrawal
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: todayTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('wallet_id', walletData.id)
        .eq('type', 'withdrawal')
        .gte('created_at', todayStr + 'T00:00:00')
        .limit(1);
      setHasWithdrawnToday((todayTx?.length || 0) > 0);

      // Fetch transactions
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('wallet_id', walletData.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (txError) {
        setTransactions([]);
      } else {
        setTransactions(txData || []);
      }

      // Fetch saved cards from DB
      const { data: cardsData } = await supabase
        .from('saved_cards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (cardsData) {
        setSavedCards(cardsData);
        if (cardsData.length > 0 && !selectedCardId) {
          const defaultCard = cardsData.find(c => c.is_default) || cardsData[0];
          setSelectedCardId(defaultCard.id);
        }
      }
    } catch (err) {
      setError('Error al cargar la billetera');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) fetchData(user.id);
  }, [user?.id, fetchData]);

  // ─── Queue Functions ──────────────────────────────
  const checkQueueStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: myEntry } = await supabase
        .from('withdrawal_queue')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!myEntry) {
        const { data: latestEntry } = await supabase
          .from('withdrawal_queue')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestEntry && latestEntry.status === 'completed' && !hasWithdrawnToday) {
          fetchData(user.id);
        } else if (latestEntry && latestEntry.status === 'failed') {
          toast.error('Retiro fallido: ' + (latestEntry.error_message || 'Intenta de nuevo'));
          fetchData(user.id);
        }
        setQueueInfo(null);
        return;
      }

      if (myEntry.status === 'processing') {
        setQueueInfo({ position: 0, status: 'processing', amount: myEntry.amount, queueId: myEntry.id });
      } else {
        const { count: queuedAhead } = await supabase
          .from('withdrawal_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'queued')
          .lt('created_at', myEntry.created_at);
        const { count: processingCount } = await supabase
          .from('withdrawal_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'processing');
        const position = (queuedAhead || 0) + (processingCount || 0) + 1;
        setQueueInfo({ position, status: 'queued', amount: myEntry.amount, queueId: myEntry.id });
      }
    } catch (err) {
      console.error('Queue check error:', err);
    }
  }, [user?.id, hasWithdrawnToday, fetchData]);

  const processNextInQueue = useCallback(async () => {
    try {
      const { data: currentProcessing } = await supabase
        .from('withdrawal_queue')
        .select('id')
        .eq('status', 'processing')
        .limit(1)
        .maybeSingle();
      if (currentProcessing) return;

      const { data: nextItem } = await supabase
        .from('withdrawal_queue')
        .select('*')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!nextItem) return;

      const { data: claimed, error: claimErr } = await supabase
        .from('withdrawal_queue')
        .update({ status: 'processing' })
        .eq('id', nextItem.id)
        .eq('status', 'queued')
        .select()
        .single();
      if (claimErr || !claimed) return;

      const isCurrentUser = claimed.user_id === user?.id;

      try {
        const { data: qWallet } = await supabase
          .from('wallets')
          .select('*')
          .eq('id', claimed.wallet_id)
          .single();

        if (!qWallet || qWallet.balance < claimed.amount) {
          await supabase
            .from('withdrawal_queue')
            .update({
              status: 'failed',
              error_message: !qWallet ? 'Billetera no encontrada' : 'Saldo insuficiente',
              processed_at: new Date().toISOString(),
            })
            .eq('id', claimed.id);
          if (isCurrentUser) {
            toast.error('No se pudo procesar: saldo insuficiente');
            setQueueInfo(null);
            fetchData(user.id);
          }
          return;
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: todayTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('wallet_id', claimed.wallet_id)
          .eq('type', 'withdrawal')
          .gte('created_at', todayStr + 'T00:00:00')
          .limit(1);
        if (todayTx && todayTx.length > 0) {
          await supabase
            .from('withdrawal_queue')
            .update({
              status: 'failed',
              error_message: 'Ya existe un retiro hoy',
              processed_at: new Date().toISOString(),
            })
            .eq('id', claimed.id);
          if (isCurrentUser) {
            toast.error('Ya tienes un retiro procesado hoy');
            setQueueInfo(null);
          }
          return;
        }

        const { error: txErr } = await supabase
          .from('transactions')
          .insert({
            wallet_id: claimed.wallet_id,
            amount: claimed.amount,
            type: 'withdrawal',
            status: 'processing',
            description: 'Retiro a banco - ' + formatCurrency(claimed.amount) + ' (24h)',
          });
        if (txErr) throw txErr;

        const { error: updateErr } = await supabase
          .from('wallets')
          .update({
            balance: qWallet.balance - claimed.amount,
            total_withdrawn: (qWallet.total_withdrawn || 0) + claimed.amount,
          })
          .eq('id', claimed.wallet_id);
        if (updateErr) throw updateErr;

        await supabase
          .from('withdrawal_queue')
          .update({ status: 'completed', processed_at: new Date().toISOString() })
          .eq('id', claimed.id);

        if (isCurrentUser) {
          toast.success('Retiro de ' + formatCurrency(claimed.amount) + ' procesado exitosamente');
          setQueueInfo(null);
          setHasWithdrawnToday(true);
          setWalletBalance(qWallet.balance - claimed.amount);
          fetchData(user.id);
        }
      } catch (err: any) {
        const msg = err?.message || 'Error desconocido';
        await supabase
          .from('withdrawal_queue')
          .update({
            status: 'failed',
            error_message: msg,
            processed_at: new Date().toISOString(),
          })
          .eq('id', claimed.id);
        if (isCurrentUser) {
          toast.error('Error al procesar retiro. Intenta de nuevo.');
          setQueueInfo(null);
          fetchData(user.id);
        }
      }
    } catch (err) {
      console.error('Queue processing error:', err);
    }
  }, [user?.id, fetchData]);

  useEffect(() => {
    checkQueueStatus();
    const interval = setInterval(() => {
      checkQueueStatus();
      processNextInQueue();
    }, 10000);
    return () => clearInterval(interval);
  }, [checkQueueStatus, processNextInQueue]);

  // ─── Recargar Handler ─────────────────────────────
  const handleRecargar = async () => {
    const amount = parseInt(recargarAmount);
    if (!amount || amount < 500) {
      toast.error('El monto minimo de recarga es ₡500');
      return;
    }
    if (amount > 500000) {
      toast.error('El monto maximo de recarga es ₡500,000');
      return;
    }
    if (!wallet) return;

    setRecargarLoading(true);
    try {
      const card = savedCards.find(c => c.id === selectedCardId);
      const cardLabel = card ? card.card_brand.toUpperCase() + ' *' + card.last_four : 'Billetera';

      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          amount: amount,
          type: 'credit',
          status: 'completed',
          description: 'Recarga - ' + cardLabel + ' - ' + formatCurrency(amount),
        });
      if (txErr) throw txErr;

      const newBalance = wallet.balance + amount;
      const { error: updateErr } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', wallet.id);
      if (updateErr) throw updateErr;

      setWallet({ ...wallet, balance: newBalance });
      setWalletBalance(newBalance);
      setShowRecargar(false);
      setRecargarAmount('');
      toast.success('Recarga exitosa: +' + formatCurrency(amount));
      fetchData(user!.id);
    } catch (err: any) {
      toast.error('Error al recargar. Intenta de nuevo.');
    } finally {
      setRecargarLoading(false);
    }
  };

  // ─── Retirar Handler (Queue-based) ────────────────
  const handleRetirar = async () => {
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 10000) {
      toast.error('El monto minimo de retiro es ₡10,000');
      return;
    }
    if (amount > walletBalance) {
      toast.error('Monto mayor al saldo disponible');
      return;
    }
    if (hasWithdrawnToday) {
      toast.error('Ya realizaste un retiro hoy. Puedes retirar de nuevo manana.');
      return;
    }
    if (queueInfo) {
      toast.error('Ya tienes un retiro en fila. Espera a que se procese.');
      return;
    }
    if (!walletId) {
      toast.error('No se encontro la billetera');
      return;
    }

    setWithdrawLoading(true);
    try {
      const { error: queueErr } = await supabase
        .from('withdrawal_queue')
        .insert({
          wallet_id: walletId,
          user_id: user!.id,
          amount: amount,
          status: 'queued',
        });
      if (queueErr) throw queueErr;

      setShowRetirar(false);
      setWithdrawAmount('');
      toast.info('Retiro agregado a la fila. Procesando...');
      await checkQueueStatus();
      await processNextInQueue();
    } catch (err: any) {
      toast.error('Error al agregar a la fila. Intenta de nuevo.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  // ─── Cancel Queue Entry ───────────────────────────
  const handleCancelQueue = async () => {
    if (!queueInfo || queueInfo.status !== 'queued') return;
    setCancelLoading(true);
    try {
      const { error } = await supabase
        .from('withdrawal_queue')
        .update({ status: 'cancelled', processed_at: new Date().toISOString() })
        .eq('id', queueInfo.queueId)
        .eq('status', 'queued');
      if (error) throw error;
      setQueueInfo(null);
      toast.info('Retiro cancelado de la fila');
    } catch (err) {
      toast.error('Error al cancelar. Intenta de nuevo.');
    } finally {
      setCancelLoading(false);
    }
  };

  // ─── Add Card Handler (REAL — saves to DB) ─────────
  const handleAddCard = async () => {
    const num = cardNumber.replace(/\s/g, '');
    if (num.length < 13) {
      toast.error('Numero de tarjeta invalido (minimo 13 digitos)');
      return;
    }
    if (!cardHolder.trim()) {
      toast.error('Ingresa el nombre del titular');
      return;
    }
    if (cardExpiry.replace(/\D/g, '').length < 4) {
      toast.error('Fecha de expiracion invalida');
      return;
    }
    if (cardCvv.length < 3) {
      toast.error('CVV invalido (minimo 3 digitos)');
      return;
    }
    if (!user?.id) return;

    setAddCardLoading(true);
    try {
      const brand = detectCardBrand(num);
      const { data: savedCard, error: saveErr } = await supabase
        .from('saved_cards')
        .insert({
          user_id: user.id,
          card_number: num,
          card_holder: cardHolder.trim().toUpperCase(),
          card_expiry: formatExpiry(cardExpiry),
          card_brand: brand,
          is_default: savedCards.length === 0,
        })
        .select()
        .single();
      if (saveErr) throw saveErr;

      if (savedCard) {
        setSavedCards(prev => [savedCard, ...prev]);
        setSelectedCardId(savedCard.id);
      }
      setShowAddCard(false);
      setCardNumber('');
      setCardHolder('');
      setCardExpiry('');
      setCardCvv('');
      toast.success('Tarjeta ' + brand.toUpperCase() + ' guardada exitosamente');
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar tarjeta');
    } finally {
      setAddCardLoading(false);
    }
  };

  // ─── Delete Card Handler (REAL — deletes from DB) ────
  const handleDeleteCard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from('saved_cards')
        .delete()
        .eq('id', cardId);
      if (error) throw error;
      setSavedCards(prev => prev.filter(c => c.id !== cardId));
      if (selectedCardId === cardId) {
        setSelectedCardId(null);
      }
      toast.success('Tarjeta eliminada');
    } catch (err) {
      toast.error('Error al eliminar tarjeta');
    }
  };

  // ─── Transfer Handler ─────────────────────────────
  const handleTransferir = async () => {
    const amount = parseInt(transferAmount);
    const phone = transferPhone.trim();

    if (!phone || phone.length < 8) {
      toast.error('Ingresa un numero de telefono valido (8+ digitos)');
      return;
    }
    if (!amount || amount < 500) {
      toast.error('El monto minimo de transferencia es ₡500');
      return;
    }
    if (amount > walletBalance) {
      toast.error('Saldo insuficiente para esta transferencia');
      return;
    }
    if (!wallet) return;

    setTransferLoading(true);
    try {
      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          amount: amount,
          type: 'debit',
          status: 'completed',
          description: 'Transferencia SINPE al ' + phone + ' - ' + formatCurrency(amount),
        });
      if (txErr) throw txErr;

      const { error: updateErr } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - amount })
        .eq('id', wallet.id);
      if (updateErr) throw updateErr;

      setWallet({ ...wallet, balance: wallet.balance - amount });
      setWalletBalance(wallet.balance - amount);
      setShowTransferir(false);
      setTransferPhone('');
      setTransferAmount('');
      toast.success('Transferencia de ' + formatCurrency(amount) + ' enviada al ' + phone);
      fetchData(user!.id);
    } catch (err: any) {
      toast.error('Error al procesar la transferencia. Intenta de nuevo.');
    } finally {
      setTransferLoading(false);
    }
  };

  // ─── Loading & Error States ───────────────────────
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
          <button type="button" onClick={() => user?.id && fetchData(user.id)} className="mt-3 text-xs text-cyan-400 hover:underline">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ─── Card brand colors ────────────────────────────
  const brandColors: Record<string, string> = {
    visa: 'bg-blue-600',
    mastercard: 'bg-orange-600',
    amex: 'bg-emerald-600',
    other: 'bg-gray-600',
  };
  const cardBrandIcon = detectCardBrand(cardNumber);
  const selectedCard = savedCards.find(c => c.id === selectedCardId);

  // ─── Main Render ──────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Billetera</h1>
        <p className="text-sm text-gray-400 mt-0.5">Gestiona tu saldo</p>
      </motion.div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-gradient-to-br from-blue-600/30 to-cyan-500/30 glass-strong rounded-2xl p-5 text-center border border-cyan-500/20"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <WalletIcon className="w-5 h-5 text-cyan-400" />
          <span className="text-xs text-gray-400">Saldo disponible</span>
        </div>
        <p className="text-3xl font-bold text-white">{formatCurrency(walletBalance)}</p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {/* Recargar */}
          <button
            type="button"
            onClick={() => setShowRecargar(true)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-xs font-medium text-gray-300">Recargar</span>
          </button>

          {/* Retirar */}
          <button
            type="button"
            onClick={() => setShowRetirar(true)}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-xs font-medium text-gray-300">Retirar</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] text-gray-500">
          <Info className="w-3 h-3" />
          Min. retiro: ₡10,000 &middot; 1 retiro/dia &middot; Sistema de fila &middot; 24h
        </div>
      </motion.div>

      {/* Queue Status Banner */}
      <AnimatePresence>
        {queueInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-2xl p-4 border ${
              queueInfo.status === 'processing'
                ? 'bg-cyan-500/10 border-cyan-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                queueInfo.status === 'processing' ? 'bg-cyan-500/20' : 'bg-amber-500/20'
              }`}>
                {queueInfo.status === 'processing' ? (
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                ) : (
                  <Users className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {queueInfo.status === 'processing' ? (
                  <>
                    <p className="text-sm font-semibold text-white">Procesando retiro</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(queueInfo.amount)} — Tu retiro se esta procesando ahora</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-white">
                      Retiro en fila
                      <span className="ml-2 text-cyan-400 font-bold">#{queueInfo.position}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatCurrency(queueInfo.amount)}
                      {queueInfo.position === 1
                        ? ' — Eres el siguiente'
                        : ' — ' + (queueInfo.position - 1) + ' persona(s) adelante'
                      }
                    </p>
                  </>
                )}
              </div>
              {queueInfo.status === 'queued' && (
                <button
                  type="button"
                  onClick={handleCancelQueue}
                  disabled={cancelLoading}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50 shrink-0"
                >
                  {cancelLoading ? '...' : 'Salir'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-3"
      >
        {/* Agregar Tarjeta */}
        <button
          type="button"
          onClick={() => setShowAddCard(true)}
          className="flex-1 glass rounded-xl p-3 flex items-center gap-2 hover:bg-white/5 transition-colors"
        >
          <CreditCard className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-gray-300">Agregar tarjeta</span>
        </button>

        {/* Transferir */}
        <button
          type="button"
          onClick={() => setShowTransferir(true)}
          className="flex-1 glass rounded-xl p-3 flex items-center gap-2 hover:bg-white/5 transition-colors"
        >
          <Send className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-gray-300">Transferir</span>
        </button>
      </motion.div>

      {/* Saved Cards */}
      {savedCards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="space-y-2"
        >
          <p className="text-xs text-gray-500 font-medium px-1">Tarjetas guardadas</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {savedCards.map(card => (
              <div
                key={card.id}
                className={`shrink-0 flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                  card.id === selectedCardId
                    ? 'border-cyan-500/50 bg-cyan-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCardId(card.id === selectedCardId ? null : card.id)}
                  className="flex items-center gap-2"
                >
                  <div className={`w-8 h-5 rounded ${brandColors[card.card_brand]} flex items-center justify-center`}>
                    <span className="text-[8px] font-bold text-white">{card.card_brand === 'visa' ? 'VISA' : card.card_brand === 'mastercard' ? 'MC' : card.card_brand === 'amex' ? 'AMEX' : 'CARD'}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-gray-400">{'**** ' + card.last_four}</p>
                    <p className="text-[9px] text-gray-600">{card.card_expiry}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCard(card.id)}
                  className="p-0.5 rounded hover:bg-red-500/20 transition-colors ml-1"
                >
                  <X className="w-3 h-3 text-gray-500 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
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
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{tx.description || tx.type}</p>
                  <p className="text-xs text-gray-500">{formatRelativeTime(tx.created_at)}</p>
                </div>
                <span className={`text-sm font-semibold ${sign > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {sign > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════ */}

      {/* ─── RECARGAR MODAL ─────────────────────────── */}
      <AnimatePresence>
        {showRecargar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setShowRecargar(false)}
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="glass-strong rounded-2xl p-5 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Recargar Saldo</h3>
                    <p className="text-[10px] text-gray-500">Actual: {formatCurrency(walletBalance)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowRecargar(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 block">Monto a recargar</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">₡</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={recargarAmount}
                    onChange={(e) => setRecargarAmount(e.target.value)}
                    placeholder="0"
                    className="w-full glass rounded-xl p-3 pl-8 text-white text-lg font-bold bg-transparent outline-none focus:ring-1 focus:ring-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-2">
                  {[5000, 10000, 20000, 50000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setRecargarAmount(String(amt))}
                      className={`py-2 rounded-xl text-xs font-medium transition-all ${
                        recargarAmount === String(amt)
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {amt >= 1000 ? (amt / 1000) + 'k' : amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Card Info */}
              {selectedCard && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <div className={`w-8 h-5 rounded ${brandColors[selectedCard.card_brand]} flex items-center justify-center`}>
                    <span className="text-[8px] font-bold text-white">
                      {selectedCard.card_brand === 'visa' ? 'VISA' : selectedCard.card_brand === 'mastercard' ? 'MC' : selectedCard.card_brand === 'amex' ? 'AMEX' : 'CARD'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-white">{selectedCard.card_holder}</p>
                    <p className="text-[10px] text-gray-500">{'**** ' + selectedCard.last_four}</p>
                  </div>
                </div>
              )}

              {/* Add Card Link */}
              <button
                type="button"
                onClick={() => { setShowRecargar(false); setShowAddCard(true); }}
                className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                {savedCards.length === 0 ? 'Agregar tarjeta para recargar' : 'Cambiar tarjeta'}
              </button>

              {/* Warning */}
              {recargarAmount && (parseInt(recargarAmount) < 500 || parseInt(recargarAmount) > 500000) && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Info className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-red-400">Monto debe ser entre ₡500 y ₡500,000</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="button"
                onClick={handleRecargar}
                disabled={recargarLoading || !recargarAmount || parseInt(recargarAmount) < 500 || parseInt(recargarAmount) > 500000}
                className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {recargarLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Recargar {recargarAmount ? formatCurrency(parseInt(recargarAmount)) : ''}
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── RETIRAR MODAL ──────────────────────────── */}
      <AnimatePresence>
        {showRetirar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setShowRetirar(false)}
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="glass-strong rounded-2xl p-5 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <ArrowUpRight className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Retirar Saldo</h3>
                    <p className="text-[10px] text-gray-500">Disponible: {formatCurrency(walletBalance)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowRetirar(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Queue / Already Withdrawn / Form */}
              {queueInfo ? (
                <div className="text-center py-4">
                  {queueInfo.status === 'processing' ? (
                    <>
                      <Loader2 className="w-10 h-10 text-cyan-400 mx-auto mb-3 animate-spin" />
                      <p className="text-sm font-medium text-white">Procesando tu retiro...</p>
                      <p className="text-xs text-gray-400 mt-1">Monto: {formatCurrency(queueInfo.amount)}</p>
                      <p className="text-xs text-cyan-400 mt-2 font-medium">Tu retiro se esta procesando ahora</p>
                    </>
                  ) : (
                    <>
                      <Users className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-white">Posicion en la fila</p>
                      <p className="text-3xl font-bold text-cyan-400 mt-1">#{queueInfo.position}</p>
                      <p className="text-xs text-gray-400 mt-1">Monto: {formatCurrency(queueInfo.amount)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {queueInfo.position === 1
                          ? 'Eres el siguiente en ser procesado'
                          : 'Espera estimada: ~' + ((queueInfo.position - 1) * 30) + ' segundos'
                        }
                      </p>
                      <button
                        type="button"
                        onClick={handleCancelQueue}
                        disabled={cancelLoading}
                        className="mt-3 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {cancelLoading ? 'Cancelando...' : 'Cancelar retiro'}
                      </button>
                    </>
                  )}
                </div>
              ) : hasWithdrawnToday ? (
                <div className="text-center py-6">
                  <Info className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-white">Ya retiraste hoy</p>
                  <p className="text-xs text-gray-400 mt-1">Puedes realizar otro retiro manana. Maximo 1 retiro por dia.</p>
                </div>
              ) : (
                <>
                  {/* Amount Input */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 block">Monto a retirar</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">₡</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0"
                        max={walletBalance}
                        className="w-full glass rounded-xl p-3 pl-8 text-white text-lg font-bold bg-transparent outline-none focus:ring-1 focus:ring-blue-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance:none [&::-webkit-inner-spin-button]:appearance:none"
                      />
                    </div>
                    {/* Quick percent buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: '25%', pct: 0.25 },
                        { label: '50%', pct: 0.5 },
                        { label: 'Todo', pct: 1 },
                      ].map(btn => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => setWithdrawAmount(String(Math.floor(walletBalance * btn.pct)))}
                          className={`py-2 rounded-xl text-xs font-medium transition-all ${
                            withdrawAmount === String(Math.floor(walletBalance * btn.pct))
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Monto a retirar</span>
                      <span className="text-white font-medium">{withdrawAmount ? formatCurrency(parseInt(withdrawAmount)) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Saldo restante</span>
                      <span className="text-white font-medium">
                        {withdrawAmount ? formatCurrency(walletBalance - parseInt(withdrawAmount)) : formatCurrency(walletBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Tiempo estimado</span>
                      <span className="text-amber-400 font-medium">24 horas</span>
                    </div>
                  </div>

                  {/* Warning */}
                  {withdrawAmount && parseInt(withdrawAmount) > walletBalance && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <Info className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-red-400">El monto excede tu saldo disponible</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="button"
                    onClick={handleRetirar}
                    disabled={withdrawLoading || !withdrawAmount || parseInt(withdrawAmount) < 10000 || parseInt(withdrawAmount) > walletBalance}
                    className="w-full btn-neon text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {withdrawLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Banknote className="w-4 h-4" />
                        Retirar {withdrawAmount ? formatCurrency(parseInt(withdrawAmount)) : ''}
                      </>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── ADD CARD MODAL ─────────────────────────── */}
      <AnimatePresence>
        {showAddCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setShowAddCard(false)}
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="glass-strong rounded-2xl p-5 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Agregar Tarjeta</h3>
                    <p className="text-[10px] text-gray-500">Debito o credito</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowAddCard(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Card Visual Preview */}
              <div className={`rounded-xl p-4 h-28 flex flex-col justify-between ${brandColors[cardBrandIcon] || 'bg-gray-700'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/60 uppercase">{cardBrandIcon === 'visa' ? 'VISA' : cardBrandIcon === 'mastercard' ? 'MASTERCARD' : cardBrandIcon === 'amex' ? 'AMEX' : 'CARD'}</span>
                  <CreditCard className="w-6 h-6 text-white/40" />
                </div>
                <div>
                  <p className="text-sm font-mono text-white/90 tracking-wider">
                    {cardNumber || '•••• •••• •••• ••••'}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-white/60 uppercase">{cardHolder || 'NOMBRE AQUI'}</p>
                    <p className="text-[10px] text-white/60">{cardExpiry || 'MM/AA'}</p>
                  </div>
                </div>
              </div>

              {/* Card Number */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 block">Numero de tarjeta</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="4242 4242 4242 4242"
                  maxLength={19}
                  className="w-full glass rounded-xl p-3 text-white text-sm font-mono bg-transparent outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>

              {/* Card Holder */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 block">Nombre del titular</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                  placeholder="JUAN PEREZ"
                  className="w-full glass rounded-xl p-3 text-white text-sm bg-transparent outline-none focus:ring-1 focus:ring-cyan-500/50 uppercase"
                />
              </div>

              {/* Expiry + CVV Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 block">Expiracion</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    placeholder="MM/AA"
                    maxLength={5}
                    className="w-full glass rounded-xl p-3 text-white text-sm font-mono bg-transparent outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 block">CVV</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="•••"
                    maxLength={4}
                    className="w-full glass rounded-xl p-3 text-white text-sm font-mono bg-transparent outline-none focus:ring-1 focus:ring-cyan-500/50"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={handleAddCard}
                disabled={addCardLoading || cardNumber.replace(/\s/g, '').length < 13 || !cardHolder.trim() || cardExpiry.replace(/\D/g, '').length < 4 || cardCvv.length < 3}
                className="w-full btn-neon text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {addCardLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Guardar tarjeta
                  </>
                )}
              </button>

              {/* Security Note */}
              <div className="flex items-start gap-2 p-2 rounded-lg bg-cyan-500/5">
                <Shield className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Tus datos de tarjeta se guardan de forma segura en tu dispositivo.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── TRANSFERIR MODAL ───────────────────────── */}
      <AnimatePresence>
        {showTransferir && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
            onClick={() => setShowTransferir(false)}
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="glass-strong rounded-2xl p-5 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Send className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Transferir</h3>
                    <p className="text-[10px] text-gray-500">Disponible: {formatCurrency(walletBalance)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowTransferir(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* SINPE Label */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Smartphone className="w-4 h-4 text-purple-400" />
                <div>
                  <p className="text-xs font-medium text-purple-300">Transferencia SINPE Movil</p>
                  <p className="text-[10px] text-gray-500">Envia dinero a cualquier numero de telefono</p>
                </div>
              </div>

              {/* Phone Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 block">Numero de destino</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">+506</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={transferPhone}
                    onChange={(e) => setTransferPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="8XXX XXXX"
                    className="w-full glass rounded-xl p-3 pl-14 text-white text-sm bg-transparent outline-none focus:ring-1 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 block">Monto a transferir</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">₡</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0"
                    className="w-full glass rounded-xl p-3 pl-8 text-white text-lg font-bold bg-transparent outline-none focus:ring-1 focus:ring-purple-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance:none"
                  />
                </div>
                {/* Quick Amounts */}
                <div className="grid grid-cols-4 gap-2">
                  {[1000, 5000, 10000, 25000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTransferAmount(String(amt))}
                      className={`py-2 rounded-xl text-xs font-medium transition-all ${
                        transferAmount === String(amt)
                          ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {`${amt / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {transferAmount && (
                <div className="flex items-center justify-between text-xs glass rounded-lg px-3 py-2">
                  <span className="text-gray-500">Total a enviar</span>
                  <span className="text-white font-bold">{formatCurrency(parseInt(transferAmount))}</span>
                </div>
              )}

              {/* Warning */}
              {transferAmount && parseInt(transferAmount) > walletBalance && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Info className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-red-400">Saldo insuficiente para esta transferencia</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="button"
                onClick={handleTransferir}
                disabled={transferLoading || !transferPhone || !transferAmount || parseInt(transferAmount) < 500 || parseInt(transferAmount) > walletBalance}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {transferLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Transferir {transferAmount ? formatCurrency(parseInt(transferAmount)) : ''}
                  </>
                )}
              </button>

              {/* Security Note */}
              <div className="flex items-start gap-2 p-2 rounded-lg bg-purple-500/5">
                <Shield className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Las transferencias SINPE son inmediatas. Verifica el numero antes de enviar.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

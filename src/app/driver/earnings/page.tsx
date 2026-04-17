'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver, type Ride, type Wallet, type Transaction } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Wallet as WalletIcon, TrendingUp, Clock, ChevronRight, ArrowDownCircle,
  Info, Calendar, CreditCard, Banknote, Loader2, Target,
  Gift, Flag, Zap, BarChart3, ArrowUpCircle, RefreshCw,
} from 'lucide-react';

interface WeeklyDay {
  day: string;
  amount: number;
  color: string;
}

interface TxDisplay {
  id: string;
  desc: string;
  amount: number;
  time: string;
  type: 'ride' | 'withdraw';
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

const ACHIEVEMENT_TABS = [
  { id: 'rides', label: 'Viajes', icon: CreditCard },
  { id: 'demand', label: 'Demanda', icon: Zap },
  { id: 'performance', label: 'Rendimiento', icon: BarChart3 },
];

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  return `Hace ${diffDays} dias`;
}

function formatCurrency(amount: number): string {
  return `₡${Math.round(amount).toLocaleString()}`;
}

export default function DriverEarnings() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [hasWithdrawnToday, setHasWithdrawnToday] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [totalWeekly, setTotalWeekly] = useState(0);
  const [weeklyData, setWeeklyData] = useState<WeeklyDay[]>([]);
  const [workHours, setWorkHours] = useState(0);
  const [transactions, setTransactions] = useState<TxDisplay[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [bonuses, setBonuses] = useState(0);
  const [activeTab, setActiveTab] = useState('rides');

  const maxAmount = Math.max(...weeklyData.map(d => d.amount), 1);
  const maxHours = 12;
  const dailyGoal = 75660;

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (driver) {
        setTotalEarnings(driver.total_earnings || 0);
        setWorkHours(driver.work_hours_today || 0);
      }

      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (wallet) {
        setWalletBalance(wallet.balance || 0);
        setBonuses(wallet.total_earnings ? wallet.total_earnings * 0.05 : 0);
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: recentRides } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driver?.id || user.id)
        .in('status', ['completed'])
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      const rides = recentRides || [];

      const weekMap: Record<string, number> = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        weekMap[key] = 0;
      }

      let todaySum = 0;
      let weekSum = 0;
      const todayStr = today.toISOString().slice(0, 10);

      for (const ride of rides) {
        const rideDate = new Date(ride.created_at);
        const dateKey = rideDate.toISOString().slice(0, 10);
        const earnings = ride.driver_earnings || ride.price * 0.85;
        if (weekMap.hasOwnProperty(dateKey)) {
          weekMap[dateKey] += earnings;
        }
        if (dateKey === todayStr) {
          todaySum += earnings;
        }
        weekSum += earnings;
      }

      setTodayEarnings(todaySum);
      setTotalWeekly(weekSum);

      const builtWeeklyData: WeeklyDay[] = Object.entries(weekMap).map(([dateKey, amount]) => {
        const d = new Date(dateKey + 'T12:00:00');
        return {
          day: DAY_NAMES[d.getDay()],
          amount,
          color: 'from-blue-600 to-cyan-500',
        };
      });
      setWeeklyData(builtWeeklyData);

      const { data: todayWithdrawals } = await supabase
        .from('transactions')
        .select('id')
        .eq('type', 'withdrawal')
        .gte('created_at', new Date(todayStr + 'T00:00:00').toISOString())
        .limit(1);
      setHasWithdrawnToday((todayWithdrawals?.length || 0) > 0);

      if (wallet) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('wallet_id', wallet.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (txData && txData.length > 0) {
          const mapped: TxDisplay[] = txData.map((tx: Transaction) => ({
            id: tx.id,
            desc: tx.description || (tx.type === 'withdrawal' ? 'Retiro a banco' : `Viaje ${tx.ride_id?.slice(0, 8) || ''}`),
            amount: tx.type === 'withdrawal' ? -Math.abs(tx.amount) : tx.amount,
            time: formatRelativeTime(tx.created_at),
            type: tx.type === 'withdrawal' ? 'withdraw' : 'ride',
          }));
          setTransactions(mapped);
        }
      }
    } catch (err) {
      console.error('Error fetching earnings data:', err);
      toast.error('Error al cargar datos de ganancias');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleWithdraw = async () => {
    if (!user?.id) return;

    if (hasWithdrawnToday) {
      toast.error('Ya realizaste un retiro hoy. Puedes retirar de nuevo manana.');
      return;
    }

    if (walletBalance < 10000) {
      toast.error('Saldo insuficiente. El minimo de retiro es ₡10,000');
      return;
    }

    setIsWithdrawing(true);
    try {
      const { data: wallet, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (walletErr || !wallet) {
        toast.error('No se encontro la billetera');
        setIsWithdrawing(false);
        return;
      }

      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          amount: walletBalance,
          type: 'withdrawal',
          status: 'processing',
          description: 'Retiro a banco',
        });

      if (txErr) {
        toast.error('Error al procesar retiro');
        setIsWithdrawing(false);
        return;
      }

      const { error: updateErr } = await supabase
        .from('wallets')
        .update({
          balance: 0,
          total_withdrawn: (wallet.total_withdrawn || 0) + walletBalance,
        })
        .eq('id', wallet.id);

      if (updateErr) {
        toast.error('Error al actualizar billetera');
        setIsWithdrawing(false);
        return;
      }

      setHasWithdrawnToday(true);
      setWalletBalance(0);
      toast.success('Retiro solicitado! Procesamiento: 24 horas.');
      fetchData();
    } catch (err) {
      console.error('Withdrawal error:', err);
      toast.error('Error al procesar retiro');
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando ganancias...</p>
        </div>
      </div>
    );
  }

  const goalPercent = Math.min((todayEarnings / dailyGoal) * 100, 100);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Ganancias</h1>
        <p className="text-sm text-gray-400 mt-0.5">Resumen de tus ingresos</p>
      </motion.div>

      {/* Today's Earnings Card - Like reference app */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Ingresos de hoy</p>
            <p className="text-3xl font-bold text-white mt-1">{formatCurrency(todayEarnings)}</p>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
        {/* Daily Goal */}
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Target className="w-3 h-3 text-cyan-400" />
              <span className="text-xs text-gray-400">Objetivo</span>
            </div>
            <span className="text-xs text-gray-300">{formatCurrency(dailyGoal)}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${goalPercent}%` }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-1">{Math.round(goalPercent)}% completado</p>
        </div>
      </motion.div>

      {/* Wallet Balance + Bonuses Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid grid-cols-2 gap-3"
      >
        {/* Wallet */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <WalletIcon className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-500">Saldo de la tarjeta</span>
          </div>
          <p className="text-lg font-bold text-white">CRC{walletBalance.toLocaleString()}</p>
          <button
            onClick={() => toast.info('Funcion de recarga proximamente')}
            className="mt-2 w-full py-1.5 rounded-lg bg-white/5 text-[10px] text-gray-300 font-medium hover:bg-white/10 transition-colors"
          >
            Recarga
          </button>
        </div>
        {/* Bonuses */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-500">Bonificaciones</span>
          </div>
          <p className="text-lg font-bold text-white">{formatCurrency(bonuses)}</p>
          <div className="flex items-center gap-1 mt-2 text-cyan-400">
            <ChevronRight className="w-3 h-3" />
            <span className="text-[10px] font-medium">Ver mas</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-2"
      >
        <div className="glass rounded-xl p-3 text-center">
          <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">15%</p>
          <p className="text-[10px] text-gray-500">Comision</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{workHours}h</p>
          <div className="mt-1 w-full bg-white/10 rounded-full h-1">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-1 rounded-full transition-all" style={{ width: `${(workHours / maxHours) * 100}%` }} />
          </div>
          <p className="text-[9px] text-gray-600 mt-0.5">de {maxHours}h</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <CreditCard className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{formatCurrency(totalWeekly)}</p>
          <p className="text-[10px] text-gray-500">Esta semana</p>
        </div>
      </motion.div>

      {/* Weekly Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.13 }}
        className="glass rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Esta Semana</span>
          </div>
          <span className="text-xs text-gray-500">{formatCurrency(totalWeekly)}</span>
        </div>
        {weeklyData.length > 0 ? (
          <div className="flex items-end gap-2 h-28">
            {weeklyData.map((data, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-gray-500">₡{(data.amount / 1000).toFixed(0)}k</span>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(data.amount / maxAmount) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className={`w-full rounded-t-lg bg-gradient-to-t ${data.color} opacity-80 hover:opacity-100 transition-opacity cursor-pointer`}
                />
                <span className="text-[10px] text-gray-400 font-medium">{data.day}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-28 text-gray-500 text-sm">
            Sin viajes esta semana
          </div>
        )}
      </motion.div>

      {/* Achievements Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="glass rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Logros</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {ACHIEVEMENT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
        {/* Tab Content */}
        <div className="min-h-[80px]">
          {activeTab === 'rides' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Viajes completados hoy</span>
                <span className="text-xs font-bold text-white">{weeklyData.reduce((a, d) => a + (d.amount > 0 ? 1 : 0), 0)}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Viajes esta semana</span>
                <span className="text-xs font-bold text-white">{weeklyData.filter(d => d.amount > 0).length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Aceptacion de viajes</span>
                <span className="text-xs font-bold text-emerald-400">92%</span>
              </div>
            </div>
          )}
          {activeTab === 'demand' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Solicitudes activas</span>
                <span className="text-xs font-bold text-emerald-400">Alta</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Zona con mas demanda</span>
                <span className="text-xs font-bold text-white">Centro</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Mejor horario</span>
                <span className="text-xs font-bold text-amber-400">7am - 9am</span>
              </div>
            </div>
          )}
          {activeTab === 'performance' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Calificacion promedio</span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-white">5.00</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Cancelaciones</span>
                <span className="text-xs font-bold text-white">2%</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-300">Tiempo de llegada prom.</span>
                <span className="text-xs font-bold text-emerald-400">4 min</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Withdraw Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <button
          onClick={handleWithdraw}
          disabled={isWithdrawing || hasWithdrawnToday}
          className={`w-full font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
            hasWithdrawnToday
              ? 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
              : 'btn-neon text-white'
          }`}
        >
          {isWithdrawing ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Banknote className="w-4 h-4" />
              {hasWithdrawnToday ? 'Retiro ya realizado hoy' : 'Retirar Ganancias'}
            </>
          )}
        </button>
        {hasWithdrawnToday && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
            <Info className="w-3 h-3" />
            Puedes retirar de nuevo manana. Minimo: ₡10,000. Tiempo: 24h.
          </div>
        )}
      </motion.div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400">Transacciones Recientes</h2>
          <button onClick={() => { fetchData(); toast.info('Datos actualizados'); }} className="p-1 rounded-lg hover:bg-white/5">
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
        {transactions.length > 0 ? (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {transactions.map((tx) => (
              <div key={tx.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'ride' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  {tx.type === 'ride' ? (
                    <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <ArrowDownCircle className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{tx.desc}</p>
                  <p className="text-xs text-gray-500">{tx.time}</p>
                </div>
                <p className={`text-sm font-semibold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tx.amount > 0 ? '+' : ''}₡{Math.abs(tx.amount).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Sin transacciones recientes
          </div>
        )}
      </motion.div>
    </div>
  );
}

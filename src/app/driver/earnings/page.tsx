'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  Wallet, TrendingUp, Clock, ChevronRight, ArrowDownCircle,
  Info, Calendar, CreditCard, Banknote,
} from 'lucide-react';

const weeklyData = [
  { day: 'Lun', amount: 18000, color: 'from-blue-600 to-cyan-500' },
  { day: 'Mar', amount: 22000, color: 'from-blue-600 to-cyan-500' },
  { day: 'Mie', amount: 25000, color: 'from-blue-600 to-cyan-500' },
  { day: 'Jue', amount: 20000, color: 'from-blue-600 to-cyan-500' },
  { day: 'Vie', amount: 28000, color: 'from-blue-600 to-cyan-500' },
  { day: 'Sab', amount: 35000, color: 'from-blue-600 to-cyan-500' },
  { day: 'Dom', amount: 15000, color: 'from-blue-600 to-cyan-500' },
];

const transactions = [
  { id: 'T-001', desc: 'Viaje Maria S. → Aerouerto', amount: 4500, time: 'Hace 2h', type: 'ride' },
  { id: 'T-002', desc: 'Viaje Luis R. → Cartago', amount: 3200, time: 'Hace 3h', type: 'ride' },
  { id: 'T-003', desc: 'Viaje Ana G. → Heredia', amount: 2800, time: 'Hace 5h', type: 'ride' },
  { id: 'T-004', desc: 'Viaje Pedro M. → Santa Ana', amount: 5100, time: 'Hace 6h', type: 'ride' },
  { id: 'T-005', desc: 'Viaje Laura J. → Alajuela', amount: 3900, time: 'Hace 7h', type: 'ride' },
  { id: 'T-006', desc: 'Retiro a banco', amount: -20000, time: 'Ayer', type: 'withdraw' },
];

const maxAmount = Math.max(...weeklyData.map(d => d.amount));

export default function DriverEarnings() {
  const { user } = useAuthStore();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [hasWithdrawnToday] = useState(false);

  const handleWithdraw = () => {
    if (hasWithdrawnToday) {
      toast.error('Ya realizaste un retiro hoy. Puedes retirar de nuevo manana.');
      return;
    }
    setIsWithdrawing(true);
    setTimeout(() => {
      setIsWithdrawing(false);
      toast.success('Retiro solicitado! Procesamiento: 24 horas. Minimo: ₡10,000');
    }, 1500);
  };

  const todayEarnings = weeklyData[weeklyData.length - 1].amount;
  const totalWeekly = weeklyData.reduce((sum, d) => sum + d.amount, 0);
  const workHours = 6.5;
  const maxHours = 12;

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Ganancias</h1>
        <p className="text-sm text-gray-400 mt-1">Resumen de tus ingresos</p>
      </motion.div>

      {/* Total Earnings Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-strong rounded-2xl p-6 bg-gradient-to-br from-blue-600/20 to-cyan-500/10 border border-cyan-500/20"
      >
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-gray-400">Ganancias Totales</span>
        </div>
        <p className="text-4xl font-bold text-white glow-text">₡125,500</p>
        <div className="flex items-center gap-4 mt-3">
          <div>
            <p className="text-xs text-gray-500">Hoy</p>
            <p className="text-sm font-semibold text-emerald-400">+₡{todayEarnings.toLocaleString()}</p>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div>
            <p className="text-xs text-gray-500">Esta semana</p>
            <p className="text-sm font-semibold text-cyan-400">₡{totalWeekly.toLocaleString()}</p>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-500">Comision actual</span>
          </div>
          <p className="text-lg font-bold text-white">15%</p>
          <p className="text-xs text-gray-500 mt-0.5">RIDA retiene 15%</p>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-gray-500">Horas hoy</span>
          </div>
          <p className="text-lg font-bold text-white">{workHours}h</p>
          <div className="mt-1.5 w-full bg-white/10 rounded-full h-1.5">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 rounded-full transition-all" style={{ width: `${(workHours / maxHours) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-600 mt-1">{workHours}h / {maxHours}h max</p>
        </div>
      </motion.div>

      {/* Weekly Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Esta Semana</span>
          </div>
          <span className="text-xs text-gray-500">₡{totalWeekly.toLocaleString()} total</span>
        </div>
        <div className="flex items-end gap-2 h-36">
          {weeklyData.map((data, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500">₡{(data.amount / 1000).toFixed(0)}k</span>
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
          className={`w-full font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
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
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Transacciones Recientes</h2>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {transactions.map((tx) => (
            <div key={tx.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'ride' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {tx.type === 'ride' ? (
                  <CreditCard className="w-5 h-5 text-emerald-400" />
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
      </motion.div>
    </div>
  );
}

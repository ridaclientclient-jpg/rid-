'use client';
import { motion } from 'framer-motion';
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const transactions = [
  { id: 1, type: 'credit', desc: 'Viaje completado R-001', amount: 2800, date: 'Hoy' },
  { id: 2, type: 'debit', desc: 'Viaje a Escazu', amount: -2800, date: 'Hoy' },
  { id: 3, type: 'credit', desc: 'Recarga', amount: 5000, date: 'Ayer' },
  { id: 4, type: 'debit', desc: 'Viaje a Heredia', amount: -3500, date: 'Ayer' },
];

export default function ClientWallet() {
  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Billetera</h1>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-blue-600/30 to-cyan-500/30 glass-strong rounded-2xl p-6 text-center border border-cyan-500/20">
        <WalletIcon className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Saldo disponible</p>
        <p className="text-3xl font-bold text-white mt-1">₡12,500</p>
        <div className="flex gap-3 mt-4">
          <button onClick={() => toast.success('Recarga simulada')} className="flex-1 btn-neon text-white text-sm font-medium py-2.5 rounded-xl flex items-center justify-center gap-1">
            <Plus className="w-4 h-4" /> Recargar
          </button>
          <button onClick={() => toast.info('Retiro procesado en 24h')} className="flex-1 border border-cyan-500/30 text-cyan-400 text-sm font-medium py-2.5 rounded-xl">
            Retirar
          </button>
        </div>
      </motion.div>

      <div className="flex gap-3">
        <button onClick={() => toast.info('Agregar tarjeta')} className="flex-1 glass rounded-xl p-3 flex items-center gap-2 hover:bg-white/5">
          <CreditCard className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-gray-300">Agregar tarjeta</span>
        </button>
        <button onClick={() => toast.info('Transferencia')} className="flex-1 glass rounded-xl p-3 flex items-center gap-2 hover:bg-white/5">
          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-gray-300">Transferir</span>
        </button>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Transacciones</h3>
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'credit' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                {tx.type === 'credit' ? <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> : <ArrowUpRight className="w-4 h-4 text-red-400" />}
              </div>
              <div className="flex-1">
                <p className="text-sm text-white">{tx.desc}</p>
                <p className="text-xs text-gray-500">{tx.date}</p>
              </div>
              <span className={`text-sm font-semibold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {tx.amount > 0 ? '+' : ''}₡{Math.abs(tx.amount).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

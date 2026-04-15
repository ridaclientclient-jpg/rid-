'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, CheckCircle, Upload, Shield, User } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientVerification() {
  const [step, setStep] = useState(1);

  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Verificacion</h1>
        <p className="text-sm text-gray-400 mt-1">Verifica tu identidad para mayor seguridad</p>
      </motion.div>

      <div className="flex items-center gap-2">
        {[1, 2].map(s => (
          <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-cyan-500' : 'bg-white/10'}`} />
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        {step === 1 ? (
          <div className="glass rounded-2xl p-6 text-center space-y-4">
            <User className="w-16 h-16 text-cyan-400 mx-auto" />
            <h3 className="text-lg font-semibold text-white">Selfie de Verificacion</h3>
            <p className="text-sm text-gray-400">Toma una selfie clara con buena iluminacion</p>
            <div className="w-48 h-48 mx-auto border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-cyan-500/50 transition-colors cursor-pointer" onClick={() => { toast.success('Selfie capturada!'); setStep(2); }}>
              <Camera className="w-8 h-8 text-gray-500" />
              <span className="text-xs text-gray-500">Tocar para capturar</span>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-semibold text-white">Verificacion Enviada</h3>
            <p className="text-sm text-gray-400">Tu documento sera revisado en 24-48 horas</p>
            <div className="glass rounded-xl p-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400">Pendiente de revision</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

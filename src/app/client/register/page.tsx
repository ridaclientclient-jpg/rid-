'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Zap, User, Phone, ArrowRight, ArrowLeft, Gift } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useReferralStore } from '@/store/referralStore';
import { toast } from 'sonner';

export default function ClientRegister() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);

  const updateForm = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.phone || !form.password) {
      toast.error('Completa todos los campos');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Las contrasenas no coinciden');
      return;
    }
    if (form.password.length < 6) {
      toast.error('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    const result = await register(form.name, form.email, form.phone, form.password, 'client');
    if (result.success) {
      toast.success('Cuenta creada exitosamente!');
      // Apply referral code if provided
      if (referralCode.trim()) {
        const { applyReferralCode } = useReferralStore.getState();
        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          const applyResult = await applyReferralCode(userId, referralCode.trim());
          if (applyResult.success) {
            toast.success(applyResult.message);
          } else {
            toast.error(applyResult.message);
          }
        }
      }
      router.push('/client');
    } else {
      toast.error(result.error || 'Error al crear cuenta');
    }
  };

  return (
    <div className="min-h-screen bg-rida-dark flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />
      
      <motion.div className="w-full max-w-sm relative z-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-4 glow-cyan">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Crear Cuenta</h1>
          <p className="text-sm text-gray-400 mt-1">Unete a RIDA hoy</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-cyan-500' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="glass-strong rounded-2xl p-6 space-y-4">
          {step === 1 ? (
            <>
              <h2 className="text-lg font-semibold text-white">Datos Personales</h2>
              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="text" placeholder="Nombre completo" value={form.name} onChange={(e) => updateForm('name', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="email" placeholder="Correo electronico" value={form.email} onChange={(e) => updateForm('email', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="tel" placeholder="Telefono (+506)" value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <button onClick={() => { if (form.name && form.email) setStep(2); else toast.error('Completa los campos'); }} className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2">
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white">Seguridad</h2>
              <div className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type={showPassword ? 'text' : 'password'} placeholder="Contrasena" value={form.password} onChange={(e) => updateForm('password', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="password" placeholder="Confirmar contrasena" value={form.confirmPassword} onChange={(e) => updateForm('confirmPassword', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500" />
                </div>
                {/* Referral Code - Optional */}
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Codigo de invitacion (opcional)"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 font-mono tracking-wide"
                  />
                </div>
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 accent-cyan-500" />
                    <span className="text-xs text-gray-400">Acepto los Terminos y Condiciones, la Politica de Privacidad y confirmo que soy responsable por las personas que viajen conmigo.</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 border border-white/10 text-gray-300 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5">
                  <ArrowLeft className="w-4 h-4" /> Atras
                </button>
                <button onClick={handleRegister} disabled={isLoading} className="flex-1 btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Registrarse</>}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center mt-4">
          <span className="text-xs text-gray-500">Ya tienes cuenta? </span>
          <button onClick={() => router.push('/client/login')} className="text-xs text-cyan-400 hover:underline">Inicia sesion</button>
        </p>
      </motion.div>
    </div>
  );
}

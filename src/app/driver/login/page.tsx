'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, UserPlus, ArrowRight, Car } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

export default function DriverLogin() {
  const router = useRouter();
  const { login, isLoading, isLocked } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Completa todos los campos');
      return;
    }

    if (isLocked) {
      toast.error('Cuenta bloqueada temporalmente. Intenta mas tarde.');
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      toast.success('Bienvenido conductor!');
      router.replace('/driver');
    } else {
      toast.error(result.error || 'Error al iniciar sesion');
    }
  };

  return (
    <div className="min-h-screen bg-rida-dark flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-radial from-cyan-500/10 via-transparent to-slate-950/80 pointer-events-none" />

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <motion.div
            className="w-18 h-18 rounded-[2rem] bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-cyan-500/20"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Car className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white">RIDA Conductor</h1>
          <p className="mt-2 text-sm text-gray-400">Accede con tu correo para comenzar tu jornada.</p>
        </div>

        <div className="glass-strong rounded-[2rem] p-6 border border-white/10 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
          <div className="space-y-3 mb-6">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Inicio de Sesion</p>
            <h2 className="text-2xl font-semibold text-white">Un solo paso para conectar</h2>
            <p className="text-sm text-gray-400">Usa tu correo y contrasena para recibir viajes inmediatamente.</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="Correo electronico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-3xl border border-white/10 bg-slate-950/65 px-12 py-3 text-sm text-white placeholder:text-gray-600 focus:border-cyan-400 focus:outline-none transition"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contrasena"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full rounded-3xl border border-white/10 bg-slate-950/65 px-12 py-3 text-sm text-white placeholder:text-gray-600 focus:border-cyan-400 focus:outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoading}
            className="mt-5 w-full rounded-3xl bg-gradient-to-r from-cyan-400 to-sky-500 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Cargando...' : 'Conectarse'}
          </button>

          <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-gray-400">
            <p>Para empezar tu dia de trabajo, usa un solo metodo de acceso.</p>
            <button
              type="button"
              onClick={() => router.push('/driver/register')}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-white/5 px-4 py-2 text-cyan-300 transition hover:bg-cyan-500/10"
            >
              <UserPlus className="w-4 h-4" />
              Crear cuenta de conductor
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

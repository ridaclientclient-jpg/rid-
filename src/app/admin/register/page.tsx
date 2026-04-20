'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Shield, User, Phone, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AdminRegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
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

    const result = await register(form.name, form.email, form.phone, form.password, 'admin');
    if (result.success) {
      toast.success('Cuenta de administrador creada exitosamente!');
      router.push('/admin/login');
    } else {
      toast.error(result.error || 'Error al crear cuenta');
    }
  };

  return (
    <div className="min-h-screen bg-rida-dark bg-gradient-radial flex items-center justify-center relative overflow-hidden p-6">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* Back link */}
      <motion.a
        href="/admin/login"
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Volver al login</span>
      </motion.a>

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-4 glow-cyan animate-pulse-glow">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Registro de Administrador</h1>
          <p className="text-gray-400 text-sm mt-1">Crear nueva cuenta de admin</p>
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
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    placeholder="Correo electronico"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="tel"
                    placeholder="Telefono (+506)"
                    value={form.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  if (form.name && form.email && form.phone) setStep(2);
                  else toast.error('Completa todos los campos');
                }}
                className="w-full btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
              >
                Siguiente <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-white">Seguridad</h2>
              <div className="space-y-3">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Contrasena"
                    value={form.password}
                    onChange={(e) => updateForm('password', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    placeholder="Confirmar contrasena"
                    value={form.confirmPassword}
                    onChange={(e) => updateForm('confirmPassword', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs text-amber-400/80">
                    Al registrarte como administrador obtendras acceso completo al panel de control de RIDA. Solo registra administradores autorizados.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 border border-white/10 text-gray-300 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5">
                  <ArrowLeft className="w-4 h-4" /> Atras
                </button>
                <button onClick={handleRegister} disabled={isLoading} className="flex-1 btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Crear Cuenta Admin'
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center mt-4">
          <span className="text-xs text-gray-500">Ya tienes cuenta? </span>
          <Link href="/admin/login" className="text-xs text-cyan-400 hover:underline">Inicia sesion</Link>
        </p>
      </motion.div>
    </div>
  );
}

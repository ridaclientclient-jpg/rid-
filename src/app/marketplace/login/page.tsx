'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Store, Mail, Lock, Eye, EyeOff, ArrowRight, Zap } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

export default function MarketplaceLogin() {
  const [email, setEmail] = useState('vendedor@rida.com');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [registerData, setRegisterData] = useState({ name: '', email: '', phone: '', password: '' });

  const { login, register, isLoading } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    const success = await login(email, password);
    if (success) {
      toast.success('¡Bienvenido a RIDA MARKET!');
    } else {
      toast.error('Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.name || !registerData.email || !registerData.phone || !registerData.password) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    const success = await register(registerData.name, registerData.email, registerData.phone, registerData.password, 'vendor');
    if (success) {
      toast.success('¡Cuenta creada exitosamente!');
    }
  };

  return (
    <div className="min-h-screen bg-rida-dark bg-gradient-radial flex items-center justify-center p-4">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="glass-strong rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <motion.div
            className="flex flex-col items-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4 glow-cyan shadow-lg">
              <Store className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white glow-text">RIDA MARKET</h1>
            <p className="text-gray-400 text-sm mt-1">Marketplace de RIDA Supreme</p>
          </motion.div>

          {/* Login Form */}
          {!isRegister ? (
            <motion.form
              onSubmit={handleLogin}
              className="space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendedor@rida.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                  <input type="checkbox" className="rounded bg-white/5 border-white/20" defaultChecked />
                  Recordarme
                </label>
                <button
                  type="button"
                  onClick={() => toast.info('Función de recuperación próximamente')}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                className="w-full btn-neon text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Iniciar Sesión
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>

              <div className="text-center mt-6">
                <p className="text-gray-500 text-sm">
                  ¿No tienes cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => setIsRegister(true)}
                    className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                  >
                    Crear cuenta
                  </button>
                </p>
              </div>
            </motion.form>
          ) : (
            /* Register Form */
            <motion.form
              onSubmit={handleRegister}
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">Nombre de la tienda</label>
                <input
                  type="text"
                  value={registerData.name}
                  onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                  placeholder="Mi Tienda"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">Correo electrónico</label>
                <input
                  type="email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  placeholder="tienda@ejemplo.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">Teléfono</label>
                <input
                  type="tel"
                  value={registerData.phone}
                  onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                  placeholder="+506 8888 0000"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-medium">Contraseña</label>
                <input
                  type="password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <motion.button
                type="submit"
                disabled={isLoading}
                className="w-full btn-neon text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Crear Cuenta
                    <Zap className="w-4 h-4" />
                  </>
                )}
              </motion.button>

              <div className="text-center mt-4">
                <p className="text-gray-500 text-sm">
                  ¿Ya tienes cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => setIsRegister(false)}
                    className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                  >
                    Iniciar sesión
                  </button>
                </p>
              </div>
            </motion.form>
          )}

          {/* Demo credentials */}
          <motion.div
            className="mt-6 pt-6 border-t border-white/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-xs text-gray-600 text-center mb-3">Demo: vendedor@rida.com / 123456</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

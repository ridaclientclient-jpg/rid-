'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  ArrowLeft, Lock, Eye, EyeOff, Shield, Check, Loader2, KeyRound
} from 'lucide-react';

export default function DriverSecurity() {
  const router = useRouter();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const strength = (password: string) => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 2) return { label: 'Debil', color: 'text-red-400', bg: 'bg-red-500/20', percent: 33 };
    if (score <= 3) return { label: 'Media', color: 'text-amber-400', bg: 'bg-amber-500/20', percent: 66 };
    return { label: 'Fuerte', color: 'text-emerald-400', bg: 'bg-emerald-500/20', percent: 100 };
  };

  const pwdStrength = strength(form.newPassword);

  const handleSubmit = async () => {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      toast.error('Todos los campos son obligatorios');
      return;
    }
    if (form.newPassword.length < 6) {
      toast.error('La nueva contrasena debe tener al menos 6 caracteres');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Las contrasenas no coinciden');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.newPassword });
      if (error) throw error;
      toast.success('Contrasena actualizada correctamente');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      router.back();
    } catch (err: any) {
      toast.error(err.message || 'Error al cambiar contrasena');
    } finally {
      setSaving(false);
    }
  };

  const requirements = [
    { label: '6+ caracteres', met: form.newPassword.length >= 6 },
    { label: 'Mayuscula', met: /[A-Z]/.test(form.newPassword) },
    { label: 'Numero', met: /[0-9]/.test(form.newPassword) },
    { label: 'Caracter especial', met: /[^A-Za-z0-9]/.test(form.newPassword) },
  ];

  return (
    <div className="min-h-screen bg-rida-dark">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-rida-dark/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">Seguridad</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Illustration */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 flex flex-col items-center"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
            <Shield className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Cambiar Contrasena</h2>
          <p className="text-xs text-gray-500 mt-1">Mantén tu cuenta segura</p>
        </motion.div>

        {/* Password Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-4 space-y-4"
        >
          {/* Current Password */}
          <div>
            <label className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1.5">
              <KeyRound className="w-3 h-3" /> Contrasena actual
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(e) => handleChange('currentPassword', e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1.5">
              <Lock className="w-3 h-3" /> Nueva contrasena
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(e) => handleChange('newPassword', e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength Bar */}
            {form.newPassword && (
              <div className="mt-2">
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${pwdStrength.bg}`}
                    style={{ width: `${pwdStrength.percent}%` }}
                  />
                </div>
                <p className={`text-[10px] mt-1 ${pwdStrength.color}`}>Fuerza: {pwdStrength.label}</p>
              </div>
            )}

            {/* Requirements */}
            {form.newPassword && (
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {requirements.map((req) => (
                  <div key={req.label} className={`flex items-center gap-1.5 text-[10px] ${req.met ? 'text-emerald-400' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${req.met ? 'opacity-100' : 'opacity-30'}`} />
                    {req.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1.5">
              <Lock className="w-3 h-3" /> Confirmar contrasena
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="••••••••"
                className={`w-full bg-white/5 border rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder-gray-600 focus:outline-none ${
                  form.confirmPassword && form.confirmPassword !== form.newPassword
                    ? 'border-red-500/50 focus:border-red-500/50'
                    : 'border-white/10 focus:border-cyan-500/50'
                }`}
              />
              <button
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.confirmPassword && form.confirmPassword !== form.newPassword && (
              <p className="text-[10px] text-red-400 mt-1">Las contrasenas no coinciden</p>
            )}
          </div>
        </motion.div>

        {/* Submit Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
          {saving ? 'Actualizando...' : 'Actualizar Contrasena'}
        </motion.button>
      </div>
    </div>
  );
}

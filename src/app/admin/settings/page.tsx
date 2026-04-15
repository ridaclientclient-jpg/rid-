'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, Shield, Globe, Key, Server,
  Save, Info, AlertTriangle, Zap, ToggleLeft, ToggleRight,
  Eye, EyeOff, Copy, CheckCircle2, Clock, Cpu
} from 'lucide-react';
import { toast } from 'sonner';

interface SystemSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: React.ElementType;
  warning?: boolean;
}

const initialSettings: SystemSetting[] = [
  { id: 'maintenance', label: 'Modo mantenimiento', description: 'Desactiva el sistema para los usuarios finales', enabled: false, icon: AlertTriangle, warning: true },
  { id: 'registration', label: 'Registro abierto', description: 'Permite el registro de nuevos usuarios', enabled: true, icon: Globe },
  { id: 'auto_assign', label: 'Asignación automática', description: 'Asigna viajes automáticamente al conductor más cercano', enabled: true, icon: Zap },
  { id: 'surge', label: 'Precios dinámicos (Surge)', description: 'Activa multiplicadores de precio por alta demanda', enabled: true, icon: TrendingUp },
  { id: 'sos', label: 'Sistema SOS', description: 'Activa el botón de emergencia SOS para pasajeros', enabled: true, icon: Shield },
];

function TrendingUp(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

interface ApiKey {
  name: string;
  value: string;
  masked: string;
}

const apiKeys: ApiKey[] = [
  { name: 'Google Maps API', value: 'REMOVED', masked: '****qrstuvwx' },
  { name: 'Supabase URL', value: 'REMOVED', masked: '****supabase.co' },
  { name: 'Stripe Secret Key', value: 'sk_live_REDACTED', masked: '****rstuvwx' },
  { name: 'WebSocket Server', value: 'wss://ws.rida-cr.com:3003', masked: '****rida-cr.com:3003' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>(initialSettings);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const toggleSetting = (id: string) => {
    setSettings((prev) => prev.map((s) => {
      if (s.id === id) {
        if (s.warning && s.enabled) {
          toast.warning(`${s.label} desactivado - el sistema estará en mantenimiento`);
        } else {
          toast.success(`${s.label} ${s.enabled ? 'desactivado' : 'activado'}`);
        }
        return { ...s, enabled: !s.enabled };
      }
      return s;
    }));
  };

  const toggleKeyVisibility = (name: string) => {
    setRevealedKeys((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const copyKey = async (key: ApiKey) => {
    await navigator.clipboard.writeText(key.value);
    setCopiedKey(key.name);
    toast.success(`${key.name} copiado al portapapeles`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSaving(false);
    toast.success('Configuración del sistema actualizada');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Configuración</h1>
        <p className="text-gray-400 mt-1">Ajustes globales del sistema RIDA</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* System Settings */}
        <div className="xl:col-span-2 space-y-4">
          <motion.div
            className="glass rounded-2xl p-6"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-5">
              <SettingsIcon className="w-5 h-5 text-cyan-400" />
              Configuración del Sistema
            </h3>
            <div className="space-y-4">
              {settings.map((setting, i) => {
                const Icon = setting.icon;
                return (
                  <motion.div
                    key={setting.id}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                      setting.enabled ? 'bg-white/5' : 'bg-white/[0.02]'
                    }`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        setting.warning && setting.enabled ? 'bg-red-500/20' :
                        setting.enabled ? 'bg-cyan-500/10' : 'bg-white/5'
                      }`}>
                        <Icon className={`w-5 h-5 ${
                          setting.warning && setting.enabled ? 'text-red-400' :
                          setting.enabled ? 'text-cyan-400' : 'text-gray-500'
                        }`} />
                      </div>
                      <div>
                        <h4 className={`text-sm font-medium ${setting.enabled ? 'text-white' : 'text-gray-500'}`}>{setting.label}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{setting.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSetting(setting.id)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-300 flex-shrink-0 ${
                        setting.enabled
                          ? setting.warning ? 'bg-red-500' : 'bg-cyan-500'
                          : 'bg-white/10'
                      }`}
                    >
                      <motion.div
                        className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                        animate={{ left: setting.enabled ? 'calc(100% - 26px)' : '2px' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* API Keys */}
          <motion.div
            className="glass rounded-2xl p-6"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-5">
              <Key className="w-5 h-5 text-amber-400" />
              API Keys
            </h3>
            <div className="space-y-3">
              {apiKeys.map((key, i) => (
                <motion.div
                  key={key.name}
                  className="bg-white/5 rounded-xl p-4"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-white">{key.name}</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleKeyVisibility(key.name)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                      >
                        {revealedKeys[key.name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => copyKey(key)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
                      >
                        {copiedKey === key.name ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-black/30 rounded-lg font-mono text-xs">
                    <span className="text-gray-400">{revealedKeys[key.name] ? key.value : key.masked}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Save */}
          <motion.button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3.5 rounded-xl btn-neon text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {isSaving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
            ) : (
              <><Save className="w-4 h-4" /> Guardar Configuración</>
            )}
          </motion.button>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* System Info */}
          <motion.div
            className="glass rounded-2xl p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Server className="w-5 h-5 text-cyan-400" />
              Información del Sistema
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Versión', value: '1.0.0', icon: Cpu },
                { label: 'Última actualización', value: '2026-04-15', icon: Clock },
                { label: 'Estado', value: 'Online', icon: Globe, valueClass: 'text-emerald-400' },
                { label: 'Uptime', value: '99.97%', icon: Zap, valueClass: 'text-cyan-400' },
                { label: 'Servidor', value: 'Costa Rica (CR)', icon: Server },
              ].map((info, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <info.icon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{info.label}</p>
                    <p className={`text-sm font-medium ${info.valueClass || 'text-white'}`}>{info.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            className="glass rounded-2xl p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-blue-400" />
              Resumen Rápido
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Reportes pendientes', value: settings.filter(s => s.warning).length.toString(), color: 'text-amber-400' },
                { label: 'APIs configuradas', value: apiKeys.length.toString(), color: 'text-cyan-400' },
                { label: 'Módulos activos', value: settings.filter(s => s.enabled).length.toString(), color: 'text-emerald-400' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                  <span className="text-sm text-gray-400">{item.label}</span>
                  <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Danger Zone */}
          <motion.div
            className="glass rounded-2xl p-5 border border-red-500/20"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5" />
              Zona de Peligro
            </h3>
            <p className="text-xs text-gray-500 mb-4">Acciones críticas que afectan el sistema</p>
            <div className="space-y-2">
              <button
                onClick={() => toast.error('Esta acción no está disponible en demo')}
                className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all"
              >
                Reiniciar Servidor
              </button>
              <button
                onClick={() => toast.error('Esta acción no está disponible en demo')}
                className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all"
              >
                Limpiar Caché
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}


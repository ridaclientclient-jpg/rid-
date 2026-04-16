'use client';

import { motion } from 'framer-motion';
import { 
  User, Car, Shield, Store, ChevronRight, Zap, Globe, MapPin, 
  Bell, Lock, Wallet, BarChart3, Sparkles 
} from 'lucide-react';

const apps = [
  {
    id: 'client',
    title: 'CLIENT APP',
    subtitle: 'Solicitar viajes en tiempo real',
    icon: User,
    href: '/client',
    color: 'from-blue-600 to-cyan-500',
    description: 'Mapa GPS, solicitud de viajes, pagos, historial, SOS y más.',
    features: ['Viajes en tiempo real', 'Seguimiento GPS', 'Pagos seguros', 'Botón SOS']
  },
  {
    id: 'driver',
    title: 'DRIVER APP',
    subtitle: 'Gestión de conductores',
    icon: Car,
    href: '/driver',
    color: 'from-cyan-500 to-emerald-500',
    description: 'Aceptar viajes, navegación, ganancias, verificación y control.',
    features: ['Aceptar viajes', 'Navegación GPS', 'Ganancias diarias', 'Verificación']
  },
  {
    id: 'admin',
    title: 'ADMIN PANEL',
    subtitle: 'Control total del sistema',
    icon: Shield,
    href: '/admin',
    color: 'from-purple-600 to-blue-600',
    description: 'Dashboard, analytics, gestión de usuarios, pricing y heatmap.',
    features: ['Dashboard completo', 'Analytics avanzados', 'Control de precios', 'Gestión total']
  },
  {
    id: 'marketplace',
    title: 'MARKETPLACE',
    subtitle: 'Tienda y productos',
    icon: Store,
    href: '/marketplace',
    color: 'from-amber-500 to-orange-500',
    description: 'Gestión de productos, categorías, pedidos y más.',
    features: ['Subir productos', 'Importar CSV', 'Categorías', 'Gestión de stock']
  },
];

const stats = [
  { label: 'Usuarios activos', value: '12,450', icon: User },
  { label: 'Viajes hoy', value: '3,280', icon: MapPin },
  { label: 'Conductores online', value: '856', icon: Car },
  { label: 'Ganancias', value: '₡4.2M', icon: Wallet },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-rida-dark bg-gradient-radial">
      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center glow-cyan">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white glow-text">RIDA</h1>
              <p className="text-xs text-cyan-400/60">SUPREME SYSTEM</p>
            </div>
          </motion.div>
          <motion.div 
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="glass rounded-lg px-3 py-1.5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">System Online</span>
            </div>
          </motion.div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div 
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-400 font-medium">MASTER BUILD — PRO MAX</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Sistema Completo de{' '}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Transporte Inteligente
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Plataforma ride-hailing con 4 aplicaciones independientes: Cliente, Conductor, Admin y Marketplace.
            Dark theme premium con glassmorphism y efectos neón.
          </p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {stats.map((stat, i) => (
            <div key={i} className="glass rounded-xl p-4 text-center">
              <stat.icon className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* App Cards */}
        <div className="grid sm:grid-cols-2 gap-6 mb-10">
          {apps.map((app, i) => (
            <motion.a
              key={app.id}
              href={app.href}
              className="group relative glass-strong rounded-2xl p-6 hover:glow-cyan transition-all duration-300 block"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center shadow-lg`}>
                    <app.icon className="w-7 h-7 text-white" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{app.title}</h3>
                <p className="text-sm text-cyan-400/70 mb-3">{app.subtitle}</p>
                <p className="text-sm text-gray-400 mb-4">{app.description}</p>
                <div className="grid grid-cols-2 gap-2">
                  {app.features.map((f, j) => (
                    <div key={j} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span className="text-xs text-gray-400">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        {/* Demo Credentials */}
        <motion.div 
          className="glass rounded-2xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            Credenciales de Demo
          </h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { role: 'Cliente', email: 'cliente@rida.com', password: '123456' },
              { role: 'Conductor', email: 'conductor@rida.com', password: '123456' },
              { role: 'Admin', email: 'admin@rida.com', password: 'admin123' },
              { role: 'Vendedor', email: 'vendedor@rida.com', password: '123456' },
            ].map((cred, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-3">
                <p className="text-xs font-semibold text-cyan-400 mb-1">{cred.role}</p>
                <p className="text-xs text-gray-300">{cred.email}</p>
                <p className="text-xs text-gray-500">Pass: {cred.password}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-gray-600">RIDA SUPREME SYSTEM — Master Build Pro Max</p>
        </div>
      </footer>
    </div>
  );
}

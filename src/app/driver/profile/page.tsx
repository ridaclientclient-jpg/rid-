'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver, type Vehicle, type Profile } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  User, Mail, Phone, Shield, Star, FileText, Car,
  Bell, Lock, HelpCircle, LogOut, ChevronRight, Camera,
  CreditCard, Clock, Award, CheckCircle2, Loader2,
} from 'lucide-react';

export default function DriverProfile() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Fetch driver record
      const { data: driverData } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (driverData) {
        setDriver(driverData);

        // Fetch vehicle using driver's id
        if (driverData.id) {
          const { data: vehicleData } = await supabase
            .from('vehicles')
            .select('*')
            .eq('driver_id', driverData.id)
            .single();
          setVehicle(vehicleData || null);
        }
      }

      // Fetch profile for created_at
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData || null);
    } catch (err) {
      console.error('Error fetching driver profile:', err);
      toast.error('Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rating = driver?.rating || 0;
  const totalRides = driver?.total_rides || 0;
  const totalEarnings = driver?.total_earnings || 0;
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-CR', { month: 'short' })
    : 'N/A';
  const earningsDisplay = totalEarnings >= 1000000
    ? `₡${(totalEarnings / 1000000).toFixed(1)}M`
    : `₡${(totalEarnings / 1000).toFixed(0)}k`;

  const vehicleDesc = vehicle
    ? `${vehicle.model} ${vehicle.year || ''}`.trim()
    : 'Sin vehiculo registrado';

  const menuItems = [
    { icon: FileText, label: 'Documentos', desc: 'Verificacion de conductor', href: '/driver/verification', color: 'text-blue-400 bg-blue-500/20' },
    { icon: Car, label: 'Vehiculo', desc: vehicleDesc, action: () => toast.info('Datos del vehiculo'), color: 'text-cyan-400 bg-cyan-500/20' },
    { icon: Bell, label: 'Notificaciones', desc: 'Configuracion de alertas', action: () => toast.info('Notificaciones configuradas'), color: 'text-amber-400 bg-amber-500/20' },
    { icon: Lock, label: 'Seguridad', desc: 'Cambiar contrasena', action: () => toast.info('Funcion de seguridad'), color: 'text-emerald-400 bg-emerald-500/20' },
    { icon: FileText, label: 'Terminos', desc: 'Terminos y condiciones', action: () => toast.info('Mostrando terminos...'), color: 'text-purple-400 bg-purple-500/20' },
    { icon: HelpCircle, label: 'Soporte', desc: 'Ayuda 24/7', action: () => toast.info('Conectando con soporte...'), color: 'text-pink-400 bg-pink-500/20' },
  ];

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-gray-400">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-3xl font-bold text-white mx-auto">
            {user?.name?.charAt(0) || 'C'}
          </div>
          <button onClick={() => toast.info('Funcion de camara no disponible en demo')} className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </button>
        </div>
        <h2 className="text-xl font-bold text-white mt-3">{user?.name || 'Conductor'}</h2>
        <div className="flex items-center justify-center gap-3 mt-2">
          <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1 ${user?.isVerified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {user?.isVerified ? <CheckCircle2 className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            {user?.isVerified ? 'Verificado' : 'Sin verificar'}
          </span>
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-sm font-medium text-white">{rating.toFixed(1)}</span>
            <span className="text-xs text-gray-500">({totalRides})</span>
          </div>
        </div>
      </motion.div>

      {/* Vehicle Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Car className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Mi Vehiculo</span>
          </div>
          {vehicle ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-500">Placa</p>
                <p className="text-sm font-bold text-white">{vehicle.plate}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${vehicle.verified ? 'text-emerald-400 bg-emerald-500/20' : 'text-amber-400 bg-amber-500/20'}`}>
                  {vehicle.verified ? 'Verificado' : 'Pendiente'}
                </span>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Modelo</p>
                <p className="text-sm font-bold text-white">{vehicle.model}</p>
                <span className="text-[10px] text-gray-500">{vehicle.year || '-'}</span>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Color</p>
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <p className="text-sm font-bold text-white">{vehicle.color}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-2">Vehiculo no registrado</p>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-3 text-center">
          <Clock className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{totalRides}</p>
          <p className="text-xs text-gray-500">Viajes total</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <Award className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{earningsDisplay}</p>
          <p className="text-xs text-gray-500">Ganancias total</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <CreditCard className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-white">{memberSince}</p>
          <p className="text-xs text-gray-500">Miembro desde</p>
        </div>
      </motion.div>

      {/* Contact Info */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Mail className="w-4 h-4 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Correo</p>
            <p className="text-sm text-white">{user?.email || 'N/A'}</p>
          </div>
        </div>
        <div className="w-full h-px bg-white/5" />
        <div className="flex items-center gap-3">
          <Phone className="w-4 h-4 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Telefono</p>
            <p className="text-sm text-white">{user?.phone || 'N/A'}</p>
          </div>
        </div>
      </motion.div>

      {/* Menu Items */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={() => item.href ? router.push(item.href) : item.action?.()}
            className="w-full glass rounded-xl p-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        ))}
      </motion.div>

      {/* Logout */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        onClick={() => { logout(); router.push('/driver/login'); toast.success('Sesion cerrada'); }}
        className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/20"
      >
        <LogOut className="w-4 h-4" /> Cerrar Sesion
      </motion.button>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  ArrowLeft, Car, Save, CheckCircle2, Loader2,
  Palette, Calendar, Hash
} from 'lucide-react';

interface VehicleData {
  id?: string;
  plate: string;
  model: string;
  color: string;
  year: number | null;
  verified: boolean;
}

export default function DriverVehicle() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleData>({
    plate: '',
    model: '',
    color: '',
    year: null,
    verified: false,
  });

  useEffect(() => {
    fetchVehicle();
  }, [user?.id]);

  const fetchVehicle = async () => {
    if (!user?.id) return;
    try {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (driverData?.id) {
        const { data: vData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('driver_id', driverData.id)
          .single();
        if (vData) setVehicle(vData);
      }
    } catch (err) {
      console.error('Error fetching vehicle:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!vehicle.plate.trim() || !vehicle.model.trim() || !vehicle.color.trim()) {
      toast.error('Placa, modelo y color son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!driverData?.id) {
        toast.error('No se encontro registro de conductor');
        return;
      }

      if (vehicle.id) {
        const { error } = await supabase
          .from('vehicles')
          .update({
            plate: vehicle.plate.toUpperCase(),
            model: vehicle.model,
            color: vehicle.color,
            year: vehicle.year,
          })
          .eq('id', vehicle.id);
        if (error) throw error;
        toast.success('Vehiculo actualizado');
      } else {
        const { error } = await supabase
          .from('vehicles')
          .insert({
            driver_id: driverData.id,
            plate: vehicle.plate.toUpperCase(),
            model: vehicle.model,
            color: vehicle.color,
            year: vehicle.year,
          });
        if (error) throw error;
        toast.success('Vehiculo registrado');
      }
      fetchVehicle();
    } catch (err) {
      console.error('Error saving vehicle:', err);
      toast.error('Error al guardar vehiculo');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rida-dark">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-rida-dark/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">Mi Vehiculo</h1>
          {vehicle.verified && (
            <span className="flex items-center gap-1 ml-auto text-[10px] text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" /> Verificado
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Vehicle Illustration */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 flex flex-col items-center"
        >
          <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mb-3">
            <Car className="w-10 h-10 text-cyan-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Datos del Vehiculo</h2>
          <p className="text-xs text-gray-500 mt-1">Ingresa la informacion de tu vehiculo</p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-4 space-y-4"
        >
          {/* Plate */}
          <div>
            <label className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1.5">
              <Hash className="w-3 h-3" /> Placa
            </label>
            <input
              type="text"
              value={vehicle.plate}
              onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
              placeholder="ABC-123"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Model */}
          <div>
            <label className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1.5">
              <Car className="w-3 h-3" /> Modelo
            </label>
            <input
              type="text"
              value={vehicle.model}
              onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
              placeholder="Toyota Corolla 2020"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Color and Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1.5">
                <Palette className="w-3 h-3" /> Color
              </label>
              <input
                type="text"
                value={vehicle.color}
                onChange={(e) => setVehicle({ ...vehicle, color: e.target.value })}
                placeholder="Blanco"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3 h-3" /> Ano
              </label>
              <input
                type="number"
                value={vehicle.year || ''}
                onChange={(e) => setVehicle({ ...vehicle, year: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="2024"
                min={1990}
                max={2026}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Guardando...' : 'Guardar Vehiculo'}
        </motion.button>
      </div>
    </div>
  );
}

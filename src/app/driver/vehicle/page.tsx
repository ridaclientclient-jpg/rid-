'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  ArrowLeft, Car, Save, CheckCircle2, Loader2,
  Palette, Calendar, Hash, Camera, Upload, RefreshCw, Bike
} from 'lucide-react';

interface VehicleData {
  id?: string;
  plate: string;
  model: string;
  color: string;
  year: number | null;
  verified: boolean;
  vehicle_type?: string;
  photo_url?: string;
}

export default function DriverVehicle() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleData>({
    plate: '',
    model: '',
    color: '',
    year: null,
    verified: false,
    vehicle_type: 'carro',
    photo_url: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const vehicleTypes = [
    { id: 'carro', label: 'Carro', icon: Car, color: 'from-blue-600 to-cyan-500', selected: 'border-cyan-500 bg-cyan-500/10' },
    { id: 'moto', label: 'Moto', icon: Bike, color: 'from-purple-600 to-pink-500', selected: 'border-purple-500 bg-purple-500/10' },
    { id: 'bici', label: 'Bicicleta', icon: Bike, color: 'from-emerald-600 to-teal-500', selected: 'border-emerald-500 bg-emerald-500/10' },
  ];

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

  // Load photo preview when vehicle data arrives
  useEffect(() => {
    if (vehicle.photo_url) setPhotoPreview(vehicle.photo_url);
  }, [vehicle.photo_url]);

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      // Safety timeout: if FileReader hangs on mobile, resolve with original file after 10s
      const timeout = setTimeout(() => resolve(file), 10000);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target?.result as string; };
      reader.onerror = () => { clearTimeout(timeout); resolve(file); };
      reader.readAsDataURL(file);
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const maxW = 800;
          const scale = img.width > maxW ? maxW / img.width : 1;
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.6);
        } catch { resolve(file); }
      };
      img.onerror = () => { clearTimeout(timeout); resolve(file); };
    });
  };

  const openCamera = () => {
    // Reset input value so onChange fires even if same file is selected again (mobile fix)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Solo imagenes'); return; }
    if (!user?.id) { toast.error('Inicia sesion primero'); return; }

    setUploading(true);
    try {
      const compressed = await compressImage(file);

      // Validate compressed size
      if (compressed.size > 5 * 1024 * 1024) {
        toast.error('La imagen es muy grande. Intenta con otra foto.');
        setUploading(false);
        return;
      }

      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `vehicle_${Date.now()}.${ext}`;
      const filePath = `${user.id}/${fileName}`;

      // Show preview
      const previewReader = new FileReader();
      previewReader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      previewReader.readAsDataURL(compressed);

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, compressed, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
      setVehicle(prev => ({ ...prev, photo_url: urlData.publicUrl }));
      toast.success('Foto de vehiculo subida');
    } catch (err: any) {
      toast.error(err.message || 'Error al subir foto. Intenta de nuevo.');
      console.error(err);
    } finally {
      setUploading(false);
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
            vehicle_type: vehicle.vehicle_type,
            photo_url: vehicle.photo_url,
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
            vehicle_type: vehicle.vehicle_type,
            photo_url: vehicle.photo_url,
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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelected}
      />

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
        {/* Vehicle Type Selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-4"
        >
          <p className="text-xs text-gray-400 font-medium mb-3">Tipo de vehiculo</p>
          <div className="grid grid-cols-3 gap-2">
            {vehicleTypes.map((vt) => (
              <button
                key={vt.id}
                onClick={() => setVehicle({ ...vehicle, vehicle_type: vt.id })}
                className={`rounded-xl p-3 text-center border transition-all ${
                  vehicle.vehicle_type === vt.id
                    ? vt.selected
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${vt.color} flex items-center justify-center mx-auto mb-1.5`}>
                  <vt.icon className="w-5 h-5 text-white" />
                </div>
                <p className={`text-xs font-semibold ${vehicle.vehicle_type === vt.id ? 'text-white' : 'text-gray-400'}`}>{vt.label}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Vehicle Photo */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="glass rounded-2xl p-4"
        >
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mb-3">
            <Camera className="w-3 h-3" /> Foto del vehiculo
          </p>
          {uploading ? (
            <div className="w-full h-40 rounded-xl bg-white/5 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <span className="text-xs text-cyan-400">Subiendo foto...</span>
            </div>
          ) : photoPreview ? (
            <div
              className="relative w-full h-40 rounded-xl overflow-hidden cursor-pointer group"
              onClick={openCamera}
            >
              <img src={photoPreview} alt="Vehiculo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                <RefreshCw className="w-5 h-5 text-white" />
                <span className="text-xs text-white font-medium">Cambiar foto</span>
              </div>
            </div>
          ) : (
            <div
              onClick={openCamera}
              className="w-full h-40 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-cyan-500/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-cyan-400" />
              </div>
              <span className="text-xs text-gray-500">Tocar para tomar foto</span>
              <Upload className="w-4 h-4 text-gray-600" />
            </div>
          )}
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

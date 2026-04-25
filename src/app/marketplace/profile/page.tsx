'use client';

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Store, User, Phone, MapPin, Clock, Star, Package,
  ShoppingCart, DollarSign, Camera, Edit3, Check, X,
  TrendingUp, Wallet, ArrowUpRight, ArrowDownRight,
  Loader2, ChevronDown, Bell, Shield, FileText,
  Headphones, LogOut, CircleDot, Radio,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useVendorId } from '@/hooks/useVendorId';
import { supabase, type Vendor, type VendorWallet, type VendorTransaction } from '@/lib/supabase';
import { toast } from 'sonner';

/* ── Helpers ──────────────────────────────────────────────────── */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
}

/* ── Constants ────────────────────────────────────────────────── */

const CATEGORY_OPTIONS = [
  { value: 'pharmacy', label: 'Farmacia' },
  { value: 'food', label: 'Comida' },
  { value: 'stores', label: 'Tiendas' },
  { value: 'other', label: 'Otros' },
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  pharmacy: 'Farmacia',
  food: 'Comida',
  stores: 'Tiendas',
  other: 'Otros',
};

const CATEGORY_COLOR: Record<string, string> = {
  pharmacy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  food: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  stores: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  other: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAY_KEYS)[number];

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

const TX_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof ArrowUpRight }> = {
  earning: { label: 'Ganancia', color: 'text-emerald-400', icon: ArrowUpRight },
  withdrawal: { label: 'Retiro', color: 'text-red-400', icon: ArrowDownRight },
  adjustment: { label: 'Ajuste', color: 'text-amber-400', icon: ArrowDownRight },
};

const TX_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-500/15 text-amber-400' },
  completed: { label: 'Completada', color: 'bg-emerald-500/15 text-emerald-400' },
  failed: { label: 'Fallida', color: 'bg-red-500/15 text-red-400' },
};

/* ── Types ────────────────────────────────────────────────────── */

interface DaySchedule {
  open: string;
  close: string;
  active: boolean;
}

interface ProfileStats {
  totalProducts: number;
  totalOrders: number;
  totalEarnings: number;
  avgRating: number;
  pendingOrders: number;
  balance: number;
}

interface FormState {
  store_name: string;
  description: string;
  phone: string;
  address: string;
  category: string;
  opening_hours: Record<DayKey, DaySchedule>;
  min_order_amount: string;
  delivery_radius_km: string;
}

/* ── Default opening hours ────────────────────────────────────── */

function defaultOpeningHours(): Record<DayKey, DaySchedule> {
  return {
    mon: { open: '08:00', close: '22:00', active: true },
    tue: { open: '08:00', close: '22:00', active: true },
    wed: { open: '08:00', close: '22:00', active: true },
    thu: { open: '08:00', close: '22:00', active: true },
    fri: { open: '08:00', close: '22:00', active: true },
    sat: { open: '08:00', close: '22:00', active: true },
    sun: { open: '08:00', close: '22:00', active: false },
  };
}

/* ── Animations ───────────────────────────────────────────────── */

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/* ── Skeleton ─────────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div>
        <div className="h-8 w-56 bg-white/5 rounded-lg" />
        <div className="h-4 w-40 bg-white/5 rounded-lg mt-2" />
      </div>
      {/* Store card */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-amber-500/10 to-cyan-500/10" />
        <div className="px-6 pb-6 -mt-10 space-y-4">
          <div className="flex items-end gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/5 border-4 border-[#0d1220]" />
            <div className="flex-1 space-y-2 pb-2">
              <div className="h-6 w-40 bg-white/5 rounded-lg" />
              <div className="h-4 w-20 bg-white/5 rounded-lg" />
            </div>
          </div>
          <div className="h-4 w-full bg-white/5 rounded-lg" />
          <div className="grid sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/[0.03] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-white/5 mb-3" />
            <div className="h-7 w-20 bg-white/5 rounded-lg" />
            <div className="h-3 w-16 bg-white/5 rounded mt-2" />
          </div>
        ))}
      </div>
      {/* Form & Earnings */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="h-6 w-32 bg-white/5 rounded-lg" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-20 bg-white/5 rounded" />
              <div className="h-10 bg-white/5 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="h-6 w-28 bg-white/5 rounded-lg" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.03] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const { vendorId, loading: vendorLoading, error: vendorError } = useVendorId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [wallet, setWallet] = useState<VendorWallet | null>(null);
  const [transactions, setTransactions] = useState<VendorTransaction[]>([]);
  const [stats, setStats] = useState<ProfileStats>({
    totalProducts: 0,
    totalOrders: 0,
    totalEarnings: 0,
    avgRating: 0,
    pendingOrders: 0,
    balance: 0,
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<FormState>({
    store_name: '',
    description: '',
    phone: '',
    address: '',
    category: 'other',
    opening_hours: defaultOpeningHours(),
    min_order_amount: '',
    delivery_radius_km: '',
  });

  const [showHours, setShowHours] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);

  /* ── Fetch all data ─────────────────────────────────────────── */
  const fetchAllData = useCallback(async () => {
    if (!vendorId) return;
    let cancelled = false;

    try {
      setLoading(true);

      // 1. Vendor data
      const { data: vendorData, error: vendorErr } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (vendorErr) console.error('Vendor fetch error:', vendorErr);
      if (vendorData && !cancelled) {
        const v = vendorData as Vendor;
        setVendor(v);
        setForm({
          store_name: v.store_name || '',
          description: v.description || '',
          phone: v.phone || '',
          address: v.address || '',
          category: v.category || 'other',
          opening_hours: v.opening_hours
            ? (v.opening_hours as Record<DayKey, DaySchedule>)
            : defaultOpeningHours(),
          min_order_amount: v.min_order_amount != null ? String(v.min_order_amount) : '',
          delivery_radius_km: v.delivery_radius_km != null ? String(v.delivery_radius_km) : '',
        });

        // Fetch signed URL for logo
        if (v.logo_url) {
          const { data: signedData } = await supabase.storage
            .from('product-images')
            .createSignedUrl(v.logo_url, 3600);
          if (signedData?.signedUrl && !cancelled) {
            setLogoUrl(signedData.signedUrl);
          }
        }
      }

      if (cancelled) return;

      // 2. Wallet data
      const { data: walletData, error: walletErr } = await supabase
        .from('vendor_wallets')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      if (walletErr && walletErr.code !== 'PGRST116') {
        console.error('Wallet fetch error:', walletErr);
      }
      if (walletData && !cancelled) {
        setWallet(walletData as VendorWallet);
      }

      if (cancelled) return;

      // 3. Product count
      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId);

      // 4. Order stats
      const { count: totalOrders } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId);

      const { count: pendingOrders } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .eq('status', 'pending');

      if (cancelled) return;

      // 5. Recent transactions
      const { data: txData, error: txErr } = await supabase
        .from('vendor_transactions')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (txErr) console.error('Transactions fetch error:', txErr);
      if (txData && !cancelled) {
        setTransactions(txData as VendorTransaction[]);
      }

      if (cancelled) return;

      // Set stats
      setStats({
        totalProducts: productCount ?? 0,
        totalOrders: totalOrders ?? 0,
        totalEarnings: (walletData as VendorWallet | null)?.total_earned ?? 0,
        avgRating: (vendorData as Vendor | null)?.rating ?? 0,
        pendingOrders: pendingOrders ?? 0,
        balance: (walletData as VendorWallet | null)?.balance ?? 0,
      });
    } catch (err) {
      console.error('Profile fetch error:', err);
      toast.error('Error al cargar datos del perfil');
    } finally {
      if (!cancelled) setLoading(false);
    }

    return () => { cancelled = true; };
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) fetchAllData();
  }, [vendorId, fetchAllData]);

  /* ── Form handlers ──────────────────────────────────────────── */

  const updateForm = (field: keyof FormState, value: string | Record<DayKey, DaySchedule>) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateDayHour = (day: DayKey, field: keyof DaySchedule, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: { ...prev.opening_hours[day], [field]: value },
      },
    }));
  };

  /* ── Save vendor profile ────────────────────────────────────── */

  const handleSave = async () => {
    if (!vendorId) return;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        store_name: form.store_name.trim(),
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        category: form.category,
        opening_hours: form.opening_hours,
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
        delivery_radius_km: form.delivery_radius_km ? parseFloat(form.delivery_radius_km) : null,
      };

      const { error } = await supabase
        .from('vendors')
        .update(payload)
        .eq('id', vendorId);

      if (error) {
        console.error('Save vendor error:', error);
        toast.error('Error al guardar: ' + error.message);
        return;
      }

      setVendor((prev) => prev ? { ...prev, ...payload } as Vendor : prev);
      setIsEditing(false);
      toast.success('Perfil guardado correctamente');
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Error al guardar perfil');
    } finally {
      setSaving(false);
    }
  };

  /* ── Logo upload ────────────────────────────────────────────── */

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !vendorId) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }

    setUploadingLogo(true);
    try {
      const filePath = `vendors/${vendorId}/logo`;

      // Remove old logo if exists
      if (vendor?.logo_url) {
        await supabase.storage.from('product-images').remove([vendor.logo_url]);
      }

      // Upload new logo
      const { error: uploadErr } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadErr) {
        console.error('Upload error:', uploadErr);
        toast.error('Error al subir imagen: ' + uploadErr.message);
        return;
      }

      // Update vendor record with the file path
      const { error: updateErr } = await supabase
        .from('vendors')
        .update({ logo_url: filePath })
        .eq('id', vendorId);

      if (updateErr) {
        console.error('Vendor update error:', updateErr);
        toast.error('Error al actualizar logo');
        return;
      }

      // Get signed URL for preview
      const { data: signedData } = await supabase.storage
        .from('product-images')
        .createSignedUrl(filePath, 3600);

      if (signedData?.signedUrl) {
        setLogoUrl(signedData.signedUrl);
      }

      setVendor((prev) => prev ? { ...prev, logo_url: filePath } : prev);
      toast.success('Logo actualizado');
    } catch (err) {
      console.error('Logo upload error:', err);
      toast.error('Error al subir logo');
    } finally {
      setUploadingLogo(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ── Menu items ─────────────────────────────────────────────── */

  const menuItems = [
    { label: 'Notificaciones', icon: Bell, color: 'text-amber-400', action: () => toast.info('Configuración de notificaciones próximamente') },
    { label: 'Términos y Condiciones', icon: FileText, color: 'text-cyan-400', action: () => toast.info('Mostrando términos...') },
    { label: 'Soporte', icon: Headphones, color: 'text-emerald-400', action: () => router.push('/marketplace/support') },
    { label: 'Privacidad', icon: Shield, color: 'text-purple-400', action: () => toast.info('Configuración de privacidad próximamente') },
    { label: 'Cerrar Sesión', icon: LogOut, color: 'text-red-400', action: () => { toast.success('Sesión cerrada'); logout(); router.replace('/marketplace/login'); } },
  ];

  /* ── Loading / Error ────────────────────────────────────────── */

  if (vendorLoading || loading) return <LoadingSkeleton />;

  if (vendorError) {
    return (
      <div className="text-center py-16">
        <Store className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">{vendorError}</p>
      </div>
    );
  }

  /* ── Stat cards config ──────────────────────────────────────── */

  const statCards = [
    { label: 'Productos', value: stats.totalProducts.toString(), icon: Package, color: 'from-blue-600 to-cyan-500' },
    { label: 'Pedidos', value: stats.totalOrders.toString(), icon: ShoppingCart, color: 'from-emerald-500 to-green-500' },
    { label: 'Ganancias', value: formatCRC(stats.totalEarnings), icon: DollarSign, color: 'from-amber-500 to-orange-500' },
    { label: 'Rating', value: stats.avgRating.toFixed(1), icon: Star, color: 'from-purple-500 to-pink-500' },
    { label: 'Pendientes', value: stats.pendingOrders.toString(), icon: Radio, color: 'from-amber-600 to-yellow-500' },
    { label: 'Balance', value: formatCRC(stats.balance), icon: Wallet, color: 'from-cyan-500 to-blue-500' },
  ];

  /* ── Active days summary ────────────────────────────────────── */

  const activeDays = DAY_KEYS.filter((d) => form.opening_hours[d].active);
  const allSameHours = activeDays.length > 0 && activeDays.every(
    (d) =>
      form.opening_hours[d].open === form.opening_hours[activeDays[0]].open &&
      form.opening_hours[d].close === form.opening_hours[activeDays[0]].close
  );

  const hoursSummary = (() => {
    if (activeDays.length === 0) return 'Cerrado todos los días';
    if (activeDays.length === 7) {
      if (allSameHours) return `Todos los días · ${form.opening_hours.mon.open} - ${form.opening_hours.mon.close}`;
      return 'Horario variable';
    }
    const dayNames = activeDays.map((d) => DAY_LABELS[d].slice(0, 3)).join(', ');
    if (allSameHours) return `${dayNames} · ${form.opening_hours[activeDays[0]].open} - ${form.opening_hours[activeDays[0]].close}`;
    return `${dayNames} · Horario variable`;
  })();

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl">
      {/* Header */}
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Perfil de <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Tienda</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Administra la información de tu tienda</p>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <motion.button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Edit3 className="w-4 h-4" />
              Editar Perfil
            </motion.button>
          ) : (
            <>
              <motion.button
                onClick={() => {
                  // Revert form to vendor data
                  if (vendor) {
                    setForm({
                      store_name: vendor.store_name || '',
                      description: vendor.description || '',
                      phone: vendor.phone || '',
                      address: vendor.address || '',
                      category: vendor.category || 'other',
                      opening_hours: vendor.opening_hours
                        ? (vendor.opening_hours as Record<DayKey, DaySchedule>)
                        : defaultOpeningHours(),
                      min_order_amount: vendor.min_order_amount != null ? String(vendor.min_order_amount) : '',
                      delivery_radius_km: vendor.delivery_radius_km != null ? String(vendor.delivery_radius_km) : '',
                    });
                  }
                  setIsEditing(false);
                  setShowHours(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <X className="w-4 h-4" />
                Cancelar
              </motion.button>
              <motion.button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white btn-neon disabled:opacity-50"
                whileHover={{ scale: saving ? 1 : 1.03 }}
                whileTap={{ scale: saving ? 1 : 0.97 }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Guardando...' : 'Guardar'}
              </motion.button>
            </>
          )}
        </div>
      </motion.div>

      {/* Store Card */}
      <motion.div variants={item} className="glass rounded-2xl overflow-hidden">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-cyan-500/20 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        <div className="px-6 pb-6 -mt-10 relative">
          {/* Avatar / Logo */}
          <div className="flex items-end gap-5 mb-6">
            <div className="relative">
              {logoUrl ? (
                <div className="w-20 h-20 rounded-2xl border-4 border-[#0d1220] shadow-lg overflow-hidden bg-white/10">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold border-4 border-[#0d1220] shadow-lg">
                  {(form.store_name || 'T').charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center text-white shadow-lg hover:bg-cyan-400 transition-colors disabled:opacity-50"
              >
                {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
            <div className="flex-1 pb-1">
              {isEditing ? (
                <input
                  type="text"
                  value={form.store_name}
                  onChange={(e) => updateForm('store_name', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-lg font-bold text-white focus:outline-none focus:border-cyan-500 mb-1"
                  placeholder="Nombre de la tienda"
                />
              ) : (
                <h2 className="text-xl font-bold text-white">{form.store_name || 'Sin nombre'}</h2>
              )}
              <div className="flex items-center gap-2 mt-1">
                {isEditing ? (
                  <select
                    value={form.category}
                    onChange={(e) => updateForm('category', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-0.5 text-[10px] font-medium text-gray-300 focus:outline-none focus:border-cyan-500"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${CATEGORY_COLOR[form.category] || CATEGORY_COLOR.other}`}>
                    {CATEGORY_LABEL[form.category] || 'Otros'}
                  </span>
                )}
                {vendor?.is_approved && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Verificado
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            {isEditing ? (
              <textarea
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none placeholder:text-gray-600"
                placeholder="Describe tu tienda..."
              />
            ) : (
              <p className="text-sm text-gray-400">{form.description || 'Sin descripción'}</p>
            )}
          </div>

          {/* Contact info */}
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Phone */}
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">Teléfono</span>
              </div>
              {isEditing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateForm('phone', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="+506 8888 0000"
                />
              ) : (
                <p className="text-sm text-gray-300 truncate">{form.phone || '—'}</p>
              )}
            </div>

            {/* Address */}
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">Dirección</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Dirección del local"
                />
              ) : (
                <p className="text-sm text-gray-300 truncate">{form.address || '—'}</p>
              )}
            </div>

            {/* Email (read-only from auth) */}
            <div className="p-3 rounded-xl bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">Email</span>
              </div>
              <p className="text-sm text-gray-300 truncate">{user?.email || '—'}</p>
            </div>
          </div>

          {/* Delivery settings (edit mode) */}
          {isEditing && (
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-[10px] text-gray-600 uppercase tracking-wider">Pedido mínimo (₡)</span>
                </div>
                <input
                  type="number"
                  value={form.min_order_amount}
                  onChange={(e) => updateForm('min_order_amount', e.target.value)}
                  min="0"
                  step="100"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="0"
                />
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-[10px] text-gray-600 uppercase tracking-wider">Radio de entrega (km)</span>
                </div>
                <input
                  type="number"
                  value={form.delivery_radius_km}
                  onChange={(e) => updateForm('delivery_radius_km', e.target.value)}
                  min="0"
                  step="0.5"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* Opening Hours */}
          <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Horario</p>
                  {!isEditing && (
                    <p className="text-sm text-white font-medium">{hoursSummary}</p>
                  )}
                </div>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowHours(!showHours)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {showHours ? 'Ocultar' : 'Editar horario'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showHours ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {/* Day-by-day editor */}
            <AnimatePresence>
              {isEditing && showHours && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-2">
                    {DAY_KEYS.map((day) => {
                      const schedule = form.opening_hours[day];
                      return (
                        <div
                          key={day}
                          className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                        >
                          {/* Active toggle */}
                          <button
                            type="button"
                            onClick={() => updateDayHour(day, 'active', !schedule.active)}
                            className={`flex-shrink-0 w-5 h-5 rounded-md border transition-colors flex items-center justify-center ${
                              schedule.active
                                ? 'bg-cyan-500 border-cyan-500'
                                : 'bg-transparent border-white/20 hover:border-white/40'
                            }`}
                          >
                            {schedule.active && <Check className="w-3 h-3 text-white" />}
                          </button>

                          {/* Day label */}
                          <span className={`w-20 text-sm flex-shrink-0 ${schedule.active ? 'text-white font-medium' : 'text-gray-600'}`}>
                            {DAY_LABELS[day]}
                          </span>

                          {/* Time inputs */}
                          {schedule.active ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="time"
                                value={schedule.open}
                                onChange={(e) => updateDayHour(day, 'open', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                              />
                              <span className="text-xs text-gray-500">—</span>
                              <input
                                type="time"
                                value={schedule.close}
                                onChange={(e) => updateDayHour(day, 'close', e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-gray-600 flex-1">Cerrado</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass rounded-2xl p-5 group hover:glow-cyan transition-all duration-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <TrendingUp className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Earnings & Transactions */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Earnings Summary */}
        <motion.div variants={item} className="lg:col-span-2 glass rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-1">Ganancias</h2>
          <p className="text-xs text-gray-500 mb-5">Resumen financiero</p>

          <div className="space-y-4">
            {/* Balance */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
              <p className="text-xs text-cyan-400 font-medium mb-1">Balance Disponible</p>
              <p className="text-2xl font-bold text-white">{formatCRC(stats.balance)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Pendiente</p>
                <p className="text-sm font-semibold text-amber-400">{formatCRC(wallet?.pending_balance ?? 0)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Ganado</p>
                <p className="text-sm font-semibold text-emerald-400">{formatCRC(wallet?.total_earned ?? 0)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Retirado</p>
                <p className="text-sm font-semibold text-red-400">{formatCRC(wallet?.total_withdrawn ?? 0)}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03]">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Pedidos</p>
                <p className="text-sm font-semibold text-white">{stats.totalOrders}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div variants={item} className="lg:col-span-3 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Transacciones</h2>
              <p className="text-xs text-gray-500 mt-0.5">Últimos 10 movimientos</p>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Sin transacciones aún</p>
              </div>
            ) : (
              transactions.map((tx, i) => {
                const config = TX_TYPE_CONFIG[tx.type] || TX_TYPE_CONFIG.adjustment;
                const statusConfig = TX_STATUS_CONFIG[tx.status] || TX_STATUS_CONFIG.pending;
                const IconComp = config.icon;
                const isPositive = tx.type === 'earning';

                return (
                  <motion.div
                    key={tx.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.03 }}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isPositive ? 'bg-emerald-500/15' : 'bg-red-500/15'
                    }`}>
                      <IconComp className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-medium truncate">{config.label}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{tx.description || 'Sin descripción'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : '-'}{formatCRC(tx.amount)}
                      </p>
                      {tx.created_at && (
                        <p className="text-[10px] text-gray-600">{relativeTime(tx.created_at)}</p>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Links */}
      <motion.div variants={item} className="glass rounded-2xl overflow-hidden">
        {menuItems.map((menuItem, i) => (
          <motion.button
            key={menuItem.label}
            onClick={menuItem.action}
            className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-white/[0.04] transition-colors ${
              menuItem.label === 'Cerrar Sesión' ? 'border-t border-white/10' : ''
            }`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.03 }}
            whileHover={{ x: 4 }}
          >
            <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center ${menuItem.color}`}>
              <menuItem.icon className="w-4 h-4" />
            </div>
            <span className="text-sm text-gray-300 flex-1 text-left">{menuItem.label}</span>
            <CircleDot className="w-3.5 h-3.5 text-gray-700" />
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}

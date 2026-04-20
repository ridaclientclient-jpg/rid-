'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Store, Mail, Phone, MapPin, Clock, Star, Package,
  ShoppingCart, DollarSign, Edit3, Check, X, Bell, FileText,
  Headphones, LogOut, Camera, Shield, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const [storeInfo, setStoreInfo] = useState({
    name: user?.name || 'Farmacia Central',
    description: 'Tu farmacia de confianza con los mejores productos y precios competitivos. Envío a todo Costa Rica.',
    category: 'Farmacia',
  });
  const [contactInfo, setContactInfo] = useState({
    email: user?.email || 'vendedor@rida.com',
    phone: user?.phone || '+506 8888 0003',
    address: 'Av. Central, San José, Costa Rica',
  });
  const [hours, setHours] = useState({
    open: '07:00',
    close: '21:00',
    days: 'Lun - Sáb',
  });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const profileStats = [
    { label: 'Productos', value: '156', icon: Package, color: 'from-blue-600 to-cyan-500' },
    { label: 'Pedidos', value: '1,240', icon: ShoppingCart, color: 'from-emerald-500 to-green-500' },
    { label: 'Ingresos', value: '₡2.4M', icon: DollarSign, color: 'from-amber-500 to-orange-500' },
    { label: 'Rating', value: '4.7', icon: Star, color: 'from-purple-500 to-pink-500' },
  ];

  const menuItems = [
    { label: 'Editar Tienda', icon: Edit3, color: 'text-cyan-400', action: () => toast.info('Editando tienda...') },
    { label: 'Notificaciones', icon: Bell, color: 'text-amber-400', action: () => toast.info('Configuración de notificaciones') },
    { label: 'Términos y Condiciones', icon: FileText, color: 'text-blue-400', action: () => toast.info('Mostrando términos...') },
    { label: 'Soporte', icon: Headphones, color: 'text-emerald-400', action: () => router.push('/marketplace/support') },
    { label: 'Privacidad', icon: Shield, color: 'text-purple-400', action: () => toast.info('Configuración de privacidad') },
    { label: 'Cerrar Sesión', icon: LogOut, color: 'text-red-400', action: async () => { toast.success('Sesión cerrada'); await logout(); router.replace('/marketplace/login'); } },
  ];

  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  const saveEdit = (field: string) => {
    if (!editValue.trim()) {
      toast.error('El campo no puede estar vacío');
      return;
    }

    if (field.startsWith('store-')) {
      const key = field.replace('store-', '') as keyof typeof storeInfo;
      setStoreInfo((prev) => ({ ...prev, [key]: editValue.trim() }));
    } else if (field.startsWith('contact-')) {
      const key = field.replace('contact-', '') as keyof typeof contactInfo;
      setContactInfo((prev) => ({ ...prev, [key]: editValue.trim() }));
    } else if (field.startsWith('hours-')) {
      const key = field.replace('hours-', '') as keyof typeof hours;
      setHours((prev) => ({ ...prev, [key]: editValue.trim() }));
    }

    setEditingField(null);
    toast.success('Campo actualizado');
  };

  const handleLogoUpload = () => {
    toast.info('Subida de logo (función próximamente)');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Perfil de Tienda</h1>
        <p className="text-gray-400 text-sm mt-1">Administra la información de tu tienda</p>
      </div>

      {/* Store Card */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Banner */}
        <div className="h-28 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-cyan-500/20 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        <div className="px-6 pb-6 -mt-10 relative">
          {/* Avatar */}
          <div className="flex items-end gap-5 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold border-4 border-[#0d1220] shadow-lg">
                {storeInfo.name.charAt(0)}
              </div>
              <button
                onClick={handleLogoUpload}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center text-white shadow-lg hover:bg-cyan-400 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 pb-1">
              {editingField === 'store-name' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-lg font-bold text-white focus:outline-none focus:border-cyan-500 w-48"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit('store-name')}
                  />
                  <button onClick={() => saveEdit('store-name')} className="text-emerald-400"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingField(null)} className="text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{storeInfo.name}</h2>
                  <button onClick={() => startEdit('store-name', storeInfo.name)} className="text-gray-500 hover:text-cyan-400">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {storeInfo.category}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Verificado
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            {editingField === 'store-description' ? (
              <div className="space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit('store-description')} className="btn-neon text-white px-4 py-1.5 rounded-lg text-xs font-medium">Guardar</button>
                  <button onClick={() => setEditingField(null)} className="px-4 py-1.5 rounded-lg text-xs text-gray-400 bg-white/5">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 group">
                <p className="text-sm text-gray-400 flex-1">{storeInfo.description}</p>
                <button onClick={() => startEdit('store-description', storeInfo.description)} className="text-gray-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="grid sm:grid-cols-3 gap-4">
            <EditableField
              icon={<Mail className="w-4 h-4" />}
              label="Email"
              value={contactInfo.email}
              editing={editingField === 'contact-email'}
              onStartEdit={() => startEdit('contact-email', contactInfo.email)}
              onSave={() => saveEdit('contact-email')}
              onCancel={() => setEditingField(null)}
              editValue={editValue}
              onEditChange={setEditValue}
            />
            <EditableField
              icon={<Phone className="w-4 h-4" />}
              label="Teléfono"
              value={contactInfo.phone}
              editing={editingField === 'contact-phone'}
              onStartEdit={() => startEdit('contact-phone', contactInfo.phone)}
              onSave={() => saveEdit('contact-phone')}
              onCancel={() => setEditingField(null)}
              editValue={editValue}
              onEditChange={setEditValue}
            />
            <EditableField
              icon={<MapPin className="w-4 h-4" />}
              label="Dirección"
              value={contactInfo.address}
              editing={editingField === 'contact-address'}
              onStartEdit={() => startEdit('contact-address', contactInfo.address)}
              onSave={() => saveEdit('contact-address')}
              onCancel={() => setEditingField(null)}
              editValue={editValue}
              onEditChange={setEditValue}
            />
          </div>

          {/* Hours */}
          <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Horario</p>
                  <p className="text-sm text-white font-medium">{hours.days} · {hours.open} - {hours.close}</p>
                </div>
              </div>
              <button
                onClick={() => toast.info('Editor de horarios próximamente')}
                className="text-gray-500 hover:text-cyan-400 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {profileStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass rounded-2xl p-5 text-center"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.05 }}
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mx-auto mb-3`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Menu */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {menuItems.map((item, i) => (
          <motion.button
            key={item.label}
            onClick={item.action}
            className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-white/[0.04] transition-colors ${
              item.label === 'Cerrar Sesión' ? 'border-t border-white/10' : ''
            }`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.03 }}
            whileHover={{ x: 4 }}
          >
            <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center ${item.color}`}>
              <item.icon className="w-4 h-4" />
            </div>
            <span className="text-sm text-gray-300 flex-1 text-left">{item.label}</span>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}

// Editable field component
function EditableField({
  icon,
  label,
  value,
  editing,
  onStartEdit,
  onSave,
  onCancel,
  editValue,
  onEditChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  editing: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  editValue: string;
  onEditChange: (v: string) => void;
}) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] group">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-500">{icon}</span>
        <span className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</span>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-cyan-500 min-w-0"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
          />
          <button onClick={onSave} className="text-emerald-400 flex-shrink-0"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={onCancel} className="text-gray-400 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-300 truncate flex-1">{value}</p>
          <button onClick={onStartEdit} className="text-gray-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
            <Edit3 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

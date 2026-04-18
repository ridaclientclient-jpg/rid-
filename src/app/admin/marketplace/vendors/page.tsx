'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Store, Star, Package, Eye, ShieldCheck, ShieldBan,
  Calendar, DollarSign, ChevronDown, X, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

interface Vendor {
  id: string;
  name: string;
  store: string;
  category: string;
  rating: number;
  products: number;
  status: 'active' | 'pending' | 'suspended';
  joined: string;
  earnings: string;
}

const initialVendors: Vendor[] = [
  { id: '1', name: 'Ana García', store: 'Farmacia Central', category: 'Farmacia', rating: 4.8, products: 45, status: 'active', joined: '2024-01-10', earnings: '₡450,000' },
  { id: '2', name: 'Luis Rojas', store: 'Comidas Doña María', category: 'Comida', rating: 4.6, products: 22, status: 'active', joined: '2024-01-08', earnings: '₡320,000' },
  { id: '3', name: 'María López', store: 'Mini Market Express', category: 'Tiendas', rating: 4.9, products: 38, status: 'active', joined: '2024-01-05', earnings: '₡280,000' },
  { id: '4', name: 'Pedro Sánchez', store: 'Farmacia Barrio', category: 'Farmacia', rating: 4.3, products: 23, status: 'pending', joined: '2024-01-15', earnings: '₡0' },
  { id: '5', name: 'Sofia Herrera', store: 'Sushi CR', category: 'Comida', rating: 4.7, products: 15, status: 'active', joined: '2024-01-12', earnings: '₡195,000' },
  { id: '6', name: 'Diego Morales', store: 'Abarrotes Don Diego', category: 'Tiendas', rating: 4.5, products: 30, status: 'suspended', joined: '2024-01-03', earnings: '₡89,000' },
];

const statusBadge: Record<string, { label: string; className: string }> = {
  active: { label: 'Activo', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  pending: { label: 'Pendiente', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  suspended: { label: 'Suspendido', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const categoryBadgeColors: Record<string, string> = {
  Farmacia: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Comida: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Tiendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const filterTabs = [
  { key: 'all', label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'suspended', label: 'Suspendidos' },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${star <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`}
        />
      ))}
      <span className="text-xs text-gray-400 ml-1">{rating}</span>
    </div>
  );
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const matchSearch =
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.store.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || v.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [vendors, search, filterStatus]);

  const handleToggleStatus = (vendor: Vendor) => {
    if (vendor.status === 'active') {
      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? { ...v, status: 'suspended' as const } : v))
      );
      toast.success(`${vendor.store} ha sido suspendido`);
    } else if (vendor.status === 'suspended') {
      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? { ...v, status: 'active' as const } : v))
      );
      toast.success(`${vendor.store} ha sido reactivado`);
    } else if (vendor.status === 'pending') {
      setVendors((prev) =>
        prev.map((v) => (v.id === vendor.id ? { ...v, status: 'active' as const } : v))
      );
      toast.success(`${vendor.store} ha sido aprobado`);
    }
  };

  const counts = useMemo(() => ({
    all: vendors.length,
    active: vendors.filter((v) => v.status === 'active').length,
    pending: vendors.filter((v) => v.status === 'pending').length,
    suspended: vendors.filter((v) => v.status === 'suspended').length,
  }), [vendors]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Vendedores</h1>
        <p className="text-gray-400 text-sm mt-1">Gestión de vendedores del marketplace</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vendedores..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                filterStatus === tab.key
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-[10px] opacity-70">{counts[tab.key as keyof typeof counts]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Vendor Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((vendor, i) => (
            <motion.div
              key={vendor.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl p-5 hover:glow-cyan/30 transition-all duration-300"
              whileHover={{ y: -2 }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <Store className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{vendor.store}</h3>
                    <p className="text-xs text-gray-500">{vendor.name}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge[vendor.status].className}`}>
                  {statusBadge[vendor.status].label}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Categoría</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${categoryBadgeColors[vendor.category]}`}>
                    {vendor.category}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Calificación</span>
                  <StarRating rating={vendor.rating} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Productos</span>
                  <span className="text-xs text-white font-medium">{vendor.products}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Ingresos</span>
                  <span className="text-xs text-emerald-400 font-medium">{vendor.earnings}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Registro</span>
                  <span className="text-xs text-gray-400">{vendor.joined}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-white/10">
                <motion.button
                  onClick={() => setSelectedVendor(vendor)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Eye className="w-3 h-3" />
                  Ver Detalle
                </motion.button>
                {vendor.status === 'active' ? (
                  <motion.button
                    onClick={() => handleToggleStatus(vendor)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ShieldBan className="w-3 h-3" />
                    Suspender
                  </motion.button>
                ) : vendor.status === 'suspended' ? (
                  <motion.button
                    onClick={() => handleToggleStatus(vendor)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    Reactivar
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={() => handleToggleStatus(vendor)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    Aprobar
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Store className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No se encontraron vendedores</p>
        </div>
      )}

      {/* Vendor Detail Modal */}
      <AnimatePresence>
        {selectedVendor && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedVendor(null)} />
            <motion.div
              className="relative w-full max-w-lg glass-strong rounded-2xl p-6 z-10 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <Store className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedVendor.store}</h2>
                    <p className="text-sm text-gray-400">{selectedVendor.name}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedVendor(null)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge[selectedVendor.status].className}`}>
                        {statusBadge[selectedVendor.status].label}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">Estado</p>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${categoryBadgeColors[selectedVendor.category]}`}>
                      {selectedVendor.category}
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">Categoría</p>
                  </div>
                </div>

                <div className="glass rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /> Calificación</span>
                    <StarRating rating={selectedVendor.rating} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 flex items-center gap-2"><Package className="w-4 h-4 text-blue-400" /> Productos</span>
                    <span className="text-sm text-white font-medium">{selectedVendor.products}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" /> Ingresos</span>
                    <span className="text-sm text-emerald-400 font-semibold">{selectedVendor.earnings}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 flex items-center gap-2"><Calendar className="w-4 h-4 text-purple-400" /> Registro</span>
                    <span className="text-sm text-white">{selectedVendor.joined}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" /> Rendimiento</span>
                    <span className="text-sm text-cyan-400 font-medium">
                      {selectedVendor.rating >= 4.5 ? 'Excelente' : selectedVendor.rating >= 4.0 ? 'Bueno' : 'Regular'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                {selectedVendor.status === 'active' ? (
                  <motion.button
                    onClick={() => {
                      handleToggleStatus(selectedVendor);
                      setSelectedVendor(null);
                    }}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ShieldBan className="w-4 h-4" />
                    Suspender Vendedor
                  </motion.button>
                ) : selectedVendor.status === 'suspended' ? (
                  <motion.button
                    onClick={() => {
                      handleToggleStatus(selectedVendor);
                      setSelectedVendor(null);
                    }}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Reactivar Vendedor
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={() => {
                      handleToggleStatus(selectedVendor);
                      setSelectedVendor(null);
                    }}
                    className="flex-1 btn-neon text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Aprobar Vendedor
                  </motion.button>
                )}
                <button
                  onClick={() => setSelectedVendor(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

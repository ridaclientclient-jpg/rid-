'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill, UtensilsCrossed, ShoppingBag, Plus, Pencil, X, Check,
  Package, Trash2, Loader2, RefreshCw, AlertTriangle, GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useVendorId } from '@/hooks/useVendorId';

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface CategoryInfo {
  name: string;
  productCount: number;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}

/* ─── Category visual mapping ───────────────────────────────────────────────── */

function getCategoryMeta(name: string): { icon: React.ReactNode; color: string; gradient: string } {
  const lower = name.toLowerCase();

  if (lower.includes('farmacia') || lower.includes('pharmacy') || lower.includes('medic')) {
    return {
      icon: <Pill className="w-8 h-8" />,
      color: 'text-emerald-400',
      gradient: 'from-emerald-500 to-green-500',
    };
  }
  if (lower.includes('comida') || lower.includes('food') || lower.includes('restaur') || lower.includes('alimento')) {
    return {
      icon: <UtensilsCrossed className="w-8 h-8" />,
      color: 'text-amber-400',
      gradient: 'from-amber-500 to-orange-500',
    };
  }
  if (lower.includes('tienda') || lower.includes('store') || lower.includes('abarrotes') || lower.includes('super')) {
    return {
      icon: <ShoppingBag className="w-8 h-8" />,
      color: 'text-blue-400',
      gradient: 'from-blue-500 to-cyan-500',
    };
  }

  return {
    icon: <Package className="w-8 h-8" />,
    color: 'text-cyan-400',
    gradient: 'from-cyan-500 to-teal-500',
  };
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function CategoriesPage() {
  const { user } = useAuthStore();
  const { vendorId, loading: vendorLoading, error: vendorError } = useVendorId();
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Add new category
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Delete confirmation
  const [deletingName, setDeletingName] = useState<string | null>(null);

  /* ── vendorId provided by useVendorId hook ──────── */

  /* ── Load categories from products ───────────────────── */
  const loadCategories = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('vendor_id', vendorId);

    if (error) {
      toast.error('Error al cargar categorías: ' + error.message);
      setLoading(false);
      return;
    }

    // Extract unique categories with counts
    const countMap = new Map<string, number>();
    for (const row of data || []) {
      const cat = (row.category as string) || 'Sin categoría';
      countMap.set(cat, (countMap.get(cat) || 0) + 1);
    }

    // Sort by product count descending
    const sorted = Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, productCount]) => {
        const meta = getCategoryMeta(name);
        return { name, productCount, ...meta };
      });

    setCategories(sorted);
    setLoading(false);
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) loadCategories();
  }, [vendorId, loadCategories]);

  /* ── Computed stats ──────────────────────────────────── */
  const totalProducts = useMemo(
    () => categories.reduce((acc, c) => acc + c.productCount, 0),
    [categories]
  );

  /* ── Create category ─────────────────────────────────── */
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    const trimmed = newCatName.trim();

    // Check if already exists
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Esta categoría ya existe');
      return;
    }

    setSaving(true);
    try {
      // Store the category name in the settings table for reference
      // (categories are derived from products; this entry marks them as "registered")
      const settingsKey = `vendor_categories_${vendorId}`;
      const { data: existing } = await supabase
        .from('settings')
        .select('value')
        .eq('key', settingsKey)
        .single();

      let categoryList: string[] = [];
      if (existing?.value) {
        try {
          categoryList = JSON.parse(existing.value as string);
        } catch {
          categoryList = [];
        }
      }

      if (!categoryList.includes(trimmed)) {
        categoryList.push(trimmed);
        const { error: upsertError } = await supabase
          .from('settings')
          .upsert(
            {
              key: settingsKey,
              value: JSON.stringify(categoryList),
              type: 'json',
            },
            { onConflict: 'key' }
          );
        if (upsertError) {
          console.warn('Settings upsert error:', upsertError.message);
        }
      }

      // Refresh categories list
      toast.success(`Categoría "${trimmed}" creada`);
      setNewCatName('');
      setShowAddForm(false);
      await loadCategories();
    } catch (err) {
      toast.error('Error al crear categoría');
    } finally {
      setSaving(false);
    }
  };

  /* ── Rename category ─────────────────────────────────── */
  const handleRenameCategory = async (oldName: string) => {
    if (!editValue.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    const trimmed = editValue.trim();

    if (trimmed === oldName) {
      setEditingName(null);
      return;
    }

    // Check conflict with another category
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.name !== oldName)) {
      toast.error('Ya existe una categoría con ese nombre');
      return;
    }

    setSaving(true);
    try {
      // Update all products with the old category name
      const { error } = await supabase
        .from('products')
        .update({ category: trimmed })
        .eq('vendor_id', vendorId!)
        .eq('category', oldName);

      if (error) {
        toast.error('Error al renombrar: ' + error.message);
        setSaving(false);
        return;
      }

      // Also update settings if the category is stored there
      const settingsKey = `vendor_categories_${vendorId}`;
      const { data: settingsData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', settingsKey)
        .single();

      if (settingsData?.value) {
        try {
          let categoryList: string[] = JSON.parse(settingsData.value as string);
          categoryList = categoryList.map((c) => (c === oldName ? trimmed : c));
          await supabase
            .from('settings')
            .update({ value: JSON.stringify(categoryList) })
            .eq('key', settingsKey);
        } catch {
          // ignore parse errors
        }
      }

      setEditingName(null);
      toast.success(`Categoría renombrada a "${trimmed}"`);
      await loadCategories();
    } catch {
      toast.error('Error al renombrar categoría');
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete category ─────────────────────────────────── */
  const handleDeleteCategory = async (catName: string) => {
    const catInfo = categories.find((c) => c.name === catName);
    if (!catInfo) return;

    // Only allow delete if no products use this category
    if (catInfo.productCount > 0) {
      toast.error(
        `No se puede eliminar "${catName}": tiene ${catInfo.productCount} producto(s). Reasigna los productos primero.`
      );
      setDeletingName(null);
      return;
    }

    setSaving(true);
    try {
      // Remove from settings if stored there
      const settingsKey = `vendor_categories_${vendorId}`;
      const { data: settingsData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', settingsKey)
        .single();

      if (settingsData?.value) {
        try {
          let categoryList: string[] = JSON.parse(settingsData.value as string);
          categoryList = categoryList.filter((c) => c !== catName);
          await supabase
            .from('settings')
            .update({ value: JSON.stringify(categoryList) })
            .eq('key', settingsKey);
        } catch {
          // ignore
        }
      }

      setDeletingName(null);
      toast.success(`Categoría "${catName}" eliminada`);
      await loadCategories();
    } catch {
      toast.error('Error al eliminar categoría');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Render ───────────────────────────────────────────────────────────────── */

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorías</h1>
          <p className="text-gray-400 text-sm mt-1">
            {categories.length} categorías · {totalProducts} productos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            onClick={() => loadCategories()}
            disabled={loading || !vendorId}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
            whileTap={{ scale: 0.97 }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setShowAddForm(true)}
            disabled={loading || !vendorId}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-sm text-cyan-400 hover:bg-cyan-500/25 transition-all disabled:opacity-50"
            whileTap={{ scale: 0.97 }}
          >
            <Plus className="w-4 h-4" />
            Nueva Categoría
          </motion.button>
        </div>
      </div>

      {/* Add New Category Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Nueva Categoría</h3>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nombre de la categoría (ej: Bebidas, Limpieza...)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCategory();
                    if (e.key === 'Escape') { setShowAddForm(false); setNewCatName(''); }
                  }}
                  disabled={saving}
                />
                <motion.button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={saving || !newCatName.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-all disabled:opacity-50"
                  whileTap={{ scale: 0.97 }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Crear
                </motion.button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setNewCatName(''); }}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  disabled={saving}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                Las categorías se derivan de los productos. Al crear una nueva, se registrará para que puedas asignarla a productos.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
          <p className="text-gray-400 text-sm">Cargando categorías...</p>
        </motion.div>
      )}

      {/* Empty State (no vendor) */}
      {!loading && !vendorId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <AlertTriangle className="w-10 h-10 text-amber-400 mb-4" />
          <p className="text-gray-400 text-sm">No se encontró tienda asociada</p>
          <p className="text-gray-600 text-xs mt-1">Contacta al administrador para vincular tu cuenta</p>
        </motion.div>
      )}

      {/* Empty State (no categories) */}
      {!loading && vendorId && categories.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Sin categorías</p>
          <p className="text-gray-600 text-xs mt-1">Agrega productos para que aparezcan categorías, o crea una manualmente</p>
          <motion.button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-sm text-cyan-400 hover:bg-cyan-500/25 transition-all"
            whileTap={{ scale: 0.97 }}
          >
            <Plus className="w-4 h-4" />
            Crear Categoría
          </motion.button>
        </motion.div>
      )}

      {/* Category Cards Grid */}
      {!loading && vendorId && categories.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.name}
              className="glass rounded-2xl overflow-hidden group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              {/* Card header with gradient */}
              <div className={`h-2 bg-gradient-to-r ${cat.gradient}`} />

              <div className="p-6">
                {/* Icon & name */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center text-white shadow-lg`}>
                      {cat.icon}
                    </div>
                    <div>
                      {editingName === cat.name ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500 w-32"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameCategory(cat.name);
                              if (e.key === 'Escape') setEditingName(null);
                            }}
                            disabled={saving}
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameCategory(cat.name)}
                            className="text-emerald-400 hover:text-emerald-300"
                            disabled={saving}
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingName(null)}
                            className="text-gray-400 hover:text-white"
                            disabled={saving}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <h3 className="text-lg font-bold text-white">{cat.name}</h3>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">
                        {cat.productCount} producto{cat.productCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {editingName !== cat.name && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingName(cat.name);
                          setEditValue(cat.name);
                        }}
                        className="text-gray-500 hover:text-cyan-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                        disabled={saving}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingName(cat.name)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                        disabled={saving}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Stats bar */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <GripVertical className="w-4 h-4 text-gray-600" />
                    <span className="text-white font-semibold">{cat.productCount}</span>
                    <span className="text-gray-500">productos</span>
                  </div>
                  {totalProducts > 0 && (
                    <>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${cat.gradient}`}
                          style={{ width: `${(cat.productCount / totalProducts) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round((cat.productCount / totalProducts) * 100)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingName && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setDeletingName(null)}
            />
            <motion.div
              className="relative w-full max-w-sm glass-strong rounded-2xl z-10 p-6 mx-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Eliminar categoría</h3>
                  <p className="text-xs text-gray-400">{deletingName}</p>
                </div>
              </div>

              <p className="text-sm text-gray-300 mb-5">
                ¿Estás seguro de que deseas eliminar la categoría <span className="text-white font-semibold">&quot;{deletingName}&quot;</span>?
              </p>

              <div className="flex items-center gap-3">
                <motion.button
                  type="button"
                  onClick={() => setDeletingName(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  whileTap={{ scale: 0.97 }}
                  disabled={saving}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => handleDeleteCategory(deletingName)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.97 }}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Eliminar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

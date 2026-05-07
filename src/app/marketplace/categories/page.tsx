'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UtensilsCrossed, Pill, ShoppingBag, Wine, Croissant, ShoppingCart,
  PawPrint, Package, Coffee, Heart, Zap, Star, Plus, Pencil, Trash2,
  AlertTriangle, Loader2, RefreshCw, X, Check, LayoutGrid, Eye,
  Search, ChevronUp, ChevronDown, Image as ImageIcon,
  MousePointer2, Sparkles, Layers, ArrowUp, ArrowDown, Edit3
} from 'lucide-react';
import { useVendorId } from '@/hooks/useVendorId';
import { supabase, type MarketplaceCategory } from '@/lib/supabase';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════════════════
   ICON MAPPING
   ═══════════════════════════════════════════════════════════════ */
const iconMap: Record<string, React.ElementType> = {
  UtensilsCrossed, Pill, ShoppingBag, Wine, Croissant, ShoppingCart,
  PawPrint, Package, Coffee, Heart, Zap, Star
};

const iconOptions = Object.keys(iconMap);

function getIcon(name: string): React.ElementType {
  return iconMap[name] || Package;
}

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface CategoryRow extends MarketplaceCategory {
  product_count: number;
}

interface AddFormData {
  name: string;
  icon: string;
  is_active: boolean;
}

const emptyAddForm: AddFormData = {
  name: '',
  icon: 'Package',
  is_active: true,
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function CategoriesPage() {
  const { vendorId, loading: vendorLoading, error: vendorError } = useVendorId();

  /* ── State ─────────────────────────────────────────────────── */
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddFormData>(emptyAddForm);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [deleteCount, setDeleteCount] = useState(0);

  // Toggle loading
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  /* ── Fetch Categories ────────────────────────────────────── */
  const fetchCategories = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);

    try {
      // Intento primario: Obtener categorías directamente (usualmente no requiere RPC)
      let { data, error } = await supabase
        .from('marketplace_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const rows: CategoryRow[] = (data || []).map((c) => ({
        ...c,
        product_count: 0,
      }));

      if (rows.length > 0) {
        // Contar productos de este vendor
        const { data: products, error: prodErr } = await supabase
          .from('products')
          .select('category')
          .eq('vendor_id', vendorId);

        if (!prodErr && products) {
          const counts: Record<string, number> = {};
          for (const p of products) {
            if (p.category) {
              const catKey = p.category.toLowerCase();
              counts[catKey] = (counts[catKey] || 0) + 1;
            }
          }

          for (const row of rows) {
            row.product_count = counts[row.name.toLowerCase()] || 0;
          }
        }
      }

      setCategories(rows);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (vendorId) fetchCategories();
  }, [vendorId, fetchCategories]);

  /* ── Computed ──────────────────────────────────────────────── */
  const filtered = useMemo(
    () => categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [categories, search]
  );

  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.is_active).length;
    const products = categories.reduce((sum, c) => sum + c.product_count, 0);
    return { total, active, products };
  }, [categories]);

  /* ── Actions ──────────────────────────────────────────────── */
  const handleAddCategory = async () => {
    if (!addForm.name.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    setSaving(true);
    try {
      const trimmed = addForm.name.trim();
      const nextSort = categories.length > 0
        ? Math.max(...categories.map((c) => c.sort_order || 0)) + 1
        : 1;

      // Usar RPC para saltar políticas RLS de inserción directa
      const { error } = await supabase.rpc('create_marketplace_category', {
        p_name: trimmed,
        p_icon: addForm.icon,
        p_sort_order: nextSort,
        p_is_active: addForm.is_active,
      });

      if (error) throw error;
      toast.success(`Categoría "${trimmed}" creada`);
      setAddForm(emptyAddForm);
      setShowAddForm(false);
      await fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRename = async () => {
    if (!editingId || !editValue.trim()) return;
    setSaving(true);
    try {
      const trimmed = editValue.trim();
      const { error } = await supabase
        .from('marketplace_categories')
        .update({ name: trimmed })
        .eq('id', editingId);
      if (error) throw error;
      toast.success('Nombre actualizado');
      setEditingId(null);
      await fetchCategories();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat: CategoryRow) => {
    const newStatus = !cat.is_active;
    
    // Optimistic update
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: newStatus } : c));
    setTogglingId(cat.id);

    try {
      const { error } = await supabase
        .from('marketplace_categories')
        .update({ is_active: newStatus })
        .eq('id', cat.id);
      if (error) throw error;
      toast.success(newStatus ? 'Categoría activada' : 'Categoría desactivada');
    } catch (err: any) {
      // Revert on error
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !newStatus } : c));
      toast.error(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filtered.length) return;
    
    const current = filtered[index];
    const other = filtered[targetIndex];
    
    setReorderingId(current.id);
    try {
      await supabase.from('marketplace_categories').update({ sort_order: other.sort_order }).eq('id', current.id);
      await supabase.from('marketplace_categories').update({ sort_order: current.sort_order }).eq('id', other.id);
      await fetchCategories();
    } catch {
      toast.error('Error al reordenar');
    } finally {
      setReorderingId(null);
    }
  };

  if (vendorLoading || loading) return <CategoriesSkeleton />;

  if (vendorError || !vendorId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-10 bg-[#0a0f1d] rounded-[3rem] border border-white/5">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-6 animate-pulse" />
        <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">Acceso Denegado</h2>
        <p className="text-slate-500 max-w-sm mb-8 text-sm">No pudimos vincular tu cuenta con una tienda. Contacta al administrador.</p>
        <button onClick={() => window.location.reload()} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold hover:bg-white/10 transition-all">Recargar</button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 pb-20 p-4">
      
      {/* ─── Super-App Header ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <div className="px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest shadow-lg mb-4 inline-block">
            Gestión de Catálogo
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-white tracking-tightest leading-none">
            Mis <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 drop-shadow-2xl">Categorías</span>
          </h1>
          <p className="text-slate-500 text-base md:text-lg mt-4 max-w-xl font-medium leading-relaxed">
            Organiza tus productos en secciones inteligentes para mejorar la experiencia de compra de tus clientes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => fetchCategories()}
            className="p-5 rounded-[2rem] bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90"
          >
            <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setShowAddForm(true)}
            className="group relative px-10 py-5 rounded-[2rem] bg-indigo-500 text-white font-black text-lg overflow-hidden shadow-[0_20px_40px_rgba(79,70,229,0.3)] transition-all hover:scale-[1.02] active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative flex items-center gap-3">
              <Plus className="w-7 h-7 stroke-[3]" />
              Crear Categoría
            </span>
          </button>
        </div>
      </div>

      {/* ─── Stats Banner ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        <StatItem label="Total Categorías" value={stats.total} icon={LayoutGrid} color="indigo" />
        <StatItem label="Activas" value={stats.active} icon={Eye} color="emerald" />
        <StatItem label="Artículos Vinculados" value={stats.products} icon={Layers} color="purple" />
      </div>

      {/* ─── Search & Add Form ────────────────────────────────── */}
      <div className="space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full bg-white/[0.03] border border-white/5 rounded-[2rem] pl-16 pr-6 py-5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all font-bold"
          />
        </div>

        <AnimatePresence>
          {showAddForm && (
            <motion.div 
              initial={{ opacity: 0, y: -20, height: 0 }} 
              animate={{ opacity: 1, y: 0, height: 'auto' }} 
              exit={{ opacity: 0, y: -20, height: 0 }}
              className="overflow-hidden"
            >
              <div className="glass-strong rounded-[3rem] p-8 border border-indigo-500/30 relative">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Icono</label>
                    <div className="flex gap-2 flex-wrap">
                      {iconOptions.map(name => (
                        <button 
                          key={name}
                          onClick={() => setAddForm({...addForm, icon: name})}
                          className={`p-3 rounded-2xl transition-all ${addForm.icon === name ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                        >
                          {(() => {
                            const Icon = getIcon(name);
                            return <Icon className="w-5 h-5" />;
                          })()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre de Categoría</label>
                    <input 
                      type="text" 
                      value={addForm.name}
                      onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                      placeholder="Ej: Snacks Gourmet"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500 font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handleAddCategory}
                      disabled={saving || !addForm.name.trim()}
                      className="px-8 py-4 bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                      Crear
                    </button>
                    <button onClick={() => setShowAddForm(false)} className="p-4 bg-white/5 rounded-2xl text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Categories List ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map((cat, idx) => (
            <CategoryCard 
              key={cat.id}
              category={cat}
              isEditing={editingId === cat.id}
              editValue={editValue}
              onEditValueChange={setEditValue}
              onStartRename={() => { setEditingId(cat.id); setEditValue(cat.name); }}
              onCancelRename={() => setEditingId(null)}
              onConfirmRename={handleConfirmRename}
              onToggleActive={() => handleToggleActive(cat)}
              onDelete={() => setDeleteTarget(cat)}
              onMoveUp={() => handleMove(idx, 'up')}
              onMoveDown={() => handleMove(idx, 'down')}
              isFirst={idx === 0}
              isLast={idx === filtered.length - 1}
              isSaving={saving || togglingId === cat.id || reorderingId === cat.id}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ─── Delete Confirmation Modal ────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteTarget(null)} className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-[#0d1220] border border-white/10 rounded-[3rem] p-10 max-w-md w-full shadow-2xl text-center">
              <div className="w-24 h-24 rounded-3xl bg-red-500/10 flex items-center justify-center mx-auto mb-8">
                <Trash2 className="w-12 h-12 text-red-500" />
              </div>
              <h3 className="text-3xl font-black text-white mb-4 tracking-tighter">¿Borrar Categoría?</h3>
              <p className="text-slate-400 text-sm mb-10 leading-relaxed">Se eliminará permanentemente la categoría <span className="text-white font-bold">"{deleteTarget.name}"</span>. Esta acción no se puede deshacer.</p>
              <div className="flex flex-col gap-4">
                <button onClick={async () => {
                  try {
                    const { error } = await supabase.from('marketplace_categories').delete().eq('id', deleteTarget.id);
                    if (error) throw error;
                    toast.success('Categoría eliminada');
                    setDeleteTarget(null);
                    fetchCategories();
                  } catch (err: any) { toast.error(err.message); }
                }} className="w-full py-5 bg-red-500 text-white font-black rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 text-lg">Confirmar Borrado</button>
                <button onClick={() => setDeleteTarget(null)} className="w-full py-5 bg-white/5 text-slate-400 font-bold rounded-2xl active:scale-95">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function StatItem({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5',
    emerald: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
    purple: 'border-purple-500/20 text-purple-400 bg-purple-500/5',
  };
  return (
    <div className={`glass rounded-[2.5rem] p-8 border ${colors[color]} relative group overflow-hidden transition-all hover:scale-[1.02]`}>
      <div className="flex items-center justify-between relative z-10">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{label}</p>
          <p className="text-4xl font-black text-white tracking-tighter">{value}</p>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:glow-indigo transition-all">
          <Icon className="w-8 h-8" />
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ category, isEditing, editValue, onEditValueChange, onStartRename, onCancelRename, onConfirmRename, onToggleActive, onDelete, onMoveUp, onMoveDown, isFirst, isLast, isSaving }: any) {
  const Icon = getIcon(category.icon);
  return (
    <motion.div layout className={`glass group rounded-[3rem] p-7 border transition-all duration-500 hover:shadow-2xl relative ${category.is_active ? 'border-white/5 hover:border-indigo-500/30' : 'border-red-500/10 opacity-60'}`}>
      <div className="flex items-start justify-between mb-8">
        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner group-hover:scale-110 transition-transform">
          <Icon className="w-8 h-8 text-indigo-400" />
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFirst && <button onClick={onMoveUp} className="p-2.5 rounded-xl bg-white/5 text-slate-500 hover:text-white"><ArrowUp className="w-4 h-4" /></button>}
          {!isLast && <button onClick={onMoveDown} className="p-2.5 rounded-xl bg-white/5 text-slate-500 hover:text-white"><ArrowDown className="w-4 h-4" /></button>}
        </div>
      </div>

      <div className="space-y-4">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input 
              autoFocus
              value={editValue} 
              onChange={(e) => onEditValueChange(e.target.value)} 
              className="flex-1 bg-white/10 border border-indigo-500/50 rounded-xl px-4 py-2 text-white font-bold text-lg focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && onConfirmRename()}
            />
            <button onClick={onConfirmRename} className="p-2 bg-indigo-500 text-white rounded-xl"><Check className="w-5 h-5" /></button>
            <button onClick={onCancelRename} className="p-2 bg-white/5 text-slate-400 rounded-xl"><X className="w-5 h-5" /></button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-white tracking-tight group-hover:text-indigo-400 transition-colors truncate">{category.name}</h3>
            <button onClick={onStartRename} className="p-2 rounded-xl text-slate-600 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all"><Edit3 className="w-4 h-4" /></button>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Productos</span>
            <span className="text-base font-black text-slate-400">{category.product_count} UDS</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onToggleActive} 
              disabled={isSaving}
              className={`w-16 h-8 rounded-full p-1 transition-all duration-500 relative ${category.is_active ? 'bg-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border border-white/10'}`}
            >
              <div className={`w-6 h-6 rounded-full bg-white shadow-2xl transition-all duration-500 flex items-center justify-center ${category.is_active ? 'translate-x-8' : 'translate-x-0'}`}>
                {isSaving ? (
                  <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                ) : category.is_active ? (
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                )}
              </div>
            </button>
            <button onClick={onDelete} className="p-3 rounded-2xl bg-white/5 text-slate-600 hover:text-red-500 transition-all"><Trash2 className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CategoriesSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-12 animate-pulse p-4">
      <div className="space-y-4">
        <div className="h-40 w-full bg-white/5 rounded-[3rem]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white/5 rounded-[2.5rem]" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-60 bg-white/5 rounded-[3rem]" />)}
      </div>
    </div>
  );
}

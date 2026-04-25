'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Edit3, Trash2, Package, Pill, UtensilsCrossed, ShoppingBag,
  X, Filter, Check, ImageIcon, Loader2, Upload, AlertTriangle, BoxIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useVendorId } from '@/hooks/useVendorId';

/* ── Types ──────────────────────────────────────────────────── */

interface ProductRow {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  in_stock: boolean;
  created_at: string;
  updated_at: string;
  sold: number;
}

interface FormData {
  name: string;
  description: string;
  price: string;
  category: string;
  inStock: boolean;
}

const emptyForm: FormData = {
  name: '',
  description: '',
  price: '',
  category: '',
  inStock: true,
};

/* ── Category helpers ──────────────────────────────────────── */

const defaultCategoryIcons: Record<string, React.ReactNode> = {
  Farmacia: <Pill className="w-5 h-5" />,
  Comida: <UtensilsCrossed className="w-5 h-5" />,
  Tiendas: <ShoppingBag className="w-5 h-5" />,
  pharmacy: <Pill className="w-5 h-5" />,
  food: <UtensilsCrossed className="w-5 h-5" />,
  stores: <ShoppingBag className="w-5 h-5" />,
  other: <BoxIcon className="w-5 h-5" />,
};

const defaultCategoryColors: Record<string, string> = {
  Farmacia: 'from-emerald-500/20 to-green-500/20 text-emerald-400',
  Comida: 'from-amber-500/20 to-orange-500/20 text-amber-400',
  Tiendas: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
  pharmacy: 'from-emerald-500/20 to-green-500/20 text-emerald-400',
  food: 'from-amber-500/20 to-orange-500/20 text-amber-400',
  stores: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
  other: 'from-purple-500/20 to-pink-500/20 text-purple-400',
};

const defaultCategoryBadgeColors: Record<string, string> = {
  Farmacia: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Comida: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Tiendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  pharmacy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  food: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  stores: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  other: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const FALLBACK_ICON = <Package className="w-5 h-5" />;
const FALLBACK_COLOR = 'from-gray-500/20 to-gray-600/20 text-gray-400';
const FALLBACK_BADGE = 'bg-gray-500/15 text-gray-400 border-gray-500/30';

/* ── Component ─────────────────────────────────────────────── */

export default function ProductsPage() {
  const { user } = useAuthStore();
  const { vendorId, loading: vendorLoading, error: vendorError } = useVendorId();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  /* ── vendorId provided by useVendorId hook ──────── */

  /* ── Load products ───────────────────────────────────── */
  useEffect(() => {
    if (!vendorId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) {
        toast.error('Error al cargar productos: ' + error.message);
        setLoading(false);
        return;
      }
      const rows: ProductRow[] = (data || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        vendor_id: p.vendor_id as string,
        name: p.name as string,
        description: (p.description as string) || null,
        price: Number(p.price),
        category: p.category as string,
        image_url: (p.image_url as string) || null,
        in_stock: p.in_stock as boolean,
        created_at: p.created_at as string,
        updated_at: p.updated_at as string,
        sold: 0,
      }));
      setProducts(rows);
      // Load sold counts
      await loadSoldCounts(rows);
      setLoading(false);
    })();
  }, [vendorId]);

  /* ── Sold count from deliveries ──────────────────────── */
  const loadSoldCounts = async (rows: ProductRow[]) => {
    if (!vendorId || rows.length === 0) return;
    try {
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('items')
        .eq('vendor_id', vendorId)
        .eq('status', 'delivered');
      if (!deliveries || deliveries.length === 0) return;
      // Build a map of product_id -> sold count
      const soldMap: Record<string, number> = {};
      for (const d of deliveries) {
        const items = d.items as Array<Record<string, unknown>> | null;
        if (!items || !Array.isArray(items)) continue;
        for (const item of items) {
          const pid = item.product_id as string | undefined;
          const qty = Number(item.quantity || 1);
          if (pid && soldMap[pid] !== undefined) {
            soldMap[pid] += qty;
          } else if (pid) {
            soldMap[pid] = qty;
          }
        }
      }
      setProducts((prev) =>
        prev.map((p) => ({ ...p, sold: soldMap[p.id] || 0 }))
      );
    } catch {
      // Silently fail — sold count is non-critical
    }
  };

  /* ── Categories from own products ────────────────────── */
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return cats.sort();
  }, [products]);

  /* ── Filtered products ───────────────────────────────── */
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'Todos' || p.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [products, search, filterCategory]);

  /* ── Ensure storage bucket exists ────────────────────── */
  const ensureBucket = async () => {
    try {
      const { error } = await supabase.storage.createBucket('product-images', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
      });
      if (error && !error.message.includes('already exists')) {
        console.warn('Bucket creation issue:', error.message);
      }
    } catch {
      // Bucket may already exist
    }
  };

  /* ── Upload image ────────────────────────────────────── */
  const uploadProductImage = async (productId: string, file: File): Promise<string | null> => {
    setUploadingImage(true);
    try {
      await ensureBucket();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${vendorId}/${productId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(path);
      return urlData.publicUrl + '?t=' + Date.now();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error subiendo imagen';
      toast.error(msg);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  /* ── Image file handling ─────────────────────────────── */
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Solo se aceptan JPG, PNG y WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagen máximo 5MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── CRUD ────────────────────────────────────────────── */

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ ...emptyForm, category: categories[0] || '' });
    setImageFile(null);
    setImagePreview(null);
    setShowCustomCategory(false);
    setCustomCategory('');
    setShowModal(true);
  };

  const openEditModal = (product: ProductRow) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category,
      inStock: product.in_stock,
    });
    setImageFile(null);
    setImagePreview(product.image_url || null);
    setShowCustomCategory(false);
    setCustomCategory('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
      toast.error('Ingresa un precio válido');
      return;
    }
    const cat = showCustomCategory ? customCategory.trim() : formData.category;
    if (!cat.trim()) {
      toast.error('La categoría es obligatoria');
      return;
    }

    setSaving(true);

    try {
      if (editingProduct) {
        // UPDATE
        const updates: Record<string, unknown> = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: Number(formData.price),
          category: cat.trim(),
          in_stock: formData.inStock,
          updated_at: new Date().toISOString(),
        };

        // Handle image upload
        if (imageFile) {
          const url = await uploadProductImage(editingProduct.id, imageFile);
          if (url) updates.image_url = url;
        } else if (imagePreview === null && editingProduct.image_url) {
          // User explicitly cleared the image
          updates.image_url = null;
        }

        const { error } = await supabase
          .from('products')
          .update(updates)
          .eq('id', editingProduct.id);
        if (error) throw error;

        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingProduct.id
              ? {
                  ...p,
                  name: updates.name as string,
                  description: updates.description as string | null,
                  price: updates.price as number,
                  category: updates.category as string,
                  in_stock: updates.in_stock as boolean,
                  image_url: (updates.image_url as string) ?? p.image_url,
                }
              : p
          )
        );
        toast.success('Producto actualizado correctamente');
      } else {
        // CREATE
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert({
            vendor_id: vendorId,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            price: Number(formData.price),
            category: cat.trim(),
            in_stock: formData.inStock,
          })
          .select()
          .single();
        if (error) throw error;

        // Upload image if selected
        let imageUrl: string | null = null;
        if (imageFile) {
          imageUrl = await uploadProductImage(newProduct.id, imageFile);
        }

        const row: ProductRow = {
          id: newProduct.id,
          vendor_id: newProduct.vendor_id,
          name: newProduct.name,
          description: newProduct.description,
          price: Number(newProduct.price),
          category: newProduct.category,
          image_url: imageUrl || newProduct.image_url || null,
          in_stock: newProduct.in_stock,
          created_at: newProduct.created_at,
          updated_at: newProduct.updated_at,
          sold: 0,
        };
        setProducts((prev) => [row, ...prev]);
        toast.success('Producto creado correctamente');
      }
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStock = async (product: ProductRow) => {
    const newVal = !product.in_stock;
    try {
      const { error } = await supabase
        .from('products')
        .update({ in_stock: newVal, updated_at: new Date().toISOString() })
        .eq('id', product.id);
      if (error) throw error;
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, in_stock: newVal } : p))
      );
      toast.success(newVal ? 'Producto en stock' : 'Producto agotado');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar';
      toast.error(msg);
    }
  };

  const handleDelete = async (product: ProductRow) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success(`"${product.name}" eliminado`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error(msg);
    }
  };

  /* ── Render ──────────────────────────────────────────── */

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Productos</h1>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? 'Cargando...' : `${products.length} producto${products.length !== 1 ? 's' : ''} en total`}
          </p>
        </div>
        <motion.button
          onClick={openAddModal}
          className="btn-neon text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 self-start"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" />
          Agregar Producto
        </motion.button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory('Todos')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
              filterCategory === 'Todos'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                filterCategory === cat
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass rounded-2xl overflow-hidden animate-pulse">
              <div className="h-36 bg-white/5" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-white/5 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
                <div className="flex justify-between">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-4 bg-white/5 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Grid */}
      {!loading && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((product, i) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass rounded-2xl overflow-hidden group hover:glow-cyan transition-all duration-300"
                >
                  {/* Image or gradient placeholder */}
                  <div
                    className={`h-36 bg-gradient-to-br ${
                      defaultCategoryColors[product.category] || FALLBACK_COLOR
                    } flex items-center justify-center relative overflow-hidden`}
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="relative z-10 opacity-60">
                        {defaultCategoryIcons[product.category] || FALLBACK_ICON}
                      </div>
                    )}
                    {/* Stock toggle */}
                    <div
                      className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium cursor-pointer backdrop-blur-sm transition-colors z-10 ${
                        product.in_stock
                          ? 'bg-emerald-500/30 text-emerald-400'
                          : 'bg-red-500/30 text-red-400'
                      }`}
                      onClick={() => handleToggleStock(product)}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          product.in_stock ? 'bg-emerald-400' : 'bg-red-400'
                        }`}
                      />
                      {product.in_stock ? 'En stock' : 'Agotado'}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">{product.name}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                          {product.description || 'Sin descripción'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            defaultCategoryBadgeColors[product.category] || FALLBACK_BADGE
                          }`}
                        >
                          {product.category}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{product.sold} vendido{product.sold !== 1 ? 's' : ''}</p>
                      </div>
                      <p className="text-lg font-bold text-white">
                        ₡{product.price.toLocaleString('es-CR')}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4 pt-3 border-t border-white/10">
                      <button
                        onClick={() => openEditModal(product)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          toast('¿Eliminar este producto?', {
                            action: {
                              label: 'Eliminar',
                              onClick: () => handleDelete(product),
                            },
                          });
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                {products.length === 0
                  ? 'No tienes productos. Agrega tu primer producto.'
                  : 'No se encontraron productos con esa búsqueda.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div
              className="relative w-full max-w-md glass-strong rounded-2xl p-6 z-10 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Photo upload */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium">Foto del producto</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-full h-40 bg-white/5 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/40 transition-colors overflow-hidden"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    {imagePreview ? (
                      <>
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearImage();
                            }}
                            className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500/80 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-2">
                          <ImageIcon className="w-5 h-5 text-cyan-400" />
                        </div>
                        <p className="text-xs text-gray-500">Haz clic para subir foto</p>
                        <p className="text-[10px] text-gray-600 mt-1">JPG, PNG o WebP — máx 5MB</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium">Nombre del producto *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Ibuprofeno 600mg"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción breve del producto"
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                  />
                </div>

                {/* Price + Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 font-medium">Precio (₡) *</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="3500"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 font-medium">Categoría *</label>
                    {!showCustomCategory ? (
                      <div className="flex gap-1.5">
                        <select
                          value={formData.category}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setShowCustomCategory(true);
                            } else {
                              setFormData({ ...formData, category: e.target.value });
                            }
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                        >
                          <option value="" className="bg-gray-900">Seleccionar...</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat} className="bg-gray-900">
                              {cat}
                            </option>
                          ))}
                          <option value="__custom__" className="bg-gray-900 text-cyan-400">
                            + Nueva categoría
                          </option>
                        </select>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Nombre categoría"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
                        autoFocus
                      />
                    )}
                  </div>
                </div>

                {/* In Stock Toggle */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div>
                    <p className="text-sm text-white font-medium">En stock</p>
                    <p className="text-xs text-gray-500">Producto disponible para venta</p>
                  </div>
                  <button
                    onClick={() => setFormData({ ...formData, inStock: !formData.inStock })}
                    className={`w-12 h-6 rounded-full transition-colors duration-200 flex items-center ${
                      formData.inStock ? 'bg-cyan-500' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                        formData.inStock ? 'translate-x-6.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <motion.button
                  onClick={handleSave}
                  disabled={saving || uploadingImage}
                  className="flex-1 btn-neon text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  whileHover={{ scale: saving ? 1 : 1.02 }}
                  whileTap={{ scale: saving ? 1 : 0.98 }}
                >
                  {saving || uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {saving
                    ? 'Guardando...'
                    : uploadingImage
                    ? 'Subiendo imagen...'
                    : editingProduct
                    ? 'Guardar Cambios'
                    : 'Crear Producto'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Edit3, Trash2, Package, ImageIcon, X, Loader2,
  Star, ShoppingBag, AlertTriangle, ToggleLeft, ToggleRight,
  ChevronDown, ArrowUpDown, Check, CheckSquare, Square,
  Filter, Sparkles, Eye, EyeOff, UploadCloud,
  ArrowUp, ArrowDown, Hash, LayoutGrid, List, TrendingUp,
  Clock, Calendar, Tag, Layers, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, type Product, type MarketplaceCategory } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useVendorId } from '@/hooks/useVendorId';

/* ══════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════ */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function renderStars(rating: number) {
  const stars: React.ReactNode[] = [];
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25;
  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />);
    } else if (i === full && hasHalf) {
      stars.push(<Star key={i} className="w-3 h-3 fill-amber-400/50 text-amber-400" />);
    } else {
      stars.push(<Star key={i} className="w-3 h-3 text-gray-600" />);
    }
  }
  return stars;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days}d`;
  const months = Math.floor(days / 30);
  return `Hace ${months}m`;
}

/* ══════════════════════════════════════════════════════════════════
   TYPES
   ══════════════════════════════════════════════════════════════════ */

type StatusFilter = 'all' | 'in_stock' | 'out_of_stock' | 'featured';
type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'most_sold' | 'name_asc';
type ViewMode = 'grid' | 'table';

interface ProductRow {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  image_path: string | null;
  in_stock: boolean;
  stock_quantity: number;
  sold_count: number;
  is_featured: boolean;
  avg_rating: number;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  description: string;
  price: string;
  category: string;
  inStock: boolean;
  stockQuantity: string;
  isFeatured: boolean;
}

const emptyForm: FormData = {
  name: '',
  description: '',
  price: '',
  category: '',
  inStock: true,
  stockQuantity: '10',
  isFeatured: false,
};

/* ══════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ══════════════════════════════════════════════════════════════════ */

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
} as const;

/* ══════════════════════════════════════════════════════════════════
   LOADING SKELETON
   ══════════════════════════════════════════════════════════════════ */

function ProductSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      <div className="h-52 bg-white/5 relative">
        <div className="absolute top-3 left-3 w-16 h-5 bg-white/5 rounded-full" />
        <div className="absolute top-3 right-3 w-14 h-5 bg-white/5 rounded-full" />
        <div className="absolute bottom-3 right-3 w-20 h-6 bg-white/5 rounded-lg" />
      </div>
      <div className="p-4 space-y-3">
        <div className="h-4 bg-white/5 rounded w-3/4" />
        <div className="h-3 bg-white/5 rounded w-full" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-white/5 rounded-full" />
            <div className="w-3 h-3 bg-white/5 rounded-full" />
            <div className="w-3 h-3 bg-white/5 rounded-full" />
          </div>
          <div className="h-5 w-20 bg-white/5 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass rounded-xl p-4 flex items-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-lg bg-white/5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/5 rounded w-1/3" />
            <div className="h-3 bg-white/5 rounded w-1/5" />
          </div>
          <div className="h-4 bg-white/5 rounded w-20" />
          <div className="h-4 bg-white/5 rounded w-16" />
          <div className="h-4 bg-white/5 rounded w-16" />
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/5" />
            <div className="w-8 h-8 rounded-lg bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass rounded-xl p-4">
          <div className="h-4 w-20 bg-white/5 rounded" />
          <div className="h-6 w-12 bg-white/5 rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   QUICK VIEW MODAL
   ══════════════════════════════════════════════════════════════════ */

function QuickViewModal({ product, onClose, onEdit }: { product: ProductRow; onClose: () => void; onEdit: () => void }) {
  const imageUrl = product.image_url || null;

  return (
    <motion.div
      className="fixed inset-0 z-[55] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md glass-strong rounded-2xl z-10 overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Image */}
        <div className="relative h-56 bg-gradient-to-br from-white/5 to-white/[0.02]">
          {imageUrl ? (
            <img src={imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ImageIcon className="w-16 h-16 text-gray-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <button onClick={onClose} className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
          {/* Badges */}
          <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between">
            <div className="flex items-center gap-2">
              {product.is_featured && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/20 border border-amber-500/30 text-amber-400 backdrop-blur-sm">
                  <Sparkles className="w-3 h-3" /> Destacado
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium backdrop-blur-sm ${
                product.in_stock
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${product.in_stock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {product.in_stock ? 'En stock' : 'Agotado'}
              </span>
            </div>
            <span className="text-xl font-bold text-white drop-shadow-lg">{formatCRC(product.price)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white">{product.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Tag className="w-2.5 h-2.5" /> {product.category}
              </span>
              <span className="text-[11px] text-gray-500">{product.stock_quantity} uds disponibles</span>
            </div>
          </div>

          {product.description && (
            <p className="text-sm text-gray-400 leading-relaxed">{product.description}</p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-white">{product.sold_count}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Vendidos</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-cyan-400">{formatCRC(product.price * product.sold_count)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Ingresos</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-0.5">
                {product.avg_rating > 0 ? (
                  <>
                    <div className="flex">{renderStars(product.avg_rating)}</div>
                    <span className="text-[11px] text-gray-400 ml-1">{product.avg_rating.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-600">N/A</span>
                )}
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">Rating</p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="flex items-center gap-4 text-[11px] text-gray-600">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Creado: {new Date(product.created_at).toLocaleDateString('es-CR')}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Actualizado: {timeAgo(product.updated_at)}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <motion.button
              onClick={onEdit}
              className="flex-1 btn-neon text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Edit3 className="w-4 h-4" /> Editar
            </motion.button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm text-gray-400 bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function ProductsPage() {
  const { user } = useAuthStore();
  const { vendorId, loading: vendorLoading } = useVendorId();

  /* ── State ─────────────────────────────────────────────────── */
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbCategories, setDbCategories] = useState<MarketplaceCategory[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filters & sort
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  // Quick view
  const [quickViewProduct, setQuickViewProduct] = useState<ProductRow | null>(null);

  // Delete confirmation
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'stock' | 'featured' | 'delete' | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Image URLs cache (signed URLs)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  /* ── Category helpers ─────────────────────────────────────── */
  const categoryNames = useMemo(() => {
    const names = new Set<string>();
    dbCategories
      .filter((c) => c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((c) => names.add(c.name));
    products.forEach((p) => {
      if (p.category) names.add(p.category);
    });
    return Array.from(names).sort();
  }, [dbCategories, products]);

  /* ── Load products ───────────────────────────────────────── */
  const loadProducts = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows: ProductRow[] = (data || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        vendor_id: p.vendor_id as string,
        name: p.name as string,
        description: (p.description as string) || null,
        price: Number(p.price),
        category: p.category as string,
        image_url: (p.image_url as string) || null,
        image_path: (p.image_path as string) || null,
        in_stock: p.in_stock as boolean,
        stock_quantity: (p.stock_quantity as number) ?? 0,
        sold_count: (p.sold_count as number) ?? 0,
        is_featured: (p.is_featured as boolean) ?? false,
        avg_rating: (p.avg_rating as number) ?? 0,
        created_at: p.created_at as string,
        updated_at: p.updated_at as string,
      }));

      setProducts(rows);

      // Load signed URLs for images
      const urlMap: Record<string, string> = {};
      for (const row of rows) {
        if (row.image_path) {
          try {
            const { data: urlData } = await supabase.storage
              .from('products')
              .createSignedUrl(row.image_path, 3600);
            if (urlData?.signedUrl) {
              urlMap[row.id] = urlData.signedUrl;
            } else if (row.image_url) {
              urlMap[row.id] = row.image_url;
            }
          } catch {
            if (row.image_url) urlMap[row.id] = row.image_url;
          }
        } else if (row.image_url) {
          urlMap[row.id] = row.image_url;
        }
      }
      setSignedUrls(urlMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar productos';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  /* ── Load categories from marketplace_categories ────────── */
  const loadCategories = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('marketplace_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (data) setDbCategories(data);
    } catch {
      // Non-critical — categories will be derived from products
    }
  }, []);

  useEffect(() => {
    if (vendorId) {
      loadProducts();
      loadCategories();
    }
  }, [vendorId, loadProducts, loadCategories]);

  /* ── Stats ──────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter((p) => p.in_stock).length;
    const outOfStock = products.filter((p) => !p.in_stock).length;
    const featured = products.filter((p) => p.is_featured).length;
    const totalSold = products.reduce((sum, p) => sum + p.sold_count, 0);
    const totalRevenue = products.reduce((sum, p) => sum + (p.price * p.sold_count), 0);
    return { total, inStock, outOfStock, featured, totalSold, totalRevenue };
  }, [products]);

  /* ── Filtered + Sorted products ─────────────────────────── */
  const filtered = useMemo(() => {
    let result = [...products];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (filterCategory !== 'all') {
      result = result.filter((p) => p.category === filterCategory);
    }

    switch (filterStatus) {
      case 'in_stock':
        result = result.filter((p) => p.in_stock);
        break;
      case 'out_of_stock':
        result = result.filter((p) => !p.in_stock);
        break;
      case 'featured':
        result = result.filter((p) => p.is_featured);
        break;
    }

    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'price_asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'most_sold':
        result.sort((a, b) => b.sold_count - a.sold_count);
        break;
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [products, search, filterCategory, filterStatus, sortBy]);

  /* ── Bulk selection helpers ─────────────────────────────── */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  /* ── Image upload ───────────────────────────────────────── */
  const handleImageSelect = useCallback((file: File) => {
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

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  }, [handleImageSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add('border-cyan-500/50', 'bg-cyan-500/5');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('border-cyan-500/50', 'bg-cyan-500/5');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('border-cyan-500/50', 'bg-cyan-500/5');
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageSelect(file);
  }, [handleImageSelect]);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadProductImage = async (productId: string, file: File): Promise<{ url: string; path: string } | null> => {
    setUploadingImage(true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 15;
        });
      }, 200);

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `products/${vendorId}/${productId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(path, file, { upsert: true, contentType: file.type });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from('products')
        .createSignedUrl(path, 3600);

      if (!urlData?.signedUrl) throw new Error('No se pudo generar URL firmada');

      return { url: urlData.signedUrl, path };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error subiendo imagen';
      toast.error(msg);
      return null;
    } finally {
      setTimeout(() => {
        setUploadingImage(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const deleteOldImage = async (productId: string) => {
    try {
      const product = products.find((p) => p.id === productId);
      if (!product?.image_path) return;

      const { data: files } = await supabase.storage
        .from('products')
        .list(`products/${vendorId}`);

      if (files) {
        const productFiles = files.filter((f) => f.name.startsWith(productId));
        for (const pf of productFiles) {
          await supabase.storage
            .from('products')
            .remove([`products/${vendorId}/${pf.name}`]);
        }
      }
    } catch {
      // Non-critical
    }
  };

  /* ── CRUD Operations ───────────────────────────────────── */

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ ...emptyForm, category: categoryNames[0] || '' });
    setImageFile(null);
    setImagePreview(null);
    setShowCustomCategory(false);
    setCustomCategory('');
    setShowModal(true);
  };

  const openEditModal = (product: ProductRow) => {
    setQuickViewProduct(null);
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category,
      inStock: product.in_stock,
      stockQuantity: product.stock_quantity?.toString() || '0',
      isFeatured: product.is_featured,
    });
    setImageFile(null);
    setImagePreview(signedUrls[product.id] || product.image_url || null);
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
      toast.error('Ingresa un precio valido');
      return;
    }
    const cat = showCustomCategory ? customCategory.trim() : formData.category;
    if (!cat.trim()) {
      toast.error('La categoria es obligatoria');
      return;
    }

    setSaving(true);

    try {
      if (editingProduct) {
        const updates: Record<string, unknown> = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: Number(formData.price),
          category: cat.trim(),
          in_stock: formData.inStock,
          stock_quantity: formData.inStock ? Number(formData.stockQuantity) || 0 : 0,
          is_featured: formData.isFeatured,
          updated_at: new Date().toISOString(),
        };

        if (imageFile) {
          const result = await uploadProductImage(editingProduct.id, imageFile);
          if (result) {
            updates.image_url = result.url;
            updates.image_path = result.path;
          }
        } else if (imagePreview === null && (editingProduct.image_url || editingProduct.image_path)) {
          await deleteOldImage(editingProduct.id);
          updates.image_url = null;
          updates.image_path = null;
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
                  stock_quantity: updates.stock_quantity as number,
                  is_featured: updates.is_featured as boolean,
                  image_url: (updates.image_url as string) ?? p.image_url,
                  image_path: (updates.image_path as string) ?? p.image_path,
                  updated_at: updates.updated_at as string,
                }
              : p
          )
        );

        if (imageFile && updates.image_url) {
          setSignedUrls((prev) => ({ ...prev, [editingProduct.id]: updates.image_url as string }));
        } else if (imagePreview === null) {
          setSignedUrls((prev) => {
            const next = { ...prev };
            delete next[editingProduct.id];
            return next;
          });
        }

        toast.success('Producto actualizado correctamente');
      } else {
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert({
            vendor_id: vendorId,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            price: Number(formData.price),
            category: cat.trim(),
            in_stock: formData.inStock,
            stock_quantity: formData.inStock ? Number(formData.stockQuantity) || 0 : 0,
            is_featured: formData.isFeatured,
          })
          .select()
          .single();

        if (error) throw error;

        let imageUrl: string | null = null;
        let imagePath: string | null = null;

        if (imageFile) {
          const result = await uploadProductImage(newProduct.id, imageFile);
          if (result) {
            imageUrl = result.url;
            imagePath = result.path;
          }
        }

        const row: ProductRow = {
          id: newProduct.id,
          vendor_id: newProduct.vendor_id,
          name: newProduct.name,
          description: newProduct.description,
          price: Number(newProduct.price),
          category: newProduct.category,
          image_url: imageUrl || newProduct.image_url || null,
          image_path: imagePath || (newProduct.image_path as string) || null,
          in_stock: newProduct.in_stock,
          stock_quantity: newProduct.stock_quantity ?? 0,
          sold_count: (newProduct.sold_count as number) ?? 0,
          is_featured: (newProduct.is_featured as boolean) ?? false,
          avg_rating: (newProduct.avg_rating as number) ?? 0,
          created_at: newProduct.created_at,
          updated_at: newProduct.updated_at,
        };

        setProducts((prev) => [row, ...prev]);
        if (imageUrl) {
          setSignedUrls((prev) => ({ ...prev, [newProduct.id]: imageUrl! }));
        }

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
        .update({
          in_stock: newVal,
          stock_quantity: newVal ? product.stock_quantity || 0 : 0,
          updated_at: new Date().toISOString(),
        })
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

  const handleToggleFeatured = async (product: ProductRow) => {
    const newVal = !product.is_featured;
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_featured: newVal, updated_at: new Date().toISOString() })
        .eq('id', product.id);
      if (error) throw error;
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_featured: newVal } : p))
      );
      toast.success(newVal ? 'Producto destacado' : 'Producto sin destacar');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setDeleting(true);
    try {
      await deleteOldImage(deletingProduct.id);
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deletingProduct.id);
      if (error) throw error;
      setProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingProduct.id);
        return next;
      });
      setSignedUrls((prev) => {
        const next = { ...prev };
        delete next[deletingProduct.id];
        return next;
      });
      toast.success(`"${deletingProduct.name}" eliminado`);
      setDeletingProduct(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  /* ── Bulk Actions ───────────────────────────────────────── */
  const executeBulkAction = async () => {
    if (selectedIds.size === 0 || !bulkAction) return;
    setBulkLoading(true);

    try {
      if (bulkAction === 'delete') {
        for (const id of selectedIds) {
          await deleteOldImage(id);
        }
        const { error } = await supabase
          .from('products')
          .delete()
          .in('id', Array.from(selectedIds));
        if (error) throw error;
        setProducts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
        toast.success(`${selectedIds.size} producto(s) eliminado(s)`);
      } else if (bulkAction === 'stock') {
        const { error } = await supabase
          .from('products')
          .update({ in_stock: true, updated_at: new Date().toISOString() })
          .in('id', Array.from(selectedIds));
        if (error) throw error;
        setProducts((prev) =>
          prev.map((p) => (selectedIds.has(p.id) ? { ...p, in_stock: true } : p))
        );
        toast.success(`${selectedIds.size} producto(s) habilitados`);
      } else if (bulkAction === 'featured') {
        const { error } = await supabase
          .from('products')
          .update({ is_featured: true, updated_at: new Date().toISOString() })
          .in('id', Array.from(selectedIds));
        if (error) throw error;
        setProducts((prev) =>
          prev.map((p) => (selectedIds.has(p.id) ? { ...p, is_featured: true } : p))
        );
        toast.success(`${selectedIds.size} producto(s) destacados`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error en accion masiva';
      toast.error(msg);
    } finally {
      setBulkLoading(false);
      setBulkAction(null);
      setSelectedIds(new Set());
    }
  };

  /* ── Sort & filter options ──────────────────────────────── */
  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Mas recientes' },
    { value: 'price_asc', label: 'Precio: menor a mayor' },
    { value: 'price_desc', label: 'Precio: mayor a menor' },
    { value: 'most_sold', label: 'Mas vendidos' },
    { value: 'name_asc', label: 'Nombre A-Z' },
  ];

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'in_stock', label: 'En stock' },
    { value: 'out_of_stock', label: 'Agotados' },
    { value: 'featured', label: 'Destacados' },
  ];

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */

  if (vendorLoading || loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-white/5 rounded-lg animate-pulse" />
          </div>
        </div>
        <StatsSkeleton />
        <div className="flex gap-3">
          <div className="h-10 flex-1 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-10 w-40 bg-white/5 rounded-xl animate-pulse" />
        </div>
        {viewMode === 'grid'
          ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}</div>
          : <TableSkeleton />
        }
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ─── Header ──────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Mis Productos
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {products.length} producto{products.length !== 1 ? 's' : ''} en tu tienda
            {filtered.length !== products.length && (
              <span className="text-cyan-400 ml-1">({filtered.length} visible{filtered.length !== 1 ? 's' : ''})</span>
            )}
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
      </motion.div>

      {/* ─── Stats Bar ───────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Productos', value: stats.total.toString(), gradient: 'from-cyan-500 to-cyan-600', icon: Package, color: 'text-cyan-400' },
            { label: 'En Stock', value: stats.inStock.toString(), gradient: 'from-emerald-500 to-green-500', icon: Eye, color: 'text-emerald-400' },
            { label: 'Agotados', value: stats.outOfStock.toString(), gradient: 'from-red-500 to-rose-500', icon: EyeOff, color: 'text-red-400' },
            { label: 'Destacados', value: stats.featured.toString(), gradient: 'from-amber-500 to-orange-500', icon: Sparkles, color: 'text-amber-400' },
            { label: 'Total Vendidos', value: stats.totalSold.toString(), gradient: 'from-purple-500 to-pink-500', icon: ShoppingBag, color: 'text-purple-400' },
            { label: 'Ingresos Est.', value: formatCRC(stats.totalRevenue), gradient: 'from-green-500 to-emerald-500', icon: DollarSign, color: 'text-green-400' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="glass rounded-xl p-3.5 group hover:glow-cyan transition-all duration-300"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                  <stat.icon className="w-3 h-3 text-white" />
                </div>
                <span className="text-[10px] text-gray-500 font-medium">{stat.label}</span>
              </div>
              <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── Search + Filters + View Toggle ──────────────── */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, descripcion o categoria..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort + View toggle */}
          <div className="flex gap-2">
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none w-full sm:w-48 bg-white/5 border border-white/10 rounded-xl pl-10 pr-8 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 transition-colors cursor-pointer"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#111827] text-gray-200">{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>

            {/* View toggle */}
            <div className="flex bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-cyan-500/15 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                title="Vista tarjetas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2.5 transition-colors ${viewMode === 'table' ? 'bg-cyan-500/15 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                title="Vista tabla"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 flex-wrap items-center">
            <Filter className="w-4 h-4 text-gray-500" />
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  filterStatus === opt.value
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 flex-wrap overflow-x-auto pb-1">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                filterCategory === 'all'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              Todas las categorias
            </button>
            {categoryNames.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  filterCategory === cat
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ─── Bulk Actions Bar ────────────────────────────── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-strong rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3"
          >
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                {selectedIds.size === filtered.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                <span>{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
              </button>
              <div className="w-px h-5 bg-white/10 hidden sm:block" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setBulkAction('stock')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bulkAction === 'stock' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'}`}>
                <Eye className="w-3 h-3" /> Habilitar stock
              </button>
              <button onClick={() => setBulkAction('featured')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bulkAction === 'featured' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'}`}>
                <Sparkles className="w-3 h-3" /> Destacar
              </button>
              <button onClick={() => setBulkAction('delete')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bulkAction === 'delete' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'}`}>
                <Trash2 className="w-3 h-3" /> Eliminar
              </button>
            </div>
            {bulkAction && (
              <div className="flex items-center gap-2 ml-auto">
                <motion.button onClick={executeBulkAction} disabled={bulkLoading} className="btn-neon text-white px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50" whileTap={{ scale: 0.97 }}>
                  {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Aplicar
                </motion.button>
                <button onClick={() => setBulkAction(null)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
         GRID VIEW
         ══════════════════════════════════════════════════════════ */}
      {viewMode === 'grid' && (
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((product, i) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                  className={`glass rounded-2xl overflow-hidden group hover:glow-cyan transition-all duration-300 relative ${
                    !product.in_stock ? 'opacity-60' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <div className="absolute top-3 left-3 z-20">
                    <button
                      onClick={() => toggleSelect(product.id)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 ${
                        selectedIds.has(product.id)
                          ? 'bg-cyan-500 text-white'
                          : 'bg-black/40 backdrop-blur-sm text-transparent hover:text-gray-300 border border-white/20'
                      }`}
                    >
                      {selectedIds.has(product.id) && <Check className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Clickable image area */}
                  <div
                    className="h-52 bg-gradient-to-br from-white/5 to-white/[0.02] relative overflow-hidden cursor-pointer"
                    onClick={() => setQuickViewProduct(product)}
                  >
                    {signedUrls[product.id] ? (
                      <img src={signedUrls[product.id]} alt={product.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-gray-700" />
                      </div>
                    )}

                    {/* Out of stock overlay */}
                    {!product.in_stock && (
                      <div className="absolute inset-0 bg-black/30 z-[5]" />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Badges */}
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                      {product.is_featured && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 backdrop-blur-sm text-[10px] font-semibold text-amber-400">
                          <Sparkles className="w-3 h-3" /> Destacado
                        </span>
                      )}
                    </div>

                    {/* Category + Price bottom */}
                    <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center w-fit px-2.5 py-1 rounded-full text-[10px] font-medium bg-black/40 backdrop-blur-sm text-gray-200 border border-white/10">
                          {product.category}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm ${
                          product.in_stock
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${product.in_stock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          {product.in_stock ? `${product.stock_quantity} uds` : 'Agotado'}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-white drop-shadow-lg">{formatCRC(product.price)}</span>
                    </div>

                    {/* Hover quick actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 z-10">
                      <button onClick={(e) => { e.stopPropagation(); openEditModal(product); }} className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-sm flex items-center justify-center text-cyan-400 hover:bg-cyan-500/30 transition-colors" title="Editar">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleToggleStock(product); }} className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30 transition-colors" title={product.in_stock ? 'Desactivar stock' : 'Activar stock'}>
                        {product.in_stock ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleToggleFeatured(product); }} className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 backdrop-blur-sm flex items-center justify-center text-amber-400 hover:bg-amber-500/30 transition-colors" title={product.is_featured ? 'Quitar destacado' : 'Destacar'}>
                        <Sparkles className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeletingProduct(product); }} className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 backdrop-blur-sm flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-white truncate mb-1">{product.name}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed min-h-[2rem]">
                      {product.description || 'Sin descripcion'}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {product.avg_rating > 0 ? (
                          <div className="flex items-center gap-1">
                            <div className="flex">{renderStars(product.avg_rating)}</div>
                            <span className="text-xs text-gray-400 ml-0.5">{product.avg_rating.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-600">Sin resenas</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {product.sold_count}</span>
                        <span className="flex items-center gap-1 text-cyan-500/60"><TrendingUp className="w-3 h-3" /> {formatCRC(product.price * product.sold_count)}</span>
                      </div>
                    </div>

                    {/* Stock bar */}
                    {product.in_stock && product.stock_quantity > 0 && (
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${product.stock_quantity <= 5 ? 'bg-red-500/70' : product.stock_quantity <= 15 ? 'bg-amber-500/70' : 'bg-cyan-500/50'}`}
                            style={{ width: `${Math.min((product.stock_quantity / 50) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-600">{product.stock_quantity} uds</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════════════
         TABLE VIEW
         ══════════════════════════════════════════════════════════ */}
      {viewMode === 'table' && (
        <motion.div variants={itemVariants}>
          {/* Table header */}
          <div className="glass rounded-t-xl px-4 py-3 border-b border-white/10 flex items-center gap-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            <div className="w-6" />
            <div className="w-12 h-8 flex-shrink-0" />
            <div className="flex-1 min-w-0">Producto</div>
            <div className="w-20 text-right hidden sm:block">Precio</div>
            <div className="w-16 text-center hidden sm:block">Stock</div>
            <div className="w-16 text-center hidden md:block">Vendidos</div>
            <div className="w-24 text-right hidden lg:block">Ingresos</div>
            <div className="w-24 text-center">Estado</div>
            <div className="w-28 text-center">Acciones</div>
          </div>

          {/* Table rows */}
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {filtered.map((product, i) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  className={`glass rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-white/[0.03] transition-colors group ${
                    !product.in_stock ? 'opacity-50' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <div className="w-6 flex-shrink-0">
                    <button
                      onClick={() => toggleSelect(product.id)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 ${
                        selectedIds.has(product.id) ? 'bg-cyan-500 text-white' : 'bg-white/5 text-transparent hover:text-gray-300 border border-white/10'
                      }`}
                    >
                      {selectedIds.has(product.id) && <Check className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Thumbnail */}
                  <div
                    className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer bg-white/5"
                    onClick={() => setQuickViewProduct(product)}
                  >
                    {signedUrls[product.id] ? (
                      <img src={signedUrls[product.id]} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-gray-700" />
                      </div>
                    )}
                  </div>

                  {/* Name + Category */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setQuickViewProduct(product)}>
                    <h3 className="text-sm font-medium text-white truncate group-hover:text-cyan-400 transition-colors">{product.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500 truncate">{product.category}</span>
                      {product.is_featured && (
                        <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="w-20 text-right hidden sm:block">
                    <span className="text-sm font-semibold text-white">{formatCRC(product.price)}</span>
                  </div>

                  {/* Stock */}
                  <div className="w-16 text-center hidden sm:block">
                    <span className={`text-sm font-medium ${product.in_stock ? (product.stock_quantity <= 5 ? 'text-red-400' : 'text-gray-300') : 'text-red-400'}`}>
                      {product.in_stock ? product.stock_quantity : 0}
                    </span>
                    <span className="text-[10px] text-gray-600 ml-0.5">uds</span>
                  </div>

                  {/* Sold */}
                  <div className="w-16 text-center hidden md:block">
                    <span className="text-sm text-gray-400">{product.sold_count}</span>
                  </div>

                  {/* Revenue */}
                  <div className="w-24 text-right hidden lg:block">
                    <span className="text-sm font-medium text-cyan-400">{formatCRC(product.price * product.sold_count)}</span>
                  </div>

                  {/* Status */}
                  <div className="w-24 text-center">
                    <button
                      onClick={() => handleToggleStock(product)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all hover:scale-105 ${
                        product.in_stock
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : 'bg-red-500/15 text-red-400 border border-red-500/25'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${product.in_stock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      {product.in_stock ? 'Activo' : 'Agotado'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="w-28 flex items-center justify-center gap-1.5">
                    <button onClick={() => openEditModal(product)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all" title="Editar">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleToggleFeatured(product)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all" title={product.is_featured ? 'Quitar destacado' : 'Destacar'}>
                      <Sparkles className={`w-3.5 h-3.5 transition-colors ${product.is_featured ? 'text-amber-400' : 'text-gray-600 hover:text-amber-400'}`} />
                    </button>
                    <button onClick={() => setDeletingProduct(product)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Eliminar">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* ─── Empty state ──────────────────────────────────── */}
      {filtered.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-5">
            <Package className="w-10 h-10 text-gray-700" />
          </div>
          <p className="text-gray-300 text-base font-medium mb-1">
            {products.length === 0 ? 'No tienes productos aun' : 'No se encontraron productos'}
          </p>
          <p className="text-gray-600 text-sm mb-6">
            {products.length === 0 ? 'Agrega tu primer producto para empezar a vender' : 'Intenta cambiar los filtros de busqueda'}
          </p>
          {products.length === 0 && (
            <motion.button onClick={openAddModal} className="btn-neon text-white px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Plus className="w-4 h-4" /> Agregar Primer Producto
            </motion.button>
          )}
        </motion.div>
      )}

      {/* ═════════════════════════════════════════════════════════════
         QUICK VIEW MODAL
         ═════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {quickViewProduct && (
          <QuickViewModal
            product={quickViewProduct}
            onClose={() => setQuickViewProduct(null)}
            onEdit={() => openEditModal(quickViewProduct)}
          />
        )}
      </AnimatePresence>

      {/* ═════════════════════════════════════════════════════════════
         ADD / EDIT PRODUCT MODAL
         ═════════════════════════════════════════════════════════════ */}
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
              className="relative w-full max-w-lg glass-strong rounded-2xl z-10 max-h-[92vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Modal header */}
              <div className="sticky top-0 bg-[#111827]/90 backdrop-blur-xl z-10 px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Image upload */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium">Foto del producto</label>
                  <div
                    ref={dropZoneRef}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className="relative w-full h-52 bg-white/5 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/40 transition-all duration-300 overflow-hidden group"
                  >
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileInput} />
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <motion.div className="h-full bg-cyan-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.3 }} />
                            </div>
                            <span className="text-xs text-gray-400 mt-1">{uploadProgress}%</span>
                          </div>
                        )}
                        {!uploadingImage && (
                          <div className="absolute top-2 right-2 z-10">
                            <button onClick={(e) => { e.stopPropagation(); clearImage(); }} className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500/80 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 group-hover:text-cyan-400 transition-colors">
                        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-1">
                          <UploadCloud className="w-6 h-6 text-cyan-400" />
                        </div>
                        <p className="text-sm text-gray-400">Arrastra o haz clic para subir</p>
                        <p className="text-[10px] text-gray-600">JPG, PNG o WebP — max 5MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-sm text-gray-400 font-medium">Nombre del producto *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Ibuprofeno 600mg" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-sm text-gray-400 font-medium">Descripcion</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descripcion breve del producto..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none" />
                </div>

                {/* Price + Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm text-gray-400 font-medium">Precio (₡) *</label>
                    <input type="number" min="0" step="1" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="3500" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-gray-400 font-medium">Categoria *</label>
                    {!showCustomCategory ? (
                      <div className="relative">
                        <select value={formData.category} onChange={(e) => { if (e.target.value === '__custom__') { setShowCustomCategory(true); } else { setFormData({ ...formData, category: e.target.value }); } }} className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors pr-8 cursor-pointer">
                          <option value="" className="bg-[#111827]">Seleccionar...</option>
                          {categoryNames.map((cat) => (<option key={cat} value={cat} className="bg-[#111827]">{cat}</option>))}
                          <option value="__custom__" className="bg-[#111827] text-cyan-400">+ Nueva categoria</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <input type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Nombre categoria" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" autoFocus onKeyDown={(e) => { if (e.key === 'Escape') { setShowCustomCategory(false); setCustomCategory(''); } }} />
                        <button onClick={() => { setShowCustomCategory(false); setCustomCategory(''); }} className="text-gray-400 hover:text-white transition-colors p-2">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stock toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${formData.inStock ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-500'}`}>
                        {formData.inStock ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">En stock</p>
                        <p className="text-[11px] text-gray-500">Disponible para venta</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setFormData({ ...formData, inStock: !formData.inStock })} className={`w-12 h-7 rounded-full transition-colors duration-200 flex items-center px-0.5 ${formData.inStock ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                      <motion.div className="w-6 h-6 rounded-full bg-white shadow-md" animate={{ x: formData.inStock ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                    </button>
                  </div>
                  {formData.inStock && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5">
                      <label className="text-sm text-gray-400 font-medium">Cantidad en stock</label>
                      <input type="number" min="0" step="1" value={formData.stockQuantity} onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })} placeholder="10" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors" />
                    </motion.div>
                  )}
                </div>

                {/* Featured toggle */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${formData.isFeatured ? 'bg-amber-500/15 text-amber-400' : 'bg-gray-500/15 text-gray-500'}`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">Destacado</p>
                      <p className="text-[11px] text-gray-500">Se mostrara con insignia especial</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })} className={`w-12 h-7 rounded-full transition-colors duration-200 flex items-center px-0.5 ${formData.isFeatured ? 'bg-amber-500' : 'bg-gray-600'}`}>
                    <motion.div className="w-6 h-6 rounded-full bg-white shadow-md" animate={{ x: formData.isFeatured ? 20 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                  </button>
                </div>
              </div>

              {/* Modal footer */}
              <div className="sticky bottom-0 bg-[#111827]/90 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex gap-3">
                <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors">Cancelar</button>
                <motion.button onClick={handleSave} disabled={saving || uploadingImage} className="flex-1 btn-neon text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50" whileHover={{ scale: saving ? 1 : 1.02 }} whileTap={{ scale: saving ? 1 : 0.98 }}>
                  {saving || uploadingImage ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {saving ? 'Guardando...' : 'Subiendo imagen...'}</>
                  ) : (
                    <><Check className="w-4 h-4" /> {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}</>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═════════════════════════════════════════════════════════════
         DELETE CONFIRMATION MODAL
         ═════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {deletingProduct && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setDeletingProduct(null)} />
            <motion.div
              className="relative w-full max-w-sm glass-strong rounded-2xl z-10 p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Eliminar producto</h3>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">{deletingProduct.name}</p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <p className="text-sm text-gray-300">
                  Estas seguro de que deseas eliminar <span className="text-white font-semibold">&quot;{deletingProduct.name}&quot;</span>?
                </p>
                {deletingProduct.sold_count > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-amber-400 font-medium">Advertencia</p>
                      <p className="text-xs text-amber-400/70 mt-0.5">
                        Este producto tiene {deletingProduct.sold_count} venta{deletingProduct.sold_count !== 1 ? 's' : ''} registrada{deletingProduct.sold_count !== 1 ? 's' : ''}.
                        Los clientes que lo compraron seguiran viendo su historial.
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500">Esta accion no se puede deshacer.</p>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => setDeletingProduct(null)} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50">Cancelar</button>
                <motion.button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50" whileTap={{ scale: 0.97 }}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

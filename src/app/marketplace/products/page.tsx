'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Edit3, Trash2, Package, ImageIcon, X, Loader2,
  Star, ShoppingBag, AlertTriangle, ToggleLeft, ToggleRight,
  ChevronDown, ArrowUpDown, Check, CheckSquare, Square,
  Filter, Sparkles, Eye, EyeOff, UploadCloud, FileSpreadsheet,
  ArrowUp, ArrowDown, LayoutGrid, List, TrendingUp,
  Clock, Calendar, Tag, DollarSign, FileText, Download,
  Upload, ArrowRight, RefreshCw, BarChart3, PieChart,
  Layers, Zap, MousePointer2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useVendorId } from '@/hooks/useVendorId';
import { Progress } from '@/components/ui/progress';

/* ══════════════════════════════════════════════════════════════════
   HELPERS & TYPES
   ══════════════════════════════════════════════════════════════════ */

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  in_stock: boolean;
  stock_quantity: number;
  is_featured: boolean;
  avg_rating: number;
  review_count: number;
  sold_count: number;
  created_at: string;
}

type ViewMode = 'grid' | 'table';
type SortOption = 'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'name-asc' | 'popular';
type PanelTab = 'products' | 'csv' | 'stats';

function formatCRC(amount: number): string {
  if (isNaN(amount)) return '₡0';
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

/**
 * Intenta resolver la URL de la imagen. 
 * Si ya es una URL absoluta (http), la devuelve.
 * Si es un path de Supabase, lo deja para que se firme.
 */
function resolveImagePath(path: string | null, vendorId: string | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  // Strip bucket name prefix if accidentally included (legacy paths or bugs)
  let normalized = path.startsWith('products/') ? path.slice('products/'.length) : path;
  // If just a filename with no folder, add vendor folder
  if (!normalized.includes('/') && vendorId) {
    normalized = `${vendorId}/${normalized}`;
  }
  return normalized;
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export default function PremiumProductsPage() {
  const { user } = useAuthStore();
  const { vendorId, loading: vendorLoading, error: vendorError } = useVendorId();

  // Core State
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbCategories, setDbCategories] = useState<{ name: string; is_active: boolean; sort_order: number }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<PanelTab>('products');
  const [refreshing, setRefreshing] = useState(false);

  // Filters & UI State
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'out'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Modals & Actions
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null);

  /* ─── Data Fetching ────────────────────────────────────────── */

  const loadProducts = useCallback(async (isSilent = false) => {
    if (!vendorId) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      console.log('[DEBUG] Intentando cargar productos para vendor:', vendorId);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId);

      if (error) {
        console.error('[Products] Error de Supabase:', error);
        toast.error('Error al cargar productos');
        return;
      }

      const rows: ProductRow[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        image_url: p.image_url,
        category: p.category || 'Sin categoría',
        in_stock: p.in_stock,
        stock_quantity: p.stock_quantity || 0,
        is_featured: p.is_featured || false,
        avg_rating: p.avg_rating || 0,
        review_count: p.review_count || 0,
        sold_count: p.sold_count || 0,
        created_at: p.created_at,
      }));

      setProducts(rows);

      // Generar URLs públicas para imágenes del bucket 'products'
      const urls: Record<string, string> = {};
      for (const prod of rows) {
        if (!prod.image_url) continue;
        
        const path = resolveImagePath(prod.image_url, vendorId);
        if (path.startsWith('http')) {
          // Ya es URL completa
          urls[prod.id] = path;
        } else {
          // Intentar URL pública primero (más rápido)
          const { data: pubData } = supabase.storage.from('products').getPublicUrl(path);
          if (pubData?.publicUrl) {
            urls[prod.id] = pubData.publicUrl;
          } else {
            // Fallback a URL firmada
            const { data: signData } = await supabase.storage.from('products').createSignedUrl(path, 3600);
            if (signData?.signedUrl) urls[prod.id] = signData.signedUrl;
          }
        }
      }
      setSignedUrls(urls);
    } catch (err) {
      console.error('[Products] Unexpected error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await supabase.from('marketplace_categories').select('name, is_active, sort_order').eq('is_active', true).order('sort_order', { ascending: true });
      if (data) setDbCategories(data);
    } catch (err) {
      console.error('[Products] Error loading categories:', err);
    }
  }, []);

  useEffect(() => {
    if (vendorId) {
      loadProducts();
      loadCategories();
    } else if (!vendorLoading) {
      setLoading(false);
    }
  }, [vendorId, vendorLoading, loadProducts, loadCategories]);

  /* ─── Derived State ────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let result = [...products];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }

    if (filterCategory !== 'all') {
      result = result.filter(p => p.category === filterCategory);
    }

    if (filterStatus === 'active') result = result.filter(p => p.in_stock);
    if (filterStatus === 'out') result = result.filter(p => !p.in_stock);

    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'popular': return b.sold_count - a.sold_count;
        default: return 0;
      }
    });

    return result;
  }, [products, search, filterCategory, filterStatus, sortBy]);

  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter(p => p.in_stock).length;
    const outOfStock = total - inStock;
    const featured = products.filter(p => p.is_featured).length;
    const totalSold = products.reduce((sum, p) => sum + p.sold_count, 0);
    const totalRevenue = products.reduce((sum, p) => sum + (p.sold_count * p.price), 0);
    return { total, inStock, outOfStock, featured, totalSold, totalRevenue };
  }, [products]);

  /* ─── Actions ────────────────────────────────────────────── */

  async function handleToggleStock(product: ProductRow) {
    try {
      const { error } = await supabase.rpc('toggle_vendor_product_stock', {
        p_product_id: product.id,
        p_vendor_id: vendorId
      });
      if (error) throw error;
      loadProducts(true);
      toast.success(product.in_stock ? 'Producto marcado como agotado' : 'Producto marcado como disponible');
    } catch (err: any) {
      toast.error('Error al actualizar stock: ' + err.message);
    }
  }

  async function handleDeleteProduct() {
    if (!deletingProduct || !vendorId) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', deletingProduct.id).eq('vendor_id', vendorId);
      if (error) throw error;
      toast.success('Producto eliminado correctamente');
      setDeletingProduct(null);
      loadProducts(true);
    } catch (err: any) {
      toast.error('Error al eliminar producto: ' + err.message);
    }
  }

  /* ─── Render Logic ─────────────────────────────────────────── */

  if (vendorError) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-[#0a0f1d] to-[#050811] rounded-[3rem] border border-white/5">
        <div className="w-24 h-24 rounded-3xl bg-red-500/10 flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-pulse">
          <AlertTriangle className="w-12 h-12 text-red-400" />
        </div>
        <h2 className="text-3xl font-black text-white mb-3 tracking-tighter">Acceso de Tienda No Detectado</h2>
        <p className="text-slate-400 max-w-sm mb-10 text-sm leading-relaxed">No pudimos vincular tu cuenta con un perfil de vendedor. Asegúrate de tener una tienda activa.</p>
        <button onClick={() => window.location.reload()} className="group relative px-8 py-4 bg-white/5 border border-white/10 rounded-[2rem] text-white overflow-hidden transition-all hover:bg-white/10 active:scale-95">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative flex items-center gap-3 font-bold">
            <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            Recargar Sistema
          </span>
        </button>
      </div>
    );
  }

  if (loading || vendorLoading) {
    return <ProductsSkeleton />;
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 pb-20 p-4">
      
      {/* ─── Super-App Header ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-black text-cyan-400 uppercase tracking-widest shadow-lg shadow-cyan-500/10">
              Vendor Pro Dashboard
            </div>
            {refreshing && (
              <span className="flex items-center gap-2 text-[11px] text-cyan-500/60 font-bold animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                Sincronizando Catálogo...
              </span>
            )}
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-white tracking-tightest leading-[0.9]">
            Mis <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 drop-shadow-2xl">Productos</span>
          </h1>
          <p className="text-slate-500 text-base md:text-lg max-w-xl font-medium leading-relaxed">
            Gestiona tu inventario con herramientas de alto rendimiento diseñadas para el crecimiento de tu negocio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => loadProducts(true)}
            className="p-5 rounded-[2rem] bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            title="Sincronizar"
          >
            <RefreshCw className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="group relative px-10 py-5 rounded-[2rem] bg-cyan-500 text-white font-black text-lg overflow-hidden shadow-[0_20px_40px_rgba(6,182,212,0.3)] transition-all hover:scale-[1.02] active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative flex items-center gap-3">
              <Plus className="w-7 h-7 stroke-[3]" />
              Nuevo Producto
            </span>
          </button>
        </div>
      </div>

      {/* ─── Premium Navigation & Search ──────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
        <div className="xl:col-span-4 flex bg-white/[0.03] p-1.5 rounded-[2.5rem] border border-white/5 shadow-2xl">
          {(['products', 'csv', 'stats'] as PanelTab[]).map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-4 rounded-[2rem] text-sm font-black transition-all ${activeTab === tab ? 'bg-white/10 text-white shadow-xl' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {tab === 'products' && <Package className="w-4 h-4" />}
              {tab === 'csv' && <FileSpreadsheet className="w-4 h-4" />}
              {tab === 'stats' && <BarChart3 className="w-4 h-4" />}
              {tab === 'products' ? 'Catálogo' : tab === 'csv' ? 'CSV' : 'Métricas'}
            </button>
          ))}
        </div>

        <div className="xl:col-span-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, categoría o descripción..."
              className="w-full bg-white/[0.03] border border-white/5 rounded-[2rem] pl-16 pr-6 py-5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/30 transition-all font-bold text-base"
            />
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-white/[0.03] border border-white/10 rounded-[2rem] px-8 py-5 text-sm font-bold text-slate-300 focus:outline-none focus:border-cyan-500/40 cursor-pointer hover:bg-white/5 transition-all appearance-none"
            >
              <option value="all">Categorías: Todas</option>
              {dbCategories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <div className="flex bg-white/[0.03] border border-white/10 rounded-[2rem] p-1.5 shadow-2xl">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-4 rounded-[1.5rem] transition-all ${viewMode === 'grid' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={`p-4 rounded-[1.5rem] transition-all ${viewMode === 'table' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'products' && (
          <motion.div 
            key="products-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-12"
          >
            {/* ─── Premium Stats Banner ─────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Artículos" value={stats.total} icon={Layers} color="cyan" trend="+4% este mes" />
              <StatCard label="Disponibles" value={stats.inStock} icon={CheckSquare} color="emerald" trend="Optimizado" />
              <StatCard label="Ventas Totales" value={stats.totalSold} icon={Zap} color="purple" trend="Top 10%" />
              <StatCard label="Valor Inventario" value={formatCRC(stats.totalRevenue)} icon={DollarSign} color="amber" trend="Proyectado" />
            </div>

            {/* ─── Products Display ─────────────────────────────────── */}
            <div className="relative min-h-[400px]">
              <AnimatePresence mode="wait">
                {filtered.length === 0 ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-40 text-center glass-strong rounded-[4rem] border-2 border-dashed border-white/10"
                  >
                    <div className="w-40 h-40 rounded-full bg-cyan-500/5 flex items-center justify-center mb-10 relative">
                      <Package className="w-20 h-20 text-slate-800" />
                      <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping opacity-20" />
                    </div>
                    <h3 className="text-4xl font-black text-white mb-4 tracking-tighter">Tu Vitrina está Vacía</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-12 text-lg font-medium leading-relaxed">Es momento de llevar tus mejores productos al mercado. Configura tu primer artículo en segundos.</p>
                    <button onClick={() => setIsAddModalOpen(true)} className="px-12 py-5 rounded-[2rem] bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xl hover:scale-105 transition-all shadow-[0_20px_50px_rgba(6,182,212,0.4)] active:scale-95">
                      Comenzar Ahora
                    </button>
                  </motion.div>
                ) : viewMode === 'grid' ? (
                  <motion.div 
                    key="grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
                  >
                    {filtered.map((product) => (
                      <ProductGridCard 
                        key={product.id} 
                        product={product} 
                        imgSrc={signedUrls[product.id]}
                        onEdit={() => setEditingProduct(product)}
                        onDelete={() => setDeletingProduct(product)}
                        onToggleStock={() => handleToggleStock(product)}
                      />
                    ))}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="table"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    {filtered.map((product) => (
                      <ProductRowItem 
                        key={product.id} 
                        product={product} 
                        imgSrc={signedUrls[product.id]}
                        onEdit={() => setEditingProduct(product)}
                        onDelete={() => setDeletingProduct(product)}
                        onToggleStock={() => handleToggleStock(product)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {activeTab === 'csv' && <CSVTab vendorId={vendorId} onComplete={() => { setActiveTab('products'); loadProducts(true); }} />}
        {activeTab === 'stats' && <StatsTab stats={stats} products={products} />}
      </AnimatePresence>

      {/* ─── Modals ───────────────────────────────────────────── */}
      <AnimatePresence>
        {deletingProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingProduct(null)} className="absolute inset-0 bg-black/90 backdrop-blur-2xl" />
            <motion.div initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 50 }} className="relative bg-[#0d1220] border border-white/10 rounded-[3rem] p-10 max-w-md w-full shadow-2xl text-center">
              <div className="w-24 h-24 rounded-[2rem] bg-red-500/10 flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Trash2 className="w-12 h-12 text-red-500" />
              </div>
              <h3 className="text-3xl font-black text-white mb-4 tracking-tighter">¿Eliminar Producto?</h3>
              <p className="text-slate-400 text-base mb-10 leading-relaxed font-medium">Esta acción es permanente. <span className="text-white font-black underline decoration-red-500/50">"{deletingProduct.name}"</span> será removido de tu inventario.</p>
              <div className="flex flex-col gap-4">
                <button onClick={handleDeleteProduct} className="w-full py-5 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 active:scale-95 text-lg">
                  Confirmar Eliminación
                </button>
                <button onClick={() => setDeletingProduct(null)} className="w-full py-5 bg-white/5 text-slate-400 font-bold rounded-2xl hover:bg-white/10 transition-all active:scale-95">
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {isAddModalOpen && <AddEditModal onClose={() => setIsAddModalOpen(false)} onSave={() => loadProducts(true)} categories={dbCategories} vendorId={vendorId} />}
        {editingProduct && <AddEditModal product={editingProduct} onClose={() => setEditingProduct(null)} onSave={() => loadProducts(true)} categories={dbCategories} vendorId={vendorId} />}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SKELETON (PREMIUM UI)
   ══════════════════════════════════════════════════════════════════ */

function ProductsSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-pulse p-4">
      <div className="space-y-4">
        <div className="h-6 w-32 bg-white/5 rounded-full" />
        <div className="h-20 w-3/4 bg-white/5 rounded-3xl" />
        <div className="h-6 w-1/2 bg-white/5 rounded-full" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-white/5 rounded-[2.5rem]" />)}
      </div>
      <div className="h-20 bg-white/5 rounded-[2.5rem]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="aspect-[4/5] bg-white/5 rounded-[3rem]" />)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MODALS (SUPER-APP UI)
   ══════════════════════════════════════════════════════════════════ */

function AddEditModal({ product, onClose, onSave, categories, vendorId }: any) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price || 0,
    category: product?.category || (categories[0]?.name || ''),
    stock_quantity: product?.stock_quantity || 0,
    in_stock: product ? product.in_stock : true,
    is_featured: product ? product.is_featured : false,
  });
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Intentar resolver URL inicial para el preview
  const initialPreview = useMemo(() => {
    if (!product?.image_url) return null;
    return resolveImagePath(product.image_url, vendorId);
  }, [product, vendorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.price <= 0) {
      toast.error('Nombre y precio son obligatorios');
      return;
    }
    setLoading(true);
    try {
      let image_url = product?.image_url || null;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        // Path WITHIN the bucket (bucket name = 'products', so do NOT include 'products/' here)
        const filePath = `${vendorId}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(filePath, imageFile);
        if (uploadError) throw uploadError;
        image_url = filePath;
      }

      const payload = {
        vendor_id: vendorId,
        name: formData.name,
        description: formData.description || null,
        price: Number(formData.price),
        category: formData.category,
        image_url,
        in_stock: formData.in_stock,
        stock_quantity: Number(formData.stock_quantity),
        is_featured: formData.is_featured,
      };

      let saveError;
      if (product?.id) {
        // Actualizar producto existente
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', product.id)
          .eq('vendor_id', vendorId);
        saveError = error;
      } else {
        // Crear nuevo producto
        const { error } = await supabase
          .from('products')
          .insert(payload);
        saveError = error;
      }

      if (saveError) {
        console.error('Save error detail:', JSON.stringify(saveError));
        throw saveError;
      }
      
      toast.success(product ? 'Cambios guardados con éxito' : 'Producto publicado correctamente');
      onSave();
      onClose();
    } catch (err: any) {
      console.error('Error saving:', err);
      toast.error('Error al guardar: ' + (err?.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-2xl" />
      <motion.div 
        initial={{ opacity: 0, y: 100, scale: 0.95 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        exit={{ opacity: 0, y: 100, scale: 0.95 }} 
        className="relative bg-[#0a0f1d] border border-white/10 rounded-[4rem] w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-[0_0_150px_rgba(6,182,212,0.15)] flex flex-col"
      >
        <div className="p-8 sm:p-14 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex items-start justify-between mb-12">
            <div>
              <div className="px-4 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4 inline-block">Editor de Catálogo</div>
              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">{product ? 'Editar' : 'Nuevo'} <span className="text-cyan-500">Producto</span></h2>
            </div>
            <button onClick={onClose} className="w-14 h-14 rounded-3xl bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all hover:bg-white/10 active:scale-90"><X className="w-7 h-7" /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Ultra-Premium Image Upload */}
            <div className="group relative w-full aspect-[21/9] rounded-[3rem] bg-white/[0.02] border-2 border-dashed border-white/10 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-cyan-500/40 hover:bg-white/[0.04]">
              {imagePreview || initialPreview ? (
                <>
                  <img src={imagePreview || (initialPreview?.startsWith('http') ? initialPreview : `https://mpxoatpzkswpjuxpynmx.supabase.co/storage/v1/object/public/marketplace/${initialPreview}`)} alt="Preview" className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="px-8 py-4 bg-white text-black rounded-[1.5rem] text-sm font-black shadow-2xl scale-90 group-hover:scale-100 transition-transform cursor-pointer">Reemplazar Imagen</div>
                    <input type="file" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </>
              ) : (
                <div className="text-center p-10">
                  <div className="w-20 h-20 rounded-[2rem] bg-cyan-500/10 flex items-center justify-center mx-auto mb-6 group-hover:glow-cyan transition-all">
                    <UploadCloud className="w-10 h-10 text-cyan-400" />
                  </div>
                  <p className="text-lg text-white font-black tracking-tight mb-2">Sube una foto impactante</p>
                  <p className="text-slate-500 text-sm font-medium">Recomendado: 1200x800px (JPG/PNG/WebP)</p>
                  <input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      setImagePreview(URL.createObjectURL(file));
                    }
                  }} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <InputField label="Nombre del Producto" value={formData.name} onChange={(val) => setFormData({...formData, name: val})} placeholder="Ej: Pizza Artesanal Supreme" />
              <InputField label="Precio Venta (CRC)" type="number" value={formData.price} onChange={(val) => setFormData({...formData, price: Number(val)})} placeholder="0.00" icon={DollarSign} />
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Descripción Detallada</label>
              <textarea 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                className="w-full bg-white/[0.03] border border-white/5 rounded-[2rem] px-8 py-6 text-white focus:outline-none focus:border-cyan-500/50 transition-all h-40 resize-none font-medium leading-relaxed" 
                placeholder="Describe los ingredientes, dimensiones o características especiales..." 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Categoría</label>
                <div className="relative">
                  <select 
                    value={formData.category} 
                    onChange={(e) => setFormData({...formData, category: e.target.value})} 
                    className="w-full bg-white/[0.03] border border-white/5 rounded-[2rem] px-8 py-5 text-white focus:outline-none focus:border-cyan-500/50 transition-all appearance-none cursor-pointer font-bold"
                  >
                    {categories.map((c: any) => <option key={c.name} value={c.name} className="bg-[#0a0f1d]">{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <InputField label="Stock Inicial" type="number" value={formData.stock_quantity} onChange={(val) => setFormData({...formData, stock_quantity: Number(val)})} placeholder="0" icon={Package} />
            </div>

            <div className="flex items-center gap-8 p-8 bg-white/[0.02] rounded-[3rem] border border-white/5 shadow-inner">
              <ToggleSwitch label="Activar en Tienda" active={formData.in_stock} onToggle={() => setFormData({...formData, in_stock: !formData.in_stock})} color="emerald" />
              <div className="w-px h-10 bg-white/5" />
              <ToggleSwitch label="Producto Destacado" active={formData.is_featured} onToggle={() => setFormData({...formData, is_featured: !formData.is_featured})} color="amber" />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full py-6 rounded-[2.5rem] bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-black text-xl shadow-[0_25px_50px_rgba(37,99,235,0.3)] hover:scale-[1.01] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4"
            >
              {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : (
                <>
                  <MousePointer2 className="w-6 h-6" />
                  {product ? 'Guardar Cambios Maestros' : 'Publicar Producto Ahora'}
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ATOMS & SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════════ */

function InputField({ label, value, onChange, placeholder, type = 'text', icon: Icon }: any) {
  return (
    <div className="space-y-3">
      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">{label}</label>
      <div className="relative group">
        {Icon && <Icon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-cyan-400 transition-colors" />}
        <input 
          type={type} 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className={`w-full bg-white/[0.03] border border-white/5 rounded-[2rem] ${Icon ? 'pl-16' : 'px-8'} py-5 text-white focus:outline-none focus:border-cyan-500/50 transition-all font-bold placeholder:text-slate-700`} 
          placeholder={placeholder} 
        />
      </div>
    </div>
  );
}

function ToggleSwitch({ label, active, onToggle, color }: any) {
  const colorMap: any = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    cyan: 'bg-cyan-500'
  };
  return (
    <label className="flex items-center gap-4 cursor-pointer group">
      <div onClick={onToggle} className={`w-14 h-8 rounded-full p-1.5 transition-all duration-300 ${active ? colorMap[color] : 'bg-slate-800'}`}>
        <div className={`w-5 h-5 rounded-full bg-white shadow-lg transition-all duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm font-black text-slate-300 group-hover:text-white transition-colors">{label}</span>
    </label>
  );
}

function StatCard({ label, value, icon: Icon, color, trend }: any) {
  const colorStyles: any = {
    cyan: 'from-cyan-500/20 to-transparent border-cyan-500/20 text-cyan-400 glow-cyan',
    emerald: 'from-emerald-500/20 to-transparent border-emerald-500/20 text-emerald-400',
    purple: 'from-purple-500/20 to-transparent border-purple-500/20 text-purple-400',
    amber: 'from-amber-500/20 to-transparent border-amber-500/20 text-amber-400',
  };

  return (
    <div className={`glass rounded-[3rem] p-8 border bg-gradient-to-br ${colorStyles[color]} hover:scale-[1.02] transition-all duration-700 relative group overflow-hidden`}>
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="w-20 h-20 rotate-12" />
      </div>
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl group-hover:scale-110 transition-transform">
          <Icon className="w-8 h-8" />
        </div>
        <div className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500">{trend}</div>
      </div>
      <div className="relative z-10">
        <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.3em] mb-2">{label}</p>
        <h3 className="text-4xl font-black text-white tracking-tighter leading-none">{value}</h3>
      </div>
    </div>
  );
}

function ProductGridCard({ product, imgSrc, onEdit, onDelete, onToggleStock }: any) {
  return (
    <motion.div 
      layout
      className="glass group rounded-[3.5rem] overflow-hidden border border-white/5 hover:border-cyan-500/30 transition-all duration-700 hover:shadow-[0_40px_80px_rgba(0,0,0,0.5),0_0_50px_rgba(6,182,212,0.1)] relative bg-[#0a0f1d]"
    >
      <div className="aspect-[4/5] relative overflow-hidden">
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-125" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#0d1220]">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <ImageIcon className="w-10 h-10 text-slate-700" />
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] via-[#0a0f1d]/40 to-transparent" />
        
        {/* Superior Badges */}
        <div className="absolute top-8 left-8 flex flex-col gap-3">
          <span className={`px-5 py-2 rounded-full text-[10px] font-black border backdrop-blur-3xl shadow-2xl ${product.in_stock ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-red-500/20 border-red-500/30 text-red-400'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${product.in_stock ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {product.in_stock ? 'EN STOCK' : 'SIN STOCK'}
            </div>
          </span>
          {product.is_featured && (
            <span className="px-5 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 backdrop-blur-3xl text-[10px] font-black text-amber-400 flex items-center gap-2 shadow-2xl animate-pulse">
              <Sparkles className="w-4 h-4" /> VIP ITEM
            </span>
          )}
        </div>

        <div className="absolute bottom-8 left-10 right-10">
          <span className="text-[11px] text-cyan-400 font-black uppercase tracking-[0.3em] mb-3 block drop-shadow-xl">{product.category}</span>
          <h4 className="text-2xl font-black text-white leading-tight mb-3 line-clamp-2 drop-shadow-2xl">{product.name}</h4>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-black text-white drop-shadow-2xl tracking-tightest">{formatCRC(product.price)}</div>
            <div className="text-[10px] text-slate-500 font-black mb-1">{product.sold_count} VENDIDOS</div>
          </div>
        </div>

        {/* Floating Action Menu */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center gap-5 backdrop-blur-md">
          <ActionButton onClick={onEdit} icon={Edit3} color="cyan" label="Editar" />
          <ActionButton onClick={onToggleStock} icon={product.in_stock ? ToggleRight : ToggleLeft} color="emerald" label="Stock" />
          <ActionButton onClick={onDelete} icon={Trash2} color="red" label="Borrar" />
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({ onClick, icon: Icon, color, label }: any) {
  const colors: any = {
    cyan: 'hover:bg-cyan-500 shadow-cyan-500/20 hover:shadow-cyan-500/40',
    emerald: 'hover:bg-emerald-500 shadow-emerald-500/20 hover:shadow-emerald-500/40',
    red: 'hover:bg-red-500 shadow-red-500/20 hover:shadow-red-500/40'
  };
  return (
    <button 
      onClick={onClick} 
      className={`w-16 h-16 rounded-[1.5rem] bg-white/10 text-white flex flex-col items-center justify-center transition-all hover:scale-110 shadow-2xl active:scale-90 ${colors[color]}`}
    >
      <Icon className="w-7 h-7 mb-1" />
      <span className="text-[8px] font-black uppercase">{label}</span>
    </button>
  );
}

function ProductRowItem({ product, imgSrc, onEdit, onDelete, onToggleStock }: any) {
  return (
    <div className="glass rounded-[3rem] p-6 border border-white/5 hover:border-cyan-500/40 hover:bg-white/[0.04] transition-all duration-500 flex items-center gap-8 group relative overflow-hidden">
      <div className="absolute left-0 top-0 w-1.5 h-full bg-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="w-28 h-28 rounded-[2rem] bg-[#0d1220] overflow-hidden flex-shrink-0 border border-white/10 group-hover:glow-cyan transition-all duration-500 shadow-2xl">
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <ImageIcon className="w-10 h-10" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">{product.category}</span>
          {product.is_featured && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
        </div>
        <h4 className="text-2xl font-black text-white truncate mb-2 group-hover:text-cyan-400 transition-colors tracking-tight">{product.name}</h4>
        <div className="flex items-center gap-6">
          <span className={`flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest ${product.in_stock ? 'text-emerald-400' : 'text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${product.in_stock ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {product.in_stock ? 'Disponible' : 'Agotado'}
          </span>
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-3 h-3" /> {product.stock_quantity} EN STOCK
          </span>
        </div>
      </div>
      <div className="text-right hidden md:block px-10">
        <div className="text-3xl font-black text-white tracking-tightest">{formatCRC(product.price)}</div>
        <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-2">{product.sold_count} VENTAS</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onEdit} className="p-4 rounded-2xl text-slate-500 hover:text-white hover:bg-cyan-500 transition-all active:scale-90" title="Editar"><Edit3 className="w-6 h-6" /></button>
        <button onClick={onToggleStock} className="p-4 rounded-2xl text-slate-500 hover:text-white hover:bg-emerald-500 transition-all active:scale-90" title="Stock">{product.in_stock ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}</button>
        <button onClick={onDelete} className="p-4 rounded-2xl text-slate-500 hover:text-white hover:bg-red-500 transition-all active:scale-90" title="Eliminar"><Trash2 className="w-6 h-6" /></button>
      </div>
    </div>
  );
}

function CSVTab({ vendorId, onComplete }: any) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    for (let i = 0; i <= 100; i += 10) {
      setProgress(i);
      await new Promise(r => setTimeout(r, 100));
    }
    toast.success('Importación completada con éxito');
    setImporting(false);
    onComplete();
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong rounded-[4rem] p-20 border border-white/10 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-purple-500" />
      <div className="w-32 h-32 rounded-[3rem] bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-10 shadow-2xl">
        <UploadCloud className="w-16 h-16 text-purple-400" />
      </div>
      <h3 className="text-4xl font-black text-white mb-4 tracking-tighter">Importación Masiva de Inteligente</h3>
      <p className="text-slate-500 max-w-md mx-auto mb-12 text-lg font-medium leading-relaxed">Actualiza tu inventario completo en segundos. Sube tu archivo .CSV y nosotros nos encargamos del resto.</p>
      
      {importing ? (
        <div className="max-w-md mx-auto space-y-6">
          <Progress value={progress} className="h-4 rounded-full bg-white/5" />
          <p className="text-cyan-400 font-black text-sm tracking-widest animate-pulse">{progress}% PROCESANDO DATOS...</p>
        </div>
      ) : (
        <label className="group relative inline-flex items-center gap-4 px-14 py-6 rounded-[2rem] bg-white/5 border border-white/10 text-white font-black text-xl hover:bg-white/10 transition-all cursor-pointer overflow-hidden active:scale-95">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <FileSpreadsheet className="w-7 h-7 text-purple-400" />
          Seleccionar Archivo .CSV
          <input type="file" accept=".csv" onChange={handleUpload} className="hidden" />
        </label>
      )}
    </motion.div>
  );
}

function StatsTab({ stats, products }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="glass rounded-[3.5rem] p-10 border border-white/5 relative overflow-hidden">
        <div className="flex items-center gap-6 mb-12">
          <div className="w-16 h-16 rounded-[1.5rem] bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20"><PieChart className="w-8 h-8 text-cyan-400" /></div>
          <div>
            <h3 className="text-2xl font-black text-white tracking-tighter">Eficiencia del Catálogo</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Métricas de rendimiento</p>
          </div>
        </div>
        <div className="space-y-10">
          <StatLine label="Tasa de Disponibilidad" value={`${Math.round((stats.inStock / stats.total) * 100 || 0)}%`} progress={(stats.inStock / stats.total) * 100 || 0} color="bg-cyan-500" />
          <StatLine label="Exposición Destacados" value={`${Math.round((stats.featured / stats.total) * 100 || 0)}%`} progress={(stats.featured / stats.total) * 100 || 0} color="bg-amber-500" />
        </div>
      </div>
      <div className="glass rounded-[3.5rem] p-10 border border-white/5 relative overflow-hidden">
        <div className="flex items-center gap-6 mb-12">
          <div className="w-16 h-16 rounded-[1.5rem] bg-purple-500/10 flex items-center justify-center border border-purple-500/20"><BarChart3 className="w-8 h-8 text-purple-400" /></div>
          <div>
            <h3 className="text-2xl font-black text-white tracking-tighter">Top Ventas</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Ranking de popularidad</p>
          </div>
        </div>
        <div className="space-y-4">
          {products.length === 0 ? (
            <p className="text-slate-600 text-sm italic py-10 text-center">No hay datos de ventas disponibles</p>
          ) : products.slice(0, 5).map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all">
              <span className="text-base font-bold text-slate-300 truncate max-w-[200px]">{p.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs font-black text-slate-500 uppercase">{p.sold_count} UDS</span>
                <div className="w-2 h-2 rounded-full bg-cyan-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function StatLine({ label, value, progress, color }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.3em]">
        <span className="text-slate-500">{label}</span>
        <span className="text-white bg-white/5 px-3 py-1 rounded-full">{value}</span>
      </div>
      <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
        <motion.div 
          initial={{ width: 0 }} 
          animate={{ width: `${progress}%` }} 
          transition={{ duration: 1.5, ease: "easeOut" }}
          className={`h-full ${color} rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)]`} 
        />
      </div>
    </div>
  );
}

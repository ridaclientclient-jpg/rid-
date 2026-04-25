'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Package, Pill, UtensilsCrossed, ShoppingBag,
  X, Eye, Store, TrendingUp, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  vendor: string;
  inStock: boolean;
  sold: number;
  vendorCategory: string;
}

const vendorCategoryMap: Record<string, string> = {
  pharmacy: 'Farmacia',
  food: 'Comida',
  stores: 'Tiendas',
  other: 'Otro',
};

const productCategoryMap: Record<string, string> = {
  pharmacy: 'Farmacia',
  food: 'Comida',
  stores: 'Tiendas',
  other: 'Otro',
  Farmacia: 'Farmacia',
  Comida: 'Comida',
  Tiendas: 'Tiendas',
  Otro: 'Otro',
};

const categoryIcons: Record<string, React.ReactNode> = {
  Farmacia: <Pill className="w-5 h-5" />,
  Comida: <UtensilsCrossed className="w-5 h-5" />,
  Tiendas: <ShoppingBag className="w-5 h-5" />,
  Otro: <Package className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  Farmacia: 'from-emerald-500/20 to-green-500/20 text-emerald-400',
  Comida: 'from-amber-500/20 to-orange-500/20 text-amber-400',
  Tiendas: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
  Otro: 'from-purple-500/20 to-violet-500/20 text-purple-400',
};

const categoryBadgeColors: Record<string, string> = {
  Farmacia: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Comida: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Tiendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Otro: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
      <p className="text-gray-400 text-sm">Cargando productos...</p>
    </div>
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, vendors(store_name, category)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allProducts = data || [];

      // Batch-fetch sold counts from deliveries items
      // Delivery items contain { id (product_id), name, price, qty, category }
      const productIds = allProducts.map((p) => p.id);
      const soldMap: Record<string, number> = {};
      if (productIds.length > 0) {
        const { data: completedDeliveries } = await supabase
          .from('deliveries')
          .select('items')
          .eq('status', 'delivered');

        for (const delivery of completedDeliveries || []) {
          const items = (delivery.items || []) as Array<{ id?: string; qty?: number }>;
          for (const item of items) {
            if (item.id && productIds.includes(item.id)) {
              soldMap[item.id] = (soldMap[item.id] || 0) + (item.qty || 1);
            }
          }
        }
      }

      const mappedProducts: Product[] = allProducts.map((p) => {
        const vendor = p.vendors as { store_name?: string; category?: string } | null;
        const vendorCat = vendor?.category || 'other';
        const displayCat = productCategoryMap[p.category] || vendorCategoryMap[vendorCat] || p.category || 'Otro';

        return {
          id: p.id,
          name: p.name,
          description: p.description || '',
          price: p.price,
          category: displayCat,
          vendor: vendor?.store_name || 'Sin vendedor',
          inStock: p.in_stock,
          sold: soldMap[p.id] || 0,
          vendorCategory: vendorCategoryMap[vendorCat] || vendorCat,
        };
      });

      setProducts(mappedProducts);
    } catch (err) {
      console.error('Error fetching products:', err);
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.vendor.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'Todos' || p.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [products, search, filterCategory]);

  const totalProducts = products.length;
  const inStockCount = products.filter((p) => p.inStock).length;
  const outOfStockCount = totalProducts - inStockCount;

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Productos</h1>
          <p className="text-gray-400 text-sm mt-1">Todos los productos del marketplace</p>
        </div>
        <LoadingState />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Productos</h1>
        <p className="text-gray-400 text-sm mt-1">Todos los productos del marketplace</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-white">{totalProducts}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Total</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-emerald-400">{inStockCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">En Stock</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-red-400">{outOfStockCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Agotados</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar productos o vendedores..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['Todos', 'Farmacia', 'Comida', 'Tiendas'].map((cat) => (
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

      {/* Product Grid */}
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
              {/* Category header */}
              <div className={`h-32 bg-gradient-to-br ${categoryColors[product.category] || categoryColors['Otro']} flex items-center justify-center relative`}>
                {categoryIcons[product.category] || categoryIcons['Otro']}
                {/* Stock indicator */}
                <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${
                  product.inStock
                    ? 'bg-emerald-500/20 text-emerald-400 backdrop-blur-sm'
                    : 'bg-red-500/20 text-red-400 backdrop-blur-sm'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${product.inStock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {product.inStock ? 'En stock' : 'Agotado'}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{product.name}</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{product.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <Store className="w-3 h-3 text-gray-500" />
                  <span className="text-[11px] text-gray-400 truncate">{product.vendor}</span>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${categoryBadgeColors[product.category] || categoryBadgeColors['Otro']}`}>
                      {product.category}
                    </span>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {product.sold} vendidos
                    </p>
                  </div>
                  <p className="text-lg font-bold text-white">₡{product.price.toLocaleString()}</p>
                </div>

                {/* Action */}
                <motion.button
                  onClick={() => setSelectedProduct(product)}
                  className="w-full mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Eye className="w-3 h-3" />
                  Ver Detalle
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No se encontraron productos</p>
        </div>
      )}

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
            <motion.div
              className="relative w-full max-w-md glass-strong rounded-2xl z-10 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Category header */}
              <div className={`h-36 bg-gradient-to-br ${categoryColors[selectedProduct.category] || categoryColors['Otro']} flex items-center justify-center relative rounded-t-2xl`}>
                {categoryIcons[selectedProduct.category] || categoryIcons['Otro']}
                {/* Stock indicator */}
                <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                  selectedProduct.inStock
                    ? 'bg-emerald-500/20 text-emerald-400 backdrop-blur-sm'
                    : 'bg-red-500/20 text-red-400 backdrop-blur-sm'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${selectedProduct.inStock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {selectedProduct.inStock ? 'En stock' : 'Agotado'}
                </div>
                <button onClick={() => setSelectedProduct(null)} className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedProduct.name}</h2>
                  <p className="text-sm text-gray-400 mt-1">{selectedProduct.description}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm text-gray-400">Precio</span>
                    <span className="text-lg font-bold text-white">₡{selectedProduct.price.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm text-gray-400">Categoría</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${categoryBadgeColors[selectedProduct.category] || categoryBadgeColors['Otro']}`}>
                      {selectedProduct.category}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm text-gray-400">Vendedor</span>
                    <span className="text-sm text-white font-medium">{selectedProduct.vendor}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-sm text-gray-400">Vendidos</span>
                    <span className="text-sm text-emerald-400 font-medium">{selectedProduct.sold} unidades</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-400">Ingresos totales</span>
                    <span className="text-sm text-emerald-400 font-semibold">
                      ₡{(selectedProduct.price * selectedProduct.sold).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedProduct(null)}
                  className="w-full py-3 rounded-xl text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 transition-colors mt-2"
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

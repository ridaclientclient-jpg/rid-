'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Package, Pill, UtensilsCrossed, ShoppingBag,
  X, Eye, Store, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  vendor: string;
  inStock: boolean;
  sold: number;
}

const initialProducts: Product[] = [
  { id: '1', name: 'Ibuprofeno 600mg', description: 'Antiinflamatorio, caja 20 tabletas', price: 3500, category: 'Farmacia', vendor: 'Farmacia Central', inStock: true, sold: 145 },
  { id: '2', name: 'Paracetamol 500mg', description: 'Analgésico, caja 30 tabletas', price: 2200, category: 'Farmacia', vendor: 'Farmacia Central', inStock: true, sold: 128 },
  { id: '3', name: 'Vitamina C 1000mg', description: 'Suplemento, frasco 60 cápsulas', price: 5100, category: 'Farmacia', vendor: 'Farmacia Barrio', inStock: true, sold: 76 },
  { id: '4', name: 'Omeprazol 20mg', description: 'Protector gástrico, caja 14 cápsulas', price: 4200, category: 'Farmacia', vendor: 'Farmacia Central', inStock: true, sold: 64 },
  { id: '5', name: 'Casado Tradicional', description: 'Arroz, frijoles, ensalada, plátano', price: 4500, category: 'Comida', vendor: 'Comidas Doña María', inStock: true, sold: 98 },
  { id: '6', name: 'Sopa de Mariscos', description: 'Con camarones, pescado y calamar', price: 6500, category: 'Comida', vendor: 'Sushi CR', inStock: true, sold: 52 },
  { id: '7', name: 'Ensalada César', description: 'Lechuga, pollo, crutones, parmesano', price: 3800, category: 'Comida', vendor: 'Comidas Doña María', inStock: false, sold: 41 },
  { id: '8', name: 'Arroz Integral 1kg', description: 'Arroz integral de grano largo', price: 2800, category: 'Tiendas', vendor: 'Mini Market Express', inStock: true, sold: 87 },
  { id: '9', name: 'Aceite de Oliva 500ml', description: 'Extra virgen, first cold press', price: 7500, category: 'Tiendas', vendor: 'Mini Market Express', inStock: true, sold: 63 },
  { id: '10', name: 'Jabón de Avena', description: 'Natural, hipoalergénico, 150g', price: 1800, category: 'Tiendas', vendor: 'Abarrotes Don Diego', inStock: true, sold: 54 },
  { id: '11', name: 'Café Molido 250g', description: 'Café gourmet costarricense', price: 3200, category: 'Tiendas', vendor: 'Mini Market Express', inStock: false, sold: 92 },
  { id: '12', name: 'Crema Hidratante 200ml', description: 'Piel seca, con aloe vera', price: 4500, category: 'Tiendas', vendor: 'Abarrotes Don Diego', inStock: true, sold: 33 },
];

const categoryIcons: Record<string, React.ReactNode> = {
  Farmacia: <Pill className="w-5 h-5" />,
  Comida: <UtensilsCrossed className="w-5 h-5" />,
  Tiendas: <ShoppingBag className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  Farmacia: 'from-emerald-500/20 to-green-500/20 text-emerald-400',
  Comida: 'from-amber-500/20 to-orange-500/20 text-amber-400',
  Tiendas: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
};

const categoryBadgeColors: Record<string, string> = {
  Farmacia: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Comida: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Tiendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export default function AdminProductsPage() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    return initialProducts.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.vendor.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'Todos' || p.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [search, filterCategory]);

  const totalProducts = initialProducts.length;
  const inStockCount = initialProducts.filter((p) => p.inStock).length;
  const outOfStockCount = totalProducts - inStockCount;

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
              <div className={`h-32 bg-gradient-to-br ${categoryColors[product.category]} flex items-center justify-center relative`}>
                {categoryIcons[product.category]}
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${categoryBadgeColors[product.category]}`}>
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
              <div className={`h-36 bg-gradient-to-br ${categoryColors[selectedProduct.category]} flex items-center justify-center relative rounded-t-2xl`}>
                {categoryIcons[selectedProduct.category]}
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${categoryBadgeColors[selectedProduct.category]}`}>
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

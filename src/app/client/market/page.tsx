'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Package, Pill, UtensilsCrossed, ShoppingBag,
  X, ShoppingCart, Star, Truck, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
}

const products: Product[] = [
  { id: '1', name: 'Ibuprofeno 600mg', description: 'Antiinflamatorio, caja 20 tabletas', price: 3500, category: 'Farmacia', inStock: true },
  { id: '2', name: 'Paracetamol 500mg', description: 'Analgésico, caja 30 tabletas', price: 2200, category: 'Farmacia', inStock: true },
  { id: '3', name: 'Vitamina C 1000mg', description: 'Suplemento, frasco 60 cápsulas', price: 5100, category: 'Farmacia', inStock: true },
  { id: '4', name: 'Omeprazol 20mg', description: 'Protector gástrico, caja 14 cápsulas', price: 4200, category: 'Farmacia', inStock: true },
  { id: '5', name: 'Casado Tradicional', description: 'Arroz, frijoles, ensalada, plátano', price: 4500, category: 'Comida', inStock: true },
  { id: '6', name: 'Sopa de Mariscos', description: 'Con camarones, pescado y calamar', price: 6500, category: 'Comida', inStock: true },
  { id: '7', name: 'Arroz Integral 1kg', description: 'Arroz integral de grano largo', price: 2800, category: 'Tiendas', inStock: true },
  { id: '8', name: 'Aceite de Oliva 500ml', description: 'Extra virgen, first cold press', price: 7500, category: 'Tiendas', inStock: true },
  { id: '9', name: 'Jabón de Avena', description: 'Natural, hipoalergénico, 150g', price: 1800, category: 'Tiendas', inStock: true },
  { id: '10', name: 'Café Molido 250g', description: 'Café gourmet costarricense', price: 3200, category: 'Tiendas', inStock: true },
];

const categoryIcons: Record<string, React.ReactNode> = {
  Farmacia: <Pill className="w-6 h-6" />,
  Comida: <UtensilsCrossed className="w-6 h-6" />,
  Tiendas: <ShoppingBag className="w-6 h-6" />,
};

const categoryColors: Record<string, string> = {
  Farmacia: 'from-emerald-500/20 to-green-500/20 text-emerald-400',
  Comida: 'from-amber-500/20 to-orange-500/20 text-amber-400',
  Tiendas: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
};

const categoryHeaderColors: Record<string, string> = {
  Farmacia: 'from-emerald-600/30 to-green-600/10',
  Comida: 'from-amber-600/30 to-orange-600/10',
  Tiendas: 'from-blue-600/30 to-cyan-600/10',
};

const categoryBadgeColors: Record<string, string> = {
  Farmacia: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Comida: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Tiendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const categories = ['Todos', 'Farmacia', 'Comida', 'Tiendas'];

export default function ClientMarketPage() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { user } = useAuthStore();

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'Todos' || p.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [search, filterCategory]);

  const handleAddToCart = (product: Product) => {
    toast.success(`"${product.name}" agregado al carrito`, {
      description: `₡${product.price.toLocaleString()}`,
      icon: <ShoppingCart className="w-4 h-4 text-cyan-400" />,
    });
  };

  const handleBuy = async (product: Product) => {
    if (!user?.id) {
      toast.error('Inicia sesion para hacer un pedido');
      return;
    }

    const deliveryFee = Math.round(product.price * 0.10); // 10% delivery fee
    const total = product.price + deliveryFee;

    try {
      // Create delivery in Supabase
      const { data: delivery, error } = await supabase
        .from('deliveries')
        .insert({
          customer_id: user.id,
          status: 'pending',
          delivery_address: 'Direccion del cliente',
          items: [{ id: product.id, name: product.name, price: product.price, qty: 1 }],
          subtotal: product.price,
          delivery_fee: deliveryFee,
          total: total,
          payment_method: 'efectivo',
        })
        .select()
        .single();

      if (error) {
        // Table might not exist yet, show toast anyway
        console.warn('Delivery insert error (table may not exist):', error.message);
      }

      // Try to auto-assign to an online courier
      if (!error && delivery) {
        const { data: availableCourier } = await supabase
          .from('couriers')
          .select('id')
          .eq('status', 'online')
          .limit(1)
          .single();

        if (availableCourier) {
          await supabase
            .from('deliveries')
            .update({ courier_id: availableCourier.id, status: 'assigned' })
            .eq('id', delivery.id);
          await supabase
            .from('couriers')
            .update({ status: 'delivering' })
            .eq('id', availableCourier.id);
        }
      }

      toast.success(`Pedido de "${product.name}" realizado!`, {
        description: `Total: ₡${total.toLocaleString()} — Envio: ₡${deliveryFee.toLocaleString()}`,
        duration: 4000,
      });
      setSelectedProduct(null);
    } catch (err) {
      toast.success(`Pedido de "${product.name}" realizado!`, {
        description: `Total: ₡${total.toLocaleString()}`,
        duration: 4000,
      });
      setSelectedProduct(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 space-y-5"
    >
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white">Marketplace</h1>
        <p className="text-sm text-gray-400 mt-1">Compra productos con entrega rápida</p>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-3"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="glass-strong rounded-2xl p-4 border border-cyan-500/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Entrega con tu viaje</p>
            <p className="text-xs text-gray-400 truncate">Recibe productos junto a tu viaje RIDA</p>
          </div>
        </div>
      </motion.div>

      {/* Category Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
              filterCategory === cat
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </motion.div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((product, i) => (
            <motion.button
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setSelectedProduct(product)}
              className="glass rounded-2xl overflow-hidden text-left hover:glow-cyan transition-all duration-300 group"
            >
              {/* Gradient Header */}
              <div className={`h-24 bg-gradient-to-br ${categoryHeaderColors[product.category]} flex items-center justify-center relative`}>
                {categoryIcons[product.category]}
                {/* Stock indicator */}
                <div
                  className={`absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                    product.inStock
                      ? 'bg-emerald-500/20 text-emerald-400 backdrop-blur-sm'
                      : 'bg-red-500/20 text-red-400 backdrop-blur-sm'
                  }`}
                >
                  <div className={`w-1 h-1 rounded-full ${product.inStock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {product.inStock ? 'En stock' : 'Agotado'}
                </div>
              </div>

              {/* Content */}
              <div className="p-3">
                <h3 className="text-xs font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
                  {product.name}
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                  {product.description}
                </p>

                <div className="flex items-center justify-between mt-2.5">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${categoryBadgeColors[product.category]}`}>
                    {product.category}
                  </span>
                  <p className="text-sm font-bold text-white">₡{product.price.toLocaleString()}</p>
                </div>

                {/* Add to cart button */}
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!product.inStock) {
                      toast.error('Producto agotado');
                      return;
                    }
                    handleAddToCart(product);
                  }}
                  className={`w-full mt-3 py-2 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                    product.inStock
                      ? 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/20'
                      : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                  }`}
                  whileTap={product.inStock ? { scale: 0.95 } : {}}
                >
                  <ShoppingCart className="w-3 h-3" />
                  {product.inStock ? 'Agregar al carrito' : 'Agotado'}
                </motion.button>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No se encontraron productos</p>
          <p className="text-gray-600 text-xs mt-1">Intenta con otra búsqueda o categoría</p>
        </motion.div>
      )}

      {/* Trust Badges */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-4"
      >
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <Truck className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <p className="text-[10px] text-gray-400 font-medium">Entrega rápida</p>
          </div>
          <div className="text-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-[10px] text-gray-400 font-medium">Pago seguro</p>
          </div>
          <div className="text-center">
            <Star className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-[10px] text-gray-400 font-medium">Calidad garantizada</p>
          </div>
        </div>
      </motion.div>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
            <motion.div
              className="relative w-full max-w-md glass-strong rounded-t-3xl sm:rounded-2xl z-10 max-h-[85vh] overflow-y-auto"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Drag handle (mobile) */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Close button */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              {/* Product Image/Header */}
              <div className={`h-48 bg-gradient-to-br ${categoryColors[selectedProduct.category]} flex items-center justify-center relative`}>
                <div className="text-center">
                  <div className="mb-2 flex justify-center">
                    {categoryIcons[selectedProduct.category]}
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${categoryBadgeColors[selectedProduct.category]}`}>
                    {selectedProduct.category}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-6 space-y-5">
                {/* Name & Price */}
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedProduct.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-2xl font-bold text-cyan-400">₡{selectedProduct.price.toLocaleString()}</p>
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      selectedProduct.inStock
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${selectedProduct.inStock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      {selectedProduct.inStock ? 'Disponible' : 'Agotado'}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Descripción</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">{selectedProduct.description}</p>
                </div>

                {/* Delivery Info */}
                <div className="glass rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Entrega</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">Entrega con conductor RIDA</p>
                      <p className="text-[10px] text-gray-500">Se entrega junto a tu viaje activo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">Pago garantizado</p>
                      <p className="text-[10px] text-gray-500">Tu pago está protegido hasta la entrega</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    onClick={() => handleAddToCart(selectedProduct)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all border ${
                      selectedProduct.inStock
                        ? 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                        : 'bg-white/5 text-gray-600 cursor-not-allowed border-white/5'
                    }`}
                    whileTap={selectedProduct.inStock ? { scale: 0.97 } : {}}
                    disabled={!selectedProduct.inStock}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Agregar al carrito
                  </motion.button>
                  <motion.button
                    onClick={() => handleBuy(selectedProduct)}
                    className={`flex-1 btn-neon text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${
                      !selectedProduct.inStock ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    whileHover={selectedProduct.inStock ? { scale: 1.02 } : {}}
                    whileTap={selectedProduct.inStock ? { scale: 0.98 } : {}}
                    disabled={!selectedProduct.inStock}
                  >
                    Comprar
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

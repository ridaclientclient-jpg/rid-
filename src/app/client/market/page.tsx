'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Package, Pill, UtensilsCrossed, ShoppingBag,
  X, ShoppingCart, Star, Truck, ShieldCheck, Loader2, RefreshCw,
  Store, ChevronRight, Minus, Plus
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { supabase } from '@/lib/supabase';
import CartSheet from '@/components/CartSheet';

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface Product {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  in_stock: boolean;
  vendor_name: string;
}

/* ─── Dynamic category helpers ───────────────────────────────────────────────── */

function getCategoryIcon(name: string): React.ReactNode {
  const lower = name.toLowerCase();
  if (lower.includes('farmacia') || lower.includes('pharmacy') || lower.includes('medic'))
    return <Pill className="w-6 h-6" />;
  if (lower.includes('comida') || lower.includes('food') || lower.includes('restaur') || lower.includes('alimento'))
    return <UtensilsCrossed className="w-6 h-6" />;
  if (lower.includes('tienda') || lower.includes('store') || lower.includes('abarrotes') || lower.includes('super'))
    return <ShoppingBag className="w-6 h-6" />;
  return <Package className="w-6 h-6" />;
}

function getCategoryColor(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('farmacia') || lower.includes('pharmacy') || lower.includes('medic'))
    return 'from-emerald-500/20 to-green-500/20 text-emerald-400';
  if (lower.includes('comida') || lower.includes('food') || lower.includes('restaur') || lower.includes('alimento'))
    return 'from-amber-500/20 to-orange-500/20 text-amber-400';
  if (lower.includes('tienda') || lower.includes('store') || lower.includes('abarrotes') || lower.includes('super'))
    return 'from-blue-500/20 to-cyan-500/20 text-blue-400';
  return 'from-cyan-500/20 to-teal-500/20 text-cyan-400';
}

function getCategoryHeaderColor(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('farmacia') || lower.includes('pharmacy') || lower.includes('medic'))
    return 'from-emerald-600/30 to-green-600/10';
  if (lower.includes('comida') || lower.includes('food') || lower.includes('restaur') || lower.includes('alimento'))
    return 'from-amber-600/30 to-orange-600/10';
  if (lower.includes('tienda') || lower.includes('store') || lower.includes('abarrotes') || lower.includes('super'))
    return 'from-blue-600/30 to-cyan-600/10';
  return 'from-cyan-600/30 to-teal-600/10';
}

function getCategoryBadgeColor(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('farmacia') || lower.includes('pharmacy') || lower.includes('medic'))
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (lower.includes('comida') || lower.includes('food') || lower.includes('restaur') || lower.includes('alimento'))
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (lower.includes('tienda') || lower.includes('store') || lower.includes('abarrotes') || lower.includes('super'))
    return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
}

/* ─── Delivery fee calculation (matches cartStore constants) ─────────────────── */

const DELIVERY_FEE_RATE = 0.10;
const MIN_DELIVERY_FEE = 500;

function calcDeliveryFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return Math.max(MIN_DELIVERY_FEE, Math.round(subtotal * DELIVERY_FEE_RATE));
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function ClientMarketPage() {
  const { user } = useAuthStore();
  const { addItem, itemCount, openCart } = useCartStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [buying, setBuying] = useState(false);
  const [selectedQty, setSelectedQty] = useState(1);

  /* ── Load products from Supabase ─────────────────────── */
  const loadProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, vendor_id, name, description, price, category, image_url, in_stock, vendors(store_name)')
        .eq('in_stock', true);

      if (error) {
        toast.error('Error al cargar productos: ' + error.message);
        return;
      }

      const mapped: Product[] = (data || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        vendor_id: p.vendor_id as string,
        name: p.name as string,
        description: (p.description as string) || null,
        price: Number(p.price),
        category: (p.category as string) || 'General',
        image_url: (p.image_url as string) || null,
        in_stock: p.in_stock as boolean,
        vendor_name: ((p.vendors as Record<string, unknown>)?.store_name as string) || 'Tienda',
      }));

      setProducts(mapped);
    } catch {
      toast.error('Error de conexión al cargar productos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  /* ── Dynamic categories ──────────────────────────────── */
  const categories = useMemo(() => {
    const catSet = new Set<string>();
    for (const p of products) catSet.add(p.category);
    return ['Todos', ...Array.from(catSet).sort()];
  }, [products]);

  /* ── Filtered products ───────────────────────────────── */
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === 'Todos' || p.category === filterCategory;
      return matchSearch && matchCat;
    });
  }, [products, search, filterCategory]);

  /* ── Cart helpers ────────────────────────────────────── */
  const getCartQty = (productId: string): number => {
    return useCartStore.getState().items.find((i) => i.id === productId)?.quantity ?? 0;
  };

  const handleAddToCart = (product: Product, qty = 1) => {
    for (let i = 0; i < qty; i++) {
      addItem({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        category: product.category,
      });
    }
    const totalQty = getCartQty(product.id);
    toast.success(`"${product.name}" agregado`, {
      description:
        totalQty > 1
          ? `${totalQty} en el carrito — ₡${(product.price * totalQty).toLocaleString()}`
          : `₡${product.price.toLocaleString()}`,
      icon: <ShoppingCart className="w-4 h-4 text-cyan-400" />,
    });
  };

  /* ── Buy now flow ────────────────────────────────────── */
  const handleBuy = async (product: Product, qty: number) => {
    if (!user?.id) {
      toast.error('Inicia sesión para hacer un pedido');
      return;
    }

    if (qty < 1) return;

    setBuying(true);

    const subtotal = product.price * qty;
    const deliveryFee = calcDeliveryFee(subtotal);
    const total = subtotal + deliveryFee;

    try {
      // Create delivery
      const { data: delivery, error } = await supabase
        .from('deliveries')
        .insert({
          customer_id: user.id,
          vendor_id: product.vendor_id,
          status: 'pending',
          delivery_address: 'Dirección del cliente',
          items: [
            {
              id: product.id,
              name: product.name,
              price: product.price,
              qty,
              category: product.category,
            },
          ],
          subtotal,
          delivery_fee: deliveryFee,
          total,
          payment_method: 'efectivo',
        })
        .select()
        .single();

      if (error) {
        console.warn('Delivery insert error:', error.message);
        toast.error('Error al crear pedido: ' + error.message);
        setBuying(false);
        return;
      }

      // Try to auto-assign an available courier
      if (delivery) {
        try {
          const { data: availableCourier } = await supabase
            .from('couriers')
            .select('id')
            .eq('status', 'online')
            .limit(1)
            .single();

          if (availableCourier) {
            const { error: assignError } = await supabase
              .from('deliveries')
              .update({ courier_id: availableCourier.id, status: 'assigned' })
              .eq('id', delivery.id);

            if (!assignError) {
              await supabase
                .from('couriers')
                .update({ status: 'busy' })
                .eq('id', availableCourier.id);
            }
          }
        } catch {
          // Courier assignment is optional — don't fail the order
        }
      }

      toast.success(`Pedido de "${product.name}" realizado!`, {
        description: `${qty}x — Total: ₡${total.toLocaleString()} (Envío: ₡${deliveryFee.toLocaleString()})`,
        duration: 4000,
      });

      setSelectedProduct(null);
      setSelectedQty(1);
    } catch {
      toast.success(`Pedido de "${product.name}" realizado!`, {
        description: `Total: ₡${total.toLocaleString()}`,
        duration: 4000,
      });
      setSelectedProduct(null);
      setSelectedQty(1);
    } finally {
      setBuying(false);
    }
  };

  const cartCount = itemCount();

  /* ─── Render ───────────────────────────────────────────────────────────────── */

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 space-y-5"
    >
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketplace</h1>
          <p className="text-sm text-gray-400 mt-1">Compra productos con entrega rápida</p>
        </div>
        <motion.button
          type="button"
          onClick={() => loadProducts(true)}
          disabled={loading || refreshing}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </motion.button>
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
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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

      {/* Category Filters (dynamic from products) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      >
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 ${
              filterCategory === cat
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            {cat !== 'Todos' && <span className="w-3 h-3">{getCategoryIcon(cat)}</span>}
            {cat}
          </button>
        ))}
      </motion.div>

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
          <p className="text-gray-400 text-sm">Cargando productos...</p>
        </motion.div>
      )}

      {/* Product Grid */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((product, i) => {
              const qty = getCartQty(product.id);
              const catBadge = getCategoryBadgeColor(product.category);
              const catHeader = getCategoryHeaderColor(product.category);

              return (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => {
                    setSelectedProduct(product);
                    setSelectedQty(1);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setSelectedProduct(product);
                      setSelectedQty(1);
                    }
                  }}
                  className="glass rounded-2xl overflow-hidden text-left hover:glow-cyan transition-all duration-300 group cursor-pointer"
                >
                  {/* Gradient Header / Image */}
                  <div className={`h-24 bg-gradient-to-br ${catHeader} flex items-center justify-center relative overflow-hidden`}>
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    ) : (
                      getCategoryIcon(product.category)
                    )}

                    {/* Stock indicator */}
                    <div
                      className={`absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium backdrop-blur-sm z-10 ${
                        product.in_stock
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      <div className={`w-1 h-1 rounded-full ${product.in_stock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      {product.in_stock ? 'En stock' : 'Agotado'}
                    </div>

                    {/* Cart quantity badge */}
                    {qty > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 left-2 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center z-10"
                      >
                        <span className="text-[10px] font-bold text-white">{qty}</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {product.description || 'Sin descripción'}
                    </p>

                    <div className="flex items-center justify-between mt-2.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${catBadge}`}
                      >
                        {product.category}
                      </span>
                      <p className="text-sm font-bold text-white">₡{product.price.toLocaleString()}</p>
                    </div>

                    {/* Add to cart button */}
                    <motion.button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!product.in_stock) {
                          toast.error('Producto agotado');
                          return;
                        }
                        handleAddToCart(product);
                      }}
                      className={`w-full mt-3 py-2 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                        product.in_stock
                          ? qty > 0
                            ? 'bg-cyan-500/25 text-cyan-300 hover:bg-cyan-500/35 border border-cyan-500/30'
                            : 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/20'
                          : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
                      }`}
                      whileTap={product.in_stock ? { scale: 0.95 } : {}}
                    >
                      <ShoppingCart className="w-3 h-3" />
                      {product.in_stock ? (qty > 0 ? `${qty} en carrito` : 'Agregar') : 'Agotado'}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
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

      {/* ── Floating Cart Button ──────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.button
            type="button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.9 }}
            onClick={openCart}
            className="fixed bottom-24 right-4 z-[60] w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg shadow-cyan-500/30 flex items-center justify-center"
          >
            <ShoppingCart className="w-6 h-6 text-white" />
            <motion.span
              key={cartCount}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#0a0e1a]"
            >
              {cartCount > 9 ? '9+' : cartCount}
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Product Detail Modal ──────────────────────────────── */}
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
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              {/* Product Image/Header */}
              <div
                className={`h-48 bg-gradient-to-br ${getCategoryColor(
                  selectedProduct.category
                )} flex items-center justify-center relative overflow-hidden`}
              >
                {selectedProduct.image_url ? (
                  <Image
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    fill
                    className="object-cover"
                    sizes="100vw"
                  />
                ) : (
                  <div className="text-center">
                    <div className="mb-2 flex justify-center">
                      {getCategoryIcon(selectedProduct.category)}
                    </div>
                  </div>
                )}

                {/* Overlay gradient for text readability */}
                {selectedProduct.image_url && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                )}

                {/* Category badge overlaid */}
                <div className="absolute bottom-3 left-4 z-10">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getCategoryBadgeColor(
                      selectedProduct.category
                    )}`}
                  >
                    {selectedProduct.category}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-6 space-y-5">
                {/* Vendor name */}
                <div className="flex items-center gap-2 text-gray-400">
                  <Store className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{selectedProduct.vendor_name}</span>
                </div>

                {/* Name & Price */}
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedProduct.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-2xl font-bold text-cyan-400">
                      ₡{selectedProduct.price.toLocaleString()}
                    </p>
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        selectedProduct.in_stock
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          selectedProduct.in_stock ? 'bg-emerald-400' : 'bg-red-400'
                        }`}
                      />
                      {selectedProduct.in_stock ? 'Disponible' : 'Agotado'}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedProduct.description && (
                  <div className="glass rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Descripción
                    </h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {selectedProduct.description}
                    </p>
                  </div>
                )}

                {/* Quantity Selector */}
                {selectedProduct.in_stock && (
                  <div className="glass rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      Cantidad
                    </h3>
                    <div className="flex items-center gap-4">
                      <motion.button
                        type="button"
                        onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
                        whileTap={{ scale: 0.9 }}
                      >
                        <Minus className="w-4 h-4" />
                      </motion.button>
                      <span className="text-xl font-bold text-white w-12 text-center">
                        {selectedQty}
                      </span>
                      <motion.button
                        type="button"
                        onClick={() => setSelectedQty((q) => Math.min(20, q + 1))}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
                        whileTap={{ scale: 0.9 }}
                      >
                        <Plus className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                )}

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

                {/* Price summary for selected qty */}
                {selectedProduct.in_stock && selectedQty > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Subtotal ({selectedQty})</span>
                    <span className="text-white font-semibold">
                      ₡{(selectedProduct.price * selectedQty).toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    type="button"
                    onClick={() => handleAddToCart(selectedProduct, selectedQty)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all border ${
                      selectedProduct.in_stock
                        ? 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                        : 'bg-white/5 text-gray-600 cursor-not-allowed border-white/5'
                    }`}
                    whileTap={selectedProduct.in_stock ? { scale: 0.97 } : {}}
                    disabled={!selectedProduct.in_stock}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Agregar al carrito
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => handleBuy(selectedProduct, selectedQty)}
                    className={`flex-1 btn-neon text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${
                      !selectedProduct.in_stock ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    whileHover={selectedProduct.in_stock ? { scale: 1.02 } : {}}
                    whileTap={selectedProduct.in_stock ? { scale: 0.98 } : {}}
                    disabled={!selectedProduct.in_stock || buying}
                  >
                    {buying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Comprar
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart Sheet (slide-up drawer) ─────────────────── */}
      <CartSheet />
    </motion.div>
  );
}

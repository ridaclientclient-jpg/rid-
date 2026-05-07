'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShoppingCart, Minus, Plus, Trash2,
  Truck, ShoppingBag, ChevronRight, MapPin, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useCartStore, type CartItem } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';

// ─── Category badge colors ──────────────────────────────────────────────────────

const categoryBadgeColors: Record<string, string> = {
  Farmacia: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Comida: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Tiendas: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

// ─── Cart Item Row ─────────────────────────────────────────────────────────────

function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCartStore();
  const lineTotal = item.price * item.quantity;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
    >
      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
        <ShoppingBag className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white truncate">{item.name}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${categoryBadgeColors[item.category] || 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
            {item.category}
          </span>
          <span className="text-[10px] text-gray-500">₡{item.price.toLocaleString()} c/u</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <span className="text-sm font-bold text-cyan-400">₡{lineTotal.toLocaleString()}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateQuantity(item.id, item.quantity - 1)}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-gray-400 hover:text-white"
          >
            {item.quantity === 1 ? <Trash2 className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3" />}
          </button>
          <span className="w-7 text-center text-xs font-semibold text-white">{item.quantity}</span>
          <button
            type="button"
            onClick={() => updateQuantity(item.id, item.quantity + 1)}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-gray-400 hover:text-white"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty Cart ────────────────────────────────────────────────────────────────

function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <ShoppingCart className="w-8 h-8 text-gray-600" />
      </div>
      <h3 className="text-sm font-semibold text-gray-400 mb-1">Tu carrito esta vacio</h3>
      <p className="text-xs text-gray-600 text-center">Agrega productos desde el Marketplace</p>
    </div>
  );
}

// ─── Main CartSheet ────────────────────────────────────────────────────────────

export default function CartSheet() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, isOpen, closeCart, clearCart, itemCount, subtotal, deliveryFee, total } = useCartStore();

  const sheetRef = useRef<HTMLDivElement>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Load persisted delivery address from localStorage (shared with market page)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('rida-delivery-address');
      if (stored) setDeliveryAddress(stored);
    } catch { /* ignore */ }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) closeCart(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, closeCart]);

  const count = itemCount();
  const sub   = subtotal();
  const fee   = deliveryFee();
  const tot   = total();

  const handleAddressChange = (val: string) => {
    setDeliveryAddress(val);
    try { localStorage.setItem('rida-delivery-address', val); } catch { /* ignore */ }
  };

  const handleCheckout = async () => {
    if (!user?.id) {
      toast.error('Inicia sesion para hacer un pedido');
      router.push('/client/login');
      closeCart();
      return;
    }
    if (items.length === 0) return;
    if (!deliveryAddress.trim()) {
      toast.error('Agrega una direccion de entrega');
      return;
    }

    setCheckingOut(true);
    try {
      const deliveryItems = items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        qty: i.quantity,
        category: i.category,
      }));

      // Insert the delivery and get back the row
      const { data: newDelivery, error } = await supabase
        .from('deliveries')
        .insert({
          customer_id: user.id,
          vendor_id: items[0]?.vendor_id, // Link to the vendor of the first item
          status: 'pending',
          delivery_address: deliveryAddress.trim(),
          items: deliveryItems,
          subtotal: sub,
          delivery_fee: fee,
          total: tot,
          payment_method: 'efectivo',
        })
        .select()
        .single();

      if (error) {
        toast.error('Error al crear pedido: ' + error.message);
        return;
      }

      // Auto-assign an available courier
      if (newDelivery) {
        try {
          const { data: courier } = await supabase
            .from('couriers')
            .select('id')
            .eq('status', 'online')
            .limit(1)
            .single();

          if (courier) {
            await supabase
              .from('deliveries')
              .update({ courier_id: courier.id, status: 'assigned' })
              .eq('id', newDelivery.id);

            await supabase
              .from('couriers')
              .update({ status: 'busy' })
              .eq('id', courier.id);
          }
        } catch {
          // Courier assignment is optional — continue without it
        }
      }

      toast.success('¡Pedido realizado con exito!', {
        description: `${count} producto(s) — Total: ₡${tot.toLocaleString()}`,
        duration: 4000,
      });
      clearCart();
      closeCart();
    } catch (err: any) {
      toast.error('Error al procesar el pedido: ' + (err?.message || 'intenta de nuevo'));
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            className="fixed inset-x-0 bottom-0 z-[80] max-w-md mx-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          >
            <div className="bg-[#0d1117] border-t border-white/10 rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl">

              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Mi Carrito</h2>
                    <p className="text-[11px] text-gray-500">
                      {count === 0 ? 'Sin productos' : `${count} producto${count > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { clearCart(); toast.info('Carrito vaciado'); }}
                      className="px-3 py-1.5 rounded-lg text-[11px] text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors border border-red-500/20"
                    >
                      Vaciar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeCart}
                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {items.length === 0 ? (
                  <EmptyCart />
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {items.map((item) => <CartItemRow key={item.id} item={item} />)}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Order Summary */}
              {items.length > 0 && (
                <div className="border-t border-white/5 px-5 py-4 space-y-3 bg-[#0d1117] flex-shrink-0">

                  {/* Delivery Address Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-orange-400" />
                      Direccion de entrega
                    </label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      placeholder="Ej: San Jose, Barrio Escalante, casa azul..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                    />
                  </div>

                  {/* Totals */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Subtotal ({count} producto{count > 1 ? 's' : ''})</span>
                      <span className="text-sm text-gray-300">₡{sub.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-xs text-gray-400">Envio</span>
                      </div>
                      <span className="text-sm text-gray-300">₡{fee.toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Total a pagar</span>
                      <span className="text-lg font-bold text-cyan-400">₡{tot.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <motion.button
                    type="button"
                    onClick={handleCheckout}
                    disabled={checkingOut}
                    className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60"
                    whileTap={{ scale: checkingOut ? 1 : 0.98 }}
                  >
                    {checkingOut ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Realizar pedido <ChevronRight className="w-4 h-4" /></>
                    )}
                  </motion.button>

                  <p className="text-center text-[10px] text-gray-600">
                    Se asignara un conductor para la entrega
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

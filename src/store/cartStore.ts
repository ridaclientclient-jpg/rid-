import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;

  // Actions
  addItem: (product: Omit<CartItem, 'quantity'>) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  // Computed (as getters)
  itemCount: () => number;
  subtotal: () => number;
  deliveryFee: () => number;
  total: () => number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DELIVERY_FEE_RATE = 0.10; // 10% del subtotal
const MIN_DELIVERY_FEE = 500;   // Minimo ₡500
const MAX_DELIVERY_FEE = 3000;  // Maximo ₡3,000
const MAX_ITEM_QTY = 20;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product) => {
        const { items } = get();
        const existing = items.find((i) => i.id === product.id);

        if (existing) {
          // Increment quantity if under max
          if (existing.quantity >= MAX_ITEM_QTY) {
            return; // Don't exceed max
          }
          set({
            items: items.map((i) =>
              i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          });
        } else {
          set({ items: [...items, { ...product, quantity: 1 }] });
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.id !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity < 1) {
          // Remove item if quantity is 0 or negative
          set({ items: get().items.filter((i) => i.id !== productId) });
          return;
        }
        if (quantity > MAX_ITEM_QTY) return;
        set({
          items: get().items.map((i) =>
            i.id === productId ? { ...i, quantity } : i
          ),
        });
      },

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set({ isOpen: !get().isOpen }),

      itemCount: () => {
        return get().items.reduce((sum, i) => sum + i.quantity, 0);
      },

      subtotal: () => {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      },

      deliveryFee: () => {
        const sub = get().subtotal();
        if (sub === 0) return 0;
        const fee = Math.round(sub * DELIVERY_FEE_RATE);
        return Math.max(MIN_DELIVERY_FEE, Math.min(fee, MAX_DELIVERY_FEE));
      },

      total: () => {
        return get().subtotal() + get().deliveryFee();
      },
    }),
    {
      name: 'rida-cart', // localStorage key
      partialize: (state) => ({ items: state.items }), // Only persist items
    }
  )
);

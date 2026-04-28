'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Package,
  Pill,
  UtensilsCrossed,
  ShoppingBag,
  X,
  ShoppingCart,
  Star,
  Truck,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Store,
  ChevronRight,
  Minus,
  Plus,
  MapPin,
  Clock,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  BadgePercent,
  Flame,
  ImageOff,
  ArrowLeft,
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import {
  supabase,
  type Product,
  type Vendor,
  type MarketplaceCategory,
} from '@/lib/supabase';
import CartSheet from '@/components/CartSheet';

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

function formatCRC(amount: number): string {
  return `₡${Math.round(amount).toLocaleString('es-CR')}`;
}

function getCategoryIcon(name: string, className = 'w-5 h-5') {
  const lower = name.toLowerCase();
  if (
    lower.includes('farmacia') ||
    lower.includes('pharmacy') ||
    lower.includes('medic') ||
    lower.includes('salud')
  )
    return <Pill className={className} />;
  if (
    lower.includes('comida') ||
    lower.includes('food') ||
    lower.includes('restaur') ||
    lower.includes('alimento') ||
    lower.includes('gastr') ||
    lower.includes('bebida')
  )
    return <UtensilsCrossed className={className} />;
  if (
    lower.includes('tienda') ||
    lower.includes('store') ||
    lower.includes('abarrotes') ||
    lower.includes('super') ||
    lower.includes('mercado')
  )
    return <ShoppingBag className={className} />;
  if (
    lower.includes('panader') ||
    lower.includes('pan') ||
    lower.includes('pastel') ||
    lower.includes('reposter')
  )
    return <Flame className={className} />;
  return <Package className={className} />;
}

function getCategoryGradient(name: string) {
  const lower = name.toLowerCase();
  if (
    lower.includes('farmacia') ||
    lower.includes('pharmacy') ||
    lower.includes('medic')
  )
    return 'from-emerald-600/30 to-green-600/10';
  if (
    lower.includes('comida') ||
    lower.includes('food') ||
    lower.includes('restaur') ||
    lower.includes('alimento')
  )
    return 'from-amber-600/40 to-orange-600/10';
  if (
    lower.includes('tienda') ||
    lower.includes('store') ||
    lower.includes('abarrotes')
  )
    return 'from-blue-600/30 to-cyan-600/10';
  return 'from-orange-600/30 to-amber-600/10';
}

function getCategoryBadgeColor(name: string) {
  const lower = name.toLowerCase();
  if (
    lower.includes('farmacia') ||
    lower.includes('pharmacy') ||
    lower.includes('medic')
  )
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (
    lower.includes('comida') ||
    lower.includes('food') ||
    lower.includes('restaur') ||
    lower.includes('alimento')
  )
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (
    lower.includes('tienda') ||
    lower.includes('store') ||
    lower.includes('abarrotes')
  )
    return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
}

function getCategoryAccentBg(name: string) {
  const lower = name.toLowerCase();
  if (
    lower.includes('farmacia') ||
    lower.includes('pharmacy') ||
    lower.includes('medic')
  )
    return 'bg-emerald-500/15 text-emerald-400';
  if (
    lower.includes('comida') ||
    lower.includes('food') ||
    lower.includes('restaur') ||
    lower.includes('alimento')
  )
    return 'bg-amber-500/15 text-amber-400';
  if (
    lower.includes('tienda') ||
    lower.includes('store') ||
    lower.includes('abarrotes')
  )
    return 'bg-blue-500/15 text-blue-400';
  return 'bg-orange-500/15 text-orange-400';
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DELIVERY FEE CALCULATION
   ═══════════════════════════════════════════════════════════════════════════════ */

const DELIVERY_FEE_PCT = 0.1;
const MIN_DELIVERY_FEE = 500;
const MAX_DELIVERY_FEE = 3000;

function calcDeliveryFee(subtotal: number): number {
  if (subtotal <= 0) return 0;
  const fee = Math.round(subtotal * DELIVERY_FEE_PCT);
  return Math.max(MIN_DELIVERY_FEE, Math.min(fee, MAX_DELIVERY_FEE));
}

/* ═══════════════════════════════════════════════════════════════════════════════
   STAR RATING COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

function StarRating({
  rating,
  size = 'sm',
}: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'lg' ? 'w-4 h-4' : size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  const textSize =
    size === 'lg' ? 'text-xs' : size === 'md' ? 'text-[11px]' : 'text-[10px]';

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${sizeClass} ${
            s <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-white/10 text-white/10'
          }`}
        />
      ))}
      <span className={`${textSize} text-gray-400 ml-0.5`}>
        {rating > 0 ? rating.toFixed(1) : ''}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SKELETON LOADERS
   ═══════════════════════════════════════════════════════════════════════════════ */

function CategorySkeleton() {
  return (
    <div className="flex gap-2.5 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 h-16 w-20 rounded-2xl bg-white/[0.04] animate-pulse"
        />
      ))}
    </div>
  );
}

function VendorCardSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      <div className="h-32 bg-white/[0.04]" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
            <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-white/[0.04]" />
        <div className="flex gap-4">
          <div className="h-3 w-16 rounded bg-white/[0.04]" />
          <div className="h-3 w-16 rounded bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-white/[0.04]" />
      <div className="p-3 space-y-2.5">
        <div className="h-3 w-2/3 rounded bg-white/[0.06]" />
        <div className="h-2.5 w-full rounded bg-white/[0.04]" />
        <div className="h-2.5 w-4/5 rounded bg-white/[0.04]" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-5 w-16 rounded bg-white/[0.06]" />
          <div className="h-8 w-8 rounded bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   EMPTY STATES
   ═══════════════════════════════════════════════════════════════════════════════ */

function EmptyProducts({ onClear }: { onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-6"
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500/15 to-amber-500/10 flex items-center justify-center mb-5">
        <Package className="w-9 h-9 text-orange-400/60" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1.5">
        No se encontraron productos
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-xs mb-5">
        Intenta con otra búsqueda o selecciona una categoría diferente
      </p>
      <button
        type="button"
        onClick={onClear}
        className="px-5 py-2.5 rounded-xl text-sm font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-colors"
      >
        Limpiar filtros
      </button>
    </motion.div>
  );
}

function EmptyVendors() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 px-6"
    >
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-500/15 to-gray-500/5 flex items-center justify-center mb-5">
        <Store className="w-9 h-9 text-gray-600" />
      </div>
      <h3 className="text-base font-semibold text-white mb-1.5">
        No hay tiendas disponibles
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-xs">
        Las tiendas se están preparando. Vuelve más tarde para descubrir
        productos increíbles.
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SIGNED IMAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

function SignedProductImage({
  imagePath,
  alt,
  className = '',
  fill = false,
  sizes,
}: {
  imagePath: string | null | undefined;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
}) {
  const [src, setSrc] = useState<string | null>(() => {
    // Initialize to null — useEffect will fetch or show placeholder
    return null;
  });

  useEffect(() => {
    if (!imagePath) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.storage
          .from('products')
          .createSignedUrl(imagePath, 3600);
        if (!cancelled && data?.signedUrl) {
          setSrc(data.signedUrl);
        }
      } catch {
        // Silently fail — placeholder will show
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  if (!src) {
    return (
      <div
        className={`bg-gradient-to-br from-orange-500/10 to-amber-600/5 flex items-center justify-center ${className}`}
      >
        <ImageOff className="w-8 h-8 text-white/10" />
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover ${className}`}
        sizes={sizes}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      sizes={sizes}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   VENDOR CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

function VendorCard({
  vendor,
  productCount,
  onClick,
}: {
  vendor: Vendor;
  productCount: number;
  onClick: () => void;
}) {
  const catLabel =
    vendor.category === 'food'
      ? 'Comida'
      : vendor.category === 'pharmacy'
        ? 'Farmacia'
        : vendor.category === 'stores'
          ? 'Tienda'
          : 'Otro';

  const deliveryTime =
    vendor.category === 'food' ? '25-40 min' : '30-50 min';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass rounded-2xl overflow-hidden cursor-pointer group hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300"
    >
      {/* Gradient header / logo area */}
      <div
        className={`h-28 bg-gradient-to-br ${getCategoryGradient(
          catLabel
        )} flex items-center justify-center relative overflow-hidden`}
      >
        {vendor.logo_url ? (
          <SignedProductImage
            imagePath={vendor.logo_url}
            alt={vendor.store_name}
            fill
            sizes="300px"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            {getCategoryIcon(catLabel, 'w-7 h-7 text-white/60')}
          </div>
        )}

        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border ${getCategoryBadgeColor(
              catLabel
            )}`}
          >
            {catLabel}
          </span>
        </div>

        {/* Product count */}
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-black/30 text-white/80 backdrop-blur-sm">
            <ShoppingBag className="w-2.5 h-2.5" />
            {productCount} prod.
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white truncate group-hover:text-orange-400 transition-colors">
              {vendor.store_name}
            </h3>
            {vendor.address && (
              <p className="text-[11px] text-gray-500 truncate mt-0.5 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                {vendor.address}
              </p>
            )}
          </div>
        </div>

        {vendor.description && (
          <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
            {vendor.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <StarRating rating={vendor.rating} size="sm" />
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {deliveryTime}
            </span>
            {vendor.delivery_fee != null && (
              <span className="flex items-center gap-1 text-emerald-400/80">
                <Truck className="w-3 h-3" />
                {vendor.delivery_fee === 0
                  ? 'Gratis'
                  : formatCRC(vendor.delivery_fee)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PRODUCT CARD
   ═══════════════════════════════════════════════════════════════════════════════ */

function ProductCard({
  product,
  index,
  onSelect,
  onAddToCart,
  cartQty,
}: {
  product: Product & { vendor_name: string };
  index: number;
  onSelect: () => void;
  onAddToCart: () => void;
  cartQty: number;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ delay: index * 0.03 }}
      className="glass rounded-2xl overflow-hidden group hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300"
    >
      {/* Image */}
      <div
        onClick={onSelect}
        className="aspect-square relative overflow-hidden cursor-pointer"
      >
        <SignedProductImage
          imagePath={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Featured badge */}
        {product.is_featured && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/90 text-black backdrop-blur-sm shadow-lg shadow-amber-500/20">
              <Sparkles className="w-2.5 h-2.5" />
              Destacado
            </span>
          </div>
        )}

        {/* Stock indicator */}
        <div
          className={`absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium backdrop-blur-sm ${
            product.in_stock
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              product.in_stock ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          />
          {product.in_stock ? 'Disponible' : 'Agotado'}
        </div>

        {/* Cart quantity badge */}
        <AnimatePresence>
          {cartQty > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute bottom-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30"
            >
              <span className="text-[10px] font-bold text-white">
                {cartQty > 9 ? '9+' : cartQty}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Vendor name */}
        <p
          className="text-[10px] text-gray-500 truncate mb-1 flex items-center gap-1 cursor-pointer"
          onClick={onSelect}
        >
          <Store className="w-2.5 h-2.5 flex-shrink-0" />
          {product.vendor_name}
        </p>

        {/* Product name */}
        <h3
          className="text-xs font-semibold text-white truncate group-hover:text-orange-400 transition-colors cursor-pointer"
          onClick={onSelect}
        >
          {product.name}
        </h3>

        {/* Description */}
        <p
          className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed cursor-pointer"
          onClick={onSelect}
        >
          {product.description || 'Sin descripción'}
        </p>

        {/* Rating */}
        {product.avg_rating != null && product.avg_rating > 0 && (
          <div className="mt-2">
            <StarRating rating={product.avg_rating} size="sm" />
          </div>
        )}

        {/* Price + Add to Cart */}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-sm font-bold text-white">
            {formatCRC(product.price)}
          </span>

          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!product.in_stock) {
                toast.error('Producto agotado');
                return;
              }
              onAddToCart();
            }}
            disabled={!product.in_stock}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              product.in_stock
                ? cartQty > 0
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'bg-orange-500/15 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25'
                : 'bg-white/[0.03] text-gray-600 cursor-not-allowed'
            }`}
            whileTap={product.in_stock ? { scale: 0.9 } : {}}
          >
            {cartQty > 0 ? (
              <Plus className="w-4 h-4" />
            ) : (
              <ShoppingCart className="w-3.5 h-3.5" />
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   PRODUCT DETAIL MODAL
   ═══════════════════════════════════════════════════════════════════════════════ */

function ProductDetailModal({
  product,
  quantity,
  setQuantity,
  onAddToCart,
  onBuyNow,
  buying,
  onClose,
}: {
  product: Product & { vendor_name: string };
  quantity: number;
  setQuantity: (q: number) => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  buying: boolean;
  onClose: () => void;
}) {
  const lineTotal = product.price * quantity;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-md glass-strong rounded-t-3xl sm:rounded-2xl z-10 max-h-[88vh] overflow-y-auto"
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <SignedProductImage
            imagePath={product.image_url}
            alt={product.name}
            fill
            sizes="100vw"
          />

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          {/* Featured badge */}
          {product.is_featured && (
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/90 text-black shadow-lg">
                <Sparkles className="w-3 h-3" />
                Destacado
              </span>
            </div>
          )}

          {/* Price badge at bottom of image */}
          <div className="absolute bottom-4 left-4 z-10">
            <span className="text-2xl font-extrabold text-white drop-shadow-lg">
              {formatCRC(product.price)}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-5">
          {/* Vendor */}
          <div className="flex items-center gap-2 text-gray-400">
            <Store className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{product.vendor_name}</span>
          </div>

          {/* Name */}
          <div>
            <h2 className="text-xl font-bold text-white">{product.name}</h2>
            {product.avg_rating != null && product.avg_rating > 0 && (
              <div className="mt-2">
                <StarRating rating={product.avg_rating} size="md" />
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="glass rounded-xl p-4">
              <p className="text-sm text-gray-300 leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Stock status */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                product.in_stock ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            <span
              className={`text-xs font-medium ${
                product.in_stock ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {product.in_stock ? 'En stock' : 'Agotado'}
            </span>
            {product.stock_quantity != null && product.stock_quantity > 0 && (
              <span className="text-[10px] text-gray-500">
                ({product.stock_quantity} disponibles)
              </span>
            )}
          </div>

          {/* Quantity selector */}
          {product.in_stock && (
            <div className="glass rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Cantidad
              </p>
              <div className="flex items-center gap-5">
                <motion.button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
                  whileTap={{ scale: 0.9 }}
                >
                  <Minus className="w-4 h-4" />
                </motion.button>
                <span className="text-xl font-bold text-white w-10 text-center">
                  {quantity}
                </span>
                <motion.button
                  type="button"
                  onClick={() => setQuantity(Math.min(20, quantity + 1))}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors"
                  whileTap={{ scale: 0.9 }}
                >
                  <Plus className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          )}

          {/* Delivery info */}
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                <Truck className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">
                  Entrega con conductor RIDA
                </p>
                <p className="text-[10px] text-gray-500">
                  Envío estimado: {formatCRC(calcDeliveryFee(lineTotal))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">Pago seguro</p>
                <p className="text-[10px] text-gray-500">
                  Tu pago está protegido hasta la entrega
                </p>
              </div>
            </div>
          </div>

          {/* Subtotal */}
          {product.in_stock && quantity > 0 && (
            <div className="flex items-center justify-between glass rounded-xl p-4">
              <span className="text-sm text-gray-400">
                Subtotal ({quantity}x)
              </span>
              <span className="text-lg font-bold text-orange-400">
                {formatCRC(lineTotal)}
              </span>
            </div>
          )}

          {/* Action buttons */}
          {product.in_stock && (
            <div className="flex gap-3 pt-1 pb-2">
              <motion.button
                type="button"
                onClick={onAddToCart}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
                whileTap={{ scale: 0.97 }}
              >
                <ShoppingCart className="w-4 h-4" />
                Agregar al carrito
              </motion.button>
              <motion.button
                type="button"
                onClick={onBuyNow}
                disabled={buying}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
                whileTap={buying ? {} : { scale: 0.97 }}
              >
                {buying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Comprar Ahora
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SORT / FILTER DROPDOWN
   ═══════════════════════════════════════════════════════════════════════════════ */

type SortOption = 'relevancia' | 'precio_menor' | 'precio_mayor' | 'mejor_valorados';

function SortFilterBar({
  sort,
  setSort,
  inStockOnly,
  setInStockOnly,
  featuredOnly,
  setFeaturedOnly,
}: {
  sort: SortOption;
  setSort: (s: SortOption) => void;
  inStockOnly: boolean;
  setInStockOnly: (v: boolean) => void;
  featuredOnly: boolean;
  setFeaturedOnly: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  const sortLabels: Record<SortOption, string> = {
    relevancia: 'Relevancia',
    precio_menor: 'Precio menor',
    precio_mayor: 'Precio mayor',
    mejor_valorados: 'Mejor valorados',
  };

  const hasFilters = inStockOnly || featuredOnly;

  return (
    <div className="flex items-center gap-2">
      {/* Sort dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
        >
          <SlidersHorizontal className="w-3 h-3" />
          {sortLabels[sort]}
          <ChevronDown
            className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {open && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-0 top-full mt-2 z-40 w-48 glass-strong rounded-xl py-1.5 shadow-xl"
              >
                {(Object.keys(sortLabels) as SortOption[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSort(key);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${
                      sort === key
                        ? 'text-orange-400 bg-orange-500/10'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {sortLabels[key]}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Quick filter pills */}
      <button
        type="button"
        onClick={() => setInStockOnly(!inStockOnly)}
        className={`px-3 py-2 rounded-xl text-[11px] font-medium border transition-all whitespace-nowrap ${
          inStockOnly
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
        }`}
      >
        En stock
      </button>
      <button
        type="button"
        onClick={() => setFeaturedOnly(!featuredOnly)}
        className={`px-3 py-2 rounded-xl text-[11px] font-medium border transition-all whitespace-nowrap flex items-center gap-1 ${
          featuredOnly
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
        }`}
      >
        <Sparkles className="w-3 h-3" />
        Destacados
      </button>

      {/* Clear filters */}
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setInStockOnly(false);
            setFeaturedOnly(false);
          }}
          className="text-[10px] text-orange-400 hover:text-orange-300 transition-colors"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function ClientMarketPage() {
  const { user } = useAuthStore();
  const { addItem, itemCount, openCart } = useCartStore();

  /* ── State ──────────────────────────────────────────── */
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [vendors, setVendors] = useState<
    (Vendor & { product_count: number })[]
  >([]);
  const [products, setProducts] = useState<
    (Product & { vendor_name: string })[]
  >([]);
  const [banners, setBanners] = useState<{
    id: string;
    title: string;
    description: string;
    image_url: string;
    link_url: string;
    position: number;
    is_active: boolean;
    start_date: string;
    end_date: string;
  }[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<
    (Product & { vendor_name: string }) | null
  >(null);
  const [selectedQty, setSelectedQty] = useState(1);
  const [buying, setBuying] = useState(false);

  // Sort & Filter
  const [sort, setSort] = useState<SortOption>('relevancia');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);

  // Delivery address
  const [deliveryAddress, setDeliveryAddress] = useState('');

  /* ── Load delivery address from localStorage ────────── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem('rida-delivery-address');
      if (stored) setDeliveryAddress(stored);
    } catch {
      // ignore
    }
  }, []);

  /* ── Persist delivery address ───────────────────────── */
  const handleAddressChange = useCallback((val: string) => {
    setDeliveryAddress(val);
    try {
      localStorage.setItem('rida-delivery-address', val);
    } catch {
      // ignore
    }
  }, []);

  /* ── Data fetching ──────────────────────────────────── */
  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        // Fetch categories
        const { data: catData, error: catErr } = await supabase
          .from('marketplace_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (!catErr && catData) {
          setCategories(catData as MarketplaceCategory[]);
        }

        // Fetch approved vendors
        const { data: vendorData, error: vendorErr } = await supabase
          .from('vendors')
          .select('*')
          .eq('is_approved', true);

        if (!vendorErr && vendorData) {
          // Count products per vendor
          const vendorIds = vendorData.map((v) => v.id);
          let productCounts: Record<string, number> = {};

          if (vendorIds.length > 0) {
            const { data: allProducts } = await supabase
              .from('products')
              .select('vendor_id, in_stock')
              .in('vendor_id', vendorIds);

            if (allProducts) {
              productCounts = allProducts.reduce(
                (acc, p) => {
                  acc[p.vendor_id] = (acc[p.vendor_id] || 0) + 1;
                  return acc;
                },
                {} as Record<string, number>
              );
            }
          }

          setVendors(
            (vendorData as Vendor[]).map((v) => ({
              ...v,
              product_count: productCounts[v.id] || 0,
            }))
          );
        }

        // Fetch products with vendor info
        const { data: prodData, error: prodErr } = await supabase
          .from('products')
          .select(
            'id, vendor_id, name, description, price, category, image_url, in_stock, stock_quantity, is_featured, avg_rating, vendors(store_name)'
          );

        // Fetch active banners for the client app
        try {
          const { data: bannerData } = await supabase
            .from('banners')
            .select('id, title, description, image_url, link_url, position, is_active, start_date, end_date')
            .eq('is_active', true)
            .or('target.eq.app,target.eq.all')
            .order('position', { ascending: true });
          if (bannerData && bannerData.length > 0) {
            const now = new Date();
            const active = bannerData.filter((b: Record<string, unknown>) => {
              if (b.start_date && new Date(b.start_date as string) > now) return false;
              if (b.end_date && new Date(b.end_date as string) < now) return false;
              return true;
            });
            setBanners(active);
          }
        } catch {
          // Banners are non-critical — fail silently
        }

        if (!prodErr && prodData) {
          const mapped: (Product & { vendor_name: string })[] = prodData.map(
            (p: Record<string, unknown>) => ({
              id: p.id as string,
              vendor_id: p.vendor_id as string,
              name: p.name as string,
              description: (p.description as string) || null,
              price: Number(p.price),
              category: (p.category as string) || 'General',
              image_url: (p.image_url as string) || null,
              in_stock: p.in_stock as boolean,
              stock_quantity: p.stock_quantity as number | undefined,
              is_featured: p.is_featured as boolean | undefined,
              avg_rating: p.avg_rating as number | undefined,
              created_at: p.created_at as string | undefined,
              vendor_name:
                ((p.vendors as Record<string, unknown>)?.store_name as string) ||
                'Tienda',
            })
          );
          setProducts(mapped);
        }
      } catch {
        toast.error('Error de conexión al cargar datos');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── Derived state ──────────────────────────────────── */
  const isBrowsingVendors = !selectedCategoryId && !selectedVendorId;

  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by category
    if (selectedCategoryId) {
      // Map category name match (products.category is a string, category from table)
      const cat = categories.find((c) => c.id === selectedCategoryId);
      if (cat) {
        result = result.filter((p) =>
          p.category.toLowerCase().includes(cat.name.toLowerCase())
        );
      }
    }

    // Filter by vendor
    if (selectedVendorId) {
      result = result.filter((p) => p.vendor_id === selectedVendorId);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          p.vendor_name.toLowerCase().includes(q)
      );
    }

    // In stock filter
    if (inStockOnly) {
      result = result.filter((p) => p.in_stock);
    }

    // Featured filter
    if (featuredOnly) {
      result = result.filter((p) => p.is_featured);
    }

    // Sort
    switch (sort) {
      case 'precio_menor':
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case 'precio_mayor':
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case 'mejor_valorados':
        result = [...result].sort(
          (a, b) => (b.avg_rating || 0) - (a.avg_rating || 0)
        );
        break;
      default:
        // relevancia: featured first, then by rating
        result = [...result].sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          return (b.avg_rating || 0) - (a.avg_rating || 0);
        });
    }

    return result;
  }, [
    products,
    selectedCategoryId,
    selectedVendorId,
    search,
    inStockOnly,
    featuredOnly,
    sort,
    categories,
  ]);

  /* ── Cart helpers ────────────────────────────────────── */
  const getCartQty = useCallback((productId: string): number => {
    return (
      useCartStore.getState().items.find((i) => i.id === productId)?.quantity ??
      0
    );
  }, []);

  const handleAddToCart = useCallback(
    (product: Product & { vendor_name: string }, qty = 1) => {
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
            ? `${totalQty} en el carrito — ${formatCRC(product.price * totalQty)}`
            : formatCRC(product.price),
        icon: <ShoppingCart className="w-4 h-4 text-orange-400" />,
      });
    },
    [addItem, getCartQty]
  );

  /* ── Buy now flow ────────────────────────────────────── */
  const handleBuyNow = useCallback(
    async (product: Product & { vendor_name: string }, qty: number) => {
      if (!user?.id) {
        toast.error('Inicia sesión para hacer un pedido');
        return;
      }
      if (qty < 1) return;
      if (!deliveryAddress.trim()) {
        toast.error('Agrega una dirección de entrega');
        return;
      }

      setBuying(true);

      const subtotal = product.price * qty;
      const deliveryFee = calcDeliveryFee(subtotal);
      const total = subtotal + deliveryFee;

      try {
        const { data: delivery, error } = await supabase
          .from('deliveries')
          .insert({
            customer_id: user.id,
            vendor_id: product.vendor_id,
            status: 'pending',
            delivery_address: deliveryAddress.trim(),
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
          toast.error('Error al crear pedido: ' + error.message);
          setBuying(false);
          return;
        }

        // Auto-assign courier
        if (delivery) {
          try {
            const { data: availableCourier } = await supabase
              .from('couriers')
              .select('id')
              .eq('status', 'online')
              .limit(1)
              .single();

            if (availableCourier) {
              const { error: assignErr } = await supabase
                .from('deliveries')
                .update({
                  courier_id: availableCourier.id,
                  status: 'assigned',
                })
                .eq('id', delivery.id);

              if (!assignErr) {
                await supabase
                  .from('couriers')
                  .update({ status: 'busy' })
                  .eq('id', availableCourier.id);
              }
            }
          } catch {
            // Courier assignment is optional
          }
        }

        toast.success(`Pedido de "${product.name}" realizado!`, {
          description: `${qty}x — Total: ${formatCRC(total)} (Envío: ${formatCRC(deliveryFee)})`,
          duration: 4000,
        });

        setSelectedProduct(null);
        setSelectedQty(1);
      } catch {
        toast.success(`Pedido de "${product.name}" realizado!`, {
          description: `Total: ${formatCRC(total)}`,
          duration: 4000,
        });
        setSelectedProduct(null);
        setSelectedQty(1);
      } finally {
        setBuying(false);
      }
    },
    [user, deliveryAddress]
  );

  /* ── Clear all selections ────────────────────────────── */
  const clearSelection = useCallback(() => {
    setSelectedCategoryId(null);
    setSelectedVendorId(null);
    setSearch('');
    setInStockOnly(false);
    setFeaturedOnly(false);
    setSort('relevancia');
  }, []);

  /* ── Selected vendor info ────────────────────────────── */
  const selectedVendor = useMemo(() => {
    if (!selectedVendorId) return null;
    return vendors.find((v) => v.id === selectedVendorId) || null;
  }, [selectedVendorId, vendors]);

  /* ── Selected category info ──────────────────────────── */
  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return (
      categories.find((c) => c.id === selectedCategoryId) || null
    );
  }, [selectedCategoryId, categories]);

  /* ── Featured products ────────────────────────────────── */
  const featuredProducts = useMemo(() => {
    return products
      .filter((p) => p.is_featured && p.in_stock)
      .sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
      .slice(0, 10);
  }, [products]);

  /* ── Top rated vendors ─────────────────────────────── */
  const topVendors = useMemo(() => {
    return [...vendors]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .filter((v) => v.rating > 0);
  }, [vendors]);

  /* ── Vendors with most products ────────────────────── */
  const activeVendors = useMemo(() => {
    return vendors.filter((v) => v.product_count > 0);
  }, [vendors]);

  const cartCount = itemCount();

  /* ═════════════════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════════════════ */

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 space-y-4 pb-6"
    >
      {/* ── Delivery Address Bar (Uber Eats style) ──────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-2xl p-3 flex items-center gap-3"
      >
        <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
            Entregar a
          </p>
          {deliveryAddress ? (
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none truncate"
              placeholder="Agregar dirección de entrega"
            />
          ) : (
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
              placeholder="Agregar dirección de entrega"
              className="w-full bg-transparent text-sm text-gray-400 placeholder:text-gray-600 focus:outline-none focus:text-white transition-colors"
            />
          )}
        </div>
      </motion.div>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Market
            </span>
            <span className="text-white/60">place</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Pedido con entrega a tu puerta
          </p>
        </div>
        <motion.button
          type="button"
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
          />
        </motion.button>
      </motion.div>

      {/* ── Search Bar ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="glass rounded-2xl p-1"
      >
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar productos o tiendas..."
            className="w-full bg-white/5 border border-white/[0.06] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/40 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Category Pills ──────────────────────────────────────────── */}
      {loading ? (
        <CategorySkeleton />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="flex gap-2.5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* "All" pill */}
          <motion.button
            type="button"
            onClick={() => {
              setSelectedCategoryId(null);
              setSelectedVendorId(null);
            }}
            whileTap={{ scale: 0.95 }}
            className={`flex-shrink-0 flex flex-col items-center gap-1.5 py-2.5 px-3 rounded-2xl transition-all duration-200 min-w-[72px] ${
              isBrowsingVendors
                ? 'bg-gradient-to-b from-orange-500/20 to-amber-500/10 text-orange-400 border border-orange-500/30 shadow-lg shadow-orange-500/10'
                : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:bg-white/[0.08]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isBrowsingVendors ? 'bg-orange-500/20' : 'bg-white/5'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-medium">Todos</span>
          </motion.button>

          {categories.map((cat) => {
            const isActive = selectedCategoryId === cat.id;
            return (
              <motion.button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedVendorId(null);
                  setSelectedCategoryId(isActive ? null : cat.id);
                }}
                whileTap={{ scale: 0.95 }}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 py-2.5 px-3 rounded-2xl transition-all duration-200 min-w-[72px] ${
                  isActive
                    ? `${getCategoryAccentBg(cat.name)} border shadow-lg`
                    : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:bg-white/[0.08]'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isActive ? 'bg-white/10' : 'bg-white/5'
                  }`}
                >
                  {getCategoryIcon(cat.name, 'w-4 h-4')}
                </div>
                <span className="text-[10px] font-medium truncate max-w-[64px]">
                  {cat.name}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* ── Promotional Banners Carousel (DidiFood style) ────────────── */}
      {banners.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
          className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {banners.map((banner, idx) => (
            <motion.a
              key={banner.id}
              href={banner.link_url || '#'}
              target={banner.link_url ? '_blank' : undefined}
              rel={banner.link_url ? 'noopener noreferrer' : undefined}
              whileTap={{ scale: 0.98 }}
              className="flex-shrink-0 w-[85vw] max-w-[380px] snap-center rounded-2xl overflow-hidden relative group"
            >
              {/* Gradient fallback */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-600/40 via-amber-600/30 to-orange-500/20 z-0" />
              <img
                src={banner.image_url}
                alt={banner.title}
                className="relative w-full aspect-[16/7] object-cover z-[1] group-hover:scale-[1.02] transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Overlay text */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-[2]" />
              <div className="absolute bottom-0 left-0 right-0 p-4 z-[3]">
                <h3 className="text-sm font-bold text-white line-clamp-1">
                  {banner.title}
                </h3>
                {banner.description && (
                  <p className="text-[10px] text-white/70 line-clamp-1 mt-0.5">
                    {banner.description}
                  </p>
                )}
              </div>
              {/* Dots indicator */}
              <div className="absolute bottom-2 right-3 z-[3] flex items-center gap-1">
                {banners.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === idx ? 'bg-white' : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </motion.a>
          ))}
        </motion.div>
      )}

      {/* ── Featured Products Horizontal Section (DidiFood style) ────── */}
      {!loading && isBrowsingVendors && featuredProducts.length > 0 && !search && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white">Productos destacados</h2>
            </div>
            <span className="text-[11px] text-gray-500">
              {featuredProducts.length} producto{featuredProducts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {featuredProducts.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex-shrink-0 w-[150px] glass rounded-2xl overflow-hidden group hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300"
              >
                {/* Product image */}
                <div
                  className="aspect-square relative overflow-hidden cursor-pointer"
                  onClick={() => {
                    setSelectedProduct(product);
                    setSelectedQty(1);
                  }}
                >
                  <SignedProductImage
                    imagePath={product.image_url}
                    alt={product.name}
                    fill
                    sizes="150px"
                  />
                  {product.is_featured && (
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-amber-500/90 text-black backdrop-blur-sm">
                        <Sparkles className="w-2 h-2" />
                        Top
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
                {/* Product info */}
                <div className="p-2.5">
                  <p className="text-[9px] text-gray-500 truncate flex items-center gap-0.5">
                    <Store className="w-2 h-2 flex-shrink-0" />
                    {product.vendor_name}
                  </p>
                  <h3
                    className="text-[11px] font-semibold text-white truncate mt-0.5 cursor-pointer group-hover:text-orange-400 transition-colors"
                    onClick={() => {
                      setSelectedProduct(product);
                      setSelectedQty(1);
                    }}
                  >
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-bold text-white">
                      {formatCRC(product.price)}
                    </span>
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
                      disabled={!product.in_stock}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        getCartQty(product.id) > 0
                          ? 'bg-orange-500 text-white'
                          : 'bg-orange-500/15 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25'
                      }`}
                      whileTap={product.in_stock ? { scale: 0.9 } : {}}
                    >
                      {getCartQty(product.id) > 0 ? (
                        <Plus className="w-3 h-3" />
                      ) : (
                        <ShoppingCart className="w-3 h-3" />
                      )}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Breadcrumb: Selected Vendor / Category ──────────────────── */}
      <AnimatePresence>
        {(selectedVendor || selectedCategory) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Volver
              </button>
              <div className="w-px h-3 bg-white/10" />
              <span className="text-xs text-orange-400 font-medium truncate">
                {selectedVendor
                  ? selectedVendor.store_name
                  : selectedCategory?.name || ''}
              </span>
              {selectedVendor && (
                <span className="text-[10px] text-gray-500">
                  — {selectedVendor.product_count} productos
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sort / Filter Bar (only when viewing products) ─────────── */}
      {!isBrowsingVendors && !loading && (
        <SortFilterBar
          sort={sort}
          setSort={setSort}
          inStockOnly={inStockOnly}
          setInStockOnly={setInStockOnly}
          featuredOnly={featuredOnly}
          setFeaturedOnly={setFeaturedOnly}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          CONTENT: Vendors vs Products
          ═══════════════════════════════════════════════════════════════ */}

      {/* ── Loading state ──────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-6">
          <div>
            <div className="h-5 w-40 rounded bg-white/[0.06] mb-4 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <VendorCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Vendor Cards (home / no selection) ──────────────────────── */}
      {!loading && isBrowsingVendors && (
        <AnimatePresence mode="wait">
          {vendors.length > 0 ? (
            <motion.div
              key="vendors"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* ── Top Rated Vendors Section ──────────────────────── */}
              {topVendors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center">
                        <Star className="w-3 h-3 text-amber-400" />
                      </div>
                      <h2 className="text-base font-bold text-white">
                        Populares
                      </h2>
                    </div>
                    <span className="text-[11px] text-gray-500">
                      Mejor valoradas
                    </span>
                  </div>
                  <div
                    className="flex gap-3 overflow-x-auto pb-1"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {topVendors.slice(0, 5).map((vendor) => (
                      <motion.div
                        key={vendor.id}
                        whileTap={{ scale: 0.98 }}
                        className="flex-shrink-0 w-[260px]"
                        onClick={() => {
                          setSelectedVendorId(vendor.id);
                          setSelectedCategoryId(null);
                        }}
                      >
                        <VendorCard
                          vendor={vendor}
                          productCount={vendor.product_count}
                          onClick={() => {
                            setSelectedVendorId(vendor.id);
                            setSelectedCategoryId(null);
                          }}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── All Stores Section ─────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-orange-500/15 flex items-center justify-center">
                      <Store className="w-3 h-3 text-orange-400" />
                    </div>
                    <h2 className="text-base font-bold text-white">
                      Todas las tiendas
                    </h2>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {vendors.length} tienda{vendors.length !== 1 ? 's' : ''}
                    {activeVendors.length > 0 && (
                      <span className="text-emerald-400/70 ml-1">
                        ({activeVendors.length} con productos)
                      </span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {vendors.map((vendor) => (
                      <VendorCard
                        key={vendor.id}
                        vendor={vendor}
                        productCount={vendor.product_count}
                        onClick={() => {
                          setSelectedVendorId(vendor.id);
                          setSelectedCategoryId(null);
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Trust badges */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-2xl p-4"
              >
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center mx-auto mb-1.5">
                      <Truck className="w-4 h-4 text-orange-400" />
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Entrega rápida
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Pago seguro
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center mx-auto mb-1.5">
                      <Star className="w-4 h-4 text-amber-400" />
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Mejor calidad
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <EmptyVendors />
          )}
        </AnimatePresence>
      )}

      {/* ── Product Grid (when category or vendor selected) ─────────── */}
      {!loading && !isBrowsingVendors && (
        <AnimatePresence mode="wait">
          {filteredProducts.length > 0 ? (
            <motion.div
              key="products"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white">
                  {selectedVendor
                    ? 'Productos'
                    : selectedCategory?.name || 'Productos'}
                </h2>
                <span className="text-[11px] text-gray-500">
                  {filteredProducts.length} producto
                  {filteredProducts.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product, i) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      index={i}
                      onSelect={() => {
                        setSelectedProduct(product);
                        setSelectedQty(1);
                      }}
                      onAddToCart={() => handleAddToCart(product)}
                      cartQty={getCartQty(product.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <EmptyProducts onClear={clearSelection} />
          )}
        </AnimatePresence>
      )}

      {/* ── Search fallback: show products if search has text but nothing selected */}
      {!loading &&
        isBrowsingVendors &&
        search.trim().length > 0 &&
        products.length > 0 && (
          <AnimatePresence mode="wait">
            {(() => {
              const searchResults = products.filter(
                (p) =>
                  p.name.toLowerCase().includes(search.toLowerCase()) ||
                  (p.description || '')
                    .toLowerCase()
                    .includes(search.toLowerCase()) ||
                  p.vendor_name.toLowerCase().includes(search.toLowerCase())
              );

              if (searchResults.length === 0) return null;

              return (
                <motion.div
                  key="search-results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-white">
                      Resultados para &quot;{search}&quot;
                    </h2>
                    <span className="text-[11px] text-gray-500">
                      {searchResults.length} producto
                      {searchResults.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                      {searchResults.map((product, i) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          index={i}
                          onSelect={() => {
                            setSelectedProduct(product);
                            setSelectedQty(1);
                          }}
                          onAddToCart={() => handleAddToCart(product)}
                          cartQty={getCartQty(product.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        )}

      {/* ── Floating Cart Button ────────────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.button
            type="button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.9 }}
            onClick={openCart}
            className="fixed bottom-24 right-4 z-[60] flex items-center gap-2.5 pl-4 pr-5 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 shadow-xl shadow-orange-500/30"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5 text-white" />
              <motion.span
                key={cartCount}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-orange-500 text-[9px] font-extrabold flex items-center justify-center"
              >
                {cartCount > 9 ? '9+' : cartCount}
              </motion.span>
            </div>
            <span className="text-sm font-bold text-white">
              Ver carrito
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Product Detail Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            quantity={selectedQty}
            setQuantity={setSelectedQty}
            onAddToCart={() => handleAddToCart(selectedProduct, selectedQty)}
            onBuyNow={() => handleBuyNow(selectedProduct, selectedQty)}
            buying={buying}
            onClose={() => {
              setSelectedProduct(null);
              setSelectedQty(1);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Cart Sheet ──────────────────────────────────────────────── */}
      <CartSheet />
    </motion.div>
  );
}

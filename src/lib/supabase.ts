import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'rida-auth-token',
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-client-info': 'rida-supreme',
    },
  },
});

// Type helpers
export type Profile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'driver' | 'admin' | 'vendor' | 'courier';
  avatar?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Driver = {
  id: string;
  user_id: string;
  status: 'offline' | 'online' | 'busy' | 'suspended';
  is_verified: boolean;
  rating: number;
  total_rides: number;
  total_earnings: number;
  work_hours_today: number;
  is_on_break: boolean;
  last_online_at?: string;
  current_location?: string;
  created_at: string;
  profiles?: Profile;
  vehicles?: Vehicle;
};

export type Vehicle = {
  id: string;
  driver_id: string;
  plate: string;
  model: string;
  color: string;
  year?: number;
  verified: boolean;
};

export type PaymentMethodType = 'cash' | 'wallet' | 'card' | 'sinpe';

export type Ride = {
  id: string;
  rider_id: string;
  driver_id?: string;
  status: 'searching' | 'assigned' | 'arriving' | 'started' | 'completed' | 'cancelled';
  origin: string;
  origin_address?: string;
  origin_lat?: number;
  origin_lng?: number;
  destination: string;
  dest_address?: string;
  dest_lat?: number;
  dest_lng?: number;
  price: number;
  distance?: number;
  duration?: number;
  surge_multiplier: number;
  commission_rate: number;
  driver_earnings?: number;
  rider_rating?: number;
  driver_rating?: number;
  review?: string;
  is_third_party: boolean;
  payment_method?: PaymentMethodType;
  payment_status?: string;
  card_last_four?: string;
  sinpe_phone?: string;
  created_at: string;
  profiles?: Profile;
  drivers?: Driver;
};

export type Wallet = {
  id: string;
  user_id: string;
  balance: number;
  total_earnings: number;
  total_withdrawn: number;
};

export type Transaction = {
  id: string;
  wallet_id: string;
  amount: number;
  type: 'credit' | 'debit' | 'withdrawal' | 'commission' | 'ride_payment';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  description?: string;
  ride_id?: string;
  created_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'ride' | 'payment' | 'sos' | 'system';
  is_read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
};

export type Document = {
  id: string;
  user_id: string;
  type: string;
  url: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
};

export type Vendor = {
  id: string;
  user_id: string;
  store_name: string;
  description?: string;
  category: 'pharmacy' | 'food' | 'stores' | 'other';
  is_approved: boolean;
  is_active?: boolean;
  rating: number;
  logo_url?: string;
  phone?: string;
  address?: string;
  opening_hours?: Record<string, { open: string; close: string; active: boolean }>;
  min_order_amount?: number;
  delivery_radius_km?: number;
  delivery_fee?: number;
  latitude?: number;
  longitude?: number;
  created_at?: string;
  updated_at?: string;
  profiles?: Profile;
};

export type Product = {
  id: string;
  vendor_id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image_url?: string;
  in_stock: boolean;
  stock_quantity?: number;
  sold_count?: number;
  is_featured?: boolean;
  avg_rating?: number;
  created_at?: string;
  updated_at?: string;
  vendors?: Vendor;
};

export type Settings = {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
};

export type MarketplaceCategory = {
  id: string;
  name: string;
  icon?: string;
  image_url?: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
};

export type VendorWallet = {
  id: string;
  vendor_id: string;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  pending_balance: number;
  created_at?: string;
  updated_at?: string;
};

export type VendorTransaction = {
  id: string;
  vendor_id: string;
  wallet_id: string;
  type: 'earning' | 'withdrawal' | 'adjustment';
  amount: number;
  description?: string;
  delivery_id?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at?: string;
};

export type ProductReview = {
  id: string;
  product_id: string;
  customer_id: string;
  delivery_id?: string;
  rating: number;
  comment?: string;
  created_at?: string;
};

export type SOS = {
  id: string;
  user_id: string;
  ride_id?: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'resolved';
  created_at: string;
};

// ─── Chat System Types ───────────────────────────────────────

export type SupportChat = {
  id: string;
  user_id: string;
  user_name?: string;
  user_role: 'client' | 'driver' | 'vendor' | 'courier';
  subject: string;
  status: 'open' | 'closed' | 'resolved';
  last_message_at: string;
  last_message_preview: string;
  unread_by_admin: number;
  unread_by_user: number;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  chat_id: string;
  sender_type: 'user' | 'admin';
  sender_id?: string;
  content: string;
  message_type: 'text' | 'image' | 'system';
  created_at: string;
};

export type SavedCard = {
  id: string;
  user_id: string;
  card_number: string;
  card_holder: string;
  card_expiry: string;
  card_brand: 'visa' | 'mastercard' | 'amex' | 'other';
  last_four: string;
  is_default: boolean;
  created_at: string;
};

// ─── Courier Wallet Types ──────────────────────────────────────

export type CourierWallet = {
  id: string;
  courier_id: string;
  balance: number;
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
  created_at?: string;
  updated_at?: string;
};

export type CourierTransaction = {
  id: string;
  courier_id: string;
  wallet_id: string;
  type: 'earning' | 'withdrawal' | 'adjustment' | 'commission';
  amount: number;
  description?: string;
  delivery_id?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'queued';
  queue_position?: number;
  created_at?: string;
};

export type WithdrawalRequest = {
  id: string;
  courier_id: string;
  wallet_id: string;
  amount: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  queue_position?: number;
  requested_at: string;
  processable_at: string;
  processed_at?: string;
  notes?: string;
  courier_name?: string;
  courier_phone?: string;
};

// ─── Courier System Types ──────────────────────────────────────

export type Courier = {
  id: string;
  user_id: string;
  vehicle_type: 'moto' | 'bici' | 'carro';
  is_online: boolean;
  status: 'offline' | 'online' | 'busy' | 'delivering' | 'suspended';
  is_verified: boolean;
  rating: number;
  total_deliveries: number;
  total_earnings: number;
  current_lat?: number;
  current_lng?: number;
  last_online_at?: string;
  created_at: string;
  profiles?: Profile;
};

export type Delivery = {
  id: string;
  courier_id?: string;
  customer_id: string;
  vendor_id?: string;
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  pickup_address?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  items: any[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  customer_rating?: number;
  courier_rating?: number;
  notes?: string;
  created_at: string;
  profiles?: Profile;
  couriers?: Courier;
  vendors?: Vendor;
};

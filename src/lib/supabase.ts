import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
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
  rating: number;
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
  vendors?: Vendor;
};

export type Settings = {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
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

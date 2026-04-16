import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Ride } from '@/lib/supabase';

export type RideStatus = 'searching' | 'assigned' | 'arriving' | 'started' | 'completed' | 'cancelled';

interface RideState {
  currentRide: (Ride & { driver_name?: string; driver_phone?: string; driver_vehicle?: string; driver_rating?: number }) | null;
  rideHistory: (Ride & { driver_name?: string; driver_vehicle?: string })[];
  isCreating: boolean;
  availableDrivers: Array<{ id: string; name: string; vehicle: string; rating: number; distance: number; eta: number }>;

  createRide: (origin: string, destination: string, originLat?: number, originLng?: number, destLat?: number, destLng?: number, rideType?: string) => Promise<string | null>;
  cancelRide: (rideId: string) => Promise<void>;
  completeRide: (rideId: string) => Promise<void>;
  fetchRideHistory: (userId: string) => Promise<void>;
  subscribeToRideUpdates: (rideId: string) => () => void;
  searchNearbyDrivers: (lat: number, lng: number) => Promise<void>;
}

const DEMO_DRIVERS = [
  { id: '1', name: 'Carlos M.', vehicle: 'Toyota Corolla 2023 - Rojo', rating: 4.8, distance: 1.2, eta: 4 },
  { id: '2', name: 'Maria G.', vehicle: 'Honda Civic 2022 - Blanco', rating: 4.9, distance: 2.5, eta: 7 },
  { id: '3', name: 'Jose R.', vehicle: 'Hyundai Accent 2024 - Gris', rating: 4.7, distance: 3.1, eta: 9 },
];

export const useRideStore = create<RideState>((set, get) => ({
  currentRide: null,
  rideHistory: [],
  isCreating: false,
  availableDrivers: [],

  createRide: async (origin, destination, originLat, originLng, destLat, destLng, rideType = 'standard') => {
    set({ isCreating: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ isCreating: false });
        return null;
      }

      // Get pricing from settings
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['base_price', 'price_per_km', 'surge_enabled']);

      const basePrice = Number(settings?.find(s => s.key === 'base_price')?.value || 1500);
      const pricePerKm = Number(settings?.find(s => s.key === 'price_per_km')?.value || 500);

      // Price multipliers by ride type
      const multipliers: Record<string, number> = {
        standard: 1.0,
        premium: 1.6,
        suv: 2.1,
        moto: 0.7,
        moto_express: 0.9,
        grua: 3.0,
        flete: 3.5,
      };
      const multiplier = multipliers[rideType] || 1.0;

      // Calculate price (simulated distance)
      const distance = Math.floor(Math.random() * 15) + 3;
      const price = Math.round((basePrice + (distance * pricePerKm)) * multiplier);
      const duration = distance * 3;

      const { data: ride, error } = await supabase
        .from('rides')
        .insert({
          rider_id: user.id,
          status: 'searching',
          origin,
          origin_lat: originLat,
          origin_lng: originLng,
          destination,
          dest_lat: destLat,
          dest_lng: destLng,
          price,
          distance,
          duration,
          ride_type: rideType,
        })
        .select()
        .single();

      if (error) throw error;

      const rideWithDriver = { ...ride, driver_name: undefined, driver_phone: undefined, driver_vehicle: undefined, driver_rating: undefined };

      set({ currentRide: rideWithDriver, isCreating: false });

      // Subscribe to real-time updates
      get().subscribeToRideUpdates(ride.id);

      // Simulate driver assignment after 3s
      setTimeout(async () => {
        const state = get();
        if (state.currentRide?.id === ride.id && state.currentRide.status === 'searching') {
          const randomDriver = DEMO_DRIVERS[Math.floor(Math.random() * DEMO_DRIVERS.length)];
          set({
            currentRide: {
              ...state.currentRide,
              status: 'assigned',
              driver_id: randomDriver.id,
              driver_name: randomDriver.name,
              driver_vehicle: randomDriver.vehicle,
              driver_rating: randomDriver.rating,
            }
          });

          // Update in Supabase
          await supabase
            .from('rides')
            .update({ status: 'assigned', driver_id: randomDriver.id })
            .eq('id', ride.id);
        }
      }, 3000);

      // Simulate driver arriving
      setTimeout(() => {
        const state = get();
        if (state.currentRide?.id === ride.id && state.currentRide.status === 'assigned') {
          set({ currentRide: { ...state.currentRide, status: 'arriving' } });
          supabase.from('rides').update({ status: 'arriving' }).eq('id', ride.id);
        }
      }, 8000);

      // Simulate ride started
      setTimeout(() => {
        const state = get();
        if (state.currentRide?.id === ride.id && state.currentRide.status === 'arriving') {
          set({ currentRide: { ...state.currentRide, status: 'started' } });
          supabase.from('rides').update({ status: 'started' }).eq('id', ride.id);
        }
      }, 13000);

      return ride.id;
    } catch (error) {
      console.error('Create ride error:', error);
      set({ isCreating: false });
      return null;
    }
  },

  cancelRide: async (rideId: string) => {
    try {
      await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId);
      const state = get();
      if (state.currentRide) {
        set({
          rideHistory: [...state.rideHistory, { ...state.currentRide, status: 'cancelled' } as any],
          currentRide: null,
        });
      }
    } catch (error) {
      console.error('Cancel ride error:', error);
    }
  },

  completeRide: async (rideId: string) => {
    try {
      const state = get();
      const commissionRate = 15;
      const driverEarnings = state.currentRide ? state.currentRide.price * (1 - commissionRate / 100) : 0;

      await supabase.from('rides').update({
        status: 'completed',
        driver_earnings: driverEarnings,
        commission_rate: commissionRate,
      }).eq('id', rideId);

      if (state.currentRide) {
        set({
          rideHistory: [...state.rideHistory, { ...state.currentRide, status: 'completed' } as any],
          currentRide: null,
        });
      }
    } catch (error) {
      console.error('Complete ride error:', error);
    }
  },

  fetchRideHistory: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('rider_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        set({ rideHistory: data as any });
      }
    } catch (error) {
      console.error('Fetch history error:', error);
    }
  },

  subscribeToRideUpdates: (rideId: string) => {
    const channel = supabase
      .channel(`ride-${rideId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      }, (payload) => {
        const state = get();
        if (state.currentRide?.id === rideId) {
          set({ currentRide: { ...state.currentRide, ...payload.new as any } });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  searchNearbyDrivers: async (lat: number, lng: number) => {
    try {
      const { data } = await supabase
        .from('drivers')
        .select('id, profiles(name, phone), vehicles(model, color, plate)')
        .eq('status', 'online')
        .eq('is_verified', true);

      if (data) {
        set({
          availableDrivers: data.map((d: any) => ({
            id: d.id,
            name: d.profiles?.name || 'Conductor',
            vehicle: d.vehicles ? `${d.vehicles.model} ${d.vehicles.color}` : 'Vehiculo',
            rating: 4.5 + Math.random() * 0.5,
            distance: Math.floor(Math.random() * 5) + 1,
            eta: Math.floor(Math.random() * 10) + 3,
          }))
        });
      }
    } catch (error) {
      console.error('Search drivers error:', error);
    }
  },
}));

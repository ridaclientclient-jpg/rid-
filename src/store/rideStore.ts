import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Ride, PaymentMethodType } from '@/lib/supabase';

export type RideStatus = 'searching' | 'assigned' | 'arriving' | 'started' | 'completed' | 'cancelled' | 'scheduled';

interface RideState {
  currentRide: (Ride & { driver_name?: string; driver_phone?: string; driver_vehicle?: string; driver_rating?: number; stops?: Array<{ address: string; lat?: number; lng?: number }>; scheduled_at?: string; is_scheduled?: boolean }) | null;
  rideHistory: (Ride & { driver_name?: string; driver_vehicle?: string })[];
  isCreating: boolean;
  availableDrivers: Array<{ id: string; name: string; vehicle: string; rating: number; distance: number; eta: number }>;

  createRide: (origin: string, destination: string, originLat?: number, originLng?: number, destLat?: number, destLng?: number, rideType?: string, stops?: Array<{ address: string; lat?: number; lng?: number }>, paymentMethod?: PaymentMethodType, paymentExtra?: { cardLastFour?: string; sinpePhone?: string }, scheduledAt?: string) => Promise<string | null>;
  cancelRide: (rideId: string) => Promise<void>;
  completeRide: (rideId: string) => Promise<void>;
  fetchRideHistory: (userId: string) => Promise<void>;
  subscribeToRideUpdates: (rideId: string) => () => void;
  searchNearbyDrivers: (lat: number, lng: number) => Promise<void>;
}

const DEMO_DRIVERS = [
  { id: '1', name: 'Carlos M.', vehicle: 'Toyota Corolla 2023 - Rojo', rating: 4.8, distance: 0.4, eta: 2 },
  { id: '2', name: 'Maria G.', vehicle: 'Honda Civic 2022 - Blanco', rating: 4.9, distance: 0.8, eta: 3 },
  { id: '3', name: 'Jose R.', vehicle: 'Hyundai Accent 2024 - Gris', rating: 4.7, distance: 1.1, eta: 4 },
  { id: '4', name: 'Ana L.', vehicle: 'Nissan Sentra 2023 - Azul', rating: 4.6, distance: 1.5, eta: 5 },
  { id: '5', name: 'Roberto S.', vehicle: 'Kia Rio 2024 - Negro', rating: 4.8, distance: 2.0, eta: 6 },
];

export const useRideStore = create<RideState>((set, get) => ({
  currentRide: null,
  rideHistory: [],
  isCreating: false,
  availableDrivers: [],

  createRide: async (origin, destination, originLat, originLng, destLat, destLng, rideType = 'standard', stops = [], paymentMethod = 'cash', paymentExtra = {}, scheduledAt) => {
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

      // Calculate price (distance + extra per stop)
      const baseDistance = Math.floor(Math.random() * 15) + 3;
      const stopExtra = stops.length * 2;
      const distance = baseDistance + stopExtra;
      const price = Math.round((basePrice + (distance * pricePerKm)) * multiplier);
      const duration = distance * 3;

      // Check wallet balance if paying with wallet
      if (paymentMethod === 'wallet') {
        const { data: walletData } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', user.id)
          .single();

        if (!walletData || walletData.balance < price) {
          set({ isCreating: false });
          throw new Error('Saldo insuficiente en tu billetera para este viaje');
        }
      }

      // Check if this is a scheduled ride
      const isScheduled = !!scheduledAt;

      // Build the ride data — try full insert first (with ride_type + stops + payment)
      const fullInsert: Record<string, any> = {
        rider_id: user.id,
        status: isScheduled ? 'scheduled' : 'searching',
        origin,
        origin_lat: originLat,
        origin_lng: originLng,
        destination,
        dest_lat: destLat,
        dest_lng: destLng,
        price,
        distance,
        duration,
        payment_method: paymentMethod,
        payment_status: 'pending',
        card_last_four: paymentExtra.cardLastFour || null,
        sinpe_phone: paymentExtra.sinpePhone || null,
        scheduled_at: scheduledAt || null,
        is_scheduled: isScheduled,
      };

      let ride: any = null;
      let insertError: any = null;

      // Attempt 1: Insert with ride_type and stops columns
      try {
        const result = await supabase
          .from('rides')
          .insert({
            ...fullInsert,
            ride_type: rideType,
            stops: stops.length > 0 ? JSON.stringify(stops) : null,
          })
          .select()
          .single();
        ride = result.data;
        insertError = result.error;
      } catch (e) {
        insertError = e;
      }

      // Attempt 2: If failed (likely missing columns), retry without ride_type and stops
      if (insertError && (insertError.message?.includes('ride_type') || insertError.message?.includes('stops') || insertError.code === '42P01' || insertError.code === '42703')) {
        console.warn('ride_type/stops columns missing, retrying without them...');
        try {
          const result2 = await supabase
            .from('rides')
            .insert(fullInsert)
            .select()
            .single();
          ride = result2.data;
          insertError = result2.error;
        } catch (e) {
          insertError = e;
        }
      }

      if (insertError || !ride) {
        throw new Error(insertError?.message || 'No se pudo crear el viaje');
      }

      const rideWithDriver = {
        ...ride,
        driver_name: undefined,
        driver_phone: undefined,
        driver_vehicle: undefined,
        driver_rating: undefined,
        stops: stops.length > 0 ? stops : undefined,
        ride_type: rideType,
        payment_method: paymentMethod,
        payment_status: 'pending',
        card_last_four: paymentExtra.cardLastFour || null,
        sinpe_phone: paymentExtra.sinpePhone || null,
        scheduled_at: scheduledAt || undefined,
        is_scheduled: isScheduled,
      };

      set({ currentRide: rideWithDriver, isCreating: false });

      // Subscribe to real-time updates
      get().subscribeToRideUpdates(ride.id);

      // Simulate driver assignment after 3s
      setTimeout(async () => {
        const state = get();
        if (state.currentRide?.id === ride.id && state.currentRide.status === 'searching') {
          // Pick a random nearby driver (sorted by closest first, pick from top 3)
          const sortedDrivers = [...DEMO_DRIVERS].sort((a, b) => a.distance - b.distance);
          const randomDriver = sortedDrivers[Math.floor(Math.random() * Math.min(3, sortedDrivers.length))];
          // Randomize distance slightly for realism
          const distJitter = (Math.random() - 0.5) * 0.4;
          const finalDist = Math.max(0.2, Math.round((randomDriver.distance + distJitter) * 10) / 10);
          const finalEta = Math.max(1, Math.round(finalDist * 3));

          set({
            currentRide: {
              ...state.currentRide,
              status: 'assigned',
              driver_id: randomDriver.id,
              driver_name: randomDriver.name,
              driver_vehicle: randomDriver.vehicle,
              driver_rating: randomDriver.rating,
              driver_distance: finalDist,
              driver_eta: finalEta,
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
    } catch (error: any) {
      console.error('Create ride error:', error);
      set({ isCreating: false });
      throw error;
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
      const ride = state.currentRide;

      // Fetch commission settings from DB
      const { data: commissionSettings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['commission_percentage', 'base_fee']);

      const commissionPct = Number(commissionSettings?.find((s: any) => s.key === 'commission_percentage')?.value || 15);
      const baseFee = Number(commissionSettings?.find((s: any) => s.key === 'base_fee')?.value || 0);
      const price = ride?.price || 0;
      const commission = Math.round(price * commissionPct / 100) + baseFee;
      const driverEarnings = Math.max(0, price - commission);

      // Process payment based on payment method
      const paymentMethod = (ride as any)?.payment_method || 'cash';
      const riderId = ride?.rider_id;
      const driverId = ride?.driver_id;

      if (paymentMethod === 'wallet' && riderId) {
        /* ── WALLET PAYMENT ── */
        // Deduct from rider's wallet
        const { data: riderWallet } = await supabase
          .from('wallets')
          .select('id, balance')
          .eq('user_id', riderId)
          .single();

        if (riderWallet && riderWallet.balance >= price) {
          // Deduct from rider
          await supabase
            .from('wallets')
            .update({ balance: riderWallet.balance - price })
            .eq('id', riderWallet.id);

          // Record rider transaction
          await supabase.from('transactions').insert({
            wallet_id: riderWallet.id,
            amount: -price,
            type: 'ride_payment',
            status: 'completed',
            description: `Pago viaje #${rideId.slice(0, 8).toUpperCase()} — Billetera RIDA`,
          });
        }

        // Credit driver's wallet (minus commission)
        if (driverId) {
          const { data: driverWallet } = await supabase
            .from('wallets')
            .select('id, balance')
            .eq('user_id', driverId)
            .single();

          if (driverWallet) {
            await supabase
              .from('wallets')
              .update({
                balance: driverWallet.balance + driverEarnings,
                total_earnings: (driverWallet.total_earnings || 0) + driverEarnings,
              })
              .eq('id', driverWallet.id);

            await supabase.from('transactions').insert({
              wallet_id: driverWallet.id,
              amount: driverEarnings,
              type: 'credit',
              status: 'completed',
              description: `Ganancia viaje #${rideId.slice(0, 8).toUpperCase()}`,
            });
          }
        }
      } else if (paymentMethod === 'cash' && driverId) {
        /* ── CASH PAYMENT ── */
        // Credit driver's wallet with full amount (minus commission) when they confirm cash
        const { data: driverWallet } = await supabase
          .from('wallets')
          .select('id, balance')
          .eq('user_id', driverId)
          .single();

        if (driverWallet) {
          await supabase
            .from('wallets')
            .update({
              balance: driverWallet.balance + driverEarnings,
              total_earnings: (driverWallet.total_earnings || 0) + driverEarnings,
            })
            .eq('id', driverWallet.id);

          await supabase.from('transactions').insert({
            wallet_id: driverWallet.id,
            amount: driverEarnings,
            type: 'credit',
            status: 'completed',
            description: `Ganancia viaje (efectivo) #${rideId.slice(0, 8).toUpperCase()}`,
          });
        }
      } else if (paymentMethod === 'card' || paymentMethod === 'sinpe') {
        /* ── CARD / SINPE — mark as processing (real integration pending) ── */
        if (driverId) {
          const { data: driverWallet } = await supabase
            .from('wallets')
            .select('id, balance')
            .eq('user_id', driverId)
            .single();

          if (driverWallet) {
            await supabase
              .from('wallets')
              .update({
                balance: driverWallet.balance + driverEarnings,
                total_earnings: (driverWallet.total_earnings || 0) + driverEarnings,
              })
              .eq('id', driverWallet.id);

            const methodLabel = paymentMethod === 'card' ? 'tarjeta' : 'SINPE';
            await supabase.from('transactions').insert({
              wallet_id: driverWallet.id,
              amount: driverEarnings,
              type: 'credit',
              status: 'completed',
              description: `Ganancia viaje (${methodLabel}) #${rideId.slice(0, 8).toUpperCase()}`,
            });
          }
        }
      }

      // Update ride status with commission breakdown
      await supabase.from('rides').update({
        status: 'completed',
        driver_earnings: driverEarnings,
        commission_rate: commissionPct,
        commission: commission,
        payment_status: 'completed',
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

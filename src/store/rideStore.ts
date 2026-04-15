import { create } from 'zustand';

export type RideStatus = 'searching' | 'assigned' | 'arriving' | 'started' | 'completed' | 'cancelled';

interface Ride {
  id: string;
  riderId: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicle?: string;
  driverRating?: number;
  status: RideStatus;
  origin: string;
  destination: string;
  price: number;
  distance?: number;
  duration?: number;
}

interface RideState {
  currentRide: Ride | null;
  rideHistory: Ride[];
  isCreating: boolean;
  
  createRide: (origin: string, destination: string) => Promise<Ride>;
  simulateRideProgress: () => void;
  cancelRide: () => void;
  completeRide: () => void;
}

export const useRideStore = create<RideState>((set, get) => ({
  currentRide: null,
  rideHistory: [],
  isCreating: false,

  createRide: async (origin: string, destination: string) => {
    set({ isCreating: true });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const price = Math.floor(Math.random() * 3000) + 1500;
    const distance = Math.floor(Math.random() * 15) + 3;
    const duration = distance * 3;
    
    const ride: Ride = {
      id: 'R-' + Date.now().toString().slice(-6),
      riderId: '1',
      status: 'searching',
      origin,
      destination,
      price,
      distance,
      duration,
    };
    
    set({ currentRide: ride, isCreating: false });
    
    // Simulate finding a driver after 3 seconds
    setTimeout(() => {
      const state = get();
      if (state.currentRide?.id === ride.id && state.currentRide.status === 'searching') {
        set({
          currentRide: {
            ...ride,
            status: 'assigned',
            driverId: 'D-001',
            driverName: 'Carlos M.',
            driverPhone: '+506 8888 0002',
            driverVehicle: 'Toyota Corolla 2023 - Rojo',
            driverRating: 4.8,
          }
        });
      }
    }, 3000);
    
    // Simulate driver arriving
    setTimeout(() => {
      const state = get();
      if (state.currentRide?.id === ride.id && state.currentRide.status === 'assigned') {
        set({ currentRide: { ...state.currentRide, status: 'arriving' } });
      }
    }, 8000);
    
    // Simulate ride started
    setTimeout(() => {
      const state = get();
      if (state.currentRide?.id === ride.id && state.currentRide.status === 'arriving') {
        set({ currentRide: { ...state.currentRide, status: 'started' } });
      }
    }, 13000);
    
    return ride;
  },

  simulateRideProgress: () => {
    const state = get();
    if (!state.currentRide) return;
    
    if (state.currentRide.status === 'started') {
      // Auto-complete after simulating
      setTimeout(() => {
        const currentState = get();
        if (currentState.currentRide?.status === 'started') {
          set({
            currentRide: { ...currentState.currentRide, status: 'completed' },
            rideHistory: [...currentState.rideHistory, { ...currentState.currentRide, status: 'completed' }]
          });
        }
      }, 5000);
    }
  },

  cancelRide: () => {
    const state = get();
    if (state.currentRide) {
      set({
        rideHistory: [...state.rideHistory, { ...state.currentRide, status: 'cancelled' }],
        currentRide: null,
      });
    }
  },

  completeRide: () => {
    const state = get();
    if (state.currentRide) {
      set({
        rideHistory: [...state.rideHistory, { ...state.currentRide, status: 'completed' }],
        currentRide: null,
      });
    }
  },
}));

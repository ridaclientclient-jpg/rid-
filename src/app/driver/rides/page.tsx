'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { supabase, type Driver, type Ride } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Power, PowerOff, MapPin, Clock, Star, Car, Navigation, AlertTriangle,
  Phone, MessageSquare, CheckCircle2, X as XIcon, ArrowRight,
  ChevronRight, History, User, Loader2, Volume2, VolumeX,
} from 'lucide-react';
import GoogleMap from '@/components/GoogleMap';
import RideChat, { ChatToggleButton } from '@/components/RideChat';
import type { RealtimeChannel } from '@supabase/supabase-js';

const statusLabels: Record<string, string> = {
  assigned: 'Asignado',
  arriving: 'En camino al punto',
  started: 'En viaje',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  assigned: 'bg-amber-500/20 text-amber-400',
  arriving: 'bg-blue-500/20 text-blue-400',
  started: 'bg-cyan-500/20 text-cyan-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const statusActions: Record<string, { label: string; nextStatus: string }> = {
  assigned: { label: 'Iniciar Camino', nextStatus: 'arriving' },
  arriving: { label: 'Iniciar Viaje', nextStatus: 'started' },
  started: { label: 'Completar Viaje', nextStatus: 'completed' },
};

interface CompletedRide {
  id: string;
  rider_id: string;
  rider_name?: string;
  rider_phone?: string;
  rider_rating?: number;
  origin: string;
  destination: string;
  price: number;
  driver_earnings?: number;
  completed_at: string;
  has_rated: boolean;
}

// Play notification sound
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.1);
    osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.stop(audioCtx.currentTime + 0.5);
  } catch {
    // Audio not available
  }
}

export default function DriverRides() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session } = useAuthStore();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [riderProfile, setRiderProfile] = useState<{ name: string; phone: string; rating: number } | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [completedRides, setCompletedRides] = useState<CompletedRide[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Get driver record
  const fetchDriver = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setDriver(data);
        setIsOnline(data.status === 'online' || data.status === 'busy');
      }
    } catch (err) {
      console.error('Error fetching driver:', err);
    }
  }, [user?.id]);

  // Fetch rider profile for active ride
  const fetchRiderProfile = useCallback(async (riderId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('name, phone')
        .eq('id', riderId)
        .single();
      if (data) {
        const { data: rides } = await supabase
          .from('reviews')
          .select('rating')
          .eq('reviewee_id', riderId);
        const avgRating = rides && rides.length > 0
          ? rides.reduce((sum: number, r: any) => sum + r.rating, 0) / rides.length
          : 5.0;
        setRiderProfile({ name: data.name, phone: data.phone || '', rating: Math.round(avgRating * 10) / 10 });
      }
    } catch {
      // Silent fail
    }
  }, []);

  // Fetch active ride for this driver
  const fetchActiveRide = useCallback(async () => {
    if (!driver?.id) return;
    try {
      const { data } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', driver.id)
        .in('status', ['assigned', 'arriving', 'started'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setActiveRide(data);
        if (data.rider_id) fetchRiderProfile(data.rider_id);
      } else {
        setActiveRide(null);
        setRiderProfile(null);
      }
    } catch (err) {
      console.error('Error fetching active ride:', err);
    }
  }, [driver?.id, fetchRiderProfile]);

  // Fetch completed rides
  const fetchCompletedRides = useCallback(async () => {
    if (!driver?.id) return;
    setLoadingCompleted(true);
    try {
      const { data: ridesData } = await supabase
        .from('rides')
        .select('id, rider_id, origin, destination, price, driver_earnings, updated_at')
        .eq('driver_id', driver.id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(15);

      if (!ridesData || ridesData.length === 0) {
        setCompletedRides([]);
        setLoadingCompleted(false);
        return;
      }

      const rideIds = ridesData.map((r) => r.id);
      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('ride_id')
        .eq('reviewer_id', user?.id || '')
        .in('ride_id', rideIds);

      const ratedRideIds = new Set(existingReviews?.map((r) => r.ride_id) || []);
      const riderIds = [...new Set(ridesData.map((r) => r.rider_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, phone')
        .in('id', riderIds);

      const nameMap = new Map(profilesData?.map((p: any) => [p.id, { name: p.name, phone: p.phone }]) || []);

      const completed: CompletedRide[] = ridesData.map((r: any) => ({
        id: r.id,
        rider_id: r.rider_id,
        rider_name: nameMap.get(r.rider_id)?.name,
        rider_phone: nameMap.get(r.rider_id)?.phone,
        origin: r.origin,
        destination: r.destination,
        price: r.price,
        driver_earnings: r.driver_earnings,
        completed_at: r.updated_at,
        has_rated: ratedRideIds.has(r.id),
      }));

      setCompletedRides(completed);
    } catch {
      // Silent fail
    } finally {
      setLoadingCompleted(false);
    }
  }, [driver?.id, user?.id]);

  // Initial load
  useEffect(() => {
    fetchDriver();
  }, [fetchDriver]);

  useEffect(() => {
    if (driver?.id) {
      fetchActiveRide();
      fetchCompletedRides();
    }
  }, [driver?.id, fetchActiveRide, fetchCompletedRides]);

  // GPS location tracking
  useEffect(() => {
    if (!isOnline) return;

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ lat: latitude, lng: longitude });
          // Send to API
          if (session?.access_token) {
            fetch('/api/drivers/update-location', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ latitude, longitude }),
            }).catch(() => {});
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isOnline, session?.access_token]);

  // Supabase Realtime subscription for rides assigned to this driver
  useEffect(() => {
    if (!driver?.id) return;

    const channel = supabase
      .channel(`driver-rides-${driver.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `driver_id=eq.${driver.id}`,
        },
        (payload: any) => {
          const ride = payload.new as Ride;
          if (!ride) return;

          if (ride.status === 'assigned' && !activeRide) {
            // New ride assigned
            playNotificationSound();
            toast.success('Nuevo viaje asignado!', { duration: 5000 });
            setActiveRide(ride);
            if (ride.rider_id) fetchRiderProfile(ride.rider_id);
          } else if (ride.status === 'completed' || ride.status === 'cancelled') {
            // Ride ended
            if (activeRide?.id === ride.id) {
              if (ride.status === 'completed') {
                const earnings = ride.driver_earnings || Math.round(ride.price * 0.85);
                toast.success(`Viaje completado! +₡${earnings.toLocaleString()}`);
                router.push(`/driver/ride-rating?rideId=${ride.id}`);
              } else {
                toast.info('Viaje cancelado');
              }
              setActiveRide(null);
              setRiderProfile(null);
              fetchCompletedRides();
              fetchDriver();
            }
          } else if (['assigned', 'arriving', 'started'].includes(ride.status)) {
            // Status update on active ride
            setActiveRide(ride);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [driver?.id, activeRide, fetchRiderProfile, fetchCompletedRides, fetchDriver, router]);

  // Toggle online/offline via API
  const handleToggleOnline = useCallback(async () => {
    if (!session?.access_token) return;
    setIsToggling(true);
    const newStatus = isOnline ? 'offline' : 'online';

    try {
      const res = await fetch('/api/drivers/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          latitude: userCoords?.lat,
          longitude: userCoords?.lng,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsOnline(!isOnline);
        toast.success(isOnline ? 'Fuera de linea' : 'En linea! Recibiras solicitudes.');
        if (!isOnline) fetchDriver();
      } else {
        toast.error(data.error || 'Error al cambiar estado');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setIsToggling(false);
    }
  }, [isOnline, session?.access_token, userCoords, fetchDriver]);

  // Update ride status via API
  const handleUpdateStatus = useCallback(async (newStatus: string) => {
    if (!activeRide || !session?.access_token) return;
    setIsUpdating(true);

    try {
      const res = await fetch('/api/rides/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ride_id: activeRide.id,
          new_status: newStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const labels: Record<string, string> = {
          arriving: 'En camino al punto de recogida',
          started: 'Viaje iniciado!',
          completed: 'Viaje completado!',
        };
        toast.success(labels[newStatus] || `Estado: ${newStatus}`);

        if (newStatus === 'arriving' || newStatus === 'started') {
          // Update local state - the Realtime subscription will also catch this
          setActiveRide((prev) => prev ? { ...prev, status: newStatus as any } : null);
        }

        if (newStatus === 'completed') {
          const earnings = activeRide.driver_earnings || Math.round(activeRide.price * 0.85);
          toast.success(`Ganaste ₡${earnings.toLocaleString()}!`);
          setTimeout(() => {
            router.push(`/driver/ride-rating?rideId=${activeRide.id}`);
          }, 1500);
          setActiveRide(null);
          setRiderProfile(null);
          fetchCompletedRides();
          fetchDriver();
        }
      } else {
        toast.error(data.error || 'Error al actualizar estado');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setIsUpdating(false);
    }
  }, [activeRide, session?.access_token, router, fetchCompletedRides, fetchDriver]);

  // Cancel ride
  const handleCancelRide = useCallback(async (reason: string) => {
    if (!activeRide || !session?.access_token) return;
    setShowCancelModal(false);

    try {
      const res = await fetch('/api/rides/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ride_id: activeRide.id,
          new_status: 'cancelled',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.info('Viaje cancelado');
        setActiveRide(null);
        setRiderProfile(null);
        fetchDriver();
      } else {
        toast.error(data.error || 'Error al cancelar');
      }
    } catch {
      toast.error('Error de conexion');
    }
  }, [activeRide, session?.access_token, fetchDriver]);

  // SOS emergency
  const handleSOS = useCallback(async () => {
    if (!session?.access_token || !activeRide) return;

    const confirmed = window.confirm('Activar alerta de emergencia SOS? Se notificara al administrador.');
    if (!confirmed) return;

    try {
      const res = await fetch('/api/sos/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ride_id: activeRide.id,
          latitude: userCoords?.lat || 9.9281,
          longitude: userCoords?.lng || -84.0907,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.error('SOS ACTIVADO - Ayuda en camino!', { duration: 10000 });
      } else {
        toast.error(data.error || 'Error al activar SOS');
      }
    } catch {
      toast.error('Error de conexion - Llama al 911');
    }
  }, [session?.access_token, activeRide, userCoords]);

  // Open phone dialer
  const handleCall = useCallback(() => {
    if (riderProfile?.phone) {
      window.open(`tel:${riderProfile.phone}`, '_self');
    } else {
      toast.info('Telefono del pasajero no disponible');
    }
  }, [riderProfile]);

  // Open navigation in Google Maps
  const handleNavigate = useCallback(() => {
    if (!activeRide) return;
    const destLat = activeRide.dest_lat;
    const destLng = activeRide.dest_lng;
    if (destLat && destLng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(activeRide.destination + ', Costa Rica')}`, '_blank');
    }
  }, [activeRide]);

  // Build map markers for active ride
  const mapMarkers: { lat: number; lng: number; label: string; color: string }[] = [];
  if (activeRide?.origin_lat && activeRide?.origin_lng) {
    mapMarkers.push({ lat: activeRide.origin_lat, lng: activeRide.origin_lng, label: 'A', color: '#10b981' });
  }
  if (activeRide?.dest_lat && activeRide?.dest_lng) {
    mapMarkers.push({ lat: activeRide.dest_lat, lng: activeRide.dest_lng, label: 'B', color: '#ef4444' });
  }

  const showRoute =
    activeRide?.origin_lat && activeRide?.origin_lng && activeRide?.dest_lat && activeRide?.dest_lng
      ? { origin: { lat: activeRide.origin_lat, lng: activeRide.origin_lng }, destination: { lat: activeRide.dest_lat, lng: activeRide.dest_lng } }
      : undefined;

  const currentAction = activeRide ? statusActions[activeRide.status] : null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Google Map */}
      <div className="relative shrink-0" style={{ height: showMap ? '45%' : '0', transition: 'height 0.3s ease' }}>
        {showMap && (
          <GoogleMap
            markers={mapMarkers}
            showRoute={showRoute}
            showDirections={!!showRoute}
            showUserLocation={true}
            className="absolute inset-0"
            height="100%"
          />
        )}
        <button
          onClick={() => setShowMap((s) => !s)}
          className="absolute bottom-3 right-3 z-10 glass-strong rounded-xl px-3 py-2 text-xs text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <MapPin className="w-3.5 h-3.5" />
          {showMap ? 'Ocultar mapa' : 'Mostrar mapa'}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Viajes</h1>
            <p className="text-sm text-gray-400 mt-1">
              {activeRide ? 'Tienes un viaje activo' : isOnline ? 'Buscando solicitudes...' : 'Conectate para recibir viajes'}
            </p>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl glass hover:bg-white/5 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-400" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
        </motion.div>

        {/* Online Toggle */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <button
            onClick={handleToggleOnline}
            disabled={isToggling || !!activeRide}
            className="w-full flex items-center gap-4 glass rounded-2xl p-4 disabled:opacity-50"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isOnline ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
              {isOnline ? <Power className="w-7 h-7 text-emerald-400" /> : <PowerOff className="w-7 h-7 text-red-400" />}
            </div>
            <div className="text-left flex-1">
              <p className="text-lg font-semibold text-white">{isOnline ? 'En Linea' : 'Fuera de Linea'}</p>
              <p className="text-xs text-gray-400">{activeRide ? 'Tienes un viaje activo' : isOnline ? 'Recibiendo solicitudes de viaje' : 'No recibirás solicitudes'}</p>
            </div>
            {isToggling ? (
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            ) : (
              <div className={`w-12 h-7 rounded-full transition-colors flex items-center ${isOnline ? 'bg-emerald-500 justify-end' : 'bg-gray-600 justify-start'}`}>
                <motion.div className="w-5 h-5 rounded-full bg-white mx-1" layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              </div>
            )}
          </button>
        </motion.div>

        {/* Active Ride */}
        <AnimatePresence>
          {activeRide && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-strong rounded-2xl p-5 space-y-4 border border-cyan-500/30 glow-cyan"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-cyan-400">Viaje Activo</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[activeRide.status] || 'bg-gray-500/20 text-gray-400'}`}>
                  {statusLabels[activeRide.status] || activeRide.status}
                </span>
              </div>

              {/* Rider Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                  {riderProfile?.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{riderProfile?.name || 'Pasajero'}</p>
                  <p className="text-xs text-gray-400">{riderProfile?.phone || 'Sin telefono'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleCall} className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors">
                    <Phone className="w-4 h-4 text-emerald-400" />
                  </button>
                  <button onClick={() => setShowChat(true)} className="p-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 transition-colors">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
              </div>

              {/* Route */}
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Origen</p>
                    <p className="text-sm text-white">{activeRide.origin}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Destino</p>
                    <p className="text-sm text-white">{activeRide.destination}</p>
                  </div>
                </div>
              </div>

              {/* Ride Info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="glass rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-500">Precio</p>
                  <p className="text-sm font-bold text-white">₡{activeRide.price.toLocaleString()}</p>
                </div>
                <div className="glass rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-500">Distancia</p>
                  <p className="text-sm font-bold text-white">{activeRide.distance || 0} km</p>
                </div>
                <div className="glass rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-500">Pasajero</p>
                  <p className="text-sm font-bold text-white flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    {riderProfile?.rating?.toFixed(1) || '5.0'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {currentAction && (
                  <button
                    onClick={() => handleUpdateStatus(currentAction.nextStatus)}
                    disabled={isUpdating}
                    className="flex-1 bg-emerald-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    {currentAction.label}
                    {currentAction.nextStatus !== 'completed' && <ArrowRight className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={handleSOS}
                  className="bg-red-500/20 border border-red-500/30 text-red-400 font-medium px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/30 transition-colors"
                >
                  <AlertTriangle className="w-5 h-5" />
                </button>
              </div>

              {/* Cancel and Navigate buttons */}
              {activeRide.status !== 'started' && (
                <div className="flex gap-2">
                  <button
                    onClick={handleNavigate}
                    className="flex-1 border border-white/10 text-gray-300 font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
                  >
                    <Navigation className="w-4 h-4" /> Navegar al origen
                  </button>
                  {(activeRide.status === 'assigned' || activeRide.status === 'arriving') && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="border border-red-500/30 text-red-400 font-medium px-4 py-2.5 rounded-xl hover:bg-red-500/10 transition-colors"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {activeRide.status === 'started' && (
                <button
                  onClick={handleNavigate}
                  className="w-full border border-white/10 text-gray-300 font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
                >
                  <Navigation className="w-4 h-4" /> Navegar al destino
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* No Active Ride - Waiting */}
        {!activeRide && isOnline && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-8 text-center">
            <div className="relative inline-block mb-4">
              <Car className="w-14 h-14 text-cyan-500/30 mx-auto" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              </div>
            </div>
            <p className="text-sm text-gray-400 font-medium">Esperando solicitudes de viaje</p>
            <p className="text-xs text-gray-600 mt-1">Los viajes apareceran automaticamente cuando un pasajero solicite uno cerca de tu ubicacion</p>
            <p className="text-[10px] text-gray-700 mt-3">Asegurate de que tu GPS este activo para recibir solicitudes cercanas</p>
          </motion.div>
        )}

        {!activeRide && !isOnline && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-8 text-center">
            <PowerOff className="w-14 h-14 text-gray-600 mx-auto mb-4" />
            <p className="text-sm text-gray-500 font-medium">Conectate para recibir solicitudes</p>
            <p className="text-xs text-gray-600 mt-1">Pasa a En Linea para empezar a recibir viajes</p>
          </motion.div>
        )}

        {/* Completed Rides History */}
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2 mb-3">
            <History className="w-4 h-4" />
            Viajes completados recientes
          </h2>

          {loadingCompleted && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            </div>
          )}

          {!loadingCompleted && completedRides.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center">
              <Car className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No tienes viajes completados aun</p>
              <p className="text-[10px] text-gray-600 mt-1">Cuando completes un viaje, aparecera aqui</p>
            </div>
          )}

          {completedRides.map((cr) => (
            <motion.div
              key={cr.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-4 space-y-2.5 mb-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-xs font-bold">
                    {cr.rider_name?.charAt(0) || <User className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{cr.rider_name || 'Pasajero'}</p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(cr.completed_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-400">₡{cr.price.toLocaleString()}</span>
                  {cr.driver_earnings && (
                    <p className="text-[10px] text-gray-500">Ganancia: ₡{cr.driver_earnings.toLocaleString()}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-gray-400">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />
                <span className="truncate">{cr.origin} → {cr.destination}</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cr.has_rated ? 'bg-gray-500/20 text-gray-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {cr.has_rated ? 'Calificado' : 'Sin calificar'}
                </span>
                {!cr.has_rated && (
                  <button
                    onClick={() => router.push(`/driver/ride-rating?rideId=${cr.id}`)}
                    className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <Star className="w-3.5 h-3.5" />
                    Calificar
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-[60]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCancelModal(false)}
            />
            <motion.div
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0d1117] border-t border-white/10 rounded-t-3xl p-6 z-[70]"
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="w-10 h-1 rounded-full bg-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-4">Cancelar Viaje</h3>
              <p className="text-sm text-gray-400 mb-4">Selecciona el motivo de cancelacion:</p>
              <div className="space-y-2">
                {['Pasajero no se presento', 'No puedo llegar al punto', 'Pasajero no responde', 'Problema con el vehiculo', 'Trafico severo', 'Otro motivo'].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => handleCancelRide(reason)}
                    className="w-full text-left px-4 py-3 rounded-xl glass hover:bg-white/5 text-sm text-gray-300 transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCancelModal(false)}
                className="w-full mt-3 py-3 rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
              >
                Volver
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Ride Chat */}
      {activeRide && activeRide.status !== 'completed' && (
        <>
          <div className="fixed bottom-20 right-3 z-40">
            <ChatToggleButton onClick={() => setShowChat(!showChat)} />
          </div>
          <RideChat
            rideId={activeRide.id}
            currentUserRole='driver'
            currentUserId={user?.id || ''}
            otherUserName={riderProfile?.name || 'Pasajero'}
            isOpen={showChat}
            onClose={() => setShowChat(false)}
          />
        </>
      )}
    </div>
  );
}

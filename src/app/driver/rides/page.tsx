'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  Power, PowerOff, MapPin, Clock, Star, Car, Navigation, AlertTriangle,
  Phone, MessageSquare, CheckCircle2, X as XIcon, ArrowRight,
} from 'lucide-react';
import GoogleMap from '@/components/GoogleMap';
import { geocodeAddress } from '@/lib/googleMaps';

interface PendingRide {
  id: string;
  riderName: string;
  origin: string;
  destination: string;
  price: number;
  distance: number;
  rating: number;
  timestamp: number;
}

interface ActiveRide {
  id: string;
  riderName: string;
  riderPhone: string;
  origin: string;
  destination: string;
  price: number;
  distance: number;
  status: 'assigned' | 'arriving' | 'started' | 'completed';
  originCoords: { lat: number; lng: number } | null;
  destCoords: { lat: number; lng: number } | null;
}

const RANDOM_NAMES = ['Ana Garcia', 'Luis Rojas', 'Maria Solano', 'Pedro Mendez', 'Laura Jimenez', 'Diego Vargas'];
const RANDOM_ORIGINS = ['Multiplaza Escazu', 'Hospital Calderon Guardia', 'C.C. La Union Central', 'Mall San Pedro', 'Plaza Roosevelt', 'Terminal 7-10'];
const RANDOM_DESTINATIONS = ['Aeropuerto SJO', 'Jaco', 'Cartago Centro', 'Heredia Centro', 'Alajuela Centro', 'Santa Ana'];

function generateRide(): PendingRide {
  return {
    id: 'R-' + Date.now().toString().slice(-6),
    riderName: RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)],
    origin: RANDOM_ORIGINS[Math.floor(Math.random() * RANDOM_ORIGINS.length)],
    destination: RANDOM_DESTINATIONS[Math.floor(Math.random() * RANDOM_DESTINATIONS.length)],
    price: Math.floor(Math.random() * 4000) + 1500,
    distance: Math.floor(Math.random() * 18) + 3,
    rating: Math.round((Math.random() * 1.5 + 3.5) * 10) / 10,
    timestamp: Date.now(),
  };
}

const statusLabels: Record<string, string> = {
  assigned: 'Asignado',
  arriving: 'En camino',
  started: 'En viaje',
  completed: 'Completado',
};

const statusColors: Record<string, string> = {
  assigned: 'bg-amber-500/20 text-amber-400',
  arriving: 'bg-blue-500/20 text-blue-400',
  started: 'bg-cyan-500/20 text-cyan-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
};

export default function DriverRides() {
  const { user } = useAuthStore();
  const [pendingRides, setPendingRides] = useState<PendingRide[]>([]);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showMap, setShowMap] = useState(true);

  // Simulate new rides every 10 seconds when online and no active ride
  useEffect(() => {
    if (!isOnline || activeRide) return;

    // Initial ride
    const initialTimer = setTimeout(() => {
      setPendingRides([generateRide()]);
    }, 2000);

    const interval = setInterval(() => {
      setPendingRides((prev) => {
        if (prev.length >= 3) return prev;
        return [...prev, generateRide()];
      });
      toast.info('Nuevo viaje disponible');
    }, 10000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isOnline, activeRide]);

  const handleAccept = useCallback(async (ride: PendingRide) => {
    setPendingRides((prev) => prev.filter((r) => r.id !== ride.id));

    // Try to geocode origin and destination for the map
    const [originCoords, destCoords] = await Promise.all([
      geocodeAddress(ride.origin + ', Costa Rica'),
      geocodeAddress(ride.destination + ', Costa Rica'),
    ]);

    setActiveRide({
      ...ride,
      riderPhone: '+506 ' + Math.floor(80000000 + Math.random() * 9999999),
      status: 'assigned',
      originCoords,
      destCoords,
    });
    toast.success('Viaje aceptado');
  }, []);

  const handleReject = useCallback((rideId: string) => {
    setPendingRides((prev) => prev.filter((r) => r.id !== rideId));
    toast.info('Viaje rechazado');
  }, []);

  const advanceStatus = useCallback(() => {
    setActiveRide((prev) => {
      if (!prev) return null;
      if (prev.status === 'assigned') return { ...prev, status: 'arriving' };
      if (prev.status === 'arriving') return { ...prev, status: 'started' };
      if (prev.status === 'started') {
        toast.success('Viaje completado! +₡' + prev.price.toLocaleString());
        return null;
      }
      return prev;
    });
  }, []);

  const completeRide = useCallback(() => {
    if (!activeRide) return;
    toast.success('Viaje completado! +₡' + activeRide.price.toLocaleString());
    setActiveRide(null);
  }, [activeRide]);

  // Build map markers for active ride
  const mapMarkers: { lat: number; lng: number; label: string; color: string }[] = [];
  if (activeRide?.originCoords) {
    mapMarkers.push({ ...activeRide.originCoords, label: 'A', color: '#10b981' });
  }
  if (activeRide?.destCoords) {
    mapMarkers.push({ ...activeRide.destCoords, label: 'B', color: '#ef4444' });
  }

  const showRoute =
    activeRide?.originCoords && activeRide.destCoords
      ? { origin: activeRide.originCoords, destination: activeRide.destCoords }
      : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Google Map — always visible at top */}
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
        {/* Toggle map button */}
        <button
          onClick={() => setShowMap((s) => !s)}
          className="absolute bottom-3 right-3 z-10 glass-strong rounded-xl px-3 py-2 text-xs text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <MapPin className="w-3.5 h-3.5" />
          {showMap ? 'Ocultar mapa' : 'Mostrar mapa'}
        </button>
      </div>

      {/* Scrollable content below map */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-white">Viajes</h1>
          <p className="text-sm text-gray-400 mt-1">
            {isOnline ? 'Estas en linea' : 'Estas fuera de linea'}
          </p>
        </motion.div>

        {/* Online Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <button
            onClick={() => setIsOnline(!isOnline)}
            className="w-full flex items-center gap-4 glass rounded-2xl p-4"
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                isOnline ? 'bg-emerald-500/20' : 'bg-red-500/20'
              }`}
            >
              {isOnline ? (
                <Power className="w-7 h-7 text-emerald-400" />
              ) : (
                <PowerOff className="w-7 h-7 text-red-400" />
              )}
            </div>
            <div className="text-left flex-1">
              <p className="text-lg font-semibold text-white">
                {isOnline ? 'En Linea' : 'Fuera de Linea'}
              </p>
              <p className="text-xs text-gray-400">
                {isOnline
                  ? 'Recibiendo solicitudes de viaje'
                  : 'No recibirás solicitudes'}
              </p>
            </div>
            <div
              className={`w-12 h-7 rounded-full transition-colors flex items-center ${
                isOnline
                  ? 'bg-emerald-500 justify-end'
                  : 'bg-gray-600 justify-start'
              }`}
            >
              <motion.div
                className="w-5 h-5 rounded-full bg-white mx-1"
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </div>
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
                <span className="text-sm font-semibold text-cyan-400">
                  Viaje Activo
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    statusColors[activeRide.status]
                  }`}
                >
                  {statusLabels[activeRide.status]}
                </span>
              </div>

              {/* Rider Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                  {activeRide.riderName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {activeRide.riderName}
                  </p>
                  <p className="text-xs text-gray-400">{activeRide.riderPhone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toast.info('Llamando al pasajero...')}
                    className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors"
                  >
                    <Phone className="w-4 h-4 text-emerald-400" />
                  </button>
                  <button
                    onClick={() => toast.info('Abriendo chat...')}
                    className="p-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
                  >
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
                  <p className="text-sm font-bold text-white">
                    ₡{activeRide.price.toLocaleString()}
                  </p>
                </div>
                <div className="glass rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-500">Distancia</p>
                  <p className="text-sm font-bold text-white">
                    {activeRide.distance} km
                  </p>
                </div>
                <div className="glass rounded-xl p-2 text-center">
                  <p className="text-xs text-gray-500">Pasajero</p>
                  <p className="text-sm font-bold text-white flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    {activeRide.rating || '4.8'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {activeRide.status === 'started' ? (
                  <button
                    onClick={completeRide}
                    className="flex-1 bg-emerald-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Completar Viaje
                  </button>
                ) : (
                  <button
                    onClick={advanceStatus}
                    className="flex-1 btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
                  >
                    {activeRide.status === 'assigned'
                      ? 'Iniciar Camino'
                      : 'Iniciar Viaje'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() =>
                    toast.error('SOS activado. Ayuda en camino.')
                  }
                  className="bg-red-500/20 border border-red-500/30 text-red-400 font-medium px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/30 transition-colors"
                >
                  <AlertTriangle className="w-5 h-5" />
                </button>
              </div>

              {activeRide.status !== 'started' && (
                <button
                  onClick={() => {
                    toast.info('Abriendo navegador...');
                  }}
                  className="w-full border border-white/10 text-gray-300 font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
                >
                  <Navigation className="w-4 h-4" /> Abrir Navegador
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending Rides */}
        {!activeRide && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-400">
              {isOnline
                ? 'Solicitudes Disponibles'
                : 'Conectate para ver solicitudes'}
            </h2>

            {pendingRides.length === 0 && isOnline && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-2xl p-8 text-center"
              >
                <Car className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Esperando solicitudes de viaje...
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Las solicitudes apareceran automaticamente
                </p>
              </motion.div>
            )}

            {pendingRides.length === 0 && !isOnline && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass rounded-2xl p-8 text-center"
              >
                <PowerOff className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Conectate para recibir solicitudes
                </p>
              </motion.div>
            )}

            <AnimatePresence>
              {pendingRides.map((ride, i) => (
                <motion.div
                  key={ride.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                        {ride.riderName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {ride.riderName}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />{' '}
                          {ride.rating}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-cyan-400">
                      ₡{ride.price.toLocaleString()}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <p className="text-xs text-gray-400">{ride.origin}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      <p className="text-xs text-gray-400">{ride.destination}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {ride.distance} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> ~{ride.distance * 3} min
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(ride.id)}
                      className="flex-1 border border-red-500/30 text-red-400 font-medium py-2.5 rounded-xl flex items-center justify-center gap-1 hover:bg-red-500/10 transition-colors"
                    >
                      <XIcon className="w-4 h-4" /> Rechazar
                    </button>
                    <button
                      onClick={() => handleAccept(ride)}
                      className="flex-1 bg-emerald-500 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-1 hover:bg-emerald-600 transition-colors"
                      style={{
                        boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Aceptar
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

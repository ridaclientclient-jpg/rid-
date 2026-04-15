'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Clock, Star, Phone, MessageSquare, Shield, AlertTriangle, X, Check, Car, Search } from 'lucide-react';
import { useRideStore } from '@/store/rideStore';
import { toast } from 'sonner';
import GoogleMap from '@/components/GoogleMap';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';

interface CoordData {
  lat: number;
  lng: number;
}

export default function ClientRide() {
  const router = useRouter();
  const { currentRide, createRide, cancelRide, completeRide, isCreating } = useRideStore();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState<CoordData | null>(null);
  const [destCoords, setDestCoords] = useState<CoordData | null>(null);
  const [rideType, setRideType] = useState<'standard' | 'premium' | 'suv'>('standard');
  const [showThirdParty, setShowThirdParty] = useState(false);

  const handleOriginChange = (val: string, _placeId?: string, lat?: number, lng?: number) => {
    setOrigin(val);
    if (lat !== undefined && lng !== undefined) {
      setOriginCoords({ lat, lng });
    }
  };

  const handleDestinationChange = (val: string, _placeId?: string, lat?: number, lng?: number) => {
    setDestination(val);
    if (lat !== undefined && lng !== undefined) {
      setDestCoords({ lat, lng });
    }
  };

  // Build marker array for the map
  const mapMarkers: { lat: number; lng: number; label: string; color: string }[] = [];
  if (originCoords) mapMarkers.push({ ...originCoords, label: 'A', color: '#10b981' });
  if (destCoords) mapMarkers.push({ ...destCoords, label: 'B', color: '#ef4444' });

  const handleCreateRide = async () => {
    if (!origin || !destination) {
      toast.error('Selecciona origen y destino');
      return;
    }
    if (origin === destination) {
      toast.error('Origen y destino no pueden ser iguales');
      return;
    }

    await createRide(
      origin, destination,
      originCoords?.lat, originCoords?.lng,
      destCoords?.lat, destCoords?.lng
    );
    toast.success('Buscando conductor...');

    // Show third party popup after a delay
    setTimeout(() => setShowThirdParty(true), 2000);
  };

  const rideTypes = [
    { id: 'standard' as const, name: 'Economico', price: '₡1,500', time: '5 min', desc: '4 pasajeros' },
    { id: 'premium' as const, name: 'Premium', price: '₡2,800', time: '3 min', desc: '4 pasajeros' },
    { id: 'suv' as const, name: 'SUV', price: '₡3,500', time: '7 min', desc: '6 pasajeros' },
  ];

  return (
    <div className="relative h-[calc(100vh-120px)] flex flex-col">
      {/* Google Map Area */}
      <div className="flex-1 relative">
        <GoogleMap
          center={{ lat: 9.7489, lng: -83.7534 }}
          zoom={13}
          markers={mapMarkers}
          showRoute={
            originCoords && destCoords
              ? { origin: originCoords, destination: destCoords }
              : undefined
          }
          showDirections={!!(originCoords && destCoords)}
          showUserLocation={true}
          className="absolute inset-0"
        />
      </div>

      {/* Ride Panel */}
      <AnimatePresence mode="wait">
        {!currentRide ? (
          <motion.div
            key="form"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl p-5 space-y-4 max-h-[70%] overflow-y-auto"
          >
            {/* Location Inputs */}
            <div className="space-y-3">
              <PlacesAutocomplete
                value={origin}
                onChange={handleOriginChange}
                placeholder="Punto de partida"
                dotColor="bg-emerald-400"
              />

              <PlacesAutocomplete
                value={destination}
                onChange={handleDestinationChange}
                placeholder="A donde vas?"
                dotColor="bg-red-400"
              />
            </div>

            {/* Ride Types */}
            <div className="space-y-2">
              {rideTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setRideType(type.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    rideType === type.id
                      ? 'glass-strong border-cyan-500/50 glow-cyan'
                      : 'glass hover:bg-white/10'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      rideType === type.id
                        ? 'bg-gradient-to-br from-blue-600 to-cyan-500'
                        : 'bg-white/10'
                    }`}
                  >
                    <Car className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white">{type.name}</p>
                    <p className="text-xs text-gray-500">
                      {type.desc} - {type.time} de espera
                    </p>
                  </div>
                  <p className="text-sm font-bold text-cyan-400">{type.price}</p>
                </button>
              ))}
            </div>

            <button
              onClick={handleCreateRide}
              disabled={isCreating || !origin || !destination}
              className="w-full btn-neon text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-lg"
            >
              {isCreating ? (
                <>
                  <Search className="w-5 h-5 animate-spin" />
                  Buscando conductor...
                </>
              ) : (
                <>
                  Pedir{' '}
                  {rideType === 'standard'
                    ? 'Economico'
                    : rideType === 'premium'
                    ? 'Premium'
                    : 'SUV'}
                </>
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="active-ride"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl p-5 space-y-4"
          >
            {/* Status Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    currentRide.status === 'searching'
                      ? 'bg-amber-400 animate-pulse'
                      : currentRide.status === 'assigned'
                      ? 'bg-blue-400 animate-pulse'
                      : currentRide.status === 'arriving'
                      ? 'bg-cyan-400 animate-pulse'
                      : currentRide.status === 'started'
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-gray-400'
                  }`}
                />
                <span className="text-sm font-semibold text-white capitalize">
                  {currentRide.status === 'searching' && 'Buscando conductor...'}
                  {currentRide.status === 'assigned' && 'Conductor asignado'}
                  {currentRide.status === 'arriving' && 'Conductor en camino'}
                  {currentRide.status === 'started' && 'Viaje en curso'}
                  {currentRide.status === 'completed' && 'Viaje completado'}
                </span>
              </div>
              {currentRide.status !== 'completed' && (
                <button
                  onClick={() => cancelRide(currentRide.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Cancelar
                </button>
              )}
            </div>

            {/* Driver Info */}
            {currentRide.status !== 'searching' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 glass rounded-xl"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold">
                  {currentRide.driver_name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    {currentRide.driver_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {currentRide.driver_vehicle}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs text-amber-400">
                      {currentRide.driver_rating}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toast.success('Llamando conductor...')}
                    className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/30"
                  >
                    <Phone className="w-4 h-4 text-emerald-400" />
                  </button>
                  <button
                    onClick={() => toast.info('Chat disponible pronto')}
                    className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center hover:bg-blue-500/30"
                  >
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Route Info */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center mt-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <div className="w-0.5 h-8 bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Origen</p>
                    <p className="text-sm text-white">{currentRide.origin}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Destino</p>
                    <p className="text-sm text-white">{currentRide.destination}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Price & Actions */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs text-gray-500">Precio estimado</p>
                <p className="text-2xl font-bold text-white">
                  ₡{currentRide.price.toLocaleString()}
                </p>
              </div>
              {currentRide.status === 'started' && (
                <button
                  onClick={() => {
                    completeRide(currentRide.id);
                    toast.success('Viaje completado!');
                  }}
                  className="btn-neon text-white font-medium px-6 py-3 rounded-xl"
                >
                  Completar
                </button>
              )}
              {currentRide.status === 'completed' && (
                <button
                  onClick={() => router.push('/client')}
                  className="btn-neon text-white font-medium px-6 py-3 rounded-xl"
                >
                  <Check className="w-4 h-4 mr-1" /> Listo
                </button>
              )}
            </div>

            {/* SOS Button */}
            {currentRide.status === 'started' && (
              <button
                onClick={() => {
                  toast.error(
                    'SOS ACTIVADO! Contactando emergencias...'
                  );
                }}
                className="w-full bg-red-500/20 border border-red-500/50 text-red-400 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/30"
              >
                <Shield className="w-5 h-5" /> SOS Emergencia
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Third Party Popup */}
      <AnimatePresence>
        {showThirdParty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="glass-strong rounded-2xl p-6 max-w-sm w-full text-center space-y-4"
            >
              <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Viaje de Tercero?</h3>
              <p className="text-sm text-gray-400">
                Este viaje parece ser para otra persona. Usted es responsable
                por la persona que viaja.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowThirdParty(false);
                    toast.success('Responsabilidad aceptada');
                  }}
                  className="w-full bg-amber-500/20 border border-amber-500/50 text-amber-400 font-medium py-3 rounded-xl"
                >
                  ACEPTO - Soy responsable
                </button>
                <button
                  onClick={() => {
                    setShowThirdParty(false);
                    if (currentRide) cancelRide(currentRide.id);
                    toast.info('Viaje cancelado');
                  }}
                  className="w-full border border-white/10 text-gray-300 py-3 rounded-xl"
                >
                  Cancelar viaje
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

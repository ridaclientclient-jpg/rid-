'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, Clock, Star, Phone, MessageSquare, Shield, AlertTriangle, X, Check, Car, Search, Bike, Truck, Package, Plus, CircleDot, Crosshair, Loader2, ChevronRight, FileText, MapPin } from 'lucide-react';
import { useRideStore } from '@/store/rideStore';
import { toast } from 'sonner';
import GoogleMap from '@/components/GoogleMap';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';
import DraggableBottomSheet from '@/components/DraggableBottomSheet';
import { reverseGeocode } from '@/lib/googleMaps';

interface CoordData {
  lat: number;
  lng: number;
}

interface Stop {
  id: string;
  address: string;
  coords: CoordData | null;
}

const STOP_LABELS = ['C', 'D', 'E', 'F', 'G', 'H'];
const STOP_COLORS = ['#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

export default function ClientRide() {
  const router = useRouter();
  const { currentRide, createRide, cancelRide, completeRide, isCreating } = useRideStore();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState<CoordData | null>(null);
  const [destCoords, setDestCoords] = useState<CoordData | null>(null);
  const [rideType, setRideType] = useState<string>('standard');
  const [showThirdParty, setShowThirdParty] = useState(false);
  const [stops, setStops] = useState<Stop[]>([]);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [userGPS, setUserGPS] = useState<{ lat: number; lng: number } | null>(null);
  const userGPSRef = useRef<{ lat: number; lng: number } | null>(null);

  // Draggable pin state
  const [pinTarget, setPinTarget] = useState<'origin' | 'destination' | null>(null);
  const [pinPosition, setPinPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [pinAddress, setPinAddress] = useState<string>('');
  const [pinGeocoding, setPinGeocoding] = useState(false);
  const pinDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Capture user GPS from map and keep it synced
  const handleMapUserLocation = useCallback((location: { lat: number; lng: number } | null) => {
    if (location) {
      setUserGPS(location);
      userGPSRef.current = location;
    }
  }, []);

  // Start pin mode — user picks a point on the map
  const startPinMode = async (target: 'origin' | 'destination') => {
    const startPos = userGPSRef.current || { lat: 9.7489, lng: -83.7534 };
    setPinTarget(target);
    setPinPosition(startPos);
    setPinGeocoding(true);
    setPinAddress('Obteniendo direccion...');
    try {
      const addr = await reverseGeocode(startPos.lat, startPos.lng);
      setPinAddress(addr || `${startPos.lat.toFixed(5)}, ${startPos.lng.toFixed(5)}`);
    } catch {
      setPinAddress(`${startPos.lat.toFixed(5)}, ${startPos.lng.toFixed(5)}`);
    }
    setPinGeocoding(false);
  };

  // Handle pin drag with debounced reverse geocoding
  const handlePinDrag = useCallback((lat: number, lng: number) => {
    setPinPosition({ lat, lng });
    setPinGeocoding(true);
    if (pinDebounceRef.current) clearTimeout(pinDebounceRef.current);
    pinDebounceRef.current = setTimeout(async () => {
      try {
        const addr = await reverseGeocode(lat, lng);
        setPinAddress(addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } catch {
        setPinAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
      setPinGeocoding(false);
    }, 400);
  }, []);

  // Confirm pin selection
  const confirmPin = () => {
    if (!pinTarget || !pinPosition || !pinAddress) return;
    if (pinTarget === 'origin') {
      setOrigin(pinAddress);
      setOriginCoords(pinPosition);
    } else {
      setDestination(pinAddress);
      setDestCoords(pinPosition);
    }
    setPinTarget(null);
    setPinPosition(null);
    setPinAddress('');
    toast.success(`${pinTarget === 'origin' ? 'Origen' : 'Destino'} seleccionado en el mapa`);
  };

  const cancelPinMode = () => {
    setPinTarget(null);
    setPinPosition(null);
    setPinAddress('');
  };

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

  // Use my location as origin
  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('GPS no disponible en este dispositivo');
      return;
    }
    setGettingLocation(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 15000, maximumAge: 60000
        });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const address = await reverseGeocode(lat, lng);
      const displayAddress = address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setOrigin(displayAddress);
      setOriginCoords({ lat, lng });
      toast.success('Ubicacion actual establecida');
    } catch {
      toast.error('No se pudo obtener tu ubicacion. Verifica que el GPS este habilitado.');
    } finally {
      setGettingLocation(false);
    }
  };

  // Add a new intermediate stop
  const addStop = () => {
    if (stops.length >= 6) {
      toast.error('Maximo 6 paradas intermedias');
      return;
    }
    setStops([...stops, { id: 'stop-' + Date.now(), address: '', coords: null }]);
  };

  // Update a stop's address and coords
  const updateStop = (stopId: string, address: string, _placeId?: string, lat?: number, lng?: number) => {
    setStops(stops.map(s => {
      if (s.id === stopId) {
        return {
          ...s,
          address,
          coords: lat !== undefined && lng !== undefined ? { lat, lng } : null,
        };
      }
      return s;
    }));
  };

  // Remove a stop
  const removeStop = (stopId: string) => {
    setStops(stops.filter(s => s.id !== stopId));
  };

  // Build marker array for the map — use currentRide data when active, local state when filling form
  const mapMarkers: { lat: number; lng: number; label: string; color: string }[] = [];
  const activeRideOrigin = currentRide?.origin_lat && currentRide?.origin_lng
    ? { lat: currentRide.origin_lat, lng: currentRide.origin_lng }
    : null;
  const activeRideDest = currentRide?.dest_lat && currentRide?.dest_lng
    ? { lat: currentRide.dest_lat, lng: currentRide.dest_lng }
    : null;
  const activeWaypoints = (currentRide?.stops || [])
    .filter((s: any) => s.lat && s.lng)
    .map((s: any) => ({ lat: s.lat, lng: s.lng }));

  const mapOrigin = currentRide ? activeRideOrigin : originCoords;
  const mapDest = currentRide ? activeRideDest : destCoords;
  const mapWaypoints = currentRide ? activeWaypoints : stops.filter(s => s.coords).map(s => ({ lat: s.coords!.lat, lng: s.coords!.lng }));

  if (mapOrigin) mapMarkers.push({ ...mapOrigin, label: 'A', color: '#10b981' });
  if (currentRide) {
    (currentRide.stops || []).forEach((stop: any, i: number) => {
      if (stop.lat && stop.lng) {
        mapMarkers.push({ lat: stop.lat, lng: stop.lng, label: STOP_LABELS[i], color: STOP_COLORS[i] });
      }
    });
  } else {
    stops.forEach((stop, i) => {
      if (stop.coords) {
        mapMarkers.push({ ...stop.coords, label: STOP_LABELS[i], color: STOP_COLORS[i] });
      }
    });
  }
  if (mapDest) mapMarkers.push({ ...mapDest, label: 'B', color: '#ef4444' });

  const handleCreateRide = async () => {
    if (!origin || !destination) {
      toast.error('Selecciona origen y destino');
      return;
    }
    if (origin === destination) {
      toast.error('Origen y destino no pueden ser iguales');
      return;
    }
    // Check that all stops have addresses
    const emptyStop = stops.find(s => !s.address);
    if (emptyStop) {
      toast.error('Completa todas las paradas intermedias o eliminalas');
      return;
    }

    const stopsData = stops.map(s => ({
      address: s.address,
      lat: s.coords?.lat,
      lng: s.coords?.lng,
    }));

    try {
      const rideId = await createRide(
        origin, destination,
        originCoords?.lat, originCoords?.lng,
        destCoords?.lat, destCoords?.lng,
        rideType, stopsData
      );
      if (rideId) {
        toast.success('Viaje creado! Buscando conductor...');
        // Show third party popup after a delay
        setTimeout(() => setShowThirdParty(true), 2000);
      } else {
        toast.error('No se pudo crear el viaje. Intenta de nuevo.');
      }
    } catch (error: any) {
      console.error('Ride creation failed:', error);
      toast.error('Error al crear viaje: ' + (error?.message || 'Intenta de nuevo'));
    }
  };

  const rideTypes = [
    { id: 'standard', name: 'Economico', price: '₡1,500', time: '5 min', desc: '4 pasajeros', icon: Car, color: 'from-blue-600 to-cyan-500' },
    { id: 'premium', name: 'Premium', price: '₡2,400', time: '3 min', desc: '4 pasajeros', icon: Car, color: 'from-purple-600 to-pink-500' },
    { id: 'suv', name: 'SUV', price: '₡3,150', time: '7 min', desc: '6 pasajeros', icon: Car, color: 'from-amber-600 to-orange-500' },
    { id: 'moto', name: 'Moto', price: '₡1,050', time: '2 min', desc: '1 pasajero', icon: Bike, color: 'from-green-600 to-emerald-500' },
    { id: 'moto_express', name: 'Moto Express', price: '₡1,350', time: '1 min', desc: '1 pasajero - Envios', icon: Bike, color: 'from-red-600 to-rose-500' },
    { id: 'grua', name: 'Grua', price: '₡4,500', time: '15 min', desc: 'Servicio de grua', icon: Truck, color: 'from-yellow-600 to-amber-500' },
    { id: 'flete', name: 'Carro de Carga (Flete)', price: '₡5,250', time: '20 min', desc: 'Carga pesada', icon: Package, color: 'from-indigo-600 to-violet-500' },
  ];

  return (
    <div className="relative h-[calc(100vh-120px)] flex flex-col overflow-hidden">
      {/* Google Map Area — full screen behind the sheet */}
      <div className="absolute inset-0">
        <GoogleMap
          center={mapOrigin && mapDest ? mapOrigin : undefined}
          zoom={mapOrigin && mapDest ? 13 : undefined}
          markers={mapMarkers}
          waypoints={mapWaypoints.length > 0 ? mapWaypoints : undefined}
          showRoute={
            mapOrigin && mapDest
              ? { origin: mapOrigin, destination: mapDest }
              : undefined
          }
          showDirections={!!(mapOrigin && mapDest)}
          draggablePin={pinTarget && pinPosition ? { position: pinPosition, color: pinTarget === 'origin' ? '#10b981' : '#ef4444' } : null}
          onDraggablePinMove={handlePinDrag}
          showUserLocation={true}
          onUserLocation={handleMapUserLocation}
          className="absolute inset-0"
          height="100%"
        />
      </div>

      {/* Ride Panel — Draggable Bottom Sheet */}
      <DraggableBottomSheet
        initialSnap="peek"
        minHeight={140}
        className="glass-strong rounded-t-3xl"
      >
        <div className="p-5 space-y-4">
        {!currentRide ? (
          <>
            {/* Location Inputs */}
            <div className="space-y-2">
              {/* Use My Location Button */}
              <button
                onClick={useMyLocation}
                disabled={gettingLocation}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl glass hover:bg-white/10 transition-all text-left disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  {gettingLocation ? (
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : (
                    <Crosshair className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-400">
                    {gettingLocation ? 'Obteniendo ubicacion...' : 'Mi ubicacion'}
                  </p>
                  <p className="text-[10px] text-gray-500">Usar posicion actual como punto de partida</p>
                </div>
              </button>

              {/* Set on map buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => startPinMode('origin')}
                  disabled={!!currentRide}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl glass hover:bg-white/10 transition-all text-left disabled:opacity-50"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs text-gray-300">Origen en mapa</span>
                </button>
                <button
                  onClick={() => startPinMode('destination')}
                  disabled={!!currentRide}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl glass hover:bg-white/10 transition-all text-left disabled:opacity-50"
                >
                  <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-xs text-gray-300">Destino en mapa</span>
                </button>
              </div>

              {/* Origin */}
              <PlacesAutocomplete
                value={origin}
                onChange={handleOriginChange}
                placeholder="O escribe una direccion de partida"
                dotColor="bg-emerald-400"
                userLocation={userGPS}
                searchRadius={50000}
              />

              {/* Intermediate Stops */}
              <AnimatePresence>
                {stops.map((stop, index) => (
                  <motion.div
                    key={stop.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative"
                  >
                    {/* Stop label + remove button */}
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STOP_COLORS[index] }} />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Parada {index + 1}
                        </span>
                      </div>
                      <button
                        onClick={() => removeStop(stop.id)}
                        className="ml-auto p-1 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <PlacesAutocomplete
                      value={stop.address}
                      onChange={(val, placeId, lat, lng) => updateStop(stop.id, val, placeId, lat, lng)}
                      placeholder={`Parada intermedia ${index + 1}`}
                      dotColor=""
                      userLocation={userGPS}
                      searchRadius={50000}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Add Stop Button */}
              {stops.length < 6 && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={addStop}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-white/10 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-medium">Agregar parada</span>
                </motion.button>
              )}

              {/* Destination */}
              <PlacesAutocomplete
                value={destination}
                onChange={handleDestinationChange}
                placeholder="A donde vas?"
                dotColor="bg-red-400"
                userLocation={userGPS}
                searchRadius={50000}
              />
            </div>

            {/* Stops summary */}
            {stops.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CircleDot className="w-3 h-3" />
                <span>{stops.length + 2} puntos en la ruta</span>
              </div>
            )}

            {/* Ride Types */}
            <div className="space-y-2">
              {rideTypes.map((type) => {
                const TypeIcon = type.icon;
                return (
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
                          ? `bg-gradient-to-br ${type.color}`
                          : 'bg-white/10'
                      }`}
                    >
                      <TypeIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-white">{type.name}</p>
                      <p className="text-xs text-gray-500">
                        {type.desc} - {type.time} de espera
                      </p>
                    </div>
                    <p className="text-sm font-bold text-cyan-400">{type.price}</p>
                  </button>
                );
              })}
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
                  Pedir {rideTypes.find(t => t.id === rideType)?.name || 'Economico'}
                </>
              )}
            </button>
          </>
        ) : (
          <>
            {/* Active Ride Content */}
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
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-xs text-amber-400">
                        {currentRide.driver_rating}
                      </span>
                    </div>
                    {(currentRide as any).driver_distance != null && (
                      <div className="flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        <span className="text-xs text-cyan-400">
                          {(currentRide as any).driver_distance} km
                        </span>
                      </div>
                    )}
                    {(currentRide as any).driver_eta != null && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs text-emerald-400">
                          {(currentRide as any).driver_eta} min
                        </span>
                      </div>
                    )}
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
                  <div className="w-0.5 h-4 bg-white/10" />
                  {/* Show intermediate stops dots */}
                  {currentRide.stops && currentRide.stops.length > 0 && currentRide.stops.map((stop: any, i: number) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STOP_COLORS[i] }} />
                      <div className="w-0.5 h-4 bg-white/10" />
                    </div>
                  ))}
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Origen</p>
                    <p className="text-sm text-white">{currentRide.origin}</p>
                  </div>
                  {/* Show intermediate stops */}
                  {currentRide.stops && currentRide.stops.length > 0 && currentRide.stops.map((stop: any, i: number) => (
                    <div key={i}>
                      <p className="text-xs text-gray-500">Parada {i + 1}</p>
                      <p className="text-sm text-white">{stop.address}</p>
                    </div>
                  ))}
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
                  onClick={() => router.push(`/client/ride/${currentRide.id}`)}
                  className="btn-neon text-white font-medium px-6 py-3 rounded-xl"
                >
                  <Check className="w-4 h-4 mr-1" /> Ver Detalles
                </button>
              )}
            </div>

            {/* View Details Button (non-completed rides) */}
            {currentRide.status !== 'completed' && currentRide.status !== 'searching' && (
              <button
                onClick={() => router.push(`/client/ride/${currentRide.id}`)}
                className="w-full flex items-center justify-center gap-2 glass rounded-xl p-2.5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <FileText className="w-4 h-4" />
                <span className="text-xs font-medium">Ver detalles del viaje</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}

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
          </>
        )}
        </div>
      </DraggableBottomSheet>

      {/* Pin Selection Overlay */}
      <AnimatePresence>
        {pinTarget && pinPosition && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-44 left-4 right-4 z-30"
          >
            <div className="glass-strong rounded-2xl p-4 space-y-3 border border-white/10">
              <div className="flex items-center gap-2">
                <MapPin className={`w-4 h-4 ${pinTarget === 'origin' ? 'text-emerald-400' : 'text-red-400'}`} />
                <span className="text-xs font-semibold text-white">
                  {pinTarget === 'origin' ? 'Punto de recogida' : 'Destino'}
                </span>
                <span className="text-[10px] text-gray-500 ml-auto">Arrastra el pin</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${pinGeocoding ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                <p className="text-sm text-white flex-1">
                  {pinGeocoding ? 'Obteniendo direccion...' : pinAddress}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmPin}
                  disabled={pinGeocoding}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Confirmar
                </button>
                <button
                  onClick={cancelPinMode}
                  className="px-5 glass text-gray-300 text-sm font-medium py-2.5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
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

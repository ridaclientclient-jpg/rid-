'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, Car, MapPin, Users, Navigation, Loader2,
  RefreshCw, ZoomIn, ZoomOut, Crosshair, Maximize2, Filter,
  Activity, Clock, TrendingUp, X, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { loadGoogleMaps } from '@/lib/googleMaps';

/* ─── Types ────────────────────────────────────────────────── */
interface DriverLocation {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  is_online: boolean;
  updated_at: string;
  driver_name?: string;
  driver_plate?: string;
  driver_status?: string;
}

interface ActiveTrip {
  id: string;
  rider_id: string;
  driver_id: string;
  status: string;
  origin: string;
  destination: string;
  price: number;
  created_at: string;
  rider_name?: string;
  driver_name?: string;
}

const CR_CENTER = { lat: 9.9281, lng: -84.0907 };

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function GodsViewPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const driverMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const tripMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshInterval, setRefreshInterval] = useState(15);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showTrips, setShowTrips] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);
  const [statsPanelOpen, setStatsPanelOpen] = useState(true);

  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ─── Fetch Data ──────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      // Fetch driver locations (online drivers)
      const { data: locations, error: locError } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('is_online', true)
        .order('updated_at', { ascending: false });

      if (locError) {
        console.warn('driver_locations query error:', locError.message);
        // Fallback: fetch drivers with online/busy status
        const { data: onlineDrivers, error: drvError } = await supabase
          .from('drivers')
          .select('id, user_id, status, current_latitude, current_longitude')
          .in('status', ['online', 'busy']);

        if (!drvError && onlineDrivers) {
          const driverIds = onlineDrivers.map(d => d.user_id).filter(Boolean);
          const profileMap: Record<string, string> = {};
          if (driverIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', driverIds);
            if (profiles) profiles.forEach(p => { profileMap[p.id] = p.name; });
          }

          const locs: DriverLocation[] = onlineDrivers
            .filter(d => d.current_latitude && d.current_longitude)
            .map(d => ({
              id: d.id,
              driver_id: d.id,
              latitude: d.current_latitude,
              longitude: d.current_longitude,
              heading: 0,
              speed: 0,
              is_online: true,
              updated_at: new Date().toISOString(),
              driver_name: profileMap[d.user_id || ''] || 'Conductor',
              driver_status: d.status,
            }));
          setDrivers(locs);
        }
      } else {
        // Enrich with driver names
        const driverIds = (locations || []).map(l => l.driver_id);
        const driverMap: Record<string, { name: string; plate: string; status: string }> = {};
        if (driverIds.length > 0) {
          const { data: driverRecords } = await supabase
            .from('drivers')
            .select('id, user_id, status')
            .in('id', driverIds);
          if (driverRecords) {
            const userIds = driverRecords.map(d => d.user_id).filter(Boolean);
            const profileMap: Record<string, string> = {};
            if (userIds.length > 0) {
              const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', userIds);
              if (profiles) profiles.forEach(p => { profileMap[p.id] = p.name; });
            }
            const drvUserMap: Record<string, string> = {};
            driverRecords.forEach(d => { drvUserMap[d.id] = d.user_id; });
            driverRecords.forEach(d => {
              driverMap[d.id] = {
                name: profileMap[drvUserMap[d.id] || ''] || 'Conductor',
                plate: '',
                status: d.status || 'online',
              };
            });
          }
        }

        const enriched: DriverLocation[] = (locations || []).map(l => ({
          ...l,
          driver_name: driverMap[l.driver_id]?.name || 'Conductor',
          driver_status: driverMap[l.driver_id]?.status || 'online',
        }));

        setDrivers(enriched);
      }

      // Fetch active trips
      const { data: trips, error: tripError } = await supabase
        .from('rides')
        .select('*')
        .in('status', ['pending', 'searching', 'assigned', 'arriving', 'started', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (!tripError && trips) {
        // Enrich with names
        const riderIds = [...new Set(trips.map(t => t.rider_id).filter(Boolean))];
        const dIds = [...new Set(trips.map(t => t.driver_id).filter(Boolean))];
        const profileMap: Record<string, string> = {};
        const driverNameMap: Record<string, string> = {};

        if (riderIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', riderIds);
          if (profiles) profiles.forEach(p => { profileMap[p.id] = p.name; });
        }
        if (dIds.length > 0) {
          const { data: dRecords } = await supabase.from('drivers').select('id, user_id').in('id', dIds);
          if (dRecords) {
            const dUserIds = dRecords.map(d => d.user_id).filter(Boolean);
            if (dUserIds.length > 0) {
              const { data: dProfiles } = await supabase.from('profiles').select('id, name').in('id', dUserIds);
              if (dProfiles) {
                const dMap: Record<string, string> = {};
                dProfiles.forEach(p => { dMap[p.id] = p.name; });
                dRecords.forEach(d => { driverNameMap[d.id] = dMap[d.user_id || ''] || 'Conductor'; });
              }
            }
          }
        }

        const enrichedTrips: ActiveTrip[] = trips.map(t => ({
          id: t.id,
          rider_id: t.rider_id,
          driver_id: t.driver_id,
          status: t.status,
          origin: t.origin || t.origin_address || '-',
          destination: t.destination || t.dest_address || '-',
          price: t.price || 0,
          created_at: t.created_at,
          rider_name: profileMap[t.rider_id] || 'Pasajero',
          driver_name: driverNameMap[t.driver_id || ''] || 'Sin asignar',
        }));
        setActiveTrips(enrichedTrips);
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching God View data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── Auto Refresh ────────────────────────────────────── */
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshTimerRef.current = setInterval(fetchData, refreshInterval * 1000);
    }
    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
    };
  }, [autoRefresh, refreshInterval, fetchData]);

  /* ─── Initialize Map ──────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current) return;

    loadGoogleMaps()
      .then((google) => {
        if (!mapRef.current) return;

        const darkMapStyle: google.maps.MapTypeStyle[] = [
          { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#26465e' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
          { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
          { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
          { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
          { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb5' }] },
        ];

        const map = new google.maps.Map(mapRef.current, {
          center: CR_CENTER,
          zoom: 12,
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: 'greedy',
        });

        infoWindowRef.current = new google.maps.InfoWindow();
        mapInstanceRef.current = map;
        setMapLoading(false);
      })
      .catch((err) => {
        console.error('Map load error:', err);
        setMapLoading(false);
      });

    return () => {
      driverMarkersRef.current.forEach(m => m.setMap(null));
      tripMarkersRef.current.forEach(m => m.setMap(null));
      driverMarkersRef.current.clear();
      tripMarkersRef.current.clear();
      if (infoWindowRef.current) infoWindowRef.current.close();
      if (mapInstanceRef.current) mapInstanceRef.current = null;
    };
  }, []);

  /* ─── Render Driver Markers ───────────────────────────── */
  useEffect(() => {
    if (!mapInstanceRef.current || mapLoading) return;

    const google = window as any;
    if (!google.google?.maps) return;

    // Clear existing driver markers
    driverMarkersRef.current.forEach(m => m.setMap(null));
    driverMarkersRef.current.clear();

    if (!showDrivers) return;

    drivers.forEach(driver => {
      if (!driver.latitude || !driver.longitude) return;

      // SVG icon for driver
      const isBusy = driver.driver_status === 'busy';
      const color = isBusy ? '#f59e0b' : '#06b6d4';

      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <defs>
          <filter id="ds${driver.id.slice(0,6)}" x="-30%" y="-20%" width="160%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/>
          </filter>
        </defs>
        <path d="M16 2C8.268 2 2 8.268 2 16c0 10 14 22 14 22s14-12 14-22C30 8.268 23.732 2 16 2z" fill="${color}" filter="url(#ds${driver.id.slice(0,6)})"/>
        <circle cx="16" cy="15" r="8" fill="rgba(255,255,255,0.2)"/>
        <text x="16" y="19" text-anchor="middle" font-size="10" font-weight="bold" fill="#fff" font-family="system-ui">C</text>
      </svg>`;

      const marker = new google.google.maps.Marker({
        map: mapInstanceRef.current,
        position: { lat: driver.latitude, lng: driver.longitude },
        title: driver.driver_name || 'Conductor',
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
          scaledSize: new google.google.maps.Size(32, 40),
          anchor: new google.google.maps.Point(16, 40),
        },
        zIndex: isBusy ? 100 : 200,
      });

      marker.addListener('click', () => {
        if (infoWindowRef.current && mapInstanceRef.current) {
          const lastSeen = new Date(driver.updated_at);
          const minsAgo = Math.round((Date.now() - lastSeen.getTime()) / 60000);
          infoWindowRef.current.setContent(`
            <div style="padding: 8px; color: #1a1a1a; font-family: system-ui; min-width: 180px;">
              <strong style="font-size: 13px;">${driver.driver_name || 'Conductor'}</strong><br/>
              <span style="font-size: 11px; color: #666;">
                ${driver.driver_status === 'busy' ? '🟡 Ocupado' : '🟢 Disponible'}
              </span><br/>
              <span style="font-size: 11px; color: #999;">
                ${driver.speed ? `Velocidad: ${Math.round(driver.speed)} km/h` : ''}
                ${minsAgo < 60 ? ` | Actualizado: ${minsAgo} min atras` : ` | Actualizado: ${Math.round(minsAgo / 60)}h atras`}
              </span>
            </div>
          `);
          infoWindowRef.current.open(mapInstanceRef.current, marker);
          setSelectedDriver(driver);
        }
      });

      driverMarkersRef.current.set(driver.id, marker);
    });

    // Fit bounds to show all drivers
    if (drivers.length > 0 && mapInstanceRef.current) {
      const bounds = new google.google.maps.LatLngBounds();
      drivers.forEach(d => {
        if (d.latitude && d.longitude) {
          bounds.extend(new google.google.maps.LatLng(d.latitude, d.longitude));
        }
      });
      if (!bounds.isEmpty()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: 60 });
      }
    }
  }, [drivers, mapLoading, showDrivers]);

  /* ─── Render Trip Markers ─────────────────────────────── */
  useEffect(() => {
    if (!mapInstanceRef.current || mapLoading) return;

    const google = window as any;
    if (!google.google?.maps) return;

    tripMarkersRef.current.forEach(m => m.setMap(null));
    tripMarkersRef.current.clear();

    if (!showTrips) return;

    activeTrips.forEach(trip => {
      // Origin marker
      const origIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
        <circle cx="10" cy="10" r="8" fill="#10b981" stroke="#fff" stroke-width="2"/>
        <path d="M10 18 L7 26 L10 24 L13 26 Z" fill="#10b981"/>
      </svg>`;

      const origMarker = new google.google.maps.Marker({
        map: mapInstanceRef.current,
        position: { lat: 9.93, lng: -84.08 }, // Will use trip data if available
        title: `Origen: ${trip.origin}`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(origIcon),
          scaledSize: new google.google.maps.Size(20, 28),
          anchor: new google.google.maps.Point(10, 28),
        },
        zIndex: 50,
        visible: false, // Only show if we have coordinates
      });

      origMarker.addListener('click', () => {
        if (infoWindowRef.current && mapInstanceRef.current) {
          infoWindowRef.current.setContent(`
            <div style="padding: 8px; color: #1a1a1a; font-family: system-ui;">
              <strong style="font-size: 12px;">Viaje #${trip.id.slice(0, 8).toUpperCase()}</strong><br/>
              <span style="font-size: 11px; color: #10b981;">Origen:</span> ${trip.origin}<br/>
              <span style="font-size: 11px; color: #ef4444;">Destino:</span> ${trip.destination}<br/>
              <span style="font-size: 11px; color: #666;">Pasajero: ${trip.rider_name}</span><br/>
              <span style="font-size: 11px; color: #666;">Conductor: ${trip.driver_name}</span>
            </div>
          `);
          infoWindowRef.current.open(mapInstanceRef.current, origMarker);
        }
      });

      tripMarkersRef.current.set(`orig-${trip.id}`, origMarker);
    });
  }, [activeTrips, mapLoading, showTrips]);

  /* ─── Map Controls ────────────────────────────────────── */
  const zoomIn = () => { if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) + 1); };
  const zoomOut = () => { if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) - 1); };
  const fitAll = () => {
    if (!mapInstanceRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    driverMarkersRef.current.forEach(m => {
      const pos = m.getPosition();
      if (pos) bounds.extend(pos);
    });
    if (!bounds.isEmpty()) mapInstanceRef.current.fitBounds(bounds, { padding: 60 });
  };
  const resetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(CR_CENTER);
      mapInstanceRef.current.setZoom(12);
    }
  };

  const onlineCount = drivers.length;
  const busyCount = drivers.filter(d => d.driver_status === 'busy').length;
  const activeTripsCount = activeTrips.length;

  /* ─── Render ──────────────────────────────────────────── */
  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Eye className="w-7 h-7 text-cyan-400" />
            God&apos;s View
          </h1>
          <p className="text-gray-400 mt-1">Vista en tiempo real de conductores y viajes activos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            className="px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all text-xs font-medium flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative rounded-2xl overflow-hidden glass" style={{ minHeight: '400px' }}>
        <div ref={mapRef} className="absolute inset-0" />

        {mapLoading && (
          <div className="absolute inset-0 bg-rida-dark/80 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Cargando mapa...</p>
            </div>
          </div>
        )}

        {/* Stats Panel */}
        <motion.div
          className="absolute top-4 left-4 z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="glass-strong rounded-xl p-4 min-w-[200px] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                En Vivo
              </h3>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400">LIVE</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-500">Conductores</p>
                <p className="text-lg font-bold text-cyan-400">{onlineCount}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-500">Ocupados</p>
                <p className="text-lg font-bold text-amber-400">{busyCount}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-500">Viajes Activos</p>
                <p className="text-lg font-bold text-emerald-400">{activeTripsCount}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5">
                <p className="text-[10px] text-gray-500">Disponibles</p>
                <p className="text-lg font-bold text-white">{onlineCount - busyCount}</p>
              </div>
            </div>

            {/* Auto Refresh Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Auto-refresh: {refreshInterval}s
              </span>
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-all ${
                  autoRefresh ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-gray-500'
                }`}
              >
                {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Show/Hide Toggles */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowDrivers(!showDrivers)}
                className={`w-full flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg transition-all ${
                  showDrivers ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/5 text-gray-500'
                }`}
              >
                <Car className="w-3 h-3" />
                Conductores ({onlineCount})
              </button>
              <button
                type="button"
                onClick={() => setShowTrips(!showTrips)}
                className={`w-full flex items-center gap-2 text-[10px] px-2 py-1.5 rounded-lg transition-all ${
                  showTrips ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-500'
                }`}
              >
                <Navigation className="w-3 h-3" />
                Viajes Activos ({activeTripsCount})
              </button>
            </div>

            {/* Last Refresh */}
            <div className="text-center">
              <p className="text-[10px] text-gray-600">
                Ultima actualizacion: {lastRefresh.toLocaleTimeString('es-CR')}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Active Trips List */}
        {activeTrips.length > 0 && (
          <motion.div
            className="absolute top-4 right-4 z-10 glass-strong rounded-xl max-w-[280px] max-h-[60vh] overflow-hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="p-3 border-b border-white/10">
              <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Viajes en Curso ({activeTrips.length})
              </h4>
            </div>
            <div className="overflow-y-auto max-h-[45vh] p-2 space-y-1.5">
              {activeTrips.slice(0, 20).map(trip => (
                <div key={trip.id} className="bg-white/5 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-cyan-400 font-mono">#{trip.id.slice(0, 8).toUpperCase()}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      ['started', 'in_progress'].includes(trip.status)
                        ? 'bg-cyan-500/15 text-cyan-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {trip.status === 'started' || trip.status === 'in_progress' ? 'En curso' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate">
                    <span className="text-emerald-400">De:</span> {trip.origin}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    <span className="text-red-400">A:</span> {trip.destination}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-500">
                    <span>{trip.rider_name}</span>
                    <span className="text-emerald-400 font-medium">₡{(trip.price || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Map Controls */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
          <button type="button" onClick={zoomIn} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button type="button" onClick={zoomOut} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-white/10 my-1" />
          <button type="button" onClick={fitAll} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Ajustar a conductores">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={resetView} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Vista central">
            <Crosshair className="w-4 h-4" />
          </button>
        </div>

        {/* No Data Message */}
        {!loading && drivers.length === 0 && activeTrips.length === 0 && !mapLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-5 pointer-events-none">
            <div className="glass-strong rounded-2xl p-8 text-center pointer-events-auto">
              <Eye className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Sin datos en tiempo real</p>
              <p className="text-xs text-gray-600 mt-1">
                No hay conductores conectados ni viajes activos.
                <br />
                Los datos aparecen cuando los conductores estan en linea.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

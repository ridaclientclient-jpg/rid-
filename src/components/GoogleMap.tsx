'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { MapPin, Crosshair, Navigation } from 'lucide-react';

interface MarkerData {
  lat: number;
  lng: number;
  label?: string;
  icon?: string;
  color?: string;
  animation?: 'BOUNCE' | 'DROP';
}

interface GoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerData[];
  onMapClick?: (lat: number, lng: number) => void;
  onMapLoaded?: (map: google.maps.Map) => void;
  showRoute?: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } };
  waypoints?: { lat: number; lng: number }[];
  showDirections?: boolean;
  className?: string;
  style?: React.CSSProperties;
  showUserLocation?: boolean;
  height?: string;
}

// Costa Rica center default
const CR_CENTER = { lat: 9.7489, lng: -83.7534 };

export default function GoogleMap({
  center = CR_CENTER,
  zoom = 12,
  markers = [],
  onMapClick,
  onMapLoaded,
  showRoute,
  waypoints = [],
  showDirections = false,
  className = '',
  style = {},
  showUserLocation = true,
  height = '100%',
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const directionsRendererRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const userMarkerRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'searching' | 'found' | 'denied' | 'unavailable'>('searching');

  const addUserMarker = useCallback((google: typeof window.google, map: google.maps.Map, position: { lat: number; lng: number }) => {
    // Remove old marker
    if (userMarkerRef.current) {
      try { userMarkerRef.current.map = null; } catch {}
      userMarkerRef.current = null;
    }

    try {
      const { AdvancedMarkerElement } = google.maps.marker;
      const pinElement = document.createElement('div');
      pinElement.style.cssText = `
        width: 20px; height: 20px; border-radius: 50%;
        background: #06b6d4; border: 3px solid #fff;
        box-shadow: 0 0 14px rgba(6,182,212,0.7), 0 0 40px rgba(6,182,212,0.3);
        animation: pulse-ring 2s ease-out infinite;
      `;
      const userMarker = new AdvancedMarkerElement({
        map,
        position,
        title: 'Tu ubicacion',
        content: pinElement,
      });
      userMarkerRef.current = userMarker;
    } catch {
      // Fallback to basic marker
      const m = new google.maps.Marker({
        map,
        position,
        title: 'Tu ubicacion',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#06b6d4',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
          scale: 10,
        },
        zIndex: 1000,
      });
      userMarkerRef.current = m;
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    // Cleanup previous
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    loadGoogleMaps()
      .then((google) => {
        if (!mapRef.current) return;

        // Dark map styles matching RIDA theme
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
          center,
          zoom,
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        });

        mapInstanceRef.current = map;
        setIsLoaded(true);

        // Get user location with watchPosition (continuous)
        if (showUserLocation && navigator.geolocation) {
          setLocationStatus('searching');

          watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
              const userPos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              setUserLocation(userPos);
              setLocationStatus('found');

              if (mapInstanceRef.current) {
                mapInstanceRef.current.setCenter(userPos);
                mapInstanceRef.current.setZoom(14);
              }

              addUserMarker(google, map, userPos);
            },
            (error) => {
              console.warn('Geolocation error:', error.message, error.code);
              if (error.code === 1) {
                setLocationStatus('denied');
              } else {
                setLocationStatus('unavailable');
              }
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 60000,
            }
          );
        } else if (!navigator.geolocation) {
          setLocationStatus('unavailable');
        }

        // Map click handler
        if (onMapClick) {
          map.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) {
              onMapClick(e.latLng.lat(), e.latLng.lng());
            }
          });
        }

        if (onMapLoaded) onMapLoaded(map);
      })
      .catch(() => {
        setHasError(true);
      });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
        markersRef.current = [];
        userMarkerRef.current = null;
      }
      setUserLocation(null);
      setLocationStatus('searching');
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    markersRef.current.forEach((m) => {
      try { m.map = null; } catch {}
    });
    markersRef.current = [];

    loadGoogleMaps().then((google) => {
      markers.forEach((markerData) => {
        try {
          const { AdvancedMarkerElement, PinElement } = google.maps.marker;
          const pin = new PinElement({
            background: markerData.color || '#06b6d4',
            glyph: markerData.label || '',
            glyphColor: '#fff',
            scale: 1.2,
          });
          const marker = new AdvancedMarkerElement({
            map: mapInstanceRef.current!,
            position: { lat: markerData.lat, lng: markerData.lng },
            title: markerData.label,
            content: pin.element,
          });
          markersRef.current.push(marker);
        } catch {
          new google.maps.Marker({
            map: mapInstanceRef.current,
            position: { lat: markerData.lat, lng: markerData.lng },
            title: markerData.label,
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              fillColor: markerData.color || '#06b6d4',
              fillOpacity: 1,
              scale: 5,
            },
          });
        }
      });
    });
  }, [markers, isLoaded]);

  // Show directions
  useEffect(() => {
    if (!mapInstanceRef.current || !showRoute || !showDirections || !isLoaded) return;

    loadGoogleMaps().then((google) => {
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map: mapInstanceRef.current!,
        polylineOptions: {
          strokeColor: '#06b6d4',
          strokeWeight: 4,
          strokeOpacity: 0.8,
        },
        suppressMarkers: false,
        markerOptions: {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#06b6d4',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 6,
          },
        },
      });

      directionsRendererRef.current = directionsRenderer;

      directionsService.route(
        {
          origin: showRoute.origin,
          destination: showRoute.destination,
          waypoints: waypoints.map(wp => ({ location: wp, stopover: true })),
          optimizeWaypoints: false,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK' && result) {
            directionsRenderer.setDirections(result);
          }
        }
      );
    });
  }, [showRoute, showDirections, waypoints, isLoaded]);

  // Error fallback
  if (hasError) {
    return (
      <div
        className={`w-full flex items-center justify-center bg-gradient-to-b from-blue-900/20 to-rida-dark ${className}`}
        style={{ height, borderRadius: '16px', overflow: 'hidden', ...style }}
      >
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-3 animate-pulse-glow">
            <MapPin className="w-10 h-10 text-cyan-400" />
          </div>
          <p className="text-sm text-gray-400">GPS Activo - Costa Rica</p>
          <p className="text-xs text-gray-600 mt-1">Precision: alta</p>
        </div>
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-fallback" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="cyan" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-fallback)" />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className={`w-full ${className}`}
        style={{ height, borderRadius: '16px', overflow: 'hidden', ...style }}
      />

      {/* Location status indicator */}
      {showUserLocation && (
        <div className="absolute top-3 left-3 z-10">
          {locationStatus === 'searching' && (
            <div className="glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] text-gray-300">Obteniendo ubicacion...</span>
            </div>
          )}
          {locationStatus === 'found' && userLocation && (
            <div className="glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-400">
                {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </span>
            </div>
          )}
          {locationStatus === 'denied' && (
            <div className="glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2 border border-red-500/30">
              <Crosshair className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-red-400">Ubicacion denegada - Habilita GPS</span>
            </div>
          )}
          {locationStatus === 'unavailable' && (
            <div className="glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2 border border-amber-500/30">
              <Navigation className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-400">GPS no disponible</span>
            </div>
          )}
        </div>
      )}

      {/* Re-center button when location found */}
      {locationStatus === 'found' && userLocation && (
        <button
          onClick={() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setCenter(userLocation);
              mapInstanceRef.current.setZoom(14);
            }
          }}
          className="absolute bottom-3 right-3 z-10 glass-strong rounded-xl p-2.5 text-gray-400 hover:text-cyan-400 transition-colors"
          title="Mi ubicacion"
        >
          <Crosshair className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { MapPin } from 'lucide-react';

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
  showDirections = false,
  className = '',
  style = {},
  showUserLocation = true,
  height = '100%',
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

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
          mapId: 'RIDA_SUPREME_MAP',
        });

        mapInstanceRef.current = map;
        setIsLoaded(true);

        // Get user location
        if (showUserLocation && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const userPos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };

              if (mapInstanceRef.current) {
                mapInstanceRef.current.setCenter(userPos);
              }

              // Add user location marker with AdvancedMarkerElement
              try {
                const { AdvancedMarkerElement } = google.maps.marker;
                const pinElement = document.createElement('div');
                pinElement.style.cssText = `
                  width: 18px; height: 18px; border-radius: 50%;
                  background: #06b6d4; border: 3px solid #fff;
                  box-shadow: 0 0 12px rgba(6,182,212,0.6);
                `;
                const userMarker = new AdvancedMarkerElement({
                  map,
                  position: userPos,
                  title: 'Tu ubicacion',
                  content: pinElement,
                });
                userMarkerRef.current = userMarker;
              } catch {
                // Fallback to basic marker
                new google.maps.Marker({
                  map,
                  position: userPos,
                  title: 'Tu ubicacion',
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#06b6d4',
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                    scale: 8,
                  },
                });
              }
            },
            () => {
              console.warn('Geolocation error, using default center');
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
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
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
      }
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((m) => {
      try { m.map = null; } catch { /* ignore */ }
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
          // Fallback to basic markers
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
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK' && result) {
            directionsRenderer.setDirections(result);
          }
        }
      );
    });
  }, [showRoute, showDirections, isLoaded]);

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
          <p className="text-sm text-gray-400">GPS Activo — Costa Rica</p>
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
    <div
      ref={mapRef}
      className={`w-full ${className}`}
      style={{ height, borderRadius: '16px', overflow: 'hidden', ...style }}
    />
  );
}

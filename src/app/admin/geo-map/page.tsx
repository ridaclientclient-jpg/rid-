'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Loader2, X, MapPinned, ZoomIn, ZoomOut,
  Maximize2, Layers, ChevronDown, Info, Crosshair, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { loadGoogleMaps } from '@/lib/googleMaps';

/* ─── Types ────────────────────────────────────────────────── */
interface LocationArea {
  id: string;
  name: string;
  area_type: 'restriction' | 'surge_zone' | 'hotspot' | 'service_area' | 'airport_zone';
  country: string;
  coordinates: string;
  is_active: boolean;
  notes: string;
  created_at: string;
}

type AreaType = LocationArea['area_type'];

/* ─── Configs ──────────────────────────────────────────────── */
const areaTypeLabels: Record<string, string> = {
  restriction: 'Zona Restringida',
  surge_zone: 'Zona Surge',
  hotspot: 'Zona Popular',
  service_area: 'Area de Servicio',
  airport_zone: 'Zona Aeropuerto',
};

const areaTypeColors: Record<string, { fill: string; stroke: string; text: string; dot: string }> = {
  restriction: { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#ef4444', text: 'text-red-400', dot: 'bg-red-400' },
  surge_zone: { fill: 'rgba(245, 158, 11, 0.15)', stroke: '#f59e0b', text: 'text-amber-400', dot: 'bg-amber-400' },
  hotspot: { fill: 'rgba(249, 115, 22, 0.15)', stroke: '#f97316', text: 'text-orange-400', dot: 'bg-orange-400' },
  service_area: { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  airport_zone: { fill: 'rgba(6, 182, 212, 0.15)', stroke: '#06b6d4', text: 'text-cyan-400', dot: 'bg-cyan-400' },
};

const CR_CENTER = { lat: 9.7489, lng: -83.7534 };

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function GeoMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);

  const [areas, setAreas] = useState<LocationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<LocationArea | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Filters
  const [typeFilters, setTypeFilters] = useState<Set<AreaType>>(
    new Set(['restriction', 'surge_zone', 'hotspot', 'service_area', 'airport_zone'])
  );
  const [showInactive, setShowInactive] = useState(false);

  /* ─── Fetch Areas ──────────────────────────────────────── */
  const fetchAreas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('location_areas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar areas');
      console.error(error);
    } else {
      setAreas(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

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
          zoom: 8,
          styles: darkMapStyle,
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        });

        mapInstanceRef.current = map;
        setMapLoading(false);
      })
      .catch((err) => {
        console.error('Google Maps load error:', err);
        setMapLoading(false);
        toast.error('Error al cargar el mapa');
      });

    return () => {
      polygonsRef.current.forEach(p => p.setMap(null));
      polygonsRef.current = [];
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
    };
  }, []);

  /* ─── Draw Polygons ───────────────────────────────────── */
  useEffect(() => {
    if (!mapInstanceRef.current || mapLoading) return;

    // Clear existing polygons
    polygonsRef.current.forEach(p => p.setMap(null));
    polygonsRef.current = [];

    const filtered = areas.filter(a => {
      if (!showInactive && !a.is_active) return false;
      if (!typeFilters.has(a.area_type)) return false;
      return true;
    });

    loadGoogleMaps().then((google) => {
      if (!mapInstanceRef.current) return;

      let bounds = new google.maps.LatLngBounds();

      filtered.forEach(area => {
        try {
          const coords: [number, number][] = JSON.parse(area.coordinates);
          if (coords.length < 3) return;

          const path = coords.map(([lat, lng]) => {
            const point = new google.maps.LatLng(lat, lng);
            bounds.extend(point);
            return point;
          });

          const colors = areaTypeColors[area.area_type] || areaTypeColors.service_area;

          const polygon = new google.maps.Polygon({
            paths: path,
            fillColor: colors.stroke,
            fillOpacity: 0.2,
            strokeColor: colors.stroke,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            clickable: true,
            map: mapInstanceRef.current,
          });

          // Info window on click
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; color: #1a1a1a; font-family: system-ui;">
                <strong style="font-size: 14px;">${area.name}</strong><br/>
                <span style="font-size: 12px; color: #666;">${areaTypeLabels[area.area_type]}</span><br/>
                <span style="font-size: 11px; color: #999;">${area.country || 'Costa Rica'} - ${area.is_active ? 'Activa' : 'Inactiva'}</span>
                ${area.notes ? `<br/><span style="font-size: 11px; color: #888; margin-top: 4px; display: block;">${area.notes}</span>` : ''}
              </div>
            `,
          });

          polygon.addListener('click', (e) => {
            infoWindow.setPosition(e.latLng);
            infoWindow.open(mapInstanceRef.current!);
            setSelectedArea(area);
          });

          polygonsRef.current.push(polygon);
        } catch (err) {
          console.warn('Error parsing coordinates for', area.name, err);
        }
      });

      // Fit bounds if we have valid polygons
      if (!bounds.isEmpty()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
      }
    });
  }, [areas, mapLoading, typeFilters, showInactive]);

  /* ─── Toggle Type Filter ──────────────────────────────── */
  const toggleTypeFilter = (type: AreaType) => {
    setTypeFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  /* ─── Map Controls ────────────────────────────────────── */
  const zoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) + 1);
    }
  };

  const zoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 10) - 1);
    }
  };

  const resetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(CR_CENTER);
      mapInstanceRef.current.setZoom(8);
    }
  };

  const fitAllAreas = () => {
    if (!mapInstanceRef.current || polygonsRef.current.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    polygonsRef.current.forEach(p => {
      p.getPath().forEach(latlng => bounds.extend(latlng));
    });
    mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
  };

  /* ─── Render ──────────────────────────────────────────── */
  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white">Mapa de Zonas</h1>
          <p className="text-gray-400 mt-1">Visualizacion geografica de areas, restricciones y zonas especiales</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {areas.length} areas totales
          </span>
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs font-medium flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            {sidebarOpen ? 'Ocultar Panel' : 'Mostrar Panel'}
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative rounded-2xl overflow-hidden glass" style={{ minHeight: '400px' }}>
        {/* Map */}
        <div ref={mapRef} className="absolute inset-0" />

        {/* Loading Overlay */}
        {mapLoading && (
          <div className="absolute inset-0 bg-rida-dark/80 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Cargando mapa...</p>
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
          <button type="button" onClick={zoomIn} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button type="button" onClick={zoomOut} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-white/10 my-1" />
          <button type="button" onClick={fitAllAreas} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Ajustar a todas las areas">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={resetView} className="w-9 h-9 rounded-lg glass-strong flex items-center justify-center text-gray-400 hover:text-white transition-colors" title="Vista inicial CR">
            <Crosshair className="w-4 h-4" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="glass-strong rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">Leyenda</p>
            {Object.entries(areaTypeLabels).map(([type, label]) => {
              const c = areaTypeColors[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleTypeFilter(type as AreaType)}
                  className={`flex items-center gap-2 text-[11px] transition-opacity ${typeFilters.has(type) ? 'opacity-100' : 'opacity-30'}`}
                >
                  <span className={`w-3 h-3 rounded-sm border-2`} style={{ backgroundColor: c.stroke + '33', borderColor: c.stroke }} />
                  <span className={c.text}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Panel */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="absolute top-4 left-4 bottom-4 w-80 z-10 glass-strong rounded-xl overflow-hidden flex flex-col"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
            >
              {/* Panel Header */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MapPinned className="w-4 h-4 text-cyan-400" />
                    Zonas
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Inactive Toggle */}
                <button
                  type="button"
                  onClick={() => setShowInactive(!showInactive)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg transition-all ${
                    showInactive ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {showInactive ? 'Mostrando inactivas' : 'Solo activas'}
                </button>
              </div>

              {/* Area List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  </div>
                ) : areas.filter(a => typeFilters.has(a.area_type)).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No hay zonas para mostrar</p>
                  </div>
                ) : (
                  areas
                    .filter(a => {
                      if (!typeFilters.has(a.area_type)) return false;
                      if (!showInactive && !a.is_active) return false;
                      return true;
                    })
                    .map(area => {
                      const c = areaTypeColors[area.area_type] || areaTypeColors.service_area;
                      const coordCount = (() => {
                        try { return JSON.parse(area.coordinates).length; } catch { return 0; }
                      })();

                      return (
                        <motion.button
                          key={area.id}
                          type="button"
                          onClick={() => {
                            setSelectedArea(area);
                            // Pan map to this area
                            try {
                              const coords: [number, number][] = JSON.parse(area.coordinates);
                              if (coords.length > 0 && mapInstanceRef.current) {
                                const bounds = new google.maps.LatLngBounds();
                                coords.forEach(([lat, lng]) => bounds.extend(new google.maps.LatLng(lat, lng)));
                                mapInstanceRef.current.fitBounds(bounds, { padding: 80 });
                              }
                            } catch {}
                          }}
                          className={`w-full text-left p-3 rounded-xl transition-all ${
                            selectedArea?.id === area.id
                              ? 'bg-white/10 border border-cyan-500/30'
                              : 'bg-white/5 hover:bg-white/[0.07] border border-transparent'
                          }`}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0`} style={{ backgroundColor: c.stroke + '20' }}>
                              <div className={`w-2.5 h-2.5 rounded-sm`} style={{ backgroundColor: c.stroke }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{area.name}</p>
                              <p className={`text-[10px] ${c.text} mt-0.5`}>{areaTypeLabels[area.area_type]}</p>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                                <span>{coordCount} pts</span>
                                {area.country && <span>{area.country}</span>}
                                {!area.is_active && <span className="text-gray-600">(inactiva)</span>}
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })
                )}
              </div>

              {/* Panel Footer */}
              <div className="p-3 border-t border-white/10">
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>{areas.filter(a => a.is_active).length} activas / {areas.length} total</span>
                  <span className="flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Haz clic en zona para detalles
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Area Info Popup */}
        <AnimatePresence>
          {selectedArea && !sidebarOpen && (
            <motion.div
              className="absolute bottom-4 left-4 right-4 z-10 glass-strong rounded-xl p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">{selectedArea.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] ${areaTypeColors[selectedArea.area_type]?.text}`}>
                      {areaTypeLabels[selectedArea.area_type]}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {selectedArea.country || 'Costa Rica'}
                    </span>
                    {selectedArea.notes && (
                      <span className="text-[10px] text-gray-600">{selectedArea.notes}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedArea(null)}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

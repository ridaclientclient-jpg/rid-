'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { MapPin, Loader2 } from 'lucide-react';

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string, placeId?: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  className?: string;
  country?: string;
  dotColor?: string;
  disabled?: boolean;
}

export default function PlacesAutocomplete({
  value,
  onChange,
  placeholder = 'Buscar direccion...',
  className = '',
  country = 'CR',
  dotColor = 'bg-emerald-400',
  disabled = false,
}: PlacesAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then((google) => {
        autocompleteRef.current = new google.maps.places.AutocompleteService();
        placesRef.current = new google.maps.places.PlacesService(document.createElement('div'));
      })
      .catch(console.error);
  }, []);

  const fetchSuggestions = useCallback(
    (query: string) => {
      if (!autocompleteRef.current || !query || query.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      autocompleteRef.current?.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country },
          types: ['geocode', 'establishment'],
        },
        (predictions, status) => {
          setIsLoading(false);
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            setSuggestions(predictions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
          }
        }
      );
    },
    [country]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
    return () => clearTimeout(timeout);
  }, [value, fetchSuggestions]);

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesRef.current) return;

    placesRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'formatted_address'],
      },
      (place, status) => {
        if (
          status === google.maps.places.PlacesServiceStatus.OK &&
          place?.geometry?.location
        ) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address || prediction.description;
          onChange(address, prediction.place_id, lat, lng);
          setSuggestions([]);
          setShowSuggestions(false);
          setSelectedIndex(-1);
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${dotColor} border-2 ${
            dotColor === 'bg-emerald-400'
              ? 'border-emerald-400/30'
              : dotColor === 'bg-red-400'
              ? 'border-red-400/30'
              : 'border-white/30'
          }`}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 glass-strong rounded-xl overflow-hidden z-50 max-h-48 overflow-y-auto custom-scrollbar">
          {suggestions.map((s, i) => (
            <button
              key={s.place_id}
              onMouseDown={() => handleSelect(s)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                i === selectedIndex
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
                <span className="truncate">{s.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

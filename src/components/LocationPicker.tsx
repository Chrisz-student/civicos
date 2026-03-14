// ============================================
// LocationPicker — GPS auto-detect + manual input
// Supports typed coordinates like "-36.853028, 174.762639"
// ============================================

import { useState, useEffect } from 'react';
import type { GPS } from '../types/incident';

interface LocationPickerProps {
  onLocationChange: (location: string, gps: GPS | null) => void;
}

/**
 * Try to parse a "lat, lng" string into GPS coordinates.
 * Returns GPS object if valid, or null if it doesn't look like coordinates.
 */
function parseCoordinates(text: string): GPS | null {
  // Match patterns like "-36.853028, 174.762639" or "-36.853028 174.762639"
  const match = text.trim().match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if (!match) return null;

  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);

  // Validate ranges
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

export default function LocationPicker({ onLocationChange }: LocationPickerProps) {
  const [locationText, setLocationText] = useState('');
  const [gps, setGps] = useState<GPS | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    // Try to auto-detect GPS on mount
    if (!navigator.geolocation) return;

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: GPS = {
          lat: parseFloat(position.coords.latitude.toFixed(6)),
          lng: parseFloat(position.coords.longitude.toFixed(6)),
        };
        setGps(coords);
        setDetected(true);
        setDetecting(false);
        setLocationText(`${coords.lat}, ${coords.lng}`);
        onLocationChange(`${coords.lat}, ${coords.lng}`, coords);
      },
      () => {
        // User denied or no GPS hardware — that's fine, they can type manually
        setDetecting(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (value: string) => {
    setLocationText(value);

    // Try to auto-parse coordinates from the typed text
    const parsed = parseCoordinates(value);
    if (parsed) {
      setGps(parsed);
      onLocationChange(value, parsed);
    } else {
      // Not coordinates — send location text only, no GPS
      setGps(null);
      onLocationChange(value, null);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/70">
        Location
      </label>
      <input
        type="text"
        value={locationText}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="e.g. Queen Street near K Road  or  -36.853028, 174.762639"
        className="dark-input w-full"
      />
      <p className="text-xs text-white/40">
        {detecting
          ? '📍 Detecting your location...'
          : detected
            ? `📍 GPS detected (${gps?.lat}, ${gps?.lng}) — you can edit the text above`
            : gps
              ? `📍 Coordinates parsed: (${gps.lat}, ${gps.lng})`
              : '📍 Enter a street address or paste coordinates like -36.853028, 174.762639'}
      </p>
    </div>
  );
}

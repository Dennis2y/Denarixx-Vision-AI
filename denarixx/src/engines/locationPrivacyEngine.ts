/**
 * LocationPrivacyEngine (V7)
 *
 * Controls how GPS data is handled before it reaches UI or memory:
 *
 * - 'none':    GPS coordinates are never exposed or stored
 * - 'fuzzy':   Coordinates snapped to a ~1 km grid (±0.005°)
 * - 'precise': Full coordinates used (only with explicit user consent)
 *
 * Pure engine — no async, no I/O.
 */

import type { GPSReading, FuzzedLocation, LocationPrivacyLevel } from '@/types/sensors';

// ─── Grid snapping ────────────────────────────────────────────────────────────

/**
 * Snap a coordinate to a grid of `gridSize` degrees.
 * 0.01° ≈ 1.1 km at equator — good for fuzzy mode.
 * 0.1°  ≈ 11 km             — use for extra-fuzzy if needed.
 */
function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class LocationPrivacyEngine {
  /**
   * Apply privacy filtering to a raw GPS reading.
   * Returns null when privacy level is 'none'.
   */
  filter(gps: GPSReading, level: LocationPrivacyLevel): FuzzedLocation | null {
    if (level === 'none') return null;

    if (level === 'precise') {
      return {
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracy: gps.accuracy,
        privacyLevel: 'precise',
      };
    }

    // Fuzzy: snap to 0.01° grid (~1 km)
    const gridSize = 0.01;
    return {
      latitude: snapToGrid(gps.latitude, gridSize),
      longitude: snapToGrid(gps.longitude, gridSize),
      // Inflate accuracy to reflect reduced precision
      accuracy: Math.max(gps.accuracy, (gridSize * 111_000) / 2), // half-grid in metres
      privacyLevel: 'fuzzy',
    };
  }

  /**
   * Determine if this location may be stored to AI memory.
   * Requires both `locationMemoryEnabled` and at least 'fuzzy' precision.
   */
  mayStore(
    level: LocationPrivacyLevel,
    locationMemoryEnabled: boolean
  ): boolean {
    return locationMemoryEnabled && level !== 'none';
  }

  /**
   * Human-readable description of the current privacy level.
   */
  describe(level: LocationPrivacyLevel): string {
    switch (level) {
      case 'none':
        return 'Location disabled — no GPS data is used or stored.';
      case 'fuzzy':
        return 'Approximate location only — coordinates rounded to ~1 km grid. No precise location stored.';
      case 'precise':
        return 'Precise location enabled — full GPS coordinates used. Store location only if memory is also enabled.';
    }
  }

  /**
   * Compute approximate distance in metres between two lat/lon points.
   * Uses the Haversine formula; accurate to ~0.5% over short distances.
   */
  distanceMetres(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6_371_000; // Earth radius in metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Generate a location-aware context note (uses fuzzed location for privacy).
   * Returns a generic note when location is not available.
   */
  locationNote(fuzzed: FuzzedLocation | null): string {
    if (!fuzzed) return 'Location not available.';
    const latDir = fuzzed.latitude >= 0 ? 'N' : 'S';
    const lonDir = fuzzed.longitude >= 0 ? 'E' : 'W';
    const lat = Math.abs(fuzzed.latitude).toFixed(2);
    const lon = Math.abs(fuzzed.longitude).toFixed(2);
    const acc =
      fuzzed.accuracy >= 1000
        ? `${(fuzzed.accuracy / 1000).toFixed(1)} km`
        : `${Math.round(fuzzed.accuracy)} m`;
    return `Near ${lat}°${latDir} ${lon}°${lonDir} (±${acc})`;
  }
}

// ─── Sprint 17: GPS HAL ───────────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// GNSS abstraction with offline dead-reckoning fallback.

import type {
  GPSHALState,
  GPSReading,
  GPSQuality,
  PositioningMode,
  SensorHealthReport,
} from '@/types/hardwareHAL';
import { SIMULATION_DRIVER } from '@/types/hardwareHAL';

export function createGPSHALState(deviceId: string): GPSHALState {
  return {
    deviceId,
    status: 'offline',
    lastReading: null,
    fixAcquired: false,
    readingCount: 0,
    errorCount: 0,
    offlineMode: false,
  };
}

export function initializeGPS(state: GPSHALState, tick: number): GPSHALState {
  return { ...state, status: 'initializing' };
}

export function acquireFix(state: GPSHALState, tick: number): GPSHALState {
  return { ...state, status: 'ready', fixAcquired: true };
}

export function classifyGPSQuality(accuracyM: number): GPSQuality {
  if (accuracyM <= 3)  return 'excellent';
  if (accuracyM <= 10) return 'good';
  if (accuracyM <= 25) return 'fair';
  if (accuracyM <= 50) return 'poor';
  return 'unavailable';
}

export function classifyPositioningMode(
  fixAcquired: boolean,
  offlineMode: boolean
): PositioningMode {
  if (!fixAcquired && offlineMode) return 'offline-dead-reckoning';
  if (!fixAcquired) return 'unavailable';
  if (offlineMode) return 'assisted';
  return 'gnss';
}

export function readGPS(
  state: GPSHALState,
  tick: number
): { state: GPSHALState; reading: GPSReading | null } {
  if (state.status === 'error' || state.status === 'offline') {
    return { state, reading: null };
  }

  const accuracyM = state.offlineMode ? 30 : 5;
  const mode = classifyPositioningMode(state.fixAcquired, state.offlineMode);
  const quality = classifyGPSQuality(accuracyM);

  const reading: GPSReading = {
    tick,
    latitude:  51.5074 + (tick % 100) * 0.0001,
    longitude: -0.1278 + (tick % 50) * 0.0001,
    altitudeM: 12.0,
    accuracyM,
    speedMps: 1.4,
    headingDeg: (tick * 5) % 360,
    quality,
    mode,
  };

  return {
    state: {
      ...state,
      lastReading: reading,
      readingCount: state.readingCount + 1,
      fixAcquired: state.fixAcquired || mode === 'gnss',
    },
    reading,
  };
}

export function activateOfflineMode(state: GPSHALState): GPSHALState {
  return { ...state, offlineMode: true };
}

export function deactivateOfflineMode(state: GPSHALState): GPSHALState {
  return { ...state, offlineMode: false };
}

export function hasFix(state: GPSHALState): boolean {
  return state.fixAcquired;
}

export function setGPSError(state: GPSHALState): GPSHALState {
  return {
    ...state,
    status: 'error',
    errorCount: state.errorCount + 1,
    fixAcquired: false,
    lastReading: null,
  };
}

export function restartGPS(state: GPSHALState): GPSHALState {
  return {
    ...state,
    status: 'initializing',
    errorCount: 0,
    fixAcquired: false,
    lastReading: null,
  };
}

export function getGPSHealth(state: GPSHALState): SensorHealthReport {
  const issues: string[] = [];
  if (state.status === 'error') issues.push('GPS in error state');
  if (!state.fixAcquired) issues.push('No GPS fix acquired');
  if (state.offlineMode) issues.push('GPS in offline dead-reckoning mode');
  if (state.lastReading?.quality === 'poor') issues.push('GPS accuracy poor (> 25m)');

  return {
    component: 'gps',
    deviceId: state.deviceId,
    status: state.status,
    errorCount: state.errorCount,
    restartCount: 0,
    issues,
    shouldRestart: state.status === 'error',
  };
}

export function getGPSDriver(platform: string): string {
  const drivers: Record<string, string> = {
    simulation:       SIMULATION_DRIVER,
    prototype:        'gpsd',
    'android-xr':     'android-location',
    'linux-wearable': 'gpsd',
    'denarixx-v1':    'denarixx-gnss-native',
  };
  return drivers[platform] ?? SIMULATION_DRIVER;
}

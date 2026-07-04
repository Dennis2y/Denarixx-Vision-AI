'use client';

/**
 * useDeviceSensors (V7)
 *
 * Browser sensor integration: GPS, compass (DeviceOrientation),
 * IMU (DeviceMotion), battery, and vibration.
 *
 * All sensor APIs are guarded for SSR and availability.
 * Permissions are requested lazily (only when the user enables them).
 *
 * iOS 13+ DeviceOrientation/Motion require explicit permission requests
 * which must be triggered by a user gesture — the requestMotionSensors()
 * function is designed to be called from a button click handler.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SensorFusionEngine } from '@/engines/sensorFusionEngine';
import { VIBRATION_MS } from '@/types/sensors';
import type {
  GPSReading,
  CompassReading,
  MotionReading,
  BatteryState,
  SensorContext,
  SensorPermissions,
  VibrationPattern,
} from '@/types/sensors';

// ─── Inline type declarations for browser APIs not in all DOM builds ──────────

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  onlevelchange: ((e: Event) => void) | null;
  onchargingchange: ((e: Event) => void) | null;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

interface DeviceMotionEventStatic {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAvailable(api: string): boolean {
  if (typeof window === 'undefined') return false;
  switch (api) {
    case 'geolocation':    return 'geolocation' in navigator;
    case 'orientation':    return 'ondeviceorientation' in window;
    case 'motion':         return 'ondevicemotion' in window;
    case 'vibration':      return 'vibrate' in navigator;
    case 'battery':        return 'getBattery' in navigator;
    default:               return false;
  }
}

const UNKNOWN_PERMISSIONS: SensorPermissions = {
  geolocation:      'unavailable',
  deviceOrientation:'unavailable',
  deviceMotion:     'unavailable',
  vibration:        false,
  battery:          false,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseDeviceSensorsReturn {
  sensorContext: SensorContext;
  requestGPS: () => void;
  requestMotionSensors: () => Promise<void>;
  stopGPS: () => void;
  vibrate: (pattern: VibrationPattern) => boolean;
  isMotionSupported: boolean;
  isGPSSupported: boolean;
}

const fusionEngine = new SensorFusionEngine();

function buildDefaultContext(permissions: SensorPermissions): SensorContext {
  return {
    gps: null,
    compass: null,
    motion: null,
    motionState: 'unknown',
    battery: null,
    permissions,
    headingDegrees: null,
    isLowPowerMode: false,
    isActive: false,
    lastUpdated: new Date(),
  };
}

export function useDeviceSensors(batteryAwareMode = true): UseDeviceSensorsReturn {
  const [gps, setGps] = useState<GPSReading | null>(null);
  const [compass, setCompass] = useState<CompassReading | null>(null);
  const [motion, setMotion] = useState<MotionReading | null>(null);
  const [battery, setBattery] = useState<BatteryState | null>(null);
  const [permissions, setPermissions] = useState<SensorPermissions>(() => ({
    geolocation:      isAvailable('geolocation')  ? 'prompt' : 'unavailable',
    deviceOrientation:isAvailable('orientation')  ? 'prompt' : 'unavailable',
    deviceMotion:     isAvailable('motion')       ? 'prompt' : 'unavailable',
    vibration:        isAvailable('vibration'),
    battery:          isAvailable('battery'),
  }));
  const [sensorContext, setSensorContext] = useState<SensorContext>(() =>
    buildDefaultContext(UNKNOWN_PERMISSIONS)
  );

  const gpsWatchRef = useRef<number | null>(null);
  const batteryManagerRef = useRef<BatteryManager | null>(null);

  // ── Recompute fused context whenever any reading changes ─────────────────

  useEffect(() => {
    const ctx = fusionEngine.fuse(gps, compass, motion, battery, permissions, batteryAwareMode);
    setSensorContext(ctx);
  }, [gps, compass, motion, battery, permissions, batteryAwareMode]);

  // ── Battery API ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nav = navigator as NavigatorWithBattery;
    if (!nav.getBattery) return;

    nav.getBattery().then((bm) => {
      batteryManagerRef.current = bm;
      const sync = () => {
        setBattery({
          level: bm.level,
          charging: bm.charging,
          chargingTime: isFinite(bm.chargingTime) ? bm.chargingTime : null,
          dischargingTime: isFinite(bm.dischargingTime) ? bm.dischargingTime : null,
        });
        setPermissions((p) => ({ ...p, battery: true }));
      };
      sync();
      bm.onlevelchange = sync;
      bm.onchargingchange = sync;
    }).catch(() => {
      setPermissions((p) => ({ ...p, battery: false }));
    });

    return () => {
      if (batteryManagerRef.current) {
        batteryManagerRef.current.onlevelchange = null;
        batteryManagerRef.current.onchargingchange = null;
      }
    };
  }, []);

  // ── GPS ───────────────────────────────────────────────────────────────────

  const requestGPS = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    if (gpsWatchRef.current !== null) return; // already watching

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          timestamp: new Date(pos.timestamp),
        });
        setPermissions((p) => ({ ...p, geolocation: 'granted' }));
      },
      (err) => {
        const status = err.code === 1 ? 'denied' : 'prompt';
        setPermissions((p) => ({ ...p, geolocation: status as 'denied' | 'prompt' }));
        gpsWatchRef.current = null;
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 }
    );
  }, []);

  const stopGPS = useCallback(() => {
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
      setGps(null);
      setPermissions((p) => ({ ...p, geolocation: 'prompt' }));
    }
  }, []);

  // ── DeviceOrientation (compass) ───────────────────────────────────────────

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    if (e.alpha === null) return;
    setCompass({
      alpha: e.alpha ?? 0,
      beta: e.beta ?? 0,
      gamma: e.gamma ?? 0,
      absolute: e.absolute,
      timestamp: new Date(),
    });
  }, []);

  // ── DeviceMotion (IMU) ────────────────────────────────────────────────────

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const acc = e.acceleration;
    const accG = e.accelerationIncludingGravity;
    const rot = e.rotationRate;

    setMotion({
      acceleration: acc && acc.x !== null
        ? { x: acc.x ?? 0, y: acc.y ?? 0, z: acc.z ?? 0 }
        : null,
      accelerationIncludingGravity: accG && accG.x !== null
        ? { x: accG.x ?? 0, y: accG.y ?? 0, z: accG.z ?? 0 }
        : null,
      rotationRate: rot
        ? { alpha: rot.alpha ?? 0, beta: rot.beta ?? 0, gamma: rot.gamma ?? 0 }
        : null,
      interval: e.interval,
      timestamp: new Date(),
    });
  }, []);

  // ── Request motion sensors (iOS 13+ requires user gesture) ───────────────

  const requestMotionSensors = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // DeviceOrientation permission (iOS 13+)
    const DOE = window.DeviceOrientationEvent as unknown as DeviceOrientationEventStatic | undefined;
    if (typeof DOE?.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission!();
        setPermissions((p) => ({ ...p, deviceOrientation: result }));
        if (result === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
        }
      } catch {
        setPermissions((p) => ({ ...p, deviceOrientation: 'denied' }));
      }
    } else if (isAvailable('orientation')) {
      // Non-iOS: add listener directly
      window.addEventListener('deviceorientation', handleOrientation, true);
      setPermissions((p) => ({ ...p, deviceOrientation: 'granted' }));
    }

    // DeviceMotion permission (iOS 13+)
    const DME = window.DeviceMotionEvent as unknown as DeviceMotionEventStatic | undefined;
    if (typeof DME?.requestPermission === 'function') {
      try {
        const result = await DME.requestPermission!();
        setPermissions((p) => ({ ...p, deviceMotion: result }));
        if (result === 'granted') {
          window.addEventListener('devicemotion', handleMotion, true);
        }
      } catch {
        setPermissions((p) => ({ ...p, deviceMotion: 'denied' }));
      }
    } else if (isAvailable('motion')) {
      window.addEventListener('devicemotion', handleMotion, true);
      setPermissions((p) => ({ ...p, deviceMotion: 'granted' }));
    }
  }, [handleOrientation, handleMotion]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(gpsWatchRef.current);
      }
      window.removeEventListener('deviceorientation', handleOrientation, true);
      window.removeEventListener('devicemotion', handleMotion, true);
    };
  }, [handleOrientation, handleMotion]);

  // ── Vibration ─────────────────────────────────────────────────────────────

  const vibrate = useCallback((pattern: VibrationPattern): boolean => {
    if (typeof window === 'undefined' || !navigator.vibrate) return false;
    return navigator.vibrate(VIBRATION_MS[pattern]);
  }, []);

  return {
    sensorContext,
    requestGPS,
    requestMotionSensors,
    stopGPS,
    vibrate,
    isMotionSupported: isAvailable('orientation') || isAvailable('motion'),
    isGPSSupported: isAvailable('geolocation'),
  };
}

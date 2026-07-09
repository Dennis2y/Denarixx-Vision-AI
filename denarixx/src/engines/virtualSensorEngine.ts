// ─── Sprint 18: Virtual Sensor Engine ────────────────────────────────────────
// Pure functions — no async, no I/O.
// Simulates all sensor readings for the Digital Twin.

import type {
  VirtualCamera,
  VirtualGPS,
  VirtualIMU,
  VirtualBattery,
  VirtualMicrophone,
  LightLevel,
  EnvironmentProfile,
  SimulatedCameraFrame,
} from '@/types/simulator';

// ─── Camera ───────────────────────────────────────────────────────────────────

const RESOLUTION = { width: 1280, height: 720 };

function lightToConfidence(light: LightLevel, obstruction: number): number {
  const base =
    light === 'bright' ? 0.97 :
    light === 'normal' ? 0.93 :
    light === 'dim'    ? 0.72 :
    /* dark */           0.45;
  return Math.max(0, base - obstruction * 0.5);
}

export function simulateCameraFrame(
  cam: VirtualCamera,
  env: EnvironmentProfile,
  tick: number
): SimulatedCameraFrame | null {
  if (!cam.isWorking) return null;
  const confidence = lightToConfidence(cam.lightLevel, cam.obstructionLevel);
  return {
    deviceId: cam.deviceId,
    tick,
    width: RESOLUTION.width,
    height: RESOLUTION.height,
    confidence,
    lightAdjusted: cam.lightLevel !== 'normal',
    obstructed: cam.obstructionLevel > 0.3,
  };
}

export function getCameraConfidence(cam: VirtualCamera): number {
  if (!cam.isWorking) return 0;
  return lightToConfidence(cam.lightLevel, cam.obstructionLevel);
}

// ─── GPS ──────────────────────────────────────────────────────────────────────

export function simulateGPS(
  gps: VirtualGPS,
  env: EnvironmentProfile,
  tick: number
): { latitude: number; longitude: number; accuracyM: number; mode: string } | null {
  if (!gps.hasSignal) {
    return gps.isOfflineMode
      ? { latitude: 51.5074 + gps.driftM * 0.0001, longitude: -0.1278, accuracyM: 999, mode: 'offline-dead-reckoning' }
      : null;
  }
  const drift = gps.driftM * 0.00001;
  return {
    latitude:  51.5074 + drift + (tick % 100) * 0.0001,
    longitude: -0.1278 + drift,
    accuracyM: gps.accuracyM,
    mode: env.indoorMode ? 'assisted' : 'gnss',
  };
}

export function getGPSQualityLabel(accuracyM: number): string {
  if (accuracyM <= 5)  return 'excellent';
  if (accuracyM <= 15) return 'good';
  if (accuracyM <= 30) return 'fair';
  if (accuracyM <= 50) return 'poor';
  return 'unavailable';
}

// ─── IMU ──────────────────────────────────────────────────────────────────────

export function simulateIMU(
  imu: VirtualIMU,
  env: EnvironmentProfile,
  tick: number
): {
  accelerometerZ: number;
  gyroscopeZ: number;
  headingDeg: number;
  motionState: string;
} | null {
  if (!imu.isWorking) return null;
  const t = tick * 0.1 * imu.driftFactor;
  const accelZ = 9.81 + Math.sin(t) * 0.3 * imu.driftFactor;
  const gyroZ  = Math.cos(t) * 0.05 * imu.driftFactor;
  const heading = ((tick * 3 * imu.driftFactor) % 360 + 360) % 360;
  const motionState =
    imu.driftFactor > 2 ? 'falling' :
    Math.abs(accelZ - 9.81) > 1.5 ? 'running' :
    Math.abs(accelZ - 9.81) > 0.5 ? 'walking' :
    'stationary';
  return { accelerometerZ: accelZ, gyroscopeZ: gyroZ, headingDeg: heading, motionState };
}

export function simulateCompass(imu: VirtualIMU, _env: EnvironmentProfile, tick: number): number {
  if (!imu.isWorking) return 0;
  return ((tick * 2 * imu.driftFactor) % 360 + 360) % 360;
}

// ─── Battery ──────────────────────────────────────────────────────────────────

export function simulateBatteryTick(
  battery: VirtualBattery,
  env: EnvironmentProfile,
  _tick: number
): VirtualBattery {
  if (battery.isCharging) {
    return { ...battery, percentage: Math.min(100, battery.percentage + 0.5) };
  }
  const envDrainBonus = env.weatherCondition === 'rain' || env.weatherCondition === 'snow' ? 0.3 : 0;
  const drain = 0.2 * battery.drainRateMultiplier + envDrainBonus;
  const pct = Math.max(0, battery.percentage - drain);
  const tempRise = battery.drainRateMultiplier > 1.5 ? 0.5 : 0;
  return {
    ...battery,
    percentage: pct,
    temperatureC: battery.temperatureC + tempRise,
  };
}

export function simulateTemperature(battery: VirtualBattery, env: EnvironmentProfile): number {
  const base = battery.temperatureC;
  const heatBonus =
    env.weatherCondition === 'bright' ? 3 :
    env.weatherCondition === 'snow'   ? -5 :
    0;
  return base + heatBonus + battery.drainRateMultiplier * 2;
}

export function isBatteryThermalCritical(battery: VirtualBattery): boolean {
  return battery.temperatureC >= 55;
}

// ─── Microphone ───────────────────────────────────────────────────────────────

export function simulateMicFrame(
  mic: VirtualMicrophone,
  env: EnvironmentProfile,
  tick: number
): { amplitude: number; noise: number; wakeWordDetected: boolean } | null {
  if (!mic.isWorking) return null;
  const amplitude = 0.4 + Math.sin(tick * 0.3) * 0.15;
  const noise = mic.noiseLevel + env.ambientNoiseLevel * 0.5;
  const wakeWordDetected = mic.wakeWordEnabled && amplitude > 0.7 && noise < 0.5;
  return {
    amplitude: Math.min(1, amplitude),
    noise: Math.min(1, noise),
    wakeWordDetected,
  };
}

export function getMicQuality(mic: VirtualMicrophone, env: EnvironmentProfile): string {
  if (!mic.isWorking) return 'failed';
  const snr = 1 - (mic.noiseLevel + env.ambientNoiseLevel) / 2;
  if (snr > 0.7) return 'perfect';
  if (snr > 0.4) return 'good';
  if (snr > 0.1) return 'degraded';
  return 'failed';
}

// ─── Display ──────────────────────────────────────────────────────────────────

export function getDisplayVisibility(
  brightness: number,
  lightLevel: LightLevel
): 'excellent' | 'good' | 'poor' | 'unreadable' {
  if (lightLevel === 'bright' && brightness < 70) return 'poor';
  if (lightLevel === 'bright' && brightness < 50) return 'unreadable';
  if (lightLevel === 'dark' && brightness > 30)   return 'poor';
  if (brightness >= 50) return 'excellent';
  return 'good';
}

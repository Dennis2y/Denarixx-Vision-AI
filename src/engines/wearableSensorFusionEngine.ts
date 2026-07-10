// ─── V14 Wearable Sensor Fusion Engine ───────────────────────────────────────
// Pure functions — no async, no I/O.
// Fuses IMU, GPS, temperature, and battery data from wearable sensors.

import type {
  WearableSensorFrame,
  WearableMotionState,
  ThermalState,
  FusedFrame,
} from '@/types/glasses';

// ─── Simulated Sensor Frame ───────────────────────────────────────────────────

export function createSimulatedSensorFrame(tick: number): WearableSensorFrame {
  const phase = tick * 0.15;
  return {
    timestamp: Date.now(),
    accelerometer: {
      x: Math.sin(phase) * 0.3,
      y: 9.81 + Math.cos(phase * 1.3) * 0.2,
      z: Math.sin(phase * 0.7) * 0.1,
    },
    gyroscope: {
      x: Math.sin(phase * 2.1) * 0.05,
      y: Math.cos(phase * 1.4) * 0.03,
      z: Math.sin(phase * 0.9) * 0.02,
    },
    magnetometer: {
      heading: ((tick * 3) % 360),
    },
    batteryPct: Math.max(0, 85 - tick * 0.05),
    temperatureCelsius: 28 + Math.sin(tick * 0.02) * 3,
    isCharging: false,
  };
}

// ─── Motion Classification ────────────────────────────────────────────────────

export function classifyMotionState(frame: WearableSensorFrame): WearableMotionState {
  if (!frame.accelerometer) return 'unknown';
  const { x, y, z } = frame.accelerometer;
  // Remove gravity (approximately 9.81 on y-axis)
  const dynamicX = x;
  const dynamicY = y - 9.81;
  const dynamicZ = z;
  const magnitude = Math.sqrt(dynamicX ** 2 + dynamicY ** 2 + dynamicZ ** 2);
  if (magnitude < 0.5) return 'stationary';
  if (magnitude < 2.0) return 'walking';
  return 'running';
}

export function getMotionLabel(state: WearableMotionState): string {
  const labels: Record<WearableMotionState, string> = {
    stationary: '⏹ Stationary',
    walking: '🚶 Walking',
    running: '🏃 Running',
    unknown: '? Unknown',
  };
  return labels[state];
}

// ─── Heading ─────────────────────────────────────────────────────────────────

export function getCompassHeading(frame: WearableSensorFrame): number | null {
  return frame.magnetometer?.heading ?? null;
}

export function headingToCardinal(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((degrees % 360) + 360) % 360 / 45) % 8;
  return dirs[idx];
}

// ─── Thermal Assessment ───────────────────────────────────────────────────────

export function assessThermalState(frame: WearableSensorFrame): ThermalState {
  const temp = frame.temperatureCelsius;
  if (temp === null) return 'normal';
  if (temp >= 45) return 'hot';
  if (temp >= 38) return 'warm';
  return 'normal';
}

export function buildThermalWarning(state: ThermalState): string | null {
  if (state === 'hot') return 'Glasses temperature is high. Remove if uncomfortable.';
  if (state === 'warm') return 'Glasses are warm. Monitor for overheating.';
  return null;
}

// ─── Battery ─────────────────────────────────────────────────────────────────

export function getBatteryWarning(batteryPct: number): string | null {
  if (batteryPct <= 5) return 'Sensor battery critical.';
  if (batteryPct <= 15) return 'Sensor battery low. Charge soon.';
  return null;
}

export function formatBatteryLevel(pct: number): string {
  if (pct >= 75) return `🟢 ${Math.round(pct)}%`;
  if (pct >= 40) return `🟡 ${Math.round(pct)}%`;
  if (pct >= 15) return `🟠 ${Math.round(pct)}%`;
  return `🔴 ${Math.round(pct)}%`;
}

// ─── Sensor-Camera Fusion ─────────────────────────────────────────────────────

export function fuseSensorWithCamera(
  sensorFrame: WearableSensorFrame,
  cameraFrame: FusedFrame,
): FusedFrame {
  // Enrich the fused frame with heading from wearable magnetometer
  const heading = sensorFrame.magnetometer?.heading;
  const motion = classifyMotionState(sensorFrame);

  // If running, add urgency context to guidance
  const guidance =
    motion === 'running' && cameraFrame.guidanceText
      ? `Slow down. ${cameraFrame.guidanceText}`
      : cameraFrame.guidanceText;

  return {
    ...cameraFrame,
    guidanceText: guidance,
  };
}

// ─── Sensor Health ────────────────────────────────────────────────────────────

export function isSensorFrameStale(frame: WearableSensorFrame, nowMs = Date.now()): boolean {
  return nowMs - frame.timestamp > 2000; // >2s old = stale
}

export function computeSensorQuality(frame: WearableSensorFrame): number {
  let score = 1.0;
  if (!frame.accelerometer) score -= 0.25;
  if (!frame.gyroscope) score -= 0.15;
  if (!frame.magnetometer) score -= 0.2;
  if (isSensorFrameStale(frame)) score -= 0.4;
  return Math.max(0, score);
}

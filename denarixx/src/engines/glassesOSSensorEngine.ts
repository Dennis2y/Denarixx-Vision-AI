// ─── Sprint 16: Glasses OS Sensor Engine ─────────────────────────────────────
// Pure functions — no async, no I/O.
// Sensor management for the standalone Denarixx Vision Glasses hardware.
// (Complements V7 sensorFusionEngine.ts — OS-level sensor lifecycle for glasses.)

import type {
  SensorType,
  SensorStatus,
  GlassesOSSensor,
  SensorFusionFrame,
  SensorStatusSummary,
} from '@/types/glassesOS';
import { CRITICAL_SENSOR_TYPES } from '@/types/glassesOS';

// ─── Sensor Metadata ──────────────────────────────────────────────────────────

const SENSOR_INITIAL_CONFIDENCE: Record<SensorType, number> = {
  'camera-front':      0.95,
  'camera-side-left':  0.90,
  'camera-side-right': 0.90,
  'gps':               0.75,
  'imu':               0.95,
  'compass':           0.85,
  'microphone-left':   0.90,
  'microphone-right':  0.88,
  'temperature':       0.99,
  'battery-sensor':    0.99,
};

export function isCriticalSensor(type: SensorType): boolean {
  return CRITICAL_SENSOR_TYPES.includes(type);
}

// ─── Sensor Factory ───────────────────────────────────────────────────────────

export function initializeSensor(type: SensorType, tick: number): GlassesOSSensor {
  return {
    type,
    status: 'initializing',
    lastReadingTick: tick,
    errorCount: 0,
    restartCount: 0,
    isCritical: isCriticalSensor(type),
    confidence: SENSOR_INITIAL_CONFIDENCE[type] ?? 0.8,
  };
}

export function activateSensor(sensor: GlassesOSSensor, tick: number): GlassesOSSensor {
  return { ...sensor, status: 'active', lastReadingTick: tick };
}

export function setErrorState(sensor: GlassesOSSensor, tick: number): GlassesOSSensor {
  return {
    ...sensor,
    status: 'error',
    errorCount: sensor.errorCount + 1,
    lastReadingTick: tick,
    confidence: Math.max(0, sensor.confidence - 0.15),
  };
}

export function degradeSensor(sensor: GlassesOSSensor, tick: number): GlassesOSSensor {
  return {
    ...sensor,
    status: 'degraded',
    lastReadingTick: tick,
    confidence: Math.max(0.1, sensor.confidence - 0.05),
  };
}

export function restartSensor(sensor: GlassesOSSensor, tick: number): GlassesOSSensor {
  return {
    ...sensor,
    status: 'initializing',
    errorCount: 0,
    restartCount: sensor.restartCount + 1,
    lastReadingTick: tick,
    confidence: Math.min(1, SENSOR_INITIAL_CONFIDENCE[sensor.type] * 0.9),
  };
}

// ─── All Sensors Factory ──────────────────────────────────────────────────────

export const ALL_SENSOR_TYPES: SensorType[] = [
  'camera-front',
  'camera-side-left',
  'camera-side-right',
  'gps',
  'imu',
  'compass',
  'microphone-left',
  'microphone-right',
  'temperature',
  'battery-sensor',
];

export function initializeAllSensors(tick: number): GlassesOSSensor[] {
  return ALL_SENSOR_TYPES.map(type => initializeSensor(type, tick));
}

export function activateAllSensors(sensors: GlassesOSSensor[], tick: number): GlassesOSSensor[] {
  return sensors.map(s => activateSensor(s, tick));
}

// ─── Status Queries ───────────────────────────────────────────────────────────

export function getSensorByType(
  sensors: GlassesOSSensor[],
  type: SensorType
): GlassesOSSensor | undefined {
  return sensors.find(s => s.type === type);
}

export function getActiveSensors(sensors: GlassesOSSensor[]): GlassesOSSensor[] {
  return sensors.filter(s => s.status === 'active' || s.status === 'degraded');
}

export function getCriticalFailingSensors(sensors: GlassesOSSensor[]): SensorType[] {
  return sensors
    .filter(s => s.isCritical && (s.status === 'error' || s.status === 'inactive'))
    .map(s => s.type);
}

export function buildSensorStatusSummary(sensors: GlassesOSSensor[]): SensorStatusSummary {
  const critical = getCriticalFailingSensors(sensors);
  return {
    total: sensors.length,
    active: sensors.filter(s => s.status === 'active').length,
    error: sensors.filter(s => s.status === 'error').length,
    degraded: sensors.filter(s => s.status === 'degraded').length,
    criticalFailing: critical,
    allCriticalActive: critical.length === 0,
  };
}

// ─── Fusion Frame ─────────────────────────────────────────────────────────────

export function buildSensorFusionFrame(
  sensors: GlassesOSSensor[],
  tick: number
): SensorFusionFrame {
  const active = getActiveSensors(sensors);
  const activeTypes = new Set(active.map(s => s.type));

  const cameraActive =
    activeTypes.has('camera-front') ||
    activeTypes.has('camera-side-left') ||
    activeTypes.has('camera-side-right');
  const gpsActive = activeTypes.has('gps');
  const imuActive = activeTypes.has('imu');
  const compassActive = activeTypes.has('compass');
  const micActive =
    activeTypes.has('microphone-left') || activeTypes.has('microphone-right');

  const anomalies = detectSensorAnomalies(sensors);

  let fusionQuality: SensorFusionFrame['fusionQuality'];
  if (!cameraActive || !imuActive) {
    fusionQuality = 'degraded';
  } else if (anomalies.length > 2) {
    fusionQuality = 'low';
  } else if (anomalies.length > 0) {
    fusionQuality = 'medium';
  } else {
    fusionQuality = 'high';
  }

  return {
    tick,
    activeSensorCount: active.length,
    cameraActive,
    gpsActive,
    imuActive,
    compassActive,
    microphoneActive: micActive,
    hasVisionInput: cameraActive,
    hasLocationInput: gpsActive,
    hasMotionInput: imuActive,
    hasAudioInput: micActive,
    fusionQuality,
    anomalies,
  };
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────

export function detectSensorAnomalies(sensors: GlassesOSSensor[]): string[] {
  const anomalies: string[] = [];

  for (const sensor of sensors) {
    if (sensor.isCritical && sensor.status === 'error') {
      anomalies.push(`Critical sensor error: ${sensor.type}`);
    }
    if (sensor.confidence < 0.3) {
      anomalies.push(`Low confidence on ${sensor.type}: ${(sensor.confidence * 100).toFixed(0)}%`);
    }
    if (sensor.restartCount >= 3) {
      anomalies.push(`${sensor.type} has restarted ${sensor.restartCount} times`);
    }
  }

  const noCameras = !sensors.some(
    s => s.type.startsWith('camera') && s.status === 'active'
  );
  if (noCameras) anomalies.push('No camera active — vision input unavailable');

  return anomalies;
}

// ─── Update in Array ──────────────────────────────────────────────────────────

export function updateSensorInList(
  sensors: GlassesOSSensor[],
  updated: GlassesOSSensor
): GlassesOSSensor[] {
  return sensors.map(s => s.type === updated.type ? updated : s);
}

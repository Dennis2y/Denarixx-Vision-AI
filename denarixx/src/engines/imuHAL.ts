// ─── Sprint 17: IMU HAL ───────────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Inertial Measurement Unit abstraction: accelerometer, gyroscope, magnetometer.

import type {
  IMUHALState,
  IMUReading,
  MotionState,
  SensorHealthReport,
} from '@/types/hardwareHAL';
import { MAX_RESTART_ATTEMPTS, SIMULATION_DRIVER } from '@/types/hardwareHAL';

export function createIMUHALState(deviceId: string): IMUHALState {
  return {
    deviceId,
    status: 'offline',
    lastReading: null,
    readingCount: 0,
    errorCount: 0,
    restartCount: 0,
  };
}

export function initializeIMU(state: IMUHALState, tick: number): IMUHALState {
  return { ...state, status: 'ready' };
}

function simulateIMUValues(tick: number): Omit<IMUReading, 'motionState' | 'confidence'> {
  const t = tick * 0.1;
  return {
    tick,
    accelerometerX: Math.sin(t) * 0.3,
    accelerometerY: Math.cos(t) * 0.2,
    accelerometerZ: 9.81 + Math.sin(t * 0.5) * 0.1,
    gyroscopeX: Math.sin(t * 2) * 0.05,
    gyroscopeY: Math.cos(t * 2) * 0.04,
    gyroscopeZ: Math.sin(t * 1.5) * 0.03,
    magnetometerX: 25.0 + Math.sin(t) * 2,
    magnetometerY: -10.0 + Math.cos(t) * 1.5,
    magnetometerZ: 45.0 + Math.sin(t * 0.3) * 1,
    headingDeg: ((tick * 3) % 360),
  };
}

export function classifyMotionState(reading: IMUReading): MotionState {
  const totalAccel = Math.sqrt(
    reading.accelerometerX ** 2 +
    reading.accelerometerY ** 2 +
    reading.accelerometerZ ** 2
  );
  const totalGyro = Math.sqrt(
    reading.gyroscopeX ** 2 +
    reading.gyroscopeY ** 2 +
    reading.gyroscopeZ ** 2
  );

  if (totalAccel > 15) return 'falling';
  if (totalGyro > 2 || totalAccel > 12) return 'running';
  if (totalGyro > 0.5 || Math.abs(totalAccel - 9.81) > 1) return 'walking';
  return 'stationary';
}

export function readIMU(
  state: IMUHALState,
  tick: number
): { state: IMUHALState; reading: IMUReading | null } {
  if (state.status === 'error' || state.status === 'offline') {
    return { state, reading: null };
  }
  const raw = simulateIMUValues(tick);
  const partial = { ...raw, motionState: 'unknown' as MotionState, confidence: 0.92 };
  const reading: IMUReading = { ...partial, motionState: classifyMotionState(partial) };

  return {
    state: { ...state, lastReading: reading, readingCount: state.readingCount + 1 },
    reading,
  };
}

export function getHeading(reading: IMUReading): number {
  return ((reading.headingDeg % 360) + 360) % 360;
}

export function detectFall(reading: IMUReading): boolean {
  return reading.motionState === 'falling';
}

export function setIMUError(state: IMUHALState): IMUHALState {
  return {
    ...state,
    status: 'error',
    errorCount: state.errorCount + 1,
    lastReading: null,
  };
}

export function restartIMU(state: IMUHALState, tick: number): IMUHALState {
  if (state.restartCount >= MAX_RESTART_ATTEMPTS) {
    return { ...state, status: 'error' };
  }
  return {
    ...state,
    status: 'initializing',
    errorCount: 0,
    restartCount: state.restartCount + 1,
    lastReading: null,
  };
}

export function completeIMURestart(state: IMUHALState): IMUHALState {
  if (state.status !== 'initializing') return state;
  return { ...state, status: 'ready' };
}

export function getIMUHealth(state: IMUHALState): SensorHealthReport {
  const issues: string[] = [];
  if (state.status === 'error') issues.push('IMU in error state');
  if (state.lastReading === null && state.status === 'ready') issues.push('No readings yet');
  if (state.restartCount >= MAX_RESTART_ATTEMPTS) issues.push('Max restart attempts reached');

  return {
    component: 'imu',
    deviceId: state.deviceId,
    status: state.status,
    errorCount: state.errorCount,
    restartCount: state.restartCount,
    issues,
    shouldRestart: state.status === 'error' && state.restartCount < MAX_RESTART_ATTEMPTS,
  };
}

export function getIMUDriver(platform: string): string {
  const drivers: Record<string, string> = {
    simulation:       SIMULATION_DRIVER,
    prototype:        'mpu6050',
    'android-xr':     'android-sensor-api',
    'linux-wearable': 'iio-imu',
    'denarixx-v1':    'denarixx-imu-native',
  };
  return drivers[platform] ?? SIMULATION_DRIVER;
}

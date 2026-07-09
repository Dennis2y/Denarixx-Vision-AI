// ─── Sprint 17: Sensor Manager Engine ────────────────────────────────────────
// Pure functions — no async, no I/O.
// Coordinates all HALs, monitors failures, auto-restarts where appropriate.
// Reports health to the Glasses Runtime (Sprint 16).

import type {
  CameraHALState,
  MicrophoneHALState,
  IMUHALState,
  GPSHALState,
  BatteryHALState,
  DisplayHALState,
  SensorHealthReport,
  HALComponentType,
} from '@/types/hardwareHAL';
import { MAX_RESTART_ATTEMPTS, RESTART_COOLDOWN_TICKS } from '@/types/hardwareHAL';
import { getCameraHealth, restartCamera, shouldRestartCamera } from './cameraHAL';
import { getMicHealth, restartMic } from './microphoneHAL';
import { getSpeakerHealth } from './speakerHAL';
import { getIMUHealth, restartIMU } from './imuHAL';
import { getGPSHealth, restartGPS } from './gpsHAL';
import { getBatteryHealth } from './batteryHAL';
import { getDisplayHealth } from './displayHAL';
import type { SpeakerHALState } from '@/types/hardwareHAL';

// ─── Sensor Manager State ─────────────────────────────────────────────────────

export interface SensorManagerState {
  cameras: CameraHALState[];
  microphones: MicrophoneHALState[];
  speakers: SpeakerHALState[];
  imu: IMUHALState | null;
  gps: GPSHALState | null;
  battery: BatteryHALState | null;
  display: DisplayHALState | null;
  lastHealthCheckTick: number;
  restartCooldowns: Record<string, number>;
}

export function createSensorManager(): SensorManagerState {
  return {
    cameras: [],
    microphones: [],
    speakers: [],
    imu: null,
    gps: null,
    battery: null,
    display: null,
    lastHealthCheckTick: 0,
    restartCooldowns: {},
  };
}

export function registerCamera(
  manager: SensorManagerState,
  cam: CameraHALState
): SensorManagerState {
  return { ...manager, cameras: [...manager.cameras, cam] };
}

export function registerMicrophone(
  manager: SensorManagerState,
  mic: MicrophoneHALState
): SensorManagerState {
  return { ...manager, microphones: [...manager.microphones, mic] };
}

export function registerSpeaker(
  manager: SensorManagerState,
  speaker: SpeakerHALState
): SensorManagerState {
  return { ...manager, speakers: [...manager.speakers, speaker] };
}

export function registerIMU(
  manager: SensorManagerState,
  imu: IMUHALState
): SensorManagerState {
  return { ...manager, imu };
}

export function registerGPS(
  manager: SensorManagerState,
  gps: GPSHALState
): SensorManagerState {
  return { ...manager, gps };
}

export function registerBattery(
  manager: SensorManagerState,
  battery: BatteryHALState
): SensorManagerState {
  return { ...manager, battery };
}

export function registerDisplay(
  manager: SensorManagerState,
  display: DisplayHALState
): SensorManagerState {
  return { ...manager, display };
}

// ─── Health Checks ────────────────────────────────────────────────────────────

export function buildHealthReports(
  manager: SensorManagerState
): SensorHealthReport[] {
  const reports: SensorHealthReport[] = [];

  for (const cam of manager.cameras) {
    reports.push(getCameraHealth(cam));
  }
  for (const mic of manager.microphones) {
    reports.push(getMicHealth(mic));
  }
  for (const spk of manager.speakers) {
    reports.push(getSpeakerHealth(spk));
  }
  if (manager.imu) reports.push(getIMUHealth(manager.imu));
  if (manager.gps) reports.push(getGPSHealth(manager.gps));
  if (manager.battery) reports.push(getBatteryHealth(manager.battery));
  if (manager.display) reports.push(getDisplayHealth(manager.display));

  return reports;
}

export function runHealthChecks(
  manager: SensorManagerState,
  tick: number
): { manager: SensorManagerState; reports: SensorHealthReport[] } {
  const reports = buildHealthReports(manager);
  return { manager: { ...manager, lastHealthCheckTick: tick }, reports };
}

export function isAnyHALCritical(reports: SensorHealthReport[]): boolean {
  return reports.some(r => r.status === 'error' || r.status === 'offline');
}

export function getHealthyCount(reports: SensorHealthReport[]): number {
  return reports.filter(r => r.status === 'ready').length;
}

// ─── Auto-Restart ─────────────────────────────────────────────────────────────

function isOnCooldown(
  manager: SensorManagerState,
  deviceId: string,
  tick: number
): boolean {
  const cooldownUntil = manager.restartCooldowns[deviceId] ?? 0;
  return tick < cooldownUntil;
}

function setCooldown(
  manager: SensorManagerState,
  deviceId: string,
  tick: number
): SensorManagerState {
  return {
    ...manager,
    restartCooldowns: {
      ...manager.restartCooldowns,
      [deviceId]: tick + RESTART_COOLDOWN_TICKS,
    },
  };
}

export function autoRestartFailedSensors(
  manager: SensorManagerState,
  tick: number
): SensorManagerState {
  let m = { ...manager };

  m = {
    ...m,
    cameras: m.cameras.map(cam => {
      if (shouldRestartCamera(cam) && !isOnCooldown(m, cam.deviceId, tick)) {
        m = setCooldown(m, cam.deviceId, tick);
        return restartCamera(cam, tick);
      }
      return cam;
    }),
  };

  m = {
    ...m,
    microphones: m.microphones.map(mic => {
      if (mic.status === 'error' && mic.restartCount < MAX_RESTART_ATTEMPTS && !isOnCooldown(m, mic.deviceId, tick)) {
        m = setCooldown(m, mic.deviceId, tick);
        return restartMic(mic);
      }
      return mic;
    }),
  };

  const currentImu = m.imu;
  if (currentImu && currentImu.status === 'error' && currentImu.restartCount < MAX_RESTART_ATTEMPTS && !isOnCooldown(m, currentImu.deviceId, tick)) {
    m = setCooldown(m, currentImu.deviceId, tick);
    m = { ...m, imu: restartIMU(currentImu, tick) };
  }

  const currentGps = m.gps;
  if (currentGps && currentGps.status === 'error' && !isOnCooldown(m, currentGps.deviceId, tick)) {
    m = setCooldown(m, currentGps.deviceId, tick);
    m = { ...m, gps: restartGPS(currentGps) };
  }

  return m;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export function getSensorManagerSummary(manager: SensorManagerState): {
  total: number;
  healthy: number;
  errored: number;
  restarting: number;
} {
  const reports = buildHealthReports(manager);
  return {
    total: reports.length,
    healthy: reports.filter(r => r.status === 'ready').length,
    errored: reports.filter(r => r.status === 'error').length,
    restarting: reports.filter(r => r.status === 'initializing').length,
  };
}

export function getCriticalHealthIssues(manager: SensorManagerState): string[] {
  const reports = buildHealthReports(manager);
  return reports
    .filter(r => r.status === 'error' || r.status === 'offline')
    .flatMap(r => r.issues);
}

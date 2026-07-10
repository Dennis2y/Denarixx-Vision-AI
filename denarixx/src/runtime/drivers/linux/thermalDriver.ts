// ─── Thermal Driver ───────────────────────────────────────────────────────────
// Linux thermal zone driver for SoC and case temperature monitoring.
//
// Real implementation (Linux — no native binding required):
//   /sys/class/thermal/thermal_zone0/temp → SoC temperature in millidegrees C
//   /sys/class/thermal/thermal_zone1/temp → GPU / other zone (device-dependent)
//   Read: fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')
//         → parseInt(value) / 1000 → degrees Celsius
//
// This driver CAN be implemented on Linux with only fs.readFileSync.
// No native binding required — thermal zones are sysfs pseudo-files.
//
// Thermal thresholds (SoC):
//   > 80°C: warn — consider reducing frame rate
//   > 90°C: critical — reduce to minimum processing, announce overheating
//   > 95°C: emergency shutdown — announce + safe stop
//
// Throttling policy:
//   > 80°C → drop to 5 FPS
//   > 90°C → pause vision processing; only Guardian + audio active
//   > 95°C → initiate graceful shutdown

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThermalDriverStatus = 'not-initialized' | 'ready' | 'warm' | 'hot' | 'critical' | 'unavailable' | 'closed';
export type ThermalZoneSeverity = 'normal' | 'warm' | 'hot' | 'critical' | 'emergency';

export interface ThermalZoneConfig {
  zonePath: string;      // e.g. /sys/class/thermal/thermal_zone0
  label: string;         // e.g. 'SoC', 'GPU', 'battery'
  warnThresholdC: number;
  criticalThresholdC: number;
  emergencyThresholdC: number;
}

export interface ThermalReading {
  zoneLabel: string;
  temperatureC: number;
  severity: ThermalZoneSeverity;
  timestampMs: number;
  isSimulated: false;
}

export interface ThermalDriverState {
  zones: ThermalZoneConfig[];
  status: ThermalDriverStatus;
  readCount: number;
  lastReadings: ThermalReading[];
  errorCount: number;
  lastErrorMessage: string | null;
}

// ─── Default Zones ────────────────────────────────────────────────────────────

export function defaultThermalZoneConfigs(): ThermalZoneConfig[] {
  return [
    {
      zonePath: '/sys/class/thermal/thermal_zone0',
      label: 'SoC',
      warnThresholdC: 80,
      criticalThresholdC: 90,
      emergencyThresholdC: 95,
    },
    {
      zonePath: '/sys/class/thermal/thermal_zone1',
      label: 'GPU',
      warnThresholdC: 80,
      criticalThresholdC: 90,
      emergencyThresholdC: 95,
    },
  ];
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createThermalDriverState(zones: ThermalZoneConfig[]): ThermalDriverState {
  return { zones, status: 'not-initialized', readCount: 0, lastReadings: [], errorCount: 0, lastErrorMessage: null };
}

// ─── Initialize ───────────────────────────────────────────────────────────────
// Thermal sysfs is readable without native bindings on any Linux device.

export function initializeThermalDriver(
  state: ThermalDriverState,
): { state: ThermalDriverState; error: string | null } {
  const thermalBase = '/sys/class/thermal';
  if (!fs.existsSync(thermalBase)) {
    const error = `Thermal sysfs not found at ${thermalBase}. Not running on a Linux device.`;
    return { state: { ...state, status: 'unavailable', lastErrorMessage: error }, error };
  }

  // Check at least one zone is accessible
  const anyZoneReadable = state.zones.some(z => fs.existsSync(path.join(z.zonePath, 'temp')));
  if (!anyZoneReadable) {
    const error = `No thermal zones found. Available zones: ` +
      (fs.existsSync(thermalBase) ? fs.readdirSync(thermalBase).join(', ') : 'none');
    return { state: { ...state, status: 'unavailable', lastErrorMessage: error }, error };
  }

  return { state: { ...state, status: 'ready' }, error: null };
}

// ─── Read Temperatures ────────────────────────────────────────────────────────
// This function DOES read real values from sysfs on a Linux device.
// On non-Linux: returns error with no fabricated readings.

export function readThermalZones(
  state: ThermalDriverState,
): { state: ThermalDriverState; readings: ThermalReading[]; error: string | null } {
  if (state.status === 'unavailable' || state.status === 'not-initialized') {
    return { state, readings: [], error: `Thermal driver not available: ${state.status}` };
  }

  const readings: ThermalReading[] = [];
  const errors: string[] = [];
  const nowMs = Date.now();

  for (const zone of state.zones) {
    const tempFile = path.join(zone.zonePath, 'temp');
    if (!fs.existsSync(tempFile)) continue;
    try {
      const raw = fs.readFileSync(tempFile, 'utf8').trim();
      const millidegrees = parseInt(raw, 10);
      if (isNaN(millidegrees)) { errors.push(`Invalid temp reading at ${tempFile}: ${raw}`); continue; }
      const tempC = millidegrees / 1000;
      const severity: ThermalZoneSeverity =
        tempC >= zone.emergencyThresholdC ? 'emergency' :
        tempC >= zone.criticalThresholdC  ? 'critical' :
        tempC >= zone.warnThresholdC      ? 'hot' :
        tempC >= zone.warnThresholdC - 10 ? 'warm' : 'normal';
      readings.push({ zoneLabel: zone.label, temperatureC: tempC, severity, timestampMs: nowMs, isSimulated: false });
    } catch (e) {
      errors.push(`Failed to read ${tempFile}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const maxSeverity = readings.reduce((max, r) => {
    const order = ['normal', 'warm', 'hot', 'critical', 'emergency'];
    return order.indexOf(r.severity) > order.indexOf(max) ? r.severity : max;
  }, 'normal' as ThermalZoneSeverity);

  const status: ThermalDriverStatus =
    maxSeverity === 'emergency' || maxSeverity === 'critical' ? 'critical' :
    maxSeverity === 'hot' ? 'hot' :
    maxSeverity === 'warm' ? 'warm' : 'ready';

  const newState: ThermalDriverState = {
    ...state,
    status,
    readCount: state.readCount + 1,
    lastReadings: readings,
    errorCount: state.errorCount + errors.length,
    lastErrorMessage: errors.length > 0 ? errors.join('; ') : state.lastErrorMessage,
  };

  return { state: newState, readings, error: errors.length > 0 ? errors.join('; ') : null };
}

// ─── Health + Shutdown ────────────────────────────────────────────────────────

export function getThermalDriverHealth(state: ThermalDriverState): ThermalDriverStatus {
  return state.status;
}

export function shutdownThermalDriver(state: ThermalDriverState): ThermalDriverState {
  return { ...state, status: 'closed' };
}

// ─── Sprint 20: Firmware Bridge Engine ────────────────────────────────────────

import type {
  FirmwareBridgeState,
  FirmwareInfo,
  FirmwareSensorRecord,
  FirmwareHealthReport,
  HardwareInterfaceType,
} from '@/types/prototype';

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createFirmwareBridge(deviceId: string): FirmwareBridgeState {
  return {
    deviceId,
    firmwareInfo: null,
    discoveryComplete: false,
    sensorRegistry: [],
    healthStatus: 'unknown',
    otaAvailable: false,
    otaVersion: null,
    lastHeartbeatTs: 0,
    firmwareState: 'unknown',
    capabilityFlags: {},
  };
}

// ─── Discovery ────────────────────────────────────────────────────────────────

export function startDiscovery(state: FirmwareBridgeState): FirmwareBridgeState {
  return {
    ...state,
    firmwareState: 'initializing',
    discoveryComplete: false,
    sensorRegistry: [],
    healthStatus: 'unknown',
  };
}

export function registerSensor(
  state: FirmwareBridgeState,
  record: FirmwareSensorRecord,
): FirmwareBridgeState {
  const existing = state.sensorRegistry.find(s => s.sensorId === record.sensorId);
  if (existing) {
    return {
      ...state,
      sensorRegistry: state.sensorRegistry.map(s =>
        s.sensorId === record.sensorId ? record : s,
      ),
    };
  }
  return {
    ...state,
    sensorRegistry: [...state.sensorRegistry, record],
  };
}

export function completeDiscovery(state: FirmwareBridgeState): FirmwareBridgeState {
  const registered = state.sensorRegistry.filter(s => s.registered).length;
  const total = state.sensorRegistry.length;
  const failed = total - registered;

  let healthStatus: FirmwareBridgeState['healthStatus'] = 'healthy';
  if (total === 0) {
    healthStatus = 'unknown';
  } else if (failed === 0) {
    healthStatus = 'healthy';
  } else if (failed <= 2) {
    healthStatus = 'degraded';
  } else {
    healthStatus = 'critical';
  }

  return {
    ...state,
    discoveryComplete: true,
    firmwareState: 'ready',
    healthStatus,
  };
}

export function getDiscoverySummary(
  state: FirmwareBridgeState,
): { discovered: number; failed: number; complete: boolean } {
  const registered = state.sensorRegistry.filter(s => s.registered).length;
  return {
    discovered: registered,
    failed: state.sensorRegistry.length - registered,
    complete: state.discoveryComplete,
  };
}

// ─── Firmware version ─────────────────────────────────────────────────────────

export function setFirmwareInfo(
  state: FirmwareBridgeState,
  info: FirmwareInfo,
): FirmwareBridgeState {
  const capabilityFlags: Record<string, boolean> = {};
  for (const cap of info.capabilities) {
    capabilityFlags[cap] = true;
  }
  return {
    ...state,
    firmwareInfo: info,
    capabilityFlags,
  };
}

export function getFirmwareVersion(state: FirmwareBridgeState): string {
  return state.firmwareInfo?.version ?? 'unknown';
}

export function isVersionCompatible(
  state: FirmwareBridgeState,
  requiredHalVersion: string,
): boolean {
  if (!state.firmwareInfo) return false;
  return state.firmwareInfo.halVersion === requiredHalVersion;
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

export function hasCapability(state: FirmwareBridgeState, capability: string): boolean {
  return state.capabilityFlags[capability] === true;
}

export function getCapabilities(state: FirmwareBridgeState): string[] {
  return Object.keys(state.capabilityFlags).filter(k => state.capabilityFlags[k]);
}

// ─── Health reporting ─────────────────────────────────────────────────────────

export function buildHealthReport(
  state: FirmwareBridgeState,
  uptimeSeconds: number,
): FirmwareHealthReport {
  const registered = state.sensorRegistry.filter(s => s.registered).length;
  const failed = state.sensorRegistry.length - registered;
  return {
    deviceId: state.deviceId,
    healthStatus: state.healthStatus,
    registeredSensors: registered,
    failedSensors: failed,
    firmwareVersion: getFirmwareVersion(state),
    uptime: uptimeSeconds,
  };
}

export function recordHeartbeat(
  state: FirmwareBridgeState,
  ts: number,
): FirmwareBridgeState {
  return { ...state, lastHeartbeatTs: ts };
}

export function isHeartbeatStale(state: FirmwareBridgeState, nowTs: number, maxAgeMs = 10000): boolean {
  if (state.lastHeartbeatTs === 0) return true;
  return nowTs - state.lastHeartbeatTs > maxAgeMs;
}

// ─── OTA ──────────────────────────────────────────────────────────────────────

export function checkForOTA(
  state: FirmwareBridgeState,
  latestVersion: string,
): { available: boolean; version: string | null } {
  if (!state.firmwareInfo) return { available: false, version: null };
  const current = state.firmwareInfo.version;
  const available = current !== latestVersion;
  return { available, version: available ? latestVersion : null };
}

export function setOTAAvailable(
  state: FirmwareBridgeState,
  version: string,
): FirmwareBridgeState {
  return { ...state, otaAvailable: true, otaVersion: version };
}

export function beginOTA(state: FirmwareBridgeState): FirmwareBridgeState {
  return { ...state, firmwareState: 'updating' };
}

export function completeOTA(
  state: FirmwareBridgeState,
  newVersion: string,
): FirmwareBridgeState {
  if (!state.firmwareInfo) return state;
  return {
    ...state,
    firmwareInfo: { ...state.firmwareInfo, version: newVersion },
    otaAvailable: false,
    otaVersion: null,
    firmwareState: 'ready',
    discoveryComplete: false, // re-register sensors after OTA
    sensorRegistry: [],
  };
}

// ─── Sensor queries ───────────────────────────────────────────────────────────

export function getRegisteredSensors(state: FirmwareBridgeState): FirmwareSensorRecord[] {
  return state.sensorRegistry.filter(s => s.registered);
}

export function getSensorByType(
  state: FirmwareBridgeState,
  type: HardwareInterfaceType,
): FirmwareSensorRecord | undefined {
  return state.sensorRegistry.find(s => s.type === type);
}

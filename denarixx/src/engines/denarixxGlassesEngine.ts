// ─── V16 Denarixx Glasses Engine ──────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Main glasses device profile, connection state machine, health scoring.

import type {
  DenarixxGlassesState,
  GlassesDeviceProfile,
  ConnectionState,
  HardwareMode,
  PowerProfile,
  PhoneCompanionState,
  ComponentStatus,
} from '@/types/denarixxGlasses';
import {
  GLASSES_DISCONNECT_MESSAGE,
  BATTERY_CRITICAL_THRESHOLD,
  CONNECTION_RSSI_WEAK_DBM,
} from '@/types/denarixxGlasses';

// ─── Default Device Profile ───────────────────────────────────────────────────

export function createDefaultGlassesProfile(): GlassesDeviceProfile {
  return {
    productName: 'Denarixx Vision Glasses v1',
    firmwareVersion: '0.1.0-prototype',
    firmwareChannel: 'dev',
    hardwareRevision: 'DVG-r1',
    serialPlaceholder: '[prototype-unit]',
    bluetoothAvailable: true,
    wifiDirectAvailable: false,
    usbCAvailable: true,
    cameras: [
      {
        id: 'front',
        position: 'front',
        resolutionWidth: 1920,
        resolutionHeight: 1080,
        fovDegrees: 80,
        targetFPS: 30,
        hasNightVision: false,
        hasDepthSensor: false,
        status: 'ok',
      },
      {
        id: 'left',
        position: 'left',
        resolutionWidth: 1280,
        resolutionHeight: 720,
        fovDegrees: 100,
        targetFPS: 15,
        hasNightVision: false,
        hasDepthSensor: false,
        status: 'ok',
      },
      {
        id: 'right',
        position: 'right',
        resolutionWidth: 1280,
        resolutionHeight: 720,
        fovDegrees: 100,
        targetFPS: 15,
        hasNightVision: false,
        hasDepthSensor: false,
        status: 'ok',
      },
      {
        id: 'downward',
        position: 'downward',
        resolutionWidth: 640,
        resolutionHeight: 480,
        fovDegrees: 120,
        targetFPS: 10,
        hasNightVision: false,
        hasDepthSensor: true,
        status: 'ok',
      },
    ],
    microphone: {
      channels: 2,
      sampleRateHz: 16000,
      hasNoiseCancellation: true,
      hasSpatialAudio: false,
      status: 'ok',
    },
    boneAudio: {
      driverType: 'piezoelectric',
      maxVolumeDb: 85,
      frequencyRangeHz: [200, 8000],
      hasVolumeControl: true,
      status: 'ok',
    },
    haptic: {
      motorCount: 2,
      supportsIntensityControl: true,
      maxPatternDurationMs: 3000,
      status: 'ok',
    },
  };
}

// ─── State Factory ────────────────────────────────────────────────────────────

export function createDenarixxGlassesState(): DenarixxGlassesState {
  return {
    profile: createDefaultGlassesProfile(),
    connection: 'disconnected',
    hardwareMode: 'phone_only',
    power: {
      batteryPct: 100,
      isCharging: false,
      thermalState: 'normal',
      estimatedRemainingMinutes: 240,
      voltageV: 3.85,
      currentMa: 220,
    },
    phoneCompanion: {
      connected: true,
      protocol: 'bluetooth_le',
      rssiDbm: -60,
      latencyMs: 12,
      companionAppVersion: '1.0.0',
    },
    cameraStatus: 'offline',
    audioStatus: 'offline',
    hapticStatus: 'offline',
    thermalState: 'normal',
    emergencyFallbackActive: false,
    emergencyFallbackReason: '',
    lastUpdated: Date.now(),
  };
}

// ─── Connection State Machine ─────────────────────────────────────────────────

export function connectGlasses(
  state: DenarixxGlassesState,
): DenarixxGlassesState {
  return {
    ...state,
    connection: 'connected',
    hardwareMode: 'glasses_primary',
    cameraStatus: 'ok',
    audioStatus: 'ok',
    hapticStatus: 'ok',
    emergencyFallbackActive: false,
    emergencyFallbackReason: '',
    lastUpdated: Date.now(),
  };
}

export function disconnectGlasses(
  state: DenarixxGlassesState,
  reason = '',
): DenarixxGlassesState {
  return {
    ...state,
    connection: 'disconnected',
    hardwareMode: 'phone_only',
    cameraStatus: 'offline',
    audioStatus: 'offline',
    hapticStatus: 'offline',
    emergencyFallbackActive: true,
    emergencyFallbackReason: reason || GLASSES_DISCONNECT_MESSAGE,
    lastUpdated: Date.now(),
  };
}

export function setConnectionDegraded(
  state: DenarixxGlassesState,
  reason: string,
): DenarixxGlassesState {
  return {
    ...state,
    connection: 'degraded',
    hardwareMode: 'degraded_safety',
    emergencyFallbackActive: true,
    emergencyFallbackReason: reason,
    lastUpdated: Date.now(),
  };
}

// ─── Safety Messages ──────────────────────────────────────────────────────────

export function getDisconnectMessage(): string {
  return GLASSES_DISCONNECT_MESSAGE;
}

export function getEmergencyMessage(state: DenarixxGlassesState): string {
  if (state.emergencyFallbackActive && state.emergencyFallbackReason) {
    return state.emergencyFallbackReason;
  }
  return '';
}

// ─── Health Scoring ───────────────────────────────────────────────────────────

export function getConnectionHealthScore(state: DenarixxGlassesState): number {
  if (state.connection === 'disconnected') return 0;
  if (state.connection === 'connecting') return 10;

  let score = 100;

  // RSSI penalty
  const rssi = state.phoneCompanion.rssiDbm;
  if (rssi !== null && rssi < CONNECTION_RSSI_WEAK_DBM) score -= 30;
  else if (rssi !== null && rssi < -70) score -= 15;

  // Component penalties
  if (state.cameraStatus === 'failed') score -= 30;
  else if (state.cameraStatus === 'degraded') score -= 15;

  if (state.audioStatus === 'failed') score -= 20;
  else if (state.audioStatus === 'degraded') score -= 10;

  if (state.hapticStatus === 'failed') score -= 10;

  // Thermal penalty
  if (state.thermalState === 'throttling') score -= 20;
  else if (state.thermalState === 'hot') score -= 10;

  // Battery penalty
  if (state.power.batteryPct <= BATTERY_CRITICAL_THRESHOLD) score -= 20;

  return Math.max(0, Math.min(100, score));
}

export function getHealthLabel(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'degraded';
  if (score >= 20) return 'poor';
  return 'critical';
}

export function formatHealthScore(score: number): string {
  const label = getHealthLabel(score);
  const emoji: Record<string, string> = { excellent: '🟢', good: '🟡', degraded: '🟠', poor: '🔴', critical: '🔴' };
  return `${emoji[label]} ${score}/100 (${label})`;
}

// ─── Component Status ─────────────────────────────────────────────────────────

export function updateCameraStatus(
  state: DenarixxGlassesState,
  status: ComponentStatus,
): DenarixxGlassesState {
  return { ...state, cameraStatus: status, lastUpdated: Date.now() };
}

export function updateAudioStatus(
  state: DenarixxGlassesState,
  status: ComponentStatus,
): DenarixxGlassesState {
  return { ...state, audioStatus: status, lastUpdated: Date.now() };
}

export function updateHapticStatus(
  state: DenarixxGlassesState,
  status: ComponentStatus,
): DenarixxGlassesState {
  return { ...state, hapticStatus: status, lastUpdated: Date.now() };
}

// ─── Simulation Tick ──────────────────────────────────────────────────────────

export function simulateGlassesTick(
  state: DenarixxGlassesState,
  tick: number,
): DenarixxGlassesState {
  if (state.connection !== 'connected') return state;

  // Gentle RSSI drift
  const rssiBase = -60;
  const rssiDrift = Math.sin(tick * 0.4) * 8;
  const newRssi = Math.round(rssiBase + rssiDrift);

  // Latency jitter
  const latencyBase = 12;
  const latencyJitter = Math.abs(Math.sin(tick * 0.7)) * 5;

  return {
    ...state,
    phoneCompanion: {
      ...state.phoneCompanion,
      rssiDbm: newRssi,
      latencyMs: Math.round(latencyBase + latencyJitter),
    },
    lastUpdated: Date.now(),
  };
}

// ─── Mode Helpers ─────────────────────────────────────────────────────────────

export function isGlassesActive(state: DenarixxGlassesState): boolean {
  return state.connection === 'connected';
}

export function requiresPhoneFallback(state: DenarixxGlassesState): boolean {
  return state.connection !== 'connected' || state.cameraStatus === 'failed';
}

export function getActiveConnectionProtocol(
  state: DenarixxGlassesState,
): string {
  if (!isGlassesActive(state)) return 'none';
  return state.phoneCompanion.protocol;
}

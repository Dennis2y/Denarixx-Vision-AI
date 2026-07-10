// ─── Bring-Up Program: Simulation Test Adapter ────────────────────────────────
// Pure functions — no async, no I/O.
// All inputs synthetic. For CI, unit tests, and development without hardware.
// Clearly labeled: every output carries isSimulated: true.

import type {
  CameraAdapter, CameraFrame,
  MicrophoneAdapter, AudioFrame,
  AudioOutputAdapter,
  HapticAdapter,
  IMUAdapter, IMUReading,
  BatteryAdapter, BatteryReading,
  NetworkAdapter, NetworkStatus,
  ButtonAdapter, ButtonEvent,
  AdapterHealthStatus,
} from './hardwareAdapterTypes';
import type { HardwareAdapterMode } from '@/types/localInference';

const MODE: HardwareAdapterMode = 'simulation-test';

// ─── Camera ───────────────────────────────────────────────────────────────────

export function createSimulationCameraAdapter(): CameraAdapter {
  return {
    mode: MODE,
    id: 'sim-camera-0',
    isAvailable: () => true,
    getLastFrame: (tick: number): CameraFrame => ({
      frameId: tick,
      timestampMs: Date.now(),
      width: 640,
      height: 480,
      source: MODE,
      isSimulated: true,
    }),
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };
}

// ─── Microphone ───────────────────────────────────────────────────────────────

export function createSimulationMicrophoneAdapter(): MicrophoneAdapter {
  let wakeWordTick = 50;
  return {
    mode: MODE,
    id: 'sim-mic-0',
    isAvailable: () => true,
    getLastFrame: (tick: number): AudioFrame => ({
      frameId: tick,
      timestampMs: Date.now(),
      peakAmplitude: 0.1,
      wakeWordDetected: tick === wakeWordTick,
      speechDetected: false,
      source: MODE,
      isSimulated: true,
    }),
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };
}

// ─── Audio Output ─────────────────────────────────────────────────────────────

export function createSimulationAudioOutputAdapter(): AudioOutputAdapter {
  return {
    mode: MODE,
    id: 'sim-audio-out-0',
    isAvailable: () => true,
    canSpeak: () => true,
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };
}

// ─── Haptic ───────────────────────────────────────────────────────────────────

export function createSimulationHapticAdapter(): HapticAdapter {
  return {
    mode: MODE,
    id: 'sim-haptic-0',
    isAvailable: () => true,
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };
}

// ─── IMU ──────────────────────────────────────────────────────────────────────

export function createSimulationIMUAdapter(): IMUAdapter {
  return {
    mode: MODE,
    id: 'sim-imu-0',
    isAvailable: () => true,
    getLastReading: (tick: number): IMUReading => ({
      tick,
      timestampMs: Date.now(),
      accelX: 0.01,
      accelY: 0.02,
      accelZ: 9.81,
      gyroX: 0,
      gyroY: 0,
      gyroZ: 0,
      headingDeg: (tick * 2) % 360,
      motionState: tick % 20 < 15 ? 'walking' : 'stationary',
      isSimulated: true,
    }),
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };
}

// ─── Battery ──────────────────────────────────────────────────────────────────

export function createSimulationBatteryAdapter(
  startPct = 80,
  drainPerTickPct = 0.1,
): BatteryAdapter {
  return {
    mode: MODE,
    id: 'sim-battery-0',
    isAvailable: () => true,
    getLastReading: (tick: number): BatteryReading => {
      const pct = Math.max(0, startPct - tick * drainPerTickPct);
      return {
        timestampMs: Date.now(),
        percentagePct: Math.round(pct * 10) / 10,
        temperatureC: 35 + Math.sin(tick * 0.05) * 5,
        isCharging: false,
        estimatedMinutesRemaining: Math.round(pct * 2.25),
        isSimulated: true,
      };
    },
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };
}

// ─── Network ──────────────────────────────────────────────────────────────────

export function createSimulationNetworkAdapter(online = true): NetworkAdapter {
  return {
    mode: MODE,
    id: 'sim-network-0',
    getStatus: (): NetworkStatus => ({
      isOnline: online,
      quality: online ? 'good' : 'offline',
      lastCheckedMs: Date.now(),
    }),
  };
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

export function createSimulationButtonAdapter(
  scheduledEvents: ButtonEvent[] = [],
): ButtonAdapter {
  let remaining = [...scheduledEvents];
  return {
    mode: MODE,
    id: 'sim-buttons-0',
    isAvailable: () => true,
    pollEvents: (): ButtonEvent[] => {
      const events = remaining.filter(e => e.timestampMs <= Date.now());
      remaining = remaining.filter(e => e.timestampMs > Date.now());
      return events;
    },
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };
}

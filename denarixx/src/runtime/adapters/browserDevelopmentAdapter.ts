// ─── Bring-Up Program: Browser Development Adapter ───────────────────────────
// Pure functions — no async, no I/O.
// Wraps browser APIs (getUserMedia, Web Speech, Battery API, DeviceMotion).
// Used on phone/laptop browser during development. Not for production glasses.
// Reads browser capability at construction time; returns unavailable if missing.

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

const MODE: HardwareAdapterMode = 'browser-development';

// ─── Camera ───────────────────────────────────────────────────────────────────

export function createBrowserCameraAdapter(streamAvailable: boolean): CameraAdapter {
  return {
    mode: MODE,
    id: 'browser-camera-0',
    isAvailable: () => streamAvailable,
    getLastFrame: (tick: number): CameraFrame | null => {
      if (!streamAvailable) return null;
      return {
        frameId: tick,
        timestampMs: Date.now(),
        width: 1280,
        height: 720,
        stride: 0,
        pixelFormat: 'unknown',
        pixels: null,   // raw bytes captured separately via canvas.getImageData in browser
        source: MODE,
        isSimulated: false,
      };
    },
    getHealthStatus: (): AdapterHealthStatus =>
      streamAvailable ? 'healthy' : 'unavailable',
  };
}

// ─── Microphone ───────────────────────────────────────────────────────────────

export function createBrowserMicrophoneAdapter(streamAvailable: boolean): MicrophoneAdapter {
  return {
    mode: MODE,
    id: 'browser-mic-0',
    isAvailable: () => streamAvailable,
    getLastFrame: (tick: number): AudioFrame | null => {
      if (!streamAvailable) return null;
      return {
        frameId: tick,
        timestampMs: Date.now(),
        peakAmplitude: 0,
        wakeWordDetected: false,
        speechDetected: false,
        source: MODE,
        isSimulated: false,
      };
    },
    getHealthStatus: (): AdapterHealthStatus =>
      streamAvailable ? 'healthy' : 'unavailable',
  };
}

// ─── Audio Output ─────────────────────────────────────────────────────────────

export function createBrowserAudioOutputAdapter(speechSynthAvailable: boolean): AudioOutputAdapter {
  return {
    mode: MODE,
    id: 'browser-audio-out-0',
    isAvailable: () => speechSynthAvailable,
    canSpeak: () => speechSynthAvailable,
    getHealthStatus: (): AdapterHealthStatus =>
      speechSynthAvailable ? 'healthy' : 'unavailable',
  };
}

// ─── Haptic ───────────────────────────────────────────────────────────────────

export function createBrowserHapticAdapter(vibrateAvailable: boolean): HapticAdapter {
  return {
    mode: MODE,
    id: 'browser-haptic-0',
    isAvailable: () => vibrateAvailable,
    getHealthStatus: (): AdapterHealthStatus =>
      vibrateAvailable ? 'healthy' : 'unavailable',
  };
}

// ─── IMU ──────────────────────────────────────────────────────────────────────

export function createBrowserIMUAdapter(
  deviceMotionAvailable: boolean,
  lastHeadingDeg: number = 0,
): IMUAdapter {
  return {
    mode: MODE,
    id: 'browser-imu-0',
    isAvailable: () => deviceMotionAvailable,
    getLastReading: (tick: number): IMUReading | null => {
      if (!deviceMotionAvailable) return null;
      return {
        tick,
        timestampMs: Date.now(),
        accelX: 0,
        accelY: 0,
        accelZ: 9.81,
        gyroX: 0,
        gyroY: 0,
        gyroZ: 0,
        headingDeg: lastHeadingDeg,
        motionState: 'unknown',
        isSimulated: false,
      };
    },
    getHealthStatus: (): AdapterHealthStatus =>
      deviceMotionAvailable ? 'healthy' : 'unavailable',
  };
}

// ─── Battery ──────────────────────────────────────────────────────────────────

export function createBrowserBatteryAdapter(
  batteryApiAvailable: boolean,
  lastPct: number = 80,
  lastTempC: number = 35,
): BatteryAdapter {
  return {
    mode: MODE,
    id: 'browser-battery-0',
    isAvailable: () => batteryApiAvailable,
    getLastReading: (_tick: number): BatteryReading | null => {
      if (!batteryApiAvailable) return null;
      return {
        timestampMs: Date.now(),
        percentagePct: lastPct,
        temperatureC: lastTempC,
        isCharging: false,
        estimatedMinutesRemaining: null,
        isSimulated: false,
      };
    },
    getHealthStatus: (): AdapterHealthStatus =>
      batteryApiAvailable ? 'healthy' : 'degraded',
  };
}

// ─── Network ──────────────────────────────────────────────────────────────────

export function createBrowserNetworkAdapter(isOnline: boolean): NetworkAdapter {
  return {
    mode: MODE,
    id: 'browser-network-0',
    getStatus: (): NetworkStatus => ({
      isOnline,
      quality: isOnline ? 'good' : 'offline',
      lastCheckedMs: Date.now(),
    }),
  };
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

export function createBrowserButtonAdapter(): ButtonAdapter {
  return {
    mode: MODE,
    id: 'browser-buttons-0',
    isAvailable: () => true,
    pollEvents: (): ButtonEvent[] => [],
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };
}

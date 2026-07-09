// ─── Sprint 17: Hardware Abstraction Layer Types ──────────────────────────────
// The AI communicates with the HAL, never directly with hardware.
// Hardware independence ensures Denarixx Vision AI works across all platforms.
// Never merge with src/types/hardware.ts (V8 — different abstraction layer).

// ─── Platform ─────────────────────────────────────────────────────────────────

export type HardwarePlatform =
  | 'simulation'       // Software simulation (current sprint)
  | 'prototype'        // Raspberry Pi / dev board
  | 'android-xr'       // Android XR smart glasses
  | 'linux-wearable'   // Linux-based smart glasses
  | 'denarixx-v1';     // First Denarixx custom hardware

export type HALDeviceStatus =
  | 'ready'
  | 'initializing'
  | 'error'
  | 'degraded'
  | 'offline';

export type HALComponentType =
  | 'camera'
  | 'microphone'
  | 'speaker'
  | 'imu'
  | 'gps'
  | 'battery'
  | 'display';

// ─── Camera ───────────────────────────────────────────────────────────────────

export type CameraFacing = 'front' | 'side-left' | 'side-right';
export type CameraResolution = '480p' | '720p' | '1080p';

export interface CameraFrame {
  deviceId: string;
  tick: number;
  width: number;
  height: number;
  confidence: number;
  simulated: true;
}

export interface CameraHALState {
  deviceId: string;
  facing: CameraFacing;
  resolution: CameraResolution;
  fps: number;
  status: HALDeviceStatus;
  frameCount: number;
  lastFrameTick: number;
  errorCount: number;
  restartCount: number;
  usingFallback: boolean;
  fallbackDeviceId: string | null;
}

// ─── Microphone ───────────────────────────────────────────────────────────────

export interface MicrophoneFrame {
  deviceId: string;
  tick: number;
  peakAmplitude: number;
  noiseLevel: number;
  wakeWordDetected: boolean;
  speechDetected: boolean;
  noiseReductionApplied: boolean;
}

export interface MicrophoneHALState {
  deviceId: string;
  status: HALDeviceStatus;
  isListeningForWakeWord: boolean;
  isCaptureActive: boolean;
  frameCount: number;
  errorCount: number;
  restartCount: number;
}

// ─── Speaker ──────────────────────────────────────────────────────────────────

export type SpeakerType = 'bone-conduction' | 'standard' | 'bluetooth';

export type SpeechPriority = 'emergency' | 'high' | 'normal' | 'low';

export interface SpeechQueueItem {
  id: string;
  text: string;
  priority: SpeechPriority;
  languageCode: string;
  timestamp: number;
}

export interface SpeakerHALState {
  deviceId: string;
  speakerType: SpeakerType;
  status: HALDeviceStatus;
  volume: number;
  isSpeaking: boolean;
  emergencyOverride: boolean;
  queue: SpeechQueueItem[];
  errorCount: number;
}

// ─── IMU ──────────────────────────────────────────────────────────────────────

export type MotionState =
  | 'stationary'
  | 'walking'
  | 'running'
  | 'falling'
  | 'unknown';

export interface IMUReading {
  tick: number;
  accelerometerX: number;
  accelerometerY: number;
  accelerometerZ: number;
  gyroscopeX: number;
  gyroscopeY: number;
  gyroscopeZ: number;
  magnetometerX: number;
  magnetometerY: number;
  magnetometerZ: number;
  headingDeg: number;
  motionState: MotionState;
  confidence: number;
}

export interface IMUHALState {
  deviceId: string;
  status: HALDeviceStatus;
  lastReading: IMUReading | null;
  readingCount: number;
  errorCount: number;
  restartCount: number;
}

// ─── GPS ──────────────────────────────────────────────────────────────────────

export type GPSQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unavailable';
export type PositioningMode =
  | 'gnss'
  | 'assisted'
  | 'offline-dead-reckoning'
  | 'unavailable';

export interface GPSReading {
  tick: number;
  latitude: number;
  longitude: number;
  altitudeM: number;
  accuracyM: number;
  speedMps: number;
  headingDeg: number;
  quality: GPSQuality;
  mode: PositioningMode;
}

export interface GPSHALState {
  deviceId: string;
  status: HALDeviceStatus;
  lastReading: GPSReading | null;
  fixAcquired: boolean;
  readingCount: number;
  errorCount: number;
  offlineMode: boolean;
}

// ─── Battery ──────────────────────────────────────────────────────────────────

export type ChargingState = 'charging' | 'discharging' | 'full' | 'unknown';
export type BatteryHealthStatus = 'good' | 'degraded' | 'replace';

export interface BatteryReading {
  tick: number;
  percentage: number;
  temperatureC: number;
  chargingState: ChargingState;
  health: BatteryHealthStatus;
  voltageV: number;
  estimatedLifeMinutes: number;
  criticalMode: boolean;
}

export interface BatteryHALState {
  deviceId: string;
  status: HALDeviceStatus;
  lastReading: BatteryReading | null;
  criticalBatteryActive: boolean;
  readingCount: number;
  errorCount: number;
}

// ─── Display ──────────────────────────────────────────────────────────────────

export type DisplayMode = 'hud' | 'low-power' | 'off' | 'ar-overlay';
export type BrightnessLevel = 'auto' | 'dim' | 'normal' | 'bright';

export interface DisplayHALState {
  deviceId: string;
  status: HALDeviceStatus;
  mode: DisplayMode;
  brightness: BrightnessLevel;
  brightnessNumeric: number;
  isOn: boolean;
  errorCount: number;
}

// ─── HAL Registration ─────────────────────────────────────────────────────────

export interface HALRegistration {
  component: HALComponentType;
  deviceId: string;
  platform: HardwarePlatform;
  driver: string;
}

// ─── Health Reports ───────────────────────────────────────────────────────────

export interface SensorHealthReport {
  component: HALComponentType;
  deviceId: string;
  status: HALDeviceStatus;
  errorCount: number;
  restartCount: number;
  issues: string[];
  shouldRestart: boolean;
}

export interface HALSystemState {
  platform: HardwarePlatform;
  initialized: boolean;
  registrations: HALRegistration[];
  healthyCount: number;
  totalCount: number;
  lastHealthCheckTick: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const HAL_SAFETY_NOTE =
  'The AI communicates with the HAL, never directly with hardware. ' +
  'Hardware independence ensures Denarixx Vision AI works across all platforms.';

export const SIMULATION_DRIVER = 'simulation';
export const MAX_RESTART_ATTEMPTS = 3;
export const RESTART_COOLDOWN_TICKS = 5;
export const HAL_CRITICAL_ERROR_THRESHOLD = 5;

export const SUPPORTED_PLATFORMS: HardwarePlatform[] = [
  'simulation',
  'prototype',
  'android-xr',
  'linux-wearable',
  'denarixx-v1',
];

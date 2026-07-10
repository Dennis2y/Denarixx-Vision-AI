// ─── Bring-Up Program: Hardware Adapter Interface ────────────────────────────
// Defines the adapter interface that the Guardian and navigation engines
// communicate with. Engines never know which adapter is active.
// Three adapters: browser-development | embedded-prototype | simulation-test

import type { HardwareAdapterMode } from '@/types/localInference';

// ─── Camera Adapter ───────────────────────────────────────────────────────────

export interface CameraFrame {
  frameId: number;
  timestampMs: number;
  width: number;
  height: number;
  source: HardwareAdapterMode;
  isSimulated: boolean;
}

export interface CameraAdapter {
  readonly mode: HardwareAdapterMode;
  readonly id: string;
  isAvailable(): boolean;
  getLastFrame(tick: number): CameraFrame | null;
  getHealthStatus(): AdapterHealthStatus;
}

// ─── Microphone Adapter ───────────────────────────────────────────────────────

export interface AudioFrame {
  frameId: number;
  timestampMs: number;
  peakAmplitude: number;
  wakeWordDetected: boolean;
  speechDetected: boolean;
  source: HardwareAdapterMode;
  isSimulated: boolean;
}

export interface MicrophoneAdapter {
  readonly mode: HardwareAdapterMode;
  readonly id: string;
  isAvailable(): boolean;
  getLastFrame(tick: number): AudioFrame | null;
  getHealthStatus(): AdapterHealthStatus;
}

// ─── Audio Output Adapter ─────────────────────────────────────────────────────

export type AudioPriority = 'emergency' | 'critical' | 'high' | 'normal' | 'low';

export interface SpeakCommand {
  text: string;
  priority: AudioPriority;
  languageCode: string;
  interruptCurrent: boolean;
}

export interface AudioOutputAdapter {
  readonly mode: HardwareAdapterMode;
  readonly id: string;
  isAvailable(): boolean;
  canSpeak(): boolean;
  getHealthStatus(): AdapterHealthStatus;
}

// ─── Haptic Adapter ───────────────────────────────────────────────────────────

export interface HapticCommand {
  patternId: string;
  pulseMs: number[];
  intensityLevel: number;
}

export interface HapticAdapter {
  readonly mode: HardwareAdapterMode;
  readonly id: string;
  isAvailable(): boolean;
  getHealthStatus(): AdapterHealthStatus;
}

// ─── IMU Adapter ──────────────────────────────────────────────────────────────

export interface IMUReading {
  tick: number;
  timestampMs: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  headingDeg: number;
  motionState: 'stationary' | 'walking' | 'running' | 'unknown';
  isSimulated: boolean;
}

export interface IMUAdapter {
  readonly mode: HardwareAdapterMode;
  readonly id: string;
  isAvailable(): boolean;
  getLastReading(tick: number): IMUReading | null;
  getHealthStatus(): AdapterHealthStatus;
}

// ─── Battery Adapter ──────────────────────────────────────────────────────────

export interface BatteryReading {
  timestampMs: number;
  percentagePct: number;
  temperatureC: number;
  isCharging: boolean;
  estimatedMinutesRemaining: number | null;
  isSimulated: boolean;
}

export interface BatteryAdapter {
  readonly mode: HardwareAdapterMode;
  readonly id: string;
  isAvailable(): boolean;
  getLastReading(tick: number): BatteryReading | null;
  getHealthStatus(): AdapterHealthStatus;
}

// ─── Network Adapter ─────────────────────────────────────────────────────────

export interface NetworkStatus {
  isOnline: boolean;
  quality: 'good' | 'weak' | 'offline';
  lastCheckedMs: number;
}

export interface NetworkAdapter {
  readonly mode: HardwareAdapterMode;
  readonly id: string;
  getStatus(): NetworkStatus;
}

// ─── Button Adapter ───────────────────────────────────────────────────────────

export interface ButtonEvent {
  buttonId: 'main' | 'volume-up' | 'volume-down';
  eventType: 'press-down' | 'press-up' | 'long-press' | 'double-press' | 'triple-press';
  durationMs: number;
  timestampMs: number;
}

export interface ButtonAdapter {
  readonly mode: HardwareAdapterMode;
  readonly id: string;
  isAvailable(): boolean;
  pollEvents(): ButtonEvent[];
  getHealthStatus(): AdapterHealthStatus;
}

// ─── Health Status ────────────────────────────────────────────────────────────

export type AdapterHealthStatus = 'healthy' | 'degraded' | 'unavailable';

export interface SystemAdapterHealth {
  camera: AdapterHealthStatus;
  microphone: AdapterHealthStatus;
  audioOutput: AdapterHealthStatus;
  haptic: AdapterHealthStatus;
  imu: AdapterHealthStatus;
  battery: AdapterHealthStatus;
  network: AdapterHealthStatus;
  buttons: AdapterHealthStatus;
}

// ─── Composite Adapter Set ────────────────────────────────────────────────────

export interface HardwareAdapterSet {
  mode: HardwareAdapterMode;
  camera: CameraAdapter;
  microphone: MicrophoneAdapter;
  audioOutput: AudioOutputAdapter;
  haptic: HapticAdapter;
  imu: IMUAdapter;
  battery: BatteryAdapter;
  network: NetworkAdapter;
  buttons: ButtonAdapter;
}

export function getSystemHealth(adapters: HardwareAdapterSet): SystemAdapterHealth {
  return {
    camera:      adapters.camera.getHealthStatus(),
    microphone:  adapters.microphone.getHealthStatus(),
    audioOutput: adapters.audioOutput.getHealthStatus(),
    haptic:      adapters.haptic.getHealthStatus(),
    imu:         adapters.imu.getHealthStatus(),
    battery:     adapters.battery.getHealthStatus(),
    network:     'healthy',   // network adapter always returns a status
    buttons:     adapters.buttons.getHealthStatus(),
  };
}

export function isCriticalAdapterAvailable(health: SystemAdapterHealth): boolean {
  return health.camera !== 'unavailable' || health.imu !== 'unavailable';
}

export function buildHealthAnnouncement(health: SystemAdapterHealth): string | null {
  const issues: string[] = [];
  if (health.camera === 'unavailable')      issues.push('Camera input is unavailable. Please stop and check carefully.');
  if (health.audioOutput === 'unavailable') issues.push('Audio output is unavailable. Haptic alerts are your only feedback.');
  if (health.haptic === 'unavailable')      issues.push('Haptic feedback is unavailable.');
  if (health.imu === 'unavailable')         issues.push('Motion sensor is unavailable. Heading guidance is disabled.');
  if (issues.length === 0) return null;
  return issues.join(' ');
}

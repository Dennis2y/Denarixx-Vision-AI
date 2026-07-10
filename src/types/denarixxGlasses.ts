// ─── V16 Denarixx Vision Glasses Hardware Prototype Types ─────────────────────
// Separate from src/types/glasses.ts (V14 multi-camera) and
// src/types/hardware.ts (V8 HAL). This file owns the prototype
// device spec and simulated hardware control layer.

// ─── Hardware Mode ────────────────────────────────────────────────────────────

export type HardwareMode =
  | 'phone_only'        // No glasses connected; phone camera + phone audio
  | 'glasses_assisted'  // Glasses supplement phone (extra cameras, bone audio)
  | 'glasses_primary'   // Glasses are primary sensor; phone is companion
  | 'degraded_safety'   // One or more subsystems failed; running reduced
  | 'offline_safety';   // Cloud + connectivity lost; fully local

// ─── Component Status ─────────────────────────────────────────────────────────

export type ComponentStatus = 'ok' | 'degraded' | 'failed' | 'offline';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'degraded';
export type ThermalState = 'normal' | 'warm' | 'hot' | 'throttling';
export type ConnectionProtocol = 'bluetooth_le' | 'wifi_direct' | 'usb_c' | 'none';
export type FirmwareChannel = 'stable' | 'beta' | 'dev';

// ─── Camera Module ────────────────────────────────────────────────────────────

export interface CameraModuleConfig {
  id: string;
  position: 'front' | 'left' | 'right' | 'downward';
  resolutionWidth: number;
  resolutionHeight: number;
  fovDegrees: number;
  targetFPS: number;
  hasNightVision: boolean;
  hasDepthSensor: boolean;
  status: ComponentStatus;
}

// ─── Microphone ───────────────────────────────────────────────────────────────

export interface MicrophoneConfig {
  channels: number;
  sampleRateHz: number;
  hasNoiseCancellation: boolean;
  hasSpatialAudio: boolean;
  status: ComponentStatus;
}

// ─── Bone-Conduction Audio ────────────────────────────────────────────────────

export interface BoneAudioConfig {
  driverType: 'piezoelectric' | 'electromagnetic';
  maxVolumeDb: number;
  frequencyRangeHz: [number, number]; // [min, max]
  hasVolumeControl: boolean;
  status: ComponentStatus;
}

// ─── Haptic ───────────────────────────────────────────────────────────────────

export type HapticAlertType =
  | 'critical_hazard'
  | 'high_hazard'
  | 'medium_hazard'
  | 'navigation_turn'
  | 'crossing_warning'
  | 'battery_low'
  | 'disconnected'
  | 'notification';

export interface HapticPattern {
  alertType: HapticAlertType;
  pulseMs: number[];
  pauseMs: number[];
  intensity: number; // 0–100
  repeatCount: number;
  description: string;
}

export interface HapticConfig {
  motorCount: number;
  supportsIntensityControl: boolean;
  maxPatternDurationMs: number;
  status: ComponentStatus;
}

// ─── Power Profile ────────────────────────────────────────────────────────────

export interface PowerProfile {
  batteryPct: number;
  isCharging: boolean;
  thermalState: ThermalState;
  estimatedRemainingMinutes: number;
  voltageV: number;
  currentMa: number;
}

// ─── Phone Companion ──────────────────────────────────────────────────────────

export interface PhoneCompanionState {
  connected: boolean;
  protocol: ConnectionProtocol;
  rssiDbm: number | null; // null = not connected
  latencyMs: number | null;
  companionAppVersion: string | null;
}

// ─── Glasses Device Profile ───────────────────────────────────────────────────

export interface GlassesDeviceProfile {
  productName: string;
  firmwareVersion: string;
  firmwareChannel: FirmwareChannel;
  hardwareRevision: string;
  serialPlaceholder: string; // Never store real serial numbers
  bluetoothAvailable: boolean;
  wifiDirectAvailable: boolean;
  usbCAvailable: boolean;
  cameras: CameraModuleConfig[];
  microphone: MicrophoneConfig;
  boneAudio: BoneAudioConfig;
  haptic: HapticConfig;
}

// ─── Denarixx Glasses State ───────────────────────────────────────────────────
// Named DenarixxGlassesState to avoid clash with V14 GlassesState

export interface DenarixxGlassesState {
  profile: GlassesDeviceProfile;
  connection: ConnectionState;
  hardwareMode: HardwareMode;
  power: PowerProfile;
  phoneCompanion: PhoneCompanionState;
  cameraStatus: ComponentStatus;
  audioStatus: ComponentStatus;
  hapticStatus: ComponentStatus;
  thermalState: ThermalState;
  emergencyFallbackActive: boolean;
  emergencyFallbackReason: string;
  lastUpdated: number;
}

// ─── Safety Messages — exact strings tested by the suite ─────────────────────

export const GLASSES_DISCONNECT_MESSAGE =
  'Vision glasses disconnected. Please stop and check carefully.';

export const BATTERY_CRITICAL_MESSAGE =
  'Glasses battery is critically low. Switch to phone mode.';

export const CAMERA_FAIL_MESSAGE =
  'Camera input failed. Local safety guidance may be limited.';

// Threshold constants
export const BATTERY_CRITICAL_THRESHOLD = 10;   // %
export const BATTERY_LOW_THRESHOLD = 20;         // %
export const THERMAL_HOT_THRESHOLD_C = 42;       // °C
export const THERMAL_WARM_THRESHOLD_C = 38;      // °C
export const CONNECTION_RSSI_WEAK_DBM = -85;     // dBm

// ─── Prototype Spec ───────────────────────────────────────────────────────────

export interface HardwarePrototypeSpec {
  targetWeight: string;
  targetBatteryCapacityMah: number;
  targetBatteryLifeHours: number;
  computeChip: string;
  ramGb: number;
  storageGb: number;
  primaryConnectionProtocol: ConnectionProtocol;
  targetRetailPrice: string;
  prototypeTargetDate: string;
}

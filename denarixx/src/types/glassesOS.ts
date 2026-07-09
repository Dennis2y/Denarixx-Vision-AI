// ─── Sprint 16: Standalone Smart Glasses OS Types ────────────────────────────
// The glasses are the primary computer. Phone is optional. Cloud is optional.
// All safety functions run standalone on the glasses compute module.

// ─── Boot Sequence ────────────────────────────────────────────────────────────

export type BootPhase =
  | 'power-on'
  | 'hardware-check'
  | 'sensor-init'
  | 'ai-load'
  | 'guardian-start'
  | 'wake-word'
  | 'ready';

export type BootStatus = 'idle' | 'booting' | 'ready' | 'failed' | 'restarting';

export interface BootStepResult {
  phase: BootPhase;
  success: boolean;
  durationMs: number;
  message: string;
  error: string | null;
}

export interface BootSequenceResult {
  steps: BootStepResult[];
  success: boolean;
  totalDurationMs: number;
  failedPhase: BootPhase | null;
  readyForOperation: boolean;
}

export interface BootDiagnostic {
  status: BootStatus;
  completedPhases: BootPhase[];
  failedPhase: BootPhase | null;
  totalDurationMs: number;
  phaseTimings: Record<string, number>;
  errors: string[];
}

// ─── Sensors ──────────────────────────────────────────────────────────────────

export type SensorType =
  | 'camera-front'
  | 'camera-side-left'
  | 'camera-side-right'
  | 'gps'
  | 'imu'
  | 'compass'
  | 'microphone-left'
  | 'microphone-right'
  | 'temperature'
  | 'battery-sensor';

export type SensorStatus =
  | 'active'
  | 'inactive'
  | 'initializing'
  | 'error'
  | 'degraded';

export interface GlassesOSSensor {
  type: SensorType;
  status: SensorStatus;
  lastReadingTick: number;
  errorCount: number;
  restartCount: number;
  isCritical: boolean;
  confidence: number;
}

export interface SensorFusionFrame {
  tick: number;
  activeSensorCount: number;
  cameraActive: boolean;
  gpsActive: boolean;
  imuActive: boolean;
  compassActive: boolean;
  microphoneActive: boolean;
  hasVisionInput: boolean;
  hasLocationInput: boolean;
  hasMotionInput: boolean;
  hasAudioInput: boolean;
  fusionQuality: 'high' | 'medium' | 'low' | 'degraded';
  anomalies: string[];
}

export interface SensorStatusSummary {
  total: number;
  active: number;
  error: number;
  degraded: number;
  criticalFailing: SensorType[];
  allCriticalActive: boolean;
}

// ─── Power Management ─────────────────────────────────────────────────────────

export type PowerLevel = 'critical' | 'low' | 'normal' | 'high' | 'full';

export interface PowerProfile {
  batteryPct: number;
  powerLevel: PowerLevel;
  temperatureC: number;
  drainRatePercentPerHour: number;
  estimatedLifeMinutes: number;
  shouldReducePower: boolean;
  shouldWarnUser: boolean;
  thermalThrottle: boolean;
  reducedPowerFeatures: string[];
}

// ─── Device Health ────────────────────────────────────────────────────────────

export type ComponentName =
  | 'compute-module'
  | 'camera-system'
  | 'audio-system'
  | 'sensor-array'
  | 'storage'
  | 'power-system'
  | 'guardian-engine';

export type ComponentStatus = 'healthy' | 'degraded' | 'critical' | 'offline';

export interface ComponentHealth {
  component: ComponentName;
  score: number;
  status: ComponentStatus;
  issues: string[];
}

export interface DeviceHealth {
  overallScore: number;
  components: ComponentHealth[];
  criticalIssues: string[];
  isOperational: boolean;
  lastAssessedTick: number;
}

// ─── Runtime Mode ─────────────────────────────────────────────────────────────

export type RuntimeMode =
  | 'standalone'
  | 'phone-companion'
  | 'cloud-enhanced'
  | 'emergency';

export interface RuntimeState {
  mode: RuntimeMode;
  bootResult: BootSequenceResult | null;
  sensors: GlassesOSSensor[];
  power: PowerProfile;
  health: DeviceHealth;
  sessionTick: number;
  isBooted: boolean;
  guardianActive: boolean;
  wakeWordListening: boolean;
  phoneConnected: boolean;
  cloudConnected: boolean;
  activeFeatures: string[];
  emergencyMode: boolean;
}

export interface RuntimeSummary {
  mode: RuntimeMode;
  isBooted: boolean;
  emergencyMode: boolean;
  guardianActive: boolean;
  batteryPct: number;
  powerLevel: PowerLevel;
  activeSensors: number;
  totalSensors: number;
  healthScore: number;
  activeFeatureCount: number;
  phoneConnected: boolean;
  cloudConnected: boolean;
}

// ─── Emergency Mode ───────────────────────────────────────────────────────────

export interface EmergencyModeState {
  active: boolean;
  reason: string;
  activeSince: number;
  activeFeatures: string[];
  disabledFeatures: string[];
  spokenAnnouncement: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const WAKE_WORD = 'Denarixx';

export const CRITICAL_BATTERY_PCT = 10;
export const LOW_BATTERY_PCT = 20;
export const THERMAL_THROTTLE_TEMP_C = 45;
export const EMERGENCY_TEMP_C = 55;

export const BOOT_PHASES_IN_ORDER: BootPhase[] = [
  'power-on',
  'hardware-check',
  'sensor-init',
  'ai-load',
  'guardian-start',
  'wake-word',
  'ready',
];

export const CRITICAL_SENSOR_TYPES: SensorType[] = [
  'camera-front',
  'imu',
  'microphone-left',
  'battery-sensor',
];

export const EMERGENCY_MODE_ANNOUNCEMENT =
  'Emergency mode active. Core safety features running at minimum power.';

export const CRITICAL_BATTERY_ANNOUNCEMENT =
  'Battery critically low. Please charge the glasses. Guardian will remain active as long as possible.';

export const STANDALONE_PRINCIPLE =
  'Denarixx Vision Glasses operate as a standalone computer with a dedicated glasses compute module. ' +
  'Phone and cloud are optional enhancements — never safety dependencies.';

export const ALWAYS_ACTIVE_FEATURES: string[] = [
  'hazard-detection',
  'guardian',
  'voice-guidance',
  'emergency-alerts',
];

export const PHONE_OPTIONAL_FEATURES: string[] = [
  'companion',
  'memory-sync',
  'settings-dashboard',
  'cloud-model-updates',
];

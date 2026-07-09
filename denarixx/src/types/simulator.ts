// ─── Sprint 18: Digital Twin Types ────────────────────────────────────────────
// Never merge with hardware.ts (V8) or hardwareHAL.ts (Sprint 17).
// Digital Twin simulates all hardware so every subsystem can be tested before manufacturing.

// ─── Environment ──────────────────────────────────────────────────────────────

export type EnvironmentType =
  | 'busy-city'
  | 'quiet-street'
  | 'shopping-mall'
  | 'airport'
  | 'train-station'
  | 'rain'
  | 'fog'
  | 'night'
  | 'snow'
  | 'strong-sunlight'
  | 'indoor-navigation';

export type LightLevel = 'bright' | 'normal' | 'dim' | 'dark';
export type WeatherCondition = 'clear' | 'rain' | 'fog' | 'snow' | 'bright';
export type HazardDensity = 'low' | 'medium' | 'high';

export interface EnvironmentProfile {
  type: EnvironmentType;
  label: string;
  gpsAccuracyM: number;
  ambientNoiseLevel: number;
  lightLevel: LightLevel;
  hazardDensity: HazardDensity;
  indoorMode: boolean;
  weatherCondition: WeatherCondition;
  typicalHazards: string[];
}

// ─── Virtual Hardware Components ──────────────────────────────────────────────

export interface VirtualCamera {
  deviceId: string;
  facing: 'front' | 'side-left' | 'side-right';
  isWorking: boolean;
  fps: number;
  obstructionLevel: number;
  lightLevel: LightLevel;
  faultReason: string | null;
}

export interface VirtualGPS {
  hasSignal: boolean;
  accuracyM: number;
  driftM: number;
  isOfflineMode: boolean;
}

export interface VirtualIMU {
  isWorking: boolean;
  driftFactor: number;
  temperatureC: number;
}

export interface VirtualBattery {
  percentage: number;
  temperatureC: number;
  drainRateMultiplier: number;
  isCharging: boolean;
}

export interface VirtualMicrophone {
  deviceId: string;
  isWorking: boolean;
  noiseLevel: number;
  wakeWordEnabled: boolean;
}

export interface VirtualSpeaker {
  deviceId: string;
  isWorking: boolean;
  volume: number;
  isBoneConductionActive: boolean;
}

export interface VirtualDisplay {
  isOn: boolean;
  brightness: number;
  mode: 'hud' | 'low-power' | 'off';
  hasOverheat: boolean;
}

// ─── Faults ───────────────────────────────────────────────────────────────────

export type SimulatorFaultType =
  | 'camera-failure'
  | 'gps-loss'
  | 'low-battery'
  | 'sensor-drift'
  | 'microphone-failure'
  | 'speaker-failure'
  | 'overheating'
  | 'low-light'
  | 'partial-obstruction';

export type FaultSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SafetyImpact = 'none' | 'reduced' | 'degraded' | 'critical';

export interface SimulatedFault {
  type: SimulatorFaultType;
  component: string;
  severity: FaultSeverity;
  injectedAtTick: number;
  isActive: boolean;
  recoverable: boolean;
  recoveryMessage: string;
}

export interface FaultInjectionResult {
  faultType: SimulatorFaultType;
  injected: boolean;
  affectedComponent: string;
  safetyImpact: SafetyImpact;
  recoverySteps: string[];
}

// ─── Digital Twin State ───────────────────────────────────────────────────────

export interface DigitalTwinState {
  platform: 'simulation';
  cameras: VirtualCamera[];
  gps: VirtualGPS;
  imu: VirtualIMU;
  battery: VirtualBattery;
  microphones: VirtualMicrophone[];
  speaker: VirtualSpeaker;
  display: VirtualDisplay;
  activeFaults: SimulatedFault[];
  environment: EnvironmentProfile;
  tick: number;
  isBooted: boolean;
  bootedAtTick: number;
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export type SensorReadingQuality = 'perfect' | 'good' | 'degraded' | 'failed';
export type SimulatorMode = 'manual' | 'scripted' | 'random' | 'stress';

export interface SensorHealthEntry {
  component: string;
  isHealthy: boolean;
  quality: SensorReadingQuality;
  issues: string[];
}

export interface DiagnosticsReport {
  tick: number;
  overallHealthScore: number;
  sensors: SensorHealthEntry[];
  activeFaultCount: number;
  criticalFaultCount: number;
  isManufacturingReady: boolean;
  recommendation: string;
}

export interface AIValidationResult {
  scenario: string;
  guardianRespondsCorrectly: boolean;
  navigationDegradesSafely: boolean;
  offlineModeContinues: boolean;
  emergencyModeWorks: boolean;
  explainableAIAvailable: boolean;
  passed: boolean;
  notes: string;
}

export interface PerformanceMetrics {
  tick: number;
  uptimeTicks: number;
  activeFaultCount: number;
  healthyComponentCount: number;
  totalComponentCount: number;
  batteryPercentage: number;
  gpsAccuracyM: number;
  environmentLabel: string;
}

export interface ManufacturingReadinessScore {
  score: number;
  isReady: boolean;
  blockers: string[];
  recommendations: string[];
}

export interface SimulatedCameraFrame {
  deviceId: string;
  tick: number;
  width: number;
  height: number;
  confidence: number;
  lightAdjusted: boolean;
  obstructed: boolean;
}

export interface SimulatedSensorContext {
  environment: EnvironmentType;
  tick: number;
  lightLevel: LightLevel;
  noiseLevel: number;
  gpsAvailable: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TWIN_NOTE =
  'Digital Twin simulates all Denarixx Vision Glasses hardware. ' +
  'Every subsystem can be tested before manufacturing.';

export const DIGITAL_TWIN_PLATFORM = 'simulation' as const;

export const TOTAL_VIRTUAL_COMPONENTS = 11;

export const AI_VALIDATION_SCENARIOS = [
  'guardian-responds-to-fault',
  'navigation-degrades-safely',
  'offline-mode-continues',
  'emergency-mode-activation',
  'explainable-ai-available',
] as const;

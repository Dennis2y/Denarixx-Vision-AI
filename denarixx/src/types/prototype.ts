// ─── Sprint 20: Prototype Hardware Integration Types ──────────────────────────
// Never merge with hardware.ts (V8), hardwareHAL.ts (Sprint 17), or simulator.ts (Sprint 18).

export type HardwareInterfaceType =
  | 'camera'
  | 'microphone'
  | 'bone-audio'
  | 'battery'
  | 'gps'
  | 'imu'
  | 'compass'
  | 'display'
  | 'button'
  | 'touch'
  | 'usb-c'
  | 'wireless';

export type IntegrationStatus = 'not-started' | 'in-progress' | 'validated' | 'failed';

export type DeploymentStage = 'dev' | 'staging' | 'prototype' | 'production';

export type FirmwareState = 'unknown' | 'initializing' | 'ready' | 'updating' | 'error';

export type ProvisioningStep =
  | 'factory-reset'
  | 'device-init'
  | 'voice-calibration'
  | 'sensor-calibration'
  | 'language-selection'
  | 'accessibility-profile'
  | 'privacy-defaults'
  | 'complete';

export type ProvisioningStepStatus = 'pending' | 'in-progress' | 'complete' | 'failed';

export type DeploymentArtifact = 'firmware' | 'ai-models' | 'config' | 'locale-pack';

export type TestScenarioCategory =
  | 'navigation'
  | 'safety'
  | 'hardware'
  | 'offline'
  | 'emergency';

export type DiagnosticLevel = 'info' | 'warn' | 'error' | 'critical';

// ─── Hardware Interfaces ───────────────────────────────────────────────────────

export interface HardwareInterface {
  type: HardwareInterfaceType;
  protocol: string;
  halDriver: string;
  status: IntegrationStatus;
  requiredSprint: number;
  notes: string;
}

export interface PrototypeIntegrationState {
  deviceId: string;
  platform: 'simulation' | 'prototype' | 'android-xr' | 'linux-wearable' | 'denarixx-v1';
  interfaces: HardwareInterface[];
  overallStatus: IntegrationStatus;
  validatedInterfaces: number;
  totalInterfaces: number;
  integrationScore: number; // 0–100
  readyForEVT: boolean;
}

// ─── Firmware Bridge ───────────────────────────────────────────────────────────

export interface FirmwareInfo {
  version: string;
  buildDate: string;
  platform: string;
  capabilities: string[];
  halVersion: string;
  bootloaderVersion: string;
}

export interface FirmwareSensorRecord {
  sensorId: string;
  type: HardwareInterfaceType;
  driver: string;
  registered: boolean;
}

export interface FirmwareBridgeState {
  deviceId: string;
  firmwareInfo: FirmwareInfo | null;
  discoveryComplete: boolean;
  sensorRegistry: FirmwareSensorRecord[];
  healthStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
  otaAvailable: boolean;
  otaVersion: string | null;
  lastHeartbeatTs: number;
  firmwareState: FirmwareState;
  capabilityFlags: Record<string, boolean>;
}

export interface FirmwareHealthReport {
  deviceId: string;
  healthStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
  registeredSensors: number;
  failedSensors: number;
  firmwareVersion: string;
  uptime: number; // seconds
}

// ─── Device Provisioning ──────────────────────────────────────────────────────

export interface ProvisioningStepRecord {
  step: ProvisioningStep;
  status: ProvisioningStepStatus;
  durationMs: number;
  notes: string;
}

export interface DeviceProvisioningState {
  deviceId: string;
  currentStep: ProvisioningStep;
  steps: ProvisioningStepRecord[];
  isComplete: boolean;
  startedAt: number;
  completedAt: number | null;
  languageCode: string;
  accessibilityProfile: string;
  privacyDefaults: Record<string, boolean>;
  calibrationPassed: boolean;
  voiceSampleCount: number;
}

export interface ProvisioningResult {
  success: boolean;
  step: ProvisioningStep;
  message: string;
  nextStep: ProvisioningStep | null;
}

// ─── Deployment Pipeline ──────────────────────────────────────────────────────

export interface DeploymentStageConfig {
  stage: DeploymentStage;
  version: string;
  artifacts: DeploymentArtifact[];
  isSigned: boolean;
  rollbackVersion: string | null;
  diagnosticsEnabled: boolean;
  recoveryModeAvailable: boolean;
  notes: string;
}

export interface DeploymentPipelineState {
  currentStage: DeploymentStage;
  stages: DeploymentStageConfig[];
  canRollback: boolean;
  currentVersion: string;
  latestVersion: string;
  isUpToDate: boolean;
  deploymentLog: DiagnosticEntry[];
}

export interface DiagnosticEntry {
  ts: number;
  level: DiagnosticLevel;
  message: string;
  source: string;
}

export interface RollbackResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  message: string;
}

// ─── Test Plan ────────────────────────────────────────────────────────────────

export interface PrototypeTestCase {
  id: string;
  scenario: string;
  category: TestScenarioCategory;
  steps: string[];
  expectedOutcome: string;
  sprintSource: number;
  priority: 'critical' | 'high' | 'medium';
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const INTEGRATION_DISCLAIMER = 'No specific manufacturers or commercial components are selected. All interfaces are defined for vendor-neutral integration.' as const;

export const PROTOTYPE_PLATFORM = 'prototype' as const;
export const TOTAL_HARDWARE_INTERFACES = 12 as const;
export const PROVISIONING_STEPS: ProvisioningStep[] = [
  'factory-reset',
  'device-init',
  'voice-calibration',
  'sensor-calibration',
  'language-selection',
  'accessibility-profile',
  'privacy-defaults',
  'complete',
];
export const PROVISIONING_VOICE_SAMPLES_REQUIRED = 3 as const;
export const INTEGRATION_SCORE_EVT_THRESHOLD = 80 as const;
export const PROTOTYPE_SAFETY_NOTE = 'Guardian alert and crossing safety rules apply on prototype hardware. Never say "safe to cross" based on camera alone.' as const;

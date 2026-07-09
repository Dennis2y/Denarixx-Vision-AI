// ─── Sprint 20: Device Provisioning Engine ────────────────────────────────────

import type {
  DeviceProvisioningState,
  ProvisioningStep,
  ProvisioningStepRecord,
  ProvisioningStepStatus,
  ProvisioningResult,
} from '@/types/prototype';

import {
  PROVISIONING_STEPS,
  PROVISIONING_VOICE_SAMPLES_REQUIRED,
} from '@/types/prototype';

// ─── Default privacy settings ─────────────────────────────────────────────────

const DEFAULT_PRIVACY: Record<string, boolean> = {
  locationEnabled: false,        // off by default — user must opt in
  locationMemoryEnabled: false,  // off by default
  gpsGridFuzzingEnabled: true,   // on by default (Sprint 7 location privacy)
  sessionRecordingEnabled: false,
  cloudSyncEnabled: false,       // off until user consents
  analyticsEnabled: false,
  pilotModeEnabled: false,
};

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createProvisioningState(deviceId: string, startTs: number): DeviceProvisioningState {
  const steps: ProvisioningStepRecord[] = PROVISIONING_STEPS.map(step => ({
    step,
    status: 'pending' as ProvisioningStepStatus,
    durationMs: 0,
    notes: '',
  }));

  return {
    deviceId,
    currentStep: 'factory-reset',
    steps,
    isComplete: false,
    startedAt: startTs,
    completedAt: null,
    languageCode: 'en',
    accessibilityProfile: 'standard',
    privacyDefaults: { ...DEFAULT_PRIVACY },
    calibrationPassed: false,
    voiceSampleCount: 0,
  };
}

// ─── Step execution ───────────────────────────────────────────────────────────

export function beginStep(
  state: DeviceProvisioningState,
  step: ProvisioningStep,
): DeviceProvisioningState {
  const steps = state.steps.map(s =>
    s.step === step ? { ...s, status: 'in-progress' as ProvisioningStepStatus } : s,
  );
  return { ...state, currentStep: step, steps };
}

export function completeStep(
  state: DeviceProvisioningState,
  step: ProvisioningStep,
  durationMs: number,
  notes = '',
): ProvisioningResult {
  const nextIndex = PROVISIONING_STEPS.indexOf(step) + 1;
  const nextStep: ProvisioningStep | null =
    nextIndex < PROVISIONING_STEPS.length ? PROVISIONING_STEPS[nextIndex] : null;

  return {
    success: true,
    step,
    message: `${step} completed in ${durationMs} ms`,
    nextStep,
  };
}

export function applyStepResult(
  state: DeviceProvisioningState,
  result: ProvisioningResult,
  durationMs: number,
  notes = '',
): DeviceProvisioningState {
  const steps = state.steps.map(s =>
    s.step === result.step
      ? { ...s, status: 'complete' as ProvisioningStepStatus, durationMs, notes }
      : s,
  );

  const isComplete = result.nextStep === 'complete' || result.nextStep === null;
  return {
    ...state,
    steps,
    currentStep: result.nextStep ?? 'complete',
    isComplete,
    completedAt: isComplete ? Date.now() : null,
  };
}

export function failStep(
  state: DeviceProvisioningState,
  step: ProvisioningStep,
  reason: string,
): DeviceProvisioningState {
  const steps = state.steps.map(s =>
    s.step === step
      ? { ...s, status: 'failed' as ProvisioningStepStatus, notes: reason }
      : s,
  );
  return { ...state, steps };
}

// ─── Voice calibration ────────────────────────────────────────────────────────

export function addVoiceSample(state: DeviceProvisioningState): DeviceProvisioningState {
  const next = state.voiceSampleCount + 1;
  return { ...state, voiceSampleCount: next };
}

export function isVoiceCalibrationComplete(state: DeviceProvisioningState): boolean {
  return state.voiceSampleCount >= PROVISIONING_VOICE_SAMPLES_REQUIRED;
}

export function getVoiceCalibrationProgress(state: DeviceProvisioningState): string {
  return `${state.voiceSampleCount}/${PROVISIONING_VOICE_SAMPLES_REQUIRED} voice samples`;
}

// ─── Sensor calibration ───────────────────────────────────────────────────────

export function setSensorCalibrationPassed(
  state: DeviceProvisioningState,
  passed: boolean,
  notes = '',
): DeviceProvisioningState {
  const steps = state.steps.map(s =>
    s.step === 'sensor-calibration'
      ? {
          ...s,
          status: passed ? ('complete' as ProvisioningStepStatus) : ('failed' as ProvisioningStepStatus),
          notes,
        }
      : s,
  );
  return { ...state, calibrationPassed: passed, steps };
}

// ─── Language & accessibility ─────────────────────────────────────────────────

export function setLanguage(
  state: DeviceProvisioningState,
  languageCode: string,
): DeviceProvisioningState {
  return { ...state, languageCode };
}

export function setAccessibilityProfile(
  state: DeviceProvisioningState,
  profile: string,
): DeviceProvisioningState {
  return { ...state, accessibilityProfile: profile };
}

// Supported profiles (Sprint 11 accessibilityEngine presets)
export const ACCESSIBILITY_PROFILES = [
  'standard',
  'low-vision',
  'deaf-blind',
  'motor-impaired',
  'cognitive-support',
] as const;

// ─── Privacy defaults ─────────────────────────────────────────────────────────

export function setPrivacyDefault(
  state: DeviceProvisioningState,
  key: string,
  value: boolean,
): DeviceProvisioningState {
  return {
    ...state,
    privacyDefaults: { ...state.privacyDefaults, [key]: value },
  };
}

export function getPrivacySummary(state: DeviceProvisioningState): string {
  const enabled = Object.entries(state.privacyDefaults)
    .filter(([, v]) => v)
    .map(([k]) => k);
  return enabled.length === 0 ? 'All data sharing off' : `Enabled: ${enabled.join(', ')}`;
}

// ─── Factory reset ────────────────────────────────────────────────────────────

export function applyFactoryReset(state: DeviceProvisioningState): DeviceProvisioningState {
  return {
    ...state,
    languageCode: 'en',
    accessibilityProfile: 'standard',
    privacyDefaults: { ...DEFAULT_PRIVACY },
    calibrationPassed: false,
    voiceSampleCount: 0,
    steps: state.steps.map(s => ({
      ...s,
      status: 'pending' as ProvisioningStepStatus,
      durationMs: 0,
      notes: '',
    })),
    isComplete: false,
    completedAt: null,
    currentStep: 'factory-reset',
  };
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export function getProvisioningProgress(state: DeviceProvisioningState): number {
  const total = state.steps.length;
  const done = state.steps.filter(s => s.status === 'complete').length;
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function getProvisioningSummary(state: DeviceProvisioningState): string {
  if (state.isComplete) {
    return `Device ${state.deviceId} provisioned: lang=${state.languageCode} ` +
      `profile=${state.accessibilityProfile} calibration=${state.calibrationPassed}`;
  }
  return `Device ${state.deviceId} provisioning: ${state.currentStep} ` +
    `(${getProvisioningProgress(state)}% complete)`;
}

export function getStepRecord(
  state: DeviceProvisioningState,
  step: ProvisioningStep,
): ProvisioningStepRecord | undefined {
  return state.steps.find(s => s.step === step);
}

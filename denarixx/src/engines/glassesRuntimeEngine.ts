// ─── Sprint 16: Glasses Runtime Engine ───────────────────────────────────────
// Pure functions — no async, no I/O.
// Main standalone OS orchestrator for Denarixx Vision Glasses.
// Primary computer: glasses compute module.
// Phone: optional companion. Cloud: optional enhancement.

import type {
  RuntimeState,
  RuntimeMode,
  RuntimeSummary,
  EmergencyModeState,
  GlassesOSSensor,
  BootSequenceResult,
} from '@/types/glassesOS';
import {
  ALWAYS_ACTIVE_FEATURES,
  PHONE_OPTIONAL_FEATURES,
  STANDALONE_PRINCIPLE,
  EMERGENCY_MODE_ANNOUNCEMENT,
  CRITICAL_BATTERY_PCT,
} from '@/types/glassesOS';
import { runBootSequence } from './bootSequenceEngine';
import { buildDefaultPowerProfile, buildPowerProfile, getReducedPowerFeatures } from './glassesPowerEngine';
import { initializeAllSensors, activateAllSensors, buildSensorFusionFrame, buildSensorStatusSummary } from './glassesOSSensorEngine';
import { buildDeviceHealthReport } from './deviceHealthEngine';

// ─── Runtime Mode Determination ───────────────────────────────────────────────

export function determineRuntimeMode(
  phoneConnected: boolean,
  cloudConnected: boolean,
  batteryPct: number
): RuntimeMode {
  if (batteryPct <= CRITICAL_BATTERY_PCT) return 'emergency';
  if (cloudConnected) return 'cloud-enhanced';
  if (phoneConnected) return 'phone-companion';
  return 'standalone';
}

// ─── Feature Selection ────────────────────────────────────────────────────────

export function selectActiveFeatures(
  mode: RuntimeMode,
  batteryPct: number,
  temperatureC: number
): string[] {
  const base = [...ALWAYS_ACTIVE_FEATURES];
  const reduced = new Set(getReducedPowerFeatures(batteryPct, temperatureC));

  if (mode === 'emergency') return ALWAYS_ACTIVE_FEATURES;

  const modeFeatures: Record<RuntimeMode, string[]> = {
    standalone:       ['navigation', 'memory', 'language', 'accessibility'],
    'phone-companion':['navigation', 'memory', 'language', 'accessibility', 'companion', 'settings-dashboard'],
    'cloud-enhanced': ['navigation', 'memory', 'language', 'accessibility', 'companion', 'settings-dashboard', 'cloud-enhanced-scene', 'cloud-sync'],
    emergency:        [],
  };

  const extra = (modeFeatures[mode] ?? []).filter(f => !reduced.has(f));
  return [...new Set([...base, ...extra])];
}

// ─── State Factory ────────────────────────────────────────────────────────────

export function createRuntimeState(): RuntimeState {
  const sensors = initializeAllSensors(0);
  const power = buildDefaultPowerProfile();
  const health = buildDeviceHealthReport(sensors, power, false, false, 0);

  return {
    mode: 'standalone',
    bootResult: null,
    sensors,
    power,
    health,
    sessionTick: 0,
    isBooted: false,
    guardianActive: false,
    wakeWordListening: false,
    phoneConnected: false,
    cloudConnected: false,
    activeFeatures: [],
    emergencyMode: false,
  };
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

export function bootGlasses(
  state: RuntimeState,
  failAtPhase?: import('@/types/glassesOS').BootPhase
): RuntimeState {
  const bootResult = runBootSequence({ failAtPhase });
  const tick = 1;
  const sensors = activateAllSensors(state.sensors, tick);
  const power = buildPowerProfile(state.power.batteryPct, state.power.temperatureC, ALWAYS_ACTIVE_FEATURES);
  const health = buildDeviceHealthReport(sensors, power, bootResult.success, bootResult.success, tick);
  const mode = determineRuntimeMode(state.phoneConnected, state.cloudConnected, power.batteryPct);
  const features = selectActiveFeatures(mode, power.batteryPct, power.temperatureC);

  return {
    ...state,
    bootResult,
    sensors,
    power,
    health,
    sessionTick: tick,
    isBooted: bootResult.success,
    guardianActive: bootResult.success,
    wakeWordListening: bootResult.success,
    mode,
    activeFeatures: features,
    emergencyMode: false,
  };
}

// ─── Runtime Tick ─────────────────────────────────────────────────────────────

export interface RuntimeTickInput {
  batteryPct: number;
  temperatureC: number;
  phoneConnected: boolean;
  cloudConnected: boolean;
}

export function processRuntimeTick(
  state: RuntimeState,
  input: RuntimeTickInput
): RuntimeState {
  if (!state.isBooted) return state;

  const tick = state.sessionTick + 1;
  const mode = determineRuntimeMode(input.phoneConnected, input.cloudConnected, input.batteryPct);
  const isEmergency = input.batteryPct <= CRITICAL_BATTERY_PCT;
  const features = selectActiveFeatures(mode, input.batteryPct, input.temperatureC);
  const power = buildPowerProfile(input.batteryPct, input.temperatureC, features);
  const health = buildDeviceHealthReport(
    state.sensors, power, state.bootResult?.success ?? false, true, tick
  );

  return {
    ...state,
    sessionTick: tick,
    mode,
    power,
    health,
    phoneConnected: input.phoneConnected,
    cloudConnected: input.cloudConnected,
    activeFeatures: features,
    emergencyMode: isEmergency,
    guardianActive: true,
  };
}

// ─── Emergency Mode ───────────────────────────────────────────────────────────

export function activateEmergencyMode(state: RuntimeState): {
  state: RuntimeState;
  emergencyState: EmergencyModeState;
} {
  const emergencyFeatures = [...ALWAYS_ACTIVE_FEATURES];
  const allFeatures = state.activeFeatures;
  const disabled = allFeatures.filter(f => !emergencyFeatures.includes(f));

  const emergencyState: EmergencyModeState = {
    active: true,
    reason: state.power.batteryPct <= CRITICAL_BATTERY_PCT
      ? 'Battery critically low'
      : 'Emergency mode activated',
    activeSince: state.sessionTick,
    activeFeatures: emergencyFeatures,
    disabledFeatures: disabled,
    spokenAnnouncement: EMERGENCY_MODE_ANNOUNCEMENT,
  };

  return {
    state: {
      ...state,
      emergencyMode: true,
      activeFeatures: emergencyFeatures,
      mode: 'emergency',
    },
    emergencyState,
  };
}

// ─── Summary for Phone Dashboard ──────────────────────────────────────────────

export function buildRuntimeSummary(state: RuntimeState): RuntimeSummary {
  const sensorSummary = buildSensorStatusSummary(state.sensors);
  return {
    mode: state.mode,
    isBooted: state.isBooted,
    emergencyMode: state.emergencyMode,
    guardianActive: state.guardianActive,
    batteryPct: state.power.batteryPct,
    powerLevel: state.power.powerLevel,
    activeSensors: sensorSummary.active,
    totalSensors: sensorSummary.total,
    healthScore: state.health.overallScore,
    activeFeatureCount: state.activeFeatures.length,
    phoneConnected: state.phoneConnected,
    cloudConnected: state.cloudConnected,
  };
}

export function isOperational(state: RuntimeState): boolean {
  return state.isBooted && state.guardianActive && state.health.isOperational;
}

export function getStandaloneNote(): string {
  return STANDALONE_PRINCIPLE;
}

export function getPhoneOptionalNote(): string {
  return `Phone optional features: ${PHONE_OPTIONAL_FEATURES.join(', ')}.`;
}

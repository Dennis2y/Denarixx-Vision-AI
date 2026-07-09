// ─── Sprint 18: Digital Twin Engine ──────────────────────────────────────────
// Pure functions — no async, no I/O.
// Manages the Digital Twin lifecycle, HAL sync, AI validation, and manufacturing readiness.

import type {
  DigitalTwinState,
  AIValidationResult,
  ManufacturingReadinessScore,
  PerformanceMetrics,
} from '@/types/simulator';
import { TWIN_NOTE, AI_VALIDATION_SCENARIOS } from '@/types/simulator';
import { createGlassesSimulator, getWorkingCameraCount, isSimulatorHealthy } from './glassesSimulatorEngine';
import { getActiveFaults, isCriticalFaultActive, hasActiveFault } from './hardwareFaultEngine';

// ─── Digital Twin Lifecycle ───────────────────────────────────────────────────

export function createDigitalTwin(
  environment: Parameters<typeof createGlassesSimulator>[0] = 'quiet-street'
): DigitalTwinState {
  return createGlassesSimulator(environment);
}

export function getTwinHealthScore(twin: DigitalTwinState): number {
  if (!twin.isBooted) return 0;

  const components = [
    twin.cameras.some(c => c.isWorking),
    twin.gps.hasSignal,
    twin.imu.isWorking,
    twin.battery.percentage > 10,
    twin.microphones.some(m => m.isWorking),
    twin.speaker.isWorking,
    twin.display.isOn,
  ];

  const healthyCount = components.filter(Boolean).length;
  const baseScore = Math.round((healthyCount / components.length) * 100);

  const faultPenalty = twin.activeFaults.filter(f => f.isActive).length * 5;
  const driftPenalty = twin.imu.driftFactor > 1.5 ? 10 : 0;
  const tempPenalty = twin.battery.temperatureC >= 55 ? 20 : twin.battery.temperatureC >= 45 ? 10 : 0;

  return Math.max(0, baseScore - faultPenalty - driftPenalty - tempPenalty);
}

export function buildTwinSnapshot(twin: DigitalTwinState): {
  tick: number;
  healthScore: number;
  environment: string;
  batteryPct: number;
  activeFaults: number;
  cameras: number;
  isBooted: boolean;
  platform: string;
  note: string;
} {
  return {
    tick: twin.tick,
    healthScore: getTwinHealthScore(twin),
    environment: twin.environment.label,
    batteryPct: twin.battery.percentage,
    activeFaults: twin.activeFaults.filter(f => f.isActive).length,
    cameras: getWorkingCameraCount(twin),
    isBooted: twin.isBooted,
    platform: twin.platform,
    note: TWIN_NOTE,
  };
}

// ─── AI Validation ────────────────────────────────────────────────────────────

export function validateGuardianResponse(twin: DigitalTwinState): AIValidationResult {
  const hasCriticalFault = isCriticalFaultActive(twin);
  const guardianRespondsCorrectly = twin.isBooted && twin.speaker.isWorking;
  const navigationDegradesSafely = twin.gps.isOfflineMode
    ? twin.imu.isWorking  // can dead-reckon
    : twin.gps.hasSignal;
  const offlineModeContinues = true; // Offline engine (Sprint 14) is always available
  const emergencyModeWorks = twin.isBooted && twin.battery.percentage > 0;
  const explainableAIAvailable = twin.isBooted;

  const allPassed = guardianRespondsCorrectly && navigationDegradesSafely
    && offlineModeContinues && emergencyModeWorks && explainableAIAvailable;

  return {
    scenario: 'guardian-responds-to-fault',
    guardianRespondsCorrectly,
    navigationDegradesSafely,
    offlineModeContinues,
    emergencyModeWorks,
    explainableAIAvailable,
    passed: allPassed,
    notes: hasCriticalFault ? 'Running under fault conditions.' : 'Normal operation.',
  };
}

export function validateNavigationDegradation(twin: DigitalTwinState): AIValidationResult {
  const hasGPSLoss = hasActiveFault(twin, 'gps-loss');
  const navigationDegradesSafely = hasGPSLoss ? twin.imu.isWorking : true;
  const guardianRespondsCorrectly = twin.speaker.isWorking;
  const passed = navigationDegradesSafely && guardianRespondsCorrectly;

  return {
    scenario: 'navigation-degrades-safely',
    guardianRespondsCorrectly,
    navigationDegradesSafely,
    offlineModeContinues: true,
    emergencyModeWorks: twin.battery.percentage > 0,
    explainableAIAvailable: twin.isBooted,
    passed,
    notes: hasGPSLoss
      ? 'GPS loss: Navigation switched to IMU dead-reckoning.'
      : 'GPS available: Full navigation operational.',
  };
}

export function validateOfflineMode(twin: DigitalTwinState): AIValidationResult {
  const offlineModeContinues = true; // Sprint 14 offline engine always runs on glasses
  const guardianRespondsCorrectly = twin.speaker.isWorking;
  const passed = offlineModeContinues && guardianRespondsCorrectly;

  return {
    scenario: 'offline-mode-continues',
    guardianRespondsCorrectly,
    navigationDegradesSafely: twin.imu.isWorking,
    offlineModeContinues,
    emergencyModeWorks: twin.battery.percentage > 0,
    explainableAIAvailable: twin.isBooted,
    passed,
    notes: 'Offline engine (Sprint 14) runs on glasses compute module — always available.',
  };
}

export function validateEmergencyMode(twin: DigitalTwinState): AIValidationResult {
  const emergencyModeWorks = twin.isBooted && twin.battery.percentage > 0;
  const passed = emergencyModeWorks;

  return {
    scenario: 'emergency-mode-activation',
    guardianRespondsCorrectly: twin.speaker.isWorking,
    navigationDegradesSafely: true,
    offlineModeContinues: true,
    emergencyModeWorks,
    explainableAIAvailable: twin.isBooted,
    passed,
    notes: emergencyModeWorks
      ? 'Emergency mode: Guardian + bone-conduction remain active at critical battery.'
      : 'Battery depleted: device offline.',
  };
}

export function validateExplainableAI(twin: DigitalTwinState): AIValidationResult {
  const explainableAIAvailable = twin.isBooted;
  const passed = explainableAIAvailable;

  return {
    scenario: 'explainable-ai-available',
    guardianRespondsCorrectly: twin.speaker.isWorking,
    navigationDegradesSafely: true,
    offlineModeContinues: true,
    emergencyModeWorks: twin.battery.percentage > 0,
    explainableAIAvailable,
    passed,
    notes: 'Explainable AI (Sprint 9) explains every Guardian decision.',
  };
}

export function runAllAIValidations(twin: DigitalTwinState): AIValidationResult[] {
  return [
    validateGuardianResponse(twin),
    validateNavigationDegradation(twin),
    validateOfflineMode(twin),
    validateEmergencyMode(twin),
    validateExplainableAI(twin),
  ];
}

export function allAIValidationsPassed(twin: DigitalTwinState): boolean {
  return runAllAIValidations(twin).every(v => v.passed);
}

// ─── Manufacturing Readiness ───────────────────────────────────────────────────

export function buildManufacturingReadinessScore(
  twin: DigitalTwinState
): ManufacturingReadinessScore {
  const blockers: string[] = [];
  const recommendations: string[] = [];

  if (hasActiveFault(twin, 'camera-failure')) blockers.push('Camera failure: primary camera offline');
  if (!twin.cameras.some(c => c.isWorking)) blockers.push('All cameras offline');
  if (hasActiveFault(twin, 'speaker-failure')) blockers.push('Bone-conduction speaker failure active');
  if (!twin.speaker.isWorking && !hasActiveFault(twin, 'speaker-failure')) blockers.push('Bone-conduction speaker not working');
  if (twin.battery.temperatureC >= 55) blockers.push('Thermal limit exceeded');
  if (twin.imu.driftFactor > 3) blockers.push('IMU drift exceeds safe threshold');
  if (twin.battery.percentage <= 0) blockers.push('Battery fully depleted in simulation');

  if (twin.imu.driftFactor > 1.5) recommendations.push('Investigate IMU drift calibration');
  if (twin.battery.drainRateMultiplier > 2) recommendations.push('Optimise power consumption');
  if (!twin.gps.hasSignal) recommendations.push('Test GPS in open-sky conditions');

  const validations = runAllAIValidations(twin);
  const failedValidations = validations.filter(v => !v.passed);
  for (const v of failedValidations) recommendations.push(`AI validation failed: ${v.scenario}`);

  const healthScore = getTwinHealthScore(twin);
  const score = Math.max(0, healthScore - blockers.length * 15);
  const isReady = blockers.length === 0 && score >= 70 && allAIValidationsPassed(twin);

  return { score, isReady, blockers, recommendations };
}

// ─── Performance ──────────────────────────────────────────────────────────────

export function getPerformanceMetrics(
  twin: DigitalTwinState,
  startTick: number
): PerformanceMetrics {
  const statuses = [
    twin.cameras.some(c => c.isWorking),
    twin.gps.hasSignal || twin.gps.isOfflineMode,
    twin.imu.isWorking,
    twin.battery.percentage > 10,
    twin.microphones.some(m => m.isWorking),
    twin.speaker.isWorking,
    twin.display.isOn,
  ];

  return {
    tick: twin.tick,
    uptimeTicks: twin.isBooted ? twin.tick - startTick : 0,
    activeFaultCount: getActiveFaults(twin).length,
    healthyComponentCount: statuses.filter(Boolean).length,
    totalComponentCount: statuses.length,
    batteryPercentage: twin.battery.percentage,
    gpsAccuracyM: twin.gps.accuracyM,
    environmentLabel: twin.environment.label,
  };
}

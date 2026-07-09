// Sprint 18: Smart Glasses Hardware Simulator & Digital Twin — test suite
import {
  createGlassesSimulator, bootSimulator, tickSimulator, resetSimulator,
  setSimulatorEnvironment, getWorkingCameraCount, isSimulatorHealthy,
  getSimulatorSummary, getSimulatorMode, getComponentStatuses,
} from '../src/engines/glassesSimulatorEngine';

import {
  createDigitalTwin, getTwinHealthScore, buildTwinSnapshot,
  validateGuardianResponse, validateNavigationDegradation, validateOfflineMode,
  validateEmergencyMode, validateExplainableAI, runAllAIValidations,
  allAIValidationsPassed, buildManufacturingReadinessScore, getPerformanceMetrics,
} from '../src/engines/digitalTwinEngine';

import {
  simulateCameraFrame, getCameraConfidence, simulateGPS, getGPSQualityLabel,
  simulateIMU, simulateCompass, simulateBatteryTick, simulateTemperature,
  isBatteryThermalCritical, simulateMicFrame, getMicQuality, getDisplayVisibility,
} from '../src/engines/virtualSensorEngine';

import {
  FAULT_DEFINITIONS,
  injectCameraFailure, injectGPSLoss, injectLowBattery, injectSensorDrift,
  injectMicrophoneFailure, injectSpeakerFailure, injectOverheat, injectLowLight,
  injectPartialObstruction, clearFault, getActiveFaults, isCriticalFaultActive,
  getFaultBySeverity, hasActiveFault, recoverFromCameraFault, recoverFromGPSLoss,
  recoverFromDrift,
} from '../src/engines/hardwareFaultEngine';

import {
  ENVIRONMENT_REGISTRY,
  getEnvironmentProfile, getGPSAccuracyForEnvironment, getNoiseLevelForEnvironment,
  getLightLevelForEnvironment, getTypicalHazards, isIndoorEnvironment,
  getHazardDensityScore, applyEnvironment, buildEnvironmentContext,
  getEnvironmentCameraChallenge, needsBoneConductionBoost, getAllEnvironmentTypes,
} from '../src/engines/environmentSimulationEngine';

import {
  buildSensorHealthDashboard, runDiagnostics, validateAISystems,
  buildPerformanceSummary, getFaultHistory, buildManufacturingReadinessReport,
} from '../src/engines/diagnosticsEngine';

import {
  TWIN_NOTE, DIGITAL_TWIN_PLATFORM, TOTAL_VIRTUAL_COMPONENTS,
  AI_VALIDATION_SCENARIOS,
} from '../src/types/simulator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e: unknown) { console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); failed++; }
}

function expect(val: unknown) {
  return {
    toBe:                (x: unknown) => { if (val !== x) throw new Error(`Expected ${JSON.stringify(x)}, got ${JSON.stringify(val)}`); },
    toBeTruthy:          () => { if (!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`); },
    toBeFalsy:           () => { if (val)  throw new Error(`Expected falsy, got ${JSON.stringify(val)}`); },
    toBeNull:            () => { if (val !== null) throw new Error(`Expected null, got ${JSON.stringify(val)}`); },
    toBeGreaterThan:     (n: number) => { if ((val as number) <= n) throw new Error(`Expected > ${n}, got ${val}`); },
    toBeLessThan:        (n: number) => { if ((val as number) >= n) throw new Error(`Expected < ${n}, got ${val}`); },
    toBeGreaterThanOrEqual: (n: number) => { if ((val as number) < n) throw new Error(`Expected >= ${n}, got ${val}`); },
    toBeLessThanOrEqual: (n: number) => { if ((val as number) > n) throw new Error(`Expected <= ${n}, got ${val}`); },
    toContain: (sub: unknown) => {
      if (Array.isArray(val)) { if (!val.includes(sub)) throw new Error(`Array does not contain ${JSON.stringify(sub)}`); }
      else if (typeof val === 'string') { if (!val.includes(sub as string)) throw new Error(`"${val}" does not contain "${sub}"`); }
      else throw new Error('toContain: unsupported type');
    },
    toHaveLength: (n: number) => { const len = (val as unknown[]).length; if (len !== n) throw new Error(`Expected length ${n}, got ${len}`); },
  };
}

function freshTwin() { return bootSimulator(createDigitalTwin(), 0); }

// ─── Suite 1: Environment Simulation ─────────────────────────────────────────

console.log('\nEnvironment Simulation');

test('11 environments registered', () => {
  expect(getAllEnvironmentTypes()).toHaveLength(11);
});

test('busy-city has high hazard density', () => {
  expect(getEnvironmentProfile('busy-city').hazardDensity).toBe('high');
});

test('quiet-street has low hazard density', () => {
  expect(getEnvironmentProfile('quiet-street').hazardDensity).toBe('low');
});

test('shopping-mall is indoor', () => {
  expect(isIndoorEnvironment('shopping-mall')).toBeTruthy();
});

test('quiet-street is not indoor', () => {
  expect(isIndoorEnvironment('quiet-street')).toBeFalsy();
});

test('night has dark light level', () => {
  expect(getLightLevelForEnvironment('night')).toBe('dark');
});

test('strong-sunlight has bright light level', () => {
  expect(getLightLevelForEnvironment('strong-sunlight')).toBe('bright');
});

test('airport has high ambient noise', () => {
  expect(getNoiseLevelForEnvironment('airport')).toBeGreaterThan(0.7);
});

test('night has low ambient noise', () => {
  expect(getNoiseLevelForEnvironment('night')).toBeLessThan(0.3);
});

test('busy-city GPS accuracy worse than quiet-street', () => {
  expect(getGPSAccuracyForEnvironment('busy-city')).toBeGreaterThan(getGPSAccuracyForEnvironment('quiet-street'));
});

test('indoor-navigation GPS accuracy > 30m', () => {
  expect(getGPSAccuracyForEnvironment('indoor-navigation')).toBeGreaterThan(30);
});

test('fog has camera challenge score', () => {
  expect(getEnvironmentCameraChallenge('fog')).toBeGreaterThan(0);
});

test('quiet-street has low camera challenge', () => {
  expect(getEnvironmentCameraChallenge('quiet-street')).toBe(0);
});

test('train-station has platform edge in hazards', () => {
  expect(getTypicalHazards('train-station')).toContain('platform edge');
});

test('needsBoneConductionBoost - true for noisy environments', () => {
  expect(needsBoneConductionBoost('airport')).toBeTruthy();
});

test('needsBoneConductionBoost - false for quiet-street', () => {
  expect(needsBoneConductionBoost('quiet-street')).toBeFalsy();
});

test('getHazardDensityScore - high → 1.0', () => {
  expect(getHazardDensityScore('busy-city')).toBe(1.0);
});

test('getHazardDensityScore - low → 0.2', () => {
  expect(getHazardDensityScore('quiet-street')).toBe(0.2);
});

test('applyEnvironment updates gps accuracy', () => {
  const twin = freshTwin();
  const updated = applyEnvironment(twin, 'shopping-mall');
  expect(updated.gps.accuracyM).toBe(getGPSAccuracyForEnvironment('shopping-mall'));
});

test('applyEnvironment sets indoor GPS offline mode', () => {
  const twin = freshTwin();
  const updated = applyEnvironment(twin, 'shopping-mall');
  expect(updated.gps.isOfflineMode).toBeTruthy();
});

test('buildEnvironmentContext returns correct type', () => {
  const ctx = buildEnvironmentContext('night', 5);
  expect(ctx.environment).toBe('night');
  expect(ctx.lightLevel).toBe('dark');
});

// ─── Suite 2: Virtual Sensors ─────────────────────────────────────────────────

console.log('\nVirtual Sensors');

test('simulateCameraFrame - returns frame when working', () => {
  const twin = freshTwin();
  const frame = simulateCameraFrame(twin.cameras[0], twin.environment, 1);
  expect(frame).toBeTruthy();
});

test('simulateCameraFrame - returns null when camera broken', () => {
  const twin = freshTwin();
  const brokenCam = { ...twin.cameras[0], isWorking: false };
  expect(simulateCameraFrame(brokenCam, twin.environment, 1)).toBeNull();
});

test('simulateCameraFrame - dark light reduces confidence', () => {
  const twin = freshTwin();
  const darkCam = { ...twin.cameras[0], lightLevel: 'dark' as const };
  const normalCam = { ...twin.cameras[0], lightLevel: 'normal' as const };
  const dark = simulateCameraFrame(darkCam, twin.environment, 1);
  const normal = simulateCameraFrame(normalCam, twin.environment, 1);
  expect(dark!.confidence).toBeLessThan(normal!.confidence);
});

test('simulateCameraFrame - obstruction sets obstructed flag', () => {
  const twin = freshTwin();
  const cam = { ...twin.cameras[0], obstructionLevel: 0.5 };
  const frame = simulateCameraFrame(cam, twin.environment, 1);
  expect(frame?.obstructed).toBeTruthy();
});

test('getCameraConfidence - 0 when not working', () => {
  const twin = freshTwin();
  const broken = { ...twin.cameras[0], isWorking: false };
  expect(getCameraConfidence(broken)).toBe(0);
});

test('simulateGPS - returns reading when signal', () => {
  const twin = freshTwin();
  const reading = simulateGPS(twin.gps, twin.environment, 1);
  expect(reading).toBeTruthy();
});

test('simulateGPS - returns offline reading when no signal + offline', () => {
  const twin = freshTwin();
  const offlineGPS = { ...twin.gps, hasSignal: false, isOfflineMode: true };
  const reading = simulateGPS(offlineGPS, twin.environment, 1);
  expect(reading?.mode).toBe('offline-dead-reckoning');
});

test('simulateGPS - returns null when no signal and not offline', () => {
  const twin = freshTwin();
  const noGPS = { ...twin.gps, hasSignal: false, isOfflineMode: false };
  expect(simulateGPS(noGPS, twin.environment, 1)).toBeNull();
});

test('getGPSQualityLabel - 2m → excellent', () => {
  expect(getGPSQualityLabel(2)).toBe('excellent');
});

test('getGPSQualityLabel - 100m → unavailable', () => {
  expect(getGPSQualityLabel(100)).toBe('unavailable');
});

test('simulateIMU - returns reading when working', () => {
  const twin = freshTwin();
  const reading = simulateIMU(twin.imu, twin.environment, 1);
  expect(reading).toBeTruthy();
});

test('simulateIMU - returns null when broken', () => {
  const twin = freshTwin();
  const broken = { ...twin.imu, isWorking: false };
  expect(simulateIMU(broken, twin.environment, 1)).toBeNull();
});

test('simulateIMU - drift factor > 2 leads to falling state', () => {
  const twin = freshTwin();
  const drifting = { ...twin.imu, driftFactor: 3 };
  const reading = simulateIMU(drifting, twin.environment, 50);
  expect(reading?.motionState).toBe('falling');
});

test('simulateCompass - heading in 0-360 range', () => {
  const twin = freshTwin();
  const heading = simulateCompass(twin.imu, twin.environment, 1);
  expect(heading).toBeGreaterThanOrEqual(0);
  expect(heading).toBeLessThan(360);
});

test('simulateBatteryTick - drains battery', () => {
  const twin = freshTwin();
  const after = simulateBatteryTick(twin.battery, twin.environment, 1);
  expect(after.percentage).toBeLessThan(twin.battery.percentage);
});

test('simulateBatteryTick - charges battery when isCharging', () => {
  const twin = freshTwin();
  const charging = { ...twin.battery, isCharging: true, percentage: 50 };
  const after = simulateBatteryTick(charging, twin.environment, 1);
  expect(after.percentage).toBeGreaterThan(50);
});

test('simulateTemperature - hot environment raises temp', () => {
  const twin = freshTwin();
  const hotEnv = ENVIRONMENT_REGISTRY['strong-sunlight'];
  const temp = simulateTemperature(twin.battery, hotEnv);
  expect(temp).toBeGreaterThan(twin.battery.temperatureC);
});

test('isBatteryThermalCritical - true at 55°C', () => {
  const twin = freshTwin();
  const hot = { ...twin.battery, temperatureC: 55 };
  expect(isBatteryThermalCritical(hot)).toBeTruthy();
});

test('isBatteryThermalCritical - false at 30°C', () => {
  const twin = freshTwin();
  expect(isBatteryThermalCritical(twin.battery)).toBeFalsy();
});

test('simulateMicFrame - returns frame when working', () => {
  const twin = freshTwin();
  const frame = simulateMicFrame(twin.microphones[0], twin.environment, 1);
  expect(frame).toBeTruthy();
});

test('simulateMicFrame - null when broken', () => {
  const twin = freshTwin();
  const broken = { ...twin.microphones[0], isWorking: false };
  expect(simulateMicFrame(broken, twin.environment, 1)).toBeNull();
});

test('getMicQuality - failed when not working', () => {
  const twin = freshTwin();
  const broken = { ...twin.microphones[0], isWorking: false };
  expect(getMicQuality(broken, twin.environment)).toBe('failed');
});

test('getDisplayVisibility - poor in bright light with low brightness', () => {
  expect(getDisplayVisibility(30, 'bright')).toBe('poor');
});

test('getDisplayVisibility - excellent at normal brightness', () => {
  expect(getDisplayVisibility(60, 'normal')).toBe('excellent');
});

// ─── Suite 3: Hardware Fault Engine ──────────────────────────────────────────

console.log('\nHardware Fault Engine');

test('9 fault definitions registered', () => {
  expect(Object.keys(FAULT_DEFINITIONS)).toHaveLength(9);
});

test('injectCameraFailure - disables front camera', () => {
  const twin = freshTwin();
  const { twin: ft } = injectCameraFailure(twin, 1);
  expect(ft.cameras[0].isWorking).toBeFalsy();
});

test('injectCameraFailure - adds fault to activeFaults', () => {
  const twin = freshTwin();
  const { twin: ft } = injectCameraFailure(twin, 1);
  expect(getActiveFaults(ft)).toHaveLength(1);
});

test('injectCameraFailure - result has critical safety impact', () => {
  const { result } = injectCameraFailure(freshTwin(), 1);
  expect(result.safetyImpact).toBe('critical');
});

test('injectGPSLoss - removes GPS signal', () => {
  const { twin: ft } = injectGPSLoss(freshTwin(), 1);
  expect(ft.gps.hasSignal).toBeFalsy();
});

test('injectGPSLoss - activates offline mode', () => {
  const { twin: ft } = injectGPSLoss(freshTwin(), 1);
  expect(ft.gps.isOfflineMode).toBeTruthy();
});

test('injectLowBattery - sets battery to given percentage', () => {
  const { twin: ft } = injectLowBattery(freshTwin(), 5, 1);
  expect(ft.battery.percentage).toBe(5);
});

test('injectLowBattery - clamps to 0', () => {
  const { twin: ft } = injectLowBattery(freshTwin(), -10, 1);
  expect(ft.battery.percentage).toBe(0);
});

test('injectSensorDrift - sets drift factor', () => {
  const { twin: ft } = injectSensorDrift(freshTwin(), 2.5, 1);
  expect(ft.imu.driftFactor).toBe(2.5);
});

test('injectMicrophoneFailure - disables all mics', () => {
  const { twin: ft } = injectMicrophoneFailure(freshTwin(), 1);
  expect(ft.microphones.every(m => !m.isWorking)).toBeTruthy();
});

test('injectSpeakerFailure - disables speaker', () => {
  const { twin: ft } = injectSpeakerFailure(freshTwin(), 1);
  expect(ft.speaker.isWorking).toBeFalsy();
});

test('injectOverheat - sets temperature', () => {
  const { twin: ft } = injectOverheat(freshTwin(), 60, 1);
  expect(ft.battery.temperatureC).toBe(60);
});

test('injectOverheat - sets display hasOverheat when >= 50°C', () => {
  const { twin: ft } = injectOverheat(freshTwin(), 55, 1);
  expect(ft.display.hasOverheat).toBeTruthy();
});

test('injectLowLight - sets all cameras to dark', () => {
  const { twin: ft } = injectLowLight(freshTwin(), 1);
  expect(ft.cameras.every(c => c.lightLevel === 'dark')).toBeTruthy();
});

test('injectPartialObstruction - sets front camera obstruction', () => {
  const { twin: ft } = injectPartialObstruction(freshTwin(), 0.6, 1);
  expect(ft.cameras[0].obstructionLevel).toBe(0.6);
});

test('injectPartialObstruction - clamps to 0-1', () => {
  const { twin: ft } = injectPartialObstruction(freshTwin(), 1.5, 1);
  expect(ft.cameras[0].obstructionLevel).toBeLessThanOrEqual(1);
});

test('clearFault - removes fault', () => {
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  const cleared = clearFault(ft, 'camera-failure');
  expect(getActiveFaults(cleared)).toHaveLength(0);
});

test('recoverFromCameraFault - restores camera', () => {
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  const recovered = recoverFromCameraFault(ft);
  expect(recovered.cameras[0].isWorking).toBeTruthy();
});

test('recoverFromGPSLoss - restores GPS signal', () => {
  const { twin: ft } = injectGPSLoss(freshTwin(), 1);
  const recovered = recoverFromGPSLoss(ft);
  expect(recovered.gps.hasSignal).toBeTruthy();
});

test('recoverFromDrift - resets drift factor', () => {
  const { twin: ft } = injectSensorDrift(freshTwin(), 3, 1);
  const recovered = recoverFromDrift(ft);
  expect(recovered.imu.driftFactor).toBe(1.0);
});

test('isCriticalFaultActive - true with camera failure', () => {
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  expect(isCriticalFaultActive(ft)).toBeTruthy();
});

test('isCriticalFaultActive - false with no faults', () => {
  expect(isCriticalFaultActive(freshTwin())).toBeFalsy();
});

test('hasActiveFault - true after injection', () => {
  const { twin: ft } = injectGPSLoss(freshTwin(), 1);
  expect(hasActiveFault(ft, 'gps-loss')).toBeTruthy();
});

test('hasActiveFault - false before injection', () => {
  expect(hasActiveFault(freshTwin(), 'gps-loss')).toBeFalsy();
});

test('getFaultBySeverity - finds critical faults', () => {
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  expect(getFaultBySeverity(ft, 'critical')).toHaveLength(1);
});

// ─── Suite 4: Glasses Simulator Engine ───────────────────────────────────────

console.log('\nGlasses Simulator Engine');

test('createGlassesSimulator - not booted by default', () => {
  expect(createGlassesSimulator().isBooted).toBeFalsy();
});

test('createGlassesSimulator - platform is simulation', () => {
  expect(createGlassesSimulator().platform).toBe('simulation');
});

test('bootSimulator - sets isBooted true', () => {
  expect(bootSimulator(createGlassesSimulator(), 0).isBooted).toBeTruthy();
});

test('bootSimulator - sets bootedAtTick', () => {
  expect(bootSimulator(createGlassesSimulator(), 5).bootedAtTick).toBe(5);
});

test('tickSimulator - drains battery', () => {
  const twin = freshTwin();
  const after = tickSimulator(twin, 1);
  expect(after.battery.percentage).toBeLessThan(twin.battery.percentage);
});

test('tickSimulator - no-op when not booted', () => {
  const twin = createGlassesSimulator();
  const after = tickSimulator(twin, 1);
  expect(after.tick).toBe(0);
});

test('resetSimulator - returns fresh state', () => {
  const twin = freshTwin();
  const { twin: ft } = injectCameraFailure(twin, 1);
  const reset = resetSimulator(ft);
  expect(reset.activeFaults).toHaveLength(0);
});

test('setSimulatorEnvironment - changes environment', () => {
  const twin = freshTwin();
  const updated = setSimulatorEnvironment(twin, 'night');
  expect(updated.environment.type).toBe('night');
});

test('getWorkingCameraCount - 3 when all healthy', () => {
  expect(getWorkingCameraCount(freshTwin())).toBe(3);
});

test('getWorkingCameraCount - 2 after one camera fails', () => {
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  expect(getWorkingCameraCount(ft)).toBe(2);
});

test('isSimulatorHealthy - true when all healthy', () => {
  expect(isSimulatorHealthy(freshTwin())).toBeTruthy();
});

test('isSimulatorHealthy - false when speaker fails', () => {
  const { twin: ft } = injectSpeakerFailure(freshTwin(), 1);
  expect(isSimulatorHealthy(ft)).toBeFalsy();
});

test('getSimulatorSummary - includes twinNote', () => {
  const summary = getSimulatorSummary(freshTwin());
  expect(summary.twinNote).toBe(TWIN_NOTE);
});

test('getSimulatorSummary - workingCameras is 3', () => {
  expect(getSimulatorSummary(freshTwin()).workingCameras).toBe(3);
});

test('getSimulatorMode - manual with no faults', () => {
  expect(getSimulatorMode(freshTwin())).toBe('manual');
});

test('getSimulatorMode - scripted with faults', () => {
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  expect(getSimulatorMode(ft)).toBe('scripted');
});

test('getComponentStatuses - 11 components', () => {
  expect(getComponentStatuses(freshTwin())).toHaveLength(11);
});

// ─── Suite 5: Digital Twin Engine ────────────────────────────────────────────

console.log('\nDigital Twin Engine');

test('createDigitalTwin - not booted', () => {
  expect(createDigitalTwin().isBooted).toBeFalsy();
});

test('getTwinHealthScore - 0 before boot', () => {
  expect(getTwinHealthScore(createDigitalTwin())).toBe(0);
});

test('getTwinHealthScore - > 80 when healthy', () => {
  expect(getTwinHealthScore(freshTwin())).toBeGreaterThan(80);
});

test('getTwinHealthScore - drops with camera fault', () => {
  const healthy = getTwinHealthScore(freshTwin());
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  expect(getTwinHealthScore(ft)).toBeLessThan(healthy);
});

test('buildTwinSnapshot - includes health score', () => {
  const snap = buildTwinSnapshot(freshTwin());
  expect(snap.healthScore).toBeGreaterThan(0);
});

test('buildTwinSnapshot - activeFaults is 0 when no faults', () => {
  expect(buildTwinSnapshot(freshTwin()).activeFaults).toBe(0);
});

test('validateGuardianResponse - passes in healthy state', () => {
  expect(validateGuardianResponse(freshTwin()).passed).toBeTruthy();
});

test('validateGuardianResponse - fails when speaker broken', () => {
  const { twin: ft } = injectSpeakerFailure(freshTwin(), 1);
  expect(validateGuardianResponse(ft).passed).toBeFalsy();
});

test('validateNavigationDegradation - passes when GPS available', () => {
  expect(validateNavigationDegradation(freshTwin()).passed).toBeTruthy();
});

test('validateNavigationDegradation - passes on GPS loss if IMU working', () => {
  const { twin: ft } = injectGPSLoss(freshTwin(), 1);
  expect(validateNavigationDegradation(ft).passed).toBeTruthy();
});

test('validateOfflineMode - always passes (Sprint 14 edge AI)', () => {
  expect(validateOfflineMode(freshTwin()).passed).toBeTruthy();
});

test('validateEmergencyMode - passes when booted and battery > 0', () => {
  expect(validateEmergencyMode(freshTwin()).passed).toBeTruthy();
});

test('validateExplainableAI - passes when booted', () => {
  expect(validateExplainableAI(freshTwin()).passed).toBeTruthy();
});

test('runAllAIValidations - returns 5 results', () => {
  expect(runAllAIValidations(freshTwin())).toHaveLength(5);
});

test('allAIValidationsPassed - true in healthy state', () => {
  expect(allAIValidationsPassed(freshTwin())).toBeTruthy();
});

test('buildManufacturingReadinessScore - ready in healthy state', () => {
  const score = buildManufacturingReadinessScore(freshTwin());
  expect(score.isReady).toBeTruthy();
});

test('buildManufacturingReadinessScore - not ready when camera fails', () => {
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  const score = buildManufacturingReadinessScore(ft);
  expect(score.isReady).toBeFalsy();
});

test('buildManufacturingReadinessScore - has blockers when camera fails', () => {
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  expect(buildManufacturingReadinessScore(ft).blockers.length).toBeGreaterThan(0);
});

test('getPerformanceMetrics - uptime is 0 before boot', () => {
  const twin = createDigitalTwin();
  const metrics = getPerformanceMetrics(twin, 0);
  expect(metrics.uptimeTicks).toBe(0);
});

test('getPerformanceMetrics - returns correct environment label', () => {
  const twin = freshTwin();
  const metrics = getPerformanceMetrics(twin, 0);
  expect(metrics.environmentLabel).toBeTruthy();
});

// ─── Suite 6: Diagnostics Engine ─────────────────────────────────────────────

console.log('\nDiagnostics Engine');

test('buildSensorHealthDashboard - returns entries for all components', () => {
  const entries = buildSensorHealthDashboard(freshTwin());
  expect(entries.length).toBeGreaterThan(5);
});

test('buildSensorHealthDashboard - camera entries are healthy', () => {
  const entries = buildSensorHealthDashboard(freshTwin());
  const camEntries = entries.filter(e => e.component.startsWith('camera'));
  expect(camEntries.every(e => e.isHealthy)).toBeTruthy();
});

test('buildSensorHealthDashboard - camera degraded after fault', () => {
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  const entries = buildSensorHealthDashboard(ft);
  const frontCam = entries.find(e => e.component === 'camera-front');
  expect(frontCam?.isHealthy).toBeFalsy();
});

test('buildSensorHealthDashboard - battery has issues at critical level', () => {
  const { twin: ft } = injectLowBattery(freshTwin(), 5, 1);
  const entries = buildSensorHealthDashboard(ft);
  const bat = entries.find(e => e.component === 'battery');
  expect(bat?.issues.length).toBeGreaterThan(0);
});

test('runDiagnostics - returns report with healthScore', () => {
  const report = runDiagnostics(freshTwin());
  expect(report.overallHealthScore).toBeGreaterThan(0);
});

test('runDiagnostics - isManufacturingReady true in healthy state', () => {
  expect(runDiagnostics(freshTwin()).isManufacturingReady).toBeTruthy();
});

test('runDiagnostics - activeFaultCount is 0 when no faults', () => {
  expect(runDiagnostics(freshTwin()).activeFaultCount).toBe(0);
});

test('runDiagnostics - activeFaultCount is 1 after GPS loss', () => {
  const { twin: ft } = injectGPSLoss(freshTwin(), 1);
  expect(runDiagnostics(ft).activeFaultCount).toBe(1);
});

test('runDiagnostics - criticalFaultCount is 1 after camera failure', () => {
  const { twin: ft } = injectCameraFailure(freshTwin(), 1);
  expect(runDiagnostics(ft).criticalFaultCount).toBe(1);
});

test('validateAISystems - returns 5 results', () => {
  expect(validateAISystems(freshTwin())).toHaveLength(5);
});

test('buildPerformanceSummary - healthScore > 0 when booted', () => {
  const twin = freshTwin();
  const summary = buildPerformanceSummary(twin, 0);
  expect(summary.healthScore).toBeGreaterThan(0);
});

test('getFaultHistory - empty when no faults injected', () => {
  expect(getFaultHistory(freshTwin())).toHaveLength(0);
});

test('getFaultHistory - 1 entry after injection', () => {
  const { twin: ft } = injectGPSLoss(freshTwin(), 1);
  expect(getFaultHistory(ft)).toHaveLength(1);
});

test('buildManufacturingReadinessReport - isReady in healthy state', () => {
  expect(buildManufacturingReadinessReport(freshTwin()).isReady).toBeTruthy();
});

// ─── Suite 7: Constants & Architecture ───────────────────────────────────────

console.log('\nConstants & Architecture');

test('TWIN_NOTE mentions Digital Twin', () => {
  expect(TWIN_NOTE).toContain('Digital Twin');
});

test('TWIN_NOTE mentions manufacturing', () => {
  expect(TWIN_NOTE.toLowerCase()).toContain('manufacturing');
});

test('DIGITAL_TWIN_PLATFORM is simulation', () => {
  expect(DIGITAL_TWIN_PLATFORM).toBe('simulation');
});

test('TOTAL_VIRTUAL_COMPONENTS is 11', () => {
  expect(TOTAL_VIRTUAL_COMPONENTS).toBe(11);
});

test('AI_VALIDATION_SCENARIOS has 5 entries', () => {
  expect(AI_VALIDATION_SCENARIOS).toHaveLength(5);
});

test('ENVIRONMENT_REGISTRY has all 11 environments', () => {
  expect(Object.keys(ENVIRONMENT_REGISTRY)).toHaveLength(11);
});

// ─── Result ───────────────────────────────────────────────────────────────────

console.log(`\nDigital Twin Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

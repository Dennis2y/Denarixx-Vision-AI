// Sprint 16: Standalone Smart Glasses OS — test suite
import {
  simulateBootStep,
  runBootSequence,
  runBootUntilPhase,
  buildBootDiagnostic,
  estimateTotalBootTimeMs,
  isBootComplete,
  getBootPhaseLabel,
  getBootPhaseIndex,
  getFailureRecoveryMessage,
} from '../src/engines/bootSequenceEngine';

import {
  classifyPowerLevel,
  shouldWarnUser,
  shouldReducePower,
  isThermalEmergency,
  estimateDrainRate,
  estimateBatteryLifeMinutes,
  getReducedPowerFeatures,
  getActiveFeaturesToKeep,
  buildPowerProfile,
  buildDefaultPowerProfile,
  simulateBatteryTick,
  buildPowerWarning,
  getPowerLevelColor,
} from '../src/engines/glassesPowerEngine';

import {
  isCriticalSensor,
  initializeSensor,
  activateSensor,
  setErrorState,
  degradeSensor,
  restartSensor,
  initializeAllSensors,
  activateAllSensors,
  getSensorByType,
  getActiveSensors,
  getCriticalFailingSensors,
  buildSensorStatusSummary,
  buildSensorFusionFrame,
  detectSensorAnomalies,
  updateSensorInList,
  ALL_SENSOR_TYPES,
} from '../src/engines/glassesOSSensorEngine';

import {
  componentStatusToScore,
  scoreToComponentStatus,
  getHealthColor,
  assessComputeModule,
  assessCameraSystem,
  assessAudioSystem,
  assessSensorArray,
  assessPowerSystem,
  assessStorage,
  assessGuardianEngine,
  buildDeviceHealthReport,
  identifyDegradedComponents,
  isHealthCritical,
} from '../src/engines/deviceHealthEngine';

import {
  determineRuntimeMode,
  selectActiveFeatures,
  createRuntimeState,
  bootGlasses,
  processRuntimeTick,
  activateEmergencyMode,
  buildRuntimeSummary,
  isOperational,
  getStandaloneNote,
} from '../src/engines/glassesRuntimeEngine';

import {
  WAKE_WORD,
  CRITICAL_BATTERY_PCT,
  LOW_BATTERY_PCT,
  THERMAL_THROTTLE_TEMP_C,
  BOOT_PHASES_IN_ORDER,
  CRITICAL_SENSOR_TYPES,
  STANDALONE_PRINCIPLE,
  EMERGENCY_MODE_ANNOUNCEMENT,
  CRITICAL_BATTERY_ANNOUNCEMENT,
  ALWAYS_ACTIVE_FEATURES,
} from '../src/types/glassesOS';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}: ${msg}`);
    failed++;
  }
}

function expect(val: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (val !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toBeTruthy: () => { if (!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`); },
    toBeFalsy: () => { if (val) throw new Error(`Expected falsy, got ${JSON.stringify(val)}`); },
    toBeNull: () => { if (val !== null) throw new Error(`Expected null, got ${JSON.stringify(val)}`); },
    toBeGreaterThan: (n: number) => { if ((val as number) <= n) throw new Error(`Expected > ${n}, got ${val}`); },
    toBeGreaterThanOrEqual: (n: number) => { if ((val as number) < n) throw new Error(`Expected >= ${n}, got ${val}`); },
    toBeLessThanOrEqual: (n: number) => { if ((val as number) > n) throw new Error(`Expected <= ${n}, got ${val}`); },
    toBeLessThan: (n: number) => { if ((val as number) >= n) throw new Error(`Expected < ${n}, got ${val}`); },
    toContain: (sub: unknown) => {
      if (Array.isArray(val)) {
        if (!val.includes(sub)) throw new Error(`Expected array to contain ${JSON.stringify(sub)}`);
      } else if (typeof val === 'string') {
        if (!val.includes(sub as string)) throw new Error(`Expected "${val}" to contain "${sub}"`);
      } else {
        throw new Error(`toContain: unsupported type ${typeof val}`);
      }
    },
    toHaveLength: (n: number) => {
      const len = (val as unknown[]).length;
      if (len !== n) throw new Error(`Expected length ${n}, got ${len}`);
    },
  };
}

// ─── Suite 1: bootSequenceEngine ─────────────────────────────────────────────

console.log('\nbootSequenceEngine');

test('BOOT_PHASES_IN_ORDER has 7 phases', () => {
  expect(BOOT_PHASES_IN_ORDER).toHaveLength(7);
});

test('BOOT_PHASES_IN_ORDER starts with power-on', () => {
  expect(BOOT_PHASES_IN_ORDER[0]).toBe('power-on');
});

test('BOOT_PHASES_IN_ORDER ends with ready', () => {
  expect(BOOT_PHASES_IN_ORDER[BOOT_PHASES_IN_ORDER.length - 1]).toBe('ready');
});

test('simulateBootStep - success by default', () => {
  const step = simulateBootStep('power-on');
  expect(step.success).toBeTruthy();
  expect(step.error).toBeNull();
});

test('simulateBootStep - forced failure', () => {
  const step = simulateBootStep('sensor-init', true);
  expect(step.success).toBeFalsy();
  expect(typeof step.error).toBe('string');
});

test('simulateBootStep - stores phase', () => {
  const step = simulateBootStep('ai-load');
  expect(step.phase).toBe('ai-load');
});

test('simulateBootStep - durationMs > 0', () => {
  const step = simulateBootStep('guardian-start');
  expect(step.durationMs).toBeGreaterThan(0);
});

test('simulateBootStep - duration override works', () => {
  const step = simulateBootStep('power-on', false, 999);
  expect(step.durationMs).toBe(999);
});

test('simulateBootStep - message not empty', () => {
  const step = simulateBootStep('ready');
  expect(step.message.length).toBeGreaterThan(0);
});

test('runBootSequence - successful boot has 7 steps', () => {
  const result = runBootSequence();
  expect(result.steps).toHaveLength(7);
});

test('runBootSequence - all steps succeed by default', () => {
  const result = runBootSequence();
  expect(result.success).toBeTruthy();
});

test('runBootSequence - readyForOperation true on success', () => {
  const result = runBootSequence();
  expect(result.readyForOperation).toBeTruthy();
});

test('runBootSequence - totalDurationMs is sum of step durations', () => {
  const result = runBootSequence();
  const sum = result.steps.reduce((s, r) => s + r.durationMs, 0);
  expect(result.totalDurationMs).toBe(sum);
});

test('runBootSequence - failure at sensor-init', () => {
  const result = runBootSequence({ failAtPhase: 'sensor-init' });
  expect(result.success).toBeFalsy();
  expect(result.failedPhase).toBe('sensor-init');
});

test('runBootSequence - failure stops at failed phase', () => {
  const result = runBootSequence({ failAtPhase: 'ai-load' });
  const phases = result.steps.map(s => s.phase);
  expect(phases.includes('guardian-start')).toBeFalsy();
});

test('runBootSequence - success has null failedPhase', () => {
  const result = runBootSequence();
  expect(result.failedPhase).toBeNull();
});

test('runBootUntilPhase - stops after sensor-init', () => {
  const result = runBootUntilPhase('sensor-init');
  const phases = result.steps.map(s => s.phase);
  expect(phases.includes('sensor-init')).toBeTruthy();
  expect(phases.includes('ai-load')).toBeFalsy();
});

test('runBootUntilPhase - readyForOperation always false', () => {
  const result = runBootUntilPhase('guardian-start');
  expect(result.readyForOperation).toBeFalsy();
});

test('buildBootDiagnostic - status ready on success', () => {
  const result = runBootSequence();
  const diag = buildBootDiagnostic(result);
  expect(diag.status).toBe('ready');
});

test('buildBootDiagnostic - status failed on boot failure', () => {
  const result = runBootSequence({ failAtPhase: 'hardware-check' });
  const diag = buildBootDiagnostic(result);
  expect(diag.status).toBe('failed');
});

test('buildBootDiagnostic - completedPhases lists success steps', () => {
  const result = runBootSequence();
  const diag = buildBootDiagnostic(result);
  expect(diag.completedPhases).toHaveLength(7);
});

test('buildBootDiagnostic - phaseTimings entries match steps', () => {
  const result = runBootSequence();
  const diag = buildBootDiagnostic(result);
  expect(Object.keys(diag.phaseTimings).length).toBe(7);
});

test('buildBootDiagnostic - errors array on failure', () => {
  const result = runBootSequence({ failAtPhase: 'ai-load' });
  const diag = buildBootDiagnostic(result);
  expect(diag.errors.length).toBeGreaterThan(0);
});

test('estimateTotalBootTimeMs - returns positive number', () => {
  expect(estimateTotalBootTimeMs()).toBeGreaterThan(0);
});

test('isBootComplete - true on success', () => {
  const result = runBootSequence();
  expect(isBootComplete(result)).toBeTruthy();
});

test('isBootComplete - false on failure', () => {
  const result = runBootSequence({ failAtPhase: 'sensor-init' });
  expect(isBootComplete(result)).toBeFalsy();
});

test('getBootPhaseLabel - power-on label', () => {
  expect(getBootPhaseLabel('power-on')).toBe('Power On');
});

test('getBootPhaseLabel - ready label', () => {
  expect(getBootPhaseLabel('ready')).toBe('Ready');
});

test('getBootPhaseIndex - power-on is 0', () => {
  expect(getBootPhaseIndex('power-on')).toBe(0);
});

test('getBootPhaseIndex - ready is 6', () => {
  expect(getBootPhaseIndex('ready')).toBe(6);
});

test('getFailureRecoveryMessage - returns non-empty string', () => {
  const msg = getFailureRecoveryMessage('sensor-init');
  expect(msg.length).toBeGreaterThan(0);
});

// ─── Suite 2: glassesPowerEngine ──────────────────────────────────────────────

console.log('\nglassesPowerEngine');

test('classifyPowerLevel - 5% → critical', () => {
  expect(classifyPowerLevel(5)).toBe('critical');
});

test('classifyPowerLevel - 10% → critical', () => {
  expect(classifyPowerLevel(10)).toBe('critical');
});

test('classifyPowerLevel - 15% → low', () => {
  expect(classifyPowerLevel(15)).toBe('low');
});

test('classifyPowerLevel - 40% → normal', () => {
  expect(classifyPowerLevel(40)).toBe('normal');
});

test('classifyPowerLevel - 70% → high', () => {
  expect(classifyPowerLevel(70)).toBe('high');
});

test('classifyPowerLevel - 100% → full', () => {
  expect(classifyPowerLevel(100)).toBe('full');
});

test('shouldWarnUser - 20% → true', () => {
  expect(shouldWarnUser(20)).toBeTruthy();
});

test('shouldWarnUser - 21% → false', () => {
  expect(shouldWarnUser(21)).toBeFalsy();
});

test('shouldReducePower - low battery → true', () => {
  expect(shouldReducePower(15, 30)).toBeTruthy();
});

test('shouldReducePower - high temperature → true', () => {
  expect(shouldReducePower(80, THERMAL_THROTTLE_TEMP_C)).toBeTruthy();
});

test('shouldReducePower - normal → false', () => {
  expect(shouldReducePower(60, 30)).toBeFalsy();
});

test('isThermalEmergency - 55°C → true', () => {
  expect(isThermalEmergency(55)).toBeTruthy();
});

test('isThermalEmergency - 44°C → false', () => {
  expect(isThermalEmergency(44)).toBeFalsy();
});

test('estimateDrainRate - returns positive number', () => {
  expect(estimateDrainRate(['hazard-detection', 'guardian'])).toBeGreaterThan(0);
});

test('estimateDrainRate - more features = higher drain', () => {
  const low = estimateDrainRate(['guardian']);
  const high = estimateDrainRate(['guardian', 'navigation', 'companion', 'cloud-sync']);
  expect(high).toBeGreaterThan(low);
});

test('estimateBatteryLifeMinutes - 100% at 12%/h = 500min', () => {
  expect(estimateBatteryLifeMinutes(100, 12)).toBe(500);
});

test('estimateBatteryLifeMinutes - zero drain returns 999', () => {
  expect(estimateBatteryLifeMinutes(100, 0)).toBe(999);
});

test('getReducedPowerFeatures - critical battery disables many features', () => {
  const reduced = getReducedPowerFeatures(5, 30);
  expect(reduced.length).toBeGreaterThan(0);
});

test('getReducedPowerFeatures - full battery/temp returns empty array', () => {
  const reduced = getReducedPowerFeatures(80, 30);
  expect(reduced).toHaveLength(0);
});

test('getActiveFeaturesToKeep - guardian always kept', () => {
  const kept = getActiveFeaturesToKeep(
    ['guardian', 'companion', 'cloud-sync'],
    ['companion', 'cloud-sync']
  );
  expect(kept).toContain('guardian');
});

test('getActiveFeaturesToKeep - reduced features removed', () => {
  const kept = getActiveFeaturesToKeep(['guardian', 'cloud-sync'], ['cloud-sync']);
  expect(kept.includes('cloud-sync')).toBeFalsy();
});

test('buildPowerProfile - batteryPct clamped to 0-100', () => {
  const p = buildPowerProfile(150, 30, []);
  expect(p.batteryPct).toBe(100);
});

test('buildPowerProfile - critical battery sets thermalThrottle to false at normal temp', () => {
  const p = buildPowerProfile(5, 30, []);
  expect(p.thermalThrottle).toBeFalsy();
});

test('buildPowerProfile - high temp sets thermalThrottle', () => {
  const p = buildPowerProfile(80, 50, []);
  expect(p.thermalThrottle).toBeTruthy();
});

test('buildDefaultPowerProfile - full battery', () => {
  const p = buildDefaultPowerProfile();
  expect(p.batteryPct).toBe(100);
  expect(p.powerLevel).toBe('full');
});

test('simulateBatteryTick - reduces battery', () => {
  const next = simulateBatteryTick(100, 12, 3600);
  expect(next).toBeLessThan(100);
});

test('simulateBatteryTick - does not go below 0', () => {
  const next = simulateBatteryTick(0, 100, 1);
  expect(next).toBe(0);
});

test('buildPowerWarning - critical battery → CRITICAL_BATTERY_ANNOUNCEMENT', () => {
  const warning = buildPowerWarning(5, 30);
  expect(warning).toBe(CRITICAL_BATTERY_ANNOUNCEMENT);
});

test('buildPowerWarning - normal battery → null', () => {
  expect(buildPowerWarning(80, 30)).toBeNull();
});

test('buildPowerWarning - thermal emergency → message', () => {
  const warning = buildPowerWarning(80, 56);
  expect(typeof warning).toBe('string');
});

test('getPowerLevelColor - critical → red', () => {
  expect(getPowerLevelColor('critical')).toBe('red');
});

test('getPowerLevelColor - low → yellow', () => {
  expect(getPowerLevelColor('low')).toBe('yellow');
});

test('getPowerLevelColor - full → green', () => {
  expect(getPowerLevelColor('full')).toBe('green');
});

// ─── Suite 3: glassesOSSensorEngine ───────────────────────────────────────────

console.log('\nglassesOSSensorEngine');

test('ALL_SENSOR_TYPES has 10 entries', () => {
  expect(ALL_SENSOR_TYPES).toHaveLength(10);
});

test('CRITICAL_SENSOR_TYPES has 4 entries', () => {
  expect(CRITICAL_SENSOR_TYPES).toHaveLength(4);
});

test('isCriticalSensor - camera-front → true', () => {
  expect(isCriticalSensor('camera-front')).toBeTruthy();
});

test('isCriticalSensor - imu → true', () => {
  expect(isCriticalSensor('imu')).toBeTruthy();
});

test('isCriticalSensor - gps → false', () => {
  expect(isCriticalSensor('gps')).toBeFalsy();
});

test('isCriticalSensor - compass → false', () => {
  expect(isCriticalSensor('compass')).toBeFalsy();
});

test('initializeSensor - status is initializing', () => {
  const s = initializeSensor('camera-front', 1);
  expect(s.status).toBe('initializing');
});

test('initializeSensor - isCritical set correctly', () => {
  expect(initializeSensor('camera-front', 1).isCritical).toBeTruthy();
  expect(initializeSensor('gps', 1).isCritical).toBeFalsy();
});

test('initializeSensor - confidence > 0', () => {
  expect(initializeSensor('imu', 1).confidence).toBeGreaterThan(0);
});

test('activateSensor - status becomes active', () => {
  const s = activateSensor(initializeSensor('imu', 1), 2);
  expect(s.status).toBe('active');
});

test('activateSensor - lastReadingTick updated', () => {
  const s = activateSensor(initializeSensor('imu', 1), 5);
  expect(s.lastReadingTick).toBe(5);
});

test('setErrorState - status is error', () => {
  const s = setErrorState(initializeSensor('gps', 1), 2);
  expect(s.status).toBe('error');
});

test('setErrorState - errorCount increments', () => {
  const s0 = initializeSensor('gps', 1);
  const s1 = setErrorState(s0, 2);
  expect(s1.errorCount).toBe(1);
});

test('setErrorState - confidence decreases', () => {
  const s = initializeSensor('gps', 1);
  const s2 = setErrorState(s, 2);
  expect(s2.confidence).toBeLessThan(s.confidence);
});

test('degradeSensor - status is degraded', () => {
  const s = degradeSensor(initializeSensor('gps', 1), 2);
  expect(s.status).toBe('degraded');
});

test('restartSensor - status is initializing', () => {
  const s = restartSensor(initializeSensor('camera-front', 1), 3);
  expect(s.status).toBe('initializing');
});

test('restartSensor - restartCount increments', () => {
  const s = restartSensor(initializeSensor('camera-front', 1), 3);
  expect(s.restartCount).toBe(1);
});

test('restartSensor - errorCount reset to 0', () => {
  const s = setErrorState(initializeSensor('camera-front', 1), 2);
  const r = restartSensor(s, 3);
  expect(r.errorCount).toBe(0);
});

test('initializeAllSensors - 10 sensors created', () => {
  expect(initializeAllSensors(0)).toHaveLength(10);
});

test('activateAllSensors - all sensors are active', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  expect(sensors.every(s => s.status === 'active')).toBeTruthy();
});

test('getSensorByType - finds camera-front', () => {
  const sensors = initializeAllSensors(0);
  const s = getSensorByType(sensors, 'camera-front');
  expect(s?.type).toBe('camera-front');
});

test('getSensorByType - undefined for missing type', () => {
  expect(getSensorByType([], 'camera-front')).toBe(undefined);
});

test('getActiveSensors - returns active and degraded', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  expect(getActiveSensors(sensors).length).toBe(10);
});

test('getCriticalFailingSensors - empty when all active', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  expect(getCriticalFailingSensors(sensors)).toHaveLength(0);
});

test('getCriticalFailingSensors - lists camera-front when in error', () => {
  let sensors = activateAllSensors(initializeAllSensors(0), 1);
  const cam = sensors.find(s => s.type === 'camera-front')!;
  sensors = updateSensorInList(sensors, setErrorState(cam, 2));
  const failing = getCriticalFailingSensors(sensors);
  expect(failing).toContain('camera-front');
});

test('buildSensorStatusSummary - total is 10', () => {
  const sensors = initializeAllSensors(0);
  const summary = buildSensorStatusSummary(sensors);
  expect(summary.total).toBe(10);
});

test('buildSensorStatusSummary - allCriticalActive when all active', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const summary = buildSensorStatusSummary(sensors);
  expect(summary.allCriticalActive).toBeTruthy();
});

test('buildSensorFusionFrame - cameraActive when front camera active', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const frame = buildSensorFusionFrame(sensors, 5);
  expect(frame.cameraActive).toBeTruthy();
});

test('buildSensorFusionFrame - fusionQuality high when all active', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const frame = buildSensorFusionFrame(sensors, 5);
  expect(frame.fusionQuality).toBe('high');
});

test('buildSensorFusionFrame - degraded when no cameras active', () => {
  let sensors = initializeAllSensors(0);
  sensors = sensors.map(s => s.type.startsWith('camera') ? setErrorState(s, 1) : activateSensor(s, 1));
  const frame = buildSensorFusionFrame(sensors, 2);
  expect(frame.fusionQuality).toBe('degraded');
});

test('detectSensorAnomalies - empty when all active', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  expect(detectSensorAnomalies(sensors)).toHaveLength(0);
});

test('detectSensorAnomalies - anomaly when critical sensor errors', () => {
  let sensors = activateAllSensors(initializeAllSensors(0), 1);
  const cam = sensors.find(s => s.type === 'camera-front')!;
  sensors = updateSensorInList(sensors, setErrorState(cam, 2));
  const anomalies = detectSensorAnomalies(sensors);
  expect(anomalies.length).toBeGreaterThan(0);
});

test('updateSensorInList - replaces correct sensor', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const gps = sensors.find(s => s.type === 'gps')!;
  const degraded = degradeSensor(gps, 2);
  const updated = updateSensorInList(sensors, degraded);
  expect(updated.find(s => s.type === 'gps')?.status).toBe('degraded');
});

// ─── Suite 4: deviceHealthEngine ──────────────────────────────────────────────

console.log('\ndeviceHealthEngine');

test('componentStatusToScore - healthy → 100', () => {
  expect(componentStatusToScore('healthy')).toBe(100);
});

test('componentStatusToScore - degraded → 60', () => {
  expect(componentStatusToScore('degraded')).toBe(60);
});

test('componentStatusToScore - critical → 25', () => {
  expect(componentStatusToScore('critical')).toBe(25);
});

test('componentStatusToScore - offline → 0', () => {
  expect(componentStatusToScore('offline')).toBe(0);
});

test('scoreToComponentStatus - 90 → healthy', () => {
  expect(scoreToComponentStatus(90)).toBe('healthy');
});

test('scoreToComponentStatus - 60 → degraded', () => {
  expect(scoreToComponentStatus(60)).toBe('degraded');
});

test('scoreToComponentStatus - 20 → critical', () => {
  expect(scoreToComponentStatus(20)).toBe('critical');
});

test('scoreToComponentStatus - 0 → offline', () => {
  expect(scoreToComponentStatus(0)).toBe('offline');
});

test('getHealthColor - 90 → green', () => {
  expect(getHealthColor(90)).toBe('green');
});

test('getHealthColor - 60 → yellow', () => {
  expect(getHealthColor(60)).toBe('yellow');
});

test('getHealthColor - 20 → red', () => {
  expect(getHealthColor(20)).toBe('red');
});

test('assessComputeModule - bootSuccess true → high score', () => {
  const h = assessComputeModule(true, 10);
  expect(h.score).toBeGreaterThan(50);
});

test('assessComputeModule - bootSuccess false → low score', () => {
  const h = assessComputeModule(false, 10);
  expect(h.score).toBeLessThan(50);
  expect(h.issues.length).toBeGreaterThan(0);
});

test('assessCameraSystem - all cameras active → high score', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const h = assessCameraSystem(sensors);
  expect(h.score).toBeGreaterThan(50);
});

test('assessCameraSystem - no cameras → score 0', () => {
  let sensors = activateAllSensors(initializeAllSensors(0), 1);
  sensors = sensors.map(s =>
    s.type.startsWith('camera') ? { ...s, status: 'error' as const } : s
  );
  const h = assessCameraSystem(sensors);
  expect(h.score).toBe(0);
});

test('assessAudioSystem - mics active → score > 0', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const h = assessAudioSystem(sensors);
  expect(h.score).toBeGreaterThan(0);
});

test('assessSensorArray - all active → full score', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const h = assessSensorArray(sensors);
  expect(h.score).toBe(100);
});

test('assessPowerSystem - full battery → high score', () => {
  const p = buildDefaultPowerProfile();
  const h = assessPowerSystem(p);
  expect(h.score).toBeGreaterThan(70);
});

test('assessPowerSystem - critical battery → low score', () => {
  const p = buildPowerProfile(5, 30, []);
  const h = assessPowerSystem(p);
  expect(h.score).toBeLessThan(50);
});

test('assessStorage - bootSuccess true → high score', () => {
  expect(assessStorage(true).score).toBeGreaterThan(70);
});

test('assessStorage - bootSuccess false → lower score', () => {
  expect(assessStorage(false).score).toBeLessThan(70);
});

test('assessGuardianEngine - active → 100', () => {
  const h = assessGuardianEngine(true, true);
  expect(h.score).toBe(100);
});

test('assessGuardianEngine - not active → issues present', () => {
  const h = assessGuardianEngine(false, true);
  expect(h.issues.length).toBeGreaterThan(0);
});

test('buildDeviceHealthReport - 7 components', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const power = buildDefaultPowerProfile();
  const report = buildDeviceHealthReport(sensors, power, true, true, 5);
  expect(report.components).toHaveLength(7);
});

test('buildDeviceHealthReport - isOperational true when healthy', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const power = buildDefaultPowerProfile();
  const report = buildDeviceHealthReport(sensors, power, true, true, 5);
  expect(report.isOperational).toBeTruthy();
});

test('buildDeviceHealthReport - overallScore 0-100', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const power = buildDefaultPowerProfile();
  const report = buildDeviceHealthReport(sensors, power, true, true, 5);
  expect(report.overallScore).toBeGreaterThanOrEqual(0);
  expect(report.overallScore).toBeLessThanOrEqual(100);
});

test('identifyDegradedComponents - empty when all healthy', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const power = buildDefaultPowerProfile();
  const report = buildDeviceHealthReport(sensors, power, true, true, 5);
  expect(identifyDegradedComponents(report).length).toBeLessThanOrEqual(1);
});

test('isHealthCritical - false when healthy', () => {
  const sensors = activateAllSensors(initializeAllSensors(0), 1);
  const power = buildDefaultPowerProfile();
  const report = buildDeviceHealthReport(sensors, power, true, true, 5);
  expect(isHealthCritical(report)).toBeFalsy();
});

// ─── Suite 5: glassesRuntimeEngine ────────────────────────────────────────────

console.log('\nglassesRuntimeEngine');

test('determineRuntimeMode - no phone, no cloud → standalone', () => {
  expect(determineRuntimeMode(false, false, 80)).toBe('standalone');
});

test('determineRuntimeMode - phone, no cloud → phone-companion', () => {
  expect(determineRuntimeMode(true, false, 80)).toBe('phone-companion');
});

test('determineRuntimeMode - cloud → cloud-enhanced', () => {
  expect(determineRuntimeMode(false, true, 80)).toBe('cloud-enhanced');
});

test('determineRuntimeMode - critical battery → emergency', () => {
  expect(determineRuntimeMode(true, true, CRITICAL_BATTERY_PCT)).toBe('emergency');
});

test('selectActiveFeatures - emergency → only always-active', () => {
  const features = selectActiveFeatures('emergency', 5, 30);
  expect(features).toHaveLength(ALWAYS_ACTIVE_FEATURES.length);
});

test('selectActiveFeatures - standalone contains guardian', () => {
  const features = selectActiveFeatures('standalone', 80, 30);
  expect(features).toContain('guardian');
});

test('selectActiveFeatures - cloud-enhanced has more features than standalone', () => {
  const standalone = selectActiveFeatures('standalone', 80, 30);
  const cloud = selectActiveFeatures('cloud-enhanced', 80, 30);
  expect(cloud.length).toBeGreaterThan(standalone.length);
});

test('createRuntimeState - isBooted false', () => {
  const s = createRuntimeState();
  expect(s.isBooted).toBeFalsy();
});

test('createRuntimeState - 10 sensors', () => {
  const s = createRuntimeState();
  expect(s.sensors).toHaveLength(10);
});

test('createRuntimeState - mode standalone', () => {
  const s = createRuntimeState();
  expect(s.mode).toBe('standalone');
});

test('bootGlasses - isBooted true on success', () => {
  const s = bootGlasses(createRuntimeState());
  expect(s.isBooted).toBeTruthy();
});

test('bootGlasses - guardianActive true on success', () => {
  const s = bootGlasses(createRuntimeState());
  expect(s.guardianActive).toBeTruthy();
});

test('bootGlasses - isBooted false when boot fails', () => {
  const s = bootGlasses(createRuntimeState(), 'hardware-check');
  expect(s.isBooted).toBeFalsy();
});

test('bootGlasses - sessionTick increments', () => {
  const s = bootGlasses(createRuntimeState());
  expect(s.sessionTick).toBeGreaterThan(0);
});

test('processRuntimeTick - increments sessionTick', () => {
  const booted = bootGlasses(createRuntimeState());
  const next = processRuntimeTick(booted, { batteryPct: 80, temperatureC: 30, phoneConnected: false, cloudConnected: false });
  expect(next.sessionTick).toBeGreaterThan(booted.sessionTick);
});

test('processRuntimeTick - mode changes with connectivity', () => {
  const booted = bootGlasses(createRuntimeState());
  const next = processRuntimeTick(booted, { batteryPct: 80, temperatureC: 30, phoneConnected: false, cloudConnected: true });
  expect(next.mode).toBe('cloud-enhanced');
});

test('processRuntimeTick - emergency mode at critical battery', () => {
  const booted = bootGlasses(createRuntimeState());
  const next = processRuntimeTick(booted, { batteryPct: 5, temperatureC: 30, phoneConnected: false, cloudConnected: false });
  expect(next.emergencyMode).toBeTruthy();
});

test('activateEmergencyMode - active is true', () => {
  const booted = bootGlasses(createRuntimeState());
  const { emergencyState } = activateEmergencyMode(booted);
  expect(emergencyState.active).toBeTruthy();
});

test('activateEmergencyMode - activeFeatures includes guardian', () => {
  const booted = bootGlasses(createRuntimeState());
  const { emergencyState } = activateEmergencyMode(booted);
  expect(emergencyState.activeFeatures).toContain('guardian');
});

test('activateEmergencyMode - announcement is EMERGENCY_MODE_ANNOUNCEMENT', () => {
  const booted = bootGlasses(createRuntimeState());
  const { emergencyState } = activateEmergencyMode(booted);
  expect(emergencyState.spokenAnnouncement).toBe(EMERGENCY_MODE_ANNOUNCEMENT);
});

test('buildRuntimeSummary - batteryPct matches power', () => {
  const s = bootGlasses(createRuntimeState());
  const summary = buildRuntimeSummary(s);
  expect(summary.batteryPct).toBe(s.power.batteryPct);
});

test('buildRuntimeSummary - totalSensors is 10', () => {
  const s = bootGlasses(createRuntimeState());
  const summary = buildRuntimeSummary(s);
  expect(summary.totalSensors).toBe(10);
});

test('isOperational - true after successful boot', () => {
  const s = bootGlasses(createRuntimeState());
  expect(isOperational(s)).toBeTruthy();
});

test('isOperational - false before boot', () => {
  const s = createRuntimeState();
  expect(isOperational(s)).toBeFalsy();
});

test('getStandaloneNote - returns STANDALONE_PRINCIPLE', () => {
  expect(getStandaloneNote()).toBe(STANDALONE_PRINCIPLE);
});

// ─── Suite 6: Constants and Architecture Verification ──────────────────────────

console.log('\nConstants & Architecture');

test('WAKE_WORD is "Denarixx"', () => {
  expect(WAKE_WORD).toBe('Denarixx');
});

test('CRITICAL_BATTERY_PCT is 10', () => {
  expect(CRITICAL_BATTERY_PCT).toBe(10);
});

test('LOW_BATTERY_PCT is 20', () => {
  expect(LOW_BATTERY_PCT).toBe(20);
});

test('ALWAYS_ACTIVE_FEATURES includes hazard-detection', () => {
  expect(ALWAYS_ACTIVE_FEATURES).toContain('hazard-detection');
});

test('ALWAYS_ACTIVE_FEATURES includes guardian', () => {
  expect(ALWAYS_ACTIVE_FEATURES).toContain('guardian');
});

test('EMERGENCY_MODE_ANNOUNCEMENT mentions emergency', () => {
  expect(EMERGENCY_MODE_ANNOUNCEMENT.toLowerCase()).toContain('emergency');
});

test('STANDALONE_PRINCIPLE mentions compute module', () => {
  expect(STANDALONE_PRINCIPLE).toContain('glasses compute module');
});

test('STANDALONE_PRINCIPLE says phone is optional', () => {
  expect(STANDALONE_PRINCIPLE.toLowerCase()).toContain('optional');
});

test('CRITICAL_BATTERY_ANNOUNCEMENT mentions charge', () => {
  expect(CRITICAL_BATTERY_ANNOUNCEMENT.toLowerCase()).toContain('charge');
});

test('CRITICAL_BATTERY_ANNOUNCEMENT says Guardian remains active', () => {
  expect(CRITICAL_BATTERY_ANNOUNCEMENT).toContain('Guardian');
});

// ─── Result ───────────────────────────────────────────────────────────────────

console.log(`\nGlasses Runtime Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

// Sprint 20: Prototype Hardware Integration — test suite
// Run: npx tsx tests/prototypeIntegration.test.ts

import { strict as assert } from 'assert';

import {
  INTERFACE_REGISTRY,
  createPrototypeIntegrationState,
  updateInterfaceStatus,
  recomputeState,
  getInterfaceByType,
  getCriticalInterfaces,
  getFailedInterfaces,
  getUnstartedInterfaces,
  allCriticalValidated,
  getIntegrationSummary,
  getIntegrationDisclaimer,
} from '../src/engines/prototypeIntegrationEngine';

import {
  createFirmwareBridge,
  startDiscovery,
  registerSensor,
  completeDiscovery,
  getDiscoverySummary,
  setFirmwareInfo,
  getFirmwareVersion,
  isVersionCompatible,
  hasCapability,
  getCapabilities,
  buildHealthReport,
  recordHeartbeat,
  isHeartbeatStale,
  checkForOTA as firmwareCheckOTA,
  setOTAAvailable,
  beginOTA,
  completeOTA,
  getRegisteredSensors,
  getSensorByType,
} from '../src/engines/firmwareBridgeEngine';

import {
  createProvisioningState,
  beginStep,
  completeStep,
  applyStepResult,
  failStep,
  addVoiceSample,
  isVoiceCalibrationComplete,
  getVoiceCalibrationProgress,
  setSensorCalibrationPassed,
  setLanguage,
  setAccessibilityProfile,
  setPrivacyDefault,
  getPrivacySummary,
  applyFactoryReset,
  getProvisioningProgress,
  getProvisioningSummary,
  getStepRecord,
  ACCESSIBILITY_PROFILES,
} from '../src/engines/deviceProvisioningEngine';

import {
  createDeploymentPipeline,
  getStageConfig,
  getCurrentStageConfig,
  getNextStage,
  checkForOTA as deployCheckOTA,
  setLatestVersion,
  applyOTA,
  rollback,
  applyRollback,
  addDiagnosticEntry,
  getDiagnosticsByLevel,
  clearDiagnostics,
  isProductionReady,
  hasArtifact,
  getDeploymentSummary,
} from '../src/engines/hardwareDeploymentEngine';

import {
  TOTAL_HARDWARE_INTERFACES,
  INTEGRATION_SCORE_EVT_THRESHOLD,
  PROTOTYPE_PLATFORM,
  PROVISIONING_STEPS,
  PROVISIONING_VOICE_SAMPLES_REQUIRED,
  INTEGRATION_DISCLAIMER,
  PROTOTYPE_SAFETY_NOTE,
} from '../src/types/prototype';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
  }
}

// ─── Suite 1: Types & Constants ────────────────────────────────────────────────

console.log('\nTypes & Constants');

test('TOTAL_HARDWARE_INTERFACES is 12', () => {
  assert.equal(TOTAL_HARDWARE_INTERFACES, 12);
});

test('INTEGRATION_SCORE_EVT_THRESHOLD is 80', () => {
  assert.equal(INTEGRATION_SCORE_EVT_THRESHOLD, 80);
});

test('PROTOTYPE_PLATFORM is "prototype"', () => {
  assert.equal(PROTOTYPE_PLATFORM, 'prototype');
});

test('PROVISIONING_STEPS has 8 entries', () => {
  assert.equal(PROVISIONING_STEPS.length, 8);
});

test('PROVISIONING_STEPS ends with "complete"', () => {
  assert.equal(PROVISIONING_STEPS[PROVISIONING_STEPS.length - 1], 'complete');
});

test('PROVISIONING_VOICE_SAMPLES_REQUIRED is 3', () => {
  assert.equal(PROVISIONING_VOICE_SAMPLES_REQUIRED, 3);
});

test('INTEGRATION_DISCLAIMER is a non-empty string', () => {
  assert.ok(INTEGRATION_DISCLAIMER.length > 0);
});

test('PROTOTYPE_SAFETY_NOTE mentions crossing safety', () => {
  assert.ok(PROTOTYPE_SAFETY_NOTE.includes('safe to cross'));
});

// ─── Suite 2: Interface Registry ──────────────────────────────────────────────

console.log('\nInterface Registry');

test('INTERFACE_REGISTRY has 12 entries', () => {
  assert.equal(INTERFACE_REGISTRY.length, 12);
});

test('all 12 interface types are present', () => {
  const types = INTERFACE_REGISTRY.map(i => i.type);
  const required = [
    'camera','microphone','bone-audio','battery','gps','imu',
    'compass','display','button','touch','usb-c','wireless',
  ];
  for (const r of required) {
    assert.ok(types.includes(r as never), `Missing interface: ${r}`);
  }
});

test('all interfaces have a protocol', () => {
  for (const iface of INTERFACE_REGISTRY) {
    assert.ok(iface.protocol.length > 0, `Interface ${iface.type} has no protocol`);
  }
});

test('all interfaces have a HAL driver', () => {
  for (const iface of INTERFACE_REGISTRY) {
    assert.ok(iface.halDriver.length > 0, `Interface ${iface.type} has no HAL driver`);
  }
});

test('all interfaces start as not-started', () => {
  for (const iface of INTERFACE_REGISTRY) {
    assert.equal(iface.status, 'not-started', `Interface ${iface.type} should be not-started`);
  }
});

// ─── Suite 3: Prototype Integration Engine ────────────────────────────────────

console.log('\nPrototype Integration Engine');

test('createPrototypeIntegrationState initialises correctly', () => {
  const s = createPrototypeIntegrationState('dev-001');
  assert.equal(s.deviceId, 'dev-001');
  assert.equal(s.platform, 'prototype');
  assert.equal(s.totalInterfaces, 12);
  assert.equal(s.validatedInterfaces, 0);
  assert.equal(s.integrationScore, 0);
  assert.equal(s.readyForEVT, false);
});

test('updateInterfaceStatus changes a single interface', () => {
  const s = createPrototypeIntegrationState('dev-001');
  const s2 = updateInterfaceStatus(s, 'camera', 'in-progress');
  assert.equal(getInterfaceByType(s2, 'camera')?.status, 'in-progress');
  assert.equal(getInterfaceByType(s2, 'microphone')?.status, 'not-started');
});

test('validating 1 interface gives score 8 (1/12)', () => {
  const s = createPrototypeIntegrationState('dev-001');
  const s2 = updateInterfaceStatus(s, 'camera', 'validated');
  assert.equal(s2.integrationScore, Math.round(1 / 12 * 100));
});

test('validating all interfaces gives score 100', () => {
  let s = createPrototypeIntegrationState('dev-001');
  for (const iface of INTERFACE_REGISTRY) {
    s = updateInterfaceStatus(s, iface.type, 'validated');
  }
  assert.equal(s.integrationScore, 100);
  assert.equal(s.overallStatus, 'validated');
});

test('readyForEVT requires score ≥ 80 AND all critical interfaces validated', () => {
  let s = createPrototypeIntegrationState('dev-001');
  // Validate all but display and touch (non-critical) to hit score ≥ 80
  const toValidate = INTERFACE_REGISTRY.filter(i => i.type !== 'display' && i.type !== 'touch');
  for (const iface of toValidate) {
    s = updateInterfaceStatus(s, iface.type, 'validated');
  }
  // Score = 10/12 = 83, all critical validated → EVT-ready
  assert.equal(s.readyForEVT, true);
});

test('readyForEVT is false when critical interface not validated', () => {
  let s = createPrototypeIntegrationState('dev-001');
  // Validate all except camera (critical)
  for (const iface of INTERFACE_REGISTRY) {
    if (iface.type !== 'camera') {
      s = updateInterfaceStatus(s, iface.type, 'validated');
    }
  }
  assert.equal(s.readyForEVT, false);
});

test('failed interface sets overallStatus to "failed"', () => {
  const s = createPrototypeIntegrationState('dev-001');
  const s2 = updateInterfaceStatus(s, 'gps', 'failed');
  assert.equal(s2.overallStatus, 'failed');
});

test('getCriticalInterfaces returns 6 interfaces', () => {
  const s = createPrototypeIntegrationState('dev-001');
  const critical = getCriticalInterfaces(s);
  assert.equal(critical.length, 6);
});

test('getFailedInterfaces returns only failed', () => {
  let s = createPrototypeIntegrationState('dev-001');
  s = updateInterfaceStatus(s, 'gps', 'failed');
  s = updateInterfaceStatus(s, 'imu', 'failed');
  const failed = getFailedInterfaces(s);
  assert.equal(failed.length, 2);
  assert.ok(failed.every(i => i.status === 'failed'));
});

test('getUnstartedInterfaces count decreases as work starts', () => {
  let s = createPrototypeIntegrationState('dev-001');
  assert.equal(getUnstartedInterfaces(s).length, 12);
  s = updateInterfaceStatus(s, 'camera', 'in-progress');
  assert.equal(getUnstartedInterfaces(s).length, 11);
});

test('allCriticalValidated is false until all 6 critical done', () => {
  let s = createPrototypeIntegrationState('dev-001');
  assert.equal(allCriticalValidated(s), false);
  const critTypes = ['camera','microphone','bone-audio','battery','gps','imu'] as const;
  for (const t of critTypes) s = updateInterfaceStatus(s, t, 'validated');
  assert.equal(allCriticalValidated(s), true);
});

test('getIntegrationSummary is non-empty', () => {
  const s = createPrototypeIntegrationState('dev-001');
  const summary = getIntegrationSummary(s);
  assert.ok(summary.includes('dev-001'));
});

test('getIntegrationDisclaimer mentions vendor-neutral', () => {
  assert.ok(getIntegrationDisclaimer().includes('vendor-neutral'));
});

// ─── Suite 4: Firmware Bridge Engine ──────────────────────────────────────────

console.log('\nFirmware Bridge Engine');

test('createFirmwareBridge initialises correctly', () => {
  const b = createFirmwareBridge('fw-001');
  assert.equal(b.deviceId, 'fw-001');
  assert.equal(b.firmwareInfo, null);
  assert.equal(b.discoveryComplete, false);
  assert.equal(b.firmwareState, 'unknown');
  assert.equal(b.healthStatus, 'unknown');
});

test('startDiscovery sets firmwareState to initializing', () => {
  const b = createFirmwareBridge('fw-001');
  const b2 = startDiscovery(b);
  assert.equal(b2.firmwareState, 'initializing');
  assert.equal(b2.discoveryComplete, false);
});

test('registerSensor adds a sensor to registry', () => {
  let b = createFirmwareBridge('fw-001');
  b = startDiscovery(b);
  b = registerSensor(b, { sensorId: 'camera-front', type: 'camera', driver: 'cameraHAL', registered: true });
  assert.equal(b.sensorRegistry.length, 1);
});

test('completeDiscovery with all registered → healthy', () => {
  let b = createFirmwareBridge('fw-001');
  b = startDiscovery(b);
  b = registerSensor(b, { sensorId: 's1', type: 'camera', driver: 'cameraHAL', registered: true });
  b = registerSensor(b, { sensorId: 's2', type: 'imu', driver: 'imuHAL', registered: true });
  b = completeDiscovery(b);
  assert.equal(b.healthStatus, 'healthy');
  assert.equal(b.discoveryComplete, true);
  assert.equal(b.firmwareState, 'ready');
});

test('completeDiscovery with 1 failure → degraded', () => {
  let b = createFirmwareBridge('fw-001');
  b = startDiscovery(b);
  b = registerSensor(b, { sensorId: 's1', type: 'camera', driver: 'cameraHAL', registered: true });
  b = registerSensor(b, { sensorId: 's2', type: 'gps', driver: 'gpsHAL', registered: false });
  b = completeDiscovery(b);
  assert.equal(b.healthStatus, 'degraded');
});

test('completeDiscovery with no sensors → unknown', () => {
  let b = createFirmwareBridge('fw-001');
  b = completeDiscovery(b);
  assert.equal(b.healthStatus, 'unknown');
});

test('setFirmwareInfo populates firmwareInfo and capabilityFlags', () => {
  let b = createFirmwareBridge('fw-001');
  b = setFirmwareInfo(b, {
    version: '0.1.0-evt1', buildDate: '2026-10-01', platform: 'prototype',
    capabilities: ['camera', 'imu', 'OTA'], halVersion: '1.0', bootloaderVersion: '0.1',
  });
  assert.equal(getFirmwareVersion(b), '0.1.0-evt1');
  assert.equal(hasCapability(b, 'camera'), true);
  assert.equal(hasCapability(b, 'display'), false);
  assert.ok(getCapabilities(b).includes('OTA'));
});

test('isVersionCompatible matches halVersion', () => {
  let b = createFirmwareBridge('fw-001');
  b = setFirmwareInfo(b, {
    version: '0.1.0', buildDate: '2026-10-01', platform: 'prototype',
    capabilities: [], halVersion: '1.0', bootloaderVersion: '0.1',
  });
  assert.equal(isVersionCompatible(b, '1.0'), true);
  assert.equal(isVersionCompatible(b, '2.0'), false);
});

test('buildHealthReport returns correct structure', () => {
  let b = createFirmwareBridge('fw-001');
  b = startDiscovery(b);
  b = registerSensor(b, { sensorId: 's1', type: 'camera', driver: 'cameraHAL', registered: true });
  b = completeDiscovery(b);
  const report = buildHealthReport(b, 3600);
  assert.equal(report.deviceId, 'fw-001');
  assert.equal(report.registeredSensors, 1);
  assert.equal(report.failedSensors, 0);
  assert.equal(report.uptime, 3600);
});

test('heartbeat freshness: stale when ts=0', () => {
  const b = createFirmwareBridge('fw-001');
  assert.equal(isHeartbeatStale(b, Date.now()), true);
});

test('heartbeat freshness: not stale after recordHeartbeat', () => {
  let b = createFirmwareBridge('fw-001');
  const now = Date.now();
  b = recordHeartbeat(b, now);
  assert.equal(isHeartbeatStale(b, now + 5000), false);
  assert.equal(isHeartbeatStale(b, now + 15000), true);
});

test('checkForOTA detects version difference', () => {
  let b = createFirmwareBridge('fw-001');
  b = setFirmwareInfo(b, {
    version: '0.1.0', buildDate: '2026-10-01', platform: 'prototype',
    capabilities: ['OTA'], halVersion: '1.0', bootloaderVersion: '0.1',
  });
  const result = firmwareCheckOTA(b, '0.2.0');
  assert.equal(result.available, true);
  assert.equal(result.version, '0.2.0');
});

test('OTA lifecycle: setOTA → begin → complete', () => {
  let b = createFirmwareBridge('fw-001');
  b = setFirmwareInfo(b, {
    version: '0.1.0', buildDate: '2026-10-01', platform: 'prototype',
    capabilities: [], halVersion: '1.0', bootloaderVersion: '0.1',
  });
  b = setOTAAvailable(b, '0.2.0');
  assert.equal(b.otaAvailable, true);
  b = beginOTA(b);
  assert.equal(b.firmwareState, 'updating');
  b = completeOTA(b, '0.2.0');
  assert.equal(getFirmwareVersion(b), '0.2.0');
  assert.equal(b.otaAvailable, false);
  assert.equal(b.firmwareState, 'ready');
  assert.equal(b.discoveryComplete, false); // re-register required
});

test('getRegisteredSensors filters unregistered', () => {
  let b = createFirmwareBridge('fw-001');
  b = registerSensor(b, { sensorId: 's1', type: 'camera', driver: 'cameraHAL', registered: true });
  b = registerSensor(b, { sensorId: 's2', type: 'gps', driver: 'gpsHAL', registered: false });
  assert.equal(getRegisteredSensors(b).length, 1);
});

test('getSensorByType returns correct sensor', () => {
  let b = createFirmwareBridge('fw-001');
  b = registerSensor(b, { sensorId: 's1', type: 'imu', driver: 'imuHAL', registered: true });
  const s = getSensorByType(b, 'imu');
  assert.equal(s?.sensorId, 's1');
  assert.equal(getSensorByType(b, 'gps'), undefined);
});

// ─── Suite 5: Device Provisioning Engine ──────────────────────────────────────

console.log('\nDevice Provisioning Engine');

test('createProvisioningState initialises with 8 steps', () => {
  const s = createProvisioningState('dev-001', 1000);
  assert.equal(s.steps.length, 8);
  assert.equal(s.currentStep, 'factory-reset');
  assert.equal(s.isComplete, false);
  assert.equal(s.languageCode, 'en');
  assert.equal(s.accessibilityProfile, 'standard');
});

test('all steps start as pending', () => {
  const s = createProvisioningState('dev-001', 1000);
  for (const step of s.steps) {
    assert.equal(step.status, 'pending', `Step ${step.step} should be pending`);
  }
});

test('privacy defaults: gpsGridFuzzingEnabled is true', () => {
  const s = createProvisioningState('dev-001', 1000);
  assert.equal(s.privacyDefaults.gpsGridFuzzingEnabled, true);
  assert.equal(s.privacyDefaults.locationEnabled, false);
});

test('beginStep marks step as in-progress', () => {
  const s = createProvisioningState('dev-001', 1000);
  const s2 = beginStep(s, 'factory-reset');
  assert.equal(getStepRecord(s2, 'factory-reset')?.status, 'in-progress');
});

test('completeStep returns next step', () => {
  const s = createProvisioningState('dev-001', 1000);
  const result = completeStep(s, 'factory-reset', 100);
  assert.equal(result.success, true);
  assert.equal(result.step, 'factory-reset');
  assert.equal(result.nextStep, 'device-init');
});

test('applyStepResult marks step complete', () => {
  let s = createProvisioningState('dev-001', 1000);
  const result = completeStep(s, 'factory-reset', 100);
  s = applyStepResult(s, result, 100);
  assert.equal(getStepRecord(s, 'factory-reset')?.status, 'complete');
});

test('failStep marks step as failed', () => {
  const s = createProvisioningState('dev-001', 1000);
  const s2 = failStep(s, 'sensor-calibration', 'IMU timeout');
  assert.equal(getStepRecord(s2, 'sensor-calibration')?.status, 'failed');
  assert.ok(getStepRecord(s2, 'sensor-calibration')?.notes.includes('IMU timeout'));
});

test('voice calibration: 3 samples required', () => {
  let s = createProvisioningState('dev-001', 1000);
  assert.equal(isVoiceCalibrationComplete(s), false);
  s = addVoiceSample(s);
  s = addVoiceSample(s);
  assert.equal(isVoiceCalibrationComplete(s), false);
  s = addVoiceSample(s);
  assert.equal(isVoiceCalibrationComplete(s), true);
  assert.ok(getVoiceCalibrationProgress(s).includes('3/3'));
});

test('setSensorCalibrationPassed updates calibration flag', () => {
  const s = createProvisioningState('dev-001', 1000);
  const s2 = setSensorCalibrationPassed(s, true, 'IMU + compass OK');
  assert.equal(s2.calibrationPassed, true);
  assert.equal(getStepRecord(s2, 'sensor-calibration')?.status, 'complete');
});

test('setLanguage and setAccessibilityProfile update state', () => {
  let s = createProvisioningState('dev-001', 1000);
  s = setLanguage(s, 'fr');
  s = setAccessibilityProfile(s, 'low-vision');
  assert.equal(s.languageCode, 'fr');
  assert.equal(s.accessibilityProfile, 'low-vision');
});

test('ACCESSIBILITY_PROFILES contains 5 entries', () => {
  assert.equal(ACCESSIBILITY_PROFILES.length, 5);
  assert.ok(ACCESSIBILITY_PROFILES.includes('standard'));
  assert.ok(ACCESSIBILITY_PROFILES.includes('low-vision'));
});

test('setPrivacyDefault updates a consent flag', () => {
  const s = createProvisioningState('dev-001', 1000);
  const s2 = setPrivacyDefault(s, 'locationEnabled', true);
  assert.equal(s2.privacyDefaults.locationEnabled, true);
});

test('getPrivacySummary reflects enabled flags', () => {
  let s = createProvisioningState('dev-001', 1000);
  s = setPrivacyDefault(s, 'locationEnabled', true);
  const summary = getPrivacySummary(s);
  assert.ok(summary.includes('locationEnabled'));
});

test('applyFactoryReset resets all fields', () => {
  let s = createProvisioningState('dev-001', 1000);
  s = setLanguage(s, 'de');
  s = setAccessibilityProfile(s, 'deaf-blind');
  s = applyFactoryReset(s);
  assert.equal(s.languageCode, 'en');
  assert.equal(s.accessibilityProfile, 'standard');
  assert.equal(s.voiceSampleCount, 0);
  assert.equal(s.isComplete, false);
});

test('getProvisioningProgress is 0 at start', () => {
  const s = createProvisioningState('dev-001', 1000);
  assert.equal(getProvisioningProgress(s), 0);
});

test('getProvisioningSummary includes device ID', () => {
  const s = createProvisioningState('dev-001', 1000);
  assert.ok(getProvisioningSummary(s).includes('dev-001'));
});

// ─── Suite 6: Hardware Deployment Engine ──────────────────────────────────────

console.log('\nHardware Deployment Engine');

test('createDeploymentPipeline has 4 stages', () => {
  const p = createDeploymentPipeline();
  assert.equal(p.stages.length, 4);
  assert.equal(p.currentStage, 'dev');
});

test('getStageConfig returns correct stage', () => {
  const p = createDeploymentPipeline();
  const staging = getStageConfig(p, 'staging');
  assert.equal(staging?.stage, 'staging');
  assert.equal(staging?.isSigned, true);
});

test('dev stage is not signed', () => {
  const p = createDeploymentPipeline();
  const dev = getStageConfig(p, 'dev');
  assert.equal(dev?.isSigned, false);
});

test('prototype stage has recovery mode', () => {
  const p = createDeploymentPipeline();
  const proto = getStageConfig(p, 'prototype');
  assert.equal(proto?.recoveryModeAvailable, true);
});

test('getCurrentStageConfig returns dev stage initially', () => {
  const p = createDeploymentPipeline();
  assert.equal(getCurrentStageConfig(p)?.stage, 'dev');
});

test('getNextStage returns correct sequence', () => {
  assert.equal(getNextStage('dev'), 'staging');
  assert.equal(getNextStage('staging'), 'prototype');
  assert.equal(getNextStage('prototype'), 'production');
  assert.equal(getNextStage('production'), null);
});

test('all 4 artifacts present in all stages', () => {
  const p = createDeploymentPipeline();
  for (const stage of p.stages) {
    assert.ok(stage.artifacts.includes('firmware'), `Stage ${stage.stage} missing firmware`);
    assert.ok(stage.artifacts.includes('ai-models'), `Stage ${stage.stage} missing ai-models`);
    assert.ok(stage.artifacts.includes('config'), `Stage ${stage.stage} missing config`);
    assert.ok(stage.artifacts.includes('locale-pack'), `Stage ${stage.stage} missing locale-pack`);
  }
});

test('checkForOTA: no update when already latest', () => {
  const p = createDeploymentPipeline();
  const result = deployCheckOTA(p, 'dev-001');
  assert.equal(result.available, false);
});

test('checkForOTA: update available after setLatestVersion', () => {
  let p = createDeploymentPipeline();
  p = setLatestVersion(p, '0.2.0');
  const result = deployCheckOTA(p, 'dev-001');
  assert.equal(result.available, true);
  assert.equal(result.version, '0.2.0');
});

test('applyOTA updates currentVersion and enables rollback', () => {
  let p = createDeploymentPipeline();
  p = setLatestVersion(p, '0.2.0');
  p = applyOTA(p, '0.2.0');
  assert.equal(p.currentVersion, '0.2.0');
  assert.equal(p.isUpToDate, true);
  assert.equal(p.canRollback, true);
});

test('rollback fails when no rollback version', () => {
  const p = createDeploymentPipeline();
  const result = rollback(p);
  assert.equal(result.success, false);
});

test('rollback succeeds after OTA', () => {
  let p = createDeploymentPipeline();
  p = setLatestVersion(p, '0.2.0');
  p = applyOTA(p, '0.2.0');
  const result = rollback(p);
  assert.equal(result.success, true);
  assert.equal(result.toVersion, '0.0.0-dev');
  const p2 = applyRollback(p, result);
  assert.equal(p2.currentVersion, '0.0.0-dev');
  assert.equal(p2.canRollback, false);
});

test('addDiagnosticEntry appends to log', () => {
  let p = createDeploymentPipeline();
  p = addDiagnosticEntry(p, 'info', 'Test started', 'test');
  p = addDiagnosticEntry(p, 'error', 'Something failed', 'test');
  assert.equal(p.deploymentLog.length, 2);
});

test('getDiagnosticsByLevel filters correctly', () => {
  let p = createDeploymentPipeline();
  p = addDiagnosticEntry(p, 'info', 'Info message', 'test');
  p = addDiagnosticEntry(p, 'error', 'Error message', 'test');
  const errors = getDiagnosticsByLevel(p, 'error');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].level, 'error');
});

test('clearDiagnostics empties the log', () => {
  let p = createDeploymentPipeline();
  p = addDiagnosticEntry(p, 'warn', 'A warning', 'test');
  p = clearDiagnostics(p);
  assert.equal(p.deploymentLog.length, 0);
});

test('isProductionReady: not ready with default pipeline', () => {
  const p = createDeploymentPipeline();
  // dev stage is not signed → not production ready
  assert.equal(isProductionReady(p), false);
});

test('hasArtifact returns true for firmware in dev stage', () => {
  const p = createDeploymentPipeline();
  assert.equal(hasArtifact(p, 'firmware'), true);
  assert.equal(hasArtifact(p, 'ai-models'), true);
});

test('getDeploymentSummary includes stage and version', () => {
  const p = createDeploymentPipeline();
  const summary = getDeploymentSummary(p);
  assert.ok(summary.includes('dev'));
  assert.ok(summary.includes('0.0.0'));
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Prototype Integration Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

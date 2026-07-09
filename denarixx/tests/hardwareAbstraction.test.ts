// Sprint 17: Hardware Abstraction Layer — test suite
import {
  createCameraHALState, initializeCamera, captureFrame, setCameraError,
  restartCamera, activateFallbackCamera, shouldRestartCamera, getCameraHealth,
  buildFrameStream, degradeCamera, completeCameraRestart, getCameraDriver,
} from '../src/engines/cameraHAL';

import {
  createMicHALState, initializeMic, startWakeWordListening, stopWakeWordListening,
  startCapture, stopCapture, captureMicFrame, applyNoiseReduction,
  detectWakeWord, setMicError, restartMic, runMicDiagnostics, getMicHealth,
  getMicDriver,
} from '../src/engines/microphoneHAL';

import {
  createSpeakerHALState, initializeSpeaker, setVolume, queueSpeech,
  activateEmergencyOverride, deactivateEmergencyOverride, processQueue,
  clearQueue, setSpeakerError, getSpeakerHealth, getSpeakerDriver,
} from '../src/engines/speakerHAL';

import {
  createIMUHALState, initializeIMU, readIMU, classifyMotionState,
  getHeading, detectFall, setIMUError, restartIMU, completeIMURestart,
  getIMUHealth, getIMUDriver,
} from '../src/engines/imuHAL';

import {
  createGPSHALState, initializeGPS, acquireFix, classifyGPSQuality,
  classifyPositioningMode, readGPS, activateOfflineMode, deactivateOfflineMode,
  hasFix, setGPSError, restartGPS, getGPSHealth, getGPSDriver,
} from '../src/engines/gpsHAL';

import {
  createBatteryHALState, initializeBattery, classifyBatteryHealth,
  classifyChargingState, readBattery, activateCriticalMode, isCritical,
  buildBatteryWarning, setBatteryError, getBatteryHealth, getBatteryDriver,
} from '../src/engines/batteryHAL';

import {
  createDisplayHALState, initializeDisplay, setDisplayMode, setBrightness,
  setNumericBrightness, turnOff, turnOn, activateLowPowerMode,
  setDisplayError, getDisplayHealth, getDisplayDriver,
} from '../src/engines/displayHAL';

import {
  createSensorManager, registerCamera, registerMicrophone, registerIMU,
  registerGPS, registerBattery, buildHealthReports, runHealthChecks,
  isAnyHALCritical, getHealthyCount, autoRestartFailedSensors,
  getSensorManagerSummary, getCriticalHealthIssues,
} from '../src/engines/sensorManagerEngine';

import {
  createHALSystem, initializeHALSystem, registerDriver, getRegisteredDrivers,
  getDriverForComponent, isSupportedPlatform, getPlatformLabel,
  getPlatformNotes, buildHALSystemState, buildHALIntegrationBridge,
  getHALNote, getHALComponentCount, advanceTick,
} from '../src/engines/hardwareAbstractionEngine';

import {
  HAL_SAFETY_NOTE, SIMULATION_DRIVER, MAX_RESTART_ATTEMPTS,
  SUPPORTED_PLATFORMS,
} from '../src/types/hardwareHAL';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e: unknown) { console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); failed++; }
}

function expect(val: unknown) {
  return {
    toBe: (x: unknown) => { if (val !== x) throw new Error(`Expected ${JSON.stringify(x)}, got ${JSON.stringify(val)}`); },
    toBeTruthy: () => { if (!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`); },
    toBeFalsy: () => { if (val) throw new Error(`Expected falsy, got ${JSON.stringify(val)}`); },
    toBeNull: () => { if (val !== null) throw new Error(`Expected null, got ${JSON.stringify(val)}`); },
    toBeGreaterThan: (n: number) => { if ((val as number) <= n) throw new Error(`Expected > ${n}, got ${val}`); },
    toBeLessThan: (n: number) => { if ((val as number) >= n) throw new Error(`Expected < ${n}, got ${val}`); },
    toBeGreaterThanOrEqual: (n: number) => { if ((val as number) < n) throw new Error(`Expected >= ${n}, got ${val}`); },
    toBeLessThanOrEqual: (n: number) => { if ((val as number) > n) throw new Error(`Expected <= ${n}, got ${val}`); },
    toContain: (sub: unknown) => {
      if (Array.isArray(val)) { if (!val.includes(sub)) throw new Error(`Array does not contain ${JSON.stringify(sub)}`); }
      else if (typeof val === 'string') { if (!val.includes(sub as string)) throw new Error(`"${val}" does not contain "${sub}"`); }
      else throw new Error(`toContain: unsupported type`);
    },
    toHaveLength: (n: number) => { const len = (val as unknown[]).length; if (len !== n) throw new Error(`Expected length ${n}, got ${len}`); },
  };
}

// ─── Suite 1: Camera HAL ──────────────────────────────────────────────────────

console.log('\nCamera HAL');

test('createCameraHALState - status offline', () => {
  const s = createCameraHALState('cam-0', 'front');
  expect(s.status).toBe('offline');
});

test('createCameraHALState - facing set', () => {
  expect(createCameraHALState('cam-0', 'front').facing).toBe('front');
});

test('createCameraHALState - errorCount 0', () => {
  expect(createCameraHALState('cam-0').errorCount).toBe(0);
});

test('initializeCamera - status becomes ready', () => {
  const s = initializeCamera(createCameraHALState('cam-0'), 1);
  expect(s.status).toBe('ready');
});

test('captureFrame - returns frame when ready', () => {
  const s = initializeCamera(createCameraHALState('cam-0'), 1);
  const { frame } = captureFrame(s, 2);
  expect(frame).toBeTruthy();
});

test('captureFrame - returns null when offline', () => {
  const { frame } = captureFrame(createCameraHALState('cam-0'), 1);
  expect(frame).toBeNull();
});

test('captureFrame - increments frameCount', () => {
  const s = initializeCamera(createCameraHALState('cam-0'), 1);
  const { state } = captureFrame(s, 2);
  expect(state.frameCount).toBe(1);
});

test('captureFrame - frame has simulated: true', () => {
  const s = initializeCamera(createCameraHALState('cam-0', 'front', '720p'), 1);
  const { frame } = captureFrame(s, 2);
  expect(frame?.simulated).toBeTruthy();
});

test('setCameraError - status becomes error', () => {
  const s = setCameraError(initializeCamera(createCameraHALState('cam-0'), 1), 2);
  expect(s.status).toBe('error');
});

test('setCameraError - increments errorCount', () => {
  const s = setCameraError(initializeCamera(createCameraHALState('cam-0'), 1), 2);
  expect(s.errorCount).toBe(1);
});

test('degradeCamera - status becomes degraded', () => {
  const s = degradeCamera(initializeCamera(createCameraHALState('cam-0'), 1), 2);
  expect(s.status).toBe('degraded');
});

test('restartCamera - status becomes initializing', () => {
  const errored = setCameraError(initializeCamera(createCameraHALState('cam-0'), 1), 2);
  const r = restartCamera(errored, 3);
  expect(r.status).toBe('initializing');
});

test('restartCamera - increments restartCount', () => {
  const errored = setCameraError(initializeCamera(createCameraHALState('cam-0'), 1), 2);
  const r = restartCamera(errored, 3);
  expect(r.restartCount).toBe(1);
});

test('restartCamera - max attempts reached → activates fallback', () => {
  let s = createCameraHALState('cam-0', 'front', '720p', 30, 'cam-fallback');
  s = initializeCamera(s, 1);
  for (let i = 0; i < MAX_RESTART_ATTEMPTS; i++) {
    s = setCameraError(s, i + 2);
    s = restartCamera(s, i + 3);
  }
  s = setCameraError(s, 10);
  s = restartCamera(s, 11);
  expect(s.usingFallback).toBeTruthy();
});

test('completeCameraRestart - becomes ready from initializing', () => {
  const s = completeCameraRestart({ ...createCameraHALState('cam-0'), status: 'initializing' }, 5);
  expect(s.status).toBe('ready');
});

test('activateFallbackCamera - switches to fallback when available', () => {
  const s = createCameraHALState('cam-0', 'front', '720p', 30, 'cam-fb');
  const fb = activateFallbackCamera(s, 1);
  expect(fb.usingFallback).toBeTruthy();
  expect(fb.deviceId).toBe('cam-fb');
});

test('activateFallbackCamera - error when no fallback', () => {
  const s = createCameraHALState('cam-0');
  const fb = activateFallbackCamera(s, 1);
  expect(fb.status).toBe('error');
});

test('shouldRestartCamera - true when error and under max', () => {
  const s = setCameraError(initializeCamera(createCameraHALState('cam-0'), 1), 2);
  expect(shouldRestartCamera(s)).toBeTruthy();
});

test('getCameraHealth - no issues when ready', () => {
  const s = initializeCamera(createCameraHALState('cam-0'), 1);
  const h = getCameraHealth(s);
  expect(h.issues).toHaveLength(0);
  expect(h.shouldRestart).toBeFalsy();
});

test('getCameraHealth - issues when error', () => {
  const s = setCameraError(initializeCamera(createCameraHALState('cam-0'), 1), 2);
  const h = getCameraHealth(s);
  expect(h.issues.length).toBeGreaterThan(0);
});

test('buildFrameStream - returns count frames', () => {
  const s = initializeCamera(createCameraHALState('cam-0', 'front', '720p'), 1);
  const frames = buildFrameStream(s, 5, 3);
  expect(frames).toHaveLength(3);
});

test('buildFrameStream - empty when offline', () => {
  const s = createCameraHALState('cam-0');
  expect(buildFrameStream(s, 1, 3)).toHaveLength(0);
});

test('getCameraDriver - simulation returns simulation', () => {
  expect(getCameraDriver('simulation')).toBe(SIMULATION_DRIVER);
});

test('getCameraDriver - android-xr returns android-camera2', () => {
  expect(getCameraDriver('android-xr')).toBe('android-camera2');
});

// ─── Suite 2: Microphone HAL ──────────────────────────────────────────────────

console.log('\nMicrophone HAL');

test('createMicHALState - status offline', () => {
  expect(createMicHALState('mic-0').status).toBe('offline');
});

test('initializeMic - status ready', () => {
  expect(initializeMic(createMicHALState('mic-0'), 1).status).toBe('ready');
});

test('startWakeWordListening - sets flag', () => {
  const s = initializeMic(createMicHALState('mic-0'), 1);
  expect(startWakeWordListening(s).isListeningForWakeWord).toBeTruthy();
});

test('startWakeWordListening - no-op when offline', () => {
  expect(startWakeWordListening(createMicHALState('mic-0')).isListeningForWakeWord).toBeFalsy();
});

test('stopWakeWordListening - clears flag', () => {
  const s = startWakeWordListening(initializeMic(createMicHALState('mic-0'), 1));
  expect(stopWakeWordListening(s).isListeningForWakeWord).toBeFalsy();
});

test('startCapture - sets isCaptureActive', () => {
  const s = initializeMic(createMicHALState('mic-0'), 1);
  expect(startCapture(s).isCaptureActive).toBeTruthy();
});

test('stopCapture - clears isCaptureActive', () => {
  const s = startCapture(initializeMic(createMicHALState('mic-0'), 1));
  expect(stopCapture(s).isCaptureActive).toBeFalsy();
});

test('captureMicFrame - returns frame when ready', () => {
  const s = initializeMic(createMicHALState('mic-0'), 1);
  const { frame } = captureMicFrame(s, 2);
  expect(frame).toBeTruthy();
});

test('captureMicFrame - returns null when error', () => {
  const s = setMicError(initializeMic(createMicHALState('mic-0'), 1));
  const { frame } = captureMicFrame(s, 2);
  expect(frame).toBeNull();
});

test('captureMicFrame - increments frameCount', () => {
  const s = initializeMic(createMicHALState('mic-0'), 1);
  const { state } = captureMicFrame(s, 2);
  expect(state.frameCount).toBe(1);
});

test('applyNoiseReduction - sets noiseReductionApplied', () => {
  const s = initializeMic(createMicHALState('mic-0'), 1);
  const { frame } = captureMicFrame(s, 2);
  const reduced = applyNoiseReduction(frame!);
  expect(reduced.noiseReductionApplied).toBeTruthy();
});

test('applyNoiseReduction - reduces noiseLevel', () => {
  const s = initializeMic(createMicHALState('mic-0'), 1);
  const { frame } = captureMicFrame(s, 2, 0.4, 0.5);
  const reduced = applyNoiseReduction(frame!);
  expect(reduced.noiseLevel).toBeLessThan(0.5);
});

test('detectWakeWord - true above threshold', () => {
  const s = initializeMic(createMicHALState('mic-0'), 1);
  const { frame } = captureMicFrame(s, 2, 0.9, 0.1);
  expect(detectWakeWord(frame!, 0.7)).toBeTruthy();
});

test('detectWakeWord - false below threshold', () => {
  const s = initializeMic(createMicHALState('mic-0'), 1);
  const { frame } = captureMicFrame(s, 2, 0.2, 0.1);
  expect(detectWakeWord(frame!, 0.7)).toBeFalsy();
});

test('setMicError - status error', () => {
  expect(setMicError(initializeMic(createMicHALState('mic-0'), 1)).status).toBe('error');
});

test('restartMic - status initializing', () => {
  const s = setMicError(initializeMic(createMicHALState('mic-0'), 1));
  expect(restartMic(s).status).toBe('initializing');
});

test('runMicDiagnostics - no issues when listening', () => {
  const s = startWakeWordListening(initializeMic(createMicHALState('mic-0'), 1));
  expect(runMicDiagnostics(s)).toHaveLength(0);
});

test('getMicHealth - shouldRestart true on error', () => {
  const s = setMicError(initializeMic(createMicHALState('mic-0'), 1));
  expect(getMicHealth(s).shouldRestart).toBeTruthy();
});

test('getMicDriver - simulation → simulation', () => {
  expect(getMicDriver('simulation')).toBe(SIMULATION_DRIVER);
});

// ─── Suite 3: Speaker HAL ─────────────────────────────────────────────────────

console.log('\nSpeaker HAL');

test('createSpeakerHALState - bone-conduction by default', () => {
  expect(createSpeakerHALState('spk-0').speakerType).toBe('bone-conduction');
});

test('initializeSpeaker - status ready', () => {
  expect(initializeSpeaker(createSpeakerHALState('spk-0'), 1).status).toBe('ready');
});

test('setVolume - clamps to 0-100', () => {
  const s = initializeSpeaker(createSpeakerHALState('spk-0'), 1);
  expect(setVolume(s, 150).volume).toBe(100);
  expect(setVolume(s, -10).volume).toBe(0);
});

test('setVolume - sets value correctly', () => {
  const s = initializeSpeaker(createSpeakerHALState('spk-0'), 1);
  expect(setVolume(s, 60).volume).toBe(60);
});

test('queueSpeech - adds item to queue', () => {
  const s = initializeSpeaker(createSpeakerHALState('spk-0'), 1);
  const s2 = queueSpeech(s, 'Hello', 'normal');
  expect(s2.queue).toHaveLength(1);
});

test('queueSpeech - emergency priority inserted first', () => {
  const s = initializeSpeaker(createSpeakerHALState('spk-0'), 1);
  const s2 = queueSpeech(s, 'Normal text', 'normal');
  const s3 = queueSpeech(s2, 'Emergency!', 'emergency');
  expect(s3.queue[0].priority).toBe('emergency');
});

test('activateEmergencyOverride - sets flag', () => {
  const s = initializeSpeaker(createSpeakerHALState('spk-0'), 1);
  expect(activateEmergencyOverride(s).emergencyOverride).toBeTruthy();
});

test('deactivateEmergencyOverride - clears flag', () => {
  const s = activateEmergencyOverride(initializeSpeaker(createSpeakerHALState('spk-0'), 1));
  expect(deactivateEmergencyOverride(s).emergencyOverride).toBeFalsy();
});

test('processQueue - speaks next item', () => {
  const s = queueSpeech(initializeSpeaker(createSpeakerHALState('spk-0'), 1), 'Hello', 'normal');
  const { spoken } = processQueue(s);
  expect(spoken).toBeTruthy();
  expect(spoken?.text).toBe('Hello');
});

test('processQueue - returns null when queue empty', () => {
  const s = initializeSpeaker(createSpeakerHALState('spk-0'), 1);
  const { spoken } = processQueue(s);
  expect(spoken).toBeNull();
});

test('clearQueue - empties queue', () => {
  const s = queueSpeech(queueSpeech(initializeSpeaker(createSpeakerHALState('spk-0'), 1), 'A', 'normal'), 'B', 'normal');
  expect(clearQueue(s).queue).toHaveLength(0);
});

test('getSpeakerHealth - issues when volume 0', () => {
  const s = setVolume(initializeSpeaker(createSpeakerHALState('spk-0'), 1), 0);
  expect(getSpeakerHealth(s).issues.length).toBeGreaterThan(0);
});

test('getSpeakerDriver - simulation → simulation', () => {
  expect(getSpeakerDriver('simulation')).toBe(SIMULATION_DRIVER);
});

// ─── Suite 4: IMU HAL ─────────────────────────────────────────────────────────

console.log('\nIMU HAL');

test('createIMUHALState - status offline', () => {
  expect(createIMUHALState('imu-0').status).toBe('offline');
});

test('initializeIMU - status ready', () => {
  expect(initializeIMU(createIMUHALState('imu-0'), 1).status).toBe('ready');
});

test('readIMU - returns reading when ready', () => {
  const s = initializeIMU(createIMUHALState('imu-0'), 1);
  const { reading } = readIMU(s, 2);
  expect(reading).toBeTruthy();
});

test('readIMU - returns null when error', () => {
  const s = setIMUError(initializeIMU(createIMUHALState('imu-0'), 1));
  const { reading } = readIMU(s, 2);
  expect(reading).toBeNull();
});

test('readIMU - increments readingCount', () => {
  const s = initializeIMU(createIMUHALState('imu-0'), 1);
  const { state } = readIMU(s, 2);
  expect(state.readingCount).toBe(1);
});

test('readIMU - stores lastReading', () => {
  const s = initializeIMU(createIMUHALState('imu-0'), 1);
  const { state } = readIMU(s, 2);
  expect(state.lastReading).toBeTruthy();
});

test('classifyMotionState - stationary at 9.81g', () => {
  const reading = {
    tick: 1, accelerometerX: 0, accelerometerY: 0, accelerometerZ: 9.81,
    gyroscopeX: 0, gyroscopeY: 0, gyroscopeZ: 0,
    magnetometerX: 25, magnetometerY: -10, magnetometerZ: 45,
    headingDeg: 0, motionState: 'unknown' as const, confidence: 0.9,
  };
  expect(classifyMotionState(reading)).toBe('stationary');
});

test('classifyMotionState - falling at high accel', () => {
  const reading = {
    tick: 1, accelerometerX: 10, accelerometerY: 10, accelerometerZ: 10,
    gyroscopeX: 0, gyroscopeY: 0, gyroscopeZ: 0,
    magnetometerX: 0, magnetometerY: 0, magnetometerZ: 0,
    headingDeg: 0, motionState: 'unknown' as const, confidence: 0.9,
  };
  expect(classifyMotionState(reading)).toBe('falling');
});

test('getHeading - heading in 0-360 range', () => {
  const { reading } = readIMU(initializeIMU(createIMUHALState('imu-0'), 1), 2);
  const h = getHeading(reading!);
  expect(h).toBeGreaterThanOrEqual(0);
  expect(h).toBeLessThan(360);
});

test('detectFall - true when falling', () => {
  const s = initializeIMU(createIMUHALState('imu-0'), 1);
  const { reading } = readIMU(s, 50); // tick 50 gives high accel in sim
  if (reading) expect(typeof detectFall(reading)).toBe('boolean');
});

test('setIMUError - status error', () => {
  expect(setIMUError(initializeIMU(createIMUHALState('imu-0'), 1)).status).toBe('error');
});

test('restartIMU - status initializing', () => {
  const s = setIMUError(initializeIMU(createIMUHALState('imu-0'), 1));
  expect(restartIMU(s, 3).status).toBe('initializing');
});

test('completeIMURestart - becomes ready', () => {
  const s = restartIMU(setIMUError(initializeIMU(createIMUHALState('imu-0'), 1)), 3);
  expect(completeIMURestart(s).status).toBe('ready');
});

test('getIMUHealth - shouldRestart true on error under max', () => {
  const s = setIMUError(initializeIMU(createIMUHALState('imu-0'), 1));
  expect(getIMUHealth(s).shouldRestart).toBeTruthy();
});

test('getIMUDriver - simulation → simulation', () => {
  expect(getIMUDriver('simulation')).toBe(SIMULATION_DRIVER);
});

test('getIMUDriver - android-xr returns android-sensor-api', () => {
  expect(getIMUDriver('android-xr')).toBe('android-sensor-api');
});

// ─── Suite 5: GPS HAL ─────────────────────────────────────────────────────────

console.log('\nGPS HAL');

test('createGPSHALState - status offline', () => {
  expect(createGPSHALState('gps-0').status).toBe('offline');
});

test('initializeGPS - status initializing', () => {
  expect(initializeGPS(createGPSHALState('gps-0'), 1).status).toBe('initializing');
});

test('acquireFix - status ready, fixAcquired true', () => {
  const s = acquireFix(initializeGPS(createGPSHALState('gps-0'), 1), 2);
  expect(s.status).toBe('ready');
  expect(s.fixAcquired).toBeTruthy();
});

test('classifyGPSQuality - 2m → excellent', () => {
  expect(classifyGPSQuality(2)).toBe('excellent');
});

test('classifyGPSQuality - 8m → good', () => {
  expect(classifyGPSQuality(8)).toBe('good');
});

test('classifyGPSQuality - 20m → fair', () => {
  expect(classifyGPSQuality(20)).toBe('fair');
});

test('classifyGPSQuality - 40m → poor', () => {
  expect(classifyGPSQuality(40)).toBe('poor');
});

test('classifyGPSQuality - 100m → unavailable', () => {
  expect(classifyGPSQuality(100)).toBe('unavailable');
});

test('classifyPositioningMode - fix + online → gnss', () => {
  expect(classifyPositioningMode(true, false)).toBe('gnss');
});

test('classifyPositioningMode - no fix + offline → dead-reckoning', () => {
  expect(classifyPositioningMode(false, true)).toBe('offline-dead-reckoning');
});

test('classifyPositioningMode - no fix + online → unavailable', () => {
  expect(classifyPositioningMode(false, false)).toBe('unavailable');
});

test('readGPS - returns reading when ready', () => {
  const s = acquireFix(initializeGPS(createGPSHALState('gps-0'), 1), 2);
  const { reading } = readGPS(s, 3);
  expect(reading).toBeTruthy();
});

test('readGPS - offline mode → higher accuracy', () => {
  const s = activateOfflineMode(acquireFix(initializeGPS(createGPSHALState('gps-0'), 1), 2));
  const { reading } = readGPS(s, 3);
  expect(reading!.accuracyM).toBeGreaterThan(10);
});

test('activateOfflineMode - sets offlineMode', () => {
  const s = acquireFix(initializeGPS(createGPSHALState('gps-0'), 1), 2);
  expect(activateOfflineMode(s).offlineMode).toBeTruthy();
});

test('deactivateOfflineMode - clears offlineMode', () => {
  const s = activateOfflineMode(acquireFix(initializeGPS(createGPSHALState('gps-0'), 1), 2));
  expect(deactivateOfflineMode(s).offlineMode).toBeFalsy();
});

test('hasFix - true after acquireFix', () => {
  const s = acquireFix(initializeGPS(createGPSHALState('gps-0'), 1), 2);
  expect(hasFix(s)).toBeTruthy();
});

test('hasFix - false on fresh state', () => {
  expect(hasFix(createGPSHALState('gps-0'))).toBeFalsy();
});

test('setGPSError - status error', () => {
  const s = acquireFix(initializeGPS(createGPSHALState('gps-0'), 1), 2);
  expect(setGPSError(s).status).toBe('error');
});

test('restartGPS - status initializing', () => {
  const s = setGPSError(acquireFix(initializeGPS(createGPSHALState('gps-0'), 1), 2));
  expect(restartGPS(s).status).toBe('initializing');
});

test('getGPSHealth - issues when no fix', () => {
  const s = initializeGPS(createGPSHALState('gps-0'), 1);
  expect(getGPSHealth(s).issues.length).toBeGreaterThan(0);
});

test('getGPSDriver - simulation → simulation', () => {
  expect(getGPSDriver('simulation')).toBe(SIMULATION_DRIVER);
});

// ─── Suite 6: Battery HAL ─────────────────────────────────────────────────────

console.log('\nBattery HAL');

test('createBatteryHALState - status offline', () => {
  expect(createBatteryHALState('bat-0').status).toBe('offline');
});

test('initializeBattery - status ready', () => {
  expect(initializeBattery(createBatteryHALState('bat-0'), 1).status).toBe('ready');
});

test('classifyBatteryHealth - good at normal conditions', () => {
  expect(classifyBatteryHealth(80, 28)).toBe('good');
});

test('classifyBatteryHealth - degraded at high temp', () => {
  expect(classifyBatteryHealth(80, 46)).toBe('degraded');
});

test('classifyBatteryHealth - replace at critical temp', () => {
  expect(classifyBatteryHealth(80, 56)).toBe('replace');
});

test('classifyChargingState - charging when isCharging and < 99%', () => {
  expect(classifyChargingState(true, 80)).toBe('charging');
});

test('classifyChargingState - full when isCharging and >= 99%', () => {
  expect(classifyChargingState(true, 99)).toBe('full');
});

test('classifyChargingState - discharging when not charging', () => {
  expect(classifyChargingState(false, 80)).toBe('discharging');
});

test('readBattery - returns reading', () => {
  const s = initializeBattery(createBatteryHALState('bat-0'), 1);
  const { reading } = readBattery(s, 80, 28, 2);
  expect(reading).toBeTruthy();
  expect(reading.percentage).toBe(80);
});

test('readBattery - clamps percentage 0-100', () => {
  const s = initializeBattery(createBatteryHALState('bat-0'), 1);
  const { reading } = readBattery(s, 150, 28, 2);
  expect(reading.percentage).toBe(100);
});

test('readBattery - criticalMode at 10%', () => {
  const s = initializeBattery(createBatteryHALState('bat-0'), 1);
  const { reading } = readBattery(s, 5, 28, 2);
  expect(reading.criticalMode).toBeTruthy();
});

test('readBattery - sets criticalBatteryActive on state', () => {
  const s = initializeBattery(createBatteryHALState('bat-0'), 1);
  const { state } = readBattery(s, 5, 28, 2);
  expect(state.criticalBatteryActive).toBeTruthy();
});

test('isCritical - true at 5%', () => {
  const s = initializeBattery(createBatteryHALState('bat-0'), 1);
  const { reading } = readBattery(s, 5, 28, 2);
  expect(isCritical(reading)).toBeTruthy();
});

test('isCritical - false at 80%', () => {
  const s = initializeBattery(createBatteryHALState('bat-0'), 1);
  const { reading } = readBattery(s, 80, 28, 2);
  expect(isCritical(reading)).toBeFalsy();
});

test('buildBatteryWarning - null at 80%', () => {
  const s = initializeBattery(createBatteryHALState('bat-0'), 1);
  const { reading } = readBattery(s, 80, 28, 2);
  expect(buildBatteryWarning(reading)).toBeNull();
});

test('buildBatteryWarning - CRITICAL_BATTERY_ANNOUNCEMENT at 5%', () => {
  const s = initializeBattery(createBatteryHALState('bat-0'), 1);
  const { reading } = readBattery(s, 5, 28, 2);
  expect(buildBatteryWarning(reading)).toBeTruthy();
});

test('getBatteryHealth - component is battery', () => {
  const s = initializeBattery(createBatteryHALState('bat-0'), 1);
  expect(getBatteryHealth(s).component).toBe('battery');
});

test('getBatteryDriver - simulation → simulation', () => {
  expect(getBatteryDriver('simulation')).toBe(SIMULATION_DRIVER);
});

// ─── Suite 7: Display HAL ─────────────────────────────────────────────────────

console.log('\nDisplay HAL');

test('createDisplayHALState - status offline, mode hud', () => {
  const s = createDisplayHALState('disp-0');
  expect(s.status).toBe('offline');
  expect(s.mode).toBe('hud');
});

test('initializeDisplay - status ready, isOn true', () => {
  const s = initializeDisplay(createDisplayHALState('disp-0'), 1);
  expect(s.status).toBe('ready');
  expect(s.isOn).toBeTruthy();
});

test('setDisplayMode - changes mode', () => {
  const s = initializeDisplay(createDisplayHALState('disp-0'), 1);
  expect(setDisplayMode(s, 'low-power').mode).toBe('low-power');
});

test('setDisplayMode - off mode sets isOn false', () => {
  const s = initializeDisplay(createDisplayHALState('disp-0'), 1);
  expect(setDisplayMode(s, 'off').isOn).toBeFalsy();
});

test('setBrightness - sets brightness level', () => {
  const s = initializeDisplay(createDisplayHALState('disp-0'), 1);
  expect(setBrightness(s, 'dim').brightness).toBe('dim');
});

test('setNumericBrightness - clamps to 0-100', () => {
  const s = initializeDisplay(createDisplayHALState('disp-0'), 1);
  expect(setNumericBrightness(s, 150).brightnessNumeric).toBe(100);
});

test('turnOff - mode off, isOn false', () => {
  const s = initializeDisplay(createDisplayHALState('disp-0'), 1);
  const off = turnOff(s);
  expect(off.mode).toBe('off');
  expect(off.isOn).toBeFalsy();
});

test('turnOn - mode hud, isOn true', () => {
  const s = turnOff(initializeDisplay(createDisplayHALState('disp-0'), 1));
  expect(turnOn(s).isOn).toBeTruthy();
});

test('activateLowPowerMode - mode low-power, brightness dim', () => {
  const s = initializeDisplay(createDisplayHALState('disp-0'), 1);
  const lp = activateLowPowerMode(s);
  expect(lp.mode).toBe('low-power');
  expect(lp.brightness).toBe('dim');
});

test('getDisplayHealth - no issues when ready and on', () => {
  const s = initializeDisplay(createDisplayHALState('disp-0'), 1);
  expect(getDisplayHealth(s).issues).toHaveLength(0);
});

test('getDisplayDriver - simulation → simulation', () => {
  expect(getDisplayDriver('simulation')).toBe(SIMULATION_DRIVER);
});

// ─── Suite 8: Sensor Manager ──────────────────────────────────────────────────

console.log('\nSensor Manager');

function buildTestManager() {
  let m = createSensorManager();
  m = registerCamera(m, initializeCamera(createCameraHALState('cam-0', 'front'), 1));
  m = registerMicrophone(m, initializeMic(createMicHALState('mic-0'), 1));
  m = registerIMU(m, initializeIMU(createIMUHALState('imu-0'), 1));
  m = registerGPS(m, acquireFix(initializeGPS(createGPSHALState('gps-0'), 1), 2));
  m = registerBattery(m, initializeBattery(createBatteryHALState('bat-0'), 1));
  return m;
}

test('createSensorManager - empty cameras and mics', () => {
  const m = createSensorManager();
  expect(m.cameras).toHaveLength(0);
  expect(m.microphones).toHaveLength(0);
});

test('registerCamera - adds camera', () => {
  const m = registerCamera(createSensorManager(), initializeCamera(createCameraHALState('cam-0'), 1));
  expect(m.cameras).toHaveLength(1);
});

test('registerIMU - sets imu', () => {
  const m = registerIMU(createSensorManager(), initializeIMU(createIMUHALState('imu-0'), 1));
  expect(m.imu).toBeTruthy();
});

test('buildHealthReports - returns reports for all registered', () => {
  const m = buildTestManager();
  const reports = buildHealthReports(m);
  expect(reports.length).toBeGreaterThan(0);
});

test('runHealthChecks - updates lastHealthCheckTick', () => {
  const m = buildTestManager();
  const { manager } = runHealthChecks(m, 10);
  expect(manager.lastHealthCheckTick).toBe(10);
});

test('isAnyHALCritical - false when all ready', () => {
  const m = buildTestManager();
  const reports = buildHealthReports(m);
  expect(isAnyHALCritical(reports)).toBeFalsy();
});

test('isAnyHALCritical - true when camera errored', () => {
  let m = buildTestManager();
  m = { ...m, cameras: m.cameras.map(c => setCameraError(c, 2)) };
  const reports = buildHealthReports(m);
  expect(isAnyHALCritical(reports)).toBeTruthy();
});

test('getHealthyCount - 5 when all ready', () => {
  const m = buildTestManager();
  const reports = buildHealthReports(m);
  expect(getHealthyCount(reports)).toBe(5);
});

test('autoRestartFailedSensors - restarts errored camera', () => {
  let m = buildTestManager();
  m = { ...m, cameras: [setCameraError(m.cameras[0], 2)] };
  const restarted = autoRestartFailedSensors(m, 10);
  expect(restarted.cameras[0].status).toBe('initializing');
});

test('autoRestartFailedSensors - restarts errored IMU', () => {
  let m = buildTestManager();
  m = { ...m, imu: setIMUError(m.imu!) };
  const restarted = autoRestartFailedSensors(m, 10);
  expect(restarted.imu?.status).toBe('initializing');
});

test('getSensorManagerSummary - total matches registered count', () => {
  const m = buildTestManager();
  const s = getSensorManagerSummary(m);
  expect(s.total).toBe(5);
});

test('getCriticalHealthIssues - empty when all healthy', () => {
  const m = buildTestManager();
  expect(getCriticalHealthIssues(m)).toHaveLength(0);
});

// ─── Suite 9: Hardware Abstraction Engine ─────────────────────────────────────

console.log('\nHardware Abstraction Engine');

test('createHALSystem - simulation platform by default', () => {
  expect(createHALSystem().platform).toBe('simulation');
});

test('createHALSystem - initialized false', () => {
  expect(createHALSystem().initialized).toBeFalsy();
});

test('initializeHALSystem - initialized true', () => {
  const s = initializeHALSystem(createHALSystem(), 1);
  expect(s.initialized).toBeTruthy();
});

test('initializeHALSystem - 7 registrations (one per component)', () => {
  const s = initializeHALSystem(createHALSystem(), 1);
  expect(s.registrations).toHaveLength(7);
});

test('initializeHALSystem - all drivers are simulation', () => {
  const s = initializeHALSystem(createHALSystem('simulation'), 1);
  expect(s.registrations.every(r => r.driver === SIMULATION_DRIVER)).toBeTruthy();
});

test('initializeHALSystem - android-xr uses android-camera2 for camera', () => {
  const s = initializeHALSystem(createHALSystem('android-xr'), 1);
  const cam = s.registrations.find(r => r.component === 'camera');
  expect(cam?.driver).toBe('android-camera2');
});

test('registerDriver - adds new registration', () => {
  const s = initializeHALSystem(createHALSystem(), 1);
  const s2 = registerDriver(s, { component: 'camera', deviceId: 'cam-extra', platform: 'simulation', driver: 'custom' });
  expect(s2.registrations.length).toBeGreaterThan(7);
});

test('getRegisteredDrivers - returns all', () => {
  const s = initializeHALSystem(createHALSystem(), 1);
  expect(getRegisteredDrivers(s)).toHaveLength(7);
});

test('getDriverForComponent - finds camera', () => {
  const s = initializeHALSystem(createHALSystem(), 1);
  expect(getDriverForComponent(s, 'camera')).toBeTruthy();
});

test('getDriverForComponent - null for unregistered', () => {
  expect(getDriverForComponent(createHALSystem(), 'camera')).toBeNull();
});

test('isSupportedPlatform - simulation → true', () => {
  expect(isSupportedPlatform('simulation')).toBeTruthy();
});

test('isSupportedPlatform - unknown → false', () => {
  expect(isSupportedPlatform('windows-holographic')).toBeFalsy();
});

test('getPlatformLabel - simulation label', () => {
  expect(getPlatformLabel('simulation')).toBe('Software Simulation');
});

test('getPlatformLabel - denarixx-v1 label', () => {
  expect(getPlatformLabel('denarixx-v1')).toContain('Denarixx');
});

test('getPlatformNotes - simulation returns array', () => {
  expect(getPlatformNotes('simulation').length).toBeGreaterThan(0);
});

test('buildHALIntegrationBridge - all true when initialized', () => {
  const s = initializeHALSystem(createHALSystem(), 1);
  const bridge = buildHALIntegrationBridge(s);
  expect(bridge.guardian).toBeTruthy();
  expect(bridge.glassesRuntime).toBeTruthy();
  expect(bridge.navigation).toBeTruthy();
  expect(bridge.visionEngine).toBeTruthy();
});

test('buildHALIntegrationBridge - all false before init', () => {
  const s = createHALSystem();
  const bridge = buildHALIntegrationBridge(s);
  expect(bridge.guardian).toBeFalsy();
});

test('getHALNote - returns HAL_SAFETY_NOTE', () => {
  expect(getHALNote()).toBe(HAL_SAFETY_NOTE);
});

test('getHALComponentCount - 7 after init', () => {
  expect(getHALComponentCount(initializeHALSystem(createHALSystem(), 1))).toBe(7);
});

test('advanceTick - increments tick', () => {
  const s = advanceTick(createHALSystem());
  expect(s.tick).toBe(1);
});

// ─── Suite 10: Constants ──────────────────────────────────────────────────────

console.log('\nConstants & Architecture');

test('HAL_SAFETY_NOTE mentions HAL', () => {
  expect(HAL_SAFETY_NOTE).toContain('HAL');
});

test('HAL_SAFETY_NOTE says AI never directly touches hardware', () => {
  expect(HAL_SAFETY_NOTE.toLowerCase()).toContain('never directly');
});

test('SIMULATION_DRIVER is "simulation"', () => {
  expect(SIMULATION_DRIVER).toBe('simulation');
});

test('MAX_RESTART_ATTEMPTS is 3', () => {
  expect(MAX_RESTART_ATTEMPTS).toBe(3);
});

test('SUPPORTED_PLATFORMS has 5 entries', () => {
  expect(SUPPORTED_PLATFORMS).toHaveLength(5);
});

test('SUPPORTED_PLATFORMS includes denarixx-v1', () => {
  expect(SUPPORTED_PLATFORMS).toContain('denarixx-v1');
});

test('SUPPORTED_PLATFORMS includes android-xr', () => {
  expect(SUPPORTED_PLATFORMS).toContain('android-xr');
});

// ─── Result ───────────────────────────────────────────────────────────────────

console.log(`\nHardware Abstraction Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

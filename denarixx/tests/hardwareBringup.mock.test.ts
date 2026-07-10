// ─── Bring-Up Program: Hardware Bring-Up Behavioral Tests (MOCKED HARDWARE) ───
// This file is a copy of the original hardwareBringup.test.ts with all
// hardware clearly labeled as MOCKED. No physical device is connected.
// These tests validate the software pipeline and state machines.
// Hardware validation with real silicon requires tests/hardwareOnDevice.test.ts.
//
// Run: cd denarixx && npx tsx tests/hardwareBringup.mock.test.ts

import {
  createEmbeddedRuntimeState,
  runBoot,
  runSensorInit,
  runCameraInit,
  runModelLoad,
  runSessionStart,
  processFrame,
  runHealthCheck,
  runEmergencyStop,
  runShutdown,
  runRestart,
  handleButtonEvents,
  consumeAnnouncements,
  consumeHapticCommands,
} from '../src/runtime/embeddedVisionRuntime';
import {
  assembleSimulationAdapters,
  runFullBootSequence,
  runOneTick,
  defaultConfig,
} from '../src/runtime/startPrototypeRuntime';
import {
  createSimulationCameraAdapter,
  createSimulationMicrophoneAdapter,
  createSimulationAudioOutputAdapter,
  createSimulationHapticAdapter,
  createSimulationIMUAdapter,
  createSimulationBatteryAdapter,
  createSimulationNetworkAdapter,
  createSimulationButtonAdapter,
} from '../src/runtime/adapters/simulationTestAdapter';
import {
  createBrowserCameraAdapter,
  createBrowserAudioOutputAdapter,
} from '../src/runtime/adapters/browserDevelopmentAdapter';
import type { HardwareAdapterSet } from '../src/runtime/adapters/hardwareAdapterTypes';
import {
  selectHardwareAdapter,
  createModelState,
  buildSimulatedDetections,
  buildRealDetections,
  isModelReady,
  modelStateAfterLoad,
  modelStateAfterFailure,
  runLocalInference,
} from '../src/engines/localInferenceEngine';
import { buildDegradedSafetyState } from '../src/types/localInference';
import {
  processButtonEvent,
  recordPress,
  getDetectedEventType,
  resolveButtonAction,
  buildButtonActionResult,
  createPressSequenceState,
  createEmergencyButtonState,
  TRIPLE_PRESS_WINDOW_MS,
  EMERGENCY_ANNOUNCEMENT,
} from '../src/engines/hardwareButtonEngine';
import {
  createCalibrationSession,
  startStep,
  completeStep,
  skipStep,
  getStepInstruction,
  CALIBRATION_PRIVACY_NOTE,
} from '../src/engines/sensorCalibrationEngine';
import {
  createHILTSession,
  recordSample,
  recordFrameTick,
  buildFullReport,
  HILT_SAFETY_NOTE,
  getScenario,
} from '../src/engines/hiltTestHarnessEngine';
import { OFFLINE_INFERENCE_PRIORITY, LOCAL_INFERENCE_SAFETY_NOTE } from '../src/types/localInference';

const NOW = 1_700_000_000_000;

let passed = 0;
let failed = 0;
function assert(condition: boolean, msg: string): void {
  if (!condition) { console.error('FAIL:', msg); failed++; } else { passed++; }
}

// ─── Test 1: Embedded Runtime Boot (MOCKED HARDWARE) ─────────────────────────

console.log('\n─── Test 1: Embedded runtime boot (MOCKED) ───');
{
  const adapters = assembleSimulationAdapters(true);
  const state = createEmbeddedRuntimeState('test-session-1');
  const { state: booted, result } = runBoot(state, adapters, NOW);

  assert(result.success === true, 'Boot should succeed with simulation adapters');
  assert(booted.phase === 'sensor-init', `Phase should be sensor-init, got ${booted.phase}`);
  assert(booted.announcements.length > 0, 'Boot should produce announcements');
  assert(
    booted.announcements.some(a => a.toLowerCase().includes('starting')),
    'Boot announcement should mention starting',
  );
  console.log('PASS: Boot succeeds with mocked simulation adapters');
  console.log('[MOCKED] All hardware adapters are simulation stubs. No physical device tested.');
}

// ─── Test 2: Physical Adapter Selection ──────────────────────────────────────

console.log('\n─── Test 2: Physical adapter selection ───');
{
  const simAdapter = selectHardwareAdapter('simulation-test');
  const devAdapter = selectHardwareAdapter('browser-development');
  const embeddedAdapter = selectHardwareAdapter('embedded-prototype');
  const nullAdapter = selectHardwareAdapter(null);

  assert(simAdapter.mode === 'simulation-test', 'Null env → simulation-test');
  assert(devAdapter.mode === 'browser-development', 'browser-development selected');
  assert(embeddedAdapter.mode === 'embedded-prototype', 'embedded-prototype selected');
  assert(nullAdapter.mode === 'simulation-test', 'Null env defaults to simulation-test');
  assert(simAdapter.allowSimulationFallback === true, 'Simulation allows simulation fallback');
  assert(embeddedAdapter.allowSimulationFallback === false, 'Embedded prototype never allows simulation fallback');
  assert(embeddedAdapter.realUserMode === true, 'Embedded adapter is real-user mode');
  assert(devAdapter.realUserMode === false, 'Browser dev is not real-user mode');

  console.log('PASS: Adapter selection respects mode and real-user constraints');
}

// ─── Test 3: Local Model Load Success (MOCKED) ────────────────────────────────

console.log('\n─── Test 3: Local model load success (MOCKED) ───');
{
  const modelState = createModelState('simulation-test');
  assert(!isModelReady(modelState), 'Model not ready before load');
  const loaded = modelStateAfterLoad(modelState, 'simulation', NOW);
  assert(isModelReady(loaded), 'Model ready after load');
  assert(loaded.status === 'ready', 'Status is ready');
  assert(loaded.modelPath === 'simulation', 'Model path recorded');
  assert(loaded.loadedAt === NOW, 'Load timestamp recorded');
  console.log('PASS: Model state transitions correctly on load');
  console.log('[MOCKED] No real ONNX/TFLite model loaded — simulation path only');
}

// ─── Test 4: Local Model Load Failure ────────────────────────────────────────

console.log('\n─── Test 4: Local model load failure ───');
{
  const modelState = createModelState('embedded-cpu-onnx');
  const failed = modelStateAfterFailure(modelState, 'Flash storage read error');
  assert(failed.status === 'failed', 'Status is failed');
  assert(failed.failureReason !== null, 'Failure reason recorded');
  assert(!isModelReady(failed), 'Model not ready after failure');

  const adapterConfig = selectHardwareAdapter('embedded-prototype');
  const result = runLocalInference(adapterConfig, failed, 0, NOW);
  assert(result.error !== null, 'Error returned when model not loaded in embedded mode');
  assert(result.detections.length === 0, 'No detections when model failed');
  console.log('PASS: Model load failure produces error and empty detections');
}

// ─── Test 5: No Synthetic Fallback in Real-User Mode ─────────────────────────

console.log('\n─── Test 5: No synthetic fallback in real-user mode ───');
{
  const realUserAdapter = selectHardwareAdapter('embedded-prototype');
  assert(realUserAdapter.realUserMode === true, 'Real-user mode is active');
  assert(realUserAdapter.allowSimulationFallback === false, 'Simulation fallback disabled');

  const simDetections = buildSimulatedDetections(0);
  for (const d of simDetections) {
    assert(d.isSimulated === true, `Detection must be marked isSimulated: ${d.className}`);
    assert(d.source === 'simulation-test', 'Simulation source labeled');
  }

  const realDetections = buildRealDetections(['person', 'obstacle'], [0.88, 0.72], 'embedded-cpu-onnx', 25);
  for (const d of realDetections) {
    assert(d.isSimulated === false, `Real detection must not be simulated: ${d.className}`);
    assert(d.source === 'embedded-cpu-onnx', 'Real source labeled');
  }

  assert(OFFLINE_INFERENCE_PRIORITY.length === 3, 'Three offline priority levels defined');
  assert(
    !OFFLINE_INFERENCE_PRIORITY.some(p => p.toLowerCase().includes('simulation')),
    'Simulation is not in the offline priority list — never a real-user fallback',
  );
  console.log('PASS: Real-user mode never uses simulation; simulation is development-only');
}

// ─── Test 6: Camera Failure (MOCKED) ─────────────────────────────────────────

console.log('\n─── Test 6: Camera failure (MOCKED) ───');
{
  const adapters: HardwareAdapterSet = {
    mode: 'simulation-test',
    camera:      createBrowserCameraAdapter(false),
    microphone:  createSimulationMicrophoneAdapter(),
    audioOutput: createSimulationAudioOutputAdapter(),
    haptic:      createSimulationHapticAdapter(),
    imu:         createSimulationIMUAdapter(),
    battery:     createSimulationBatteryAdapter(),
    network:     createSimulationNetworkAdapter(true),
    buttons:     createSimulationButtonAdapter(),
  };

  const state = createEmbeddedRuntimeState('test-camera-fail');
  const boosted = { ...state, phase: 'camera-init' as const };
  const afterCameraInit = runCameraInit(boosted, adapters, NOW);
  assert(afterCameraInit.phase === 'failed', 'Phase is failed when camera unavailable at init');
  assert(
    afterCameraInit.announcements.some(a => a.toLowerCase().includes('camera')),
    'Camera failure announcement issued',
  );

  const running = { ...state, phase: 'running' as const, runtimeState: 'running' as const };
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const frameResult = processFrame(running, adapters, adapterConfig, modelState, NOW);
  assert(frameResult.result.dropped === true, 'Frame dropped when camera unavailable');
  assert(
    frameResult.result.hapticPatterns.includes('device-failure'),
    'device-failure haptic triggered on camera loss',
  );
  console.log('PASS: Camera unavailability → failure phase + haptic + announcement');
  console.log('[MOCKED] Simulated camera unavailability via adapter flag. Physical camera testing requires hardware.');
}

// ─── Test 7: Audio Failure with Haptic Fallback (MOCKED) ─────────────────────

console.log('\n─── Test 7: Audio failure with haptic fallback (MOCKED) ───');
{
  const adapters: HardwareAdapterSet = {
    mode: 'simulation-test',
    camera:      createSimulationCameraAdapter(),
    microphone:  createSimulationMicrophoneAdapter(),
    audioOutput: createBrowserAudioOutputAdapter(false),
    haptic:      createSimulationHapticAdapter(),
    imu:         createSimulationIMUAdapter(),
    battery:     createSimulationBatteryAdapter(),
    network:     createSimulationNetworkAdapter(true),
    buttons:     createSimulationButtonAdapter(),
  };
  assert(!adapters.audioOutput.isAvailable(), 'Audio unavailable');
  assert(!adapters.audioOutput.canSpeak(), 'Cannot speak');
  assert(adapters.haptic.isAvailable(), 'Haptic still available as fallback');

  const state = { ...createEmbeddedRuntimeState('audio-fail'), phase: 'running' as const, runtimeState: 'running' as const };
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const { result } = runHealthCheck(state, adapters, modelState, NOW);
  assert(!result.shouldShutdown, 'Audio failure alone does not trigger shutdown');
  console.log('PASS: Audio failure handled gracefully; haptic fallback remains active');
  console.log('[MOCKED] Bone-conduction physical testing requires hardware bring-up.');
}

// ─── Test 8: Low Battery Degradation (MOCKED) ────────────────────────────────

console.log('\n─── Test 8: Low battery degradation (MOCKED) ───');
{
  const adapters: HardwareAdapterSet = {
    mode: 'simulation-test',
    camera:      createSimulationCameraAdapter(),
    microphone:  createSimulationMicrophoneAdapter(),
    audioOutput: createSimulationAudioOutputAdapter(),
    haptic:      createSimulationHapticAdapter(),
    imu:         createSimulationIMUAdapter(),
    battery:     createSimulationBatteryAdapter(8, 0),
    network:     createSimulationNetworkAdapter(true),
    buttons:     createSimulationButtonAdapter(),
  };
  const batteryReading = adapters.battery.getLastReading(0);
  assert(batteryReading !== null, 'Battery reading available');
  assert(batteryReading!.percentagePct <= 10, 'Battery is critical');

  const state = { ...createEmbeddedRuntimeState('battery-test'), phase: 'running' as const, runtimeState: 'running' as const, tick: 31, lastHealthCheckTick: 0 };
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const frameResult = processFrame(state, adapters, adapterConfig, modelState, NOW);
  assert(frameResult.result.hapticPatterns.includes('low-battery'), 'low-battery haptic triggered');
  assert(frameResult.state.announcements.some(a => a.toLowerCase().includes('battery')), 'Battery announcement issued');
  console.log('PASS: Critical battery triggers announcement and low-battery haptic');
  console.log('[MOCKED] Physical fuel gauge reading requires real hardware.');
}

// ─── Test 9: Thermal Shutdown (MOCKED) ───────────────────────────────────────

console.log('\n─── Test 9: Thermal shutdown simulation (MOCKED) ───');
{
  const overheatAdapters: HardwareAdapterSet = {
    mode: 'simulation-test',
    camera:      createSimulationCameraAdapter(),
    microphone:  createSimulationMicrophoneAdapter(),
    audioOutput: createSimulationAudioOutputAdapter(),
    haptic:      createSimulationHapticAdapter(),
    imu:         createSimulationIMUAdapter(),
    battery: {
      mode: 'simulation-test',
      id: 'sim-battery-overheat',
      isAvailable: () => true,
      getLastReading: () => ({
        timestampMs: NOW, percentagePct: 75, temperatureC: 92,
        isCharging: false, estimatedMinutesRemaining: 120, isSimulated: true as const,
      }),
      getHealthStatus: () => 'healthy' as const,
    },
    network:     createSimulationNetworkAdapter(true),
    buttons:     createSimulationButtonAdapter(),
  };

  const state = { ...createEmbeddedRuntimeState('thermal-test'), phase: 'running' as const, runtimeState: 'running' as const, tick: 31, lastHealthCheckTick: 0 };
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const frameResult = processFrame(state, overheatAdapters, adapterConfig, modelState, NOW);
  assert(frameResult.state.announcements.some(a => a.toLowerCase().includes('overheat')), 'Overheating announcement issued');
  assert(frameResult.result.hapticPatterns.includes('device-failure'), 'device-failure haptic on overheating');
  console.log('PASS: Overheating → announcement + device-failure haptic');
  console.log('[MOCKED] Physical thermal sensor requires hardware bring-up.');
}

// ─── Test 10: Emergency Hardware Button ──────────────────────────────────────

console.log('\n─── Test 10: Emergency hardware button ───');
{
  // Triple-press detection: 3 presses within TRIPLE_PRESS_WINDOW_MS, then window closes.
  // The engine detects triple-press on the NEXT event after the window expires.
  let seq = createPressSequenceState();
  seq = recordPress(seq, 'main', NOW);
  seq = recordPress(seq, 'main', NOW + 200);
  seq = recordPress(seq, 'main', NOW + 400);
  // Check with nowMs well past window close: lastPressMs=NOW+400, window=600ms → detect at NOW+1100+
  const afterWindowMs = NOW + 400 + TRIPLE_PRESS_WINDOW_MS + 100;
  const eventType = getDetectedEventType(seq, 100, afterWindowMs);
  assert(eventType === 'triple-press', `getDetectedEventType returns triple-press, got ${eventType}`);

  const action = resolveButtonAction('main', eventType, 'running');
  assert(action === 'emergency-stop', `resolveButtonAction returns emergency-stop, got ${action}`);

  const result = buildButtonActionResult(action, 'running');
  assert(result.isEmergency === true, 'Emergency flag set');
  assert(result.changeState === 'emergency', 'State changes to emergency');
  assert(result.announcement.toLowerCase().includes('emergency'), 'Emergency announcement provided');

  const state = createEmbeddedRuntimeState('emergency-test');
  const afterEmergency = runEmergencyStop(state, NOW);
  assert(afterEmergency.phase === 'emergency', 'Phase is emergency');
  assert(afterEmergency.emergencyActive === true, 'Emergency active flag set');
  assert(afterEmergency.hapticCommands.includes('stop-immediately'), 'stop-immediately haptic queued');
  assert(afterEmergency.announcements.some(a => a === EMERGENCY_ANNOUNCEMENT), 'Emergency announcement queued');
  console.log('PASS: Triple-press → emergency stop action + haptic + announcement');
}

// ─── Test 11: Offline Operation (MOCKED) ─────────────────────────────────────

console.log('\n─── Test 11: Offline operation (MOCKED) ───');
{
  const offlineAdapters: HardwareAdapterSet = {
    mode: 'simulation-test',
    camera:      createSimulationCameraAdapter(),
    microphone:  createSimulationMicrophoneAdapter(),
    audioOutput: createSimulationAudioOutputAdapter(),
    haptic:      createSimulationHapticAdapter(),
    imu:         createSimulationIMUAdapter(),
    battery:     createSimulationBatteryAdapter(),
    network:     createSimulationNetworkAdapter(false),
    buttons:     createSimulationButtonAdapter(),
  };
  const networkStatus = offlineAdapters.network.getStatus();
  assert(!networkStatus.isOnline, 'Network is offline');
  assert(networkStatus.quality === 'offline', 'Quality is offline');

  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const result = runLocalInference(adapterConfig, modelState, 0, NOW);
  assert(result.error === null, 'Local inference works without network');

  const degraded = buildDegradedSafetyState(true, true, false);
  assert(degraded.mode === 'sensor-guidance-only', 'Sensor guidance when vision fails');
  assert(!degraded.visionAvailable, 'Vision marked unavailable');
  const degradedNoSensors = buildDegradedSafetyState(true, false, false);
  assert(degradedNoSensors.mode === 'limited-function-warning', 'Limited function when no sensors');
  console.log('PASS: Offline → local inference continues; degraded mode hierarchy works');
}

// ─── Test 12: Runtime Restart (MOCKED) ───────────────────────────────────────

console.log('\n─── Test 12: Runtime restart after recoverable failure (MOCKED) ───');
{
  const state = { ...createEmbeddedRuntimeState('restart-test'), phase: 'running' as const, tick: 150, frameCount: 150, errors: new Array(11).fill('recoverable error') };
  const restarted = runRestart(state, NOW);
  assert(restarted.phase === 'booting', `Phase is booting after restart, got ${restarted.phase}`);
  assert(restarted.tick === 0, 'Tick reset to 0');
  assert(restarted.frameCount === 0, 'Frame count reset');
  assert(restarted.errors.length === 0, 'Error count cleared');
  assert(restarted.announcements.some(a => a.toLowerCase().includes('restart')), 'Restart announcement queued');
  assert(restarted.sessionId === state.sessionId, 'Session ID preserved across restart');
  console.log('PASS: Restart clears runtime state and issues announcement');
}

// ─── Test 13: Clean Shutdown (MOCKED) ────────────────────────────────────────

console.log('\n─── Test 13: Clean shutdown (MOCKED) ───');
{
  const state = { ...createEmbeddedRuntimeState('shutdown-test'), phase: 'running' as const, runtimeState: 'running' as const };
  const shutdown = runShutdown(state, 'Low battery', NOW);
  assert(shutdown.phase === 'shutdown', 'Phase is shutdown');
  assert(shutdown.runtimeState === 'idle', 'Runtime state is idle');
  assert(shutdown.shutdownReason === 'Low battery', 'Shutdown reason recorded');
  assert(shutdown.announcements.some(a => a.toLowerCase().includes('shutting down')), 'Shutdown announcement issued');

  const config = { ...defaultConfig(), maxFrames: 3 };
  const bootOutcome = runFullBootSequence(config, NOW);
  assert(bootOutcome.success === true, 'Full boot sequence succeeds with simulation');
  assert(bootOutcome.state.phase === 'running', 'State is running after full boot');
  console.log('PASS: Clean shutdown records reason and issues announcement; full session cycle works');
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Mock Hardware Tests: ${passed} passed, ${failed} failed ──`);
if (failed > 0) {
  console.error(`${failed} test(s) failed.`);
  process.exit(1);
}
console.log('[NOTE] All tests above use mocked/simulated hardware. Physical bring-up requires tests/hardwareOnDevice.test.ts on real device.');

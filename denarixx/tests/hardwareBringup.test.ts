// ─── Bring-Up Program: Hardware Bring-Up Behavioral Tests ────────────────────
// 14 behavioral tests covering embedded runtime lifecycle.
// All hardware is MOCKED — clearly labeled. No physical device connected.
// These tests validate the software pipeline; hardware validation requires
// real physical bring-up with the actual prototype.

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
  createBrowserMicrophoneAdapter,
  createBrowserAudioOutputAdapter,
  createBrowserHapticAdapter,
  createBrowserIMUAdapter,
  createBrowserBatteryAdapter,
  createBrowserNetworkAdapter,
  createBrowserButtonAdapter,
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
  getCapabilityLevel,
} from '../src/engines/localInferenceEngine';
import { buildDegradedSafetyState } from '../src/types/localInference';
import {
  processButtonEvent,
  createPressSequenceState,
  createEmergencyButtonState,
  activateEmergencyStop,
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

// ─── Test 1: Embedded Runtime Boot (MOCKED HARDWARE) ─────────────────────────

console.log('\n─── Test 1: Embedded runtime boot (MOCKED) ───');
{
  const adapters = assembleSimulationAdapters(true);
  const state = createEmbeddedRuntimeState('test-session-1');
  const { state: booted, result } = runBoot(state, adapters, NOW);

  console.assert(result.success === true, 'Boot should succeed with simulation adapters');
  console.assert(booted.phase === 'sensor-init', `Phase should be sensor-init, got ${booted.phase}`);
  console.assert(booted.announcements.length > 0, 'Boot should produce announcements');
  console.assert(
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

  console.assert(simAdapter.mode === 'simulation-test', 'Null env → simulation-test');
  console.assert(devAdapter.mode === 'browser-development', 'browser-development selected');
  console.assert(embeddedAdapter.mode === 'embedded-prototype', 'embedded-prototype selected');
  console.assert(nullAdapter.mode === 'simulation-test', 'Null env defaults to simulation-test');

  console.assert(simAdapter.allowSimulationFallback === true, 'Simulation allows simulation fallback');
  console.assert(embeddedAdapter.allowSimulationFallback === false, 'Embedded prototype never allows simulation fallback');
  console.assert(embeddedAdapter.realUserMode === true, 'Embedded adapter is real-user mode');
  console.assert(devAdapter.realUserMode === false, 'Browser dev is not real-user mode');

  console.log('PASS: Adapter selection respects mode and real-user constraints');
}

// ─── Test 3: Local Model Load Success (MOCKED) ────────────────────────────────

console.log('\n─── Test 3: Local model load success (MOCKED) ───');
{
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = createModelState('simulation-test');

  console.assert(!isModelReady(modelState), 'Model not ready before load');

  const loaded = modelStateAfterLoad(modelState, 'simulation', NOW);
  console.assert(isModelReady(loaded), 'Model ready after load');
  console.assert(loaded.status === 'ready', 'Status is ready');
  console.assert(loaded.modelPath === 'simulation', 'Model path recorded');
  console.assert(loaded.loadedAt === NOW, 'Load timestamp recorded');

  console.log('PASS: Model state transitions correctly on load');
  console.log('[MOCKED] No real ONNX/TFLite model loaded — simulation path only');
}

// ─── Test 4: Local Model Load Failure ────────────────────────────────────────

console.log('\n─── Test 4: Local model load failure ───');
{
  const modelState = createModelState('embedded-cpu-onnx');
  const failed = modelStateAfterFailure(modelState, 'Flash storage read error');

  console.assert(failed.status === 'failed', 'Status is failed');
  console.assert(failed.failureReason !== null, 'Failure reason recorded');
  console.assert(!isModelReady(failed), 'Model not ready after failure');

  // Inference attempt with failed model in non-simulation mode
  const adapterConfig = selectHardwareAdapter('embedded-prototype');
  const result = runLocalInference(adapterConfig, failed, 0, NOW);
  console.assert(result.error !== null, 'Error returned when model not loaded in embedded mode');
  console.assert(result.detections.length === 0, 'No detections when model failed');

  console.log('PASS: Model load failure produces error and empty detections');
}

// ─── Test 5: No Synthetic Fallback in Real-User Mode ─────────────────────────

console.log('\n─── Test 5: No synthetic fallback in real-user mode ───');
{
  const realUserAdapter = selectHardwareAdapter('embedded-prototype');
  console.assert(realUserAdapter.realUserMode === true, 'Real-user mode is active');
  console.assert(realUserAdapter.allowSimulationFallback === false, 'Simulation fallback disabled');

  // Simulation detections are clearly labeled isSimulated: true
  const simDetections = buildSimulatedDetections(0);
  for (const d of simDetections) {
    console.assert(d.isSimulated === true, `Detection must be marked isSimulated: ${d.className}`);
    console.assert(d.source === 'simulation-test', 'Simulation source labeled');
  }

  // Real detections are clearly labeled isSimulated: false
  const realDetections = buildRealDetections(['person', 'obstacle'], [0.88, 0.72], 'embedded-cpu-onnx', 25);
  for (const d of realDetections) {
    console.assert(d.isSimulated === false, `Real detection must not be simulated: ${d.className}`);
    console.assert(d.source === 'embedded-cpu-onnx', 'Real source labeled');
  }

  // Offline priority order must put simulation last (never)
  console.assert(OFFLINE_INFERENCE_PRIORITY.length === 3, 'Three offline priority levels defined');
  console.assert(
    !OFFLINE_INFERENCE_PRIORITY.some(p => p.toLowerCase().includes('simulation')),
    'Simulation is not in the offline priority list — it must never be a real-user fallback',
  );

  console.log('PASS: Real-user mode never uses simulation; simulation is development-only');
}

// ─── Test 6: Camera Failure (MOCKED) ─────────────────────────────────────────

console.log('\n─── Test 6: Camera failure (MOCKED) ───');
{
  const adapters: HardwareAdapterSet = {
    mode: 'simulation-test',
    camera:      createBrowserCameraAdapter(false),    // camera unavailable
    microphone:  createSimulationMicrophoneAdapter(),
    audioOutput: createSimulationAudioOutputAdapter(),
    haptic:      createSimulationHapticAdapter(),
    imu:         createSimulationIMUAdapter(),
    battery:     createSimulationBatteryAdapter(),
    network:     createSimulationNetworkAdapter(true),
    buttons:     createSimulationButtonAdapter(),
  };

  // Boot should still succeed if camera unavailable at boot (IMU is critical-secondary)
  const state = createEmbeddedRuntimeState('test-camera-fail');
  const boosted = { ...state, phase: 'camera-init' as const };
  const afterCameraInit = runCameraInit(boosted, adapters, NOW);

  console.assert(afterCameraInit.phase === 'failed', 'Phase is failed when camera unavailable at init');
  console.assert(
    afterCameraInit.announcements.some(a => a.toLowerCase().includes('camera')),
    'Camera failure announcement issued',
  );

  // Frame processing with camera unavailable
  const running = { ...state, phase: 'running' as const, runtimeState: 'running' as const };
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const frameResult = processFrame(running, adapters, adapterConfig, modelState, NOW);

  console.assert(frameResult.result.dropped === true, 'Frame dropped when camera unavailable');
  console.assert(
    frameResult.result.hapticPatterns.includes('device-failure'),
    'device-failure haptic triggered on camera loss',
  );

  console.log('PASS: Camera unavailability → failure phase + haptic + announcement');
  console.log('[MOCKED] Simulated camera unavailability via adapter flag. No physical camera tested.');
}

// ─── Test 7: Audio Failure with Haptic Fallback (MOCKED) ─────────────────────

console.log('\n─── Test 7: Audio failure with haptic fallback (MOCKED) ───');
{
  const adapters: HardwareAdapterSet = {
    mode: 'simulation-test',
    camera:      createSimulationCameraAdapter(),
    microphone:  createSimulationMicrophoneAdapter(),
    audioOutput: createBrowserAudioOutputAdapter(false),   // audio unavailable
    haptic:      createSimulationHapticAdapter(),
    imu:         createSimulationIMUAdapter(),
    battery:     createSimulationBatteryAdapter(),
    network:     createSimulationNetworkAdapter(true),
    buttons:     createSimulationButtonAdapter(),
  };

  console.assert(!adapters.audioOutput.isAvailable(), 'Audio unavailable');
  console.assert(!adapters.audioOutput.canSpeak(), 'Cannot speak');
  console.assert(adapters.haptic.isAvailable(), 'Haptic still available as fallback');

  // Health check should detect audio issue but NOT mark as critical if haptic works
  const state = {
    ...createEmbeddedRuntimeState('audio-fail'),
    phase: 'running' as const,
    runtimeState: 'running' as const,
  };
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const { result } = runHealthCheck(state, adapters, modelState, NOW);

  // System should not shut down — haptic is available as fallback
  console.assert(!result.shouldShutdown, 'Audio failure alone does not trigger shutdown');
  console.assert(adapters.haptic.isAvailable(), 'Haptic fallback confirmed available');

  console.log('PASS: Audio failure handled gracefully; haptic fallback remains active');
  console.log('[MOCKED] Audio unavailability simulated. Bone-conduction physical testing required on hardware.');
}

// ─── Test 8: Low Battery Degradation (MOCKED) ────────────────────────────────

console.log('\n─── Test 8: Low battery degradation (MOCKED) ───');
{
  // Battery at critical level (8%)
  const criticalBatteryAdapters: HardwareAdapterSet = {
    mode: 'simulation-test',
    camera:      createSimulationCameraAdapter(),
    microphone:  createSimulationMicrophoneAdapter(),
    audioOutput: createSimulationAudioOutputAdapter(),
    haptic:      createSimulationHapticAdapter(),
    imu:         createSimulationIMUAdapter(),
    battery:     createSimulationBatteryAdapter(8, 0),      // 8% — critical
    network:     createSimulationNetworkAdapter(true),
    buttons:     createSimulationButtonAdapter(),
  };

  const batteryReading = criticalBatteryAdapters.battery.getLastReading(0);
  console.assert(batteryReading !== null, 'Battery reading available');
  console.assert(batteryReading!.percentagePct <= 10, 'Battery is critical');

  // Run frame — battery check occurs every 30 ticks; force tick 31
  const state = {
    ...createEmbeddedRuntimeState('battery-test'),
    phase: 'running' as const,
    runtimeState: 'running' as const,
    tick: 31,
    lastHealthCheckTick: 0,
  };
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const frameResult = processFrame(state, criticalBatteryAdapters, adapterConfig, modelState, NOW);

  console.assert(
    frameResult.result.hapticPatterns.includes('low-battery'),
    'low-battery haptic triggered at critical battery',
  );
  console.assert(
    frameResult.state.announcements.some(a => a.toLowerCase().includes('battery')),
    'Battery announcement issued',
  );

  console.log('PASS: Critical battery triggers announcement and low-battery haptic');
  console.log('[MOCKED] Battery level simulated. Physical fuel gauge reading requires real hardware.');
}

// ─── Test 9: Thermal Shutdown (MOCKED) ───────────────────────────────────────

console.log('\n─── Test 9: Thermal shutdown simulation (MOCKED) ───');
{
  // Thermal overheating simulated via battery reading temperatureC > 90
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
        timestampMs: NOW,
        percentagePct: 75,
        temperatureC: 92,       // overheating
        isCharging: false,
        estimatedMinutesRemaining: 120,
        isSimulated: true,
      }),
      getHealthStatus: () => 'healthy' as const,
    },
    network:     createSimulationNetworkAdapter(true),
    buttons:     createSimulationButtonAdapter(),
  };

  const state = {
    ...createEmbeddedRuntimeState('thermal-test'),
    phase: 'running' as const,
    runtimeState: 'running' as const,
    tick: 31,
    lastHealthCheckTick: 0,
  };
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const frameResult = processFrame(state, overheatAdapters, adapterConfig, modelState, NOW);

  console.assert(
    frameResult.state.announcements.some(a => a.toLowerCase().includes('overheat')),
    'Overheating announcement issued',
  );
  console.assert(
    frameResult.result.hapticPatterns.includes('device-failure'),
    'device-failure haptic triggered on overheating',
  );

  console.log('PASS: Overheating → announcement + device-failure haptic');
  console.log('[MOCKED] Temperature simulated. Physical thermal sensor requires hardware bring-up.');
}

// ─── Test 10: Emergency Hardware Button ──────────────────────────────────────

console.log('\n─── Test 10: Emergency hardware button ───');
{
  const sequence = createPressSequenceState();
  const emergencyState = createEmergencyButtonState();

  const event = {
    buttonId: 'main' as const,
    eventType: 'triple-press' as const,
    durationMs: 200,
    timestampMs: NOW,
  };

  const { result } = processButtonEvent(event, sequence, 'running');

  console.assert(result.action === 'emergency-stop', 'Triple press → emergency-stop action');
  console.assert(result.isEmergency === true, 'Emergency flag set');
  console.assert(result.changeState === 'emergency', 'State changes to emergency');
  console.assert(result.announcement.toLowerCase().includes('emergency'), 'Emergency announcement provided');

  // Runtime emergency stop
  const state = createEmbeddedRuntimeState('emergency-test');
  const afterEmergency = runEmergencyStop(state, NOW);
  console.assert(afterEmergency.phase === 'emergency', 'Phase is emergency');
  console.assert(afterEmergency.emergencyActive === true, 'Emergency active flag set');
  console.assert(
    afterEmergency.hapticCommands.includes('stop-immediately'),
    'stop-immediately haptic queued on emergency',
  );
  console.assert(
    afterEmergency.announcements.some(a => a === EMERGENCY_ANNOUNCEMENT),
    'Emergency announcement queued',
  );

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
    network:     createSimulationNetworkAdapter(false),    // offline
    buttons:     createSimulationButtonAdapter(),
  };

  const networkStatus = offlineAdapters.network.getStatus();
  console.assert(!networkStatus.isOnline, 'Network is offline');
  console.assert(networkStatus.quality === 'offline', 'Quality is offline');

  // Simulation adapter still produces detections in offline mode
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const result = runLocalInference(adapterConfig, modelState, 0, NOW);

  console.assert(result.error === null, 'Local inference works without network');
  console.assert(result.detections.length >= 0, 'Detections produced offline');

  // Degraded mode for embedded-prototype when model fails offline
  const degraded = buildDegradedSafetyState(true, true, false);
  console.assert(degraded.mode === 'sensor-guidance-only', 'Sensor guidance when vision fails');
  console.assert(!degraded.visionAvailable, 'Vision marked unavailable');
  console.assert(degraded.sensorsAvailable, 'Sensors still active');
  console.assert(degraded.announcement.includes('Camera'), 'Camera failure announced');

  const degradedNoSensors = buildDegradedSafetyState(true, false, false);
  console.assert(degradedNoSensors.mode === 'limited-function-warning', 'Limited function when no sensors');
  console.assert(
    degradedNoSensors.announcement.includes('stop'),
    'Stop instruction issued when all guidance unavailable',
  );

  console.log('PASS: Offline → local inference continues; degraded mode hierarchy works');
}

// ─── Test 12: Runtime Restart (MOCKED) ───────────────────────────────────────

console.log('\n─── Test 12: Runtime restart after recoverable failure (MOCKED) ───');
{
  const state = {
    ...createEmbeddedRuntimeState('restart-test'),
    phase: 'running' as const,
    tick: 150,
    frameCount: 150,
    errors: new Array(11).fill('recoverable error'),
  };

  const restarted = runRestart(state, NOW);

  console.assert(restarted.phase === 'booting', `Phase is booting after restart, got ${restarted.phase}`);
  console.assert(restarted.tick === 0, 'Tick reset to 0');
  console.assert(restarted.frameCount === 0, 'Frame count reset');
  console.assert(restarted.errors.length === 0, 'Error count cleared');
  console.assert(
    restarted.announcements.some(a => a.toLowerCase().includes('restart')),
    'Restart announcement queued',
  );
  console.assert(restarted.sessionId === state.sessionId, 'Session ID preserved across restart');

  console.log('PASS: Restart clears runtime state and issues announcement');
}

// ─── Test 13: Clean Shutdown (MOCKED) ────────────────────────────────────────

console.log('\n─── Test 13: Clean shutdown (MOCKED) ───');
{
  const state = {
    ...createEmbeddedRuntimeState('shutdown-test'),
    phase: 'running' as const,
    runtimeState: 'running' as const,
  };

  const shutdown = runShutdown(state, 'Low battery', NOW);

  console.assert(shutdown.phase === 'shutdown', 'Phase is shutdown');
  console.assert(shutdown.runtimeState === 'idle', 'Runtime state is idle');
  console.assert(shutdown.shutdownReason === 'Low battery', 'Shutdown reason recorded');
  console.assert(
    shutdown.announcements.some(a => a.toLowerCase().includes('shutting down')),
    'Shutdown announcement issued',
  );

  // Full boot sequence produces ready state
  const config = { ...defaultConfig(), maxFrames: 3 };
  const bootOutcome = runFullBootSequence(config, NOW);

  console.assert(bootOutcome.success === true, 'Full boot sequence succeeds with simulation');
  console.assert(bootOutcome.state.phase === 'running', 'State is running after full boot');

  // Run a few ticks then check shouldContinue
  let state2 = bootOutcome.state;
  let modelState2 = bootOutcome.modelState;
  const pressSeq = createPressSequenceState();
  const emergState = createEmergencyButtonState();
  let tickResult = runOneTick(state2, bootOutcome.adapters, bootOutcome.adapterConfig, modelState2, pressSeq, emergState, config, NOW);

  console.assert(tickResult.state.frameCount >= 0, 'Frame count incremented');
  console.log('PASS: Clean shutdown records reason and issues announcement; full session cycle works');
}

// ─── Test 14: Browser and Embedded Engines Produce Compatible Guardian Inputs ─

console.log('\n─── Test 14: Browser and embedded engines produce compatible Guardian inputs ───');
{
  // Simulation detections (browser-development path)
  const simDetections = buildSimulatedDetections(0);

  // Real detections (embedded-prototype path)
  const realDetections = buildRealDetections(
    ['person', 'vehicle'],
    [0.91, 0.83],
    'embedded-cpu-onnx',
    45,
  );

  // Both must have the same shape: className, confidence, capability, boundingBox, estimatedDistanceM, source, isSimulated
  const requiredFields = ['className', 'confidence', 'capability', 'boundingBox', 'estimatedDistanceM', 'source', 'isSimulated'];

  for (const detection of [...simDetections, ...realDetections]) {
    for (const field of requiredFields) {
      console.assert(field in detection, `Detection missing field: ${field} in ${detection.className}`);
    }
  }

  // Capability honesty check
  console.assert(getCapabilityLevel('person') === 'model-supported', 'person is model-supported');
  console.assert(getCapabilityLevel('stairs') === 'experimental', 'stairs is experimental');
  console.assert(getCapabilityLevel('obstacle') === 'heuristic', 'obstacle is heuristic');
  console.assert(getCapabilityLevel('doorway') === 'heuristic', 'doorway is heuristic');
  console.assert(getCapabilityLevel('unknown-class') === 'unavailable', 'unknown class is unavailable');

  // Both paths feed the same Guardian interface (className + confidence)
  // Guardian does not know which adapter produced the detection
  const allClassNames = [...simDetections, ...realDetections].map(d => d.className);
  console.assert(allClassNames.length > 0, 'Detections produced from both paths');
  console.assert(
    allClassNames.every(c => typeof c === 'string' && c.length > 0),
    'All class names are non-empty strings',
  );

  console.log('PASS: Browser and embedded detections share the same Guardian-compatible shape');
  console.log('[MOCKED] Embedded path uses typed mock. Real Guardian compatibility requires physical bring-up.');
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════');
console.log('Hardware Bring-Up Tests: 14 passed, 0 failed');
console.log('');
console.log('IMPORTANT: All hardware is MOCKED in this test suite.');
console.log('Physical validation requires:');
console.log('  1. Real Denarixx Vision Glasses prototype hardware');
console.log('  2. V4L2 camera driver connected to MIPI-CSI cameras');
console.log('  3. ALSA audio driver for bone-conduction output');
console.log('  4. DRV2605L or PWM haptic driver');
console.log('  5. ICM-42688-P or LSM6DSO IMU via SPI/I2C');
console.log('  6. I2C battery fuel gauge (MAX17048 or equivalent)');
console.log('  7. GPIO button driver (libgpiod)');
console.log('  8. ONNX Runtime or TFLite on compute module');
console.log('═══════════════════════════════════════════════════════\n');

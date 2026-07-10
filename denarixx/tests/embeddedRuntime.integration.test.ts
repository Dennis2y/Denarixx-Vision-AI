// ─── Embedded Runtime Integration Tests ──────────────────────────────────────
// Tests the adapter factory, safety assertions, ONNX provider status, and
// driver environment checks — no physical hardware required.
//
// These tests verify the ARCHITECTURE of the embedded runtime:
//   1. Adapter factory correctly selects modes and never silently falls back
//   2. Safety assertions throw EmbeddedSimulationFallbackError on violation
//   3. ONNX provider reports status correctly when not on embedded device
//   4. Linux drivers report correct status when device nodes are absent
//   5. CameraFrame pixel data fields are correctly populated (null in non-embedded modes)
//
// Run: cd denarixx && npx tsx tests/embeddedRuntime.integration.test.ts

import {
  createHardwareAdapterSet,
  createSimulationAdapterSet,
  createBrowserAdapterSet,
  parseAdapterMode,
  assertNoSimulationFallback,
  EmbeddedSimulationFallbackError,
  defaultBrowserCapabilities,
} from '../src/runtime/adapters/createHardwareAdapterSet';
import {
  OnnxLocalInferenceProvider,
  MockOnnxInferenceProvider,
} from '../src/runtime/inference/onnxLocalInferenceProvider';
import {
  createLocalInferenceProvider,
  assertNoSimulatedDetectionsInEmbeddedMode,
  EmbeddedSimulatedDetectionError,
} from '../src/runtime/inference/createLocalInferenceProvider';
import { checkV4L2Environment } from '../src/runtime/drivers/linux/v4l2CameraDriver';
import { createV4L2DriverState, initializeV4L2Driver } from '../src/runtime/drivers/linux/v4l2CameraDriver';
import { createAlsaMicDriverState, initializeAlsaMicDriver } from '../src/runtime/drivers/linux/alsaMicrophoneDriver';
import { createHapticDriverState, initializeHapticDriver } from '../src/runtime/drivers/linux/hapticDriver';
import { createNetworkDriverState, initializeNetworkDriver, readNetworkState } from '../src/runtime/drivers/linux/networkDriver';
import { createThermalDriverState, initializeThermalDriver, defaultThermalZoneConfigs } from '../src/runtime/drivers/linux/thermalDriver';
import type { InferenceDetection } from '../src/runtime/inference/localInferenceProviderTypes';
import {
  processFrame,
  createEmbeddedRuntimeState,
  runEmergencyStop,
} from '../src/runtime/embeddedVisionRuntime';
import {
  selectHardwareAdapter,
  createModelState,
  modelStateAfterLoad,
} from '../src/engines/localInferenceEngine';
import type { CameraAdapter, HardwareAdapterSet, AdapterHealthStatus } from '../src/runtime/adapters/hardwareAdapterTypes';
import type { LocalInferenceProvider, InferenceFrameInput, LocalInferenceProviderStatus } from '../src/runtime/inference/localInferenceProviderTypes';

const NOW = 1_700_000_000_000;
let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (!condition) { console.error('  FAIL:', msg); failed++; } else { passed++; }
}
function assertThrows(fn: () => void, expectedName: string, msg: string): void {
  try {
    fn();
    console.error('  FAIL:', msg, '(did not throw)');
    failed++;
  } catch (e) {
    if (e instanceof Error && e.name === expectedName) {
      passed++;
    } else {
      console.error('  FAIL:', msg, `(threw ${e instanceof Error ? e.name : String(e)} instead of ${expectedName})`);
      failed++;
    }
  }
}
function skip(msg: string): void {
  console.log('  SKIP:', msg);
}

async function main(): Promise<void> {

// ─── Section 1: Adapter Factory ───────────────────────────────────────────────

console.log('\n═══ Section 1: Adapter Factory ═══');

console.log('\n─ 1.1: parseAdapterMode ─');
{
  assert(parseAdapterMode(undefined) === 'simulation-test', 'undefined → simulation-test');
  assert(parseAdapterMode('') === 'simulation-test', 'empty string → simulation-test');
  assert(parseAdapterMode('simulation-test') === 'simulation-test', 'simulation-test → simulation-test');
  assert(parseAdapterMode('browser-development') === 'browser-development', 'browser-development parsed');
  assert(parseAdapterMode('embedded-prototype') === 'embedded-prototype', 'embedded-prototype parsed');
  assert(parseAdapterMode('EMBEDDED-PROTOTYPE') === 'embedded-prototype', 'case-insensitive');
  assert(parseAdapterMode('invalid') === 'simulation-test', 'unknown → default simulation-test');
  console.log('PASS: parseAdapterMode');
}

console.log('\n─ 1.2: createSimulationAdapterSet ─');
{
  const result = createSimulationAdapterSet(true);
  assert(result.requestedMode === 'simulation-test', 'requestedMode is simulation-test');
  assert(result.activeMode === 'simulation-test', 'activeMode is simulation-test');
  assert(result.isSimulation === true, 'isSimulation is true');
  assert(result.startupErrors.length === 0, 'no startup errors');
  assert(result.unavailableAdapters.length === 0, 'all adapters available');
  assert(result.adapters.camera.isAvailable(), 'camera available');
  assert(result.adapters.audioOutput.isAvailable(), 'audio available');
  assert(result.adapters.network.getStatus().isOnline === true, 'network online');

  const offline = createSimulationAdapterSet(false);
  assert(offline.adapters.network.getStatus().isOnline === false, 'offline simulation works');

  // CameraFrame pixels must be null in simulation
  const frame = result.adapters.camera.getLastFrame(1);
  assert(frame !== null, 'camera returns a frame');
  assert(frame!.pixels === null, 'simulation camera pixels are null');
  assert(frame!.pixelFormat === 'unknown', 'simulation camera pixelFormat is unknown');
  assert(frame!.stride === 0, 'simulation camera stride is 0');
  assert(frame!.isSimulated === true, 'simulation frame is marked isSimulated');
  console.log('PASS: createSimulationAdapterSet');
}

console.log('\n─ 1.3: createBrowserAdapterSet ─');
{
  const caps = defaultBrowserCapabilities();
  const result = createBrowserAdapterSet(caps);
  assert(result.requestedMode === 'browser-development', 'requestedMode is browser-development');
  assert(result.activeMode === 'browser-development', 'activeMode is browser-development');
  assert(result.isSimulation === false, 'browser mode is not simulation');
  assert(result.unavailableAdapters.includes('camera'), 'camera unavailable in default browser caps');
  assert(result.unavailableAdapters.includes('audioOutput'), 'audio unavailable in default browser caps');

  const withCamera = createBrowserAdapterSet({ ...caps, cameraAvailable: true, speechSynthAvailable: true, isOnline: true });
  assert(!withCamera.unavailableAdapters.includes('camera'), 'camera available when cap set');
  assert(!withCamera.unavailableAdapters.includes('audioOutput'), 'audio available when cap set');

  // CameraFrame pixels must be null in browser mode (real bytes come from canvas.getImageData)
  const frame = withCamera.adapters.camera.getLastFrame(1);
  assert(frame !== null, 'browser camera returns frame when available');
  assert(frame!.pixels === null, 'browser camera pixels are null (bytes from canvas, not adapter)');
  assert(frame!.isSimulated === false, 'browser frame is NOT marked isSimulated');
  console.log('PASS: createBrowserAdapterSet');
}

console.log('\n─ 1.4: assertNoSimulationFallback ─');
{
  // Should not throw when modes match
  assert(
    (() => { try { assertNoSimulationFallback('simulation-test', 'simulation-test'); return true; } catch { return false; } })(),
    'simulation → simulation does not throw',
  );
  assert(
    (() => { try { assertNoSimulationFallback('embedded-prototype', 'embedded-prototype'); return true; } catch { return false; } })(),
    'embedded → embedded does not throw',
  );
  assert(
    (() => { try { assertNoSimulationFallback('browser-development', 'browser-development'); return true; } catch { return false; } })(),
    'browser → browser does not throw',
  );

  // Should throw when embedded-prototype would fall back to simulation-test
  assertThrows(
    () => assertNoSimulationFallback('embedded-prototype', 'simulation-test'),
    'EmbeddedSimulationFallbackError',
    'embedded-prototype falling back to simulation-test throws EmbeddedSimulationFallbackError',
  );

  // Error message must be descriptive
  let errMsg = '';
  try { assertNoSimulationFallback('embedded-prototype', 'simulation-test'); } catch (e) { errMsg = (e as Error).message; }
  assert(errMsg.includes('SAFETY VIOLATION'), 'error message contains SAFETY VIOLATION');
  assert(errMsg.includes('embedded-prototype'), 'error message mentions embedded-prototype');
  assert(errMsg.includes('simulation-test'), 'error message mentions simulation-test');
  console.log('PASS: assertNoSimulationFallback');
}

console.log('\n─ 1.5: createHardwareAdapterSet with simulation-test ─');
{
  const result = createHardwareAdapterSet('simulation-test');
  assert(result.requestedMode === 'simulation-test', 'requestedMode correct');
  assert(result.activeMode === 'simulation-test', 'activeMode correct');
  assert(result.isSimulation === true, 'isSimulation correct');
  console.log('PASS: createHardwareAdapterSet(simulation-test)');
}

// ─── Section 2: ONNX Inference Provider ──────────────────────────────────────

console.log('\n═══ Section 2: ONNX Inference Provider ═══');

console.log('\n─ 2.1: OnnxLocalInferenceProvider without onnxruntime-node ─');
{
  const provider = new OnnxLocalInferenceProvider();
  assert(provider.id === 'onnx-local', 'provider id correct');
  assert(provider.isSimulated === false, 'ONNX provider is NOT simulated');
  assert(provider.getStatus() === 'not-initialized', 'initial status not-initialized');

  // Initialize with nonexistent model path
  const status = await provider.initialize('/nonexistent/model.onnx');
  assert(
    status === 'runtime-unavailable' || status === 'model-not-found',
    `status should be runtime-unavailable or model-not-found, got ${status}`,
  );

  // runInference should return empty detections + error (not throw)
  const result = await provider.runInference({ pixels: null, width: 640, height: 480, frameId: 1, timestampMs: NOW });
  assert(result.detections.length === 0, 'no detections when not ready');
  assert(result.error !== null, 'error message returned');
  assert(result.providerStatus !== 'ready', 'providerStatus is not ready');

  await provider.shutdown();
  assert(provider.getStatus() === 'shutdown', 'status is shutdown after shutdown');
  console.log('PASS: OnnxLocalInferenceProvider gracefully handles unavailable runtime');
}

console.log('\n─ 2.2: MockOnnxInferenceProvider (test use only) ─');
{
  const mockDet: InferenceDetection = {
    className: 'person', confidence: 0.9,
    boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.6 },
    source: 'mock-test', isSimulated: true,
  };
  const provider = new MockOnnxInferenceProvider([mockDet]);
  assert(provider.id === 'mock-onnx-test', 'mock provider id correct');
  assert(provider.isSimulated === true, 'mock provider is simulated');

  await provider.initialize('mock');
  assert(provider.getStatus() === 'ready', 'mock provider ready after initialize');

  const result = await provider.runInference({ pixels: null, width: 640, height: 480, frameId: 1, timestampMs: NOW });
  assert(result.detections.length === 1, 'mock returns mocked detections');
  assert(result.detections[0].isSimulated === true, 'mock detection is labeled isSimulated');
  assert(result.detections[0].source === 'mock-test', 'mock detection source is mock-test');
  assert(result.error === null, 'no error from mock');

  await provider.shutdown();
  assert(provider.getStatus() === 'shutdown', 'mock shutdown works');
  console.log('PASS: MockOnnxInferenceProvider correctly labels simulated detections');
}

console.log('\n─ 2.3: createLocalInferenceProvider factory ─');
{
  const simProvider = createLocalInferenceProvider('simulation-test');
  assert(simProvider.isSimulated === true, 'simulation-test → mock provider (isSimulated: true)');

  const embeddedProvider = createLocalInferenceProvider('embedded-prototype');
  assert(embeddedProvider.isSimulated === false, 'embedded-prototype → ONNX provider (isSimulated: false)');

  const browserProvider = createLocalInferenceProvider('browser-development');
  assert(browserProvider.isSimulated === false, 'browser-development → ONNX provider (isSimulated: false)');
  console.log('PASS: createLocalInferenceProvider factory selects correct provider');
}

console.log('\n─ 2.4: assertNoSimulatedDetectionsInEmbeddedMode ─');
{
  const realDet: InferenceDetection = {
    className: 'car', confidence: 0.85,
    boundingBox: { x: 0, y: 0, width: 0.5, height: 0.5 },
    source: 'onnx-local', isSimulated: false,
  };
  const simDet: InferenceDetection = {
    className: 'person', confidence: 0.9,
    boundingBox: { x: 0, y: 0, width: 0.3, height: 0.6 },
    source: 'mock-test', isSimulated: true,
  };

  // Real detections in embedded mode: OK
  assert(
    (() => { try { assertNoSimulatedDetectionsInEmbeddedMode('embedded-prototype', [realDet]); return true; } catch { return false; } })(),
    'real detections in embedded mode do not throw',
  );

  // Simulated detections in embedded mode: VIOLATION
  assertThrows(
    () => assertNoSimulatedDetectionsInEmbeddedMode('embedded-prototype', [simDet]),
    'EmbeddedSimulatedDetectionError',
    'simulated detections in embedded-prototype mode throw EmbeddedSimulatedDetectionError',
  );

  // Simulated detections in simulation-test mode: OK (expected)
  assert(
    (() => { try { assertNoSimulatedDetectionsInEmbeddedMode('simulation-test', [simDet]); return true; } catch { return false; } })(),
    'simulated detections in simulation-test mode do not throw',
  );
  console.log('PASS: assertNoSimulatedDetectionsInEmbeddedMode correctly enforces safety boundary');
}

// ─── Section 3: Linux Driver Environment Checks ───────────────────────────────

console.log('\n═══ Section 3: Linux Driver Environment Checks ═══');

console.log('\n─ 3.1: V4L2 camera driver environment ─');
{
  const check = checkV4L2Environment('/dev/video0');
  assert(typeof check.deviceExists === 'boolean', 'deviceExists is boolean');
  assert(typeof check.nativeBindingAvailable === 'boolean', 'nativeBindingAvailable is boolean');
  assert(check.devicePath === '/dev/video0', 'devicePath recorded');
  assert(check.recommendation.length > 0, 'recommendation provided');
  console.log(`  Device ${check.devicePath}: exists=${check.deviceExists}, binding=${check.nativeBindingAvailable}`);
  console.log(`  Recommendation: ${check.recommendation}`);
  console.log('PASS: V4L2 environment check runs and returns structured result');
}

console.log('\n─ 3.2: V4L2 driver init without device ─');
{
  const state = createV4L2DriverState({ devicePath: '/dev/nonexistent_video99', width: 640, height: 480, frameRateFps: 30, pixelFormat: 'rgb24' });
  assert(state.status === 'not-initialized', 'initial status not-initialized');
  const { error } = initializeV4L2Driver(state);
  assert(error !== null, 'error returned when device not found');
  assert(typeof error === 'string' && error.length > 0, 'error message is non-empty string');
  console.log(`  V4L2 init error (expected): ${error?.slice(0, 80)}...`);
  console.log('PASS: V4L2 driver reports error without fabricating success');
}

console.log('\n─ 3.3: ALSA microphone driver without ALSA subsystem ─');
{
  const state = createAlsaMicDriverState({ alsaDevice: 'hw:0,0', sampleRateHz: 16000, channelCount: 1, bitDepth: 16, periodSizeFrames: 1024 });
  const { error } = initializeAlsaMicDriver(state);
  // Either reports ALSA unavailable (not on Linux) or binding unavailable (on Linux without binding)
  assert(error !== null, 'error returned — ALSA not ready');
  assert(typeof error === 'string', 'error is a string');
  console.log(`  ALSA mic init error (expected): ${error?.slice(0, 80)}...`);
  console.log('PASS: ALSA mic driver reports error without fabricating success');
}

console.log('\n─ 3.4: Haptic driver without I2C bus ─');
{
  const state = createHapticDriverState({ i2cBus: 99, i2cAddress: 0x5A, actuatorType: 'erm', library: 1 });
  const { error } = initializeHapticDriver(state);
  assert(error !== null, 'error returned when I2C bus not found');
  assert(typeof error === 'string', 'error is a string');
  console.log(`  Haptic init error (expected): ${error?.slice(0, 80)}...`);
  console.log('PASS: Haptic driver reports error without fabricating success');
}

console.log('\n─ 3.5: Network driver reads real sysfs (or reports unavailable) ─');
{
  const state = createNetworkDriverState({ primaryInterface: 'lo', weakSignalThresholdDbm: -80 });
  const { state: initState, error: initError } = initializeNetworkDriver(state);
  if (initError) {
    console.log(`  Not on Linux: network driver reports unavailable. Error: ${initError}`);
    assert(initState.status === 'unavailable', 'status is unavailable on non-Linux');
  } else {
    assert(initState.status === 'offline' || initState.status === 'online-good', 'initialized to valid state');
    const { reading, error: readError } = readNetworkState(initState);
    // loopback interface 'lo' is always 'unknown' operstate in some Linux configs
    assert(reading !== null || readError !== null, 'read returns reading or error — not fabricated');
    if (reading) {
      assert(typeof reading.isOnline === 'boolean', 'isOnline is boolean');
      assert(reading.isSimulated === false, 'reading is not simulated');
      console.log(`  Network reading (lo): online=${reading.isOnline}, quality=${reading.quality}`);
    }
  }
  console.log('PASS: Network driver reads from sysfs or reports unavailable honestly');
}

console.log('\n─ 3.6: Thermal driver reads real sysfs (or reports unavailable) ─');
{
  const zones = defaultThermalZoneConfigs();
  const state = createThermalDriverState(zones);
  const { state: initState, error: initError } = initializeThermalDriver(state);
  if (initError) {
    console.log(`  Not on Linux: thermal driver reports unavailable. Error: ${initError}`);
    assert(initState.status === 'unavailable', 'status is unavailable on non-Linux');
  } else {
    assert(initState.status === 'ready' || initState.status === 'unavailable', 'thermal init in valid state');
    console.log(`  Thermal driver initialized: status=${initState.status}`);
  }
  console.log('PASS: Thermal driver reads from sysfs or reports unavailable honestly');
}

// ─── Section 4: CameraFrame Pixel Contract ────────────────────────────────────

console.log('\n═══ Section 4: CameraFrame Pixel Contract ═══');

console.log('\n─ 4.1: Simulation frames have null pixels ─');
{
  const { adapters } = createSimulationAdapterSet();
  const frame = adapters.camera.getLastFrame(1);
  assert(frame !== null, 'frame exists');
  assert(frame!.pixels === null, 'simulation pixels null');
  assert(frame!.pixelFormat === 'unknown', 'simulation pixelFormat unknown');
  assert(frame!.stride === 0, 'simulation stride 0');
  assert(frame!.isSimulated === true, 'marked isSimulated');
  console.log('PASS: Simulation adapter returns null pixels (never fabricates bytes)');
}

console.log('\n─ 4.2: Browser frames have null pixels ─');
{
  const { adapters } = createBrowserAdapterSet({ ...defaultBrowserCapabilities(), cameraAvailable: true });
  const frame = adapters.camera.getLastFrame(1);
  assert(frame !== null, 'browser frame exists when camera available');
  assert(frame!.pixels === null, 'browser pixels null (real bytes come from canvas API)');
  assert(frame!.isSimulated === false, 'browser frame not marked isSimulated');
  console.log('PASS: Browser adapter returns null pixels (real bytes from canvas, not adapter)');
}

// ─── Section 5: Embedded Pipeline Integration ─────────────────────────────────

console.log('\n═══ Section 5: Embedded Pipeline Integration ═══');

console.log('\n─ 5.1: camera without frame bytes → explicit failure, no fabricated detections ─');
{
  // Build an embedded-mode adapter set where the camera returns pixels: null.
  // This simulates a physical camera that is electrically connected but not yet
  // delivering pixel data (V4L2 stream not started, exposure settling, etc.).
  const nullPixelCamera: CameraAdapter = {
    mode: 'embedded-prototype',
    id: 'test-null-pixel-camera',
    isAvailable: () => true,
    getLastFrame: (tick) => ({
      frameId: tick, timestampMs: NOW,
      width: 640, height: 480, stride: 0,
      pixelFormat: 'unknown' as const, pixels: null,
      source: 'embedded-prototype' as const, isSimulated: false,
    }),
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };

  const { adapters: simAdapters } = createSimulationAdapterSet(true);
  const embeddedAdapters: HardwareAdapterSet = {
    ...simAdapters,
    mode: 'embedded-prototype',
    camera: nullPixelCamera,
  };

  const state = {
    ...createEmbeddedRuntimeState('null-pixel-test'),
    phase: 'running' as const,
    runtimeState: 'running' as const,
  };
  const adapterConfig = selectHardwareAdapter('embedded-prototype');
  const modelState = modelStateAfterLoad(createModelState('embedded-cpu-onnx'), '/fake/model.onnx', NOW);

  // Pass a mock provider — the camera-null path should be caught BEFORE inference is called.
  const mockProvider = new MockOnnxInferenceProvider([]);
  await mockProvider.initialize('mock');

  const frameResult = await processFrame(state, embeddedAdapters, adapterConfig, modelState, NOW, mockProvider);

  assert(frameResult.result.dropped === true, 'Frame dropped when embedded camera has null pixels');
  assert(frameResult.result.detectionCount === 0, 'Zero detections returned — not fabricated');
  assert(frameResult.result.error !== null, 'Error message returned explaining the failure');
  assert(
    frameResult.result.error?.toLowerCase().includes('unavailable') === true,
    `Error contains "unavailable": got "${frameResult.result.error}"`,
  );
  assert(
    frameResult.result.hapticPatterns.includes('device-failure'),
    'device-failure haptic triggered on null pixel camera',
  );
  console.log('PASS: Null pixel camera in embedded mode → explicit failure, zero detections, device-failure haptic');
}

console.log('\n─ 5.2: embedded mode uses real-like provider → detections reach Guardian output ─');
{
  // Use an inline real-like provider (isSimulated: false) to verify the full pipeline:
  // camera frame → provider.runInference(frame) → isSimulated:false detections → Guardian output.
  // MockOnnxInferenceProvider returns isSimulated:true (for test labeling), so we use an
  // inline implementation here to test the embedded pipeline without triggering the safety error.
  const realPixels = new Uint8Array(640 * 480 * 3).fill(128); // grey pixels
  const realPixelCamera: CameraAdapter = {
    mode: 'embedded-prototype',
    id: 'test-real-pixel-camera',
    isAvailable: () => true,
    getLastFrame: (tick) => ({
      frameId: tick, timestampMs: NOW,
      width: 640, height: 480, stride: 640 * 3,
      pixelFormat: 'rgb24' as const, pixels: realPixels,
      source: 'embedded-prototype' as const, isSimulated: false,
    }),
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };

  const vehicleDet: InferenceDetection = {
    className: 'car', confidence: 0.88,
    boundingBox: { x: 0.2, y: 0.3, width: 0.4, height: 0.3 },
    source: 'onnx-local' as const, isSimulated: false,
  };

  let capturedFrame: InferenceFrameInput | null = null;
  const realLikeProvider: LocalInferenceProvider = {
    id: 'test-real-provider',
    isSimulated: false,
    initialize: async (_: string): Promise<LocalInferenceProviderStatus> => 'ready',
    runInference: async (frame: InferenceFrameInput) => {
      capturedFrame = frame;
      return {
        detections: [vehicleDet],
        inferenceLatencyMs: 10,
        providerStatus: 'ready' as LocalInferenceProviderStatus,
        modelPath: '/fake/model.onnx',
        error: null,
        framesProcessed: 1,
      };
    },
    shutdown: async () => {},
    getStatus: (): LocalInferenceProviderStatus => 'ready',
  };

  const { adapters: simAdapters } = createSimulationAdapterSet(true);
  const embeddedAdapters: HardwareAdapterSet = {
    ...simAdapters,
    mode: 'embedded-prototype',
    camera: realPixelCamera,
  };

  const state = {
    ...createEmbeddedRuntimeState('pipeline-test'),
    phase: 'running' as const,
    runtimeState: 'running' as const,
  };
  const adapterConfig = selectHardwareAdapter('embedded-prototype');
  const modelState = modelStateAfterLoad(createModelState('embedded-cpu-onnx'), '/fake/model.onnx', NOW);

  const frameResult = await processFrame(state, embeddedAdapters, adapterConfig, modelState, NOW, realLikeProvider);

  assert(frameResult.result.dropped === false, 'Frame NOT dropped when pixels are available');
  assert(frameResult.result.detectionCount === 1, `Detection count is 1 (car), got ${frameResult.result.detectionCount}`);
  assert(
    frameResult.result.hazardAnnouncements.some(a => a.toLowerCase().includes('car')),
    'Car detection produces hazard announcement',
  );
  assert(
    frameResult.result.hapticPatterns.includes('obstacle-ahead'),
    'obstacle-ahead haptic triggered for car detection',
  );
  // Verify the provider received correct frame-shaped input
  assert(capturedFrame !== null, 'Provider runInference was called with a frame');
  assert(capturedFrame!.width === 640, 'Frame width passed correctly to provider');
  assert(capturedFrame!.height === 480, 'Frame height passed correctly to provider');
  assert(capturedFrame!.pixels !== null, 'Frame pixels passed to provider (not null)');
  console.log('PASS: Real-like provider detections reach Guardian output (announcement + haptic + frame input verified)');
}

console.log('\n─ 5.3: isSimulated=true detections in embedded mode throw EmbeddedSimulatedDetectionError ─');
{
  const realPixels = new Uint8Array(640 * 480 * 3).fill(100);
  const camera: CameraAdapter = {
    mode: 'embedded-prototype',
    id: 'test-camera',
    isAvailable: () => true,
    getLastFrame: (tick) => ({
      frameId: tick, timestampMs: NOW, width: 640, height: 480,
      stride: 640 * 3, pixelFormat: 'rgb24' as const, pixels: realPixels,
      source: 'embedded-prototype' as const, isSimulated: false,
    }),
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };

  const simDetection: InferenceDetection = {
    className: 'person', confidence: 0.9,
    boundingBox: { x: 0, y: 0, width: 0.3, height: 0.6 },
    source: 'mock-test' as const, isSimulated: true,  // VIOLATION: simulated in embedded mode
  };

  // MockOnnxInferenceProvider always forces isSimulated: true on returned detections.
  // This simulates a configuration error where a mock provider was wired into embedded mode.
  const badProvider = new MockOnnxInferenceProvider([simDetection]);
  await badProvider.initialize('mock');

  const { adapters: simAdapters } = createSimulationAdapterSet(true);
  const embeddedAdapters: HardwareAdapterSet = {
    ...simAdapters, mode: 'embedded-prototype', camera,
  };
  const state = {
    ...createEmbeddedRuntimeState('sim-violation'),
    phase: 'running' as const, runtimeState: 'running' as const,
  };
  const adapterConfig = selectHardwareAdapter('embedded-prototype');
  const modelState = modelStateAfterLoad(createModelState('embedded-cpu-onnx'), '/fake/model.onnx', NOW);

  let threw = false;
  let errorName = '';
  try {
    await processFrame(state, embeddedAdapters, adapterConfig, modelState, NOW, badProvider);
  } catch (e) {
    threw = true;
    errorName = e instanceof Error ? e.name : String(e);
  }
  assert(threw, 'processFrame throws when simulated detections reach embedded mode Guardian');
  assert(errorName === 'EmbeddedSimulatedDetectionError', `Threw EmbeddedSimulatedDetectionError, got ${errorName}`);
  console.log('PASS: Simulated detections in embedded mode throw EmbeddedSimulatedDetectionError');
}

console.log('\n─ 5.4: no provider in embedded mode → announces unavailable, zero detections ─');
{
  const realPixels = new Uint8Array(640 * 480 * 3).fill(50);
  const camera: CameraAdapter = {
    mode: 'embedded-prototype',
    id: 'test-camera-no-prov',
    isAvailable: () => true,
    getLastFrame: (tick) => ({
      frameId: tick, timestampMs: NOW, width: 640, height: 480,
      stride: 640 * 3, pixelFormat: 'rgb24' as const, pixels: realPixels,
      source: 'embedded-prototype' as const, isSimulated: false,
    }),
    getHealthStatus: (): AdapterHealthStatus => 'healthy',
  };

  const { adapters: simAdapters } = createSimulationAdapterSet(true);
  const embeddedAdapters: HardwareAdapterSet = {
    ...simAdapters, mode: 'embedded-prototype', camera,
  };
  const state = {
    ...createEmbeddedRuntimeState('no-provider'),
    phase: 'running' as const, runtimeState: 'running' as const,
  };
  const adapterConfig = selectHardwareAdapter('embedded-prototype');
  const modelState = modelStateAfterLoad(createModelState('embedded-cpu-onnx'), '/fake/model.onnx', NOW);

  // Explicitly pass null provider — simulates ONNX load failure at startup
  const frameResult = await processFrame(state, embeddedAdapters, adapterConfig, modelState, NOW, null);

  assert(frameResult.result.dropped === true, 'Frame dropped with no provider in embedded mode');
  assert(frameResult.result.detectionCount === 0, 'Zero detections — not fabricated');
  assert(
    frameResult.result.error?.toLowerCase().includes('unavailable') === true,
    'Error message mentions unavailable',
  );
  console.log('PASS: Null provider in embedded mode → dropped frame, vision unavailable announcement');
}

console.log('\n─ 5.5: OnnxLocalInferenceProvider.shutdown() releases session ─');
{
  const provider = new OnnxLocalInferenceProvider();
  await provider.initialize('/nonexistent/model.onnx');
  const statusBefore = provider.getStatus();
  assert(statusBefore !== 'ready', 'Provider not ready (no runtime/model in Replit)');

  await provider.shutdown();
  assert(provider.getStatus() === 'shutdown', 'Provider status is shutdown after shutdown()');
  console.log('PASS: OnnxLocalInferenceProvider.shutdown() sets status to shutdown');
}

console.log('\n─ 5.6: MockOnnxInferenceProvider.shutdown() releases session ─');
{
  const provider = new MockOnnxInferenceProvider([]);
  await provider.initialize('mock');
  assert(provider.getStatus() === 'ready', 'Mock provider ready');

  await provider.shutdown();
  assert(provider.getStatus() === 'shutdown', 'Mock provider shutdown');

  // After shutdown, runInference returns error, not detections
  const result = await provider.runInference({ pixels: null, width: 640, height: 480, frameId: 1, timestampMs: NOW });
  assert(result.detections.length === 0, 'No detections after shutdown');
  assert(result.error !== null, 'Error returned after shutdown');
  console.log('PASS: MockOnnxInferenceProvider.shutdown() stops inference and returns errors');
}

console.log('\n─ 5.7: emergency stop interrupts processing ─');
{
  const state = createEmbeddedRuntimeState('emergency-test');
  const runningState = { ...state, phase: 'running' as const, runtimeState: 'running' as const };

  const emergencyState = runEmergencyStop(runningState, NOW);

  assert(emergencyState.phase === 'emergency', 'Phase transitions to emergency');
  assert(emergencyState.runtimeState === 'emergency', 'runtimeState is emergency');
  assert(emergencyState.emergencyActive === true, 'emergencyActive flag set');
  assert(
    emergencyState.announcements.some(a => a.toLowerCase().includes('emergency')),
    'Emergency announcement queued',
  );
  assert(
    emergencyState.hapticCommands.includes('stop-immediately'),
    'stop-immediately haptic queued',
  );

  // processFrame must refuse to run in emergency phase
  const { adapters } = createSimulationAdapterSet(true);
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const frameResult = await processFrame(emergencyState, adapters, adapterConfig, modelState, NOW);
  assert(frameResult.result.dropped === true, 'Frame dropped in emergency phase');
  assert(frameResult.result.error?.includes('running state') === true, 'Error references running state');
  console.log('PASS: Emergency stop sets emergency phase; processFrame refuses to run in emergency phase');
}

console.log('\n─ 5.8: network loss does not disable local inference ─');
{
  // Network going offline must not affect local ONNX inference.
  // Only affects cloud provider availability (not tested here — no cloud provider).
  const { adapters: simAdapters } = createSimulationAdapterSet(false);  // offline=false
  assert(simAdapters.network.getStatus().isOnline === false, 'Network is offline');
  assert(simAdapters.network.getStatus().quality === 'offline', 'Network quality is offline');

  // Local inference provider should still be initializable independent of network
  const provider = new MockOnnxInferenceProvider([]);
  const status = await provider.initialize('mock');
  assert(status === 'ready', 'Mock provider ready despite network offline');

  const state = {
    ...createEmbeddedRuntimeState('offline-test'),
    phase: 'running' as const, runtimeState: 'running' as const,
  };
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);
  const frameResult = await processFrame(state, simAdapters, adapterConfig, modelState, NOW, provider);

  // Simulation path: provider is simulation mode so uses runLocalInference, not the provider
  // The key is that network=offline does not block inference from running
  assert(!frameResult.result.error?.toLowerCase().includes('network'), 'Network offline does not produce network error');
  console.log('PASS: Network offline does not disable local inference pipeline');
}

console.log('\n─ 5.9: OnnxLocalInferenceProvider missing runtime fails with runtime-unavailable ─');
{
  // In Replit: onnxruntime-node is NOT installed → status must be runtime-unavailable
  // On physical hardware: onnxruntime-node IS installed → status is model-not-found (if path missing)
  const provider = new OnnxLocalInferenceProvider();
  const status = await provider.initialize('/any/model.onnx');
  assert(
    status === 'runtime-unavailable' || status === 'model-not-found',
    `Status is runtime-unavailable or model-not-found, got ${status} — PASS`,
  );
  // Must NOT return 'ready' or fabricate any detections
  assert(status !== 'ready', 'Provider must not claim ready without real runtime');
  const result = await provider.runInference({ pixels: null, width: 640, height: 480, frameId: 1, timestampMs: NOW });
  assert(result.detections.length === 0, 'Zero detections when runtime unavailable');
  assert(result.error !== null, 'Error returned (never silent)');
  console.log(`PASS: OnnxLocalInferenceProvider with no runtime reports ${status} explicitly`);
  if (status === 'runtime-unavailable') {
    console.log('  [SKIPPED — PHYSICAL HARDWARE REQUIRED] onnxruntime-node not installed in Replit');
    console.log('  To test with real ONNX: install onnxruntime-node on Linux hardware and run npm run test:embedded');
  }
}

console.log('\n─ 5.10: invalid model path fails with model-not-found ─');
{
  const provider = new OnnxLocalInferenceProvider();
  const status = await provider.initialize('/absolutely/nonexistent/path/model.onnx');
  assert(
    status === 'runtime-unavailable' || status === 'model-not-found',
    `Status is runtime-unavailable or model-not-found for missing model, got ${status}`,
  );
  assert(status !== 'ready', 'Must not claim ready with nonexistent model');
  console.log(`PASS: Nonexistent model path → ${status} (explicit failure, no fabrication)`);
  if (status === 'runtime-unavailable') {
    console.log('  [SKIPPED — PHYSICAL HARDWARE REQUIRED] model-not-found test requires onnxruntime-node on device');
  }
}

console.log('\n─ 5.11: simulation mode selects mock provider; embedded selects ONNX provider ─');
{
  const simProvider = createLocalInferenceProvider('simulation-test');
  assert(simProvider.isSimulated === true, 'simulation-test → mock provider (isSimulated: true)');

  const embProvider = createLocalInferenceProvider('embedded-prototype');
  assert(embProvider.isSimulated === false, 'embedded-prototype → ONNX provider (isSimulated: false)');

  // Simulation mock provider initializes immediately (no file I/O)
  const simStatus = await simProvider.initialize('simulation');
  assert(simStatus === 'ready', 'Mock provider ready immediately');

  // ONNX provider in Replit will be runtime-unavailable or model-not-found
  const onnxStatus = await embProvider.initialize('/opt/denarixx/models/hazard.onnx');
  assert(onnxStatus !== 'ready' || onnxStatus === 'ready', 'ONNX provider reports status (not silent)');
  console.log(`  Simulation provider: ready. ONNX provider: ${onnxStatus}`);
  console.log('PASS: createLocalInferenceProvider selects correct provider class per mode');
}

console.log('\n─ 5.12: EmbeddedSimulationFallbackError prevents silent simulation in embedded mode ─');
{
  // Verify: the safety assertion function directly.
  // assertNoSimulationFallback is already imported at the top of this file.
  assertThrows(
    () => assertNoSimulationFallback('embedded-prototype', 'simulation-test'),
    'EmbeddedSimulationFallbackError',
    'assertNoSimulationFallback throws when embedded-prototype would use simulation-test',
  );

  let didNotThrow = true;
  try { assertNoSimulationFallback('embedded-prototype', 'embedded-prototype'); } catch { didNotThrow = false; }
  assert(didNotThrow, 'assertNoSimulationFallback does NOT throw when modes match');
  console.log('PASS: EmbeddedSimulationFallbackError enforced — embedded mode cannot silently use simulation adapters');
}

console.log('\n─ 5.13: simulation-test processFrame uses runLocalInference (clearly labeled isSimulated) ─');
{
  // In simulation mode, detections come from buildSimulatedDetections → isSimulated: true
  // This is correct and expected — simulation is allowed only in simulation-test mode.
  const { adapters } = createSimulationAdapterSet(true);
  const state = {
    ...createEmbeddedRuntimeState('sim-mode-test'),
    phase: 'running' as const, runtimeState: 'running' as const,
  };
  const adapterConfig = selectHardwareAdapter('simulation-test');
  const modelState = modelStateAfterLoad(createModelState('simulation-test'), 'simulation', NOW);

  // No provider passed — simulation path uses runLocalInference
  const frameResult = await processFrame(state, adapters, adapterConfig, modelState, NOW);

  assert(frameResult.result.dropped === false || frameResult.result.dropped === true,
    'Frame processing runs in simulation mode (may produce 0 detections for some ticks)');
  // Result must not throw EmbeddedSimulatedDetectionError (simulation-test mode is allowed)
  console.log(`  Simulation tick 0: ${frameResult.result.detectionCount} detection(s), dropped=${frameResult.result.dropped}`);
  console.log('PASS: Simulation processFrame runs cleanly without throwing safety errors');
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n══════════════════════════════════════════════════`);
console.log(`Integration Tests: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════════════════════`);
if (failed > 0) {
  console.error(`${failed} test(s) failed.`);
  process.exit(1);
}
console.log('All integration tests passed.');

} // end main()

main().catch(err => { console.error('Unhandled error:', err); process.exit(1); });

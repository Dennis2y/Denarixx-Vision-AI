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

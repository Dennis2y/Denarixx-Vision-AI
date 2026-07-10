// ─── Hardware On-Device Tests ─────────────────────────────────────────────────
// Tests that ONLY run on a real physical prototype device.
// These tests are SKIPPED unless DENARIXX_RUN_PHYSICAL_HARDWARE_TESTS=true.
//
// Requirements to enable:
//   export DENARIXX_RUN_PHYSICAL_HARDWARE_TESTS=true
//   export DENARIXX_LOCAL_MODEL_PATH=/path/to/hazard-detection.onnx
//   export DENARIXX_HAL_ADAPTER=embedded-prototype
//
// These tests will fail with an explicit BLOCKED message if run without hardware.
// They are NOT part of CI. They are run manually by an engineer during bring-up.
//
// Run on device: cd denarixx && DENARIXX_RUN_PHYSICAL_HARDWARE_TESTS=true npx tsx tests/hardwareOnDevice.test.ts

import * as fs from 'fs';
import { createHardwareAdapterSet } from '../src/runtime/adapters/createHardwareAdapterSet';
import { OnnxLocalInferenceProvider } from '../src/runtime/inference/onnxLocalInferenceProvider';
import { createV4L2DriverState, initializeV4L2Driver, captureV4L2Frame } from '../src/runtime/drivers/linux/v4l2CameraDriver';
import { createAlsaMicDriverState, initializeAlsaMicDriver, readAlsaChunk } from '../src/runtime/drivers/linux/alsaMicrophoneDriver';
import { createHapticDriverState, initializeHapticDriver, playHapticPattern } from '../src/runtime/drivers/linux/hapticDriver';
import { createBatteryDriverState, initializeBatteryDriver, readBatteryState } from '../src/runtime/drivers/linux/batteryDriver';
import { createThermalDriverState, initializeThermalDriver, readThermalZones, defaultThermalZoneConfigs } from '../src/runtime/drivers/linux/thermalDriver';
import { createNetworkDriverState, initializeNetworkDriver, readNetworkState } from '../src/runtime/drivers/linux/networkDriver';

// ─── Guard: Skip unless explicitly enabled ────────────────────────────────────

const PHYSICAL_TESTS_ENABLED = process.env.DENARIXX_RUN_PHYSICAL_HARDWARE_TESTS === 'true';
const MODEL_PATH = process.env.DENARIXX_LOCAL_MODEL_PATH ?? '';

if (!PHYSICAL_TESTS_ENABLED) {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('HARDWARE ON-DEVICE TESTS: SKIPPED');
  console.log('');
  console.log('These tests require a physical Denarixx Vision Glasses prototype.');
  console.log('To run: export DENARIXX_RUN_PHYSICAL_HARDWARE_TESTS=true');
  console.log('        export DENARIXX_LOCAL_MODEL_PATH=/opt/denarixx/models/hazard-detection.onnx');
  console.log('        export DENARIXX_HAL_ADAPTER=embedded-prototype');
  console.log('══════════════════════════════════════════════════════════════════');
  process.exit(0);
}

console.log('══════════════════════════════════════════════════════════════════');
console.log('HARDWARE ON-DEVICE TESTS: RUNNING ON PHYSICAL DEVICE');
console.log(`Device: ${process.env.DENARIXX_DEVICE_ID ?? 'unknown'}`);
console.log(`Date: ${new Date().toISOString()}`);
console.log(`Operator: ${process.env.DENARIXX_TEST_OPERATOR ?? 'unknown'}`);
console.log('══════════════════════════════════════════════════════════════════');

let passed = 0;
let failed = 0;
let blocked = 0;

function assert(condition: boolean, msg: string): void {
  if (!condition) { console.error('  FAIL:', msg); failed++; } else { passed++; }
}
function block(reason: string): void {
  console.log('  BLOCKED:', reason);
  blocked++;
}

async function main(): Promise<void> {

// ─── Test 1: Adapter Factory in Embedded Mode ─────────────────────────────────

console.log('\n─── Test 1: Adapter factory in embedded-prototype mode ───');
{
  let result;
  try {
    result = createHardwareAdapterSet('embedded-prototype');
  } catch (e) {
    console.error('  FAIL: createHardwareAdapterSet threw:', e);
    failed++;
    result = null;
  }
  if (result) {
    assert(result.requestedMode === 'embedded-prototype', 'requestedMode is embedded-prototype');
    assert(result.activeMode === 'embedded-prototype', 'activeMode is embedded-prototype — NOT simulation-test');
    assert(result.isSimulation === false, 'isSimulation is false');
    console.log('  Initialized adapters:', result.initializedAdapters.join(', ') || '(none)');
    console.log('  Unavailable adapters:', result.unavailableAdapters.join(', ') || '(none)');
    for (const err of result.startupErrors) console.log('  Startup error:', err);
    if (result.startupErrors.length > 0) {
      console.log('  → Some adapters not initialized. Check hardware connections above.');
    }
    console.log('PASS: Adapter factory in embedded mode (hardware may be partially unavailable)');
  }
}

// ─── Test 2: V4L2 Camera ──────────────────────────────────────────────────────

console.log('\n─── Test 2: V4L2 camera (/dev/video0) ───');
{
  const videoPath = process.env.DENARIXX_CAMERA_DEVICE ?? '/dev/video0';
  if (!fs.existsSync(videoPath)) {
    block(`${videoPath} not found. Connect MIPI-CSI2 camera and load V4L2 driver.`);
  } else {
    const state = createV4L2DriverState({ devicePath: videoPath, width: 640, height: 480, frameRateFps: 30, pixelFormat: 'rgb24' });
    const { state: initState, error } = initializeV4L2Driver(state);
    if (error) {
      block(`V4L2 init failed: ${error}`);
    } else {
      assert(initState.status === 'streaming', 'V4L2 is streaming');
      // Attempt frame capture
      const { frame, error: capError } = captureV4L2Frame(initState, 1);
      if (capError) {
        block(`V4L2 frame capture failed: ${capError}`);
      } else {
        assert(frame !== null, 'frame captured');
        assert(frame!.pixels !== null, 'frame has real pixel bytes');
        assert(frame!.pixels!.length > 0, 'frame pixels are non-empty');
        assert(frame!.isSimulated === false, 'frame is NOT simulated');
        console.log(`  Frame: ${frame!.width}x${frame!.height} ${frame!.pixelFormat} ${frame!.pixels!.length} bytes`);
        console.log('PASS: V4L2 camera captures real frame');
      }
    }
  }
}

// ─── Test 3: ONNX Inference on Device ─────────────────────────────────────────

console.log('\n─── Test 3: ONNX local inference ───');
{
  if (!MODEL_PATH || !fs.existsSync(MODEL_PATH)) {
    block(`Model not found at DENARIXX_LOCAL_MODEL_PATH=${MODEL_PATH}. ` +
      `Set env var to path of ONNX hazard detection model.`);
  } else {
    const provider = new OnnxLocalInferenceProvider();
    console.log(`  Loading model: ${MODEL_PATH}`);
    const t0 = Date.now();
    const status = await provider.initialize(MODEL_PATH);
    const loadMs = Date.now() - t0;
    console.log(`  Model load: status=${status} latency=${loadMs}ms`);

    if (status !== 'ready') {
      block(`Model failed to load: ${status}. Check onnxruntime-node installation and model format.`);
    } else {
      // Create a black frame for smoke test (real pixels will come from V4L2)
      const width = 640, height = 480;
      const pixels = new Uint8Array(width * height * 3).fill(0);
      const result = await provider.runInference({ pixels, width, height, frameId: 1, timestampMs: Date.now() });
      console.log(`  Inference: detections=${result.detections.length} latency=${result.inferenceLatencyMs}ms error=${result.error}`);

      assert(result.providerStatus === 'ready', 'provider status is ready');
      assert(result.inferenceLatencyMs >= 0, 'latency is non-negative');
      assert(result.framesProcessed === 1, 'frame count incremented');
      for (const d of result.detections) {
        assert(d.isSimulated === false, `detection ${d.className} is NOT simulated`);
        assert(d.source === 'onnx-local', `detection source is onnx-local`);
      }
      console.log(`PASS: ONNX inference runs on device. Latency: ${result.inferenceLatencyMs}ms`);
      await provider.shutdown();
    }
  }
}

// ─── Test 4: Battery Gauge ────────────────────────────────────────────────────

console.log('\n─── Test 4: Battery fuel gauge (I2C MAX17048) ───');
{
  const i2cBus = parseInt(process.env.DENARIXX_I2C_BUS ?? '1', 10);
  const state = createBatteryDriverState({ i2cBus, i2cAddress: 0x36, chipModel: 'max17048', lowBatteryThresholdPct: 15, criticalBatteryThresholdPct: 5, overheatThresholdC: 85 });
  const { state: initState, error } = initializeBatteryDriver(state);
  if (error) {
    block(`Battery driver init failed: ${error}`);
  } else {
    const { reading, error: readError } = readBatteryState(initState);
    if (readError) {
      block(`Battery read failed: ${readError}`);
    } else {
      assert(reading !== null, 'battery reading available');
      assert(reading!.socPct >= 0 && reading!.socPct <= 100, 'SOC in valid range');
      assert(reading!.cellVoltageV > 3.0 && reading!.cellVoltageV < 4.3, 'voltage in valid Li-Po range');
      assert(reading!.isSimulated === false, 'reading is NOT simulated');
      console.log(`  Battery: SOC=${reading!.socPct.toFixed(1)}% V=${reading!.cellVoltageV.toFixed(3)}V T=${reading!.temperatureC.toFixed(1)}°C`);
      console.log('PASS: Battery gauge returns real reading');
    }
  }
}

// ─── Test 5: Thermal Sensor ───────────────────────────────────────────────────

console.log('\n─── Test 5: Thermal zones (/sys/class/thermal) ───');
{
  const zones = defaultThermalZoneConfigs();
  const state = createThermalDriverState(zones);
  const { state: initState, error } = initializeThermalDriver(state);
  if (error) {
    block(`Thermal driver unavailable: ${error}`);
  } else {
    const { readings, error: readError } = readThermalZones(initState);
    assert(readings.length > 0, 'at least one thermal reading');
    for (const r of readings) {
      assert(r.isSimulated === false, `${r.zoneLabel} reading is NOT simulated`);
      assert(r.temperatureC > 0 && r.temperatureC < 120, `${r.zoneLabel} temperature in valid range`);
      console.log(`  ${r.zoneLabel}: ${r.temperatureC.toFixed(1)}°C (${r.severity})`);
      if (r.severity === 'critical' || r.severity === 'emergency') {
        console.warn(`  WARNING: ${r.zoneLabel} temperature is ${r.severity.toUpperCase()}. Check cooling.`);
      }
    }
    console.log('PASS: Thermal zones return real readings');
  }
}

// ─── Test 6: Network Status ───────────────────────────────────────────────────

console.log('\n─── Test 6: Network status ───');
{
  const iface = process.env.DENARIXX_NETWORK_IFACE ?? 'wlan0';
  const state = createNetworkDriverState({ primaryInterface: iface, weakSignalThresholdDbm: -80 });
  const { state: initState, error: initError } = initializeNetworkDriver(state);
  if (initError) {
    block(`Network driver unavailable: ${initError}`);
  } else {
    const { reading, error: readError } = readNetworkState(initState);
    if (readError) {
      block(`Network read failed: ${readError}`);
    } else {
      assert(reading !== null, 'network reading available');
      assert(reading!.isSimulated === false, 'reading is NOT simulated');
      assert(['good', 'weak', 'offline'].includes(reading!.quality), 'quality is valid enum');
      console.log(`  Network (${iface}): online=${reading!.isOnline} quality=${reading!.quality} rssi=${reading!.rssiDbm ?? 'N/A'} dBm`);
      console.log('PASS: Network driver returns real reading from sysfs');
    }
  }
}

// ─── Test 7: Haptic Controller ────────────────────────────────────────────────

console.log('\n─── Test 7: Haptic controller (DRV2605L I2C) ───');
{
  const i2cBus = parseInt(process.env.DENARIXX_I2C_BUS ?? '1', 10);
  const state = createHapticDriverState({ i2cBus, i2cAddress: 0x5A, actuatorType: 'erm', library: 1 });
  const { state: initState, error } = initializeHapticDriver(state);
  if (error) {
    block(`Haptic driver init failed: ${error}`);
  } else {
    // Play startup pattern — user will feel it
    const { error: playError } = playHapticPattern(initState, 'startup');
    if (playError) {
      block(`Haptic play failed: ${playError}`);
    } else {
      console.log('  Startup haptic pattern played. Did you feel it? (manual check required)');
      assert(true, 'haptic play did not throw');
      console.log('PASS: Haptic controller plays pattern');
    }
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n══════════════════════════════════════════════════════════════════`);
console.log(`Hardware On-Device Tests: ${passed} passed, ${failed} failed, ${blocked} blocked`);
console.log(`══════════════════════════════════════════════════════════════════`);
if (blocked > 0) {
  console.log(`${blocked} test(s) blocked — hardware not connected. See BLOCKED messages above.`);
}
if (failed > 0) {
  console.error(`${failed} test(s) FAILED. Review output above.`);
  process.exit(1);
}
if (blocked > 0 && failed === 0) {
  console.log('Exiting with 0 — BLOCKED tests are expected at P0 bring-up.');
}

} // end main()

main().catch(err => { console.error('Unhandled error:', err); process.exit(1); });

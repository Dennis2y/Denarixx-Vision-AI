/**
 * Hardware Bridge tests (V8)
 *
 * Tests WearableConnectionEngine, HardwareBridgeEngine, DeviceCapabilityEngine.
 *
 * Run: npx tsx tests/hardwareBridge.test.ts
 */

import { WearableConnectionEngine } from '../src/engines/wearableConnectionEngine';
import { HardwareBridgeEngine } from '../src/engines/hardwareBridgeEngine';
import { DeviceCapabilityEngine } from '../src/engines/deviceCapabilityEngine';
import { HARDWARE_DEFAULTS } from '../src/types/hardware';
import type { BrowserCapabilities } from '../src/types/hardware';

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect<T>(actual: T) {
  return {
    toBe(expected: T, label: string) {
      if (actual === expected) { console.log(`  ✓ ${label}`); passed++; }
      else {
        console.error(`  ✗ ${label}`);
        console.error(`    expected: ${JSON.stringify(expected)}`);
        console.error(`    received: ${JSON.stringify(actual)}`);
        failed++;
      }
    },
    toBeTrue(label: string)  { this.toBe(true as unknown as T, label); },
    toBeFalse(label: string) { this.toBe(false as unknown as T, label); },
    toBeNull(label: string)  { this.toBe(null as unknown as T, label); },
    toBeNotNull(label: string) {
      const ok = actual !== null && actual !== undefined;
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else { console.error(`  ✗ ${label}: was null/undefined`); failed++; }
    },
    toContain(s: string, label: string) {
      const ok = String(actual).includes(s);
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else { console.error(`  ✗ ${label}: "${actual}" does not contain "${s}"`); failed++; }
    },
    toBeGreaterThan(n: number, label: string) {
      const ok = (actual as unknown as number) > n;
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else { console.error(`  ✗ ${label}: ${actual} not > ${n}`); failed++; }
    },
  };
}

function describe(label: string, fn: () => void) {
  console.log(`\n${label}`);
  fn();
}

// ─── WearableConnectionEngine ─────────────────────────────────────────────────

describe('WearableConnectionEngine — device registry', () => {
  const engine = new WearableConnectionEngine();
  const all = engine.getAll();

  expect(all.length).toBeGreaterThan(5, 'registry has at least 6 devices');
  expect(all.some((d) => d.id === 'phone-camera-internal')).toBeTrue('phone camera in registry');
  expect(all.some((d) => d.id === 'denarixx-glasses-v1')).toBeTrue('denarixx glasses in registry');
  expect(all.some((d) => d.kind === 'smart_cane')).toBeTrue('smart cane in registry');
  expect(all.some((d) => d.kind === 'bone_conduction')).toBeTrue('bone conduction in registry');
  expect(all.some((d) => d.kind === 'haptic_motor')).toBeTrue('haptic motor in registry');
});

describe('WearableConnectionEngine — initial state is disconnected', () => {
  const engine = new WearableConnectionEngine();
  const glasses = engine.get('denarixx-glasses-v1');
  expect(glasses?.status).toBe('disconnected', 'glasses start disconnected');
  expect(glasses?.signalStrength).toBeNull('glasses start with null signal');
  expect(glasses?.connectedAt).toBeNull('glasses start with null connectedAt');
});

describe('WearableConnectionEngine — connect lifecycle', () => {
  const engine = new WearableConnectionEngine();

  // beginConnect
  const pending = engine.beginConnect('denarixx-glasses-v1');
  expect(pending?.status).toBe('connecting', 'beginConnect → connecting');

  // finaliseConnect
  const result = engine.finaliseConnect('denarixx-glasses-v1');
  expect(result.success).toBeTrue('finaliseConnect succeeds');
  expect(result.device.status).toBe('active', 'device → active after connect');
  expect(result.device.signalStrength !== null).toBeTrue('signal strength set after connect');
  expect(result.device.connectedAt !== null).toBeTrue('connectedAt set after connect');
  expect(result.errorMessage).toBeNull('no error on success');
});

describe('WearableConnectionEngine — disconnect', () => {
  const engine = new WearableConnectionEngine();
  engine.finaliseConnect('denarixx-glasses-v1');
  const disconnected = engine.disconnect('denarixx-glasses-v1', 'user_requested');
  expect(disconnected?.status).toBe('disconnected', 'disconnect → status disconnected');
  expect(disconnected?.signalStrength).toBeNull('signal cleared on disconnect');
  expect(disconnected?.connectedAt).toBeNull('connectedAt cleared');
});

describe('WearableConnectionEngine — getConnected returns only active', () => {
  const engine = new WearableConnectionEngine();
  engine.finaliseConnect('denarixx-glasses-v1');
  engine.finaliseConnect('bt-camera-ext-001');
  const connected = engine.getConnected();
  expect(connected.length).toBe(2, 'two active devices returned');
  expect(connected.every((d) => d.status === 'active' || d.status === 'connected')).toBeTrue('all returned are active');
});

describe('WearableConnectionEngine — getByCapability', () => {
  const engine = new WearableConnectionEngine();
  engine.finaliseConnect('denarixx-glasses-v1');
  engine.finaliseConnect('haptic-wrist-001');
  const cameras = engine.getByCapability('hasCamera');
  const haptics = engine.getByCapability('hasHaptic');
  expect(cameras.length).toBeGreaterThan(0, 'has camera devices');
  expect(cameras.every((d) => d.capabilities.hasCamera)).toBeTrue('all returned have hasCamera');
  expect(haptics.length).toBeGreaterThan(0, 'has haptic devices');
});

describe('WearableConnectionEngine — simulateDisconnect with vision device', () => {
  const engine = new WearableConnectionEngine();
  engine.finaliseConnect('denarixx-glasses-v1');
  const event = engine.simulateDisconnect('denarixx-glasses-v1', 'signal_lost', true, 'phone');
  expect(event !== null).toBeTrue('returns an event');
  expect(event!.safetyMessage).toContain('Vision device disconnected', 'safety message for vision disconnect during session');
  expect(event!.sessionWasActive).toBeTrue('sessionWasActive true');
  expect(event!.fallbackCamera).toBe('phone', 'fallback camera = phone');
  expect(event!.reason).toBe('signal_lost', 'reason = signal_lost');
});

describe('WearableConnectionEngine — simulateDisconnect with non-vision device', () => {
  const engine = new WearableConnectionEngine();
  engine.finaliseConnect('haptic-wrist-001');
  const event = engine.simulateDisconnect('haptic-wrist-001', 'user_requested', true, null);
  expect(event !== null).toBeTrue('returns an event');
  expect(event!.safetyMessage).toContain('disconnected', 'message mentions disconnect');
  // Should NOT be the vision emergency message
  expect(event!.safetyMessage.includes('Vision device')).toBeFalse('not vision emergency message');
});

describe('WearableConnectionEngine — heartbeat varies signal', () => {
  const engine = new WearableConnectionEngine();
  engine.finaliseConnect('denarixx-glasses-v1');
  const before = engine.get('denarixx-glasses-v1')!.signalStrength!;
  // Run several heartbeats
  for (let i = 0; i < 10; i++) engine.heartbeat('denarixx-glasses-v1');
  const after = engine.get('denarixx-glasses-v1')!.lastHeartbeat!;
  expect(after !== null).toBeTrue('lastHeartbeat updated');
});

describe('WearableConnectionEngine — ensurePhoneCamera activates phone', () => {
  const engine = new WearableConnectionEngine();
  const phone = engine.ensurePhoneCamera();
  expect(phone.status).toBe('active', 'phone camera becomes active');
  expect(phone.kind).toBe('phone_camera', 'kind = phone_camera');
});

describe('WearableConnectionEngine — unknown device connect returns error', () => {
  const engine = new WearableConnectionEngine();
  const result = engine.finaliseConnect('nonexistent-id');
  expect(result.success).toBeFalse('unknown id → failure');
  expect(result.errorMessage !== null).toBeTrue('error message provided');
});

// ─── HardwareBridgeEngine ─────────────────────────────────────────────────────

describe('HardwareBridgeEngine — recomputeIO with no connected devices', () => {
  const bridge = new HardwareBridgeEngine({ ...HARDWARE_DEFAULTS, fallbackToPhoneCamera: true });
  const io = bridge.recomputeIO([]);
  expect(io.cameraSource).toBe('phone', 'no devices → phone camera (fallback)');
  expect(io.audioOutput).toBe('phone_speaker', 'no devices → phone speaker');
  expect(io.hapticOutput).toBe('phone_vibration', 'no devices → phone vibration');
});

describe('HardwareBridgeEngine — recomputeIO with denarixx glasses', () => {
  const engine = new WearableConnectionEngine();
  engine.finaliseConnect('denarixx-glasses-v1');
  engine.finaliseConnect('bone-conduction-001');
  const connected = engine.getConnected();

  const bridge = new HardwareBridgeEngine(HARDWARE_DEFAULTS);
  const io = bridge.recomputeIO(connected);
  expect(io.cameraSource).toBe('denarixx_glasses', 'denarixx glasses → top camera priority');
  expect(io.audioOutput).toBe('bone_conduction', 'glasses include bone conduction → BC audio');
});

describe('HardwareBridgeEngine — setCameraSource validation', () => {
  const engine = new WearableConnectionEngine();
  engine.finaliseConnect('bt-camera-ext-001');
  const connected = engine.getConnected();

  const bridge = new HardwareBridgeEngine(HARDWARE_DEFAULTS);
  // Try to set wifi_glasses when only bluetooth is connected
  const ok = bridge.setCameraSource('wifi_glasses', connected);
  expect(ok).toBeFalse('cannot select unconnected source');
  // Simulation always allowed
  const simOk = bridge.setCameraSource('simulation', connected);
  expect(simOk).toBeTrue('simulation always allowed');
});

describe('HardwareBridgeEngine — handleDisconnect vision device emits safety message', () => {
  const engine = new WearableConnectionEngine();
  engine.finaliseConnect('denarixx-glasses-v1');
  const event = engine.simulateDisconnect('denarixx-glasses-v1', 'signal_lost', true, 'phone');
  const remaining = engine.getConnected();

  const bridge = new HardwareBridgeEngine(HARDWARE_DEFAULTS);
  const { safetyMessage, newIOConfig } = bridge.handleDisconnect(event!, remaining);
  expect(safetyMessage !== null).toBeTrue('safety message emitted for vision disconnect during session');
  expect(safetyMessage!).toContain('Vision device', 'safety message content correct');
});

describe('HardwareBridgeEngine — handleDisconnect no message outside session', () => {
  const engine = new WearableConnectionEngine();
  engine.finaliseConnect('denarixx-glasses-v1');
  const event = engine.simulateDisconnect('denarixx-glasses-v1', 'user_requested', false, null);

  const bridge = new HardwareBridgeEngine(HARDWARE_DEFAULTS);
  const { safetyMessage } = bridge.handleDisconnect(event!, []);
  expect(safetyMessage).toBeNull('no safety message when session not active');
});

describe('HardwareBridgeEngine — sessionSource mapping', () => {
  const bridge = new HardwareBridgeEngine(HARDWARE_DEFAULTS);
  expect(bridge.sessionSource('phone')).toBe('camera', 'phone → camera source');
  expect(bridge.sessionSource('simulation')).toBe('simulation', 'simulation → simulation source');
  expect(bridge.sessionSource('denarixx_glasses')).toBe('simulation', 'glasses → simulation (Phase 8 — not yet wired)');
});

describe('HardwareBridgeEngine — describe methods', () => {
  const bridge = new HardwareBridgeEngine(HARDWARE_DEFAULTS);
  expect(bridge.describeCameraSource('phone')).toContain('Phone', 'phone source label');
  expect(bridge.describeCameraSource('denarixx_glasses')).toContain('Denarixx', 'glasses label');
  expect(bridge.describeAudioOutput('bone_conduction')).toContain('Bone', 'bone conduction label');
  expect(bridge.describeHapticOutput('smart_cane')).toContain('Cane', 'smart cane label');
});

// ─── DeviceCapabilityEngine ───────────────────────────────────────────────────

const FULL_CAPS: BrowserCapabilities = {
  bluetooth: true, webUSB: true, webRTC: true,
  webNFC: true, serialPort: true, vibration: true, battery: true,
};
const NO_CAPS: BrowserCapabilities = {
  bluetooth: false, webUSB: false, webRTC: false,
  webNFC: false, serialPort: false, vibration: false, battery: false,
};

describe('DeviceCapabilityEngine — requiredAPI', () => {
  const cap = new DeviceCapabilityEngine();
  expect(cap.requiredAPI('phone_camera')).toBeNull('phone camera → null (no API needed)');
  expect(cap.requiredAPI('bluetooth_camera')).toBe('bluetooth', 'BT camera → bluetooth');
  expect(cap.requiredAPI('wifi_glasses')).toBe('webRTC', 'Wi-Fi glasses → webRTC');
  expect(cap.requiredAPI('usb_camera')).toBe('webUSB', 'USB camera → webUSB');
  expect(cap.requiredAPI('denarixx_glasses')).toBe('webRTC', 'Denarixx glasses → webRTC');
  expect(cap.requiredAPI('smart_cane')).toBe('bluetooth', 'smart cane → bluetooth');
});

describe('DeviceCapabilityEngine — canConnect', () => {
  const cap = new DeviceCapabilityEngine();
  expect(cap.canConnect('phone_camera', NO_CAPS)).toBeTrue('phone camera always connectable');
  expect(cap.canConnect('bluetooth_camera', NO_CAPS)).toBeFalse('BT camera blocked without bluetooth');
  expect(cap.canConnect('bluetooth_camera', FULL_CAPS)).toBeTrue('BT camera ok with bluetooth');
  expect(cap.canConnect('usb_camera', NO_CAPS)).toBeFalse('USB camera blocked without webUSB');
  expect(cap.canConnect('wifi_glasses', FULL_CAPS)).toBeTrue('Wi-Fi glasses ok with webRTC');
});

describe('DeviceCapabilityEngine — connectionBlockedReason', () => {
  const cap = new DeviceCapabilityEngine();
  expect(cap.connectionBlockedReason('phone_camera', NO_CAPS)).toBeNull('phone camera → null reason');
  const reason = cap.connectionBlockedReason('bluetooth_camera', NO_CAPS);
  expect(reason !== null).toBeTrue('BT camera blocked → returns reason string');
  expect(reason!).toContain('Web Bluetooth', 'reason mentions Web Bluetooth');
  expect(cap.connectionBlockedReason('bluetooth_camera', FULL_CAPS)).toBeNull('no block when capability present');
});

describe('DeviceCapabilityEngine — bestCameraSource priority', () => {
  const cap = new DeviceCapabilityEngine();
  expect(cap.bestCameraSource([], true)).toBe('phone', 'no devices + fallback → phone');
  expect(cap.bestCameraSource([], false)).toBe('simulation', 'no devices no fallback → simulation');
  expect(cap.bestCameraSource(['bluetooth_camera', 'wifi_glasses'], true)).toBe('wifi_glasses', 'wifi_glasses > bluetooth');
  expect(cap.bestCameraSource(['denarixx_glasses', 'wifi_glasses'], true)).toBe('denarixx_glasses', 'denarixx > wifi');
  expect(cap.bestCameraSource(['usb_camera'], true)).toBe('usb', 'usb camera selected');
});

describe('DeviceCapabilityEngine — bestAudioOutput', () => {
  const cap = new DeviceCapabilityEngine();
  expect(cap.bestAudioOutput([])).toBe('phone_speaker', 'no devices → phone speaker');
  expect(cap.bestAudioOutput(['bone_conduction'])).toBe('bone_conduction', 'bone conduction preferred');
  expect(cap.bestAudioOutput(['denarixx_glasses'])).toBe('bone_conduction', 'denarixx glasses → BC audio');
});

describe('DeviceCapabilityEngine — bestHapticOutput', () => {
  const cap = new DeviceCapabilityEngine();
  expect(cap.bestHapticOutput([])).toBe('phone_vibration', 'no devices → phone vibration');
  expect(cap.bestHapticOutput(['haptic_motor'])).toBe('wrist_haptic', 'haptic motor → wrist');
  expect(cap.bestHapticOutput(['smart_cane'])).toBe('smart_cane', 'smart cane preferred');
  expect(cap.bestHapticOutput(['smart_cane', 'haptic_motor'])).toBe('smart_cane', 'smart cane > haptic motor');
});

describe('DeviceCapabilityEngine — describeBrowserCapabilities', () => {
  const cap = new DeviceCapabilityEngine();
  const lines = cap.describeBrowserCapabilities(FULL_CAPS);
  expect(lines.length).toBeGreaterThan(3, 'full caps gives several descriptions');
  const noneLines = cap.describeBrowserCapabilities(NO_CAPS);
  expect(noneLines.length).toBe(0, 'no caps → empty list');
});

describe('DeviceCapabilityEngine — setupInstructions coverage', () => {
  const cap = new DeviceCapabilityEngine();
  const kinds = [
    'phone_camera', 'bluetooth_camera', 'wifi_glasses', 'usb_camera',
    'denarixx_glasses', 'bone_conduction', 'haptic_motor', 'smart_cane',
  ] as const;
  for (const kind of kinds) {
    const instr = cap.setupInstructions(kind);
    expect(instr.length > 10).toBeTrue(`setup instructions for ${kind} is non-empty`);
  }
});

// ─── SAFETY_RULES ─────────────────────────────────────────────────────────────

describe('HardwareBridgeEngine — SAFETY_RULES constants', () => {
  const { SAFETY_RULES } = require('../src/engines/hardwareBridgeEngine');
  expect(SAFETY_RULES.noVideoStorage).toBeTrue('no video storage rule is true');
  expect(SAFETY_RULES.noFaceRecognition).toBeTrue('no face recognition rule is true');
  expect(SAFETY_RULES.warnOnVisionDisconnect).toBeTrue('warn on vision disconnect rule is true');
  expect(SAFETY_RULES.phoneCameraFallback).toBeTrue('phone camera fallback rule is true');
});

// ─── HARDWARE_DEFAULTS ────────────────────────────────────────────────────────

describe('HARDWARE_DEFAULTS — safe defaults', () => {
  expect(HARDWARE_DEFAULTS.preferredCameraSource).toBe('simulation', 'default camera = simulation');
  expect(HARDWARE_DEFAULTS.fallbackToPhoneCamera).toBeTrue('fallback to phone enabled by default');
  expect(HARDWARE_DEFAULTS.warnOnDisconnect).toBeTrue('warn on disconnect enabled by default');
});

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

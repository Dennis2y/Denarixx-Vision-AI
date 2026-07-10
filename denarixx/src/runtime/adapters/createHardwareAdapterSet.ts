// ─── Hardware Adapter Factory ─────────────────────────────────────────────────
// Selects exactly one adapter mode and assembles the HardwareAdapterSet.
//
// SAFETY INVARIANT: embedded-prototype mode NEVER falls back to simulation-test.
// If embedded hardware fails to initialize, the factory returns an explicit
// startup error — it does NOT silently substitute fake adapters.
//
// Modes:
//   simulation-test      → pure synthetic adapters; for CI and unit tests only
//   browser-development  → browser API adapters (getUserMedia, Web Speech, etc.)
//   embedded-prototype   → physical HAL stubs; reports unavailable, never fakes

import type { HardwareAdapterMode } from '@/types/localInference';
import type { HardwareAdapterSet } from './hardwareAdapterTypes';
import {
  createSimulationCameraAdapter,
  createSimulationMicrophoneAdapter,
  createSimulationAudioOutputAdapter,
  createSimulationHapticAdapter,
  createSimulationIMUAdapter,
  createSimulationBatteryAdapter,
  createSimulationNetworkAdapter,
  createSimulationButtonAdapter,
} from './simulationTestAdapter';
import {
  createBrowserCameraAdapter,
  createBrowserMicrophoneAdapter,
  createBrowserAudioOutputAdapter,
  createBrowserHapticAdapter,
  createBrowserIMUAdapter,
  createBrowserBatteryAdapter,
  createBrowserNetworkAdapter,
  createBrowserButtonAdapter,
} from './browserDevelopmentAdapter';
import {
  createEmbeddedCameraAdapter,
  createEmbeddedMicrophoneAdapter,
  createEmbeddedAudioOutputAdapter,
  createEmbeddedHapticAdapter,
  createEmbeddedIMUAdapter,
  createEmbeddedBatteryAdapter,
  createEmbeddedNetworkAdapter,
  createEmbeddedButtonAdapter,
  createDefaultEmbeddedDriverStates,
} from './embeddedPrototypeAdapter';

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface AdapterFactoryResult {
  requestedMode: HardwareAdapterMode;
  activeMode: HardwareAdapterMode;
  adapters: HardwareAdapterSet;
  initializedAdapters: string[];
  unavailableAdapters: string[];
  startupErrors: string[];
  isSimulation: boolean;
}

// ─── Safety Assertion ─────────────────────────────────────────────────────────

export class EmbeddedSimulationFallbackError extends Error {
  readonly requestedMode: HardwareAdapterMode;
  readonly activeMode: HardwareAdapterMode;
  constructor(requested: HardwareAdapterMode, active: HardwareAdapterMode) {
    super(
      `SAFETY VIOLATION: Requested adapter mode '${requested}' but would activate '${active}'. ` +
      `embedded-prototype mode must never silently fall back to simulation-test. ` +
      `Ensure physical hardware drivers are initialized, or use DENARIXX_HAL_ADAPTER=simulation-test ` +
      `explicitly for non-real-user operation.`,
    );
    this.requestedMode = requested;
    this.activeMode = active;
    this.name = 'EmbeddedSimulationFallbackError';
  }
}

export function assertNoSimulationFallback(
  requestedMode: HardwareAdapterMode,
  activeMode: HardwareAdapterMode,
): void {
  if (requestedMode === 'embedded-prototype' && activeMode === 'simulation-test') {
    throw new EmbeddedSimulationFallbackError(requestedMode, activeMode);
  }
}

// ─── Mode Parsing ─────────────────────────────────────────────────────────────

export function parseAdapterMode(env: string | undefined): HardwareAdapterMode {
  const raw = (env ?? 'simulation-test').trim().toLowerCase();
  if (raw === 'embedded-prototype') return 'embedded-prototype';
  if (raw === 'browser-development') return 'browser-development';
  return 'simulation-test';
}

// ─── Simulation-Test Adapter Set ──────────────────────────────────────────────

export function createSimulationAdapterSet(online = true): AdapterFactoryResult {
  const adapters: HardwareAdapterSet = {
    mode: 'simulation-test',
    camera:      createSimulationCameraAdapter(),
    microphone:  createSimulationMicrophoneAdapter(),
    audioOutput: createSimulationAudioOutputAdapter(),
    haptic:      createSimulationHapticAdapter(),
    imu:         createSimulationIMUAdapter(),
    battery:     createSimulationBatteryAdapter(80),
    network:     createSimulationNetworkAdapter(online),
    buttons:     createSimulationButtonAdapter(),
  };
  return {
    requestedMode: 'simulation-test',
    activeMode: 'simulation-test',
    adapters,
    initializedAdapters: ['camera', 'microphone', 'audioOutput', 'haptic', 'imu', 'battery', 'network', 'buttons'],
    unavailableAdapters: [],
    startupErrors: [],
    isSimulation: true,
  };
}

// ─── Browser-Development Adapter Set ─────────────────────────────────────────

export interface BrowserCapabilitySnapshot {
  cameraAvailable: boolean;
  microphoneAvailable: boolean;
  speechSynthAvailable: boolean;
  vibrateAvailable: boolean;
  deviceMotionAvailable: boolean;
  batteryApiAvailable: boolean;
  isOnline: boolean;
}

export function defaultBrowserCapabilities(): BrowserCapabilitySnapshot {
  return {
    cameraAvailable: false,
    microphoneAvailable: false,
    speechSynthAvailable: false,
    vibrateAvailable: false,
    deviceMotionAvailable: false,
    batteryApiAvailable: false,
    isOnline: true,
  };
}

export function createBrowserAdapterSet(
  caps: BrowserCapabilitySnapshot,
): AdapterFactoryResult {
  const adapters: HardwareAdapterSet = {
    mode: 'browser-development',
    camera:      createBrowserCameraAdapter(caps.cameraAvailable),
    microphone:  createBrowserMicrophoneAdapter(caps.microphoneAvailable),
    audioOutput: createBrowserAudioOutputAdapter(caps.speechSynthAvailable),
    haptic:      createBrowserHapticAdapter(caps.vibrateAvailable),
    imu:         createBrowserIMUAdapter(caps.deviceMotionAvailable),
    battery:     createBrowserBatteryAdapter(caps.batteryApiAvailable),
    network:     createBrowserNetworkAdapter(caps.isOnline),
    buttons:     createBrowserButtonAdapter(),
  };

  const unavailable: string[] = [];
  if (!caps.cameraAvailable)      unavailable.push('camera');
  if (!caps.microphoneAvailable)  unavailable.push('microphone');
  if (!caps.speechSynthAvailable) unavailable.push('audioOutput');
  if (!caps.vibrateAvailable)     unavailable.push('haptic');
  if (!caps.deviceMotionAvailable) unavailable.push('imu');
  if (!caps.batteryApiAvailable)  unavailable.push('battery');

  const initialized = ['camera', 'microphone', 'audioOutput', 'haptic', 'imu', 'battery', 'network', 'buttons']
    .filter(n => !unavailable.includes(n));

  return {
    requestedMode: 'browser-development',
    activeMode: 'browser-development',
    adapters,
    initializedAdapters: initialized,
    unavailableAdapters: unavailable,
    startupErrors: [],
    isSimulation: false,
  };
}

// ─── Embedded-Prototype Adapter Set ──────────────────────────────────────────
// Requires physical hardware on a Linux device.
// Each adapter checks its own actual state.
// Unavailable adapters are listed; the caller decides whether to abort or degrade.
// This function NEVER activates simulation adapters.

export function createEmbeddedAdapterSet(): AdapterFactoryResult {
  const states = createDefaultEmbeddedDriverStates();

  const adapters: HardwareAdapterSet = {
    mode: 'embedded-prototype',
    camera:      createEmbeddedCameraAdapter(states.camera),
    microphone:  createEmbeddedMicrophoneAdapter(states.microphone),
    audioOutput: createEmbeddedAudioOutputAdapter(states.audioOutput),
    haptic:      createEmbeddedHapticAdapter(states.haptic),
    imu:         createEmbeddedIMUAdapter(states.imu),
    battery:     createEmbeddedBatteryAdapter(states.battery),
    network:     createEmbeddedNetworkAdapter(states.network),
    buttons:     createEmbeddedButtonAdapter(states.buttons),
  };

  const unavailable: string[] = [];
  const startupErrors: string[] = [];

  if (!adapters.camera.isAvailable()) {
    unavailable.push('camera');
    startupErrors.push(
      'Camera unavailable. Check V4L2 device path (/dev/video0) and MIPI-CSI connection. ' +
      'Required for hazard perception. Operation will be refused until camera is available.',
    );
  }
  if (!adapters.audioOutput.isAvailable()) {
    unavailable.push('audioOutput');
    startupErrors.push(
      'Audio output unavailable. Check ALSA playback device (hw:1,0) and I2S amplifier. ' +
      'User will not hear safety alerts.',
    );
  }
  if (!adapters.imu.isAvailable()) {
    unavailable.push('imu');
    startupErrors.push(
      'IMU unavailable. Check I2C/SPI device at address 0x6A (LSM6DSO) or SPI bus. ' +
      'Heading and motion guidance disabled.',
    );
  }
  if (!adapters.haptic.isAvailable()) {
    unavailable.push('haptic');
    startupErrors.push(
      'Haptic controller unavailable. Check I2C device DRV2605L at address 0x5A.',
    );
  }
  if (!adapters.battery.isAvailable()) {
    unavailable.push('battery');
    startupErrors.push(
      'Battery gauge unavailable. Check I2C device MAX17048 at address 0x36. ' +
      'Low-battery shutdown protection disabled.',
    );
  }
  if (!adapters.microphone.isAvailable()) {
    unavailable.push('microphone');
    startupErrors.push(
      'Microphone unavailable. Check ALSA capture device (hw:0,0) and I2S PDM connection.',
    );
  }
  if (!adapters.buttons.isAvailable()) {
    unavailable.push('buttons');
    startupErrors.push(
      'Button driver unavailable. Check GPIO chip (/dev/gpiochip0) and libgpiod installation. ' +
      'Emergency stop button will not respond.',
    );
  }

  const initialized = ['camera', 'microphone', 'audioOutput', 'haptic', 'imu', 'battery', 'network', 'buttons']
    .filter(n => !unavailable.includes(n));

  return {
    requestedMode: 'embedded-prototype',
    activeMode: 'embedded-prototype',
    adapters,
    initializedAdapters: initialized,
    unavailableAdapters: unavailable,
    startupErrors,
    isSimulation: false,
  };
}

// ─── Main Factory ─────────────────────────────────────────────────────────────

export function createHardwareAdapterSet(
  halAdapterEnv?: string,
  browserCaps?: BrowserCapabilitySnapshot,
  online?: boolean,
): AdapterFactoryResult {
  const mode = parseAdapterMode(halAdapterEnv);

  let result: AdapterFactoryResult;
  switch (mode) {
    case 'embedded-prototype':
      result = createEmbeddedAdapterSet();
      break;
    case 'browser-development':
      result = createBrowserAdapterSet(browserCaps ?? defaultBrowserCapabilities());
      break;
    default:
      result = createSimulationAdapterSet(online ?? true);
  }

  // SAFETY ASSERTION: embedded-prototype must never silently resolve to simulation-test
  assertNoSimulationFallback(result.requestedMode, result.activeMode);

  return result;
}

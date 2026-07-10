// ─── Bring-Up Program: Prototype Runtime Entry Point ─────────────────────────
// Headless embedded runtime starter for Denarixx Vision Glasses compute module.
// Does NOT depend on React, browser APIs, or Next.js.
// Wires adapters → model state → embedded runtime lifecycle.
//
// Usage (bring-up, Linux):
//   DENARIXX_HAL_ADAPTER=simulation-test npx tsx src/runtime/startPrototypeRuntime.ts
//   DENARIXX_HAL_ADAPTER=embedded-prototype npx tsx src/runtime/startPrototypeRuntime.ts
//
// In production: compiled to native binary via esbuild + Node.js static bundle.

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
} from './embeddedVisionRuntime';
import type { EmbeddedRuntimeState } from './embeddedVisionRuntime';
import {
  createSimulationCameraAdapter,
  createSimulationMicrophoneAdapter,
  createSimulationAudioOutputAdapter,
  createSimulationHapticAdapter,
  createSimulationIMUAdapter,
  createSimulationBatteryAdapter,
  createSimulationNetworkAdapter,
  createSimulationButtonAdapter,
} from './adapters/simulationTestAdapter';
import type { HardwareAdapterSet } from './adapters/hardwareAdapterTypes';
import { selectHardwareAdapter, createModelState } from '@/engines/localInferenceEngine';
import { createPressSequenceState, createEmergencyButtonState } from '@/engines/hardwareButtonEngine';

// ─── Adapter Assembly ─────────────────────────────────────────────────────────

export function assembleSimulationAdapters(online = true): HardwareAdapterSet {
  return {
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
}

// ─── Runtime Configuration ────────────────────────────────────────────────────

export interface PrototypeRuntimeConfig {
  sessionId: string;
  modelPath: string;
  halAdapterEnv: string;
  maxFrames: number | null;   // null = run until shutdown signal
  healthCheckIntervalTicks: number;
  framePeriodMs: number;
}

export function defaultConfig(): PrototypeRuntimeConfig {
  return {
    sessionId: `runtime-${Date.now()}`,
    modelPath: '/opt/denarixx/models/hazard-detection.onnx',
    halAdapterEnv: 'simulation-test',
    maxFrames: null,
    healthCheckIntervalTicks: 30,
    framePeriodMs: 100,   // 10 FPS target
  };
}

// ─── Boot Sequence ────────────────────────────────────────────────────────────

export interface BootSequenceOutcome {
  success: boolean;
  state: EmbeddedRuntimeState;
  adapters: HardwareAdapterSet;
  adapterConfig: ReturnType<typeof selectHardwareAdapter>;
  modelState: ReturnType<typeof createModelState>;
  errors: string[];
  announcements: string[];
}

export function runFullBootSequence(
  config: PrototypeRuntimeConfig,
  nowMs: number,
): BootSequenceOutcome {
  const adapterConfig = selectHardwareAdapter(config.halAdapterEnv);
  const adapters = assembleSimulationAdapters(true);
  let state = createEmbeddedRuntimeState(config.sessionId);
  let modelState = createModelState(adapterConfig.inferenceRuntime);
  const allAnnouncements: string[] = [];
  const allErrors: string[] = [];

  // Phase: boot
  state = { ...state, phase: 'booting' };
  const bootResult = runBoot(state, adapters, nowMs);
  state = bootResult.state;
  allAnnouncements.push(...bootResult.result.announcements);
  allErrors.push(...bootResult.result.errors);

  if (!bootResult.result.success) {
    return { success: false, state, adapters, adapterConfig, modelState, errors: allErrors, announcements: allAnnouncements };
  }

  // Phase: sensor-init
  state = runSensorInit(state, adapters, nowMs);

  // Phase: camera-init
  state = runCameraInit(state, adapters, nowMs);
  if (state.phase === 'failed') {
    return { success: false, state, adapters, adapterConfig, modelState, errors: allErrors, announcements: allAnnouncements };
  }

  // Phase: model-load
  const modelLoadResult = runModelLoad(state, adapterConfig, modelState, config.modelPath, nowMs);
  state = modelLoadResult.state;
  modelState = modelLoadResult.modelState;
  allAnnouncements.push(...state.announcements.slice(allAnnouncements.length));

  if (state.phase === 'failed') {
    return { success: false, state, adapters, adapterConfig, modelState, errors: allErrors, announcements: allAnnouncements };
  }

  // Phase: session-start
  state = runSessionStart(state, nowMs);
  allAnnouncements.push(...state.announcements.slice(allAnnouncements.length));

  return {
    success: true,
    state,
    adapters,
    adapterConfig,
    modelState,
    errors: allErrors,
    announcements: allAnnouncements,
  };
}

// ─── Processing Loop (single tick — called by external scheduler) ─────────────

export interface TickResult {
  state: EmbeddedRuntimeState;
  modelState: ReturnType<typeof createModelState>;
  announcements: string[];
  hapticCommands: string[];
  shouldContinue: boolean;
}

export function runOneTick(
  state: EmbeddedRuntimeState,
  adapters: HardwareAdapterSet,
  adapterConfig: ReturnType<typeof selectHardwareAdapter>,
  modelState: ReturnType<typeof createModelState>,
  pressSequenceState: ReturnType<typeof createPressSequenceState>,
  emergencyButtonState: ReturnType<typeof createEmergencyButtonState>,
  config: PrototypeRuntimeConfig,
  nowMs: number,
): TickResult {
  // Button events
  const buttonResult = handleButtonEvents(state, adapters, pressSequenceState, emergencyButtonState, nowMs);
  let currentState = buttonResult.state;

  if (currentState.phase === 'shutdown') {
    const { state: s, announcements } = consumeAnnouncements(currentState);
    const { state: s2, hapticCommands } = consumeHapticCommands(s);
    return { state: s2, modelState, announcements, hapticCommands, shouldContinue: false };
  }

  if (currentState.phase !== 'running') {
    return { state: currentState, modelState, announcements: [], hapticCommands: [], shouldContinue: false };
  }

  // Frame processing
  const frameResult = processFrame(currentState, adapters, adapterConfig, modelState, nowMs);
  currentState = frameResult.state;
  let currentModelState = frameResult.modelState;

  // Health check
  if (currentState.tick - currentState.lastHealthCheckTick >= config.healthCheckIntervalTicks) {
    const healthResult = runHealthCheck(currentState, adapters, currentModelState, nowMs);
    currentState = healthResult.state;

    if (healthResult.result.shouldShutdown) {
      currentState = runShutdown(currentState, 'Critical hardware failure', nowMs);
      const { state: s, announcements } = consumeAnnouncements(currentState);
      const { state: s2, hapticCommands } = consumeHapticCommands(s);
      return { state: s2, modelState: currentModelState, announcements, hapticCommands, shouldContinue: false };
    }

    if (healthResult.result.shouldRestart) {
      currentState = runRestart(currentState, nowMs);
      const { state: s, announcements } = consumeAnnouncements(currentState);
      const { state: s2, hapticCommands } = consumeHapticCommands(s);
      return { state: s2, modelState: currentModelState, announcements, hapticCommands, shouldContinue: false };
    }
  }

  // Drain queues
  const { state: s, announcements } = consumeAnnouncements(currentState);
  const { state: s2, hapticCommands } = consumeHapticCommands(s);

  const maxReached = config.maxFrames !== null && s2.frameCount >= config.maxFrames;
  return { state: s2, modelState: currentModelState, announcements, hapticCommands, shouldContinue: !maxReached };
}

// ─── Main Entry (Node.js / embedded Linux) ────────────────────────────────────

export async function startPrototypeRuntime(
  config: PrototypeRuntimeConfig = defaultConfig(),
): Promise<void> {
  const nowMs = Date.now();
  const bootOutcome = runFullBootSequence(config, nowMs);

  if (!bootOutcome.success) {
    for (const msg of bootOutcome.announcements) {
      console.error('[ANNOUNCE]', msg);
    }
    for (const err of bootOutcome.errors) {
      console.error('[BOOT_ERROR]', err);
    }
    console.error('[RUNTIME] Boot failed. Exiting.');
    return;
  }

  for (const msg of bootOutcome.announcements) {
    console.log('[ANNOUNCE]', msg);
  }

  let state = bootOutcome.state;
  let modelState = bootOutcome.modelState;
  const adapters = bootOutcome.adapters;
  const adapterConfig = bootOutcome.adapterConfig;
  let pressSequence = createPressSequenceState();
  let emergencyState = createEmergencyButtonState();
  let shouldContinue = true;

  console.log('[RUNTIME] Processing loop started. Session:', config.sessionId);

  while (shouldContinue) {
    const tickResult = runOneTick(
      state, adapters, adapterConfig, modelState,
      pressSequence, emergencyState, config, Date.now(),
    );

    state = tickResult.state;
    modelState = tickResult.modelState;
    shouldContinue = tickResult.shouldContinue;

    for (const msg of tickResult.announcements) {
      console.log('[ANNOUNCE]', msg);
    }
    for (const hap of tickResult.hapticCommands) {
      console.log('[HAPTIC]', hap);
    }

    // In real deployment: await next camera frame or setTimeout(framePeriodMs)
    // For test/sim: use sync loop with tick counter
    if (config.maxFrames !== null && state.frameCount >= config.maxFrames) {
      shouldContinue = false;
    }
  }

  console.log('[RUNTIME] Session ended. Frames:', state.frameCount, 'Dropped:', state.droppedFrames);
}

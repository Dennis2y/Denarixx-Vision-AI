// ─── Bring-Up Program: Prototype Runtime Entry Point ─────────────────────────
// Headless embedded runtime starter for Denarixx Vision Glasses compute module.
// Does NOT depend on React, browser APIs, or Next.js.
// Wires adapters → inference provider → embedded runtime lifecycle.
//
// Usage (bring-up, Linux):
//   DENARIXX_HAL_ADAPTER=simulation-test npx tsx src/runtime/startPrototypeRuntime.ts
//   DENARIXX_HAL_ADAPTER=embedded-prototype npx tsx src/runtime/startPrototypeRuntime.ts
//
// In production: compiled to native binary via esbuild + Node.js static bundle.
//
// Embedded-prototype startup flow:
//   create hardware adapters
//   → initialize camera
//   → create local inference provider
//   → load ONNX model (await provider.initialize)
//   → verify model ready (status === 'ready')
//   → begin frame processing loop

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
import {
  createHardwareAdapterSet,
  parseAdapterMode,
  EmbeddedSimulationFallbackError,
} from './adapters/createHardwareAdapterSet';
import {
  createLocalInferenceProvider,
} from './inference/createLocalInferenceProvider';
import type { LocalInferenceProvider } from './inference/localInferenceProviderTypes';
import {
  createEmbeddedGuardianContext,
} from './embeddedGuardianOrchestrator';
import type { EmbeddedGuardianContext } from './embeddedGuardianOrchestrator';

// ─── Adapter Assembly ─────────────────────────────────────────────────────────
// assembleSimulationAdapters: kept for backward compatibility with unit tests.
// New code should use createHardwareAdapterSet(env) which enforces the safety
// invariant that embedded-prototype never falls back to simulation-test.

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
    modelPath: process.env.DENARIXX_LOCAL_MODEL_PATH ?? '/opt/denarixx/models/hazard-detection.onnx',
    halAdapterEnv: process.env.DENARIXX_HAL_ADAPTER ?? 'simulation-test',
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
  // provider is created here but NOT yet initialized (initialize() is async).
  // Call await provider.initialize(modelPath) after runFullBootSequence in async contexts.
  provider: LocalInferenceProvider;
  errors: string[];
  announcements: string[];
}

export function runFullBootSequence(
  config: PrototypeRuntimeConfig,
  nowMs: number,
): BootSequenceOutcome {
  const adapterConfig = selectHardwareAdapter(config.halAdapterEnv);

  // Create the inference provider for the active adapter mode.
  // In embedded-prototype mode: OnnxLocalInferenceProvider (real; never mock).
  // In simulation-test mode: MockOnnxInferenceProvider (isSimulated: true).
  const provider = createLocalInferenceProvider(parseAdapterMode(config.halAdapterEnv));

  // Use the real adapter factory — enforces the embedded-prototype safety invariant.
  // For simulation-test (CI/dev): returns synthetic adapters.
  // For embedded-prototype: returns physical HAL stubs; throws EmbeddedSimulationFallbackError
  //   if any code path would silently activate simulation-test instead.
  let adapterSetResult;
  try {
    adapterSetResult = createHardwareAdapterSet(config.halAdapterEnv);
  } catch (err) {
    if (err instanceof EmbeddedSimulationFallbackError) {
      console.error('[BOOT_SAFETY]', err.message);
      const failedState = createEmbeddedRuntimeState(config.sessionId);
      return {
        success: false,
        state: { ...failedState, phase: 'failed' },
        adapters: assembleSimulationAdapters(false),  // return something typed; never used
        adapterConfig,
        modelState: createModelState(adapterConfig.inferenceRuntime),
        provider,
        errors: [err.message],
        announcements: ['Safety check failed. Cannot start in embedded mode with simulation adapters.'],
      };
    }
    throw err;
  }

  const adapters = adapterSetResult.adapters;
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
    return { success: false, state, adapters, adapterConfig, modelState, provider, errors: allErrors, announcements: allAnnouncements };
  }

  // Phase: sensor-init
  state = runSensorInit(state, adapters, nowMs);

  // Phase: camera-init
  state = runCameraInit(state, adapters, nowMs);
  if (state.phase === 'failed') {
    return { success: false, state, adapters, adapterConfig, modelState, provider, errors: allErrors, announcements: allAnnouncements };
  }

  // Phase: model-load
  const modelLoadResult = runModelLoad(state, adapterConfig, modelState, config.modelPath, nowMs);
  state = modelLoadResult.state;
  modelState = modelLoadResult.modelState;
  allAnnouncements.push(...state.announcements.slice(allAnnouncements.length));

  if (state.phase === 'failed') {
    return { success: false, state, adapters, adapterConfig, modelState, provider, errors: allErrors, announcements: allAnnouncements };
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
    provider,
    errors: allErrors,
    announcements: allAnnouncements,
  };
}

// ─── Processing Loop (single tick — called by external scheduler) ─────────────

export interface TickResult {
  state: EmbeddedRuntimeState;
  modelState: ReturnType<typeof createModelState>;
  guardianContext: EmbeddedGuardianContext | null;
  announcements: string[];
  hapticCommands: string[];
  shouldContinue: boolean;
}

// runOneTick is async because processFrame is async (ONNX inference is async).
export async function runOneTick(
  state: EmbeddedRuntimeState,
  adapters: HardwareAdapterSet,
  adapterConfig: ReturnType<typeof selectHardwareAdapter>,
  modelState: ReturnType<typeof createModelState>,
  pressSequenceState: ReturnType<typeof createPressSequenceState>,
  emergencyButtonState: ReturnType<typeof createEmergencyButtonState>,
  provider: LocalInferenceProvider | null,
  config: PrototypeRuntimeConfig,
  nowMs: number,
  guardianContext?: EmbeddedGuardianContext | null,
): Promise<TickResult> {
  // Button events
  const buttonResult = handleButtonEvents(state, adapters, pressSequenceState, emergencyButtonState, nowMs);
  let currentState = buttonResult.state;

  const currentGuardianCtx = guardianContext ?? null;

  if (currentState.phase === 'shutdown') {
    const { state: s, announcements } = consumeAnnouncements(currentState);
    const { state: s2, hapticCommands } = consumeHapticCommands(s);
    return { state: s2, modelState, guardianContext: currentGuardianCtx, announcements, hapticCommands, shouldContinue: false };
  }

  if (currentState.phase !== 'running') {
    return { state: currentState, modelState, guardianContext: currentGuardianCtx, announcements: [], hapticCommands: [], shouldContinue: false };
  }

  // Frame processing (async — ONNX inference + real Guardian pipeline)
  const frameResult = await processFrame(currentState, adapters, adapterConfig, modelState, nowMs, provider, currentGuardianCtx);
  currentState = frameResult.state;
  let currentModelState = frameResult.modelState;
  let updatedGuardianCtx = frameResult.guardianContext;

  // Health check
  if (currentState.tick - currentState.lastHealthCheckTick >= config.healthCheckIntervalTicks) {
    const healthResult = runHealthCheck(currentState, adapters, currentModelState, nowMs);
    currentState = healthResult.state;

    if (healthResult.result.shouldShutdown) {
      currentState = runShutdown(currentState, 'Critical hardware failure', nowMs);
      const { state: s, announcements } = consumeAnnouncements(currentState);
      const { state: s2, hapticCommands } = consumeHapticCommands(s);
      return { state: s2, modelState: currentModelState, guardianContext: updatedGuardianCtx, announcements, hapticCommands, shouldContinue: false };
    }

    if (healthResult.result.shouldRestart) {
      currentState = runRestart(currentState, nowMs);
      const { state: s, announcements } = consumeAnnouncements(currentState);
      const { state: s2, hapticCommands } = consumeHapticCommands(s);
      return { state: s2, modelState: currentModelState, guardianContext: updatedGuardianCtx, announcements, hapticCommands, shouldContinue: false };
    }
  }

  // Drain queues
  const { state: s, announcements } = consumeAnnouncements(currentState);
  const { state: s2, hapticCommands } = consumeHapticCommands(s);

  const maxReached = config.maxFrames !== null && s2.frameCount >= config.maxFrames;
  return { state: s2, modelState: currentModelState, guardianContext: updatedGuardianCtx, announcements, hapticCommands, shouldContinue: !maxReached };
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

  // Initialize the ONNX inference provider (async step — loads model file).
  // This is separate from runFullBootSequence (which is sync) because
  // model loading requires async I/O.
  const provider = bootOutcome.provider;
  let activeProvider: LocalInferenceProvider | null = null;

  if (config.halAdapterEnv === 'embedded-prototype') {
    console.log('[RUNTIME] Initializing ONNX inference provider:', config.modelPath);
    const providerStatus = await provider.initialize(config.modelPath);
    if (providerStatus !== 'ready') {
      const msg = 'Local vision is unavailable. Please stop and seek assistance.';
      console.error('[RUNTIME] ONNX provider initialization failed:', providerStatus);
      console.error('[ANNOUNCE]', msg);
      // Do not fall back to simulation. Announce and exit safely.
      return;
    }
    activeProvider = provider;
    console.log('[RUNTIME] ONNX inference provider ready.');
  } else {
    // Simulation or browser mode: initialize mock provider (immediate, returns ready)
    await provider.initialize('simulation');
    activeProvider = provider;
  }

  let state = bootOutcome.state;
  let modelState = bootOutcome.modelState;
  const adapters = bootOutcome.adapters;
  const adapterConfig = bootOutcome.adapterConfig;
  let pressSequence = createPressSequenceState();
  let emergencyState = createEmergencyButtonState();
  // Create the shared Guardian context (holds CognitiveGuardianEngine + CoordinationState)
  let guardianCtx = createEmbeddedGuardianContext();
  let shouldContinue = true;

  console.log('[RUNTIME] Processing loop started. Session:', config.sessionId);

  while (shouldContinue) {
    const tickResult = await runOneTick(
      state, adapters, adapterConfig, modelState,
      pressSequence, emergencyState, activeProvider, config, Date.now(),
      guardianCtx,
    );

    state = tickResult.state;
    modelState = tickResult.modelState;
    if (tickResult.guardianContext) guardianCtx = tickResult.guardianContext;
    shouldContinue = tickResult.shouldContinue;

    for (const msg of tickResult.announcements) {
      console.log('[ANNOUNCE]', msg);
    }
    for (const hap of tickResult.hapticCommands) {
      console.log('[HAPTIC]', hap);
    }

    // In real deployment: await next camera frame or setTimeout(framePeriodMs)
    if (config.maxFrames !== null && state.frameCount >= config.maxFrames) {
      shouldContinue = false;
    }
  }

  // Shutdown: release ONNX session and camera
  if (activeProvider) {
    await activeProvider.shutdown();
    console.log('[RUNTIME] Inference provider shut down.');
  }

  console.log('[RUNTIME] Session ended. Frames:', state.frameCount, 'Dropped:', state.droppedFrames);
}

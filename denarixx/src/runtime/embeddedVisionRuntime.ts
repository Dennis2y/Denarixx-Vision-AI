// ─── Bring-Up Program: Embedded Vision Runtime ───────────────────────────────
// Headless runtime for Denarixx Vision Glasses compute module.
// Reuses the same domain engines as useVisionSession.ts.
// Does NOT duplicate Guardian logic — imports from canonical engines.
// Does NOT depend on React, browser APIs, or Next.js.
// Entry point: startPrototypeRuntime.ts
//
// Pipeline:
//   Camera/HAL → Local Inference → Spatial Context → Guardian
//   → Alert Quality → Alert Coordination → Audio / Haptics
//
// Lifecycle:
//   boot → sensor-init → camera-init → model-load → session-start
//   → processing-loop → [health-monitor] → emergency-stop | shutdown | restart

import type { HardwareAdapterSet, SystemAdapterHealth } from './adapters/hardwareAdapterTypes';
import { getSystemHealth, buildHealthAnnouncement, isCriticalAdapterAvailable } from './adapters/hardwareAdapterTypes';
import type { HardwareAdapterConfig, LocalModelState } from '@/types/localInference';
import {
  createModelState,
  modelStateAfterLoad,
  modelStateAfterFailure,
  runLocalInference,
  buildInferenceHealthReport,
} from '@/engines/localInferenceEngine';
import {
  processButtonEvent,
  createPressSequenceState,
  createEmergencyButtonState,
  activateEmergencyStop,
  EMERGENCY_ANNOUNCEMENT,
} from '@/engines/hardwareButtonEngine';
import type { ButtonEvent } from './adapters/hardwareAdapterTypes';
import type { RuntimeState } from '@/engines/hardwareButtonEngine';
import {
  createCalibrationSession,
  getStepInstruction,
} from '@/engines/sensorCalibrationEngine';
import {
  recordFrameTick,
  recordSample,
} from '@/engines/hiltTestHarnessEngine';
import type { HILTSession } from '@/engines/hiltTestHarnessEngine';
import type { LocalInferenceProvider } from './inference/localInferenceProviderTypes';
import { assertNoSimulatedDetectionsInEmbeddedMode } from './inference/createLocalInferenceProvider';
import type { EmbeddedInferenceDetection, EmbeddedGuardianInput } from '@/types/embeddedGuardian';
import {
  runEmbeddedGuardianPipeline,
  buildBatteryThermalAlert,
} from './embeddedGuardianOrchestrator';
import type { EmbeddedGuardianContext } from './embeddedGuardianOrchestrator';

// ─── Runtime Lifecycle State ─────────────────────────────────────────────────

export type EmbeddedLifecyclePhase =
  | 'created'
  | 'booting'
  | 'sensor-init'
  | 'camera-init'
  | 'model-loading'
  | 'session-starting'
  | 'running'
  | 'emergency'
  | 'shutting-down'
  | 'shutdown'
  | 'restarting'
  | 'failed';

export interface EmbeddedRuntimeState {
  phase: EmbeddedLifecyclePhase;
  tick: number;
  sessionId: string;
  startedAt: number | null;
  frameCount: number;
  droppedFrames: number;
  providerFailures: number;
  lastInferenceMs: number;
  lastGuardianLatencyMs: number;
  lastHealthCheckTick: number;
  emergencyActive: boolean;
  shutdownReason: string | null;
  errors: string[];
  announcements: string[];    // speech queue (consumed by audio adapter)
  hapticCommands: string[];   // haptic queue (consumed by haptic adapter)
  runtimeState: RuntimeState;
}

export function createEmbeddedRuntimeState(sessionId: string): EmbeddedRuntimeState {
  return {
    phase: 'created',
    tick: 0,
    sessionId,
    startedAt: null,
    frameCount: 0,
    droppedFrames: 0,
    providerFailures: 0,
    lastInferenceMs: 0,
    lastGuardianLatencyMs: 0,
    lastHealthCheckTick: 0,
    emergencyActive: false,
    shutdownReason: null,
    errors: [],
    announcements: [],
    hapticCommands: [],
    runtimeState: 'idle',
  };
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

export interface BootResult {
  success: boolean;
  phase: EmbeddedLifecyclePhase;
  durationMs: number;
  errors: string[];
  announcements: string[];
}

export function runBoot(
  state: EmbeddedRuntimeState,
  adapters: HardwareAdapterSet,
  nowMs: number,
): { state: EmbeddedRuntimeState; result: BootResult } {
  const startMs = nowMs;
  const errors: string[] = [];
  const announcements: string[] = [];

  announcements.push('Denarixx Vision glasses are starting.');

  const health = getSystemHealth(adapters);
  const healthMsg = buildHealthAnnouncement(health);
  if (healthMsg) {
    errors.push(healthMsg);
    announcements.push(healthMsg);
  }

  const success = isCriticalAdapterAvailable(health);
  const phase: EmbeddedLifecyclePhase = success ? 'sensor-init' : 'failed';

  return {
    state: {
      ...state,
      phase,
      startedAt: nowMs,
      errors: [...state.errors, ...errors],
      announcements: [...state.announcements, ...announcements],
    },
    result: {
      success,
      phase,
      durationMs: nowMs - startMs,
      errors,
      announcements,
    },
  };
}

// ─── Sensor Initialisation ────────────────────────────────────────────────────

export function runSensorInit(
  state: EmbeddedRuntimeState,
  adapters: HardwareAdapterSet,
  nowMs: number,
): EmbeddedRuntimeState {
  const health = getSystemHealth(adapters);
  const announcements: string[] = [];

  if (!adapters.imu.isAvailable()) {
    announcements.push('Motion sensor unavailable. Heading guidance will be limited.');
  }
  if (!adapters.battery.isAvailable()) {
    announcements.push('Battery monitoring unavailable. Safety shutdowns may not trigger correctly.');
  }

  return {
    ...state,
    phase: 'camera-init',
    announcements: [...state.announcements, ...announcements],
    lastHealthCheckTick: state.tick,
  };
}

// ─── Camera Initialisation ────────────────────────────────────────────────────

export function runCameraInit(
  state: EmbeddedRuntimeState,
  adapters: HardwareAdapterSet,
  nowMs: number,
): EmbeddedRuntimeState {
  const cameraAvailable = adapters.camera.isAvailable();
  const announcements: string[] = [];
  const errors: string[] = [];

  if (!cameraAvailable) {
    const msg = 'Camera input is unavailable. Please stop and check carefully.';
    announcements.push(msg);
    errors.push(msg);
    return {
      ...state,
      phase: 'failed',
      errors: [...state.errors, ...errors],
      announcements: [...state.announcements, ...announcements],
    };
  }

  return {
    ...state,
    phase: 'model-loading',
    announcements: [...state.announcements, ...announcements],
  };
}

// ─── Model Loading ────────────────────────────────────────────────────────────

export function runModelLoad(
  state: EmbeddedRuntimeState,
  adapterConfig: HardwareAdapterConfig,
  modelState: LocalModelState,
  modelPath: string,
  nowMs: number,
): { state: EmbeddedRuntimeState; modelState: LocalModelState } {
  const announcements: string[] = [];
  const errors: string[] = [];
  let newModelState = modelState;

  // In real deployment: load ONNX/TFLite model from flash storage
  // For bring-up: mark as loaded if model path exists
  if (modelPath && adapterConfig.mode !== 'simulation-test') {
    newModelState = modelStateAfterLoad(modelState, modelPath, nowMs);
    announcements.push('Safety model loaded. Vision is ready.');
  } else if (adapterConfig.mode === 'simulation-test') {
    newModelState = modelStateAfterLoad(modelState, 'simulation', nowMs);
  } else {
    const msg = 'Safety model failed to load. Vision guidance is unavailable.';
    newModelState = modelStateAfterFailure(modelState, msg);
    errors.push(msg);
    announcements.push(msg);
  }

  const phase: EmbeddedLifecyclePhase =
    newModelState.status === 'ready' ? 'session-starting' : 'failed';

  return {
    state: {
      ...state,
      phase,
      errors: [...state.errors, ...errors],
      announcements: [...state.announcements, ...announcements],
    },
    modelState: newModelState,
  };
}

// ─── Session Start ────────────────────────────────────────────────────────────

export function runSessionStart(
  state: EmbeddedRuntimeState,
  nowMs: number,
): EmbeddedRuntimeState {
  return {
    ...state,
    phase: 'running',
    runtimeState: 'running',
    startedAt: nowMs,
    announcements: [
      ...state.announcements,
      'Denarixx Vision is active. Obstacle detection has started.',
    ],
  };
}

// ─── Continuous Processing (one frame tick) ───────────────────────────────────

export interface FrameProcessingResult {
  detectionCount: number;
  inferenceLatencyMs: number;
  guardianLatencyMs: number;
  hazardAnnouncements: string[];
  hapticPatterns: string[];
  dropped: boolean;
  error: string | null;
}

// Detection shape used internally — same as EmbeddedInferenceDetection from @/types/embeddedGuardian.
// Real path: populated from InferenceDetection (onnx-local, isSimulated: false).
// Simulation path: populated from AnyDetection (isSimulated: true, only in simulation-test mode).
// Using the shared type directly keeps both paths compatible with the Guardian orchestrator.
type EmbeddedDetection = EmbeddedInferenceDetection;

// Announcement emitted when the local ONNX model or camera bytes are unavailable
// in embedded-prototype mode. Instructs the user to stop — no synthetic fallback.
const LOCAL_VISION_UNAVAILABLE_ANNOUNCEMENT =
  'Local vision is unavailable. Please stop and seek assistance.';

// processFrame is async because LocalInferenceProvider.runInference() is async.
//
// provider parameter:
//   - Pass the initialized LocalInferenceProvider in embedded-prototype mode.
//   - Pass null or omit in simulation-test or browser-development mode (uses runLocalInference).
//   - If mode is embedded-prototype but provider is null/undefined: announces vision unavailable.
//
// Safety invariant: in embedded-prototype mode, any isSimulated detection reaching
// this function throws EmbeddedSimulatedDetectionError.

// processFrame return also carries the updated guardianContext so callers can thread it forward.
export async function processFrame(
  state: EmbeddedRuntimeState,
  adapters: HardwareAdapterSet,
  adapterConfig: HardwareAdapterConfig,
  modelState: LocalModelState,
  nowMs: number,
  provider?: LocalInferenceProvider | null,
  guardianContext?: EmbeddedGuardianContext | null,
): Promise<{
  state: EmbeddedRuntimeState;
  result: FrameProcessingResult;
  modelState: LocalModelState;
  guardianContext: EmbeddedGuardianContext | null;
}> {
  const ctx = guardianContext ?? null;

  if (state.phase !== 'running') {
    return {
      state,
      modelState,
      guardianContext: ctx,
      result: {
        detectionCount: 0, inferenceLatencyMs: 0, guardianLatencyMs: 0,
        hazardAnnouncements: [], hapticPatterns: [], dropped: true,
        error: 'Runtime not in running state',
      },
    };
  }

  // 1. Get camera frame
  const frame = adapters.camera.getLastFrame(state.tick);
  if (!frame) {
    const error = 'Camera frame unavailable. Vision guidance interrupted.';
    return {
      state: { ...state, droppedFrames: state.droppedFrames + 1, tick: state.tick + 1 },
      modelState,
      guardianContext: ctx,
      result: {
        detectionCount: 0, inferenceLatencyMs: 0, guardianLatencyMs: 0,
        hazardAnnouncements: [error], hapticPatterns: ['device-failure'],
        dropped: true, error,
      },
    };
  }

  // 2. Run inference — path depends on adapter mode
  const isEmbeddedMode = adapters.mode === 'embedded-prototype';
  const inferenceStart = Date.now();
  let detections: EmbeddedDetection[] = [];
  let inferenceLatencyMs = 0;
  let inferenceError: string | null = null;

  if (isEmbeddedMode && provider) {
    // ── Embedded-prototype path: real ONNX inference ──────────────────────────
    // Requires real camera frame bytes. Never falls back to simulation.
    if (!frame.pixels) {
      // Camera returns a frame structure but no pixel bytes — physical camera not delivering data.
      const error = LOCAL_VISION_UNAVAILABLE_ANNOUNCEMENT;
      return {
        state: {
          ...state,
          droppedFrames: state.droppedFrames + 1,
          tick: state.tick + 1,
          announcements: [...state.announcements, error],
          hapticCommands: [...state.hapticCommands, 'device-failure'],
        },
        modelState,
        guardianContext: ctx,
        result: {
          detectionCount: 0, inferenceLatencyMs: 0, guardianLatencyMs: 0,
          hazardAnnouncements: [error], hapticPatterns: ['device-failure'],
          dropped: true, error,
        },
      };
    }

    const inferResult = await provider.runInference({
      pixels: frame.pixels,
      width: frame.width,
      height: frame.height,
      frameId: frame.frameId,
      timestampMs: frame.timestampMs,
    });
    inferenceLatencyMs = Date.now() - inferenceStart;
    inferenceError = inferResult.error;

    // Safety invariant: reject any simulated detections that somehow entered the pipeline.
    assertNoSimulatedDetectionsInEmbeddedMode('embedded-prototype', inferResult.detections);

    detections = inferResult.detections.map(d => ({
      className: d.className,
      confidence: d.confidence,
      isSimulated: d.isSimulated,
    }));
  } else if (isEmbeddedMode && !provider) {
    // Embedded mode requested but no provider initialized.
    // Announce and drop frame — never fabricate.
    const error = LOCAL_VISION_UNAVAILABLE_ANNOUNCEMENT;
    return {
      state: {
        ...state,
        droppedFrames: state.droppedFrames + 1,
        tick: state.tick + 1,
        announcements: [...state.announcements, error],
        hapticCommands: [...state.hapticCommands, 'device-failure'],
      },
      modelState,
      guardianContext: ctx,
      result: {
        detectionCount: 0, inferenceLatencyMs: 0, guardianLatencyMs: 0,
        hazardAnnouncements: [error], hapticPatterns: ['device-failure'],
        dropped: true, error,
      },
    };
  } else {
    // ── Simulation / browser path: uses runLocalInference (clearly labeled isSimulated) ──
    // runLocalInference returns SimulatedDetection[] (isSimulated: true) in simulation-test mode.
    // This path is NEVER reached in embedded-prototype mode (enforced above).
    const inferenceResult = runLocalInference(adapterConfig, modelState, state.tick, nowMs);
    inferenceLatencyMs = nowMs - inferenceStart + inferenceResult.inferenceLatencyMs;
    inferenceError = inferenceResult.error;
    detections = inferenceResult.detections.map(d => ({
      className: d.className,
      confidence: d.confidence,
      isSimulated: d.isSimulated,
    }));
  }

  // 3. Real Cognitive Guardian pipeline.
  // Detections flow through the shared orchestrator: HazardDetectionEngine →
  //   SafetyDecisionEngine → CognitiveGuardianEngine (AlertQualityEngine) →
  //   AlertCoordinationEngine → EmbeddedGuardianOutput.
  // No duplicate engine logic in this file — see embeddedGuardianOrchestrator.ts.
  const guardianStart = Date.now();
  const hazardAnnouncements: string[] = [];
  const hapticPatterns: string[] = [];
  let updatedCtx: EmbeddedGuardianContext | null = ctx;
  let guardianLatencyMs = 5;

  if (ctx) {
    // Build sensor context from available adapters (mark unavailable rather than fabricate)
    const battery = adapters.battery.isAvailable()
      ? adapters.battery.getLastReading(state.tick)
      : null;

    const guardianInput: EmbeddedGuardianInput = {
      detections,
      frameTimestampMs: nowMs,
      providerSource: isEmbeddedMode ? 'onnx-local' : 'simulation-test',
      sensors: {
        imuMovementState: adapters.imu.isAvailable() ? 'unknown' : undefined,
        gnssAvailable: false,
      },
      deviceHealth: {
        batteryPct: battery?.percentagePct,
        temperatureC: battery?.temperatureC,
      },
    };

    const orchestratorResult = await runEmbeddedGuardianPipeline(guardianInput, ctx);
    updatedCtx = orchestratorResult.context;
    const guardianOutput = orchestratorResult.output;
    guardianLatencyMs = Date.now() - guardianStart;

    if (guardianOutput.message) {
      hazardAnnouncements.push(guardianOutput.message);
    }
    if (guardianOutput.hapticPattern) {
      hapticPatterns.push(guardianOutput.hapticPattern);
    }

    // 4. Battery/thermal alerts every 30 ticks (system-priority; bypass Guardian dedup)
    if (state.tick - state.lastHealthCheckTick >= 30 && battery) {
      const batteryResult = buildBatteryThermalAlert(
        battery.percentagePct,
        battery.temperatureC,
        updatedCtx.coordinationState,
      );
      if (batteryResult.alert) {
        hazardAnnouncements.push(batteryResult.alert.message);
        hapticPatterns.push(batteryResult.alert.hapticPattern);
        updatedCtx = { ...updatedCtx, coordinationState: batteryResult.coordinationState };
      }
    }
  } else {
    // No guardian context — basic fallback (backward compatibility with older tests).
    // In production, always pass a guardian context created by createEmbeddedGuardianContext().
    for (const detection of detections) {
      if (detection.confidence >= 0.7) {
        if (['vehicle', 'bicycle', 'motorcycle', 'car', 'truck', 'bus'].includes(detection.className)) {
          hazardAnnouncements.push(`Warning. ${detection.className} detected ahead.`);
          hapticPatterns.push('obstacle-ahead');
        } else if (detection.className === 'person') {
          hazardAnnouncements.push('Person ahead.');
        } else if (detection.className === 'obstacle') {
          hazardAnnouncements.push('Obstacle ahead. Please slow down.');
          hapticPatterns.push('obstacle-ahead');
        }
      }
    }

    // Battery/thermal check every 30 ticks (no context: basic fallback)
    if (state.tick - state.lastHealthCheckTick >= 30) {
      const battery = adapters.battery.getLastReading(state.tick);
      if (battery) {
        if (battery.percentagePct <= 5) {
          hazardAnnouncements.push('Battery is critically low. Safety guidance will stop soon.');
          hapticPatterns.push('low-battery');
        } else if (battery.percentagePct <= 10) {
          hazardAnnouncements.push('Battery is low. Please charge soon.');
          hapticPatterns.push('low-battery');
        }
        if (battery.temperatureC >= 90) {
          hazardAnnouncements.push('Device is overheating. Shutting down for safety.');
          hapticPatterns.push('device-failure');
        }
      }
    }
  }

  const newState: EmbeddedRuntimeState = {
    ...state,
    tick: state.tick + 1,
    frameCount: state.frameCount + 1,
    lastInferenceMs: inferenceLatencyMs,
    lastGuardianLatencyMs: guardianLatencyMs,
    lastHealthCheckTick: state.tick - state.lastHealthCheckTick >= 30
      ? state.tick : state.lastHealthCheckTick,
    announcements: [...state.announcements, ...hazardAnnouncements],
    hapticCommands: [...state.hapticCommands, ...hapticPatterns],
  };

  return {
    state: newState,
    modelState,
    guardianContext: updatedCtx,
    result: {
      detectionCount: detections.length,
      inferenceLatencyMs,
      guardianLatencyMs,
      hazardAnnouncements,
      hapticPatterns,
      dropped: false,
      error: inferenceError,
    },
  };
}

// ─── Health Monitoring ────────────────────────────────────────────────────────

export interface HealthCheckResult {
  healthy: boolean;
  degraded: boolean;
  announcements: string[];
  hapticPatterns: string[];
  shouldRestart: boolean;
  shouldShutdown: boolean;
}

export function runHealthCheck(
  state: EmbeddedRuntimeState,
  adapters: HardwareAdapterSet,
  modelState: LocalModelState,
  nowMs: number,
): { state: EmbeddedRuntimeState; result: HealthCheckResult } {
  const health = getSystemHealth(adapters);
  const inferenceHealth = buildInferenceHealthReport(
    { mode: adapters.mode, inferenceRuntime: 'embedded-cpu-onnx', allowSimulationFallback: false, realUserMode: true },
    modelState,
    adapters.camera.isAvailable(),
    adapters.imu.isAvailable(),
  );

  const announcements: string[] = [];
  const hapticPatterns: string[] = [];

  if (health.camera === 'unavailable') {
    announcements.push('Camera input is unavailable. Please stop and check carefully.');
    hapticPatterns.push('device-failure');
  }
  if (health.audioOutput === 'unavailable') {
    hapticPatterns.push('device-failure');
  }
  if (inferenceHealth.latencyGrade === 'critical') {
    announcements.push('Vision processing is too slow. Guidance may be delayed.');
  }

  const shouldShutdown = health.camera === 'unavailable' && health.imu === 'unavailable';
  const shouldRestart = !shouldShutdown && state.errors.length > 10;

  const newState: EmbeddedRuntimeState = {
    ...state,
    lastHealthCheckTick: state.tick,
    announcements: [...state.announcements, ...announcements],
    hapticCommands: [...state.hapticCommands, ...hapticPatterns],
  };

  return {
    state: newState,
    result: {
      healthy: health.camera !== 'unavailable' && inferenceHealth.latencyGrade !== 'critical',
      degraded: health.camera === 'degraded' || inferenceHealth.latencyGrade === 'slow',
      announcements,
      hapticPatterns,
      shouldRestart,
      shouldShutdown,
    },
  };
}

// ─── Emergency Stop ───────────────────────────────────────────────────────────

export function runEmergencyStop(
  state: EmbeddedRuntimeState,
  nowMs: number,
): EmbeddedRuntimeState {
  return {
    ...state,
    phase: 'emergency',
    runtimeState: 'emergency',
    emergencyActive: true,
    announcements: [...state.announcements, EMERGENCY_ANNOUNCEMENT],
    hapticCommands: [...state.hapticCommands, 'stop-immediately'],
  };
}

// ─── Clean Shutdown ───────────────────────────────────────────────────────────

export function runShutdown(
  state: EmbeddedRuntimeState,
  reason: string,
  nowMs: number,
): EmbeddedRuntimeState {
  return {
    ...state,
    phase: 'shutdown',
    runtimeState: 'idle',
    shutdownReason: reason,
    announcements: [
      ...state.announcements,
      'Denarixx Vision is shutting down. Please remove the glasses safely.',
    ],
  };
}

// ─── Restart ─────────────────────────────────────────────────────────────────

export function runRestart(
  state: EmbeddedRuntimeState,
  nowMs: number,
): EmbeddedRuntimeState {
  return {
    ...createEmbeddedRuntimeState(state.sessionId),
    phase: 'booting',
    announcements: ['Restarting. Please wait.'],
  };
}

// ─── Button Event Processing ──────────────────────────────────────────────────

export function handleButtonEvents(
  state: EmbeddedRuntimeState,
  adapters: HardwareAdapterSet,
  pressSequenceState: ReturnType<typeof createPressSequenceState>,
  emergencyButtonState: ReturnType<typeof createEmergencyButtonState>,
  nowMs: number,
): {
  state: EmbeddedRuntimeState;
  pressSequenceState: ReturnType<typeof createPressSequenceState>;
  emergencyButtonState: ReturnType<typeof createEmergencyButtonState>;
} {
  const events = adapters.buttons.pollEvents();
  let currentState = state;
  let currentSequence = pressSequenceState;
  let currentEmergency = emergencyButtonState;

  for (const rawEvent of events) {
    const { result, updatedSequence } = processButtonEvent(
      rawEvent,
      currentSequence,
      currentState.runtimeState,
    );
    currentSequence = updatedSequence;

    if (result.isEmergency) {
      currentEmergency = activateEmergencyStop(currentEmergency, nowMs);
      currentState = runEmergencyStop(currentState, nowMs);
    } else if (result.changeState === 'running' && currentState.runtimeState === 'idle') {
      currentState = { ...currentState, runtimeState: 'running', phase: 'running' };
    } else if (result.changeState === 'idle' && currentState.runtimeState === 'running') {
      currentState = {
        ...currentState,
        runtimeState: 'idle',
        announcements: [...currentState.announcements, result.announcement],
      };
    }

    if (result.announcement) {
      currentState = {
        ...currentState,
        announcements: [...currentState.announcements, result.announcement],
      };
    }
  }

  return { state: currentState, pressSequenceState: currentSequence, emergencyButtonState: currentEmergency };
}

// ─── Announcement Queue Management ───────────────────────────────────────────

export function consumeAnnouncements(state: EmbeddedRuntimeState): {
  state: EmbeddedRuntimeState;
  announcements: string[];
} {
  const announcements = [...state.announcements];
  return { state: { ...state, announcements: [] }, announcements };
}

export function consumeHapticCommands(state: EmbeddedRuntimeState): {
  state: EmbeddedRuntimeState;
  hapticCommands: string[];
} {
  const hapticCommands = [...state.hapticCommands];
  return { state: { ...state, hapticCommands: [] }, hapticCommands };
}

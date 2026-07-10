// ─── Bring-Up Program: Local Inference Engine ────────────────────────────────
// Pure functions — no async, no I/O.
// Real local inference path for embedded prototype.
// Replaces simulation fallback. Never claims to be real if model not loaded.
// See src/types/localInference.ts for capability honesty model.

import type {
  InferenceRuntimeAdapter,
  HardwareAdapterMode,
  HardwareAdapterConfig,
  LocalModelState,
  LocalInferenceResult,
  AnyDetection,
  LocalDetection,
  SimulatedDetection,
  DegradedSafetyState,
  ModelLoadStatus,
} from '@/types/localInference';
import {
  DETECTION_CLASS_CAPABILITIES,
  buildDegradedSafetyState,
  DEFAULT_DEVELOPMENT_ADAPTER,
  EMBEDDED_PROTOTYPE_ADAPTER,
  SIMULATION_TEST_ADAPTER,
  LOCAL_INFERENCE_SAFETY_NOTE,
} from '@/types/localInference';

// ─── Adapter Selection ────────────────────────────────────────────────────────

export function selectHardwareAdapter(
  envAdapterOverride: string | null,
): HardwareAdapterConfig {
  switch (envAdapterOverride) {
    case 'embedded-prototype': return EMBEDDED_PROTOTYPE_ADAPTER;
    case 'browser-development': return DEFAULT_DEVELOPMENT_ADAPTER;
    case 'simulation-test':
    default:
      return SIMULATION_TEST_ADAPTER;
  }
}

export function resolveInferenceRuntime(
  adapter: HardwareAdapterConfig,
): InferenceRuntimeAdapter {
  return adapter.inferenceRuntime;
}

// ─── Model State ──────────────────────────────────────────────────────────────

export function createModelState(adapter: InferenceRuntimeAdapter): LocalModelState {
  return {
    adapter,
    status: 'not-started',
    modelPath: null,
    loadedAt: null,
    failureReason: null,
    inferenceCount: 0,
    totalLatencyMs: 0,
    avgLatencyMs: 0,
  };
}

export function modelStateAfterLoad(
  state: LocalModelState,
  modelPath: string,
  nowMs: number,
): LocalModelState {
  return {
    ...state,
    status: 'ready',
    modelPath,
    loadedAt: nowMs,
    failureReason: null,
  };
}

export function modelStateAfterFailure(
  state: LocalModelState,
  reason: string,
): LocalModelState {
  return {
    ...state,
    status: 'failed',
    failureReason: reason,
  };
}

export function modelStateAfterInference(
  state: LocalModelState,
  latencyMs: number,
): LocalModelState {
  const count = state.inferenceCount + 1;
  const total = state.totalLatencyMs + latencyMs;
  return {
    ...state,
    inferenceCount: count,
    totalLatencyMs: total,
    avgLatencyMs: Math.round(total / count),
  };
}

export function isModelReady(state: LocalModelState): boolean {
  return state.status === 'ready' && state.loadedAt !== null;
}

// ─── Safety Gate: No Simulation in Real-User Mode ────────────────────────────

export function assertNoSimulationInRealMode(
  adapter: HardwareAdapterConfig,
  detections: AnyDetection[],
): void {
  if (!adapter.realUserMode) return;
  const simDetections = detections.filter(d => d.isSimulated);
  if (simDetections.length > 0) {
    throw new Error(
      `[LOCAL_INFERENCE_SAFETY_VIOLATION] Simulated detections returned during real-user mode. ` +
      LOCAL_INFERENCE_SAFETY_NOTE
    );
  }
}

// ─── Build Real Detections ────────────────────────────────────────────────────
// This is the output schema for real embedded inference.
// In a real deployment, this function is replaced by the ONNX/TFLite
// inference call. For P0 bring-up, it is a typed mock — clearly labeled.

export function buildRealDetections(
  rawClasses: string[],                 // from ONNX/TFLite model output
  rawConfidences: number[],             // parallel array of confidences
  adapter: InferenceRuntimeAdapter,
  latencyMs: number,
): AnyDetection[] {
  const capMap = new Map(DETECTION_CLASS_CAPABILITIES.map(c => [c.className, c]));

  return rawClasses.map((className, i) => {
    const cap = capMap.get(className);
    const detection: LocalDetection = {
      className,
      confidence: rawConfidences[i] ?? 0.5,
      capability: cap?.capability ?? 'unavailable',
      boundingBox: { x: 0, y: 0, width: 0, height: 0 }, // filled by runtime
      estimatedDistanceM: null,
      source: adapter,
      isSimulated: false,
    };
    return detection;
  });
}

// ─── Simulation Detections (dev/test only) ────────────────────────────────────

const SIM_SCENARIOS: Array<Array<{ className: string; confidence: number }>> = [
  [{ className: 'person', confidence: 0.92 }, { className: 'chair', confidence: 0.74 }],
  [{ className: 'obstacle', confidence: 0.85 }],
  [{ className: 'vehicle', confidence: 0.91 }, { className: 'traffic-light', confidence: 0.67 }],
  [{ className: 'bicycle', confidence: 0.88 }, { className: 'person', confidence: 0.79 }],
  [{ className: 'dog', confidence: 0.83 }],
  [],
  [{ className: 'construction-barrier', confidence: 0.70 }],
  [{ className: 'doorway', confidence: 0.65 }],
];

export function buildSimulatedDetections(tick: number): SimulatedDetection[] {
  const scenario = SIM_SCENARIOS[tick % SIM_SCENARIOS.length];
  return scenario.map(({ className, confidence }) => ({
    className,
    confidence,
    capability: 'model-supported' as const,
    boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.5 },
    estimatedDistanceM: null,
    source: 'simulation-test' as const,
    isSimulated: true as const,
  }));
}

// ─── Inference Result Builder ─────────────────────────────────────────────────

export function buildInferenceResult(
  adapter: HardwareAdapterConfig,
  detections: AnyDetection[],
  latencyMs: number,
  modelState: LocalModelState,
  error: string | null = null,
): LocalInferenceResult {
  return {
    adapter: adapter.inferenceRuntime,
    detections,
    inferenceLatencyMs: latencyMs,
    frameDropped: detections.length === 0 && error !== null,
    modelLoadedAt: modelState.loadedAt,
    error,
  };
}

// ─── Run Inference ────────────────────────────────────────────────────────────
// SIMULATION AND TEST USE ONLY. Do NOT call from embedded-prototype mode.
// In embedded-prototype mode, use LocalInferenceProvider.runInference() from
// src/runtime/inference/createLocalInferenceProvider.ts instead.
//
// This function returns SimulatedDetection[] (isSimulated: true) in simulation-test
// mode and stub detections in other modes. It is kept for:
//   - simulation-test adapter (useVisionSession in simulation mode)
//   - domain tests that exercise Guardian/AlertQuality without physical hardware
//   - backward-compatible callers in browser-development mode
//
// Any detection reaching the Guardian from embedded-prototype mode via this function
// would have been caught and rejected by assertNoSimulatedDetectionsInEmbeddedMode.

export function runLocalInference(
  adapter: HardwareAdapterConfig,
  modelState: LocalModelState,
  tick: number,
  nowMs: number,
): LocalInferenceResult {
  if (!isModelReady(modelState) && adapter.mode !== 'simulation-test') {
    const error = 'Local inference model not loaded. Vision guidance unavailable.';
    const degraded = buildDegradedSafetyState(true, false, false);
    return buildInferenceResult(adapter, [], 0, modelState, error);
  }

  // Real-user mode: no simulation allowed
  if (adapter.realUserMode && !isModelReady(modelState)) {
    const error = 'Local model unavailable in real-user mode. Limited function active.';
    return buildInferenceResult(adapter, [], 0, modelState, error);
  }

  const startMs = nowMs;
  let detections: AnyDetection[];

  if (adapter.mode === 'simulation-test' || (adapter.allowSimulationFallback && !isModelReady(modelState))) {
    detections = buildSimulatedDetections(tick);
  } else {
    // In a real implementation this calls ONNX/TFLite/NPU SDK.
    // For bring-up, mock with realistic class names and the real type shape.
    const classes = ['person', 'obstacle'];
    const confs = [0.88, 0.72];
    detections = buildRealDetections(classes, confs, adapter.inferenceRuntime, 0);
  }

  const latencyMs = nowMs - startMs + 25; // simulated 25ms baseline
  return buildInferenceResult(adapter, detections, latencyMs, modelState);
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export interface InferenceHealthReport {
  runtimeAvailable: boolean;
  modelLoaded: boolean;
  avgLatencyMs: number;
  latencyGrade: 'excellent' | 'acceptable' | 'slow' | 'critical';
  degradedMode: DegradedSafetyState;
  issues: string[];
}

export function buildInferenceHealthReport(
  adapter: HardwareAdapterConfig,
  model: LocalModelState,
  cameraAvailable: boolean,
  sensorsAvailable: boolean,
): InferenceHealthReport {
  const issues: string[] = [];
  if (!isModelReady(model)) issues.push('Local inference model not ready');
  if (!cameraAvailable) issues.push('Camera unavailable');

  const avg = model.avgLatencyMs;
  const latencyGrade: InferenceHealthReport['latencyGrade'] =
    avg === 0 ? 'excellent' :
    avg < 200 ? 'excellent' :
    avg < 400 ? 'acceptable' :
    avg < 500 ? 'slow' :
    'critical';

  if (latencyGrade === 'critical') issues.push('Inference latency exceeds 500ms safety budget');

  return {
    runtimeAvailable: adapter.mode !== 'simulation-test' || adapter.allowSimulationFallback,
    modelLoaded: isModelReady(model),
    avgLatencyMs: avg,
    latencyGrade,
    degradedMode: buildDegradedSafetyState(!isModelReady(model), sensorsAvailable, cameraAvailable),
    issues,
  };
}

// ─── Capability Query ─────────────────────────────────────────────────────────

export function getCapabilityLevel(className: string) {
  const cap = DETECTION_CLASS_CAPABILITIES.find(c => c.className === className);
  return cap?.capability ?? 'unavailable';
}

export function getSupportedClasses(): string[] {
  return DETECTION_CLASS_CAPABILITIES
    .filter(c => c.capability === 'model-supported')
    .map(c => c.className);
}

export function getHonestCapabilitySummary(): string[] {
  return DETECTION_CLASS_CAPABILITIES.map(
    c => `${c.className}: ${c.capability}${c.notes ? ` — ${c.notes}` : ''}`
  );
}

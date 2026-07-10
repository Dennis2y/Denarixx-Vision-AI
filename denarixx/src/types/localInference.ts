// ─── Bring-Up Program: Local Inference Types ─────────────────────────────────
// Honest capability model for real embedded local inference.
// Replaces simulation-only fallback for real-user modes.
// Never merge with onDeviceAI.ts (V15 — different abstraction layer).

// ─── Runtime Adapters ─────────────────────────────────────────────────────────

export type InferenceRuntimeAdapter =
  | 'embedded-npu'          // NPU SDK (RKNN, Hailo, etc.) — best for production prototype
  | 'embedded-cpu-onnx'     // ONNX Runtime (CPU, no NPU)
  | 'embedded-cpu-tflite'   // TensorFlow Lite (CPU, mobile-optimised)
  | 'browser-tfjs'          // TensorFlow.js — DEVELOPMENT FALLBACK ONLY
  | 'simulation-test';      // Fully synthetic — NEVER in real-user mode

export type HardwareAdapterMode =
  | 'browser-development'   // Browser APIs (getUserMedia, Web Speech, Battery API)
  | 'embedded-prototype'    // Physical HAL drivers (I2C, SPI, MIPI-CSI, UART)
  | 'simulation-test';      // All inputs synthetic — for CI and unit tests

// ─── Capability Honesty ───────────────────────────────────────────────────────

export type DetectionCapabilityLevel =
  | 'model-supported'   // Class present in model vocabulary, reliably detected
  | 'heuristic'         // Inferred from geometry/context, not direct model output
  | 'experimental'      // Class attempted but accuracy not validated
  | 'unavailable';      // Class not supported by this runtime/model

export interface DetectionClassCapability {
  className: string;
  capability: DetectionCapabilityLevel;
  notes: string;
}

// ─── Detection Classes ────────────────────────────────────────────────────────

export const DETECTION_CLASS_CAPABILITIES: DetectionClassCapability[] = [
  { className: 'person',                capability: 'model-supported',  notes: 'High-priority safety class. All runtimes.' },
  { className: 'vehicle',               capability: 'model-supported',  notes: 'Cars, trucks, vans. All runtimes.' },
  { className: 'bicycle',               capability: 'model-supported',  notes: 'Pedal cycles. All runtimes.' },
  { className: 'motorcycle',            capability: 'model-supported',  notes: 'Motorcycles and scooters. All runtimes.' },
  { className: 'obstacle',              capability: 'heuristic',        notes: 'Derived from bounding-box geometry and depth estimate. Not a direct model class.' },
  { className: 'chair',                 capability: 'model-supported',  notes: 'COCO class. Common indoor hazard.' },
  { className: 'stairs',                capability: 'experimental',     notes: 'Depth + edge heuristic only. Accuracy not validated on physical hardware. Do not rely on alone.' },
  { className: 'doorway',               capability: 'heuristic',        notes: 'Derived from vertical edge pairs and opening geometry. Not a direct model class.' },
  { className: 'traffic-light',         capability: 'model-supported',  notes: 'COCO class. State (red/green) requires classifier extension.' },
  { className: 'construction-barrier',  capability: 'experimental',     notes: 'Colour and shape heuristic. Not validated outdoors at night.' },
  { className: 'dog',                   capability: 'model-supported',  notes: 'COCO animal class.' },
];

// ─── Inference Result ─────────────────────────────────────────────────────────

export interface LocalDetection {
  className: string;
  confidence: number;                   // 0.0–1.0
  capability: DetectionCapabilityLevel;
  boundingBox: { x: number; y: number; width: number; height: number };
  estimatedDistanceM: number | null;    // null if depth unavailable
  source: InferenceRuntimeAdapter;
  isSimulated: false;                   // structural: never true in real mode
}

export interface SimulatedDetection {
  className: string;
  confidence: number;
  capability: 'model-supported';
  boundingBox: { x: number; y: number; width: number; height: number };
  estimatedDistanceM: number | null;
  source: 'simulation-test';
  isSimulated: true;
}

export type AnyDetection = LocalDetection | SimulatedDetection;

export interface LocalInferenceResult {
  adapter: InferenceRuntimeAdapter;
  detections: AnyDetection[];
  inferenceLatencyMs: number;
  frameDropped: boolean;
  modelLoadedAt: number | null;         // Unix ms, null if model not yet loaded
  error: string | null;
}

// ─── Model Load State ─────────────────────────────────────────────────────────

export type ModelLoadStatus =
  | 'not-started'
  | 'loading'
  | 'ready'
  | 'failed'
  | 'unavailable';

export interface LocalModelState {
  adapter: InferenceRuntimeAdapter;
  status: ModelLoadStatus;
  modelPath: string | null;
  loadedAt: number | null;
  failureReason: string | null;
  inferenceCount: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
}

// ─── Adapter Selection ────────────────────────────────────────────────────────

export interface HardwareAdapterConfig {
  mode: HardwareAdapterMode;
  inferenceRuntime: InferenceRuntimeAdapter;
  allowSimulationFallback: boolean;     // MUST be false in real-user mode
  realUserMode: boolean;                // true = no synthetic detections allowed
}

export const DEFAULT_DEVELOPMENT_ADAPTER: HardwareAdapterConfig = {
  mode: 'browser-development',
  inferenceRuntime: 'browser-tfjs',
  allowSimulationFallback: true,        // OK in dev
  realUserMode: false,
};

export const EMBEDDED_PROTOTYPE_ADAPTER: HardwareAdapterConfig = {
  mode: 'embedded-prototype',
  inferenceRuntime: 'embedded-cpu-onnx',
  allowSimulationFallback: false,       // NEVER in prototype real-user mode
  realUserMode: true,
};

export const SIMULATION_TEST_ADAPTER: HardwareAdapterConfig = {
  mode: 'simulation-test',
  inferenceRuntime: 'simulation-test',
  allowSimulationFallback: true,        // OK in test/CI
  realUserMode: false,
};

// ─── Safety Constraints ───────────────────────────────────────────────────────

export const LOCAL_INFERENCE_SAFETY_NOTE = 'Simulation detections must never be used during real-user sessions. If local inference fails, the system must announce limited function, not silently substitute fakes.' as const;

export const OFFLINE_INFERENCE_PRIORITY = [
  '1. Real embedded local inference (ONNX / TFLite / NPU)',
  '2. Degraded sensor-based guidance (IMU + GPS heading only)',
  '3. Explicit limited-function announcement ("Vision guidance is unavailable. Please stop and check carefully.")',
] as const;

// ─── Degraded Mode ────────────────────────────────────────────────────────────

export type DegradedSafetyMode =
  | 'local-inference-active'      // Normal: real model running
  | 'sensor-guidance-only'        // No vision: IMU/GPS heading guidance only
  | 'limited-function-warning'    // No vision, no sensors: explicit spoken warning
  | 'emergency-stop';             // Critical failure: stop-and-wait guidance only

export interface DegradedSafetyState {
  mode: DegradedSafetyMode;
  reason: string;
  announcement: string;
  visionAvailable: boolean;
  sensorsAvailable: boolean;
  guardianActive: boolean;
}

export function buildDegradedSafetyState(
  localInferenceFailed: boolean,
  sensorsAvailable: boolean,
  cameraAvailable: boolean,
): DegradedSafetyState {
  if (!localInferenceFailed && cameraAvailable) {
    return {
      mode: 'local-inference-active',
      reason: 'Normal operation',
      announcement: '',
      visionAvailable: true,
      sensorsAvailable,
      guardianActive: true,
    };
  }
  if (sensorsAvailable) {
    return {
      mode: 'sensor-guidance-only',
      reason: 'Vision unavailable — sensor guidance active',
      announcement: 'Camera vision is unavailable. I will guide you using heading and motion sensors only. Please be extra cautious.',
      visionAvailable: false,
      sensorsAvailable: true,
      guardianActive: true,
    };
  }
  return {
    mode: 'limited-function-warning',
    reason: 'Vision and sensors unavailable',
    announcement: 'Vision guidance is unavailable. Please stop and check carefully before continuing.',
    visionAvailable: false,
    sensorsAvailable: false,
    guardianActive: false,
  };
}

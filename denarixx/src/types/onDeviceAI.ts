// ─── V15 On-Device AI Optimization Types ─────────────────────────────────────
// All types for edge inference, latency budgeting, battery optimization,
// and offline-first safety path.

// ─── Runtimes ─────────────────────────────────────────────────────────────────

export type ModelRuntime =
  | 'browser'             // Native JS — always available, slowest
  | 'tensorflowjs'        // TensorFlow.js — CPU/WebGL
  | 'onnx'                // ONNX Runtime Web — CPU/WASM
  | 'webgpu'              // WebGPU backend — fastest browser path
  | 'apple_neural_engine' // Core ML / ANE on iOS/macOS
  | 'qualcomm_npu';       // Qualcomm HTP / Hexagon DSP

export type RuntimeAvailability = 'available' | 'placeholder' | 'unavailable';

export interface RuntimeCapability {
  runtime: ModelRuntime;
  availability: RuntimeAvailability;
  estimatedLatencyMs: number;
  supportsQuantized: boolean;
  powerEfficient: boolean;
}

// ─── Processing Mode ──────────────────────────────────────────────────────────

export type ProcessingMode = 'cloud' | 'edge' | 'local' | 'hybrid';
export type OfflineStatus = 'online' | 'offline' | 'degraded';
export type BatteryMode = 'performance' | 'balanced' | 'power_saver' | 'critical';

// ─── Model Descriptor ─────────────────────────────────────────────────────────

export type QuantizationStrategy = 'none' | 'int8' | 'float16' | 'int4';

export interface ModelDescriptor {
  id: string;
  name: string;
  runtime: ModelRuntime;
  quantization: QuantizationStrategy;
  estimatedLatencyMs: number;
  estimatedFPS: number;
  memorySizeMb: number;
  supportsRealTime: boolean;
}

// ─── Latency Budget ───────────────────────────────────────────────────────────

export interface LatencyBudget {
  perceptionMs: number;    // Object detection / vision inference
  reasoningMs: number;     // Cognitive Guardian / risk assessment
  speechMs: number;        // TTS synthesis
  totalMs: number;         // Sum of above
  criticalTargetMs: number; // Max for a safety-critical alert (must be ≤ 500ms)
}

export interface LatencyRecord {
  perceptionMs: number;
  reasoningMs: number;
  speechMs: number;
  totalMs: number;
  timestamp: number;
  withinBudget: boolean;
  isCritical: boolean;
}

export const DEFAULT_LATENCY_BUDGET: LatencyBudget = {
  perceptionMs: 150,
  reasoningMs: 100,
  speechMs: 200,
  totalMs: 450,
  criticalTargetMs: 500,
};

// ─── Edge Capabilities ────────────────────────────────────────────────────────

export interface EdgeCapabilities {
  supportedRuntimes: RuntimeCapability[];
  hasWebGPU: boolean;
  hasNPU: boolean;
  deviceClass: 'low_end' | 'mid_range' | 'high_end';
  estimatedFPS: number;
}

// ─── On-Device Config ─────────────────────────────────────────────────────────

export interface OnDeviceConfig {
  processingMode: ProcessingMode;
  selectedRuntime: ModelRuntime;
  targetFPS: number;
  offlineFirst: boolean;
  criticalAlertsLocal: boolean;
  cloudFallbackEnabled: boolean;
}

export const DEFAULT_ONDEVICE_CONFIG: OnDeviceConfig = {
  processingMode: 'hybrid',
  selectedRuntime: 'browser',
  targetFPS: 5,
  offlineFirst: false,
  criticalAlertsLocal: true,
  cloudFallbackEnabled: true,
};

// ─── Performance Dashboard ────────────────────────────────────────────────────

export interface PerformanceDashboard {
  fps: number;
  inferenceMs: number;
  batteryMode: BatteryMode;
  selectedRuntime: ModelRuntime;
  cloudStatus: OfflineStatus;
  localSafetyActive: boolean;
  offlineMode: boolean;
  latencyBudgetExceeded: boolean;
  processingMode: ProcessingMode;
}

// ─── Battery Profile ──────────────────────────────────────────────────────────

export interface BatteryOptimizationProfile {
  mode: BatteryMode;
  targetFPS: number;
  maxInferenceMs: number;
  pauseCloudReasoning: boolean;
  prioritizeLocal: boolean;
  skipPeripheralCameras: boolean;
  reduceModelComplexity: boolean;
}

// ─── Offline Safety ───────────────────────────────────────────────────────────

export interface OfflineSafetyPath {
  active: boolean;
  reason: string;
  localDetectionEnabled: boolean;
  localNavigationEnabled: boolean;
  localSpeechEnabled: boolean;
  cloudUnavailableMessage: string;
}

export const OFFLINE_SAFETY_MESSAGE =
  'Online AI is unavailable. Local safety mode is active.';

export const CLOUD_UNAVAILABLE_LABELS = [
  'car', 'person', 'stairs', 'construction_barrier', 'bicycle',
] as const;

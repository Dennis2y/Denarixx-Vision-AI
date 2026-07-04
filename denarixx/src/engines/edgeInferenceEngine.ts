// ─── V15 Edge Inference Engine ────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Edge inference pipeline, frame skipping, and performance metrics.

import type {
  ModelRuntime,
  BatteryMode,
  PerformanceDashboard,
  OfflineStatus,
  ProcessingMode,
} from '@/types/onDeviceAI';
import { selectOptimalModel, estimateModelLatency } from '@/engines/modelOptimizationEngine';

// ─── Simulated Detection Scenarios ───────────────────────────────────────────

const EDGE_SCENARIOS: string[][] = [
  ['person', 'pavement'],
  ['stairs'],
  ['car', 'crosswalk'],
  ['person', 'bicycle'],
  ['construction_barrier'],
  ['dog', 'person'],
  [],
  ['car'],
];

export function buildEdgeDetections(runtime: ModelRuntime, tick: number): string[] {
  // Higher-latency runtimes "miss" more detections (lower confidence)
  const cap = runtime === 'browser' ? 0.6 : 1.0;
  const scenario = EDGE_SCENARIOS[tick % EDGE_SCENARIOS.length];
  // Randomly skip detections based on runtime capability
  const seed = tick * 31 + runtime.length * 7;
  return scenario.filter((_, i) => ((seed + i * 13) % 10) / 10 < cap);
}

// ─── FPS Estimation ───────────────────────────────────────────────────────────

export function estimateEdgeFPS(
  runtime: ModelRuntime,
  batteryMode: BatteryMode,
): number {
  const model = selectOptimalModel(runtime, batteryMode);
  const batteryMultiplier: Record<BatteryMode, number> = {
    performance: 1.0,
    balanced: 0.7,
    power_saver: 0.5,
    critical: 0.25,
  };
  return Math.round(model.estimatedFPS * batteryMultiplier[batteryMode] * 10) / 10;
}

// ─── Frame Skipping ───────────────────────────────────────────────────────────

export function shouldSkipFrame(
  lastFrameAtMs: number,
  targetFPS: number,
  nowMs = Date.now(),
): boolean {
  if (targetFPS <= 0) return true;
  const intervalMs = 1000 / targetFPS;
  return nowMs - lastFrameAtMs < intervalMs;
}

export function getFrameIntervalMs(fps: number): number {
  if (fps <= 0) return Infinity;
  return Math.round(1000 / fps);
}

// ─── Inference Latency Simulation ─────────────────────────────────────────────

export function simulateInferenceLatency(runtime: ModelRuntime, batteryMode: BatteryMode): number {
  const base = estimateModelLatency(runtime, batteryMode);
  // Add ±10% jitter
  const jitter = (Math.random() - 0.5) * base * 0.2;
  return Math.max(1, Math.round(base + jitter));
}

// ─── Performance Dashboard ────────────────────────────────────────────────────

export function buildPerformanceDashboard(
  runtime: ModelRuntime,
  batteryMode: BatteryMode,
  cloudStatus: OfflineStatus,
  processingMode: ProcessingMode,
  inferenceMs: number,
): PerformanceDashboard {
  const fps = estimateEdgeFPS(runtime, batteryMode);
  return {
    fps,
    inferenceMs,
    batteryMode,
    selectedRuntime: runtime,
    cloudStatus,
    localSafetyActive: cloudStatus !== 'online',
    offlineMode: cloudStatus === 'offline',
    latencyBudgetExceeded: inferenceMs > 400,
    processingMode,
  };
}

export function formatRuntime(runtime: ModelRuntime): string {
  const labels: Record<ModelRuntime, string> = {
    browser: 'Browser JS',
    tensorflowjs: 'TensorFlow.js',
    onnx: 'ONNX Runtime',
    webgpu: 'WebGPU',
    apple_neural_engine: 'Apple Neural Engine',
    qualcomm_npu: 'Qualcomm NPU',
  };
  return labels[runtime];
}

export function formatProcessingMode(mode: ProcessingMode): string {
  const labels: Record<ProcessingMode, string> = {
    cloud: '☁️ Cloud',
    edge: '⚡ Edge',
    local: '📱 Local',
    hybrid: '🔀 Hybrid',
  };
  return labels[mode];
}

// ─── Edge vs Cloud Routing ────────────────────────────────────────────────────

export function shouldRouteToEdge(
  cloudStatus: OfflineStatus,
  isCritical: boolean,
): boolean {
  if (isCritical) return true;  // Critical always uses edge
  return cloudStatus !== 'online';
}

export function getRoutingLabel(edge: boolean): string {
  return edge ? '⚡ Edge / Local' : '☁️ Cloud';
}

// ─── Simulated Inference Frame ────────────────────────────────────────────────

export function runSimulatedEdgeFrame(
  runtime: ModelRuntime,
  batteryMode: BatteryMode,
  tick: number,
): { detections: string[]; inferenceMs: number; fps: number } {
  const detections = buildEdgeDetections(runtime, tick);
  const inferenceMs = simulateInferenceLatency(runtime, batteryMode);
  const fps = estimateEdgeFPS(runtime, batteryMode);
  return { detections, inferenceMs, fps };
}

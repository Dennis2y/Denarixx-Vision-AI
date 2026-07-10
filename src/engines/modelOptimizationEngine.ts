// ─── V15 Model Optimization Engine ───────────────────────────────────────────
// Pure functions — no async, no I/O.
// Model selection, quantization strategy, and performance profiling.

import type {
  ModelRuntime,
  ModelDescriptor,
  BatteryMode,
  QuantizationStrategy,
} from '@/types/onDeviceAI';

// ─── Model Registry ───────────────────────────────────────────────────────────

const MODEL_REGISTRY: ModelDescriptor[] = [
  {
    id: 'yolov8n-browser',
    name: 'YOLOv8 Nano (Browser JS)',
    runtime: 'browser',
    quantization: 'none',
    estimatedLatencyMs: 800,
    estimatedFPS: 1.2,
    memorySizeMb: 6,
    supportsRealTime: false,
  },
  {
    id: 'yolov8n-tfjs',
    name: 'YOLOv8 Nano (TensorFlow.js)',
    runtime: 'tensorflowjs',
    quantization: 'float16',
    estimatedLatencyMs: 250,
    estimatedFPS: 4,
    memorySizeMb: 3.5,
    supportsRealTime: false,
  },
  {
    id: 'yolov8n-onnx-int8',
    name: 'YOLOv8 Nano (ONNX INT8)',
    runtime: 'onnx',
    quantization: 'int8',
    estimatedLatencyMs: 90,
    estimatedFPS: 11,
    memorySizeMb: 2,
    supportsRealTime: true,
  },
  {
    id: 'yolov8s-webgpu',
    name: 'YOLOv8 Small (WebGPU)',
    runtime: 'webgpu',
    quantization: 'float16',
    estimatedLatencyMs: 35,
    estimatedFPS: 28,
    memorySizeMb: 11,
    supportsRealTime: true,
  },
  {
    id: 'yolov8n-ane',
    name: 'YOLOv8 Nano (Apple Neural Engine)',
    runtime: 'apple_neural_engine',
    quantization: 'int4',
    estimatedLatencyMs: 8,
    estimatedFPS: 125,
    memorySizeMb: 1.2,
    supportsRealTime: true,
  },
  {
    id: 'yolov8n-npu',
    name: 'YOLOv8 Nano (Qualcomm NPU)',
    runtime: 'qualcomm_npu',
    quantization: 'int4',
    estimatedLatencyMs: 12,
    estimatedFPS: 83,
    memorySizeMb: 1.5,
    supportsRealTime: true,
  },
  {
    id: 'mobilenet-browser',
    name: 'MobileNetV3 (Browser — power saver)',
    runtime: 'browser',
    quantization: 'int8',
    estimatedLatencyMs: 400,
    estimatedFPS: 2.5,
    memorySizeMb: 2.1,
    supportsRealTime: false,
  },
];

export function getModelRegistry(): ModelDescriptor[] {
  return MODEL_REGISTRY;
}

export function getModelsByRuntime(runtime: ModelRuntime): ModelDescriptor[] {
  return MODEL_REGISTRY.filter((m) => m.runtime === runtime);
}

// ─── Model Selection ──────────────────────────────────────────────────────────

export function selectOptimalModel(
  runtime: ModelRuntime,
  batteryMode: BatteryMode,
): ModelDescriptor {
  const candidates = getModelsByRuntime(runtime);
  if (candidates.length === 0) return MODEL_REGISTRY[0];

  if (batteryMode === 'critical' || batteryMode === 'power_saver') {
    // Prefer smallest / fastest / most quantized
    return candidates.sort((a, b) => a.memorySizeMb - b.memorySizeMb)[0];
  }
  if (batteryMode === 'performance') {
    return candidates.sort((a, b) => b.estimatedFPS - a.estimatedFPS)[0];
  }
  // balanced — pick middle ground
  const sorted = candidates.sort((a, b) => a.estimatedLatencyMs - b.estimatedLatencyMs);
  return sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
}

// ─── Quantization ─────────────────────────────────────────────────────────────

export function getQuantizationStrategy(batteryMode: BatteryMode): QuantizationStrategy {
  switch (batteryMode) {
    case 'critical': return 'int4';
    case 'power_saver': return 'int8';
    case 'balanced': return 'float16';
    case 'performance': return 'none';
  }
}

export function shouldUseQuantized(batteryMode: BatteryMode): boolean {
  return batteryMode !== 'performance';
}

export function estimateModelLatency(runtime: ModelRuntime, batteryMode: BatteryMode): number {
  const model = selectOptimalModel(runtime, batteryMode);
  return model.estimatedLatencyMs;
}

// ─── Memory / Compute Estimates ───────────────────────────────────────────────

export function estimateMemoryFootprint(model: ModelDescriptor): string {
  if (model.memorySizeMb < 2) return `${Math.round(model.memorySizeMb * 1024)} KB`;
  return `${model.memorySizeMb.toFixed(1)} MB`;
}

export function getQuantizationLabel(q: QuantizationStrategy): string {
  const labels: Record<QuantizationStrategy, string> = {
    none: 'Full precision (FP32)',
    float16: 'Half precision (FP16)',
    int8: 'INT8 quantized',
    int4: 'INT4 quantized',
  };
  return labels[q];
}

export function getLatencyGrade(latencyMs: number): 'excellent' | 'good' | 'acceptable' | 'slow' {
  if (latencyMs < 50) return 'excellent';
  if (latencyMs < 150) return 'good';
  if (latencyMs < 400) return 'acceptable';
  return 'slow';
}

export function formatLatencyGrade(grade: ReturnType<typeof getLatencyGrade>): string {
  const map = { excellent: '🟢', good: '🟡', acceptable: '🟠', slow: '🔴' };
  return `${map[grade]} ${grade}`;
}

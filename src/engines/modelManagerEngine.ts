// ─── V12 Model Manager Engine ────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Manages the registry of supported inference models and their capabilities.

import type {
  ModelDescriptor,
  InferenceProvider,
  ObjectLabel,
  BatteryMode,
} from '@/types/vision12';
import { ALL_OBJECT_LABELS } from '@/types/vision12';

// ─── Model Registry ──────────────────────────────────────────────────────────

export const MODEL_REGISTRY: ModelDescriptor[] = [
  {
    id: 'sim-v12',
    provider: 'simulation',
    name: 'Simulation Engine V12',
    description: 'Deterministic simulation. Generates realistic detection data for development and testing.',
    inputSize: [640, 480],
    requiresCloud: false,
    supportsGPU: false,
    avgInferenceMs: 20,
    labels: ALL_OBJECT_LABELS,
    available: true,
  },
  {
    id: 'openai-gpt4v',
    provider: 'openai',
    name: 'OpenAI GPT-4 Vision',
    description: 'Cloud-based vision via GPT-4o. Excellent accuracy. Requires OPENAI_API_KEY.',
    inputSize: [1024, 1024],
    requiresCloud: true,
    supportsGPU: false,
    avgInferenceMs: 1200,
    labels: ALL_OBJECT_LABELS,
    available: false,
  },
  {
    id: 'gemini-vision',
    provider: 'gemini',
    name: 'Google Gemini Vision',
    description: 'Cloud-based vision via Gemini Pro. Requires GEMINI_API_KEY.',
    inputSize: [1024, 1024],
    requiresCloud: true,
    supportsGPU: false,
    avgInferenceMs: 900,
    labels: ALL_OBJECT_LABELS,
    available: false,
  },
  {
    id: 'onnx-mobilenet',
    provider: 'onnx',
    name: 'ONNX MobileNet',
    description: 'On-device ONNX model. Fast, private, no cloud. Requires model file download.',
    inputSize: [224, 224],
    requiresCloud: false,
    supportsGPU: true,
    avgInferenceMs: 80,
    labels: ['person', 'chair', 'table', 'car', 'bike', 'dog', 'bag'],
    available: false,
  },
  {
    id: 'yolo-v8n',
    provider: 'yolo',
    name: 'YOLOv8 Nano',
    description: 'Future: ultra-fast single-shot detection. Best for real-time obstacle detection.',
    inputSize: [640, 640],
    requiresCloud: false,
    supportsGPU: true,
    avgInferenceMs: 30,
    labels: ALL_OBJECT_LABELS,
    available: false,
  },
  {
    id: 'rtdetr-l',
    provider: 'rtdetr',
    name: 'RT-DETR Large',
    description: 'Future: real-time detection transformer. High accuracy with GPU.',
    inputSize: [640, 640],
    requiresCloud: false,
    supportsGPU: true,
    avgInferenceMs: 45,
    labels: ALL_OBJECT_LABELS,
    available: false,
  },
  {
    id: 'sam-vit-b',
    provider: 'sam',
    name: 'SAM ViT-B Segmentation',
    description: 'Future: Segment Anything Model. Full scene segmentation for depth and obstacle mapping.',
    inputSize: [1024, 1024],
    requiresCloud: false,
    supportsGPU: true,
    avgInferenceMs: 200,
    labels: ALL_OBJECT_LABELS,
    available: false,
  },
];

// ─── Queries ─────────────────────────────────────────────────────────────────

export function getModel(provider: InferenceProvider): ModelDescriptor {
  const model = MODEL_REGISTRY.find((m) => m.provider === provider);
  if (!model) {
    return MODEL_REGISTRY.find((m) => m.provider === 'simulation')!;
  }
  return model;
}

export function listAvailableModels(): ModelDescriptor[] {
  return MODEL_REGISTRY.filter((m) => m.available);
}

export function listAllModels(): ModelDescriptor[] {
  return [...MODEL_REGISTRY];
}

export function isModelAvailable(provider: InferenceProvider): boolean {
  const model = MODEL_REGISTRY.find((m) => m.provider === provider);
  return model?.available ?? false;
}

export function getRecommendedModel(
  batteryLevel: number,
  hasGpu: boolean,
  _batteryMode: BatteryMode = 'balanced',
): ModelDescriptor {
  const available = listAvailableModels();
  if (available.length === 0) {
    return getModel('simulation');
  }
  // Low battery: prefer fastest
  if (batteryLevel < 0.2) {
    return available.reduce((a, b) => (a.avgInferenceMs < b.avgInferenceMs ? a : b));
  }
  // Has GPU: prefer GPU-accelerated
  if (hasGpu) {
    const gpuModels = available.filter((m) => m.supportsGPU);
    if (gpuModels.length > 0) {
      return gpuModels.reduce((a, b) => (a.avgInferenceMs < b.avgInferenceMs ? a : b));
    }
  }
  // Default: lowest inference time among available
  return available.reduce((a, b) => (a.avgInferenceMs < b.avgInferenceMs ? a : b));
}

export function modelSupportsLabel(provider: InferenceProvider, label: ObjectLabel): boolean {
  const model = MODEL_REGISTRY.find((m) => m.provider === provider);
  return model ? model.labels.includes(label) : false;
}

export function getModelDisplayName(provider: InferenceProvider): string {
  return getModel(provider).name;
}

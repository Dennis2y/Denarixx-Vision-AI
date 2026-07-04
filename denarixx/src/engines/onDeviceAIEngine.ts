// ─── V15 On-Device AI Engine ──────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Model runtime abstraction and offline-first safety path.

import type {
  ModelRuntime,
  RuntimeCapability,
  RuntimeAvailability,
  EdgeCapabilities,
  OnDeviceConfig,
  ProcessingMode,
  OfflineStatus,
  OfflineSafetyPath,
  BatteryMode,
} from '@/types/onDeviceAI';
import {
  DEFAULT_ONDEVICE_CONFIG,
  OFFLINE_SAFETY_MESSAGE,
  CLOUD_UNAVAILABLE_LABELS,
} from '@/types/onDeviceAI';

// ─── Runtime Registry ─────────────────────────────────────────────────────────

const RUNTIME_REGISTRY: RuntimeCapability[] = [
  { runtime: 'browser',             availability: 'available',   estimatedLatencyMs: 800, supportsQuantized: false, powerEfficient: false },
  { runtime: 'tensorflowjs',        availability: 'placeholder', estimatedLatencyMs: 250, supportsQuantized: true,  powerEfficient: false },
  { runtime: 'onnx',                availability: 'placeholder', estimatedLatencyMs: 180, supportsQuantized: true,  powerEfficient: true  },
  { runtime: 'webgpu',              availability: 'placeholder', estimatedLatencyMs: 60,  supportsQuantized: true,  powerEfficient: true  },
  { runtime: 'apple_neural_engine', availability: 'placeholder', estimatedLatencyMs: 15,  supportsQuantized: true,  powerEfficient: true  },
  { runtime: 'qualcomm_npu',        availability: 'placeholder', estimatedLatencyMs: 20,  supportsQuantized: true,  powerEfficient: true  },
];

export function getRuntimeRegistry(): RuntimeCapability[] {
  return RUNTIME_REGISTRY;
}

export function getRuntimeCapability(runtime: ModelRuntime): RuntimeCapability {
  return RUNTIME_REGISTRY.find((r) => r.runtime === runtime) ?? RUNTIME_REGISTRY[0];
}

// ─── Runtime Detection ────────────────────────────────────────────────────────

export function detectAvailableRuntimes(): RuntimeCapability[] {
  // In browser, only 'browser' is guaranteed. Others are placeholders
  // that require real SDK integration.
  return RUNTIME_REGISTRY.filter((r) => r.availability === 'available');
}

export function getAvailabilityLabel(status: RuntimeAvailability): string {
  const labels: Record<RuntimeAvailability, string> = {
    available: '✅ Available',
    placeholder: '⏳ Placeholder',
    unavailable: '❌ Unavailable',
  };
  return labels[status];
}

// ─── Runtime Selection ────────────────────────────────────────────────────────

export function selectRuntime(
  capabilities: EdgeCapabilities,
  batteryMode: BatteryMode,
): ModelRuntime {
  const available = capabilities.supportedRuntimes.filter(
    (r) => r.availability === 'available' || r.availability === 'placeholder',
  );
  if (available.length === 0) return 'browser';

  // In power-saver / critical modes, prefer most power-efficient
  if (batteryMode === 'critical' || batteryMode === 'power_saver') {
    const efficient = available.filter((r) => r.powerEfficient);
    if (efficient.length > 0) {
      return efficient.sort((a, b) => a.estimatedLatencyMs - b.estimatedLatencyMs)[0].runtime;
    }
  }

  // Otherwise pick lowest latency available
  return available.sort((a, b) => a.estimatedLatencyMs - b.estimatedLatencyMs)[0].runtime;
}

// ─── Cloud Status ─────────────────────────────────────────────────────────────

export function isCloudAvailable(status: OfflineStatus): boolean {
  return status === 'online';
}

export function buildCloudStatusLabel(status: OfflineStatus): string {
  const labels: Record<OfflineStatus, string> = {
    online: '🟢 Online',
    offline: '🔴 Offline',
    degraded: '🟡 Degraded',
  };
  return labels[status];
}

// ─── Processing Mode Selection ────────────────────────────────────────────────

export function selectProcessingMode(
  cloudStatus: OfflineStatus,
  config: OnDeviceConfig,
  isCriticalAlert: boolean,
): ProcessingMode {
  if (isCriticalAlert && config.criticalAlertsLocal) return 'local';
  if (cloudStatus === 'offline') return 'local';
  if (cloudStatus === 'degraded') return 'edge';
  if (config.offlineFirst) return 'edge';
  return config.processingMode;
}

// ─── Offline Safety Path ──────────────────────────────────────────────────────

export function initOfflineSafetyPath(cloudStatus: OfflineStatus): OfflineSafetyPath {
  const active = cloudStatus !== 'online';
  return {
    active,
    reason: active ? 'Cloud AI unavailable' : '',
    localDetectionEnabled: true,
    localNavigationEnabled: true,
    localSpeechEnabled: true,
    cloudUnavailableMessage: active ? OFFLINE_SAFETY_MESSAGE : '',
  };
}

export function getOfflineSafetyMessage(): string {
  return OFFLINE_SAFETY_MESSAGE;
}

export function buildOfflineFallbackGuidance(detectedLabel: string): string {
  const knownLabel = (CLOUD_UNAVAILABLE_LABELS as readonly string[]).includes(detectedLabel);
  if (!knownLabel) return `Obstacle detected. Proceed carefully.`;
  switch (detectedLabel) {
    case 'car': return 'Vehicle nearby. Stop and check carefully before crossing.';
    case 'person': return 'Person ahead. Slow down.';
    case 'stairs': return 'Stairs ahead. Use the handrail.';
    case 'construction_barrier': return 'Construction ahead. Follow alternate route.';
    case 'bicycle': return 'Bicycle nearby. Stay to the right.';
    default: return 'Obstacle detected. Proceed carefully.';
  }
}

export function buildLocalHazardGuidance(labels: string[]): string {
  if (labels.length === 0) return '';
  const critical = labels.find((l) => l === 'car' || l === 'construction_barrier' || l === 'stairs');
  if (critical) return buildOfflineFallbackGuidance(critical);
  return buildOfflineFallbackGuidance(labels[0]);
}

// ─── Edge Capabilities ────────────────────────────────────────────────────────

export function buildSimulatedEdgeCapabilities(): EdgeCapabilities {
  return {
    supportedRuntimes: RUNTIME_REGISTRY,
    hasWebGPU: false,
    hasNPU: false,
    deviceClass: 'mid_range',
    estimatedFPS: 5,
  };
}

export function describeDeviceClass(capabilities: EdgeCapabilities): string {
  const labels = { low_end: 'Low-End Device', mid_range: 'Mid-Range Device', high_end: 'High-End Device' };
  return labels[capabilities.deviceClass];
}

export function buildDefaultConfig(): OnDeviceConfig {
  return { ...DEFAULT_ONDEVICE_CONFIG };
}

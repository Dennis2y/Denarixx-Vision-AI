// ─── V12 Camera Pipeline Engine ──────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Manages FPS targeting, frame skipping, and adaptive throttling.

import type { BatteryMode, PipelineConfig, PipelineMetrics } from '@/types/vision12';
import { DEFAULT_PIPELINE_CONFIG, PIPELINE_PRIVACY } from '@/types/vision12';

// ─── FPS Targets by Battery Mode ─────────────────────────────────────────────

const FPS_TARGETS: Record<BatteryMode, number> = {
  performance: 10,
  balanced: 5,
  power_save: 2,
};

const INTERVAL_MS: Record<BatteryMode, number> = {
  performance: 100,
  balanced: 200,
  power_save: 500,
};

// ─── FPS Calculation ─────────────────────────────────────────────────────────

export function computeTargetFps(
  batteryLevel: number,
  mode: BatteryMode,
  adaptiveFps: boolean,
): number {
  const base = FPS_TARGETS[mode];
  if (!adaptiveFps) return base;
  if (batteryLevel < 0.1) return Math.min(base, 2);
  if (batteryLevel < 0.2) return Math.min(base, 3);
  return base;
}

export function computeFrameIntervalMs(
  batteryLevel: number,
  mode: BatteryMode,
  adaptiveFps: boolean,
): number {
  const fps = computeTargetFps(batteryLevel, mode, adaptiveFps);
  return Math.round(1000 / fps);
}

export function computeBaseIntervalMs(mode: BatteryMode): number {
  return INTERVAL_MS[mode];
}

// ─── Frame Skipping ──────────────────────────────────────────────────────────

export function shouldSkipFrame(
  lastFrameTimestamp: number,
  nowTimestamp: number,
  targetIntervalMs: number,
): boolean {
  return nowTimestamp - lastFrameTimestamp < targetIntervalMs;
}

export function computeAdaptiveInterval(metrics: PipelineMetrics): number {
  if (metrics.framesProcessed === 0) return 200;
  const inferenceMs = metrics.averageInferenceLatencyMs;
  // Add 20% headroom on top of actual inference time, min 100ms, max 2000ms
  const raw = inferenceMs * 1.2;
  return Math.max(100, Math.min(2000, Math.round(raw)));
}

// ─── Config Building ─────────────────────────────────────────────────────────

export function buildPipelineConfig(
  overrides: Partial<PipelineConfig> = {},
): PipelineConfig {
  return {
    ...DEFAULT_PIPELINE_CONFIG,
    ...overrides,
    privacy: PIPELINE_PRIVACY,
  };
}

export function adjustConfigForBattery(
  config: PipelineConfig,
  batteryLevel: number,
): PipelineConfig {
  if (batteryLevel < 0.1) {
    return { ...config, batteryMode: 'power_save', targetFps: 2 };
  }
  if (batteryLevel < 0.2) {
    return { ...config, batteryMode: 'power_save', targetFps: 3 };
  }
  return config;
}

// ─── Metrics Update ──────────────────────────────────────────────────────────

export function updateMetrics(
  metrics: PipelineMetrics,
  frameLatencyMs: number,
  inferenceLatencyMs: number,
  objectCount: number,
  spokenGuidance: boolean,
): PipelineMetrics {
  const n = metrics.framesProcessed + 1;
  return {
    ...metrics,
    framesProcessed: n,
    averageFrameLatencyMs: rollingAvg(metrics.averageFrameLatencyMs, frameLatencyMs, n),
    averageInferenceLatencyMs: rollingAvg(metrics.averageInferenceLatencyMs, inferenceLatencyMs, n),
    averageFps: n > 1 ? Math.round(1000 / rollingAvg(metrics.averageFrameLatencyMs, frameLatencyMs, n)) : 0,
    objectsDetectedTotal: metrics.objectsDetectedTotal + objectCount,
    speechEventsTotal: metrics.speechEventsTotal + (spokenGuidance ? 1 : 0),
  };
}

function rollingAvg(current: number, newValue: number, n: number): number {
  return (current * (n - 1) + newValue) / n;
}

export function incrementSkipped(metrics: PipelineMetrics): PipelineMetrics {
  return { ...metrics, framesSkipped: metrics.framesSkipped + 1 };
}

export function incrementDropped(metrics: PipelineMetrics): PipelineMetrics {
  return { ...metrics, droppedFrames: metrics.droppedFrames + 1 };
}

// ─── Performance Assessment ──────────────────────────────────────────────────

export function isPerformanceHealthy(metrics: PipelineMetrics, config: PipelineConfig): boolean {
  if (metrics.framesProcessed < 5) return true;
  return metrics.averageInferenceLatencyMs <= config.maxInferenceMs;
}

export function getPerformanceLabel(metrics: PipelineMetrics): string {
  if (metrics.framesProcessed === 0) return 'Starting…';
  if (metrics.averageFps >= 8) return 'Excellent';
  if (metrics.averageFps >= 4) return 'Good';
  if (metrics.averageFps >= 2) return 'Fair';
  return 'Slow';
}

/**
 * Perception Latency Engine — Sprint 22: Real Perception Integration
 * Measures per-stage and end-to-end latency for the live perception pipeline.
 * Reuses latencyBudgetEngine.ts thresholds for critical alert timing.
 * Pure TypeScript — no browser APIs, fully testable in Node.js.
 */

import type {
  StageLatency,
  PerceptionFrameMetrics,
  PerceptionLatencyReport,
  PerceptionMode,
  PerceptionStage,
} from '@/types/livePerception';

// ── Frame metrics builder ──────────────────────────────────────────────────────

export function createFrameMetrics(mode: PerceptionMode): PerceptionFrameMetrics {
  return {
    frameId: `frame-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mode,
    startedAt: new Date(),
    completedAt: null,
    totalLatencyMs: null,
    stages: [],
    objectsDetected: 0,
    ocrCharactersRead: 0,
    alertsGenerated: 0,
    voicePriority: null,
  };
}

export function recordStage(
  metrics: PerceptionFrameMetrics,
  stage: PerceptionStage,
  latencyMs: number,
  success: boolean,
  errorMessage?: string,
): PerceptionFrameMetrics {
  const stageRecord: StageLatency = { stage, latencyMs, success, errorMessage };
  return { ...metrics, stages: [...metrics.stages, stageRecord] };
}

export function completeFrame(metrics: PerceptionFrameMetrics): PerceptionFrameMetrics {
  const now = new Date();
  const totalLatencyMs = now.getTime() - metrics.startedAt.getTime();
  return { ...metrics, completedAt: now, totalLatencyMs };
}

// ── Ring buffer for latency samples ───────────────────────────────────────────

const MAX_SAMPLES = 100;

export interface LatencySampleStore {
  samples: PerceptionFrameMetrics[];
  mode: PerceptionMode;
}

export function createLatencySampleStore(mode: PerceptionMode): LatencySampleStore {
  return { samples: [], mode };
}

export function addSample(
  store: LatencySampleStore,
  metrics: PerceptionFrameMetrics,
): LatencySampleStore {
  const samples = [...store.samples, metrics].slice(-MAX_SAMPLES);
  return { ...store, samples };
}

// ── Per-stage average extractor ───────────────────────────────────────────────

function avgStageLatency(
  samples: PerceptionFrameMetrics[],
  stage: PerceptionStage,
): number {
  const values = samples.flatMap(s =>
    s.stages.filter(st => st.stage === stage && st.success).map(st => st.latencyMs),
  );
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// ── Percentile calculator ─────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

// ── Report generation ─────────────────────────────────────────────────────────

export function generateLatencyReport(store: LatencySampleStore): PerceptionLatencyReport {
  const { samples, mode } = store;
  const completed = samples.filter(s => s.totalLatencyMs !== null);
  const endToEnd = completed
    .map(s => s.totalLatencyMs as number)
    .sort((a, b) => a - b);

  return {
    sampleCount: completed.length,
    avgCameraLatencyMs:     avgStageLatency(completed, 'camera'),
    avgVisionLatencyMs:     avgStageLatency(completed, 'vision'),
    avgOcrLatencyMs:        avgStageLatency(completed, 'ocr'),
    avgGuardianLatencyMs:   avgStageLatency(completed, 'guardian'),
    avgNavigationLatencyMs: avgStageLatency(completed, 'navigation'),
    avgVoiceLatencyMs:      avgStageLatency(completed, 'voice'),
    avgEndToEndLatencyMs:   endToEnd.length > 0
      ? Math.round(endToEnd.reduce((a, b) => a + b, 0) / endToEnd.length)
      : 0,
    p95EndToEndLatencyMs: percentile(endToEnd, 95),
    maxEndToEndLatencyMs: endToEnd[endToEnd.length - 1] ?? 0,
    minEndToEndLatencyMs: endToEnd[0] ?? 0,
    mode,
    generatedAt: new Date(),
  };
}

// ── Latency grading ───────────────────────────────────────────────────────────

export type LatencyGrade = 'excellent' | 'good' | 'acceptable' | 'slow' | 'critical';

export function gradeEndToEndLatency(latencyMs: number): LatencyGrade {
  if (latencyMs < 200)  return 'excellent';
  if (latencyMs < 500)  return 'good';
  if (latencyMs < 1000) return 'acceptable';
  if (latencyMs < 2500) return 'slow';
  return 'critical';
}

export function gradeStageLatency(stage: PerceptionStage, latencyMs: number): LatencyGrade {
  const thresholds: Record<PerceptionStage, [number, number, number, number]> = {
    camera:     [50,  100, 200,  500],
    vision:     [100, 300, 600, 1500],
    ocr:        [200, 500, 1000, 3000],
    guardian:   [10,  30,  60,  150],
    navigation: [10,  30,  60,  150],
    voice:      [50,  100, 200,  500],
  };
  const [excellent, good, acceptable] = thresholds[stage];
  if (latencyMs < excellent)  return 'excellent';
  if (latencyMs < good)       return 'good';
  if (latencyMs < acceptable) return 'acceptable';
  return 'slow';
}

// ── Stage timer helper ────────────────────────────────────────────────────────

export interface StageTimer {
  stage: PerceptionStage;
  startMs: number;
}

export function startStageTimer(stage: PerceptionStage): StageTimer {
  return { stage, startMs: Date.now() };
}

export function stopStageTimer(timer: StageTimer): {
  stage: PerceptionStage;
  latencyMs: number;
} {
  return { stage: timer.stage, latencyMs: Date.now() - timer.startMs };
}

// ── Summary description ───────────────────────────────────────────────────────

export function describeReport(report: PerceptionLatencyReport): string {
  if (report.sampleCount === 0) return 'No latency data yet. Start a session to measure performance.';
  const grade = gradeEndToEndLatency(report.avgEndToEndLatencyMs);
  return (
    `Mode: ${report.mode}. ` +
    `${report.sampleCount} frames. ` +
    `Average end-to-end: ${report.avgEndToEndLatencyMs}ms (${grade}). ` +
    `Vision: ${report.avgVisionLatencyMs}ms. ` +
    `OCR: ${report.avgOcrLatencyMs}ms. ` +
    `Guardian: ${report.avgGuardianLatencyMs}ms. ` +
    `P95: ${report.p95EndToEndLatencyMs}ms.`
  );
}

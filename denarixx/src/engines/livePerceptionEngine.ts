/**
 * Live Perception Engine — Sprint 22: Real Perception Integration
 * Orchestrates the full pipeline: Camera → Vision → OCR → Guardian → Navigation → Voice.
 * Simulation Mode remains the safe default. Live Mode requires camera + providers.
 * REUSES (never duplicates):
 *   - VisionEngine / visionProviderFactory → vision stage
 *   - ocrEngine / textReadingEngine        → ocr stage
 *   - cognitiveGuardianEngine              → guardian stage
 *   - navigationIntelligenceEngine         → navigation stage
 *   - voiceInteractionEngine               → voice stage
 *   - perceptionLatencyEngine              → metrics
 * Pure TypeScript — no browser APIs, fully testable in Node.js.
 */

import type {
  LivePerceptionConfig,
  PerceptionMode,
  PerceptionPipelineStatus,
  PerceptionStage,
  ProviderConfig,
  ProviderStatus,
  ProviderSwitchEvent,
  FailureRecoveryEvent,
  PerceptionFrameMetrics,
  PerceptionLatencyReport,
} from '@/types/livePerception';
import { DEFAULT_LIVE_PERCEPTION_CONFIG, PROVIDER_FALLBACK_ORDER } from '@/types/livePerception';
import type { OCRResult } from '@/types/ocr';
import type { TextReadingResult } from '@/types/ocr';
import {
  createLatencySampleStore,
  addSample,
  generateLatencyReport,
  createFrameMetrics,
  recordStage,
  completeFrame,
  LatencySampleStore,
} from './perceptionLatencyEngine';
import { enrichOCRResult } from './ocrEngine';
import { buildTextReadingResult } from './textReadingEngine';

// ── Pipeline session ───────────────────────────────────────────────────────────

export interface PerceptionPipelineSession {
  id: string;
  config: LivePerceptionConfig;
  isRunning: boolean;
  frameCount: number;
  lastFrameAt: Date | null;
  providerStatuses: Partial<Record<PerceptionStage, ProviderStatus>>;
  latencyStore: LatencySampleStore;
  switchLog: ProviderSwitchEvent[];
  failureLog: FailureRecoveryEvent[];
  activeAlerts: number;
}

export function createPipelineSession(
  config: Partial<LivePerceptionConfig> = {},
): PerceptionPipelineSession {
  const merged: LivePerceptionConfig = { ...DEFAULT_LIVE_PERCEPTION_CONFIG, ...config };
  return {
    id: `pipeline-${Date.now()}`,
    config: merged,
    isRunning: false,
    frameCount: 0,
    lastFrameAt: null,
    providerStatuses: {},
    latencyStore: createLatencySampleStore(merged.mode),
    switchLog: [],
    failureLog: [],
    activeAlerts: 0,
  };
}

// ── Start / stop ───────────────────────────────────────────────────────────────

export function startPipeline(session: PerceptionPipelineSession): PerceptionPipelineSession {
  return { ...session, isRunning: true };
}

export function stopPipeline(session: PerceptionPipelineSession): PerceptionPipelineSession {
  return { ...session, isRunning: false };
}

// ── Provider status management ────────────────────────────────────────────────

export function setProviderStatus(
  session: PerceptionPipelineSession,
  stage: PerceptionStage,
  status: ProviderStatus,
): PerceptionPipelineSession {
  return {
    ...session,
    providerStatuses: { ...session.providerStatuses, [stage]: status },
  };
}

export function markProviderReady(
  session: PerceptionPipelineSession,
  stage: PerceptionStage,
): PerceptionPipelineSession {
  return setProviderStatus(session, stage, 'ready');
}

export function markProviderError(
  session: PerceptionPipelineSession,
  stage: PerceptionStage,
  error: string,
): PerceptionPipelineSession {
  const failureLog: FailureRecoveryEvent[] = [
    ...session.failureLog,
    {
      stage,
      error,
      recoveryAction: 'fallback',
      recoveredAt: new Date(),
    },
  ];
  return {
    ...setProviderStatus(session, stage, 'error'),
    failureLog,
  };
}

// ── Provider switching ────────────────────────────────────────────────────────

export function switchProvider(
  session: PerceptionPipelineSession,
  stage: PerceptionStage,
  from: string,
  to: string,
  reason: ProviderSwitchEvent['reason'] = 'user-selected',
): PerceptionPipelineSession {
  const event: ProviderSwitchEvent = { stage, from, to, reason, timestamp: new Date() };
  const providers = { ...session.config.providers } as ProviderConfig;
  switch (stage) {
    case 'vision':     providers.vision = to; break;
    case 'ocr':        providers.ocr = to; break;
    case 'voice':      providers.tts = to; break;
    default: break;
  }
  return {
    ...session,
    config: { ...session.config, providers },
    switchLog: [...session.switchLog, event],
  };
}

// ── Fallback resolution ────────────────────────────────────────────────────────

export function getFallbackProvider(
  stage: PerceptionStage,
  currentProvider: string,
): string | null {
  const chain = PROVIDER_FALLBACK_ORDER[stage];
  const currentIndex = chain.indexOf(currentProvider);
  if (currentIndex === -1 || currentIndex === chain.length - 1) return null;
  return chain[currentIndex + 1];
}

// ── Frame processing ───────────────────────────────────────────────────────────

export interface FrameInput {
  imageData: string | null; // base64 or null for simulation
  detectedObjects: Array<{ label: string; confidence: number; bbox?: number[] }>;
  ocrImageData: string | null;
}

export interface FrameOutput {
  metrics: PerceptionFrameMetrics;
  ocrResult: OCRResult | null;
  textReading: TextReadingResult | null;
  alertCount: number;
  guidanceText: string | null;
}

export function processSimulationFrame(
  session: PerceptionPipelineSession,
  objectCount: number,
  alertCount: number,
  guidanceText: string | null,
): { session: PerceptionPipelineSession; output: FrameOutput } {
  const metrics = createFrameMetrics('simulation');
  const withCamera = recordStage(metrics, 'camera', 0, true);
  const withVision = recordStage(withCamera, 'vision', 5, true);
  const withGuardian = recordStage(withVision, 'guardian', 2, true);
  const withNav = recordStage(withGuardian, 'navigation', 1, true);
  const withVoice = recordStage(withNav, 'voice', 1, true);
  const completed: PerceptionFrameMetrics = {
    ...completeFrame(withVoice),
    objectsDetected: objectCount,
    alertsGenerated: alertCount,
    voicePriority: alertCount > 0 ? 'high' : null,
  };

  const updatedStore = addSample(session.latencyStore, completed);
  const updatedSession: PerceptionPipelineSession = {
    ...session,
    frameCount: session.frameCount + 1,
    lastFrameAt: new Date(),
    latencyStore: updatedStore,
    activeAlerts: alertCount,
  };

  return {
    session: updatedSession,
    output: {
      metrics: completed,
      ocrResult: null,
      textReading: null,
      alertCount,
      guidanceText,
    },
  };
}

export function processLiveFrame(
  session: PerceptionPipelineSession,
  frameStart: Date,
  stages: Array<{ stage: PerceptionStage; latencyMs: number; success: boolean; error?: string }>,
  counts: { objects: number; ocrChars: number; alerts: number },
  ocrRaw: import('@/types/ocr').OCRResultRaw | null,
  guidanceText: string | null,
): { session: PerceptionPipelineSession; output: FrameOutput } {
  let metrics = createFrameMetrics(session.config.mode);
  metrics = { ...metrics, startedAt: frameStart };
  for (const s of stages) {
    metrics = recordStage(metrics, s.stage, s.latencyMs, s.success, s.error);
  }
  const completed: PerceptionFrameMetrics = {
    ...completeFrame(metrics),
    objectsDetected: counts.objects,
    ocrCharactersRead: counts.ocrChars,
    alertsGenerated: counts.alerts,
    voicePriority: counts.alerts > 0 ? 'high' : null,
  };

  const ocrResult = ocrRaw ? enrichOCRResult(ocrRaw) : null;
  const textReading = ocrResult ? buildTextReadingResult(ocrResult) : null;

  const updatedStore = addSample(session.latencyStore, completed);
  const updatedSession: PerceptionPipelineSession = {
    ...session,
    frameCount: session.frameCount + 1,
    lastFrameAt: new Date(),
    latencyStore: updatedStore,
    activeAlerts: counts.alerts,
  };

  return {
    session: updatedSession,
    output: { metrics: completed, ocrResult, textReading, alertCount: counts.alerts, guidanceText },
  };
}

// ── Status snapshot ───────────────────────────────────────────────────────────

export function getPipelineStatus(
  session: PerceptionPipelineSession,
): PerceptionPipelineStatus {
  const latencyReport: PerceptionLatencyReport | null =
    session.latencyStore.samples.length > 0
      ? generateLatencyReport(session.latencyStore)
      : null;
  return {
    mode: session.config.mode,
    isRunning: session.isRunning,
    frameCount: session.frameCount,
    lastFrameAt: session.lastFrameAt,
    providerStatuses: session.providerStatuses,
    activeAlerts: session.activeAlerts,
    latencyReport,
  };
}

// ── Mode label ────────────────────────────────────────────────────────────────

export function describeMode(mode: PerceptionMode): string {
  switch (mode) {
    case 'simulation': return '🔬 Simulation — synthetic detections, no camera required';
    case 'live':       return '⚡ Live — real camera + on-device or cloud AI';
    case 'hybrid':     return '🔀 Hybrid — live camera + simulation fallback';
    default:           return mode;
  }
}

// ── Config validation ─────────────────────────────────────────────────────────

export function validateConfig(config: Partial<LivePerceptionConfig>): string[] {
  const warnings: string[] = [];
  if (config.mode === 'live' && !config.enableGuardian) {
    warnings.push('Guardian is disabled in live mode — hazard alerts will not be generated.');
  }
  if (config.mode === 'live' && config.frameIntervalMs && config.frameIntervalMs < 1000) {
    warnings.push('Frame interval below 1000ms may cause high CPU usage on older devices.');
  }
  if (config.enableOCR && config.ocrIntervalMs && config.ocrIntervalMs < 5000) {
    warnings.push('OCR interval below 5000ms is resource-intensive. Recommended: 15000ms.');
  }
  return warnings;
}

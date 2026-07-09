/**
 * Live Perception Pipeline Types — Sprint 22
 * End-to-end perception pipeline: Camera → Vision → OCR → Guardian → Navigation → Voice
 * Never merge into index.ts — keep pipeline types isolated.
 */

export type PerceptionMode = 'simulation' | 'live' | 'hybrid';
export type PerceptionStage =
  | 'camera'
  | 'vision'
  | 'ocr'
  | 'guardian'
  | 'navigation'
  | 'voice';

export type ProviderStatus = 'ready' | 'loading' | 'error' | 'unavailable' | 'disabled';

export interface StageLatency {
  stage: PerceptionStage;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

export interface PerceptionFrameMetrics {
  frameId: string;
  mode: PerceptionMode;
  startedAt: Date;
  completedAt: Date | null;
  totalLatencyMs: number | null;
  stages: StageLatency[];
  objectsDetected: number;
  ocrCharactersRead: number;
  alertsGenerated: number;
  voicePriority: string | null;
}

export interface PerceptionLatencyReport {
  sampleCount: number;
  avgCameraLatencyMs: number;
  avgVisionLatencyMs: number;
  avgOcrLatencyMs: number;
  avgGuardianLatencyMs: number;
  avgNavigationLatencyMs: number;
  avgVoiceLatencyMs: number;
  avgEndToEndLatencyMs: number;
  p95EndToEndLatencyMs: number;
  maxEndToEndLatencyMs: number;
  minEndToEndLatencyMs: number;
  mode: PerceptionMode;
  generatedAt: Date;
}

export interface ProviderConfig {
  vision: string;
  ocr: string;
  tts: string;
  stt: string;
}

export interface LivePerceptionConfig {
  mode: PerceptionMode;
  providers: ProviderConfig;
  frameIntervalMs: number;
  ocrIntervalMs: number;
  enableOCR: boolean;
  enableNavigation: boolean;
  enableGuardian: boolean;
  enableWakeWord: boolean;
}

export interface PerceptionPipelineStatus {
  mode: PerceptionMode;
  isRunning: boolean;
  frameCount: number;
  lastFrameAt: Date | null;
  providerStatuses: Partial<Record<PerceptionStage, ProviderStatus>>;
  activeAlerts: number;
  latencyReport: PerceptionLatencyReport | null;
}

export interface ProviderSwitchEvent {
  stage: PerceptionStage;
  from: string;
  to: string;
  reason: 'user-selected' | 'fallback' | 'recovery';
  timestamp: Date;
}

export interface FailureRecoveryEvent {
  stage: PerceptionStage;
  error: string;
  recoveryAction: 'retry' | 'fallback' | 'skip' | 'halt';
  recoveredAt: Date;
}

export const DEFAULT_LIVE_PERCEPTION_CONFIG: LivePerceptionConfig = {
  mode: 'simulation',
  providers: {
    vision: 'simulation',
    ocr: 'tesseract',
    tts: 'web-speech',
    stt: 'web-speech',
  },
  frameIntervalMs: 3000,
  ocrIntervalMs: 15000,
  enableOCR: false,
  enableNavigation: true,
  enableGuardian: true,
  enableWakeWord: false,
};

export const LIVE_PERCEPTION_SAFETY_NOTE =
  'Live perception is an assistive aid only. Never rely solely on automated detection for safety-critical decisions.';

export const PROVIDER_FALLBACK_ORDER: Record<PerceptionStage, string[]> = {
  camera: ['device-camera', 'none'],
  vision: ['simulation', 'none'],
  ocr: ['tesseract', 'none'],
  guardian: ['cognitive-guardian', 'none'],
  navigation: ['indoor', 'outdoor', 'none'],
  voice: ['web-speech', 'none'],
};

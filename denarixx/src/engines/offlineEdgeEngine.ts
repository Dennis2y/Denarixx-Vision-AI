// ─── Sprint 14: Offline Edge Inference Engine ─────────────────────────────────
// Pure functions — no async, no I/O.
// Local AI inference architecture for offline operation.
// (Complements V15 edgeInferenceEngine.ts — offline-focused extension.)

import type {
  EdgeModel,
  EdgeModelType,
  ModelStatus,
  ModelIntegrityCheck,
} from '@/types/offline';

// ─── Model Registry ───────────────────────────────────────────────────────────

export function createEdgeModelRegistry(): EdgeModel[] {
  return [
    {
      id: 'edge-vision-v1',
      type: 'vision',
      name: 'Offline Vision Model v1',
      version: '1.0.0',
      sizeKb: 48_000,
      status: 'ready',
      integrityHash: 'sha256:a3f2b8c4d1e9f7a2b3c4d5e6f7a8b9c0d1e2f3a4',
      downloadedAt: Date.now() - 86_400_000,
      lastUsedAt: Date.now() - 60_000,
      priority: 1,
      supportsOffline: true,
      minBatteryPct: 5,
    },
    {
      id: 'edge-speech-synth-v1',
      type: 'speech-synthesis',
      name: 'Offline Speech Synthesis v1',
      version: '1.1.0',
      sizeKb: 22_000,
      status: 'ready',
      integrityHash: 'sha256:b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6',
      downloadedAt: Date.now() - 86_400_000,
      lastUsedAt: Date.now() - 30_000,
      priority: 2,
      supportsOffline: true,
      minBatteryPct: 5,
    },
    {
      id: 'edge-speech-recog-v1',
      type: 'speech-recognition',
      name: 'Offline Speech Recognition v1',
      version: '1.0.2',
      sizeKb: 35_000,
      status: 'not-downloaded',
      integrityHash: 'sha256:c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8',
      downloadedAt: null,
      lastUsedAt: null,
      priority: 3,
      supportsOffline: true,
      minBatteryPct: 10,
    },
    {
      id: 'edge-nav-v1',
      type: 'navigation',
      name: 'Offline Navigation Cache v1',
      version: '2.0.0',
      sizeKb: 12_000,
      status: 'ready',
      integrityHash: 'sha256:d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9',
      downloadedAt: Date.now() - 3_600_000,
      lastUsedAt: Date.now() - 120_000,
      priority: 2,
      supportsOffline: true,
      minBatteryPct: 3,
    },
    {
      id: 'edge-memory-v1',
      type: 'memory',
      name: 'Offline Memory Index v1',
      version: '1.0.0',
      sizeKb: 8_000,
      status: 'ready',
      integrityHash: 'sha256:e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0',
      downloadedAt: Date.now() - 7_200_000,
      lastUsedAt: Date.now() - 300_000,
      priority: 1,
      supportsOffline: true,
      minBatteryPct: 2,
    },
  ];
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function getModelByType(
  models: EdgeModel[],
  type: EdgeModelType,
): EdgeModel | undefined {
  return models.find(m => m.type === type);
}

export function getReadyModels(models: EdgeModel[]): EdgeModel[] {
  return models.filter(m => m.status === 'ready');
}

export function getModelById(
  models: EdgeModel[],
  id: string,
): EdgeModel | undefined {
  return models.find(m => m.id === id);
}

export function selectOfflineModel(
  models: EdgeModel[],
  type: EdgeModelType,
  batteryPct = 100,
): EdgeModel | undefined {
  return models.find(
    m =>
      m.type === type &&
      m.status === 'ready' &&
      m.supportsOffline &&
      batteryPct >= m.minBatteryPct,
  );
}

export function getModelPriority(type: EdgeModelType): number {
  const priorities: Record<EdgeModelType, number> = {
    'vision':             1,
    'memory':             1,
    'navigation':         2,
    'speech-synthesis':   2,
    'speech-recognition': 3,
  };
  return priorities[type];
}

export function estimateModelLatencyMs(model: EdgeModel): number {
  const base: Record<EdgeModelType, number> = {
    'vision':             120,
    'speech-synthesis':   80,
    'speech-recognition': 200,
    'navigation':         30,
    'memory':             15,
  };
  const factor = model.status === 'ready' ? 1.0 : 2.5;
  return Math.round(base[model.type] * factor);
}

// ─── Status Transitions ───────────────────────────────────────────────────────

export function setModelStatus(
  models: EdgeModel[],
  id: string,
  status: ModelStatus,
  now = Date.now(),
): EdgeModel[] {
  return models.map(m => {
    if (m.id !== id) return m;
    return {
      ...m,
      status,
      downloadedAt: status === 'ready' && m.downloadedAt === null ? now : m.downloadedAt,
    };
  });
}

export function markModelUsed(
  models: EdgeModel[],
  id: string,
  now = Date.now(),
): EdgeModel[] {
  return models.map(m => (m.id === id ? { ...m, lastUsedAt: now } : m));
}

// ─── Inference Simulation ─────────────────────────────────────────────────────

const OFFLINE_VISION_SCENARIOS: string[][] = [
  ['step', 'pavement'],
  ['obstacle'],
  ['person', 'pavement'],
  ['cyclist'],
  ['vehicle', 'crosswalk'],
  ['door'],
  [],
  ['construction-barrier'],
];

export interface EdgeInferenceResult {
  detections: string[];
  confidences: number[];
  latencyMs: number;
  modelId: string;
  offlineMode: boolean;
  safetyMessage: string | null;
}

export function runOfflineInference(
  models: EdgeModel[],
  type: EdgeModelType,
  tick: number,
  batteryPct = 100,
): EdgeInferenceResult {
  const model = selectOfflineModel(models, type, batteryPct);
  if (!model) {
    return {
      detections: [],
      confidences: [],
      latencyMs: 0,
      modelId: 'none',
      offlineMode: true,
      safetyMessage: 'No offline model available. Proceed with extra caution.',
    };
  }

  const scenario = OFFLINE_VISION_SCENARIOS[tick % OFFLINE_VISION_SCENARIOS.length];
  const latency = estimateModelLatencyMs(model);
  const confidences = scenario.map(() => 0.7 + Math.random() * 0.25);

  const safetyMessage =
    scenario.length > 0
      ? `Offline detection: ${scenario.join(', ')}.`
      : null;

  return {
    detections: scenario,
    confidences,
    latencyMs: latency,
    modelId: model.id,
    offlineMode: true,
    safetyMessage,
  };
}

export function runOfflineSpeechSynthesis(
  models: EdgeModel[],
  text: string,
): { supported: boolean; modelId: string; fallbackToDeviceTTS: boolean } {
  const model = selectOfflineModel(models, 'speech-synthesis');
  if (!model) {
    return { supported: true, modelId: 'device-tts', fallbackToDeviceTTS: true };
  }
  return { supported: true, modelId: model.id, fallbackToDeviceTTS: false };
}

export function runOfflineSpeechRecognition(
  models: EdgeModel[],
): { supported: boolean; modelId: string; fallbackToDeviceASR: boolean } {
  const model = selectOfflineModel(models, 'speech-recognition');
  if (!model) {
    return { supported: true, modelId: 'device-asr', fallbackToDeviceASR: true };
  }
  return { supported: true, modelId: model.id, fallbackToDeviceASR: false };
}

// ─── Integrity ───────────────────────────────────────────────────────────────

export function checkModelIntegrity(
  model: EdgeModel,
  now = Date.now(),
): ModelIntegrityCheck {
  // Simulate: ready models always pass; others fail
  const passed = model.status === 'ready';
  return {
    modelId: model.id,
    expectedHash: model.integrityHash,
    actualHash: passed
      ? model.integrityHash
      : model.integrityHash.replace('sha256:', 'sha256:BAD'),
    passed,
    checkedAt: now,
  };
}

export function checkAllModels(
  models: EdgeModel[],
  now = Date.now(),
): ModelIntegrityCheck[] {
  return models.map(m => checkModelIntegrity(m, now));
}

export function allIntegrityPassed(checks: ModelIntegrityCheck[]): boolean {
  return checks.every(c => c.passed);
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export function getModelStatusLabel(status: ModelStatus): string {
  switch (status) {
    case 'not-downloaded': return 'Not downloaded';
    case 'downloading':    return 'Downloading…';
    case 'ready':          return 'Ready';
    case 'updating':       return 'Updating…';
    case 'corrupted':      return 'Corrupted — re-download needed';
    case 'stale':          return 'Stale — update available';
  }
}

export function getModelTypeLabel(type: EdgeModelType): string {
  switch (type) {
    case 'vision':             return 'Vision';
    case 'speech-synthesis':   return 'Speech synthesis';
    case 'speech-recognition': return 'Speech recognition';
    case 'navigation':         return 'Navigation';
    case 'memory':             return 'Memory';
  }
}

export function formatModelSize(sizeKb: number): string {
  if (sizeKb < 1_000) return `${sizeKb} KB`;
  return `${(sizeKb / 1_000).toFixed(0)} MB`;
}

// ─── Version Management ───────────────────────────────────────────────────────

export function shouldUpdateModel(model: EdgeModel): boolean {
  return model.status === 'stale';
}

export function getVersionSummary(models: EdgeModel[]): Array<{
  type: EdgeModelType;
  version: string;
  status: ModelStatus;
  sizeKb: number;
}> {
  return models.map(m => ({
    type: m.type,
    version: m.version,
    status: m.status,
    sizeKb: m.sizeKb,
  }));
}

export function getTotalModelSizeKb(models: EdgeModel[]): number {
  return models.filter(m => m.status === 'ready').reduce((s, m) => s + m.sizeKb, 0);
}

export function getDownloadQueue(models: EdgeModel[]): EdgeModel[] {
  return models
    .filter(m => m.status === 'not-downloaded' || m.status === 'stale')
    .sort((a, b) => a.priority - b.priority);
}

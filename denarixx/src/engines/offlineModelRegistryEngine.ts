// ─── Sprint 14: Offline Model Registry Engine ─────────────────────────────────
// Pure functions — no async, no I/O.
// Manages AI model lifecycle on the Denarixx glasses compute module:
// download (cloud → phone → glasses), OTA updates, integrity, and storage.
// (Complements V12 modelManagerEngine.ts — glasses-native model registry.)

import type { EdgeModel, EdgeModelType, ModelStatus } from '@/types/offline';
import {
  createEdgeModelRegistry,
  getModelById,
  setModelStatus,
  getVersionSummary,
  getDownloadQueue,
  getTotalModelSizeKb,
  formatModelSize,
  getModelStatusLabel,
  getModelTypeLabel,
} from '@/engines/offlineEdgeEngine';

// Re-export everything needed by consumers
export {
  createEdgeModelRegistry,
  getModelById,
  setModelStatus,
  getVersionSummary,
  getDownloadQueue,
  getTotalModelSizeKb,
  formatModelSize,
  getModelStatusLabel,
  getModelTypeLabel,
};

// ─── Registry Queries ─────────────────────────────────────────────────────────

export function getAllModels(models: EdgeModel[]): EdgeModel[] {
  return [...models];
}

export function getModelsByType(
  models: EdgeModel[],
  type: EdgeModelType,
): EdgeModel[] {
  return models.filter(m => m.type === type);
}

export function getModelsByStatus(
  models: EdgeModel[],
  status: ModelStatus,
): EdgeModel[] {
  return models.filter(m => m.status === status);
}

export function getReadyModels(models: EdgeModel[]): EdgeModel[] {
  return models.filter(m => m.status === 'ready');
}

export function getCorruptedModels(models: EdgeModel[]): EdgeModel[] {
  return models.filter(m => m.status === 'corrupted');
}

export function getStaleModels(models: EdgeModel[]): EdgeModel[] {
  return models.filter(m => m.status === 'stale');
}

// ─── Lifecycle Transitions ────────────────────────────────────────────────────

export function startDownload(models: EdgeModel[], id: string): EdgeModel[] {
  return setModelStatus(models, id, 'downloading');
}

export function completeDownload(
  models: EdgeModel[],
  id: string,
  now = Date.now(),
): EdgeModel[] {
  return setModelStatus(models, id, 'ready', now);
}

export function markStale(models: EdgeModel[], id: string): EdgeModel[] {
  return setModelStatus(models, id, 'stale');
}

export function markCorrupted(models: EdgeModel[], id: string): EdgeModel[] {
  return setModelStatus(models, id, 'corrupted');
}

export function startUpdate(models: EdgeModel[], id: string): EdgeModel[] {
  return setModelStatus(models, id, 'updating');
}

export function completeUpdate(
  models: EdgeModel[],
  id: string,
  newVersion: string,
  now = Date.now(),
): EdgeModel[] {
  return models.map(m => {
    if (m.id !== id) return m;
    return { ...m, status: 'ready', version: newVersion, downloadedAt: now };
  });
}

export function removeModel(models: EdgeModel[], id: string): EdgeModel[] {
  return models.map(m => {
    if (m.id !== id) return m;
    return {
      ...m,
      status: 'not-downloaded',
      downloadedAt: null,
      lastUsedAt: null,
    };
  });
}

// ─── Download Planning ────────────────────────────────────────────────────────

export function getPriorityDownloadOrder(models: EdgeModel[]): EdgeModel[] {
  return getDownloadQueue(models).sort((a, b) => a.priority - b.priority);
}

export function estimatePendingDownloadSizeKb(models: EdgeModel[]): number {
  return getDownloadQueue(models).reduce((sum, m) => sum + m.sizeKb, 0);
}

export function canDownloadOnBattery(
  model: EdgeModel,
  batteryPct: number,
): boolean {
  return batteryPct >= model.minBatteryPct;
}

export function getDownloadPlan(
  models: EdgeModel[],
  batteryPct: number,
): { ready: EdgeModel[]; blocked: EdgeModel[]; totalSizeKb: number } {
  const queue = getPriorityDownloadOrder(models);
  const ready = queue.filter(m => canDownloadOnBattery(m, batteryPct));
  const blocked = queue.filter(m => !canDownloadOnBattery(m, batteryPct));
  return {
    ready,
    blocked,
    totalSizeKb: ready.reduce((s, m) => s + m.sizeKb, 0),
  };
}

// ─── Version Management ───────────────────────────────────────────────────────

export function hasUpdate(model: EdgeModel): boolean {
  return model.status === 'stale';
}

export function listUpdatableModels(models: EdgeModel[]): EdgeModel[] {
  return models.filter(hasUpdate);
}

export function bumpVersion(currentVersion: string): string {
  const parts = currentVersion.split('.').map(Number);
  if (parts.length < 3) return currentVersion;
  parts[2] += 1;
  return parts.join('.');
}

// ─── Storage Summary ─────────────────────────────────────────────────────────

export function getStorageSummary(models: EdgeModel[]): {
  installedKb: number;
  installedMb: string;
  pendingKb: number;
  pendingMb: string;
  modelCount: number;
  readyCount: number;
} {
  const installedKb = getTotalModelSizeKb(models);
  const pendingKb = estimatePendingDownloadSizeKb(models);
  return {
    installedKb,
    installedMb: formatModelSize(installedKb),
    pendingKb,
    pendingMb: formatModelSize(pendingKb),
    modelCount: models.length,
    readyCount: getReadyModels(models).length,
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateModelCoverage(models: EdgeModel[]): {
  covered: EdgeModelType[];
  missing: EdgeModelType[];
} {
  const allTypes: EdgeModelType[] = [
    'vision',
    'speech-synthesis',
    'speech-recognition',
    'navigation',
    'memory',
  ];
  const readyTypes = new Set(getReadyModels(models).map(m => m.type));
  return {
    covered: allTypes.filter(t => readyTypes.has(t)),
    missing: allTypes.filter(t => !readyTypes.has(t)),
  };
}

export function isCriticalModelMissing(models: EdgeModel[]): boolean {
  const criticalTypes: EdgeModelType[] = ['vision', 'memory'];
  const readyTypes = new Set(getReadyModels(models).map(m => m.type));
  return criticalTypes.some(t => !readyTypes.has(t));
}

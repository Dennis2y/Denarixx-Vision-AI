// Sprint 14: Offline Mode & Edge AI — Tests
// npx tsx tests/offlineEngine.test.ts

import {
  createNetworkReading,
  detectNetworkStatus,
  isWeakConnection,
  estimateQuality,
  goOnline,
  goOffline,
  goWeak,
  goReconnecting,
  markSynced,
  markSyncPending,
  updateOfflineDuration,
  isOnline,
  isOffline,
  shouldAttemptReconnect,
  shouldThrottleRequests,
  getOfflineDurationHuman,
  getStatusLabel,
  getQualityLabel,
  getStatusColor,
  getQualityColor,
  formatBandwidth,
  formatLatency,
  buildNetworkDiagnostic,
} from '../src/engines/networkMonitorEngine';

import {
  createOfflineState,
  buildCapabilityTable,
  getOfflineFeatureStatus,
  isFeatureAvailable,
  listAvailableFeatures,
  listDegradedFeatures,
  countReadyModels,
  transitionToOnline,
  transitionToOffline,
  applyNetworkStatus,
  isGuardianSafe,
  getGuardianFallbackMessage,
  getGuardianOfflineGuidance,
  getMemoryFallbackSummary,
  getNavigationFallbackGuidance,
  buildOfflineSummary,
  getOfflineStatusDescription,
  getOfflineBannerText,
  validateOfflineReadiness,
} from '../src/engines/offlineEngine';

import {
  createEdgeModelRegistry,
  getModelByType,
  getReadyModels,
  getModelById,
  selectOfflineModel,
  getModelPriority,
  estimateModelLatencyMs,
  setModelStatus,
  markModelUsed,
  runOfflineInference,
  runOfflineSpeechSynthesis,
  runOfflineSpeechRecognition,
  checkModelIntegrity,
  checkAllModels,
  allIntegrityPassed,
  getModelStatusLabel,
  getModelTypeLabel,
  formatModelSize,
  shouldUpdateModel,
  getVersionSummary,
  getTotalModelSizeKb,
  getDownloadQueue,
} from '../src/engines/offlineEdgeEngine';

import {
  createSyncQueue,
  createSyncRecord,
  addToQueue,
  removeFromQueue,
  clearCompleted,
  startSync,
  stopSync,
  markRecordSyncing,
  markRecordComplete,
  markRecordFailed,
  markRecordConflict,
  resolveConflict,
  detectConflict,
  applyConflictStrategy,
  getNextBatch,
  buildRetryQueue,
  getFailedRecords,
  resetFailedRecord,
  resetAllFailed,
  getSyncSummary,
  getCategoryBreakdown,
  hasPendingSync,
  isQueueEmpty,
  getSyncStatusLabel,
  getCategoryLabel,
} from '../src/engines/offlineSyncEngine';

import {
  getAllModels,
  getModelsByType,
  getModelsByStatus,
  getCorruptedModels,
  getStaleModels,
  startDownload,
  completeDownload,
  markStale,
  markCorrupted,
  startUpdate,
  completeUpdate,
  removeModel,
  getPriorityDownloadOrder,
  estimatePendingDownloadSizeKb,
  canDownloadOnBattery,
  getDownloadPlan,
  hasUpdate,
  listUpdatableModels,
  bumpVersion,
  getStorageSummary,
  validateModelCoverage,
  isCriticalModelMissing,
} from '../src/engines/offlineModelRegistryEngine';

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`  ✗ ${name}: ${msg}`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe: (expected: T) => {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual: (expected: T) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan: (n: number) => {
      if ((actual as number) <= n)
        throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeGreaterThanOrEqual: (n: number) => {
      if ((actual as number) < n)
        throw new Error(`Expected ${actual} >= ${n}`);
    },
    toBeLessThan: (n: number) => {
      if ((actual as number) >= n)
        throw new Error(`Expected ${actual} < ${n}`);
    },
    toBeLessThanOrEqual: (n: number) => {
      if ((actual as number) > n)
        throw new Error(`Expected ${actual} <= ${n}`);
    },
    toContain: (sub: string) => {
      if (!String(actual).includes(sub))
        throw new Error(`Expected "${actual}" to contain "${sub}"`);
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    toBeFalsy: () => {
      if (actual) throw new Error(`Expected falsy, got ${actual}`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected null, got ${actual}`);
    },
    toBeUndefined: () => {
      if (actual !== undefined) throw new Error(`Expected undefined, got ${actual}`);
    },
    toHaveLength: (n: number) => {
      const len = (actual as unknown as unknown[]).length;
      if (len !== n) throw new Error(`Expected length ${n}, got ${len}`);
    },
    toInclude: (item: unknown) => {
      if (!(actual as unknown[]).includes(item))
        throw new Error(`Expected array to include ${JSON.stringify(item)}`);
    },
  };
}

// ─── networkMonitorEngine ─────────────────────────────────────────────────────

test('createNetworkReading returns default reading', () => {
  const r = createNetworkReading();
  expect(r.status).toBe('online');
  expect(r.quality).toBe('excellent');
  expect(r.reconnectAttempts).toBe(0);
  expect(r.offlineDurationMs).toBe(0);
});

test('createNetworkReading merges overrides', () => {
  const r = createNetworkReading({ status: 'offline', latencyMs: 999 });
  expect(r.status).toBe('offline');
  expect(r.latencyMs).toBe(999);
  expect(r.quality).toBe('excellent'); // default unchanged
});

test('detectNetworkStatus returns online when connected, no issues', () => {
  expect(detectNetworkStatus(true, 10_000, 20, 0, false)).toBe('online');
});

test('detectNetworkStatus returns offline when not connected', () => {
  expect(detectNetworkStatus(false, 0, 0, 0, false)).toBe('offline');
});

test('detectNetworkStatus returns reconnecting when disconnected with attempts', () => {
  expect(detectNetworkStatus(false, 0, 0, 3, false)).toBe('reconnecting');
});

test('detectNetworkStatus returns weak when bandwidth low', () => {
  expect(detectNetworkStatus(true, 100, 20, 0, false)).toBe('weak');
});

test('detectNetworkStatus returns weak when latency high', () => {
  expect(detectNetworkStatus(true, 5_000, 800, 0, false)).toBe('weak');
});

test('detectNetworkStatus returns sync-pending', () => {
  expect(detectNetworkStatus(true, 10_000, 20, 0, true)).toBe('sync-pending');
});

test('isWeakConnection detects low bandwidth', () => {
  expect(isWeakConnection(300, 50)).toBeTruthy();
});

test('isWeakConnection detects high latency', () => {
  expect(isWeakConnection(2_000, 600)).toBeTruthy();
});

test('isWeakConnection returns false for good connection', () => {
  expect(isWeakConnection(5_000, 50)).toBeFalsy();
});

test('estimateQuality returns excellent for good connection', () => {
  expect(estimateQuality(10_000, 20)).toBe('excellent');
});

test('estimateQuality returns good for moderate connection', () => {
  expect(estimateQuality(2_000, 200)).toBe('good');
});

test('estimateQuality returns poor for degraded connection', () => {
  expect(estimateQuality(200, 800)).toBe('poor');
});

test('estimateQuality returns none for no connection', () => {
  expect(estimateQuality(0, 0)).toBe('none');
});

test('goOnline sets correct fields', () => {
  const r = createNetworkReading({ status: 'offline' });
  const now = Date.now();
  const online = goOnline(r, now, 8_000, 30);
  expect(online.status).toBe('online');
  expect(online.lastOnlineAt).toBe(now);
  expect(online.offlineDurationMs).toBe(0);
  expect(online.reconnectAttempts).toBe(0);
});

test('goOffline sets correct fields', () => {
  const r = createNetworkReading({ status: 'online' });
  const now = Date.now();
  const offline = goOffline(r, now);
  expect(offline.status).toBe('offline');
  expect(offline.quality).toBe('none');
  expect(offline.bandwidthEstimateKbps).toBe(0);
});

test('goWeak updates status and quality', () => {
  const r = createNetworkReading();
  const weak = goWeak(r, 300, 700);
  expect(weak.status).toBe('weak');
  expect(weak.bandwidthEstimateKbps).toBe(300);
  expect(weak.latencyMs).toBe(700);
});

test('goReconnecting increments reconnectAttempts', () => {
  const r = createNetworkReading({ status: 'offline', reconnectAttempts: 2 });
  const reconnecting = goReconnecting(r);
  expect(reconnecting.status).toBe('reconnecting');
  expect(reconnecting.reconnectAttempts).toBe(3);
});

test('markSynced updates lastSyncAt', () => {
  const r = createNetworkReading({ status: 'sync-pending' });
  const now = Date.now();
  const synced = markSynced(r, now);
  expect(synced.lastSyncAt).toBe(now);
  expect(synced.status).toBe('online');
});

test('markSyncPending does not apply when offline', () => {
  const r = createNetworkReading({ status: 'offline' });
  const result = markSyncPending(r);
  expect(result.status).toBe('offline');
});

test('updateOfflineDuration calculates duration', () => {
  const now = Date.now();
  const r = createNetworkReading({ status: 'offline', lastOnlineAt: now - 5_000 });
  const updated = updateOfflineDuration(r, now);
  expect(updated.offlineDurationMs).toBeGreaterThanOrEqual(4_900);
});

test('updateOfflineDuration does not update when online', () => {
  const r = createNetworkReading({ status: 'online', offlineDurationMs: 0 });
  const now = Date.now();
  const updated = updateOfflineDuration(r, now);
  expect(updated.offlineDurationMs).toBe(0);
});

test('isOnline returns true for online status', () => {
  expect(isOnline(createNetworkReading({ status: 'online' }))).toBeTruthy();
});

test('isOnline returns true for weak status', () => {
  expect(isOnline(createNetworkReading({ status: 'weak' }))).toBeTruthy();
});

test('isOffline returns true for offline status', () => {
  expect(isOffline(createNetworkReading({ status: 'offline' }))).toBeTruthy();
});

test('isOffline returns true for reconnecting status', () => {
  expect(isOffline(createNetworkReading({ status: 'reconnecting' }))).toBeTruthy();
});

test('shouldAttemptReconnect returns true when offline with < 10 attempts', () => {
  const r = createNetworkReading({ status: 'offline', reconnectAttempts: 3 });
  expect(shouldAttemptReconnect(r)).toBeTruthy();
});

test('shouldAttemptReconnect returns false when max attempts reached', () => {
  const r = createNetworkReading({ status: 'offline', reconnectAttempts: 10 });
  expect(shouldAttemptReconnect(r)).toBeFalsy();
});

test('getOfflineDurationHuman formats seconds', () => {
  expect(getOfflineDurationHuman(30_000)).toContain('s ago');
});

test('getOfflineDurationHuman formats minutes', () => {
  expect(getOfflineDurationHuman(90_000)).toContain('m ago');
});

test('getStatusLabel returns correct labels', () => {
  expect(getStatusLabel('online')).toBe('Online');
  expect(getStatusLabel('offline')).toBe('Offline');
  expect(getStatusLabel('weak')).toBe('Weak connection');
  expect(getStatusLabel('reconnecting')).toContain('Reconnecting');
  expect(getStatusLabel('sync-pending')).toContain('pending');
});

test('getStatusColor returns correct colors', () => {
  expect(getStatusColor('online')).toBe('green');
  expect(getStatusColor('offline')).toBe('red');
  expect(getStatusColor('weak')).toBe('yellow');
});

test('formatBandwidth formats kbps correctly', () => {
  expect(formatBandwidth(0)).toContain('No signal');
  expect(formatBandwidth(500)).toContain('Kbps');
  expect(formatBandwidth(5_000)).toContain('Mbps');
});

test('buildNetworkDiagnostic returns all expected fields', () => {
  const r = createNetworkReading();
  const diag = buildNetworkDiagnostic(r);
  expect(typeof diag.status).toBe('string');
  expect(typeof diag.bandwidth).toBe('string');
  expect(typeof diag.latency).toBe('string');
  expect(typeof diag.reconnectAttempts).toBe('number');
});

// ─── offlineEngine ───────────────────────────────────────────────────────────

test('createOfflineState creates valid initial state', () => {
  const state = createOfflineState();
  expect(state.network.status).toBe('online');
  expect(state.guardianOfflineReady).toBeTruthy();
  expect(state.memoryOfflineReady).toBeTruthy();
  expect(state.sessionStartedOffline).toBeFalsy();
  expect(state.models.length).toBeGreaterThan(0);
});

test('buildCapabilityTable returns all 10 features', () => {
  const table = buildCapabilityTable();
  const features = Object.keys(table);
  expect(features.length).toBe(10);
});

test('all offline features are available offline', () => {
  const table = buildCapabilityTable();
  const all = Object.values(table);
  const unavailable = all.filter(e => !e.availableOffline);
  expect(unavailable.length).toBe(0);
});

test('hazard-detection is degraded offline', () => {
  const table = buildCapabilityTable();
  expect(table['hazard-detection'].degraded).toBeTruthy();
  expect(table['hazard-detection'].requiresModel).toBe('vision');
});

test('language is full quality offline', () => {
  const table = buildCapabilityTable();
  expect(table['language'].qualityWhenOffline).toBe('full');
  expect(table['language'].degraded).toBeFalsy();
});

test('preferences is full quality offline', () => {
  const table = buildCapabilityTable();
  expect(table['preferences'].qualityWhenOffline).toBe('full');
});

test('accessibility is full quality offline', () => {
  const table = buildCapabilityTable();
  expect(table['accessibility'].qualityWhenOffline).toBe('full');
});

test('memory is full quality offline', () => {
  const table = buildCapabilityTable();
  expect(table['memory'].qualityWhenOffline).toBe('full');
});

test('getOfflineFeatureStatus returns correct entry', () => {
  const state = createOfflineState();
  const entry = getOfflineFeatureStatus(state, 'guardian');
  expect(entry.feature).toBe('guardian');
  expect(entry.availableOffline).toBeTruthy();
});

test('isFeatureAvailable returns true when online', () => {
  const state = createOfflineState(); // online by default
  expect(isFeatureAvailable(state, 'hazard-detection')).toBeTruthy();
});

test('isFeatureAvailable returns true offline when model ready', () => {
  const state = createOfflineState();
  const offline = transitionToOffline(state, Date.now());
  // vision model is ready by default
  expect(isFeatureAvailable(offline, 'hazard-detection')).toBeTruthy();
});

test('isFeatureAvailable returns false offline when model not ready', () => {
  let state = createOfflineState();
  // Set all models to not-downloaded
  state = {
    ...state,
    models: state.models.map(m => ({ ...m, status: 'not-downloaded' as const })),
  };
  const offline = transitionToOffline(state, Date.now());
  expect(isFeatureAvailable(offline, 'hazard-detection')).toBeFalsy();
});

test('listAvailableFeatures returns features when online', () => {
  const state = createOfflineState();
  const available = listAvailableFeatures(state);
  expect(available.length).toBe(10);
});

test('listDegradedFeatures is empty when online', () => {
  const state = createOfflineState();
  const degraded = listDegradedFeatures(state);
  expect(degraded.length).toBe(0);
});

test('listDegradedFeatures returns degraded when offline', () => {
  let state = createOfflineState();
  state = transitionToOffline(state, Date.now());
  const degraded = listDegradedFeatures(state);
  expect(degraded.length).toBeGreaterThan(0);
});

test('countReadyModels counts correctly', () => {
  const models = createEdgeModelRegistry();
  const ready = countReadyModels(models);
  expect(ready).toBeGreaterThan(0);
});

test('transitionToOnline sets correct network state', () => {
  let state = createOfflineState();
  state = transitionToOffline(state, Date.now());
  const online = transitionToOnline(state, Date.now());
  expect(online.network.status).toBe('online');
  expect(online.network.offlineDurationMs).toBe(0);
  expect(online.network.reconnectAttempts).toBe(0);
});

test('transitionToOffline sets correct network state', () => {
  const state = createOfflineState();
  const offline = transitionToOffline(state, Date.now());
  expect(offline.network.status).toBe('offline');
  expect(offline.network.quality).toBe('none');
  expect(offline.network.bandwidthEstimateKbps).toBe(0);
});

test('applyNetworkStatus handles all statuses', () => {
  const state = createOfflineState();
  const now = Date.now();
  expect(applyNetworkStatus(state, 'online', now).network.status).toBe('online');
  expect(applyNetworkStatus(state, 'offline', now).network.status).toBe('offline');
  expect(applyNetworkStatus(state, 'weak', now).network.status).toBe('weak');
  expect(applyNetworkStatus(state, 'reconnecting', now).network.status).toBe('reconnecting');
  expect(applyNetworkStatus(state, 'sync-pending', now).network.status).toBe('sync-pending');
});

test('isGuardianSafe returns true by default', () => {
  const state = createOfflineState();
  expect(isGuardianSafe(state)).toBeTruthy();
});

test('getGuardianFallbackMessage mentions cloud when online', () => {
  const state = createOfflineState();
  const msg = getGuardianFallbackMessage(state);
  expect(msg.toLowerCase()).toContain('cloud');
});

test('getGuardianFallbackMessage mentions local when offline', () => {
  let state = createOfflineState();
  state = transitionToOffline(state, Date.now());
  const msg = getGuardianFallbackMessage(state);
  expect(msg.toLowerCase()).toContain('local');
});

test('getGuardianOfflineGuidance returns steps guidance', () => {
  const msg = getGuardianOfflineGuidance('steps');
  expect(msg.toLowerCase()).toContain('steps');
});

test('getGuardianOfflineGuidance handles unknown hazard', () => {
  const msg = getGuardianOfflineGuidance('unknown-thing');
  expect(msg.length).toBeGreaterThan(0);
});

test('getMemoryFallbackSummary mentions cache when ready', () => {
  const state = createOfflineState();
  const msg = getMemoryFallbackSummary(state);
  expect(msg.toLowerCase()).toContain('cache');
});

test('getNavigationFallbackGuidance returns offline nav message', () => {
  let state = createOfflineState();
  state = transitionToOffline(state, Date.now());
  const msg = getNavigationFallbackGuidance(state);
  expect(msg.length).toBeGreaterThan(0);
});

test('buildOfflineSummary returns correct shape', () => {
  const state = createOfflineState();
  const summary = buildOfflineSummary(state);
  expect(summary.networkStatus).toBe('online');
  expect(summary.modelsTotal).toBeGreaterThan(0);
  expect(summary.guardianReady).toBeTruthy();
});

test('getOfflineStatusDescription returns description', () => {
  const state = createOfflineState();
  const desc = getOfflineStatusDescription(state);
  expect(desc.length).toBeGreaterThan(0);
});

test('getOfflineBannerText returns empty when online', () => {
  const state = createOfflineState();
  expect(getOfflineBannerText(state)).toBe('');
});

test('getOfflineBannerText returns banner when offline', () => {
  let state = createOfflineState();
  state = transitionToOffline(state, Date.now());
  const banner = getOfflineBannerText(state);
  expect(banner.length).toBeGreaterThan(0);
});

test('validateOfflineReadiness passes with ready models', () => {
  const state = createOfflineState();
  const result = validateOfflineReadiness(state);
  expect(result.ready).toBeTruthy();
  expect(result.issues.length).toBe(0);
});

test('validateOfflineReadiness fails when no models ready', () => {
  let state = createOfflineState();
  state = {
    ...state,
    models: state.models.map(m => ({ ...m, status: 'not-downloaded' as const })),
  };
  const result = validateOfflineReadiness(state);
  expect(result.ready).toBeFalsy();
  expect(result.issues.length).toBeGreaterThan(0);
});

// ─── offlineEdgeEngine ───────────────────────────────────────────────────────

test('createEdgeModelRegistry returns 5 models', () => {
  const models = createEdgeModelRegistry();
  expect(models.length).toBe(5);
});

test('all models have required fields', () => {
  const models = createEdgeModelRegistry();
  for (const m of models) {
    if (!m.id || !m.type || !m.name || !m.version) {
      throw new Error(`Model missing required fields: ${m.id}`);
    }
  }
  expect(true).toBeTruthy();
});

test('vision model exists and is ready', () => {
  const models = createEdgeModelRegistry();
  const vision = getModelByType(models, 'vision');
  expect(vision?.status).toBe('ready');
});

test('memory model exists and is ready', () => {
  const models = createEdgeModelRegistry();
  const memory = getModelByType(models, 'memory');
  expect(memory?.status).toBe('ready');
});

test('navigation model exists and is ready', () => {
  const models = createEdgeModelRegistry();
  const nav = getModelByType(models, 'navigation');
  expect(nav?.status).toBe('ready');
});

test('speech-synthesis model is ready', () => {
  const models = createEdgeModelRegistry();
  const synth = getModelByType(models, 'speech-synthesis');
  expect(synth?.status).toBe('ready');
});

test('speech-recognition model is not-downloaded by default', () => {
  const models = createEdgeModelRegistry();
  const recog = getModelByType(models, 'speech-recognition');
  expect(recog?.status).toBe('not-downloaded');
});

test('getReadyModels returns only ready models', () => {
  const models = createEdgeModelRegistry();
  const ready = getReadyModels(models);
  expect(ready.every(m => m.status === 'ready')).toBeTruthy();
  expect(ready.length).toBeGreaterThan(0);
});

test('getModelById finds by id', () => {
  const models = createEdgeModelRegistry();
  const first = models[0];
  const found = getModelById(models, first.id);
  expect(found?.id).toBe(first.id);
});

test('getModelById returns undefined for unknown id', () => {
  const models = createEdgeModelRegistry();
  expect(getModelById(models, 'nonexistent')).toBeUndefined();
});

test('selectOfflineModel finds ready model', () => {
  const models = createEdgeModelRegistry();
  const selected = selectOfflineModel(models, 'vision');
  expect(selected?.type).toBe('vision');
  expect(selected?.status).toBe('ready');
});

test('selectOfflineModel returns undefined when battery too low', () => {
  const models = createEdgeModelRegistry();
  // All models require at least 2% battery, so 0% should block
  const selected = selectOfflineModel(models, 'vision', 0);
  // minBatteryPct for vision is 5%, so 0 should return undefined
  expect(selected).toBeUndefined();
});

test('selectOfflineModel returns undefined for not-downloaded model', () => {
  const models = createEdgeModelRegistry();
  const selected = selectOfflineModel(models, 'speech-recognition', 100);
  expect(selected).toBeUndefined();
});

test('getModelPriority assigns lower number to higher priority', () => {
  expect(getModelPriority('vision')).toBe(1);
  expect(getModelPriority('speech-recognition')).toBe(3);
});

test('estimateModelLatencyMs returns positive value', () => {
  const models = createEdgeModelRegistry();
  const vision = getModelByType(models, 'vision')!;
  const latency = estimateModelLatencyMs(vision);
  expect(latency).toBeGreaterThan(0);
});

test('setModelStatus updates model status', () => {
  const models = createEdgeModelRegistry();
  const first = models[0];
  const updated = setModelStatus(models, first.id, 'stale');
  expect(updated.find(m => m.id === first.id)?.status).toBe('stale');
});

test('setModelStatus does not mutate original', () => {
  const models = createEdgeModelRegistry();
  const first = models[0];
  const original = first.status;
  setModelStatus(models, first.id, 'stale');
  expect(first.status).toBe(original);
});

test('markModelUsed updates lastUsedAt', () => {
  const models = createEdgeModelRegistry();
  const first = models[0];
  const now = Date.now();
  const updated = markModelUsed(models, first.id, now);
  expect(updated.find(m => m.id === first.id)?.lastUsedAt).toBe(now);
});

test('runOfflineInference returns result with modelId', () => {
  const models = createEdgeModelRegistry();
  const result = runOfflineInference(models, 'vision', 0);
  expect(result.offlineMode).toBeTruthy();
  expect(result.modelId.length).toBeGreaterThan(0);
});

test('runOfflineInference cycles through scenarios', () => {
  const models = createEdgeModelRegistry();
  const results = Array.from({ length: 8 }, (_, i) => runOfflineInference(models, 'vision', i));
  const allEmpty = results.every(r => r.detections.length === 0);
  expect(allEmpty).toBeFalsy(); // at least some should have detections
});

test('runOfflineInference returns safety message for no model', () => {
  const models = createEdgeModelRegistry().map(m => ({ ...m, status: 'not-downloaded' as const }));
  const result = runOfflineInference(models, 'vision', 0);
  expect(result.safetyMessage).toBeTruthy();
  expect(result.modelId).toBe('none');
});

test('runOfflineSpeechSynthesis returns supported when model ready', () => {
  const models = createEdgeModelRegistry();
  const result = runOfflineSpeechSynthesis(models, 'Test speech');
  expect(result.supported).toBeTruthy();
});

test('runOfflineSpeechSynthesis falls back to device TTS when model missing', () => {
  const models = createEdgeModelRegistry().map(m => ({ ...m, status: 'not-downloaded' as const }));
  const result = runOfflineSpeechSynthesis(models, 'Test');
  expect(result.fallbackToDeviceTTS).toBeTruthy();
  expect(result.modelId).toBe('device-tts');
});

test('runOfflineSpeechRecognition falls back to device ASR when model missing', () => {
  const models = createEdgeModelRegistry(); // speech-recognition is not-downloaded
  const result = runOfflineSpeechRecognition(models);
  expect(result.fallbackToDeviceASR).toBeTruthy();
});

test('checkModelIntegrity passes for ready model', () => {
  const models = createEdgeModelRegistry();
  const vision = getModelByType(models, 'vision')!;
  const check = checkModelIntegrity(vision);
  expect(check.passed).toBeTruthy();
  expect(check.expectedHash).toBe(check.actualHash);
});

test('checkModelIntegrity fails for not-downloaded model', () => {
  const models = createEdgeModelRegistry();
  const notDl = models.find(m => m.status === 'not-downloaded')!;
  const check = checkModelIntegrity(notDl);
  expect(check.passed).toBeFalsy();
});

test('checkAllModels returns check for every model', () => {
  const models = createEdgeModelRegistry();
  const checks = checkAllModels(models);
  expect(checks.length).toBe(models.length);
});

test('allIntegrityPassed returns false when any check fails', () => {
  const models = createEdgeModelRegistry();
  const checks = checkAllModels(models);
  // speech-recognition is not-downloaded, so it will fail
  expect(allIntegrityPassed(checks)).toBeFalsy();
});

test('allIntegrityPassed returns true when all ready', () => {
  const models = createEdgeModelRegistry().map(m => ({ ...m, status: 'ready' as const }));
  const checks = checkAllModels(models);
  expect(allIntegrityPassed(checks)).toBeTruthy();
});

test('getModelStatusLabel returns correct labels', () => {
  expect(getModelStatusLabel('ready')).toBe('Ready');
  expect(getModelStatusLabel('not-downloaded')).toBe('Not downloaded');
  expect(getModelStatusLabel('corrupted')).toContain('Corrupted');
});

test('getModelTypeLabel returns correct labels', () => {
  expect(getModelTypeLabel('vision')).toBe('Vision');
  expect(getModelTypeLabel('navigation')).toBe('Navigation');
  expect(getModelTypeLabel('memory')).toBe('Memory');
});

test('formatModelSize formats KB correctly', () => {
  expect(formatModelSize(500)).toContain('KB');
});

test('formatModelSize formats MB correctly', () => {
  expect(formatModelSize(48_000)).toContain('MB');
});

test('shouldUpdateModel returns true for stale', () => {
  const models = createEdgeModelRegistry();
  const updated = setModelStatus(models, models[0].id, 'stale');
  expect(shouldUpdateModel(updated[0])).toBeTruthy();
});

test('getVersionSummary returns summary for each model', () => {
  const models = createEdgeModelRegistry();
  const summary = getVersionSummary(models);
  expect(summary.length).toBe(models.length);
  expect(summary.every(s => s.version && s.type)).toBeTruthy();
});

test('getTotalModelSizeKb sums only ready models', () => {
  const models = createEdgeModelRegistry();
  const total = getTotalModelSizeKb(models);
  const readyOnly = getReadyModels(models).reduce((s, m) => s + m.sizeKb, 0);
  expect(total).toBe(readyOnly);
});

test('getDownloadQueue returns not-downloaded and stale models', () => {
  const models = createEdgeModelRegistry();
  const queue = getDownloadQueue(models);
  expect(queue.every(m => m.status === 'not-downloaded' || m.status === 'stale')).toBeTruthy();
});

// ─── offlineSyncEngine ───────────────────────────────────────────────────────

test('createSyncQueue returns empty queue', () => {
  const queue = createSyncQueue();
  expect(queue.records.length).toBe(0);
  expect(queue.totalPending).toBe(0);
  expect(queue.isActive).toBeFalsy();
});

test('createSyncRecord creates valid record', () => {
  const rec = createSyncRecord('id-1', 'memories', Date.now(), 'data');
  expect(rec.id).toBe('id-1');
  expect(rec.status).toBe('pending');
  expect(rec.retryCount).toBe(0);
  expect(rec.maxRetries).toBe(3);
});

test('addToQueue adds record and updates totalPending', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'payload');
  expect(queue.records.length).toBe(1);
  expect(queue.totalPending).toBe(1);
});

test('addToQueue preserves previous records', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'payload1');
  queue = addToQueue(queue, 'preferences', Date.now(), 'payload2');
  expect(queue.records.length).toBe(2);
  expect(queue.totalPending).toBe(2);
});

test('removeFromQueue removes correct record', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'payload');
  const id = queue.records[0].id;
  queue = removeFromQueue(queue, id);
  expect(queue.records.length).toBe(0);
});

test('clearCompleted removes only complete records', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p1');
  queue = addToQueue(queue, 'preferences', Date.now(), 'p2');
  const id1 = queue.records[0].id;
  queue = markRecordComplete(queue, id1, Date.now(), Date.now());
  queue = clearCompleted(queue);
  expect(queue.records.length).toBe(1);
  expect(queue.records[0].status).toBe('pending');
});

test('startSync sets isActive to true', () => {
  const queue = createSyncQueue();
  expect(startSync(queue).isActive).toBeTruthy();
});

test('stopSync sets isActive to false', () => {
  let queue = startSync(createSyncQueue());
  queue = stopSync(queue, Date.now());
  expect(queue.isActive).toBeFalsy();
  expect(queue.lastProcessedAt).toBeTruthy();
});

test('markRecordSyncing updates status', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p');
  const id = queue.records[0].id;
  queue = markRecordSyncing(queue, id, Date.now());
  expect(queue.records[0].status).toBe('syncing');
});

test('markRecordComplete updates status and remoteTimestamp', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p');
  const id = queue.records[0].id;
  const remoteTs = Date.now() + 1000;
  queue = markRecordComplete(queue, id, remoteTs, Date.now());
  expect(queue.records[0].status).toBe('complete');
  expect(queue.records[0].remoteTimestamp).toBe(remoteTs);
  expect(queue.totalPending).toBe(0);
});

test('markRecordFailed increments retryCount', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p');
  const id = queue.records[0].id;
  queue = markRecordFailed(queue, id, 'network error');
  expect(queue.records[0].retryCount).toBe(1);
  expect(queue.records[0].errorMessage).toBe('network error');
});

test('markRecordFailed marks as failed after max retries', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p');
  const id = queue.records[0].id;
  // fail 3 times (maxRetries = 3)
  queue = markRecordFailed(queue, id, 'err');
  queue = markRecordFailed(queue, id, 'err');
  queue = markRecordFailed(queue, id, 'err');
  expect(queue.records[0].status).toBe('failed');
});

test('markRecordConflict updates status and remoteTimestamp', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'preferences', Date.now(), 'p');
  const id = queue.records[0].id;
  const remoteTs = Date.now() + 5000;
  queue = markRecordConflict(queue, id, remoteTs);
  expect(queue.records[0].status).toBe('conflict');
  expect(queue.records[0].remoteTimestamp).toBe(remoteTs);
});

test('detectConflict returns true when remote is newer', () => {
  const localTs = Date.now();
  const remoteTs = localTs + 5000;
  expect(detectConflict(localTs, remoteTs)).toBeTruthy();
});

test('detectConflict returns false when remote is null', () => {
  expect(detectConflict(Date.now(), null)).toBeFalsy();
});

test('detectConflict returns false when local is newer', () => {
  const now = Date.now();
  expect(detectConflict(now + 1000, now)).toBeFalsy();
});

test('applyConflictStrategy local-wins returns local', () => {
  expect(applyConflictStrategy('local', 'remote', Date.now(), Date.now(), 'local-wins')).toBe('local');
});

test('applyConflictStrategy remote-wins returns remote', () => {
  expect(applyConflictStrategy('local', 'remote', Date.now(), Date.now(), 'remote-wins')).toBe('remote');
});

test('applyConflictStrategy latest-wins returns newer', () => {
  const now = Date.now();
  // remote is newer
  const result = applyConflictStrategy('local', 'remote', now, now + 1000, 'latest-wins');
  expect(result).toBe('remote');
});

test('applyConflictStrategy merge concatenates values', () => {
  const result = applyConflictStrategy('local', 'remote', Date.now(), Date.now(), 'merge');
  expect(result).toContain('local');
  expect(result).toContain('remote');
});

test('resolveConflict resolves and returns ConflictReport', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'preferences', Date.now() - 5000, 'local-data', 'latest-wins');
  const id = queue.records[0].id;
  queue = markRecordConflict(queue, id, Date.now());
  const { queue: resolved, report } = resolveConflict(queue, id, 'remote-data', Date.now());
  expect(report).toBeTruthy();
  expect(report?.category).toBe('preferences');
  expect(resolved.records.find(r => r.id === id)?.status).toBe('complete');
});

test('resolveConflict returns null report for non-conflict record', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p');
  const id = queue.records[0].id;
  const { report } = resolveConflict(queue, id, 'remote', Date.now());
  expect(report).toBeNull();
});

test('getNextBatch returns up to 10 pending records', () => {
  let queue = createSyncQueue();
  for (let i = 0; i < 15; i++) {
    queue = addToQueue(queue, 'analytics', Date.now(), `p${i}`);
  }
  const batch = getNextBatch(queue);
  expect(batch.length).toBeLessThanOrEqual(10);
  expect(batch.every(r => r.status === 'pending')).toBeTruthy();
});

test('buildRetryQueue returns only records with retryCount > 0', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p1');
  queue = addToQueue(queue, 'preferences', Date.now(), 'p2');
  const id1 = queue.records[0].id;
  queue = markRecordFailed(queue, id1, 'err'); // retryCount = 1, status still pending
  const retry = buildRetryQueue(queue);
  expect(retry.length).toBe(1);
});

test('getFailedRecords returns only failed records', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p');
  const id = queue.records[0].id;
  queue = markRecordFailed(queue, id, 'e');
  queue = markRecordFailed(queue, id, 'e');
  queue = markRecordFailed(queue, id, 'e'); // now failed
  expect(getFailedRecords(queue).length).toBe(1);
});

test('resetFailedRecord resets to pending', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p');
  const id = queue.records[0].id;
  queue = markRecordFailed(queue, id, 'e');
  queue = markRecordFailed(queue, id, 'e');
  queue = markRecordFailed(queue, id, 'e'); // now failed
  queue = resetFailedRecord(queue, id);
  expect(queue.records[0].status).toBe('pending');
  expect(queue.records[0].retryCount).toBe(0);
});

test('resetAllFailed resets all failed records', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p1');
  queue = addToQueue(queue, 'preferences', Date.now(), 'p2');
  for (const id of [queue.records[0].id, queue.records[1].id]) {
    queue = markRecordFailed(queue, id, 'e');
    queue = markRecordFailed(queue, id, 'e');
    queue = markRecordFailed(queue, id, 'e');
  }
  queue = resetAllFailed(queue);
  expect(queue.records.every(r => r.status === 'pending')).toBeTruthy();
});

test('getSyncSummary counts correctly', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p1');
  queue = addToQueue(queue, 'preferences', Date.now(), 'p2');
  const summary = getSyncSummary(queue);
  expect(summary.pending).toBe(2);
  expect(summary.total).toBe(2);
  expect(summary.complete).toBe(0);
});

test('getCategoryBreakdown groups by category', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'memories', Date.now(), 'p1');
  queue = addToQueue(queue, 'memories', Date.now(), 'p2');
  queue = addToQueue(queue, 'preferences', Date.now(), 'p3');
  const breakdown = getCategoryBreakdown(queue);
  expect(breakdown['memories']).toBe(2);
  expect(breakdown['preferences']).toBe(1);
});

test('hasPendingSync returns true when pending > 0', () => {
  let queue = createSyncQueue();
  queue = addToQueue(queue, 'analytics', Date.now(), 'p');
  expect(hasPendingSync(queue)).toBeTruthy();
});

test('isQueueEmpty returns true for empty queue', () => {
  expect(isQueueEmpty(createSyncQueue())).toBeTruthy();
});

test('getSyncStatusLabel returns correct labels', () => {
  expect(getSyncStatusLabel('idle')).toBe('Idle');
  expect(getSyncStatusLabel('pending')).toBe('Pending');
  expect(getSyncStatusLabel('complete')).toBe('Synced');
  expect(getSyncStatusLabel('failed')).toBe('Failed');
});

test('getCategoryLabel returns readable labels', () => {
  expect(getCategoryLabel('memories')).toBe('Memories');
  expect(getCategoryLabel('navigation-history')).toBe('Navigation history');
  expect(getCategoryLabel('accessibility-prefs')).toBe('Accessibility preferences');
});

// ─── offlineModelRegistryEngine ──────────────────────────────────────────────

test('getAllModels returns all 5 models', () => {
  const models = createEdgeModelRegistry();
  expect(getAllModels(models).length).toBe(5);
});

test('getModelsByType returns models of requested type', () => {
  const models = createEdgeModelRegistry();
  const visionModels = getModelsByType(models, 'vision');
  expect(visionModels.every(m => m.type === 'vision')).toBeTruthy();
});

test('getModelsByStatus filters by status', () => {
  const models = createEdgeModelRegistry();
  const ready = getModelsByStatus(models, 'ready');
  expect(ready.every(m => m.status === 'ready')).toBeTruthy();
});

test('getCorruptedModels returns empty initially', () => {
  const models = createEdgeModelRegistry();
  expect(getCorruptedModels(models).length).toBe(0);
});

test('markCorrupted sets corrupted status', () => {
  const models = createEdgeModelRegistry();
  const id = models[0].id;
  const updated = markCorrupted(models, id);
  expect(getCorruptedModels(updated).length).toBe(1);
});

test('startDownload sets downloading status', () => {
  const models = createEdgeModelRegistry();
  const notDl = models.find(m => m.status === 'not-downloaded')!;
  const updated = startDownload(models, notDl.id);
  expect(updated.find(m => m.id === notDl.id)?.status).toBe('downloading');
});

test('completeDownload sets ready and records timestamp', () => {
  const models = createEdgeModelRegistry();
  const notDl = models.find(m => m.status === 'not-downloaded')!;
  const now = Date.now();
  const updated = completeDownload(models, notDl.id, now);
  const model = updated.find(m => m.id === notDl.id)!;
  expect(model.status).toBe('ready');
  expect(model.downloadedAt).toBe(now);
});

test('removeModel resets to not-downloaded', () => {
  const models = createEdgeModelRegistry();
  const ready = models.find(m => m.status === 'ready')!;
  const updated = removeModel(models, ready.id);
  const model = updated.find(m => m.id === ready.id)!;
  expect(model.status).toBe('not-downloaded');
  expect(model.downloadedAt).toBeNull();
});

test('canDownloadOnBattery checks minBatteryPct', () => {
  const models = createEdgeModelRegistry();
  const vision = models.find(m => m.type === 'vision')!; // minBatteryPct = 5
  expect(canDownloadOnBattery(vision, 10)).toBeTruthy();
  expect(canDownloadOnBattery(vision, 4)).toBeFalsy();
});

test('validateModelCoverage reports covered and missing types', () => {
  const models = createEdgeModelRegistry();
  const coverage = validateModelCoverage(models);
  // speech-recognition is not-downloaded
  expect(coverage.missing).toInclude('speech-recognition');
  expect(coverage.covered.length).toBeGreaterThan(0);
});

test('isCriticalModelMissing returns false when vision and memory ready', () => {
  const models = createEdgeModelRegistry();
  expect(isCriticalModelMissing(models)).toBeFalsy();
});

test('isCriticalModelMissing returns true when vision removed', () => {
  const models = createEdgeModelRegistry();
  const vision = models.find(m => m.type === 'vision')!;
  const updated = removeModel(models, vision.id);
  expect(isCriticalModelMissing(updated)).toBeTruthy();
});

test('bumpVersion increments patch version', () => {
  expect(bumpVersion('1.0.0')).toBe('1.0.1');
  expect(bumpVersion('2.5.3')).toBe('2.5.4');
});

test('getStorageSummary returns correct summary', () => {
  const models = createEdgeModelRegistry();
  const summary = getStorageSummary(models);
  expect(summary.modelCount).toBe(5);
  expect(summary.readyCount).toBeGreaterThan(0);
  expect(summary.installedKb).toBeGreaterThan(0);
});

test('listUpdatableModels returns only stale models', () => {
  const models = createEdgeModelRegistry();
  const withStale = markStale(models, models[0].id);
  expect(listUpdatableModels(withStale).length).toBe(1);
});

// ─── Results ─────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\nOffline Engine Tests: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.error('\nFailed tests:');
  errors.forEach(e => console.error(e));
  process.exit(1);
}

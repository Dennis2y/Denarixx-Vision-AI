// ─── Sprint 14: Offline Engine ────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Glasses-first offline orchestrator: routes all safety features through the
// glasses compute module. Phone app is secondary (dashboard + fallback only).
// Architecture priority: Glasses edge AI → phone companion → cloud (optional).

import type {
  OfflineState,
  OfflineCapabilityTable,
  OfflineCapabilityEntry,
  OfflineFeature,
  OfflineSummary,
  NetworkStatus,
  EdgeModel,
  SyncQueue,
} from '@/types/offline';
import {
  DEFAULT_NETWORK_READING,
  OFFLINE_SAFETY_NOTE,
  OFFLINE_GUARDIAN_NOTE,
  OFFLINE_NAVIGATION_NOTE,
} from '@/types/offline';
import { createNetworkReading, isOffline } from '@/engines/networkMonitorEngine';
import { createSyncQueue } from '@/engines/offlineSyncEngine';
import { createEdgeModelRegistry } from '@/engines/offlineEdgeEngine';

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createOfflineState(now = Date.now()): OfflineState {
  const network = createNetworkReading({
    lastOnlineAt: now,
    lastSyncAt: now,
  });
  const models = createEdgeModelRegistry();
  const syncQueue = createSyncQueue();
  const capabilities = buildCapabilityTable();

  return {
    network,
    models,
    syncQueue,
    capabilities,
    guardianOfflineReady: true,
    memoryOfflineReady: true,
    lastFullSyncAt: now,
    sessionStartedOffline: false,
  };
}

// ─── Capability Table ─────────────────────────────────────────────────────────

export function buildCapabilityTable(): OfflineCapabilityTable {
  const entries: OfflineCapabilityEntry[] = [
    {
      feature: 'hazard-detection',
      availableOffline: true,
      degraded: true,
      degradedMessage: 'Using local hazard patterns. Cloud scene analysis unavailable.',
      requiresModel: 'vision',
      qualityWhenOffline: 'partial',
    },
    {
      feature: 'navigation',
      availableOffline: true,
      degraded: true,
      degradedMessage: 'Using cached route data. Live updates unavailable.',
      requiresModel: 'navigation',
      qualityWhenOffline: 'cached',
    },
    {
      feature: 'memory',
      availableOffline: true,
      degraded: false,
      degradedMessage: '',
      requiresModel: 'memory',
      qualityWhenOffline: 'full',
    },
    {
      feature: 'guardian',
      availableOffline: true,
      degraded: true,
      degradedMessage: 'Guardian active with local inference only.',
      requiresModel: 'vision',
      qualityWhenOffline: 'partial',
    },
    {
      feature: 'voice',
      availableOffline: true,
      degraded: true,
      degradedMessage: 'Speech synthesis uses device TTS. Neural voice unavailable.',
      requiresModel: 'speech-synthesis',
      qualityWhenOffline: 'partial',
    },
    {
      feature: 'companion',
      availableOffline: true,
      degraded: true,
      degradedMessage: 'Companion uses cached context. Real-time learning paused.',
      requiresModel: null,
      qualityWhenOffline: 'partial',
    },
    {
      feature: 'language',
      availableOffline: true,
      degraded: false,
      degradedMessage: '',
      requiresModel: null,
      qualityWhenOffline: 'full',
    },
    {
      feature: 'preferences',
      availableOffline: true,
      degraded: false,
      degradedMessage: '',
      requiresModel: null,
      qualityWhenOffline: 'full',
    },
    {
      feature: 'trust',
      availableOffline: true,
      degraded: true,
      degradedMessage: 'Trust score uses local history only.',
      requiresModel: null,
      qualityWhenOffline: 'cached',
    },
    {
      feature: 'accessibility',
      availableOffline: true,
      degraded: false,
      degradedMessage: '',
      requiresModel: null,
      qualityWhenOffline: 'full',
    },
  ];

  return Object.fromEntries(
    entries.map(e => [e.feature, e]),
  ) as OfflineCapabilityTable;
}

// ─── Feature Queries ─────────────────────────────────────────────────────────

export function getOfflineFeatureStatus(
  state: OfflineState,
  feature: OfflineFeature,
): OfflineCapabilityEntry {
  return state.capabilities[feature];
}

export function isFeatureAvailable(
  state: OfflineState,
  feature: OfflineFeature,
): boolean {
  const entry = state.capabilities[feature];
  if (!entry.availableOffline) return false;
  if (!isOffline(state.network)) return true;
  if (entry.requiresModel !== null) {
    const model = state.models.find(m => m.type === entry.requiresModel);
    return model?.status === 'ready' || false;
  }
  return true;
}

export function listAvailableFeatures(state: OfflineState): OfflineFeature[] {
  return (Object.keys(state.capabilities) as OfflineFeature[]).filter(f =>
    isFeatureAvailable(state, f),
  );
}

export function listDegradedFeatures(state: OfflineState): OfflineFeature[] {
  if (!isOffline(state.network)) return [];
  return (Object.keys(state.capabilities) as OfflineFeature[]).filter(
    f => state.capabilities[f].degraded && isFeatureAvailable(state, f),
  );
}

export function countReadyModels(models: EdgeModel[]): number {
  return models.filter(m => m.status === 'ready').length;
}

// ─── Network Transitions ─────────────────────────────────────────────────────

export function transitionToOnline(
  state: OfflineState,
  now: number,
): OfflineState {
  return {
    ...state,
    network: {
      ...state.network,
      status: 'online',
      quality: 'excellent',
      lastOnlineAt: now,
      offlineDurationMs: 0,
      reconnectAttempts: 0,
      bandwidthEstimateKbps: 10_000,
      latencyMs: 20,
    },
    syncQueue: {
      ...state.syncQueue,
      isActive: state.syncQueue.totalPending > 0,
    },
  };
}

export function transitionToOffline(
  state: OfflineState,
  now: number,
): OfflineState {
  return {
    ...state,
    network: {
      ...state.network,
      status: 'offline',
      quality: 'none',
      lastOnlineAt: now,
      bandwidthEstimateKbps: 0,
      latencyMs: 0,
    },
    sessionStartedOffline: state.network.status === 'offline',
  };
}

export function applyNetworkStatus(
  state: OfflineState,
  status: NetworkStatus,
  now: number,
): OfflineState {
  switch (status) {
    case 'online':       return transitionToOnline(state, now);
    case 'offline':      return transitionToOffline(state, now);
    case 'weak':
      return {
        ...state,
        network: { ...state.network, status: 'weak', quality: 'poor', bandwidthEstimateKbps: 200, latencyMs: 600 },
      };
    case 'reconnecting':
      return {
        ...state,
        network: {
          ...state.network,
          status: 'reconnecting',
          reconnectAttempts: state.network.reconnectAttempts + 1,
        },
      };
    case 'sync-pending':
      return {
        ...state,
        network: { ...state.network, status: 'sync-pending' },
      };
    default:
      return state;
  }
}

// ─── Guardian Fallback ────────────────────────────────────────────────────────

export function isGuardianSafe(state: OfflineState): boolean {
  return state.guardianOfflineReady;
}

export function getGuardianFallbackMessage(state: OfflineState): string {
  if (!isOffline(state.network)) {
    return 'Guardian operating normally with cloud assistance.';
  }
  if (state.guardianOfflineReady) {
    return OFFLINE_GUARDIAN_NOTE;
  }
  return 'Guardian is limited. Please proceed with extra caution and use your cane.';
}

export function getGuardianOfflineGuidance(hazardType: string): string {
  const patterns: Record<string, string> = {
    steps:         'Caution: steps detected ahead based on local patterns.',
    vehicle:       'Caution: vehicle nearby. Stop and listen before proceeding.',
    obstacle:      'Obstacle ahead. Slow down and check path with cane.',
    person:        'Person nearby. Proceed slowly.',
    cyclist:       'Cyclist detected. Stay to the side.',
    water:         'Wet surface ahead. Take care.',
    door:          'Door ahead. Check if open or closed.',
    construction:  'Construction zone. Extra caution required.',
  };
  return patterns[hazardType] ?? `${OFFLINE_SAFETY_NOTE} Hazard: ${hazardType}.`;
}

// ─── Memory Fallback ──────────────────────────────────────────────────────────

export function getMemoryFallbackSummary(state: OfflineState): string {
  if (state.memoryOfflineReady) {
    return 'Memory accessible from local cache. New memories will sync when online.';
  }
  return 'Memory unavailable offline. Please reconnect to access your history.';
}

// ─── Navigation Fallback ──────────────────────────────────────────────────────

export function getNavigationFallbackGuidance(state: OfflineState): string {
  const navCap = state.capabilities['navigation'];
  if (!navCap.availableOffline) return 'Navigation requires internet connection.';
  return OFFLINE_NAVIGATION_NOTE;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export function buildOfflineSummary(state: OfflineState): OfflineSummary {
  const features = Object.keys(state.capabilities) as OfflineFeature[];
  const degraded = listDegradedFeatures(state);
  const available = listAvailableFeatures(state);

  return {
    networkStatus: state.network.status,
    networkQuality: state.network.quality,
    modelsReady: countReadyModels(state.models),
    modelsTotal: state.models.length,
    pendingSyncItems: state.syncQueue.totalPending,
    offlineFeaturesAvailable: available.length,
    offlineFeaturesDegraded: degraded.length,
    guardianReady: state.guardianOfflineReady,
    lastSyncAt: state.network.lastSyncAt,
    offlineDurationMs: state.network.offlineDurationMs,
  };
}

export function getOfflineStatusDescription(state: OfflineState): string {
  if (!isOffline(state.network)) {
    const pending = state.syncQueue.totalPending;
    if (pending > 0) return `Online — ${pending} items pending sync.`;
    return 'Fully online. All features available.';
  }
  const dur = state.network.offlineDurationMs;
  const secs = Math.floor(dur / 1_000);
  const durStr = secs > 0 ? ` (${secs}s)` : '';
  const ready = countReadyModels(state.models);
  return `Offline${durStr} — ${ready} edge models active. Guardian ready.`;
}

export function getOfflineBannerText(state: OfflineState): string {
  switch (state.network.status) {
    case 'online':       return '';
    case 'offline':      return '⚠ Offline — using local AI';
    case 'weak':         return '⚠ Weak connection — some features limited';
    case 'reconnecting': return '⟳ Reconnecting…';
    case 'sync-pending': return '↑ Syncing data…';
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateOfflineReadiness(state: OfflineState): {
  ready: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const readyModels = countReadyModels(state.models);

  if (readyModels === 0) {
    issues.push('No edge models downloaded. Offline hazard detection will be basic.');
  }
  if (!state.guardianOfflineReady) {
    issues.push('Guardian is not ready for offline use.');
  }
  if (!state.memoryOfflineReady) {
    issues.push('Memory cache not initialised.');
  }

  return { ready: issues.length === 0, issues };
}

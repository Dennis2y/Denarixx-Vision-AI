// ─── Sprint 14: Offline Mode & Edge AI — Types ────────────────────────────────
// Pure data types — no async, no I/O.
// Never merge into index.ts.

// ─── Network ─────────────────────────────────────────────────────────────────

export type NetworkStatus =
  | 'online'
  | 'offline'
  | 'weak'
  | 'reconnecting'
  | 'sync-pending';

export type NetworkQuality = 'excellent' | 'good' | 'poor' | 'none';

export interface NetworkReading {
  status: NetworkStatus;
  quality: NetworkQuality;
  lastOnlineAt: number;       // ms timestamp (0 = never)
  offlineDurationMs: number;
  reconnectAttempts: number;
  lastSyncAt: number | null;
  bandwidthEstimateKbps: number;
  latencyMs: number;
}

// ─── Edge Models ─────────────────────────────────────────────────────────────

export type EdgeModelType =
  | 'vision'
  | 'speech-synthesis'
  | 'speech-recognition'
  | 'navigation'
  | 'memory';

export type ModelStatus =
  | 'not-downloaded'
  | 'downloading'
  | 'ready'
  | 'updating'
  | 'corrupted'
  | 'stale';

export interface EdgeModel {
  id: string;
  type: EdgeModelType;
  name: string;
  version: string;
  sizeKb: number;
  status: ModelStatus;
  integrityHash: string;     // SHA-256 (simulated)
  downloadedAt: number | null;
  lastUsedAt: number | null;
  priority: number;          // 1 = highest
  supportsOffline: boolean;
  minBatteryPct: number;     // won't load below this
}

// ─── Offline Features ─────────────────────────────────────────────────────────

export type OfflineFeature =
  | 'hazard-detection'
  | 'navigation'
  | 'memory'
  | 'guardian'
  | 'voice'
  | 'companion'
  | 'language'
  | 'preferences'
  | 'trust'
  | 'accessibility';

export interface OfflineCapabilityEntry {
  feature: OfflineFeature;
  availableOffline: boolean;
  degraded: boolean;
  degradedMessage: string;
  requiresModel: EdgeModelType | null;
  qualityWhenOffline: 'full' | 'partial' | 'cached' | 'unavailable';
}

export type OfflineCapabilityTable = Record<OfflineFeature, OfflineCapabilityEntry>;

// ─── Sync ─────────────────────────────────────────────────────────────────────

export type SyncCategory =
  | 'navigation-history'
  | 'memories'
  | 'preferences'
  | 'permissions'
  | 'analytics'
  | 'language-prefs'
  | 'accessibility-prefs';

export type SyncState =
  | 'idle'
  | 'pending'
  | 'syncing'
  | 'complete'
  | 'failed'
  | 'conflict';

export type ConflictStrategy =
  | 'remote-wins'
  | 'local-wins'
  | 'latest-wins'
  | 'merge';

export interface SyncRecord {
  id: string;
  category: SyncCategory;
  localTimestamp: number;
  remoteTimestamp: number | null;
  status: SyncState;
  conflictStrategy: ConflictStrategy;
  payload: string;           // JSON-safe summary (no PII)
  retryCount: number;
  maxRetries: number;
  lastAttemptAt: number | null;
  resolvedAt: number | null;
  errorMessage: string | null;
}

export interface SyncQueue {
  records: SyncRecord[];
  totalPending: number;
  lastProcessedAt: number | null;
  isActive: boolean;
}

export interface ConflictReport {
  recordId: string;
  category: SyncCategory;
  resolution: ConflictStrategy;
  localValue: string;
  remoteValue: string;
  resolvedValue: string;
  resolvedAt: number;
}

// ─── Model Integrity ─────────────────────────────────────────────────────────

export interface ModelIntegrityCheck {
  modelId: string;
  expectedHash: string;
  actualHash: string;
  passed: boolean;
  checkedAt: number;
}

// ─── Offline State ────────────────────────────────────────────────────────────

export interface OfflineState {
  network: NetworkReading;
  models: EdgeModel[];
  syncQueue: SyncQueue;
  capabilities: OfflineCapabilityTable;
  guardianOfflineReady: boolean;
  memoryOfflineReady: boolean;
  lastFullSyncAt: number | null;
  sessionStartedOffline: boolean;
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export interface OfflineSummary {
  networkStatus: NetworkStatus;
  networkQuality: NetworkQuality;
  modelsReady: number;
  modelsTotal: number;
  pendingSyncItems: number;
  offlineFeaturesAvailable: number;
  offlineFeaturesDegraded: number;
  guardianReady: boolean;
  lastSyncAt: number | null;
  offlineDurationMs: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const OFFLINE_SAFETY_NOTE =
  'Glasses offline: Edge AI active on compute module. Guardian operating with on-device hazard detection.';

export const OFFLINE_GUARDIAN_NOTE =
  'Guardian running on glasses compute module. ' +
  'Cloud scene enhancement unavailable — local vision model active.';

export const SYNC_PRIVACY_NOTE =
  'Sync transmits only anonymised preference and navigation data. ' +
  'Camera frames, audio, and biometric data from the glasses are never stored or synced.';

export const OFFLINE_NAVIGATION_NOTE =
  'Navigation using cached route data on glasses. Live updates unavailable until cloud reconnects.';

export const DEFAULT_NETWORK_READING: NetworkReading = {
  status: 'online',
  quality: 'excellent',
  lastOnlineAt: 0,
  offlineDurationMs: 0,
  reconnectAttempts: 0,
  lastSyncAt: null,
  bandwidthEstimateKbps: 10_000,
  latencyMs: 20,
};

export const WEAK_CONNECTION_THRESHOLD_KBPS = 500;
export const POOR_LATENCY_THRESHOLD_MS = 500;
export const MAX_SYNC_RETRIES = 3;
export const SYNC_BATCH_SIZE = 10;

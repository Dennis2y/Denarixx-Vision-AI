// ─── Sprint 14: Offline Sync Engine ───────────────────────────────────────────
// Pure functions — no async, no I/O.
// Manages the sync queue, conflict resolution, and retry logic.

import type {
  SyncQueue,
  SyncRecord,
  SyncCategory,
  SyncState,
  ConflictStrategy,
  ConflictReport,
} from '@/types/offline';
import { MAX_SYNC_RETRIES, SYNC_BATCH_SIZE } from '@/types/offline';

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createSyncQueue(): SyncQueue {
  return {
    records: [],
    totalPending: 0,
    lastProcessedAt: null,
    isActive: false,
  };
}

export function createSyncRecord(
  id: string,
  category: SyncCategory,
  localTimestamp: number,
  payload: string,
  strategy: ConflictStrategy = 'latest-wins',
): SyncRecord {
  return {
    id,
    category,
    localTimestamp,
    remoteTimestamp: null,
    status: 'pending',
    conflictStrategy: strategy,
    payload,
    retryCount: 0,
    maxRetries: MAX_SYNC_RETRIES,
    lastAttemptAt: null,
    resolvedAt: null,
    errorMessage: null,
  };
}

// ─── Queue Management ─────────────────────────────────────────────────────────

export function addToQueue(
  queue: SyncQueue,
  category: SyncCategory,
  localTimestamp: number,
  payload: string,
  strategy: ConflictStrategy = 'latest-wins',
): SyncQueue {
  const id = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record = createSyncRecord(id, category, localTimestamp, payload, strategy);
  const records = [...queue.records, record];
  return {
    ...queue,
    records,
    totalPending: records.filter(r => r.status === 'pending' || r.status === 'conflict').length,
  };
}

export function removeFromQueue(queue: SyncQueue, id: string): SyncQueue {
  const records = queue.records.filter(r => r.id !== id);
  return {
    ...queue,
    records,
    totalPending: records.filter(r => r.status === 'pending' || r.status === 'conflict').length,
  };
}

export function clearCompleted(queue: SyncQueue): SyncQueue {
  const records = queue.records.filter(r => r.status !== 'complete');
  return {
    ...queue,
    records,
    totalPending: records.filter(r => r.status === 'pending' || r.status === 'conflict').length,
  };
}

// ─── Sync Processing ──────────────────────────────────────────────────────────

export function startSync(queue: SyncQueue): SyncQueue {
  return { ...queue, isActive: true };
}

export function stopSync(queue: SyncQueue, now: number): SyncQueue {
  return { ...queue, isActive: false, lastProcessedAt: now };
}

export function markRecordSyncing(
  queue: SyncQueue,
  id: string,
  now: number,
): SyncQueue {
  return updateRecord(queue, id, { status: 'syncing', lastAttemptAt: now });
}

export function markRecordComplete(
  queue: SyncQueue,
  id: string,
  remoteTimestamp: number,
  now: number,
): SyncQueue {
  const updated = updateRecord(queue, id, {
    status: 'complete',
    remoteTimestamp,
    resolvedAt: now,
  });
  return {
    ...updated,
    totalPending: updated.records.filter(
      r => r.status === 'pending' || r.status === 'conflict',
    ).length,
  };
}

export function markRecordFailed(
  queue: SyncQueue,
  id: string,
  error: string,
): SyncQueue {
  const record = queue.records.find(r => r.id === id);
  if (!record) return queue;
  const newCount = record.retryCount + 1;
  const newStatus: SyncState =
    newCount >= record.maxRetries ? 'failed' : 'pending';
  return updateRecord(queue, id, {
    status: newStatus,
    retryCount: newCount,
    errorMessage: error,
  });
}

export function markRecordConflict(
  queue: SyncQueue,
  id: string,
  remoteTimestamp: number,
): SyncQueue {
  return updateRecord(queue, id, { status: 'conflict', remoteTimestamp });
}

// ─── Conflict Resolution ──────────────────────────────────────────────────────

export function detectConflict(
  localTimestamp: number,
  remoteTimestamp: number | null,
): boolean {
  if (remoteTimestamp === null) return false;
  // Conflict if remote was updated after local was written
  return remoteTimestamp > localTimestamp;
}

export function applyConflictStrategy(
  localValue: string,
  remoteValue: string,
  localTimestamp: number,
  remoteTimestamp: number | null,
  strategy: ConflictStrategy,
): string {
  switch (strategy) {
    case 'local-wins':
      return localValue;
    case 'remote-wins':
      return remoteValue;
    case 'latest-wins':
      if (remoteTimestamp === null) return localValue;
      return remoteTimestamp > localTimestamp ? remoteValue : localValue;
    case 'merge':
      // Append both values (simplified for simulation)
      return `${localValue}|${remoteValue}`;
  }
}

export function resolveConflict(
  queue: SyncQueue,
  id: string,
  remoteValue: string,
  now: number,
): { queue: SyncQueue; report: ConflictReport | null } {
  const record = queue.records.find(r => r.id === id);
  if (!record || record.status !== 'conflict') {
    return { queue, report: null };
  }

  const resolvedValue = applyConflictStrategy(
    record.payload,
    remoteValue,
    record.localTimestamp,
    record.remoteTimestamp,
    record.conflictStrategy,
  );

  const report: ConflictReport = {
    recordId: id,
    category: record.category,
    resolution: record.conflictStrategy,
    localValue: record.payload,
    remoteValue,
    resolvedValue,
    resolvedAt: now,
  };

  const updatedQueue = updateRecord(queue, id, {
    status: 'complete',
    payload: resolvedValue,
    resolvedAt: now,
  });

  return {
    queue: {
      ...updatedQueue,
      totalPending: updatedQueue.records.filter(
        r => r.status === 'pending' || r.status === 'conflict',
      ).length,
    },
    report,
  };
}

// ─── Batch Processing ─────────────────────────────────────────────────────────

export function getNextBatch(queue: SyncQueue): SyncRecord[] {
  return queue.records
    .filter(r => r.status === 'pending')
    .slice(0, SYNC_BATCH_SIZE);
}

export function buildRetryQueue(queue: SyncQueue): SyncRecord[] {
  return queue.records.filter(
    r => r.status === 'pending' && r.retryCount > 0 && r.retryCount < r.maxRetries,
  );
}

export function getFailedRecords(queue: SyncQueue): SyncRecord[] {
  return queue.records.filter(r => r.status === 'failed');
}

export function resetFailedRecord(queue: SyncQueue, id: string): SyncQueue {
  const record = queue.records.find(r => r.id === id);
  if (!record || record.status !== 'failed') return queue;
  return updateRecord(queue, id, {
    status: 'pending',
    retryCount: 0,
    errorMessage: null,
  });
}

export function resetAllFailed(queue: SyncQueue): SyncQueue {
  const records = queue.records.map(r =>
    r.status === 'failed'
      ? { ...r, status: 'pending' as SyncState, retryCount: 0, errorMessage: null }
      : r,
  );
  return {
    ...queue,
    records,
    totalPending: records.filter(r => r.status === 'pending' || r.status === 'conflict').length,
  };
}

// ─── Summaries ────────────────────────────────────────────────────────────────

export function getSyncSummary(queue: SyncQueue): {
  pending: number;
  syncing: number;
  complete: number;
  failed: number;
  conflict: number;
  total: number;
} {
  const counts = { pending: 0, syncing: 0, complete: 0, failed: 0, conflict: 0 };
  for (const r of queue.records) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++;
  }
  return { ...counts, total: queue.records.length };
}

export function getCategoryBreakdown(
  queue: SyncQueue,
): Record<SyncCategory, number> {
  const result = {} as Record<SyncCategory, number>;
  for (const r of queue.records) {
    if (r.status === 'pending' || r.status === 'conflict') {
      result[r.category] = (result[r.category] ?? 0) + 1;
    }
  }
  return result;
}

export function hasPendingSync(queue: SyncQueue): boolean {
  return queue.totalPending > 0;
}

export function isQueueEmpty(queue: SyncQueue): boolean {
  return queue.records.length === 0;
}

export function getSyncStatusLabel(state: SyncState): string {
  switch (state) {
    case 'idle':     return 'Idle';
    case 'pending':  return 'Pending';
    case 'syncing':  return 'Syncing…';
    case 'complete': return 'Synced';
    case 'failed':   return 'Failed';
    case 'conflict': return 'Conflict';
  }
}

export function getCategoryLabel(category: SyncCategory): string {
  switch (category) {
    case 'navigation-history': return 'Navigation history';
    case 'memories':           return 'Memories';
    case 'preferences':        return 'Preferences';
    case 'permissions':        return 'Permissions';
    case 'analytics':          return 'Analytics';
    case 'language-prefs':     return 'Language preferences';
    case 'accessibility-prefs':return 'Accessibility preferences';
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function updateRecord(
  queue: SyncQueue,
  id: string,
  patch: Partial<SyncRecord>,
): SyncQueue {
  return {
    ...queue,
    records: queue.records.map(r => (r.id === id ? { ...r, ...patch } : r)),
  };
}

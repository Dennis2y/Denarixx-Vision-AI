'use client';

import { useState, useCallback } from 'react';
import {
  createSyncQueue,
  addToQueue,
  getSyncSummary,
  getNextBatch,
  markRecordSyncing,
  markRecordComplete,
  markRecordFailed,
  markRecordConflict,
  resolveConflict,
  clearCompleted,
  resetAllFailed,
  hasPendingSync,
  isQueueEmpty,
  getSyncStatusLabel,
  getCategoryLabel,
  getCategoryBreakdown,
  buildRetryQueue,
  getFailedRecords,
} from '@/engines/offlineSyncEngine';
import type { SyncQueue, SyncCategory, ConflictStrategy } from '@/types/offline';
import { SYNC_PRIVACY_NOTE } from '@/types/offline';

const CATEGORIES: SyncCategory[] = [
  'navigation-history',
  'memories',
  'preferences',
  'permissions',
  'analytics',
  'language-prefs',
  'accessibility-prefs',
];

const STATUS_COLOR: Record<string, string> = {
  idle:     'bg-gray-700/40 text-gray-400',
  pending:  'bg-blue-700/40 text-blue-300',
  syncing:  'bg-indigo-700/40 text-indigo-300',
  complete: 'bg-green-700/40 text-green-300',
  failed:   'bg-red-700/40 text-red-300',
  conflict: 'bg-yellow-700/40 text-yellow-300',
};

export default function SyncPage() {
  const [queue, setQueue] = useState<SyncQueue>(() => {
    let q = createSyncQueue();
    q = addToQueue(q, 'navigation-history', Date.now() - 300_000, 'route-home-cache');
    q = addToQueue(q, 'memories', Date.now() - 600_000, 'memory-5-items');
    q = addToQueue(q, 'preferences', Date.now() - 60_000, 'lang=en,voice=en-gb');
    return q;
  });
  const [selectedCategory, setSelectedCategory] = useState<SyncCategory>('navigation-history');
  const [strategy, setStrategy] = useState<ConflictStrategy>('latest-wins');
  const [syncLog, setSyncLog] = useState<string[]>([]);

  const log = (msg: string) => setSyncLog(l => [`${new Date().toLocaleTimeString()}: ${msg}`, ...l.slice(0, 19)]);

  const handleAddRecord = useCallback(() => {
    const payload = `${selectedCategory}-data-${Date.now()}`;
    setQueue(q => addToQueue(q, selectedCategory, Date.now(), payload, strategy));
    log(`Added ${getCategoryLabel(selectedCategory)} record`);
  }, [selectedCategory, strategy]);

  const handleSyncAll = useCallback(() => {
    const batch = getNextBatch(queue);
    if (batch.length === 0) { log('Nothing to sync'); return; }
    log(`Starting sync of ${batch.length} records`);
    let q = queue;
    for (const rec of batch) {
      q = markRecordSyncing(q, rec.id, Date.now());
    }
    setQueue(q);
    setTimeout(() => {
      setQueue(prev => {
        let next = prev;
        for (const rec of batch) {
          if (Math.random() > 0.2) {
            next = markRecordComplete(next, rec.id, Date.now(), Date.now());
          } else {
            next = markRecordFailed(next, rec.id, 'Simulated network error');
          }
        }
        return next;
      });
      log('Sync batch complete');
    }, 1500);
  }, [queue]);

  const handleSimulateConflict = useCallback(() => {
    const pending = queue.records.find(r => r.status === 'pending');
    if (!pending) { log('No pending records to conflict'); return; }
    setQueue(q => markRecordConflict(q, pending.id, Date.now() + 5000));
    log(`Conflict injected for ${getCategoryLabel(pending.category)}`);
  }, [queue]);

  const handleResolveConflict = useCallback(() => {
    const conflicted = queue.records.find(r => r.status === 'conflict');
    if (!conflicted) { log('No conflicts to resolve'); return; }
    const { queue: next, report } = resolveConflict(queue, conflicted.id, 'remote-value', Date.now());
    setQueue(next);
    if (report) log(`Resolved conflict: ${report.resolution}`);
  }, [queue]);

  const handleClearCompleted = useCallback(() => {
    const before = queue.records.filter(r => r.status === 'complete').length;
    setQueue(clearCompleted(queue));
    log(`Cleared ${before} completed records`);
  }, [queue]);

  const handleResetFailed = useCallback(() => {
    setQueue(resetAllFailed(queue));
    log('Reset all failed records to pending');
  }, [queue]);

  const summary = getSyncSummary(queue);
  const breakdown = getCategoryBreakdown(queue);
  const failed = getFailedRecords(queue);
  const retry = buildRetryQueue(queue);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Synchronization</h1>
          <p className="text-gray-400 text-sm">
            Manage offline data sync queue, conflict resolution, and retry logic.
          </p>
        </div>

        {/* Privacy note */}
        <div className="mb-4 rounded-lg border border-blue-700/30 bg-blue-900/10 p-3 text-xs text-blue-300">
          {SYNC_PRIVACY_NOTE}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {(['pending', 'syncing', 'complete', 'failed', 'conflict', 'total'] as const).map(k => (
            <div key={k} className="rounded-lg border border-gray-700/50 bg-gray-800/40 p-2 text-center">
              <div className="text-xs text-gray-400 capitalize mb-1">{k}</div>
              <div className="text-lg font-bold">{summary[k]}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3">Add to Queue</h2>
          <div className="flex gap-3 flex-wrap mb-3">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value as SyncCategory)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{getCategoryLabel(c)}</option>
              ))}
            </select>
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value as ConflictStrategy)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            >
              {(['latest-wins', 'local-wins', 'remote-wins', 'merge'] as ConflictStrategy[]).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button onClick={handleAddRecord} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium">
              Add record
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleSyncAll} disabled={!hasPendingSync(queue)} className="px-3 py-1.5 rounded-lg bg-green-700/60 hover:bg-green-600/60 disabled:opacity-40 text-xs font-medium">
              Sync all pending
            </button>
            <button onClick={handleSimulateConflict} className="px-3 py-1.5 rounded-lg bg-yellow-800/60 hover:bg-yellow-700/60 text-xs font-medium">
              Simulate conflict
            </button>
            <button onClick={handleResolveConflict} className="px-3 py-1.5 rounded-lg bg-blue-800/60 hover:bg-blue-700/60 text-xs font-medium">
              Resolve conflict
            </button>
            <button onClick={handleClearCompleted} disabled={summary.complete === 0} className="px-3 py-1.5 rounded-lg bg-gray-700/60 hover:bg-gray-600/60 disabled:opacity-40 text-xs">
              Clear completed
            </button>
            {failed.length > 0 && (
              <button onClick={handleResetFailed} className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-800/40 text-xs text-red-300">
                Retry failed ({failed.length})
              </button>
            )}
          </div>
        </div>

        {/* Queue Records */}
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4 mb-4">
          <h2 className="text-sm font-semibold mb-3">Queue ({queue.records.length} records)</h2>
          {isQueueEmpty(queue) ? (
            <p className="text-sm text-gray-400">Queue is empty. All data synced.</p>
          ) : (
            <div className="space-y-2">
              {queue.records.map(rec => (
                <div key={rec.id} className="flex items-center justify-between rounded-lg border border-gray-700/40 bg-gray-900/40 px-3 py-2">
                  <div>
                    <div className="text-xs font-medium">{getCategoryLabel(rec.category)}</div>
                    <div className="text-xs text-gray-500 font-mono">{rec.payload.slice(0, 30)}</div>
                    {rec.errorMessage && <div className="text-xs text-red-400 mt-0.5">{rec.errorMessage}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {rec.retryCount > 0 && <span className="text-xs text-gray-500">retry {rec.retryCount}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[rec.status]}`}>
                      {getSyncStatusLabel(rec.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        {Object.keys(breakdown).length > 0 && (
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4 mb-4">
            <h2 className="text-sm font-semibold mb-3">Pending by Category</h2>
            <div className="space-y-1">
              {(Object.entries(breakdown) as [SyncCategory, number][]).map(([cat, count]) => (
                <div key={cat} className="flex justify-between text-sm">
                  <span className="text-gray-400">{getCategoryLabel(cat)}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Log */}
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
          <h2 className="text-sm font-semibold mb-3">Activity Log</h2>
          {syncLog.length === 0 ? (
            <p className="text-xs text-gray-500">No activity yet.</p>
          ) : (
            <ul className="space-y-1">
              {syncLog.map((entry, i) => (
                <li key={i} className="text-xs text-gray-400 font-mono">{entry}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

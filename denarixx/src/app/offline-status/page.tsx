'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  createNetworkReading,
  goOnline,
  goOffline,
  goWeak,
  goReconnecting,
  markSynced,
  isOnline,
  isOffline,
  getStatusLabel,
  getQualityLabel,
  getStatusColor,
  getQualityColor,
  formatBandwidth,
  formatLatency,
  getOfflineDurationHuman,
  buildNetworkDiagnostic,
  shouldThrottleRequests,
  shouldAttemptReconnect,
} from '@/engines/networkMonitorEngine';
import {
  createOfflineState,
  buildOfflineSummary,
  getOfflineStatusDescription,
  getOfflineBannerText,
  getGuardianFallbackMessage,
  getMemoryFallbackSummary,
  getNavigationFallbackGuidance,
  validateOfflineReadiness,
  listAvailableFeatures,
  listDegradedFeatures,
  buildCapabilityTable,
  countReadyModels,
} from '@/engines/offlineEngine';
import { createSyncQueue, getSyncSummary, hasPendingSync } from '@/engines/offlineSyncEngine';
import { createEdgeModelRegistry, getReadyModels, formatModelSize, getTotalModelSizeKb } from '@/engines/offlineEdgeEngine';
import type { OfflineState, NetworkStatus } from '@/types/offline';
import {
  OFFLINE_SAFETY_NOTE,
  OFFLINE_GUARDIAN_NOTE,
  SYNC_PRIVACY_NOTE,
} from '@/types/offline';

type Tab = 'status' | 'features' | 'guardian' | 'privacy';

export default function OfflineStatusPage() {
  const [state, setState] = useState<OfflineState>(() => createOfflineState());
  const [activeTab, setActiveTab] = useState<Tab>('status');
  const [tick, setTick] = useState(0);
  const now = Date.now();

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3_000);
    return () => clearInterval(id);
  }, []);

  const simulateStatus = useCallback((status: NetworkStatus) => {
    setState(s => {
      const n = s.network;
      let newNetwork = n;
      switch (status) {
        case 'online':       newNetwork = goOnline(n, Date.now()); break;
        case 'offline':      newNetwork = goOffline(n, Date.now()); break;
        case 'weak':         newNetwork = goWeak(n, 300, 700); break;
        case 'reconnecting': newNetwork = goReconnecting(n); break;
        case 'sync-pending': newNetwork = { ...n, status: 'sync-pending' }; break;
      }
      return { ...s, network: newNetwork };
    });
  }, []);

  const handleSync = useCallback(() => {
    setState(s => ({
      ...s,
      network: markSynced(s.network, Date.now()),
      syncQueue: { ...s.syncQueue, totalPending: 0, records: [] },
    }));
  }, []);

  const summary = buildOfflineSummary(state);
  const diag = buildNetworkDiagnostic(state.network);
  const readiness = validateOfflineReadiness(state);
  const available = listAvailableFeatures(state);
  const degraded = listDegradedFeatures(state);
  const syncSummary = getSyncSummary(state.syncQueue);
  const bannerText = getOfflineBannerText(state);
  const statusColor = getStatusColor(state.network.status);
  const qualityColor = getQualityColor(state.network.quality);

  const colorCls = (c: string) => {
    const map: Record<string, string> = {
      green: 'text-green-400', yellow: 'text-yellow-400',
      red: 'text-red-400', orange: 'text-orange-400',
      blue: 'text-blue-400', gray: 'text-gray-400',
    };
    return map[c] ?? 'text-gray-400';
  };

  const bgColorCls = (c: string) => {
    const map: Record<string, string> = {
      green: 'bg-green-500/20 border-green-500/40',
      yellow: 'bg-yellow-500/20 border-yellow-500/40',
      red: 'bg-red-500/20 border-red-500/40',
      orange: 'bg-orange-500/20 border-orange-500/40',
      blue: 'bg-blue-500/20 border-blue-500/40',
    };
    return map[c] ?? 'bg-gray-700/40 border-gray-600/40';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Offline Status</h1>
          <p className="text-gray-400 text-sm">
            Network monitor, edge AI status, and offline capability overview.
          </p>
        </div>

        {/* Offline Banner */}
        {bannerText && (
          <div className={`mb-4 rounded-lg border p-3 text-sm font-medium ${bgColorCls(statusColor)}`}>
            {bannerText}
          </div>
        )}

        {/* Network Status Card */}
        <div className={`rounded-xl border p-5 mb-4 ${bgColorCls(statusColor)}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className={`text-2xl font-bold ${colorCls(statusColor)}`}>
                {getStatusLabel(state.network.status)}
              </div>
              <div className={`text-sm ${colorCls(qualityColor)}`}>
                Quality: {getQualityLabel(state.network.quality)}
              </div>
            </div>
            <div className="text-right text-sm text-gray-400">
              <div>{diag.bandwidth}</div>
              <div>{diag.latency} latency</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {(['online', 'weak', 'offline', 'reconnecting'] as NetworkStatus[]).map(s => (
              <button
                key={s}
                onClick={() => simulateStatus(s)}
                className="px-3 py-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-xs font-medium transition-colors"
              >
                Simulate {getStatusLabel(s)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Last sync</span>
              <div className="font-medium">{diag.lastSync}</div>
            </div>
            <div>
              <span className="text-gray-400">Offline for</span>
              <div className="font-medium">{diag.offlineDuration}</div>
            </div>
            <div>
              <span className="text-gray-400">Reconnect attempts</span>
              <div className="font-medium">{diag.reconnectAttempts}</div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Edge Models', value: `${summary.modelsReady}/${summary.modelsTotal}`, sub: 'ready' },
            { label: 'Features Online', value: `${summary.offlineFeaturesAvailable}/10`, sub: 'available offline' },
            { label: 'Sync Queue', value: summary.pendingSyncItems.toString(), sub: 'pending items' },
            { label: 'Guardian', value: summary.guardianReady ? 'Ready' : 'Limited', sub: 'offline mode' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-gray-700/50 bg-gray-800/40 p-3">
              <div className="text-xs text-gray-400 mb-1">{s.label}</div>
              <div className="text-lg font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-500">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['status', 'features', 'guardian', 'privacy'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800/60 text-gray-400 hover:text-white'
              }`}
            >
              {t === 'status' ? 'Diagnostics' : t === 'guardian' ? 'Guardian' : t === 'features' ? 'Features' : 'Privacy'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-3">Network Diagnostics</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(diag).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-3">Offline Readiness</h2>
              <div className={`flex items-center gap-2 mb-3 text-sm font-medium ${readiness.ready ? 'text-green-400' : 'text-yellow-400'}`}>
                {readiness.ready ? '✓ Ready for offline use' : '⚠ Some issues found'}
              </div>
              {readiness.issues.length === 0
                ? <p className="text-sm text-gray-400">All systems ready for offline operation.</p>
                : <ul className="space-y-1">
                    {readiness.issues.map(i => (
                      <li key={i} className="text-sm text-yellow-300 flex items-start gap-2">
                        <span>⚠</span><span>{i}</span>
                      </li>
                    ))}
                  </ul>
              }
            </div>

            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-3">Status Description</h2>
              <p className="text-sm text-gray-300">{getOfflineStatusDescription(state)}</p>
              {shouldThrottleRequests(state.network) && (
                <p className="text-sm text-yellow-400 mt-2">⚠ Requests are being throttled due to weak connection.</p>
              )}
              {shouldAttemptReconnect(state.network) && (
                <p className="text-sm text-blue-400 mt-2">↺ Reconnection attempts available.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              {available.length} of 10 features available offline.
              {degraded.length > 0 && ` ${degraded.length} operating in degraded mode.`}
            </p>
            {(Object.entries(state.capabilities) as [string, typeof state.capabilities[keyof typeof state.capabilities]][]).map(([key, cap]) => {
              const isAvail = available.includes(cap.feature);
              const isDeg = degraded.includes(cap.feature);
              return (
                <div key={key} className={`rounded-lg border p-3 ${isAvail ? (isDeg ? 'border-yellow-600/40 bg-yellow-900/10' : 'border-green-600/40 bg-green-900/10') : 'border-gray-700/40 bg-gray-800/20'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{cap.feature.replace(/-/g, ' ')}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isAvail ? (isDeg ? 'bg-yellow-700/40 text-yellow-300' : 'bg-green-700/40 text-green-300') : 'bg-gray-700/40 text-gray-400'}`}>
                      {isAvail ? (isDeg ? 'Degraded' : 'Full') : 'Unavailable'}
                    </span>
                  </div>
                  {cap.degraded && isDeg && (
                    <p className="text-xs text-gray-400">{cap.degradedMessage}</p>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    Quality: {cap.qualityWhenOffline}
                    {cap.requiresModel && ` · Requires ${cap.requiresModel} model`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'guardian' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-2">Guardian Offline Mode</h2>
              <p className="text-sm text-gray-300 mb-3">{getGuardianFallbackMessage(state)}</p>
              <div className="rounded-lg border border-blue-600/30 bg-blue-900/10 p-3 text-sm text-blue-300">
                {OFFLINE_GUARDIAN_NOTE}
              </div>
            </div>
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-2">Memory Offline</h2>
              <p className="text-sm text-gray-300">{getMemoryFallbackSummary(state)}</p>
            </div>
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-2">Navigation Offline</h2>
              <p className="text-sm text-gray-300">{getNavigationFallbackGuidance(state)}</p>
            </div>
            <div className="rounded-lg border border-amber-600/30 bg-amber-900/10 p-3 text-sm text-amber-300">
              {OFFLINE_SAFETY_NOTE}
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-3">Sync Privacy</h2>
              <p className="text-sm text-gray-300 mb-4">{SYNC_PRIVACY_NOTE}</p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Camera frames and audio are never stored or synced</li>
                <li>• All sync data is anonymised before transmission</li>
                <li>• Navigation history is summarised, not raw GPS tracks</li>
                <li>• You can delete all pending sync data from the Sync page</li>
                <li>• Edge models run entirely on-device — no cloud calls</li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-3">Sync Queue</h2>
              <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                {Object.entries(syncSummary).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-gray-400 capitalize block">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleSync}
                disabled={!isOnline(state.network)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-sm font-medium transition-colors"
              >
                Sync now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

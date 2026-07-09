'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  createStreetSafetyState,
  processStreetSafetyTick,
  buildStreetSafetySummary,
  getStreetSafetModeLabel,
  getStreetSafetyModeColor,
} from '@/engines/streetSafetyEngine';
import {
  OFFLINE_MODE_ANNOUNCEMENT,
  ONLINE_RESTORED_ANNOUNCEMENT,
  CROSSING_SAFETY_MESSAGE,
  GLASSES_PRIMARY_NOTE,
} from '@/types/streetSafety';
import type { StreetSafetyState, HazardAlert, StreetHazardType, HazardDirection } from '@/types/streetSafety';
import type { NetworkReading } from '@/types/offline';

const ONLINE_NET: NetworkReading = {
  status: 'online', quality: 'excellent', bandwidthEstimateKbps: 10000,
  latencyMs: 20, reconnectAttempts: 0, lastSyncAt: null, lastOnlineAt: 1, offlineDurationMs: 0,
};
const OFFLINE_NET: NetworkReading = {
  status: 'offline', quality: 'none', bandwidthEstimateKbps: 0,
  latencyMs: 0, reconnectAttempts: 3, lastSyncAt: null, lastOnlineAt: 0, offlineDurationMs: 5000,
};
const WEAK_NET: NetworkReading = {
  status: 'weak', quality: 'poor', bandwidthEstimateKbps: 100,
  latencyMs: 800, reconnectAttempts: 1, lastSyncAt: null, lastOnlineAt: 1, offlineDurationMs: 1000,
};

type SimNetwork = 'online' | 'offline' | 'weak';

const HAZARD_SCENARIOS: Array<{ type: StreetHazardType; direction: HazardDirection; confidence: number; label: string }> = [
  { type: 'vehicle', direction: 'ahead', confidence: 0.9, label: 'Vehicle ahead' },
  { type: 'stairs', direction: 'ahead', confidence: 0.85, label: 'Stairs ahead' },
  { type: 'obstacle', direction: 'left', confidence: 0.75, label: 'Obstacle left' },
  { type: 'crossing', direction: 'ahead', confidence: 0.8, label: 'Crossing ahead' },
  { type: 'person-approaching', direction: 'right', confidence: 0.65, label: 'Person approaching' },
  { type: 'bicycle-scooter', direction: 'ahead', confidence: 0.7, label: 'Bicycle/scooter' },
  { type: 'stop', direction: 'ahead', confidence: 0.95, label: 'STOP' },
  { type: 'move-left', direction: 'left', confidence: 0.6, label: 'Move left' },
];

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-900/30 border-red-600/40 text-red-300',
  high: 'bg-orange-900/20 border-orange-600/40 text-orange-300',
  medium: 'bg-yellow-900/20 border-yellow-600/40 text-yellow-300',
  low: 'bg-gray-800/30 border-gray-600/40 text-gray-300',
};

const MODE_COLOR: Record<string, string> = {
  green: 'bg-green-900/20 border-green-600/40 text-green-300',
  yellow: 'bg-yellow-900/20 border-yellow-600/40 text-yellow-300',
  red: 'bg-red-900/30 border-red-600/40 text-red-300',
};

export default function StreetSafetyPage() {
  const [state, setState] = useState<StreetSafetyState>(createStreetSafetyState);
  const [simNetwork, setSimNetwork] = useState<SimNetwork>('online');
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [recentAlertLog, setRecentAlertLog] = useState<HazardAlert[]>([]);
  const [cameraHealthy, setCameraHealthy] = useState(true);
  const [pendingHazards, setPendingHazards] = useState<typeof HAZARD_SCENARIOS>([]);

  const getNetwork = (sim: SimNetwork): NetworkReading => {
    if (sim === 'offline') return OFFLINE_NET;
    if (sim === 'weak') return WEAK_NET;
    return ONLINE_NET;
  };

  const tick = useCallback(() => {
    setState(prev => {
      const { state: next, announcements: ann, alertsSpoken } = processStreetSafetyTick(prev, {
        network: getNetwork(simNetwork),
        detectedHazardTypes: pendingHazards.map(h => ({ type: h.type, direction: h.direction, confidence: h.confidence })),
        isCameraHealthy: cameraHealthy,
      });
      if (ann.length > 0) setAnnouncements(a => [...ann, ...a].slice(0, 5));
      if (alertsSpoken.length > 0) setRecentAlertLog(a => [...alertsSpoken, ...a].slice(0, 20));
      setPendingHazards([]);
      return next;
    });
  }, [simNetwork, cameraHealthy, pendingHazards]);

  useEffect(() => {
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [tick]);

  const summary = buildStreetSafetySummary(state);
  const modeLabel = getStreetSafetModeLabel(state);
  const modeColor = getStreetSafetyModeColor(state);

  function triggerHazard(h: typeof HAZARD_SCENARIOS[0]) {
    setPendingHazards(p => [...p, h]);
  }

  const tabs = ['status', 'hazards', 'alerts', 'safety-rules'] as const;
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('status');

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">No-Internet Street Safety Mode</h1>
          <p className="text-gray-400 text-sm">
            Sprint 15 — Offline street safety on Denarixx Vision Glasses.
            Glasses edge AI is primary. Phone and cloud are optional.
          </p>
        </div>

        {/* Mode Indicator */}
        <div className={`mb-4 rounded-xl border p-4 ${MODE_COLOR[modeColor]}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base">{modeLabel}</div>
              <div className="text-xs mt-0.5 opacity-80">
                {state.mode === 'offline'
                  ? 'Guardian active on glasses compute module — no internet required.'
                  : state.mode === 'degraded'
                  ? 'Weak connection. Glasses edge AI is primary guardian.'
                  : 'Cloud enhancement available. Glasses edge AI remains primary.'}
              </div>
            </div>
            <div className={`text-2xl font-mono ${modeColor === 'green' ? 'text-green-400' : modeColor === 'yellow' ? 'text-yellow-400' : 'text-red-400'}`}>
              {modeColor === 'green' ? '●' : modeColor === 'yellow' ? '◐' : '○'}
            </div>
          </div>
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="mb-4 space-y-2">
            {announcements.map((a, i) => (
              <div key={i} className="rounded-lg border border-blue-600/40 bg-blue-900/20 p-3 text-sm text-blue-200 font-medium">
                🔊 {a}
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Active Hazards', value: summary.activeHazardCount.toString(), warn: summary.activeHazardCount > 0 },
            { label: 'Critical', value: summary.criticalHazardCount.toString(), warn: summary.criticalHazardCount > 0 },
            { label: 'Alerts (session)', value: recentAlertLog.length.toString(), warn: false },
            { label: 'Offline Duration', value: `${Math.round(summary.offlineDurationSeconds)}s`, warn: summary.isOffline },
          ].map(s => (
            <div key={s.label} className={`rounded-lg border p-3 ${s.warn ? 'border-red-600/40 bg-red-900/10' : 'border-gray-700/50 bg-gray-800/40'}`}>
              <div className="text-xs text-gray-400 mb-1">{s.label}</div>
              <div className={`text-lg font-bold ${s.warn ? 'text-red-300' : 'text-white'}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Simulate — Glasses Dashboard</h2>

          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Network / Connectivity</p>
            <div className="flex gap-2">
              {(['online', 'weak', 'offline'] as SimNetwork[]).map(n => (
                <button
                  key={n}
                  onClick={() => setSimNetwork(n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    simNetwork === n
                      ? n === 'online' ? 'bg-green-700/40 border-green-500 text-green-200'
                        : n === 'weak' ? 'bg-yellow-700/40 border-yellow-500 text-yellow-200'
                        : 'bg-red-700/40 border-red-500 text-red-200'
                      : 'border-gray-600 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  {n.charAt(0).toUpperCase() + n.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Glasses Camera</p>
            <button
              onClick={() => setCameraHealthy(h => !h)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                cameraHealthy
                  ? 'bg-green-700/40 border-green-500 text-green-200'
                  : 'bg-red-700/40 border-red-500 text-red-200'
              }`}
            >
              {cameraHealthy ? 'Camera Healthy' : 'Camera Failed'}
            </button>
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-2">Inject Hazard (next tick)</p>
            <div className="flex flex-wrap gap-2">
              {HAZARD_SCENARIOS.map(h => (
                <button
                  key={h.label}
                  onClick={() => triggerHazard(h)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-600 text-gray-300 hover:border-orange-500 hover:text-orange-300 transition-colors ${
                    pendingHazards.some(p => p.type === h.type) ? 'border-orange-500 text-orange-300 bg-orange-900/20' : ''
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-800/40 rounded-lg p-1">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                activeTab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.replace(/-/g, ' ')}
            </button>
          ))}
        </div>

        {activeTab === 'status' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-3">Glasses Guardian Status</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { k: 'Guardian', v: state.guardianActive ? 'Active' : 'Paused' },
                  { k: 'Primary Device', v: 'Denarixx Vision Glasses' },
                  { k: 'Inference', v: state.mode === 'online' ? 'Glasses + Cloud' : 'Glasses Edge AI' },
                  { k: 'Camera', v: state.cameraHealthy ? 'Healthy' : '⚠ Failed' },
                  { k: 'Session Tick', v: state.sessionTick.toString() },
                  { k: 'Total Spoken', v: state.totalAlertsSpoken.toString() },
                ].map(({ k, v }) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-400">{k}</span>
                    <span className="text-gray-200 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {summary.topHazard && (
              <div className={`rounded-xl border p-4 ${SEVERITY_COLOR[summary.topHazard.severity]}`}>
                <div className="font-semibold text-sm mb-1">Top Hazard</div>
                <div className="text-xs">
                  {summary.topHazard.hazardType.replace(/-/g, ' ')} — {summary.topHazard.direction} —
                  severity: {summary.topHazard.severity} — confidence: {(summary.topHazard.confidence * 100).toFixed(0)}%
                </div>
              </div>
            )}
            <div className="rounded-xl border border-blue-700/30 bg-blue-900/10 p-4 text-xs text-blue-300">
              {GLASSES_PRIMARY_NOTE}
            </div>
          </div>
        )}

        {activeTab === 'hazards' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              {summary.activeHazardCount > 0
                ? `${summary.activeHazardCount} active hazard${summary.activeHazardCount > 1 ? 's' : ''} detected by glasses cameras.`
                : 'No active hazards. Glasses cameras scanning.'}
            </p>
            {state.activeHazards.length === 0 && (
              <div className="rounded-xl border border-gray-700/50 bg-gray-800/20 p-8 text-center text-sm text-gray-500">
                No hazards detected. Use the simulator above to inject hazards.
              </div>
            )}
            {state.activeHazards.map((h, i) => (
              <div key={i} className={`rounded-lg border p-3 ${SEVERITY_COLOR[h.severity]}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm capitalize">{h.hazardType.replace(/-/g, ' ')}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800/40 capitalize">{h.severity}</span>
                </div>
                <div className="text-xs opacity-80">
                  Direction: {h.direction} · Confidence: {(h.confidence * 100).toFixed(0)}% ·
                  Detections: {h.detectionCount} · {h.isCriticalBypass ? '⚡ Critical bypass' : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 mb-3">
              Last {recentAlertLog.length} spoken via bone-conduction speaker on glasses.
            </p>
            {recentAlertLog.length === 0 && (
              <div className="rounded-xl border border-gray-700/50 bg-gray-800/20 p-8 text-center text-sm text-gray-500">
                No alerts spoken yet. Inject a hazard to trigger the Guardian.
              </div>
            )}
            {recentAlertLog.map((a, i) => (
              <div key={i} className={`rounded-lg border p-3 ${SEVERITY_COLOR[a.severity]}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono opacity-60">tick {a.tick}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800/40">{a.severity}</span>
                </div>
                <div className="text-sm font-medium mb-1">🔊 {a.spokenMessage}</div>
                <div className="text-xs opacity-70">
                  {a.hazardType} · {a.direction} · {(a.confidence * 100).toFixed(0)}% confidence ·
                  {a.isOffline ? ' offline edge AI' : ' cloud-enhanced'}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'safety-rules' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-3">Safety Rules — Hardcoded on Glasses</h2>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold mt-0.5">✗</span>
                  <span>Never say &quot;safe to cross.&quot; Always say: <em className="text-yellow-300">&quot;{CROSSING_SAFETY_MESSAGE}&quot;</em></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 font-bold mt-0.5">✓</span>
                  <span>Critical alerts (vehicle, stairs, stop, camera failure) are never blocked by throttle or connectivity.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 font-bold mt-0.5">✓</span>
                  <span>If the glasses camera fails, immediately announce: <em className="text-yellow-300">&quot;Warning: Glasses camera is not available. Please stop...&quot;</em></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 font-bold mt-0.5">✓</span>
                  <span>Guardian never waits for internet. Edge AI on glasses compute module is always primary.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 font-bold mt-0.5">✓</span>
                  <span>When internet lost: announce <em className="text-yellow-300">&quot;Internet is unavailable. Offline street safety mode is active.&quot;</em></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 font-bold mt-0.5">✓</span>
                  <span>When internet returns: announce <em className="text-yellow-300">&quot;Online enhancement restored. Safety mode remains active.&quot;</em></span>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
              <h2 className="text-base font-semibold mb-3">Architecture Priority</h2>
              <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
                <li>Smart glasses compute module — primary AI inference, always active</li>
                <li>Glasses cameras — primary visual input (front + side)</li>
                <li>Bone-conduction speaker — primary audio output</li>
                <li>Phone companion — setup, dashboard, and fallback only</li>
                <li>Cloud AI — optional scene enhancement, never a safety dependency</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

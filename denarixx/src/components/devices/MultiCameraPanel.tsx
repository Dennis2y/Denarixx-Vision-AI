'use client';

import { useState, useEffect, useRef } from 'react';
import {
  createGlassesState,
  simulateFeedTick,
  simulateBatteryDrain,
  connectCamera,
  disconnectCamera,
  formatCameraPosition,
  formatConnectionHealth,
  computeConnectionHealth,
} from '@/engines/glassesCameraEngine';
import {
  buildFallbackGuidance,
  getCamerasBatteryWarning,
  computeOverallHealthScore,
  shouldFallbackToPhone,
  applyPhoneFallback,
} from '@/engines/cameraHealthEngine';
import {
  buildFusedFrame,
  getSimulatedDetectionSet,
  buildMultiCameraStatusText,
} from '@/engines/multiCameraFusionEngine';
import {
  createSimulatedSensorFrame,
  classifyMotionState,
  getMotionLabel,
  assessThermalState,
  formatBatteryLevel,
} from '@/engines/wearableSensorFusionEngine';
import {
  formatFovZone,
} from '@/engines/fieldOfViewEngine';
import type { GlassesState, GlassesCameraPosition, FusedFrame } from '@/types/glasses';

// ─── Health status badge ──────────────────────────────────────────────────────
function HealthBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:   'bg-green-900/60 text-green-300',
    degraded: 'bg-yellow-900/60 text-yellow-300',
    failed:   'bg-red-900/60 text-red-300',
    offline:  'bg-gray-800 text-gray-500',
    standby:  'bg-blue-900/40 text-blue-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-gray-700 text-gray-400'}`}>
      {status}
    </span>
  );
}

// ─── Latency bar ─────────────────────────────────────────────────────────────
function LatencyBar({ ms }: { ms: number }) {
  const color = ms < 50 ? 'bg-green-500' : ms < 100 ? 'bg-yellow-500' : 'bg-red-500';
  const pct = Math.min(100, (ms / 200) * 100);
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono w-12 text-right">{ms}ms</span>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function MultiCameraPanel() {
  const [glassesState, setGlassesState] = useState<GlassesState>(() => createGlassesState());
  const [fusedFrame, setFusedFrame] = useState<FusedFrame | null>(null);
  const [running, setRunning] = useState(false);
  const [fallbackWarning, setFallbackWarning] = useState<string>('');

  const tickRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = () => {
    const t = tickRef.current++;

    setGlassesState((prev) => {
      // Simulate feed ticks
      let next = {
        ...prev,
        feeds: prev.feeds.map((f) => simulateFeedTick(f, t)),
      };
      // Simulate battery drain
      next = simulateBatteryDrain(next, 1);
      // Update connection health
      next = {
        ...next,
        connectionHealth: computeConnectionHealth(next.feeds),
      };
      // Fallback check
      if (shouldFallbackToPhone(next)) {
        next = applyPhoneFallback(next);
      }

      // Sensor frame
      const sensorFrame = createSimulatedSensorFrame(t);
      const _ = classifyMotionState(sensorFrame); // used for guidance enrichment

      // Fused frame
      const detSets = getSimulatedDetectionSet(t);
      const frame = buildFusedFrame(next, detSets);
      setFusedFrame(frame);

      // Fallback guidance
      const warning = buildFallbackGuidance(next);
      setFallbackWarning(warning);

      return next;
    });
  };

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 800);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const toggleCamera = (position: GlassesCameraPosition) => {
    setGlassesState((prev) => {
      const feed = prev.feeds.find((f) => f.position === position);
      return feed?.connected
        ? disconnectCamera(prev, position)
        : connectCamera(prev, position);
    });
  };

  const healthScore = computeOverallHealthScore(glassesState);
  const sensorFrame = createSimulatedSensorFrame(tickRef.current);
  const motionState = classifyMotionState(sensorFrame);
  const thermalState = assessThermalState(sensorFrame);
  const batteryWarning = getCamerasBatteryWarning(glassesState.batteryPct);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">🕶️ Multi-Camera System</h2>
          <p className="text-xs text-gray-500 mt-0.5">{glassesState.deviceName}</p>
        </div>
        <button
          onClick={() => setRunning((r) => !r)}
          className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
            running
              ? 'bg-red-800 hover:bg-red-700 text-white'
              : 'bg-yellow-400 hover:bg-yellow-300 text-black'
          }`}
        >
          {running ? '⏹ Stop' : '▶ Simulate'}
        </button>
      </div>

      {/* Privacy bar */}
      <div className="bg-green-950 border border-green-800/40 rounded-xl px-4 py-2 flex flex-wrap gap-3 text-xs text-green-400">
        <span>✓ no video storage</span>
        <span>✓ no face recognition</span>
        <span>✓ no bystander identification</span>
      </div>

      {/* Fallback warning */}
      {fallbackWarning && (
        <div className="bg-red-950 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-300 font-medium">
          ⚠ {fallbackWarning}
        </div>
      )}
      {batteryWarning && (
        <div className="bg-yellow-950 border border-yellow-700 rounded-xl px-4 py-2 text-xs text-yellow-300">
          🔋 {batteryWarning}
        </div>
      )}

      {/* Status overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ['Connection', formatConnectionHealth(glassesState.connectionHealth)],
          ['Active Source', String(glassesState.activeSource)],
          ['Battery', formatBatteryLevel(glassesState.batteryPct)],
          ['Health Score', `${Math.round(healthScore * 100)}%`],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm text-white font-mono mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Camera feeds */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Camera Feeds</h3>
        {glassesState.feeds.map((feed) => (
          <div
            key={feed.position}
            className={`bg-gray-800 rounded-xl p-4 border transition-colors ${
              feed.connected ? 'border-gray-600' : 'border-gray-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${feed.connected ? 'bg-green-400' : 'bg-gray-600'}`} />
                <span className="text-sm font-medium text-white">{formatCameraPosition(feed.position)}</span>
              </div>
              <div className="flex items-center gap-2">
                <HealthBadge status={feed.healthStatus} />
                <button
                  onClick={() => toggleCamera(feed.position)}
                  className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${
                    feed.connected
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-blue-900/40 hover:bg-blue-800/60 text-blue-300'
                  }`}
                >
                  {feed.connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
            {feed.connected && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Latency</span>
                  <span>Quality: {Math.round(feed.frameQuality * 100)}%</span>
                  <span>{feed.fps} fps</span>
                </div>
                <LatencyBar ms={feed.latencyMs} />
                {feed.errorMessage && (
                  <p className="text-xs text-red-400">{feed.errorMessage}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Wearable sensors */}
      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Wearable Sensors</h3>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            ['Motion', getMotionLabel(motionState)],
            ['Thermal', thermalState === 'normal' ? '🟢 Normal' : thermalState === 'warm' ? '🟡 Warm' : '🔴 Hot'],
            ['Sensor Battery', formatBatteryLevel(sensorFrame.batteryPct)],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-900 rounded-lg p-2 text-center">
              <p className="text-gray-600">{label}</p>
              <p className="text-white font-mono mt-1">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Fused frame */}
      {fusedFrame && fusedFrame.detections.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fused Detections</h3>
            <span className="text-xs text-gray-500">
              {buildMultiCameraStatusText(fusedFrame.fusedCameraCount, fusedFrame.hasPeripheralThreat)}
            </span>
          </div>
          {fusedFrame.guidanceText && (
            <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-xl px-3 py-2 text-sm text-yellow-200">
              🔊 {fusedFrame.guidanceText}
            </div>
          )}
          <div className="space-y-1">
            {fusedFrame.detections.slice(0, 5).map((det, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  det.priority === 'high' || det.priority === 'critical' ? 'bg-red-400' :
                  det.priority === 'medium' ? 'bg-yellow-400' : 'bg-gray-500'
                }`} />
                <span className="text-white flex-1">{det.label}</span>
                <span className="text-gray-500">{formatFovZone(det.fovZone)}</span>
                <span className="text-gray-500 font-mono">{det.cameraSource}</span>
                <span className="text-gray-600 font-mono">{Math.round(det.confidence * 100)}%</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {fusedFrame.fieldOfViewCoverage.map((zone) => (
              <span key={zone} className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">
                {formatFovZone(zone)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Simulated glasses preview */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Glasses View Simulation</h3>
        <svg viewBox="0 0 320 140" className="w-full h-28 bg-gray-900 rounded-xl" aria-hidden="true">
          {/* Glasses frame outline */}
          <ellipse cx="90" cy="70" rx="70" ry="45" fill="none" stroke="#374151" strokeWidth="3" />
          <ellipse cx="230" cy="70" rx="70" ry="45" fill="none" stroke="#374151" strokeWidth="3" />
          <line x1="160" y1="70" x2="160" y2="70" stroke="#374151" strokeWidth="3" />
          {/* Left lens content */}
          {glassesState.feeds.find(f => f.position === 'left')?.connected ? (
            <>
              <ellipse cx="90" cy="70" rx="68" ry="43" fill="#111827" />
              <text x="90" y="65" textAnchor="middle" fill="#6b7280" fontSize="8">LEFT</text>
              <text x="90" y="78" textAnchor="middle" fill="#4b5563" fontSize="7">Peripheral</text>
            </>
          ) : (
            <>
              <ellipse cx="90" cy="70" rx="68" ry="43" fill="#0f0f0f" />
              <text x="90" y="73" textAnchor="middle" fill="#374151" fontSize="8">offline</text>
            </>
          )}
          {/* Right lens content */}
          {glassesState.feeds.find(f => f.position === 'right')?.connected ? (
            <>
              <ellipse cx="230" cy="70" rx="68" ry="43" fill="#111827" />
              <text x="230" y="65" textAnchor="middle" fill="#6b7280" fontSize="8">RIGHT</text>
              <text x="230" y="78" textAnchor="middle" fill="#4b5563" fontSize="7">Peripheral</text>
            </>
          ) : (
            <>
              <ellipse cx="230" cy="70" rx="68" ry="43" fill="#0f0f0f" />
              <text x="230" y="73" textAnchor="middle" fill="#374151" fontSize="8">offline</text>
            </>
          )}
          {/* Front camera indicator */}
          {glassesState.feeds.find(f => f.position === 'front')?.connected && (
            <circle cx="160" cy="15" r="5" fill="#facc15" />
          )}
          {/* Detection dots in front view */}
          {fusedFrame?.detections.slice(0, 3).map((det, i) => {
            const lx = det.fovZone === 'left' ? 55 + i * 15 : det.fovZone === 'right' ? 195 + i * 15 : 140 + i * 15;
            const ly = 60 + i * 12;
            return (
              <circle key={i} cx={lx} cy={ly} r="4"
                fill={det.priority === 'high' ? '#ef4444' : det.priority === 'medium' ? '#f59e0b' : '#6b7280'}
                opacity={0.8}
              />
            );
          })}
        </svg>
        <p className="text-xs text-gray-600 mt-2 text-center">
          🟡 Front camera · 🔴 High · 🟡 Medium · ⚫ Low
        </p>
      </div>

      {/* Integration note */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-500">V14 — Multi-Camera Fusion</p>
        <p>Fused output connects to: Vision Inference · Spatial Reasoning · Cognitive Guardian · Navigation Intelligence · Audio Guidance</p>
        <p className="pt-1">All connections are simulated. Real hardware integration requires Bluetooth/WebRTC camera streams.</p>
      </div>
    </div>
  );
}

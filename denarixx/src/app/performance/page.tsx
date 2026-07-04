'use client';

import { useState, useEffect, useRef } from 'react';
import {
  buildSimulatedEdgeCapabilities,
  selectRuntime,
  buildCloudStatusLabel,
  isCloudAvailable,
  selectProcessingMode,
  initOfflineSafetyPath,
  buildDefaultConfig,
} from '@/engines/onDeviceAIEngine';
import {
  selectOptimalModel,
  getQuantizationLabel,
  getLatencyGrade,
  formatLatencyGrade,
  estimateMemoryFootprint,
} from '@/engines/modelOptimizationEngine';
import {
  formatRuntime,
  formatProcessingMode,
  runSimulatedEdgeFrame,
} from '@/engines/edgeInferenceEngine';
import {
  createLatencyBudget,
  buildSimulatedLatencyRecord,
  buildLatencyReport,
  formatBudget,
  isCriticalAlertOnTime,
} from '@/engines/latencyBudgetEngine';
import {
  classifyBatteryMode,
  getBatteryModeLabel,
  getBatteryOptimizationProfile,
  getRecommendedFPS,
  shouldPauseCloudReasoning,
  getBatteryModeWarning,
} from '@/engines/batteryOptimizationEngine';
import type {
  BatteryMode,
  OfflineStatus,
  ProcessingMode,
  LatencyRecord,
} from '@/types/onDeviceAI';
import { OFFLINE_SAFETY_MESSAGE } from '@/types/onDeviceAI';

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-mono font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Status row ───────────────────────────────────────────────────────────────
function StatusRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-800">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium ${highlight ? 'text-yellow-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const [batteryPct, setBatteryPct] = useState(75);
  const [isCharging, setIsCharging] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<OfflineStatus>('online');
  const [running, setRunning] = useState(false);
  const [latencyRecords, setLatencyRecords] = useState<LatencyRecord[]>([]);
  const [currentFPS, setCurrentFPS] = useState(0);
  const [currentInferenceMs, setCurrentInferenceMs] = useState(0);
  const [currentDetections, setCurrentDetections] = useState<string[]>([]);

  const tickRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const batteryMode: BatteryMode = classifyBatteryMode(batteryPct, isCharging);
  const caps = buildSimulatedEdgeCapabilities();
  const selectedRuntime = selectRuntime(caps, batteryMode);
  const config = buildDefaultConfig();
  const processingMode: ProcessingMode = selectProcessingMode(cloudStatus, config, false);
  const optimalModel = selectOptimalModel(selectedRuntime, batteryMode);
  const profile = getBatteryOptimizationProfile(batteryMode);
  const budget = createLatencyBudget();
  const offlinePath = initOfflineSafetyPath(cloudStatus);
  const report = buildLatencyReport(latencyRecords);
  const batteryWarning = getBatteryModeWarning(batteryMode);
  const cloudPaused = shouldPauseCloudReasoning(batteryMode, false);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        const t = tickRef.current++;
        const frame = runSimulatedEdgeFrame(selectedRuntime, batteryMode, t);
        const record = buildSimulatedLatencyRecord(budget, t, false);
        setCurrentFPS(frame.fps);
        setCurrentInferenceMs(frame.inferenceMs);
        setCurrentDetections(frame.detections);
        setLatencyRecords((prev) => [...prev.slice(-49), record]);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, batteryMode, cloudStatus, selectedRuntime]); // budget excluded: createLatencyBudget returns a new object each render

  const latencyGrade = getLatencyGrade(currentInferenceMs || optimalModel.estimatedLatencyMs);
  const critOnTime = isCriticalAlertOnTime(currentInferenceMs || optimalModel.estimatedLatencyMs, budget);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">⚡ On-Device AI Performance</h1>
            <p className="text-gray-400 mt-1 text-sm">
              V15 — Edge inference, latency budgeting, battery-adaptive processing
            </p>
          </div>
          <button
            onClick={() => { setRunning(r => !r); if (running) setLatencyRecords([]); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              running ? 'bg-red-800 hover:bg-red-700 text-white' : 'bg-yellow-400 hover:bg-yellow-300 text-black'
            }`}
          >
            {running ? '⏹ Stop' : '▶ Simulate'}
          </button>
        </div>

        {/* Safety banners */}
        {offlinePath.active && (
          <div className="bg-red-950 border border-red-700 rounded-xl px-4 py-3 text-sm text-red-300 font-medium">
            ⚠ {OFFLINE_SAFETY_MESSAGE}
          </div>
        )}
        {batteryWarning && (
          <div className="bg-yellow-950 border border-yellow-700 rounded-xl px-4 py-2 text-xs text-yellow-300">
            🔋 {batteryWarning}
          </div>
        )}
        {cloudPaused && (
          <div className="bg-blue-950 border border-blue-800 rounded-xl px-4 py-2 text-xs text-blue-300">
            ⏸ Cloud reasoning paused to save power. Critical alerts always use local path.
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Battery */}
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">Battery Level</p>
            <input
              type="range" min={1} max={100} value={batteryPct}
              onChange={(e) => setBatteryPct(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{batteryPct}%</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={isCharging} onChange={(e) => setIsCharging(e.target.checked)} />
                Charging
              </label>
            </div>
            <p className="text-xs mt-2 font-semibold">{getBatteryModeLabel(batteryMode)}</p>
          </div>

          {/* Cloud status */}
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">Cloud Status</p>
            <select
              value={cloudStatus}
              onChange={(e) => setCloudStatus(e.target.value as OfflineStatus)}
              className="w-full bg-gray-900 text-white rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="online">🟢 Online</option>
              <option value="degraded">🟡 Degraded</option>
              <option value="offline">🔴 Offline</option>
            </select>
            <p className="text-xs mt-2 text-gray-400">{buildCloudStatusLabel(cloudStatus)}</p>
            {!isCloudAvailable(cloudStatus) && (
              <p className="text-xs text-red-400 mt-1">Local safety mode active</p>
            )}
          </div>

          {/* Processing mode */}
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Processing Mode</p>
            <p className="text-lg font-bold text-yellow-400">{formatProcessingMode(processingMode)}</p>
            <p className="text-xs text-gray-400 mt-1">Runtime: {formatRuntime(selectedRuntime)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Model: {optimalModel.name}</p>
          </div>
        </div>

        {/* Live metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="FPS" value={running ? String(currentFPS) : String(getRecommendedFPS(batteryMode, false))} sub="target" />
          <StatCard label="Inference" value={`${running ? currentInferenceMs : optimalModel.estimatedLatencyMs}ms`} sub={formatLatencyGrade(latencyGrade)} />
          <StatCard label="Critical ≤500ms" value={critOnTime ? '✅ Yes' : '⚠ No'} />
          <StatCard label="Latency Records" value={String(latencyRecords.length)} sub="last 50" />
        </div>

        {/* Runtime status table */}
        <div className="bg-gray-900 rounded-xl p-5">
          <h2 className="text-sm font-bold text-white mb-3">⚙ System Status</h2>
          <StatusRow label="Battery Mode" value={getBatteryModeLabel(batteryMode)} />
          <StatusRow label="Selected Runtime" value={formatRuntime(selectedRuntime)} />
          <StatusRow label="Processing Mode" value={formatProcessingMode(processingMode)} />
          <StatusRow label="Cloud Status" value={buildCloudStatusLabel(cloudStatus)} />
          <StatusRow label="Local Safety Active" value={offlinePath.active ? '✅ Yes' : '—'} highlight={offlinePath.active} />
          <StatusRow label="Cloud Reasoning" value={cloudPaused ? '⏸ Paused' : '▶ Active'} highlight={cloudPaused} />
          <StatusRow label="Peripheral Cameras" value={profile.skipPeripheralCameras ? '⏹ Skipped' : '▶ Active'} />
          <StatusRow label="Model" value={optimalModel.name} />
          <StatusRow label="Quantization" value={getQuantizationLabel(optimalModel.quantization)} />
          <StatusRow label="Model Size" value={estimateMemoryFootprint(optimalModel)} />
          <StatusRow label="Latency Budget" value={formatBudget(budget)} />
        </div>

        {/* Runtime registry */}
        <div className="bg-gray-900 rounded-xl p-5">
          <h2 className="text-sm font-bold text-white mb-3">🔧 Model Runtime Registry</h2>
          <div className="space-y-2">
            {caps.supportedRuntimes.map((rt) => (
              <div key={rt.runtime} className={`flex items-center justify-between py-1.5 border-b border-gray-800 ${rt.runtime === selectedRuntime ? 'opacity-100' : 'opacity-60'}`}>
                <div className="flex items-center gap-2">
                  {rt.runtime === selectedRuntime && <span className="text-yellow-400 text-xs">▶</span>}
                  <span className="text-sm text-white">{formatRuntime(rt.runtime)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{rt.estimatedLatencyMs}ms est.</span>
                  <span>{rt.powerEfficient ? '🔋' : '⚡'}</span>
                  <span className={rt.availability === 'available' ? 'text-green-400' : rt.availability === 'placeholder' ? 'text-yellow-400' : 'text-gray-600'}>
                    {rt.availability}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live detections */}
        {running && (
          <div className="bg-gray-900 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">🔍 Edge Detections (Tick {tickRef.current})</h2>
            {currentDetections.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {currentDetections.map((det, i) => (
                  <span key={i} className="bg-yellow-900/40 text-yellow-300 text-xs px-2 py-0.5 rounded-full">{det}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600">No objects detected this frame.</p>
            )}
          </div>
        )}

        {/* Latency report */}
        {latencyRecords.length > 0 && (
          <div className="bg-gray-900 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white mb-3">📊 Latency Report ({report.count} frames)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                ['Avg Total', `${report.avgTotalMs}ms`],
                ['Max Total', `${report.maxTotalMs}ms`],
                ['Min Total', `${report.minTotalMs}ms`],
                ['Exceeded Budget', `${report.budgetExceededPct}%`],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-mono text-white mt-1">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offline fallback note */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-400">V15 — On-Device AI Optimization</p>
          <p>Integrates with: Vision Inference · Cognitive Guardian · Spatial Reasoning · Navigation Intelligence · Audio Guidance</p>
          <p>Critical alerts prefer local/edge inference regardless of cloud status.</p>
          <p className="pt-1 text-gray-600">All inference is simulated. Real on-device execution requires TensorFlow.js, ONNX Runtime Web, or WebGPU integration.</p>
        </div>
      </div>
    </div>
  );
}

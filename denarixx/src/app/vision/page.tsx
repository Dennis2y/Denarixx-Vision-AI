'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import {
  runSimulationPipeline,
  buildPerceptionFrame,
  prioritizeObjects,
  formatPriority,
  formatLabel,
} from '@/engines/visionInferenceEngine';
import {
  buildPipelineConfig,
  updateMetrics,
  incrementSkipped,
  getPerformanceLabel,
  shouldSkipFrame,
} from '@/engines/cameraPipelineEngine';
import { createTrackerState, updateTracker, tracksToDetectedObjects } from '@/engines/objectTrackingEngine';
import { getSceneLabel } from '@/engines/sceneUnderstandingEngine';
import { getModelDisplayName } from '@/engines/modelManagerEngine';
import {
  EMPTY_METRICS,
  PIPELINE_PRIVACY,
} from '@/types/vision12';
import type {
  PerceptionFrame,
  PipelineMetrics,
  TrackerState,
  InferenceProvider,
  BatteryMode,
} from '@/types/vision12';

// ─── Priority badge colours ───────────────────────────────────────────────────
const PRIORITY_BG: Record<string, string> = {
  critical: 'bg-red-900/60 border-red-600 text-red-200',
  high: 'bg-orange-900/60 border-orange-600 text-orange-200',
  medium: 'bg-yellow-900/60 border-yellow-600 text-yellow-200',
  low: 'bg-green-900/60 border-green-600 text-green-200',
  ignore: 'bg-gray-800 border-gray-600 text-gray-400',
};

const DISTANCE_ICON: Record<string, string> = {
  collision: '🔴',
  near: '🟠',
  walking_distance: '🟡',
  medium: '🔵',
  far: '⬜',
};

// ─── Page ────────────────────────────────────────────────────────────────────
export default function VisionPage() {
  const { videoRef, canvasRef, status, requestCamera, stopCamera } = useCameraCapture();

  const [running, setRunning] = useState(false);
  const [frame, setFrame] = useState<PerceptionFrame | null>(null);
  const [metrics, setMetrics] = useState<PipelineMetrics>(EMPTY_METRICS);
  const [provider, setProvider] = useState<InferenceProvider>('simulation');
  const [batteryMode, setBatteryMode] = useState<BatteryMode>('balanced');
  const [lastSpeech, setLastSpeech] = useState('—');

  const tickRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const lastSpokenAtRef = useRef(0);
  const trackerRef = useRef<TrackerState>(createTrackerState());
  const metricsRef = useRef<PipelineMetrics>(EMPTY_METRICS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = buildPipelineConfig({ provider, batteryMode });

  const runPipelineTick = useCallback(() => {
    const now = Date.now();
    const intervalMs = batteryMode === 'performance' ? 100 : batteryMode === 'power_save' ? 500 : 200;

    if (shouldSkipFrame(lastFrameTimeRef.current, now, intervalMs)) {
      metricsRef.current = incrementSkipped(metricsRef.current);
      return;
    }

    lastFrameTimeRef.current = now;
    const tick = tickRef.current++;

    const { objects, scene, guidance, inferenceMs } = runSimulationPipeline(
      tick,
      lastSpokenAtRef.current,
      config,
    );

    // Update tracker
    const rawDetections = objects.map((o) => ({
      label: o.label,
      boundingBox: o.boundingBox,
      confidence: o.confidence,
    }));
    trackerRef.current = updateTracker(trackerRef.current, rawDetections, now);
    const trackedObjects = tracksToDetectedObjects(trackerRef.current);
    const prioritized = prioritizeObjects(trackedObjects);

    const frameLatencyMs = Date.now() - now;
    const fps = frameLatencyMs > 0 ? Math.round(1000 / intervalMs) : 0;

    const newFrame = buildPerceptionFrame(
      `frame-${tick}`,
      prioritized,
      scene,
      guidance,
      frameLatencyMs,
      inferenceMs,
      fps,
      provider,
    );

    metricsRef.current = updateMetrics(
      metricsRef.current,
      frameLatencyMs,
      inferenceMs,
      prioritized.length,
      guidance !== null,
    );

    if (guidance) {
      lastSpokenAtRef.current = now;
      setLastSpeech(guidance);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(guidance);
        utt.rate = 1.1;
        window.speechSynthesis.speak(utt);
      }
    }

    setFrame(newFrame);
    setMetrics({ ...metricsRef.current });
  }, [batteryMode, config, provider]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(runPipelineTick, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, runPipelineTick]);

  const handleStart = async () => {
    tickRef.current = 0;
    lastFrameTimeRef.current = 0;
    lastSpokenAtRef.current = 0;
    trackerRef.current = createTrackerState();
    metricsRef.current = EMPTY_METRICS;
    setMetrics(EMPTY_METRICS);
    setFrame(null);
    setLastSpeech('—');
    await requestCamera();
    setRunning(true);
  };

  const handleStop = () => {
    setRunning(false);
    stopCamera();
  };

  const targetInterval = batteryMode === 'performance' ? 100 : batteryMode === 'power_save' ? 500 : 200;
  const displayFps = targetInterval > 0 ? Math.round(1000 / targetInterval) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400">🔬 Live AI Vision</h1>
            <p className="text-gray-400 text-sm mt-1">Real-time perception pipeline — {getModelDisplayName(provider)}</p>
          </div>
          <div className="flex gap-2">
            {running ? (
              <button
                onClick={handleStop}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
              >
                ⏹ Stop
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold transition-colors"
              >
                ▶ Start Pipeline
              </button>
            )}
          </div>
        </div>

        {/* Privacy bar */}
        <div className="bg-green-950 border border-green-800/50 rounded-xl px-5 py-2 flex flex-wrap gap-4">
          {Object.entries(PIPELINE_PRIVACY).map(([k, v]) => (
            <span key={k} className="text-green-400 text-xs">
              {v ? '✓' : '✗'} {k.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </span>
          ))}
        </div>

        {/* Config */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as InferenceProvider)}
              disabled={running}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              <option value="simulation">Simulation (Built-in)</option>
              <option value="openai">OpenAI GPT-4 Vision</option>
              <option value="gemini">Google Gemini Vision</option>
              <option value="onnx">ONNX MobileNet (Future)</option>
              <option value="yolo">YOLOv8 Nano (Future)</option>
              <option value="rtdetr">RT-DETR (Future)</option>
              <option value="sam">SAM Segmentation (Future)</option>
            </select>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Battery Mode</label>
            <select
              value={batteryMode}
              onChange={(e) => setBatteryMode(e.target.value as BatteryMode)}
              disabled={running}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              <option value="performance">Performance ({10} fps)</option>
              <option value="balanced">Balanced ({5} fps)</option>
              <option value="power_save">Power Save ({2} fps)</option>
            </select>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Camera preview */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Camera</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                status === 'active' ? 'bg-green-900/50 text-green-400'
                : status === 'requesting' ? 'bg-yellow-900/50 text-yellow-400'
                : status === 'denied' ? 'bg-red-900/50 text-red-400'
                : 'bg-gray-800 text-gray-500'
              }`}>
                {status === 'active' ? '● Live' : status === 'requesting' ? '● Requesting…'
                : status === 'denied' ? '⚠ Denied' : '○ Inactive'}
              </span>
            </div>
            <div className="relative aspect-video bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${status !== 'active' ? 'opacity-0 absolute' : ''}`}
              />
              <canvas ref={canvasRef} className="hidden" />
              {status !== 'active' && (
                <div className="text-center space-y-2">
                  <p className="text-4xl">{running ? '🎥' : '📷'}</p>
                  <p className="text-gray-400 text-sm">
                    {running ? 'Simulation mode — no camera' : 'Camera inactive'}
                  </p>
                  {running && provider === 'simulation' && (
                    <p className="text-xs text-gray-600">Real camera falls back to simulation</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Detected objects */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Detected Objects</span>
              <span className="text-xs text-gray-500">
                {frame ? `${frame.objects.length} object${frame.objects.length !== 1 ? 's' : ''}` : '—'}
              </span>
            </div>
            <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
              {!running && (
                <p className="text-gray-500 text-sm text-center py-8">Start pipeline to see detections</p>
              )}
              {running && !frame && (
                <p className="text-gray-500 text-sm text-center py-8 animate-pulse">Initialising…</p>
              )}
              {frame?.objects.map((obj) => (
                <div
                  key={obj.trackId}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${PRIORITY_BG[obj.priority] ?? 'bg-gray-800 border-gray-700 text-gray-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{DISTANCE_ICON[obj.distance] ?? '⬜'}</span>
                    <span className="font-semibold">{formatLabel(obj.label)}</span>
                    <span className="font-mono text-gray-400">{obj.trackId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span>{Math.round(obj.confidence * 100)}%</span>
                    <span className="text-gray-500">{obj.distance.replace(/_/g, ' ')}</span>
                    <span>{formatPriority(obj.priority).split(' ')[0]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scene understanding */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Scene Understanding</h3>
            {frame ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Scene', getSceneLabel(frame.scene.scene)],
                  ['Confidence', `${Math.round(frame.scene.confidence * 100)}%`],
                  ['Crowding', frame.scene.crowding],
                  ['Movement', frame.scene.movement],
                  ['Lighting', frame.scene.lighting],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-800 rounded-xl p-3">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-medium text-white capitalize">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No scene data yet</p>
            )}
          </div>

          {/* Performance metrics */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Performance</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                running ? 'bg-yellow-900/50 text-yellow-400' : 'bg-gray-800 text-gray-500'
              }`}>
                {running ? getPerformanceLabel(metrics) : 'Idle'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Target FPS', `${displayFps} fps`],
                ['Frames', String(metrics.framesProcessed)],
                ['Skipped', String(metrics.framesSkipped)],
                ['Objects total', String(metrics.objectsDetectedTotal)],
                ['Speech events', String(metrics.speechEventsTotal)],
                ['Inference avg', `${Math.round(metrics.averageInferenceLatencyMs)}ms`],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800 rounded-xl p-2">
                  <p className="text-gray-500">{label}</p>
                  <p className="font-mono text-yellow-400">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Speech guidance */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="text-2xl">🔊</div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Last AI Guidance</p>
            <p className={`text-lg font-semibold ${lastSpeech === '—' ? 'text-gray-600' : 'text-white'}`}>
              {lastSpeech}
            </p>
          </div>
          {frame?.shouldSpeak && (
            <span className="ml-auto text-xs bg-green-900/50 text-green-400 border border-green-700 px-2 py-0.5 rounded-full">
              Speaking
            </span>
          )}
        </div>

        {/* Frame latency */}
        {frame && (
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['Frame Latency', `${frame.frameLatencyMs}ms`],
              ['Inference', `${frame.inferenceLatencyMs}ms`],
              ['Frame ID', frame.frameId],
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-900 border border-gray-700 rounded-xl p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-mono text-xs text-yellow-400">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Provider roadmap */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Model Roadmap</h3>
          <div className="space-y-2">
            {[
              { name: 'Simulation Engine V12', available: true, latency: '~20ms', cloud: false },
              { name: 'OpenAI GPT-4 Vision', available: false, latency: '~1200ms', cloud: true },
              { name: 'Google Gemini Vision', available: false, latency: '~900ms', cloud: true },
              { name: 'ONNX MobileNet', available: false, latency: '~80ms', cloud: false },
              { name: 'YOLOv8 Nano', available: false, latency: '~30ms', cloud: false },
              { name: 'RT-DETR Large', available: false, latency: '~45ms', cloud: false },
              { name: 'SAM ViT-B', available: false, latency: '~200ms', cloud: false },
            ].map((m) => (
              <div key={m.name} className="flex items-center gap-3 text-xs">
                <span className={m.available ? 'text-green-400' : 'text-gray-600'}>
                  {m.available ? '✓' : '○'}
                </span>
                <span className={m.available ? 'text-white' : 'text-gray-500'}>{m.name}</span>
                <span className="ml-auto text-gray-600">{m.latency}</span>
                <span className={m.cloud ? 'text-blue-400' : 'text-gray-600'}>
                  {m.cloud ? '☁ Cloud' : '📱 On-device'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

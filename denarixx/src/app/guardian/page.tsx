'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { HazardAlert, SafetyDecision } from '@/types';

const SCENARIOS = [
  {
    id: 'vehicle',
    label: 'Vehicle approaching',
    icon: '🚗',
    desc: 'Fast-moving vehicle detected on road surface',
    detections: [
      { label: 'vehicle', confidence: 0.94 },
      { label: 'road', confidence: 0.97 },
    ],
  },
  {
    id: 'step',
    label: 'Step / curb ahead',
    icon: '🪜',
    desc: 'Elevation change detected with moderate confidence',
    detections: [
      { label: 'step', confidence: 0.65 },
      { label: 'pavement', confidence: 0.91 },
    ],
  },
  {
    id: 'crowd',
    label: 'Crowded path',
    icon: '👥',
    desc: 'Multiple moving obstacles detected',
    detections: [
      { label: 'person', confidence: 0.81 },
      { label: 'bicycle', confidence: 0.74 },
      { label: 'obstacle', confidence: 0.69 },
    ],
  },
  {
    id: 'clear',
    label: 'Clear path',
    icon: '✅',
    desc: 'No significant hazards in immediate vicinity',
    detections: [
      { label: 'pavement', confidence: 0.92 },
    ],
  },
] as const;

type ScenarioId = (typeof SCENARIOS)[number]['id'];

type StageStatus = 'idle' | 'running' | 'done';

interface PipelineResult {
  hazards: { alerts: HazardAlert[] } | null;
  safety: { decision: SafetyDecision } | null;
  audio: { queued: boolean; text: string; priority: string } | null;
}

const urgencyVariant = (u: string) => {
  if (u === 'critical') return 'critical' as const;
  if (u === 'high') return 'high' as const;
  if (u === 'medium') return 'medium' as const;
  if (u === 'low') return 'low' as const;
  return 'muted' as const;
};

export default function GuardianPage() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('vehicle');
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<StageStatus[]>(['idle', 'idle', 'idle', 'idle']);
  const [result, setResult] = useState<PipelineResult>({ hazards: null, safety: null, audio: null });
  const [elapsed, setElapsed] = useState<number[]>([]);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;

  const setStage = (index: number, status: StageStatus) => {
    setStages((prev) => {
      const next = [...prev];
      next[index] = status;
      return next;
    });
  };

  async function runPipeline() {
    setRunning(true);
    setResult({ hazards: null, safety: null, audio: null });
    setStages(['idle', 'idle', 'idle', 'idle']);
    setElapsed([]);

    const timings: number[] = [];

    // Start a temporary session
    let sessionId = 'guardian-demo';
    try {
      const startRes = await fetch('/api/sessions/start', { method: 'POST' });
      const { data } = await startRes.json();
      sessionId = data.sessionId;
    } catch {
      // continue with fallback id
    }

    try {
      // Stage 1: Hazard Detection
      setStage(0, 'running');
      const t1 = performance.now();
      const hazardRes = await fetch('/api/hazards/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, detections: scenario.detections }),
      });
      timings[0] = Math.round(performance.now() - t1);
      const hazardData = await hazardRes.json();
      setResult((r) => ({ ...r, hazards: hazardData.data }));
      setStage(0, 'done');
      setElapsed([...timings]);
      await delay(400);

      // Stage 2: Safety Decision
      setStage(1, 'running');
      const t2 = performance.now();
      const safetyRes = await fetch('/api/safety/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, alerts: hazardData.data?.alerts ?? [] }),
      });
      timings[1] = Math.round(performance.now() - t2);
      const safetyData = await safetyRes.json();
      setResult((r) => ({ ...r, safety: safetyData.data }));
      setStage(1, 'done');
      setElapsed([...timings]);
      await delay(400);

      // Stage 3: Audio Guidance
      setStage(2, 'running');
      const decision = safetyData.data?.decision as SafetyDecision | undefined;
      const audioText =
        decision?.shouldAlert && decision.message
          ? decision.message
          : 'Path appears clear. Continue cautiously.';
      const audioPriority =
        decision?.urgency === 'critical' || decision?.urgency === 'high'
          ? decision.urgency
          : 'normal';
      const t3 = performance.now();
      const audioRes = await fetch('/api/audio/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          text: audioText,
          priority: audioPriority,
          interrupt: decision?.interruptNarration ?? false,
        }),
      });
      timings[2] = Math.round(performance.now() - t3);
      const audioData = await audioRes.json();
      setResult((r) => ({
        ...r,
        audio: { ...(audioData.data ?? {}), text: audioText, priority: audioPriority },
      }));
      setStage(2, 'done');
      setElapsed([...timings]);
      await delay(400);

      // Stage 4: Complete
      setStage(3, 'done');
    } finally {
      // End session
      await fetch('/api/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
      setRunning(false);
    }
  }

  const stagesConfig = [
    { icon: '⚠', label: 'Hazard Detection', engine: 'HazardDetectionEngine', api: '/api/hazards/evaluate' },
    { icon: '🧠', label: 'Safety Decision', engine: 'SafetyDecisionEngine', api: '/api/safety/decide' },
    { icon: '🔊', label: 'Audio Guidance', engine: 'AudioGuidanceEngine', api: '/api/audio/speak' },
    { icon: '✅', label: 'Decision Output', engine: 'Cognitive Guardian', api: 'pipeline complete' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-purple-900/30 border border-purple-700/50 rounded-full px-3 py-1 text-purple-300 text-xs font-semibold mb-3">
          V2 Preview
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Cognitive Guardian</h1>
        <p className="text-gray-400 max-w-2xl">
          Watch the AI safety pipeline execute in real-time. Each stage calls a live engine and
          returns structured data — from raw detections to a final spoken safety decision.
        </p>
      </div>

      {/* Scenario picker */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Choose a scenario</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenarioId(s.id)}
              disabled={running}
              aria-pressed={scenarioId === s.id}
              className={`rounded-lg p-3 text-left border transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50 ${
                scenarioId === s.id
                  ? 'bg-yellow-950 border-yellow-600 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              <p className="text-xl mb-1" aria-hidden="true">{s.icon}</p>
              <p className="font-semibold text-sm">{s.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-gray-400 text-xs mb-1">Input detections</p>
            <div className="flex gap-1.5 flex-wrap">
              {scenario.detections.map((d, i) => (
                <span
                  key={i}
                  className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded px-2 py-0.5 font-mono"
                >
                  {d.label} {Math.round(d.confidence * 100)}%
                </span>
              ))}
            </div>
          </div>
          <div className="ml-auto">
            <Button
              onClick={runPipeline}
              disabled={running}
              size="lg"
              aria-label="Run the cognitive guardian pipeline"
            >
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  Running…
                </span>
              ) : (
                '▶ Run Pipeline'
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Pipeline stages */}
      <div className="space-y-3 mb-6" role="region" aria-label="Pipeline execution stages" aria-live="polite">
        {stagesConfig.map((stage, index) => {
          const status = stages[index];
          const timing = elapsed[index];
          return (
            <div
              key={index}
              className={`rounded-xl border p-4 transition-all ${
                status === 'done'
                  ? 'bg-gray-900 border-green-700/50'
                  : status === 'running'
                  ? 'bg-yellow-950/30 border-yellow-600'
                  : 'bg-gray-900/50 border-gray-800'
              }`}
              aria-label={`Stage ${index + 1}: ${stage.label} — ${status}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                    status === 'done'
                      ? index === 3 ? 'bg-green-500 text-black' : 'bg-green-800 text-green-200'
                      : status === 'running'
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-800 text-gray-600'
                  }`}
                  aria-hidden="true"
                >
                  {status === 'done' ? '✓' : status === 'running' ? '⟳' : index + 1}
                </div>
                <div className="flex-1">
                  <span className="text-white font-semibold text-sm">
                    {stage.icon} {stage.label}
                  </span>
                  <span className="text-gray-500 text-xs ml-2 font-mono">{stage.engine}</span>
                </div>
                {timing !== undefined && (
                  <span className="text-green-400 text-xs font-mono">{timing} ms</span>
                )}
                {status === 'running' && (
                  <span className="text-yellow-400 text-xs animate-pulse">Processing…</span>
                )}
                <span className="text-gray-600 text-xs font-mono">{stage.api}</span>
              </div>

              {/* Stage results */}
              {status === 'done' && index === 0 && result.hazards && (
                <div className="mt-2 ml-10">
                  {result.hazards.alerts.length === 0 ? (
                    <p className="text-green-400 text-sm">✓ No hazards detected</p>
                  ) : (
                    <div className="space-y-1">
                      {result.hazards.alerts.map((a) => (
                        <div key={a.id} className="flex items-center gap-2">
                          <Badge variant={urgencyVariant(a.severity)}>{a.severity}</Badge>
                          <span className="text-gray-300 text-sm">{a.description}</span>
                          <span className="text-gray-500 text-xs ml-auto">{Math.round(a.confidence * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {status === 'done' && index === 1 && result.safety && (
                <div className="mt-2 ml-10">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={result.safety.decision.shouldAlert ? urgencyVariant(result.safety.decision.urgency) : 'success'}>
                      {result.safety.decision.shouldAlert ? `Alert: ${result.safety.decision.urgency}` : 'No alert'}
                    </Badge>
                    {result.safety.decision.interruptNarration && (
                      <Badge variant="high">Interrupts narration</Badge>
                    )}
                    <span className="text-gray-400 text-xs">
                      Confidence: {Math.round(result.safety.decision.confidence * 100)}%
                    </span>
                  </div>
                  {result.safety.decision.message && (
                    <p className="text-gray-200 text-sm mt-1.5">{result.safety.decision.message}</p>
                  )}
                </div>
              )}

              {status === 'done' && index === 2 && result.audio && (
                <div className="mt-2 ml-10">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={urgencyVariant(result.audio.priority)}>{result.audio.priority}</Badge>
                    <span className="text-gray-400 text-xs">priority</span>
                  </div>
                  <p className="text-gray-200 text-sm italic">&ldquo;{result.audio.text}&rdquo;</p>
                </div>
              )}

              {status === 'done' && index === 3 && result.safety && (
                <div className="mt-2 ml-10">
                  <div
                    className={`rounded-lg p-3 border ${
                      result.safety.decision.shouldAlert
                        ? 'bg-red-950/40 border-red-700/50'
                        : 'bg-green-950/40 border-green-700/50'
                    }`}
                  >
                    <p className={`font-bold text-sm ${result.safety.decision.shouldAlert ? 'text-red-300' : 'text-green-300'}`}>
                      {result.safety.decision.shouldAlert
                        ? `⚠ Safety alert — ${result.safety.decision.urgency} urgency`
                        : '✓ Path assessment: no immediate action needed'}
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      Guardian latency: {elapsed.reduce((a, b) => a + b, 0)} ms total
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* How it works */}
      <Card className="border-gray-700">
        <CardHeader>
          <CardTitle>How the Cognitive Guardian works</CardTitle>
        </CardHeader>
        <div className="text-gray-400 text-sm space-y-2">
          <p>
            The <strong className="text-white">Cognitive Guardian</strong> is a multi-stage safety
            decision pipeline that runs on every vision frame. It is designed for{' '}
            <strong className="text-white">high recall over precision</strong> — it is better to
            issue a false positive alert than to miss a real hazard.
          </p>
          <p>
            Each stage runs as a separate engine with its own confidence thresholds. The{' '}
            <strong className="text-white">SafetyDecisionEngine</strong> arbitrates between
            competing alerts and decides whether narration should be interrupted.
          </p>
          <p>
            In Phase 2, the Guardian will receive continuous scene context from the{' '}
            <strong className="text-white">AI Memory layer</strong>, enabling location-aware
            reasoning: &ldquo;This step was here yesterday — user already knows about it.&rdquo;
          </p>
        </div>
      </Card>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

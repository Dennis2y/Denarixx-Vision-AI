'use client';

import { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EnvironmentUnderstandingEngine } from '@/engines/environmentUnderstandingEngine';
import { CognitiveReasoningEngine } from '@/engines/cognitiveReasoningEngine';
import { RiskPredictionEngine } from '@/engines/riskPredictionEngine';
import { ActionDecisionEngine } from '@/engines/actionDecisionEngine';
import { HumanGuideEngine } from '@/engines/humanGuideEngine';
import type { Detection } from '@/types';
import type {
  V3ReasoningResult,
  ReasoningRiskLevel,
  ReasoningPriority,
} from '@/types/reasoning';

// ─── Scenario data ────────────────────────────────────────────────────────────

interface V3Frame {
  label: string;
  detections: Detection[];
}
interface V3Scenario {
  id: string;
  title: string;
  icon: string;
  desc: string;
  frames: V3Frame[];
}

const SCENARIOS: V3Scenario[] = [
  {
    id: 'street-crossing',
    title: 'Busy Street Crossing',
    icon: '🚦',
    desc: 'Vehicle approaching at crossing — critical hazard pipeline',
    frames: [
      {
        label: 'Approaching road',
        detections: [
          { label: 'road', confidence: 0.88 },
          { label: 'pavement', confidence: 0.93 },
        ],
      },
      {
        label: 'Vehicle spotted',
        detections: [
          { label: 'vehicle', confidence: 0.72 },
          { label: 'road', confidence: 0.95 },
          { label: 'person', confidence: 0.65 },
        ],
      },
      {
        label: 'Vehicle close',
        detections: [
          { label: 'vehicle', confidence: 0.94 },
          { label: 'road', confidence: 0.97 },
        ],
      },
      {
        label: 'Road clear',
        detections: [
          { label: 'pavement', confidence: 0.96 },
          { label: 'road', confidence: 0.87 },
        ],
      },
    ],
  },
  {
    id: 'market',
    title: 'Village Market',
    icon: '🏘',
    desc: 'Crowded area — cyclists, people, mixed obstacles',
    frames: [
      {
        label: 'Entering market',
        detections: [
          { label: 'person', confidence: 0.82 },
          { label: 'bicycle', confidence: 0.71 },
        ],
      },
      {
        label: 'Obstacle ahead',
        detections: [
          { label: 'obstacle', confidence: 0.78 },
          { label: 'person', confidence: 0.88 },
        ],
      },
      {
        label: 'Cyclist passes',
        detections: [
          { label: 'bicycle', confidence: 0.84 },
          { label: 'pavement', confidence: 0.91 },
        ],
      },
      {
        label: 'Market cleared',
        detections: [{ label: 'pavement', confidence: 0.95 }],
      },
    ],
  },
  {
    id: 'indoor-corridor',
    title: 'Indoor Corridor',
    icon: '🏛',
    desc: 'Indoor navigation — staircase and obstacle hazards',
    frames: [
      {
        label: 'Corridor start',
        detections: [
          { label: 'pavement', confidence: 0.91 },
          { label: 'step', confidence: 0.62 },
        ],
      },
      {
        label: 'Step confirmed',
        detections: [
          { label: 'step', confidence: 0.79 },
          { label: 'obstacle', confidence: 0.74 },
        ],
      },
      {
        label: 'Stairs ahead',
        detections: [
          { label: 'stairs', confidence: 0.83 },
          { label: 'obstacle', confidence: 0.55 },
        ],
      },
      {
        label: 'Corridor clear',
        detections: [{ label: 'pavement', confidence: 0.94 }],
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_ORDER: Record<ReasoningRiskLevel, number> = {
  critical: 5, high: 4, medium: 3, low: 2, informational: 1, none: 0,
};

function riskBadge(r: ReasoningRiskLevel): 'critical' | 'high' | 'medium' | 'low' | 'success' | 'muted' {
  if (r === 'critical') return 'critical';
  if (r === 'high') return 'high';
  if (r === 'medium') return 'medium';
  if (r === 'low') return 'low';
  if (r === 'informational') return 'muted';
  return 'success';
}

function priorityBadge(p: ReasoningPriority): 'critical' | 'high' | 'medium' | 'low' | 'muted' {
  if (p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'medium') return 'medium';
  if (p === 'low') return 'low';
  return 'muted';
}

function delayMs(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function BoolDot({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${value ? 'bg-green-400' : 'bg-gray-700'}`}
        aria-hidden="true"
      />
      <span className={`text-xs ${value ? 'text-gray-200' : 'text-gray-600'}`}>{label}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReasoningPage() {
  const [scenarioId, setScenarioId] = useState('street-crossing');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<V3ReasoningResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [frameLabels, setFrameLabels] = useState<string[]>([]);

  const envEngineRef = useRef(new EnvironmentUnderstandingEngine());
  const reasoningEngineRef = useRef(new CognitiveReasoningEngine());
  const riskEngineRef = useRef(new RiskPredictionEngine());
  const actionEngineRef = useRef(new ActionDecisionEngine());
  const guideEngineRef = useRef(new HumanGuideEngine());

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const latest = results[results.length - 1] ?? null;
  const done = !running && results.length === scenario.frames.length && results.length > 0;

  async function runSimulation() {
    setRunning(true);
    setResults([]);
    setCurrentIdx(-1);
    setFrameLabels([]);
    guideEngineRef.current.reset();

    const local: V3ReasoningResult[] = [];
    const labels: string[] = [];

    for (let i = 0; i < scenario.frames.length; i++) {
      setCurrentIdx(i);
      const frame = scenario.frames[i];
      const t0 = performance.now();

      const env = envEngineRef.current.understand(frame.detections);
      const risk = riskEngineRef.current.predict(frame.detections, env);
      const reasoning = reasoningEngineRef.current.reason(env, risk);
      const action = actionEngineRef.current.decide(reasoning, risk, env);
      const guide = guideEngineRef.current.generate(action, reasoning, env);

      const result: V3ReasoningResult = {
        environment: env,
        reasoning,
        riskPrediction: risk,
        action,
        guideMessage: guide,
        processingTimeMs: Math.round(performance.now() - t0),
      };
      local.push(result);
      labels.push(frame.label);
      setResults([...local]);
      setFrameLabels([...labels]);

      if (i < scenario.frames.length - 1) await delayMs(750);
    }

    setCurrentIdx(-1);
    setRunning(false);
  }

  const peakRisk = results.reduce<ReasoningRiskLevel>((best, r) => {
    return RISK_ORDER[r.riskPrediction.riskLevel] > RISK_ORDER[best]
      ? r.riskPrediction.riskLevel
      : best;
  }, 'none');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-emerald-900/30 border border-emerald-700/50 rounded-full px-3 py-1 text-emerald-300 text-xs font-semibold mb-3">
          V3 Cognitive Reasoning Engine
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Cognitive Reasoning</h1>
        <p className="text-gray-400 max-w-2xl">
          Watch the V3 pipeline think through each frame — understanding the environment,
          predicting risks, deciding actions, and generating natural human-guide messages.
        </p>
      </div>

      {/* Scenario picker */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Choose a scenario</CardTitle></CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => { if (!running) { setScenarioId(s.id); setResults([]); setFrameLabels([]); } }}
              disabled={running}
              aria-pressed={scenarioId === s.id}
              className={`rounded-xl p-4 text-left border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50 ${
                scenarioId === s.id
                  ? 'bg-emerald-950/40 border-emerald-600'
                  : 'bg-gray-900 border-gray-700 hover:border-gray-600'
              }`}
            >
              <p className="text-2xl mb-2" aria-hidden="true">{s.icon}</p>
              <p className="font-bold text-sm text-white">{s.title}</p>
              <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
              <p className="text-xs text-gray-700 mt-1">{s.frames.length} frames</p>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm">
            {running && currentIdx >= 0 && (
              <p className="text-yellow-400 font-semibold animate-pulse">
                ⟳ Frame {currentIdx + 1} of {scenario.frames.length} — {scenario.frames[currentIdx]?.label}
              </p>
            )}
            {done && (
              <p className="text-green-400 font-semibold">
                ✓ Pipeline complete · peak risk{' '}
                <span className="capitalize">{peakRisk}</span>
              </p>
            )}
            {!running && results.length === 0 && (
              <p className="text-gray-500">Select a scenario and run the reasoning pipeline.</p>
            )}
          </div>
          <Button onClick={runSimulation} disabled={running} size="lg">
            {running ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                Reasoning…
              </span>
            ) : results.length > 0 ? '↺ Run Again' : '▶ Run V3 Reasoning Pipeline'}
          </Button>
        </div>
      </Card>

      {/* Live dashboard */}
      {latest && (
        <>
          {/* Frame progress */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            {scenario.frames.map((f, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs ${
                results.length > i ? 'text-emerald-400' : i === currentIdx ? 'text-yellow-400' : 'text-gray-700'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  results.length > i ? 'bg-emerald-400' : i === currentIdx ? 'bg-yellow-400 animate-pulse' : 'bg-gray-800'
                }`} />
                <span>{f.label}</span>
              </div>
            ))}
            <span className="text-gray-700 text-xs ml-auto">{latest.processingTimeMs} ms / frame</span>
          </div>

          {/* 6-panel grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

            {/* 1. Environment Understanding */}
            <Card>
              <CardHeader><CardTitle>🌍 Environment</CardTitle></CardHeader>
              <div className="space-y-3">
                <div>
                  <p className="text-white font-bold text-sm leading-snug">{latest.environment.summary}</p>
                  <p className="text-gray-500 text-xs mt-0.5 capitalize">
                    {latest.environment.environmentType.replace('_', ' ')} · {latest.environment.isIndoor ? 'Indoor' : 'Outdoor'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-800 rounded-lg p-2.5 text-center">
                    <p className="text-white font-bold text-sm">{pct(latest.environment.confidence)}</p>
                    <p className="text-gray-600 text-xs">confidence</p>
                  </div>
                  <div className="flex-1 bg-gray-800 rounded-lg p-2.5 text-center">
                    <p className="text-white font-bold text-sm">{latest.environment.detectedLabels.length}</p>
                    <p className="text-gray-600 text-xs">labels</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {latest.environment.detectedLabels.map((l) => (
                    <span key={l} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-0.5 font-mono">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            {/* 2. Cognitive Reasoning */}
            <Card>
              <CardHeader><CardTitle>🧠 Reasoning</CardTitle></CardHeader>
              <div className="space-y-2">
                <div className="bg-gray-800/50 rounded-lg p-2.5">
                  <p className="text-gray-500 text-xs mb-0.5">What is happening</p>
                  <p className="text-gray-200 text-xs leading-relaxed">{latest.reasoning.whatIsHappening}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2.5">
                  <p className="text-gray-500 text-xs mb-0.5">What is likely next</p>
                  <p className="text-gray-200 text-xs leading-relaxed">{latest.reasoning.whatIsLikelyNext}</p>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  <BoolDot value={latest.reasoning.isUserSafe} label="User safe" />
                  <BoolDot value={latest.reasoning.needsGuidance} label="Needs guidance" />
                  <BoolDot value={latest.reasoning.shouldInterruptImmediately} label="Interrupt now" />
                  <BoolDot value={latest.reasoning.shouldReassure} label="Reassure" />
                  <BoolDot value={latest.reasoning.shouldPredictDanger} label="Predict danger" />
                  <BoolDot value={!latest.reasoning.shouldStaySilent} label="Should speak" />
                </div>
              </div>
            </Card>

            {/* 3. Risk Prediction */}
            <Card>
              <CardHeader>
                <CardTitle>⚠ Risk Prediction</CardTitle>
                <Badge variant={riskBadge(latest.riskPrediction.riskLevel)}>
                  {latest.riskPrediction.riskLevel}
                </Badge>
              </CardHeader>
              <div className="space-y-3">
                {latest.riskPrediction.predictedEvent ? (
                  <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                    <p className="text-gray-200 text-xs leading-relaxed font-medium">
                      {latest.riskPrediction.predictedEvent}
                    </p>
                    {latest.riskPrediction.timeToImpactSeconds !== null && (
                      <p className="text-gray-500 text-xs mt-1.5">
                        ⏱ ~{latest.riskPrediction.timeToImpactSeconds}s until impact
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm">No specific event predicted.</p>
                )}
                {latest.riskPrediction.factors.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1.5">Contributing factors</p>
                    <ul className="space-y-1">
                      {latest.riskPrediction.factors.map((f, i) => (
                        <li key={i} className="text-xs text-gray-400 font-mono flex items-start gap-1.5">
                          <span className="text-gray-700 mt-px">·</span>{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">Confidence</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: pct(latest.riskPrediction.confidence) }}
                    />
                  </div>
                  <span className="text-gray-400 text-xs">{pct(latest.riskPrediction.confidence)}</span>
                </div>
              </div>
            </Card>

            {/* 4. Action Decision */}
            <Card>
              <CardHeader>
                <CardTitle>🎯 Action</CardTitle>
                <Badge variant={priorityBadge(latest.action.priority)}>
                  {latest.action.priority}
                </Badge>
              </CardHeader>
              <div className="space-y-3">
                <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                  <p className="text-gray-500 text-xs">Recommended action</p>
                  <p className="text-white font-bold text-sm capitalize mt-0.5">
                    {latest.action.action.replace(/_/g, ' ')}
                  </p>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed font-medium">
                  {latest.action.instruction}
                </p>
                <div className="text-xs text-gray-500 border-t border-gray-800 pt-2">
                  <p className="text-gray-600 mb-0.5">Why the AI decided this</p>
                  <p className="text-gray-400 leading-relaxed">{latest.action.reasoning}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${latest.action.shouldInterrupt ? 'text-amber-400' : 'text-gray-600'}`}>
                    {latest.action.shouldInterrupt ? '⚡ Interrupts audio' : 'No interrupt'}
                  </span>
                </div>
              </div>
            </Card>

            {/* 5. Human Guide Message */}
            <Card>
              <CardHeader>
                <CardTitle>🔊 Guide Message</CardTitle>
                {latest.guideMessage.shouldSpeak ? (
                  <Badge variant={priorityBadge(latest.guideMessage.priority)}>speaks</Badge>
                ) : (
                  <Badge variant="muted">silent</Badge>
                )}
              </CardHeader>
              <div className="space-y-3">
                <div className={`rounded-lg p-3 border ${
                  latest.guideMessage.priority === 'critical' ? 'bg-red-950/40 border-red-700/50' :
                  latest.guideMessage.priority === 'high' ? 'bg-amber-950/30 border-amber-700/50' :
                  'bg-gray-800/60 border-gray-700'
                }`}>
                  <p className="text-white text-sm leading-relaxed font-medium italic">
                    &ldquo;{latest.guideMessage.text}&rdquo;
                  </p>
                </div>
                {latest.guideMessage.uncertaintyNote && (
                  <div className="flex items-start gap-2 bg-blue-950/30 rounded-lg p-2.5 border border-blue-800/40">
                    <span className="text-blue-400 text-xs mt-px">ℹ</span>
                    <p className="text-blue-300 text-xs leading-relaxed">{latest.guideMessage.uncertaintyNote}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* 6. Pipeline stats */}
            <Card>
              <CardHeader><CardTitle>📊 Pipeline</CardTitle></CardHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-800 rounded-lg p-2.5 text-center">
                    <p className="text-white font-bold">{results.length} / {scenario.frames.length}</p>
                    <p className="text-gray-600 text-xs">frames done</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2.5 text-center">
                    <p className="text-white font-bold">{latest.processingTimeMs} ms</p>
                    <p className="text-gray-600 text-xs">last frame</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2.5 text-center">
                    <p className="text-white font-bold">{pct(latest.reasoning.confidence)}</p>
                    <p className="text-gray-600 text-xs">confidence</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-2.5 text-center">
                    <p className={`font-bold capitalize text-sm ${
                      peakRisk === 'critical' ? 'text-red-400' :
                      peakRisk === 'high' ? 'text-orange-400' :
                      peakRisk === 'medium' ? 'text-yellow-400' :
                      peakRisk === 'low' ? 'text-blue-400' :
                      'text-green-400'
                    }`}>{peakRisk}</p>
                    <p className="text-gray-600 text-xs">peak risk</p>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1.5">Pipeline stages</p>
                  {['Environment', 'Cognitive Reasoning', 'Risk Prediction', 'Action Decision', 'Human Guide'].map((stage) => (
                    <div key={stage} className="flex items-center gap-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
                      <span className="text-gray-400 text-xs">{stage}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

          </div>

          {/* Frame-by-frame log */}
          {results.length > 1 && (
            <Card>
              <CardHeader><CardTitle>📋 Frame Log</CardTitle></CardHeader>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center text-xs py-2 border-b border-gray-800 last:border-0">
                    <span className="text-gray-700 font-mono w-6 text-right">{i + 1}</span>
                    <div>
                      <p className="text-gray-300 font-medium">{frameLabels[i]}</p>
                      <p className="text-gray-600 leading-relaxed truncate max-w-xs">{r.guideMessage.text}</p>
                    </div>
                    <Badge variant={riskBadge(r.riskPrediction.riskLevel)} className="text-xs">
                      {r.riskPrediction.riskLevel}
                    </Badge>
                    <span className="text-gray-700 font-mono">{r.processingTimeMs}ms</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

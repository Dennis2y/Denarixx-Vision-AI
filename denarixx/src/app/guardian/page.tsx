'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { HazardAlert, SafetyDecision } from '@/types';

// ─── Simulation types ─────────────────────────────────────────────────────────

type UserActivity = 'walking' | 'stopped' | 'crossing' | 'turning';
type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
type AlertFatigue = 'none' | 'low' | 'medium' | 'high';
type AudioPriority = 'critical' | 'high' | 'normal' | 'low';

interface SimProactiveAlert {
  id: string;
  message: string;
  riskLevel: RiskLevel;
  confidence: number;
  anticipatedIn: number;
}

interface SimSilenceDecision {
  shouldSilence: boolean;
  reason: string;
  fatigueLevel: AlertFatigue;
}

interface SimRiskPrediction {
  predictedRisk: RiskLevel;
  confidence: number;
  factors: string[];
  reasoning: string;
}

interface AudioQueueItem {
  id: string;
  text: string;
  priority: AudioPriority;
  frameNum: number;
}

interface FrameSpec {
  activity: UserActivity;
  isIndoors: boolean;
  detections: { label: string; confidence: number }[];
  proactiveAlerts: SimProactiveAlert[];
  silenceDecision: SimSilenceDecision;
  riskPrediction: SimRiskPrediction;
  companionMessage: string;
}

interface SimScenario {
  id: string;
  label: string;
  icon: string;
  desc: string;
  frames: FrameSpec[];
}

interface LiveFrame {
  frameNum: number;
  spec: FrameSpec;
  apiAlerts: HazardAlert[];
  apiDecision: SafetyDecision | null;
  apiAudioText: string;
  apiAudioPriority: AudioPriority;
  frameMs: number;
}

interface SessionSummary {
  totalFrames: number;
  totalApiAlerts: number;
  silencedFrames: number;
  proactiveAlertsFired: number;
  peakRisk: RiskLevel;
  peakFatigue: AlertFatigue;
  totalMs: number;
  audioItemsQueued: number;
}

// ─── Scenario data ────────────────────────────────────────────────────────────

const SCENARIOS: SimScenario[] = [
  {
    id: 'city-crossing',
    label: 'Busy City Crossing',
    icon: '🚦',
    desc: 'Vehicle at road crossing — critical hazard simulation',
    frames: [
      {
        activity: 'walking', isIndoors: false,
        detections: [{ label: 'vehicle', confidence: 0.72 }, { label: 'road', confidence: 0.95 }, { label: 'person', confidence: 0.65 }],
        proactiveAlerts: [{ id: 'pa1', message: 'Vehicle may be approaching. Be prepared to stop.', riskLevel: 'high', confidence: 0.72, anticipatedIn: 3 }],
        silenceDecision: { shouldSilence: false, reason: 'No silencing needed', fatigueLevel: 'none' },
        riskPrediction: { predictedRisk: 'high', confidence: 0.75, factors: ['Vehicle detected (72%)', 'Road surface (95%)'], reasoning: 'Vehicle approaching on road.' },
        companionMessage: 'Vehicle approaching — be prepared to stop.',
      },
      {
        activity: 'crossing', isIndoors: false,
        detections: [{ label: 'vehicle', confidence: 0.94 }, { label: 'road', confidence: 0.97 }],
        proactiveAlerts: [],
        silenceDecision: { shouldSilence: false, reason: 'Critical alert — silence bypassed', fatigueLevel: 'low' },
        riskPrediction: { predictedRisk: 'critical', confidence: 0.92, factors: ['Vehicle (94%) — sustained hazard', 'Road crossing confirmed'], reasoning: 'Sustained vehicle presence at crossing.' },
        companionMessage: '⚠ STOP — high-confidence vehicle detected. Do not cross.',
      },
      {
        activity: 'stopped', isIndoors: false,
        detections: [{ label: 'road', confidence: 0.95 }, { label: 'pavement', confidence: 0.90 }],
        proactiveAlerts: [],
        silenceDecision: { shouldSilence: true, reason: 'Alert rate exceeded (3/3 per minute)', fatigueLevel: 'medium' },
        riskPrediction: { predictedRisk: 'low', confidence: 0.82, factors: ['Road clear (95%)'], reasoning: 'No active vehicle — path clearing.' },
        companionMessage: 'Waiting for clear path. Alert fatigue detected — reducing output.',
      },
      {
        activity: 'walking', isIndoors: false,
        detections: [{ label: 'pavement', confidence: 0.93 }, { label: 'road', confidence: 0.88 }],
        proactiveAlerts: [],
        silenceDecision: { shouldSilence: false, reason: 'No silencing needed', fatigueLevel: 'low' },
        riskPrediction: { predictedRisk: 'none', confidence: 0.91, factors: [], reasoning: 'No hazardous objects detected.' },
        companionMessage: 'Path clear. Continue forward.',
      },
    ],
  },
  {
    id: 'village-market',
    label: 'Village Market',
    icon: '🏘',
    desc: 'Crowded market — people, cyclists, mixed obstacles',
    frames: [
      {
        activity: 'walking', isIndoors: false,
        detections: [{ label: 'person', confidence: 0.81 }, { label: 'bicycle', confidence: 0.74 }, { label: 'obstacle', confidence: 0.69 }],
        proactiveAlerts: [
          { id: 'pa1', message: 'Person ahead — may need to navigate around.', riskLevel: 'low', confidence: 0.81, anticipatedIn: 6 },
          { id: 'pa2', message: 'Cyclist may cross your path in ~5 seconds.', riskLevel: 'medium', confidence: 0.74, anticipatedIn: 5 },
        ],
        silenceDecision: { shouldSilence: false, reason: 'No silencing needed', fatigueLevel: 'none' },
        riskPrediction: { predictedRisk: 'medium', confidence: 0.68, factors: ['Person (81%)', 'Bicycle (74%)', 'Obstacle (69%)'], reasoning: 'Crowded environment — multiple moving obstacles.' },
        companionMessage: 'Busy area ahead — people and cyclists detected. Proceed carefully.',
      },
      {
        activity: 'stopped', isIndoors: false,
        detections: [{ label: 'person', confidence: 0.88 }, { label: 'person', confidence: 0.79 }, { label: 'bicycle', confidence: 0.82 }],
        proactiveAlerts: [{ id: 'pa3', message: 'Cyclist may cross in ~3 seconds.', riskLevel: 'medium', confidence: 0.82, anticipatedIn: 3 }],
        silenceDecision: { shouldSilence: true, reason: 'Alert rate exceeded (3/3 per minute)', fatigueLevel: 'high' },
        riskPrediction: { predictedRisk: 'medium', confidence: 0.73, factors: ['Multiple people detected', 'Bicycle (82%)'], reasoning: 'Sustained crowded scene.' },
        companionMessage: 'High alert frequency — reducing output to prevent fatigue.',
      },
      {
        activity: 'walking', isIndoors: false,
        detections: [{ label: 'obstacle', confidence: 0.77 }, { label: 'pavement', confidence: 0.91 }],
        proactiveAlerts: [{ id: 'pa4', message: 'Obstacle ahead — reduce speed.', riskLevel: 'medium', confidence: 0.77, anticipatedIn: 3 }],
        silenceDecision: { shouldSilence: false, reason: 'Fatigue recovering', fatigueLevel: 'medium' },
        riskPrediction: { predictedRisk: 'medium', confidence: 0.76, factors: ['Obstacle (77%)'], reasoning: 'Object in path ahead.' },
        companionMessage: 'Obstacle in path — slow down and navigate around.',
      },
      {
        activity: 'walking', isIndoors: false,
        detections: [{ label: 'pavement', confidence: 0.94 }],
        proactiveAlerts: [],
        silenceDecision: { shouldSilence: false, reason: 'No silencing needed', fatigueLevel: 'low' },
        riskPrediction: { predictedRisk: 'none', confidence: 0.93, factors: [], reasoning: 'Clear path confirmed.' },
        companionMessage: 'Clear path. Market area passed. Good progress.',
      },
    ],
  },
  {
    id: 'indoor-corridor',
    label: 'Indoor Corridor',
    icon: '🏛',
    desc: 'Indoor navigation — step and obstacle hazards',
    frames: [
      {
        activity: 'walking', isIndoors: true,
        detections: [{ label: 'step', confidence: 0.65 }, { label: 'pavement', confidence: 0.91 }],
        proactiveAlerts: [{ id: 'pa1', message: 'Elevation change ahead. Slow your pace.', riskLevel: 'medium', confidence: 0.65, anticipatedIn: 4 }],
        silenceDecision: { shouldSilence: false, reason: 'No silencing needed', fatigueLevel: 'none' },
        riskPrediction: { predictedRisk: 'medium', confidence: 0.67, factors: ['Step (65%)'], reasoning: 'Elevation change in corridor.' },
        companionMessage: 'Step detected ahead. Slow down and feel with your cane.',
      },
      {
        activity: 'walking', isIndoors: true,
        detections: [{ label: 'obstacle', confidence: 0.83 }, { label: 'step', confidence: 0.71 }],
        proactiveAlerts: [{ id: 'pa2', message: 'Obstacle ahead — reduce speed.', riskLevel: 'medium', confidence: 0.83, anticipatedIn: 3 }],
        silenceDecision: { shouldSilence: false, reason: 'No silencing needed', fatigueLevel: 'low' },
        riskPrediction: { predictedRisk: 'medium', confidence: 0.78, factors: ['Obstacle (83%)', 'Step confirmed (71%)'], reasoning: 'Step plus obstacle in corridor.' },
        companionMessage: 'Step confirmed plus obstacle ahead. Move carefully.',
      },
      {
        activity: 'stopped', isIndoors: true,
        detections: [{ label: 'obstacle', confidence: 0.88 }],
        proactiveAlerts: [],
        silenceDecision: { shouldSilence: true, reason: 'Alert spoken too recently', fatigueLevel: 'medium' },
        riskPrediction: { predictedRisk: 'medium', confidence: 0.85, factors: ['Obstacle (88%)'], reasoning: 'Object blocking path directly.' },
        companionMessage: 'Stopped — obstacle directly ahead. Silencing to reduce fatigue.',
      },
      {
        activity: 'walking', isIndoors: true,
        detections: [{ label: 'pavement', confidence: 0.92 }],
        proactiveAlerts: [],
        silenceDecision: { shouldSilence: false, reason: 'No silencing needed', fatigueLevel: 'none' },
        riskPrediction: { predictedRisk: 'none', confidence: 0.92, factors: [], reasoning: 'Corridor clear.' },
        companionMessage: 'Corridor is clear. Continue forward.',
      },
    ],
  },
];

// ─── Constant lookup tables ───────────────────────────────────────────────────

const RISK_ORDER: Record<RiskLevel, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
const FATIGUE_ORDER: Record<AlertFatigue, number> = { high: 3, medium: 2, low: 1, none: 0 };
const PRIORITY_ORDER: Record<AudioPriority, number> = { critical: 4, high: 3, normal: 2, low: 1 };

function riskToBadge(r: RiskLevel): 'critical' | 'high' | 'medium' | 'low' | 'success' {
  if (r === 'critical') return 'critical';
  if (r === 'high') return 'high';
  if (r === 'medium') return 'medium';
  if (r === 'low') return 'low';
  return 'success';
}

function urgencyToBadge(u: string): 'critical' | 'high' | 'medium' | 'low' | 'muted' {
  if (u === 'critical') return 'critical';
  if (u === 'high') return 'high';
  if (u === 'medium') return 'medium';
  if (u === 'low') return 'low';
  return 'muted';
}

function delayMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function GuardianPage() {
  const [scenarioId, setScenarioId] = useState('city-crossing');
  const [running, setRunning] = useState(false);
  const [frames, setFrames] = useState<LiveFrame[]>([]);
  const [audioQueue, setAudioQueue] = useState<AudioQueueItem[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(-1);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const scenario = SCENARIOS.find(s => s.id === scenarioId)!;
  const latestFrame = frames[frames.length - 1] ?? null;
  const totalFrames = scenario.frames.length;
  const done = !running && frames.length === totalFrames && frames.length > 0;

  async function startSimulation() {
    setRunning(true);
    setFrames([]);
    setAudioQueue([]);
    setSummary(null);
    setCurrentFrameIdx(-1);

    const wallStart = performance.now();
    const localFrames: LiveFrame[] = [];
    const localQueue: AudioQueueItem[] = [];

    let sessionId = `guardian-v2-${Date.now()}`;
    try {
      const r = await fetch('/api/sessions/start', { method: 'POST' });
      const j = await r.json() as { data?: { sessionId?: string } };
      if (j.data?.sessionId) sessionId = j.data.sessionId;
    } catch { /* use fallback id */ }

    for (let i = 0; i < scenario.frames.length; i++) {
      const spec = scenario.frames[i];
      setCurrentFrameIdx(i);
      const t0 = performance.now();

      let apiAlerts: HazardAlert[] = [];
      let apiDecision: SafetyDecision | null = null;
      let apiAudioText = spec.companionMessage;
      let apiAudioPriority: AudioPriority = 'normal';

      try {
        const hazardRes = await fetch('/api/hazards/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, detections: spec.detections }),
        });
        const hazardJson = await hazardRes.json() as { data?: { alerts?: HazardAlert[] } };
        apiAlerts = hazardJson.data?.alerts ?? [];

        const safetyRes = await fetch('/api/safety/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, alerts: apiAlerts }),
        });
        const safetyJson = await safetyRes.json() as { data?: { decision?: SafetyDecision } };
        apiDecision = safetyJson.data?.decision ?? null;

        if (apiDecision?.shouldAlert && apiDecision.message) {
          apiAudioText = apiDecision.message;
        }
        const urg = apiDecision?.urgency;
        if (urg === 'critical' || urg === 'high') {
          apiAudioPriority = urg;
        }

        if (!spec.silenceDecision.shouldSilence) {
          await fetch('/api/audio/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              text: apiAudioText,
              priority: apiAudioPriority,
              interrupt: apiDecision?.interruptNarration ?? false,
            }),
          }).catch(() => {});
        }
      } catch { /* silently continue simulation */ }

      const frameMs = Math.round(performance.now() - t0);

      if (!spec.silenceDecision.shouldSilence) {
        const qItem: AudioQueueItem = {
          id: `q-f${i}-${Date.now()}`,
          text: apiAudioText,
          priority: apiAudioPriority,
          frameNum: i + 1,
        };
        localQueue.push(qItem);
        localQueue.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
        setAudioQueue([...localQueue]);
      }

      const frame: LiveFrame = { frameNum: i + 1, spec, apiAlerts, apiDecision, apiAudioText, apiAudioPriority, frameMs };
      localFrames.push(frame);
      setFrames([...localFrames]);

      if (i < scenario.frames.length - 1) await delayMs(700);
    }

    try {
      await fetch('/api/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch { /* expected in dev */ }

    const peakRisk = localFrames.reduce<RiskLevel>((best, f) => {
      const r = f.spec.riskPrediction.predictedRisk;
      return RISK_ORDER[r] > RISK_ORDER[best] ? r : best;
    }, 'none');

    const peakFatigue = localFrames.reduce<AlertFatigue>((best, f) => {
      const fl = f.spec.silenceDecision.fatigueLevel;
      return FATIGUE_ORDER[fl] > FATIGUE_ORDER[best] ? fl : best;
    }, 'none');

    setSummary({
      totalFrames: localFrames.length,
      totalApiAlerts: localFrames.reduce((n, f) => n + f.apiAlerts.length, 0),
      silencedFrames: localFrames.filter(f => f.spec.silenceDecision.shouldSilence).length,
      proactiveAlertsFired: localFrames.reduce((n, f) => n + f.spec.proactiveAlerts.length, 0),
      peakRisk,
      peakFatigue,
      totalMs: Math.round(performance.now() - wallStart),
      audioItemsQueued: localQueue.length,
    });

    setCurrentFrameIdx(-1);
    setRunning(false);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-purple-900/30 border border-purple-700/50 rounded-full px-3 py-1 text-purple-300 text-xs font-semibold mb-3">
          V2 Cognitive Guardian
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Guardian Simulation</h1>
        <p className="text-gray-400 max-w-2xl">
          A multi-frame AI safety simulation. Watch the V2 Cognitive Guardian process user state,
          proactive alerts, silence decisions, and risk predictions across a full walking scenario.
        </p>
      </div>

      {/* Scenario picker + launch */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Choose a scenario</CardTitle></CardHeader>
        <div
          role="group"
          aria-label="Scenario selection"
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"
        >
          {SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => { if (!running) { setScenarioId(s.id); setFrames([]); setAudioQueue([]); setSummary(null); } }}
              disabled={running}
              aria-pressed={scenarioId === s.id}
              className={`rounded-xl p-4 text-left border transition-all focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:opacity-50 ${
                scenarioId === s.id
                  ? 'bg-purple-950/50 border-purple-600'
                  : 'bg-gray-900 border-gray-700 hover:border-gray-600'
              }`}
            >
              <p className="text-2xl mb-2" aria-hidden="true">{s.icon}</p>
              <p className="font-bold text-sm text-white">{s.label}</p>
              <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
              <p className="text-xs text-gray-700 mt-1">{s.frames.length} frames</p>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm">
            {running && currentFrameIdx >= 0 && (
              <p className="text-yellow-400 font-semibold animate-pulse">
                ⟳ Frame {currentFrameIdx + 1} of {totalFrames} — {scenario.frames[currentFrameIdx]?.activity}
              </p>
            )}
            {done && summary && (
              <p className="text-green-400 font-semibold">
                ✓ Session complete · {summary.totalMs} ms total
              </p>
            )}
            {!running && frames.length === 0 && (
              <p className="text-gray-500">Select a scenario and start the simulation.</p>
            )}
          </div>
          <Button
            onClick={startSimulation}
            disabled={running}
            size="lg"
            aria-busy={running}
            aria-label={running ? 'Simulation running…' : 'Run guardian simulation'}
          >
            {running ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                Simulating…
              </span>
            ) : frames.length > 0 ? '↺ Run Again' : '▶ Start Guardian Simulation'}
          </Button>
        </div>
      </Card>

      {/* Live dashboard — shown from first frame onward */}
      {latestFrame && (
        <>
          {/* Frame progress bar */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            {scenario.frames.map((f, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs ${
                frames.length > i ? 'text-green-400' : i === currentFrameIdx ? 'text-yellow-400' : 'text-gray-700'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  frames.length > i ? 'bg-green-400' : i === currentFrameIdx ? 'bg-yellow-400 animate-pulse' : 'bg-gray-800'
                }`} />
                <span className="capitalize">{f.activity}</span>
              </div>
            ))}
            <span className="text-gray-700 text-xs ml-auto">{latestFrame.frameMs} ms / frame</span>
          </div>

          {/* 6-panel cognitive grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

            {/* 1. User Context */}
            <Card>
              <CardHeader><CardTitle>👤 User Context</CardTitle></CardHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ActivityCircle activity={latestFrame.spec.activity} />
                  <div>
                    <p className="text-white font-bold capitalize">{latestFrame.spec.activity}</p>
                    <p className="text-gray-500 text-xs">current activity</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-800 rounded-lg p-2.5 text-center">
                    <p className="text-xl" aria-hidden="true">{latestFrame.spec.isIndoors ? '🏛' : '🌳'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{latestFrame.spec.isIndoors ? 'Indoor' : 'Outdoor'}</p>
                  </div>
                  <div className="flex-1 bg-gray-800 rounded-lg p-2.5 text-center">
                    <p className="text-white font-bold text-base">{latestFrame.frameNum} / {totalFrames}</p>
                    <p className="text-xs text-gray-400 mt-0.5">frame</p>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1.5">Detections this frame</p>
                  <div className="flex flex-wrap gap-1">
                    {latestFrame.spec.detections.map((d, i) => (
                      <span key={i} className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-0.5 font-mono">
                        {d.label} {Math.round(d.confidence * 100)}%
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* 2. Proactive Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>⚡ Proactive Alerts</CardTitle>
                {latestFrame.spec.proactiveAlerts.length > 0 && (
                  <span className="text-xs text-yellow-400 font-semibold">{latestFrame.spec.proactiveAlerts.length} active</span>
                )}
              </CardHeader>
              {latestFrame.spec.proactiveAlerts.length === 0 ? (
                <p className="text-gray-600 text-sm">No proactive alerts this frame.</p>
              ) : (
                <div className="space-y-2">
                  {latestFrame.spec.proactiveAlerts.map(a => (
                    <div key={a.id} className="bg-gray-800/60 rounded-lg p-3 border border-gray-700">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant={riskToBadge(a.riskLevel)}>{a.riskLevel}</Badge>
                        <span className="text-xs text-gray-500">~{a.anticipatedIn}s ahead</span>
                        <span className="text-gray-600 text-xs ml-auto">{Math.round(a.confidence * 100)}%</span>
                      </div>
                      <p className="text-gray-200 text-xs leading-relaxed">{a.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 3. Silence Decision */}
            <Card>
              <CardHeader><CardTitle>🔕 Silence Decision</CardTitle></CardHeader>
              <div className="space-y-3">
                <div className={`rounded-lg p-3 border ${
                  latestFrame.spec.silenceDecision.shouldSilence
                    ? 'bg-orange-950/40 border-orange-700/50'
                    : 'bg-green-950/30 border-green-700/40'
                }`}>
                  <p className={`font-bold text-sm ${latestFrame.spec.silenceDecision.shouldSilence ? 'text-orange-300' : 'text-green-300'}`}>
                    {latestFrame.spec.silenceDecision.shouldSilence ? '🔇 Silenced' : '🔊 Speaking'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">{latestFrame.spec.silenceDecision.reason}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-gray-500 text-xs">Alert fatigue</p>
                    <FatigueBadge level={latestFrame.spec.silenceDecision.fatigueLevel} />
                  </div>
                  <FatigueBar level={latestFrame.spec.silenceDecision.fatigueLevel} />
                </div>
              </div>
            </Card>

            {/* 4. Risk Prediction */}
            <Card>
              <CardHeader><CardTitle>🎯 Predicted Risk</CardTitle></CardHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <RiskGauge level={latestFrame.spec.riskPrediction.predictedRisk} />
                  <div>
                    <p className="text-white font-bold text-lg capitalize">{latestFrame.spec.riskPrediction.predictedRisk}</p>
                    <p className="text-gray-500 text-xs">{Math.round(latestFrame.spec.riskPrediction.confidence * 100)}% confidence</p>
                  </div>
                </div>
                {latestFrame.spec.riskPrediction.factors.length > 0 ? (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Factors</p>
                    <ul className="space-y-0.5">
                      {latestFrame.spec.riskPrediction.factors.map((factor, i) => (
                        <li key={i} className="text-gray-400 text-xs flex gap-1.5 items-start">
                          <span className="text-gray-700 mt-px">·</span>{factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-gray-600 text-xs">No contributing risk factors.</p>
                )}
                <p className="text-gray-600 text-xs italic border-t border-gray-800 pt-2">
                  {latestFrame.spec.riskPrediction.reasoning}
                </p>
              </div>
            </Card>

            {/* 5. Audio Priority Queue */}
            <Card>
              <CardHeader>
                <CardTitle>🔊 Audio Queue</CardTitle>
                {audioQueue.length > 0 && (
                  <span className="text-xs text-gray-500">{audioQueue.length} item{audioQueue.length !== 1 ? 's' : ''}</span>
                )}
              </CardHeader>
              {audioQueue.length === 0 ? (
                <p className="text-gray-600 text-sm">No items queued yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {audioQueue.map((item, idx) => (
                    <div key={item.id} className={`rounded-lg p-2.5 border text-xs ${
                      idx === 0 ? 'bg-gray-800 border-gray-600' : 'bg-gray-900/60 border-gray-800 opacity-70'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <PriorityBadge priority={item.priority} />
                        <span className="text-gray-600">f{item.frameNum}</span>
                        {idx === 0 && (
                          <span className="ml-auto text-yellow-400 text-xs font-semibold">▶ next</span>
                        )}
                      </div>
                      <p className="text-gray-300 leading-snug">
                        &ldquo;{item.text.length > 72 ? item.text.slice(0, 72) + '…' : item.text}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 6. Companion Message */}
            <Card>
              <CardHeader><CardTitle>💬 Companion</CardTitle></CardHeader>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 min-h-[72px] flex items-center mb-3">
                <p className="text-gray-100 text-sm leading-relaxed">{latestFrame.spec.companionMessage}</p>
              </div>
              {latestFrame.apiDecision && (
                <div>
                  <p className="text-gray-600 text-xs mb-1.5">Live API safety decision</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={latestFrame.apiDecision.shouldAlert ? urgencyToBadge(latestFrame.apiDecision.urgency) : 'success'}>
                      {latestFrame.apiDecision.shouldAlert ? `Alert · ${latestFrame.apiDecision.urgency}` : 'No alert'}
                    </Badge>
                    {latestFrame.apiDecision.interruptNarration && (
                      <Badge variant="high">Interrupts narration</Badge>
                    )}
                    <span className="text-gray-600 text-xs ml-auto">
                      {Math.round(latestFrame.apiDecision.confidence * 100)}% conf
                    </span>
                  </div>
                  {latestFrame.apiDecision.message && (
                    <p className="text-gray-400 text-xs mt-1.5 italic">&ldquo;{latestFrame.apiDecision.message}&rdquo;</p>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Live API hazard alerts */}
          {latestFrame.apiAlerts.length > 0 && (
            <Card className="mb-6 border-gray-700">
              <CardHeader>
                <CardTitle>⚠ Hazard Alerts — Live API</CardTitle>
                <span className="text-xs text-gray-500">HazardDetectionEngine · /api/hazards/evaluate</span>
              </CardHeader>
              <div className="space-y-2">
                {latestFrame.apiAlerts.map(a => (
                  <div key={a.id} className="flex items-start gap-3 py-1.5 border-b border-gray-800 last:border-0">
                    <Badge variant={urgencyToBadge(a.severity)}>{a.severity}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 text-sm">{a.description}</p>
                      <p className="text-gray-600 text-xs mt-0.5">
                        {Math.round(a.confidence * 100)}% confidence · {a.type} · {a.shouldInterrupt ? 'interrupts narration' : 'background'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Session Summary */}
      {summary && (
        <Card className="mb-6 border-purple-700/40 bg-purple-950/20">
          <CardHeader>
            <CardTitle>📊 Session Summary</CardTitle>
            <span className="text-xs text-purple-400">{summary.totalMs} ms total</span>
          </CardHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <SummaryTile label="Frames" value={String(summary.totalFrames)} />
            <SummaryTile label="API alerts" value={String(summary.totalApiAlerts)} />
            <SummaryTile label="Silenced frames" value={String(summary.silencedFrames)} />
            <SummaryTile label="Proactive alerts" value={String(summary.proactiveAlertsFired)} />
            <SummaryTile label="Peak risk" value={summary.peakRisk} accent />
            <SummaryTile label="Peak fatigue" value={summary.peakFatigue} />
            <SummaryTile label="Audio queued" value={String(summary.audioItemsQueued)} />
            <SummaryTile label="Total time" value={`${summary.totalMs} ms`} />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={riskToBadge(summary.peakRisk)}>Peak risk: {summary.peakRisk}</Badge>
            <Badge variant={summary.silencedFrames > 0 ? 'medium' : 'success'}>
              {summary.silencedFrames} frame{summary.silencedFrames !== 1 ? 's' : ''} silenced
            </Badge>
            <Badge variant="info">{summary.proactiveAlertsFired} proactive alerts</Badge>
          </div>
        </Card>
      )}

      {/* How it works — shown before first run */}
      {!latestFrame && (
        <Card className="border-gray-800">
          <CardHeader><CardTitle>How the V2 Cognitive Guardian works</CardTitle></CardHeader>
          <div className="text-gray-400 text-sm space-y-2.5 leading-relaxed">
            <p>
              The <strong className="text-white">Cognitive Guardian</strong> is a meta-AI layer above the
              V1 hazard detection pipeline. It decides <em className="text-gray-300">when, whether, and how urgently</em> to
              alert the user — preventing alert fatigue while ensuring nothing critical is missed.
            </p>
            <p>
              <strong className="text-white">ProactiveAlertEngine</strong> fires early warnings before hazards
              become critical. <strong className="text-white">SilenceDecisionEngine</strong> measures alert
              fatigue and suppresses redundant audio. <strong className="text-white">PredictiveRiskEngine</strong> forecasts
              near-future risk from detection trends.
            </p>
            <p>
              Each simulation frame calls the live <strong className="text-white">/api/hazards/evaluate</strong> and{' '}
              <strong className="text-white">/api/safety/decide</strong> APIs, layering V2 cognitive decisions
              on top in real time.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: '👤', label: 'User Context', desc: 'Activity, environment, session state' },
              { icon: '⚡', label: 'Proactive Alerts', desc: 'Fires before hazards become critical' },
              { icon: '🔕', label: 'Silence Decision', desc: 'Alert fatigue detection & suppression' },
              { icon: '🎯', label: 'Risk Prediction', desc: 'Near-future risk forecast' },
              { icon: '🔊', label: 'Audio Queue', desc: 'Priority-sorted speech output' },
              { icon: '💬', label: 'Companion', desc: 'Contextual guidance messages' },
            ].map(item => (
              <div key={item.label} className="bg-gray-800/40 rounded-lg p-3 border border-gray-800">
                <p className="text-lg mb-1" aria-hidden="true">{item.icon}</p>
                <p className="text-white text-sm font-semibold">{item.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActivityCircle({ activity }: { activity: UserActivity }) {
  const map: Record<UserActivity, { icon: string; color: string }> = {
    walking: { icon: '🚶', color: 'border-green-600' },
    stopped: { icon: '⏸', color: 'border-yellow-600' },
    crossing: { icon: '🚦', color: 'border-red-600' },
    turning: { icon: '↩', color: 'border-blue-600' },
  };
  const { icon, color } = map[activity];
  return (
    <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-xl shrink-0 bg-gray-800 ${color}`}>
      {icon}
    </div>
  );
}

function FatigueBadge({ level }: { level: AlertFatigue }) {
  const classes: Record<AlertFatigue, string> = {
    none: 'bg-green-900/50 text-green-300',
    low: 'bg-blue-900/50 text-blue-300',
    medium: 'bg-yellow-900/50 text-yellow-300',
    high: 'bg-red-900/50 text-red-300',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${classes[level]}`}>
      {level}
    </span>
  );
}

function FatigueBar({ level }: { level: AlertFatigue }) {
  const widths: Record<AlertFatigue, string> = { none: 'w-0', low: 'w-1/4', medium: 'w-2/4', high: 'w-full' };
  const colors: Record<AlertFatigue, string> = { none: 'bg-gray-600', low: 'bg-blue-500', medium: 'bg-yellow-500', high: 'bg-red-500' };
  return (
    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${widths[level]} ${colors[level]}`} />
    </div>
  );
}

function RiskGauge({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, { border: string; text: string; icon: string }> = {
    critical: { border: 'border-red-500', text: 'text-red-400', icon: '🔴' },
    high:     { border: 'border-orange-500', text: 'text-orange-400', icon: '🟠' },
    medium:   { border: 'border-yellow-500', text: 'text-yellow-400', icon: '🟡' },
    low:      { border: 'border-blue-500', text: 'text-blue-400', icon: '🔵' },
    none:     { border: 'border-green-500', text: 'text-green-400', icon: '🟢' },
  };
  const { border, text, icon } = map[level];
  return (
    <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-2xl shrink-0 ${border} ${text}`}>
      {icon}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: AudioPriority }) {
  const classes: Record<AudioPriority, string> = {
    critical: 'bg-red-900/70 text-red-300',
    high: 'bg-orange-900/70 text-orange-300',
    normal: 'bg-gray-800 text-gray-400',
    low: 'bg-gray-800 text-gray-600',
  };
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded capitalize ${classes[priority]}`}>
      {priority}
    </span>
  );
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-gray-900/70 rounded-lg p-3 border border-gray-800">
      <p className={`text-lg font-black capitalize ${accent ? 'text-yellow-400' : 'text-white'}`}>{value}</p>
      <p className="text-gray-600 text-xs mt-0.5">{label}</p>
    </div>
  );
}

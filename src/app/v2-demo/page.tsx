'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAudioGuidance } from '@/hooks/useAudioGuidance';
import type { GuardianDecision, UserState, PredictedRisk } from '@/types/cognitive';

// ─── Simulation data ──────────────────────────────────────────────────────────

const SIM_CYCLES = [
  { label: 'Pavement walk', detections: [{ label: 'pavement', confidence: 0.93 }, { label: 'person', confidence: 0.82 }], source: 'outdoor' },
  { label: 'Step ahead', detections: [{ label: 'step', confidence: 0.68 }, { label: 'pavement', confidence: 0.91 }], source: 'outdoor' },
  { label: 'Vehicle on road', detections: [{ label: 'vehicle', confidence: 0.94 }, { label: 'road', confidence: 0.97 }], source: 'outdoor' },
  { label: 'Safe indoor', detections: [{ label: 'table', confidence: 0.91 }, { label: 'chair', confidence: 0.87 }], source: 'indoor' },
  { label: 'Door entrance', detections: [{ label: 'door', confidence: 0.88 }, { label: 'stairs', confidence: 0.62 }], source: 'indoor' },
  { label: 'Bicycle nearby', detections: [{ label: 'bicycle', confidence: 0.74 }, { label: 'pavement', confidence: 0.89 }], source: 'outdoor' },
  { label: 'Road crossing', detections: [{ label: 'vehicle', confidence: 0.61 }, { label: 'road', confidence: 0.95 }], source: 'outdoor' },
];

interface V2State {
  isActive: boolean;
  cycleIndex: number;
  frameCount: number;
  currentLabel: string;
  decision: GuardianDecision | null;
  log: string[];
  error: string | null;
}

const ACTION_BADGE: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'muted' | 'success' | 'info'> = {
  warn: 'critical',
  guide: 'high',
  companion: 'info',
  acknowledge: 'success',
  silent: 'muted',
};

const ACTION_ICON: Record<string, string> = {
  warn: '⚠',
  guide: '🧭',
  companion: '💬',
  acknowledge: '✓',
  silent: '—',
};

const HORIZON_BADGE: Record<string, 'critical' | 'high' | 'medium'> = {
  immediate: 'critical',
  near: 'high',
  potential: 'medium',
};

function riskCard(risk: PredictedRisk, i: number) {
  return (
    <div key={i} className="rounded-lg border border-gray-700 bg-gray-800 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Badge variant={HORIZON_BADGE[risk.horizon] ?? 'muted'}>{risk.horizon}</Badge>
        <Badge variant={risk.severity === 'critical' ? 'critical' : risk.severity === 'high' ? 'high' : 'medium'}>
          {risk.severity}
        </Badge>
        <span className="text-gray-400 text-xs ml-auto">{Math.round(risk.likelihood * 100)}%</span>
      </div>
      <p className="text-white text-sm">{risk.description}</p>
      <p className="text-yellow-400 text-xs mt-1">→ {risk.actionHint}</p>
    </div>
  );
}

export default function V2DemoPage() {
  const { speak, stop } = useAudioGuidance();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [s, setS] = useState<V2State>({
    isActive: false,
    cycleIndex: 0,
    frameCount: 0,
    currentLabel: '',
    decision: null,
    log: [],
    error: null,
  });

  const addLog = useCallback((msg: string) => {
    setS((prev) => ({
      ...prev,
      log: [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.log].slice(0, 60),
    }));
  }, []);

  const runCycle = useCallback(async (cycleIndex: number) => {
    const cycle = SIM_CYCLES[cycleIndex % SIM_CYCLES.length];

    try {
      // Analyze frame
      const visionRes = await fetch('/api/vision/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'v2-demo', source: 'simulation' }),
      });
      await visionRes.json();

      // Get hazards
      const hazardRes = await fetch('/api/hazards/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'v2-demo', detections: cycle.detections }),
      });
      const { data: hazardData } = await hazardRes.json();
      const alerts = hazardData.alerts ?? [];

      // V2 cognitive guardian
      const guardianRes = await fetch('/api/v2/cognitive-guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'v2-demo',
          detections: cycle.detections,
          alerts,
          sceneLabel: cycle.label,
        }),
      });
      const { data: guardianData } = await guardianRes.json();
      const decision: GuardianDecision = guardianData.decision;

      setS((prev) => ({
        ...prev,
        frameCount: prev.frameCount + 1,
        cycleIndex: (cycleIndex + 1) % SIM_CYCLES.length,
        currentLabel: cycle.label,
        decision,
      }));

      addLog(`[${cycle.label}] Guardian: ${decision.action.toUpperCase()} — ${decision.message || '(silent)'}`);

      if (decision.action !== 'silent' && decision.message) {
        speak(decision.message, decision.priority === 'critical' ? 'critical' : decision.priority === 'high' ? 'high' : 'normal', decision.interrupt);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setS((prev) => ({ ...prev, error: msg }));
    }
  }, [speak, addLog]);

  const start = useCallback(() => {
    setS((prev) => ({ ...prev, isActive: true, frameCount: 0, log: [], decision: null, error: null, cycleIndex: 0 }));
    speak('Cognitive Guardian V2 activated. Monitoring your environment.', 'high', true);
    intervalRef.current = setInterval(() => {
      setS((prev) => {
        runCycle(prev.cycleIndex);
        return prev;
      });
    }, 3500);
    runCycle(0);
  }, [speak, runCycle]);

  const stopSession = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    stop();
    setS((prev) => ({ ...prev, isActive: false }));
  }, [stop]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const decision = s.decision;
  const userState: UserState | null = decision?.userState ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-purple-900/40 border border-purple-700 rounded-full px-3 py-1 text-purple-300 text-xs font-bold mb-2">
            V2 — Cognitive Guardian
          </div>
          <h1 className="text-3xl font-black text-white">Proactive Guardian Demo</h1>
          <p className="text-gray-400 text-sm mt-1">
            The system watches, thinks, and speaks only when it matters.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={start} disabled={s.isActive} size="md">▶ Start</Button>
          <Button onClick={stopSession} disabled={!s.isActive} variant="danger" size="md">■ Stop</Button>
        </div>
      </div>

      {s.error && (
        <div className="bg-red-950 border border-red-700 text-red-200 rounded-xl p-3 mb-4 text-sm" role="alert">
          {s.error}
        </div>
      )}

      {/* Status bar */}
      <div className="flex gap-3 items-center mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${s.isActive ? 'bg-purple-400 animate-pulse' : 'bg-gray-600'}`} aria-hidden="true" />
          <span className="text-gray-300 text-sm">{s.isActive ? 'Monitoring' : 'Stopped'}</span>
        </div>
        <Badge variant="muted">{s.frameCount} frames</Badge>
        {s.currentLabel && <Badge variant="info">{s.currentLabel}</Badge>}
        {userState && (
          <>
            <Badge variant={userState.isAtRisk ? 'high' : 'success'}>{userState.movement}</Badge>
            <Badge variant="muted">{userState.environment}</Badge>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Guardian decision */}
        <Card
          className={decision?.action === 'warn' ? 'border-red-500' : decision?.action === 'guide' ? 'border-yellow-600' : ''}
          aria-live="assertive"
          role="region"
          aria-label="Guardian decision"
        >
          <CardHeader>
            <CardTitle>🧠 Guardian Decision</CardTitle>
            {decision && (
              <Badge variant={ACTION_BADGE[decision.action] ?? 'muted'}>
                {ACTION_ICON[decision.action]} {decision.action}
              </Badge>
            )}
          </CardHeader>

          {!decision ? (
            <p className="text-gray-500 text-sm">Start the session to begin monitoring.</p>
          ) : (
            <div className="space-y-3">
              {decision.action !== 'silent' && decision.message ? (
                <div className={`rounded-lg p-3 border ${
                  decision.action === 'warn' ? 'bg-red-900/40 border-red-700' :
                  decision.action === 'guide' ? 'bg-yellow-900/30 border-yellow-700' :
                  'bg-gray-800 border-gray-600'
                }`}>
                  <p className="text-white font-semibold text-sm leading-snug">{decision.message}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm italic">Silent — no useful information to convey right now.</p>
              )}

              <div className="text-xs text-gray-500 space-y-0.5">
                <p>Reasoning: <span className="text-gray-400">{decision.reasoning}</span></p>
                <p>Confidence: {Math.round(decision.confidence * 100)}%
                  {decision.interrupt && <span className="text-red-400 ml-2">⚡ Interrupts</span>}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Silence decision */}
        <Card role="region" aria-label="Silence decision">
          <CardHeader>
            <CardTitle>🔇 Silence Engine</CardTitle>
            {decision && (
              <Badge variant={decision.silenceDecision.shouldBeSilent ? 'muted' : 'success'}>
                {decision.silenceDecision.shouldBeSilent ? 'Silent' : 'Speaking'}
              </Badge>
            )}
          </CardHeader>
          {!decision ? (
            <p className="text-gray-500 text-sm">Waiting for session…</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className={`rounded-lg p-3 border ${decision.silenceDecision.shouldBeSilent ? 'bg-gray-800 border-gray-600' : 'bg-green-900/20 border-green-700'}`}>
                {decision.silenceDecision.shouldBeSilent ? (
                  <p className="text-gray-400">Reason: <strong className="text-white">{decision.silenceDecision.reason ?? 'none'}</strong></p>
                ) : (
                  <p className="text-green-400">Speaking is appropriate right now.</p>
                )}
                {decision.silenceDecision.cooldownRemainingMs > 0 && (
                  <p className="text-gray-500 text-xs mt-1">Cooldown: {Math.round(decision.silenceDecision.cooldownRemainingMs / 1000)}s remaining</p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Predicted risks */}
        <Card role="region" aria-label="Predicted risks" aria-live="polite">
          <CardHeader>
            <CardTitle>🔮 Predicted Risks</CardTitle>
            {decision && (
              <Badge variant={decision.predictedRisks.length > 0 ? 'high' : 'success'}>
                {decision.predictedRisks.length} risks
              </Badge>
            )}
          </CardHeader>
          {!decision || decision.predictedRisks.length === 0 ? (
            <p className="text-green-400 text-sm">✓ No predicted risks for this scene.</p>
          ) : (
            <div className="space-y-2">
              {decision.predictedRisks.map((r, i) => riskCard(r, i))}
            </div>
          )}
        </Card>

        {/* User state */}
        <Card role="region" aria-label="User state">
          <CardHeader>
            <CardTitle>👤 User State</CardTitle>
            {userState && (
              <Badge variant={userState.isAtRisk ? 'critical' : 'success'}>
                {userState.isAtRisk ? 'At Risk' : 'Safe'}
              </Badge>
            )}
          </CardHeader>
          {!userState ? (
            <p className="text-gray-500 text-sm">State will appear once session starts.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: 'Movement', value: userState.movement },
                { label: 'Environment', value: userState.environment },
                { label: 'Speed', value: userState.speed },
                { label: 'Confidence', value: `${Math.round(userState.confidence * 100)}%` },
              ].map((row) => (
                <div key={row.label} className="bg-gray-800 rounded-lg p-2">
                  <p className="text-gray-500 text-xs">{row.label}</p>
                  <p className="text-white font-semibold">{row.value}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Guardian log */}
      <Card role="log" aria-live="polite" aria-label="Guardian activity log">
        <CardHeader>
          <CardTitle>📋 Guardian Log</CardTitle>
        </CardHeader>
        {s.log.length === 0 ? (
          <p className="text-gray-500 text-sm">No activity yet.</p>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
            {s.log.map((entry, i) => (
              <li key={i} className={`leading-tight ${
                entry.includes('WARN') ? 'text-red-300' :
                entry.includes('GUIDE') ? 'text-yellow-300' :
                entry.includes('COMPANION') ? 'text-blue-300' :
                entry.includes('SILENT') ? 'text-gray-500' :
                'text-gray-300'
              }`}>
                {entry}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* V2 info */}
      <Card className="mt-4 border-purple-800">
        <CardHeader><CardTitle>How the Cognitive Guardian Works</CardTitle></CardHeader>
        <div className="text-gray-400 text-sm space-y-2">
          <p>Every 3.5 seconds, the Guardian answers all seven questions before deciding whether to speak:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-500">
            <li className="text-gray-300">Is the user safe? <span className="text-gray-500">(UserState inference)</span></li>
            <li>Should the AI stay silent? <span className="text-gray-500">(SilenceDecisionEngine)</span></li>
            <li>Should the AI warn immediately? <span className="text-gray-500">(ProactiveAlertEngine)</span></li>
            <li>Should the AI guide gently? <span className="text-gray-500">(PredictiveRiskEngine)</span></li>
            <li>Should the AI provide companionship? <span className="text-gray-500">(CompanionContextEngine)</span></li>
            <li>What matters right now? <span className="text-gray-500">(CognitiveGuardianEngine)</span></li>
            <li>What might happen next? <span className="text-gray-500">(PredictiveRiskEngine horizon)</span></li>
          </ol>
        </div>
      </Card>
    </div>
  );
}

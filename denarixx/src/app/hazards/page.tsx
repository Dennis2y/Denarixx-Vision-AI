'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { HazardAlert } from '@/types';

const EXAMPLE_SCENARIOS = [
  {
    label: 'Vehicle approaching',
    icon: '🚗',
    detections: [
      { label: 'vehicle', confidence: 0.94 },
      { label: 'road', confidence: 0.97 },
    ],
  },
  {
    label: 'Step / curb ahead',
    icon: '🪜',
    detections: [
      { label: 'step', confidence: 0.65 },
      { label: 'pavement', confidence: 0.93 },
    ],
  },
  {
    label: 'Person crossing',
    icon: '🚶',
    detections: [
      { label: 'person', confidence: 0.79 },
      { label: 'bicycle', confidence: 0.71 },
    ],
  },
  {
    label: 'Obstacle in path',
    icon: '🚧',
    detections: [
      { label: 'obstacle', confidence: 0.88 },
    ],
  },
];

const SEVERITY_LEVELS: readonly string[] = ['critical', 'high', 'medium', 'low'];
type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
const severityBadge = (s: string): SeverityLevel | 'muted' =>
  SEVERITY_LEVELS.includes(s) ? (s as SeverityLevel) : 'muted';

export default function HazardsPage() {
  const [alerts, setAlerts] = useState<HazardAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeScenario, setActiveScenario] = useState('');
  const [activeDetections, setActiveDetections] = useState<{ label: string; confidence: number }[]>([]);

  async function runScenario(scenario: (typeof EXAMPLE_SCENARIOS)[0]) {
    setLoading(true);
    setActiveScenario(scenario.label);
    setActiveDetections(scenario.detections);
    try {
      const res = await fetch('/api/hazards/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'demo', detections: scenario.detections }),
      });
      const { data } = await res.json();
      setAlerts(data.alerts ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-2">Hazard Intelligence</h1>
        <p className="text-gray-400 max-w-2xl">
          The <strong className="text-white">HazardDetectionEngine</strong> evaluates object
          detections and returns prioritized alerts with confidence scores. Run a scenario to
          see the live output.
        </p>
      </div>

      {/* Scenario picker */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {EXAMPLE_SCENARIOS.map((s) => (
          <button
            key={s.label}
            onClick={() => runScenario(s)}
            disabled={loading}
            aria-pressed={activeScenario === s.label}
            className={`rounded-xl p-4 text-left border transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50 ${
              activeScenario === s.label
                ? 'bg-yellow-950/40 border-yellow-600 text-white'
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            <p className="text-2xl mb-2" aria-hidden="true">{s.icon}</p>
            <p className="font-semibold text-sm">{s.label}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {s.detections.map((d, i) => (
                <span key={i} className="text-xs text-gray-500 font-mono">
                  {d.label} {Math.round(d.confidence * 100)}%
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Status */}
      {activeScenario && (
        <div className="flex items-center gap-3 mb-5">
          <p className="text-gray-400 text-sm">
            Scenario: <strong className="text-white">{activeScenario}</strong>
          </p>
          {loading && (
            <span className="flex items-center gap-1.5 text-yellow-400 text-sm">
              <span className="w-3 h-3 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" aria-hidden="true" />
              Evaluating…
            </span>
          )}
        </div>
      )}

      {/* Active detections passed to engine */}
      {activeDetections.length > 0 && !loading && (
        <div className="mb-5">
          <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">Input detections</p>
          <div className="flex gap-2 flex-wrap">
            {activeDetections.map((d, i) => (
              <span
                key={i}
                className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 font-mono"
              >
                {d.label}
                <span className="text-gray-500 ml-1">{Math.round(d.confidence * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {!activeScenario && !loading && (
        <Card className="mb-6">
          <p className="text-gray-500 text-sm">Select a scenario above to see hazard evaluation results.</p>
        </Card>
      )}

      {activeScenario && !loading && alerts.length === 0 && (
        <Card className="mb-6 border-green-700/50 bg-green-950/20">
          <p className="text-green-400 font-semibold">✓ No hazards detected for this scenario.</p>
          <p className="text-gray-500 text-xs mt-1">The engine found no safety-critical objects in the detected set.</p>
        </Card>
      )}

      {alerts.length > 0 && (
        <div className="space-y-3 mb-8" role="list" aria-label="Hazard alerts" aria-live="polite">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              role="listitem"
              aria-label={`${alert.severity} hazard: ${alert.description}`}
              className={
                alert.severity === 'critical'
                  ? 'border-red-700/70 bg-red-950/30'
                  : alert.severity === 'high'
                  ? 'border-orange-700/50 bg-orange-950/20'
                  : ''
              }
            >
              <div className="flex items-start gap-3">
                <Badge variant={severityBadge(alert.severity)} className="mt-0.5 shrink-0">
                  {alert.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold">{alert.description}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5">
                    <span className="text-gray-400 text-xs">Type: <span className="text-gray-300">{alert.type}</span></span>
                    <span className="text-gray-400 text-xs">Confidence: <span className="text-gray-300">{Math.round(alert.confidence * 100)}%</span></span>
                    <span className={`text-xs font-semibold ${alert.shouldInterrupt ? 'text-orange-400' : 'text-gray-500'}`}>
                      {alert.shouldInterrupt ? '⚠ Interrupts narration' : 'Background alert'}
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs mt-1.5 italic">{alert.disclaimer}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                    style={{
                      borderColor:
                        alert.severity === 'critical' ? '#ef4444'
                          : alert.severity === 'high' ? '#f97316'
                          : '#eab308',
                      color:
                        alert.severity === 'critical' ? '#fca5a5'
                          : alert.severity === 'high' ? '#fdba74'
                          : '#fde68a',
                    }}
                    aria-label={`${Math.round(alert.confidence * 100)}% confidence`}
                  >
                    {Math.round(alert.confidence * 100)}%
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* How it works */}
      <Card className="border-gray-700">
        <CardHeader>
          <CardTitle>How the Hazard Engine works</CardTitle>
        </CardHeader>
        <div className="text-gray-400 text-sm space-y-2 leading-relaxed">
          <p>
            The <strong className="text-white">HazardDetectionEngine</strong> evaluates each
            detected object against a severity matrix. Every alert includes a{' '}
            <strong className="text-white">confidence score</strong> — scores below 60% trigger
            an explicit uncertainty message so users always know when the AI is unsure.
          </p>
          <p>
            Alerts flow into the <strong className="text-white">SafetyDecisionEngine</strong>{' '}
            (the Cognitive Guardian), which decides whether to interrupt ongoing narration
            based on urgency and confidence thresholds. See the{' '}
            <a href="/guardian" className="text-yellow-400 underline hover:text-yellow-300">
              Cognitive Guardian demo
            </a>{' '}
            for the full pipeline.
          </p>
        </div>
      </Card>
    </div>
  );
}

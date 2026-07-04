'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { HazardAlert } from '@/types';

const EXAMPLE_SCENARIOS = [
  {
    label: 'Vehicle nearby',
    detections: [
      { label: 'vehicle', confidence: 0.94 },
      { label: 'road', confidence: 0.97 },
    ],
  },
  {
    label: 'Step ahead',
    detections: [
      { label: 'step', confidence: 0.65 },
      { label: 'pavement', confidence: 0.93 },
    ],
  },
  {
    label: 'Person crossing',
    detections: [
      { label: 'person', confidence: 0.79 },
      { label: 'bicycle', confidence: 0.71 },
    ],
  },
  {
    label: 'Obstacle in path',
    detections: [
      { label: 'obstacle', confidence: 0.88 },
    ],
  },
];

export default function HazardsPage() {
  const [alerts, setAlerts] = useState<HazardAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [scenarioLabel, setScenarioLabel] = useState('');

  async function runScenario(scenario: (typeof EXAMPLE_SCENARIOS)[0]) {
    setLoading(true);
    setScenarioLabel(scenario.label);
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

  const SEVERITY_LEVELS: readonly string[] = ['critical', 'high', 'medium', 'low'];
  type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
  const severityBadge = (s: string): SeverityLevel | 'muted' =>
    SEVERITY_LEVELS.includes(s) ? (s as SeverityLevel) : 'muted';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-white mb-2">Hazard Intelligence</h1>
      <p className="text-gray-400 mb-8 text-sm">
        The Hazard Detection Engine evaluates detected objects and returns prioritised
        alerts with confidence scores. Test example scenarios below.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {EXAMPLE_SCENARIOS.map((s) => (
          <Button
            key={s.label}
            onClick={() => runScenario(s)}
            disabled={loading}
            variant="outline"
            size="md"
            aria-label={`Simulate: ${s.label}`}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {scenarioLabel && (
        <p className="text-gray-400 text-sm mb-4">
          Scenario: <strong className="text-white">{scenarioLabel}</strong>
          {loading && ' — processing…'}
        </p>
      )}

      {alerts.length === 0 && !loading && !scenarioLabel && (
        <Card>
          <p className="text-gray-500 text-sm">Run a scenario above to see hazard alerts.</p>
        </Card>
      )}

      {alerts.length === 0 && scenarioLabel && !loading && (
        <Card>
          <p className="text-green-400 text-sm">✓ No hazards detected for this scenario.</p>
        </Card>
      )}

      <div className="space-y-3" role="list" aria-label="Hazard alerts" aria-live="polite">
        {alerts.map((alert) => (
          <Card key={alert.id} role="listitem" aria-label={`${alert.severity} hazard: ${alert.description}`}>
            <div className="flex items-start gap-3">
              <Badge variant={severityBadge(alert.severity)} className="mt-0.5 shrink-0">
                {alert.severity}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold">{alert.description}</p>
                <p className="text-gray-400 text-xs mt-1">
                  Type: {alert.type} · Confidence: {Math.round(alert.confidence * 100)}% ·{' '}
                  {alert.shouldInterrupt ? 'Interrupts narration' : 'Background alert'}
                </p>
                <p className="text-gray-500 text-xs mt-1">{alert.disclaimer}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 border-gray-700">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <div className="text-gray-400 text-sm space-y-2">
          <p>
            The <strong className="text-white">Hazard Detection Engine</strong> runs on the
            local tier — designed to be fast and high-recall for safety-critical categories.
          </p>
          <p>
            Every alert includes a <strong className="text-white">confidence score</strong>.
            Scores below 60% trigger an explicit uncertainty message: &quot;I&apos;m not fully sure.
            Please check carefully.&quot;
          </p>
          <p>
            The <strong className="text-white">Safety Decision Engine</strong> then decides
            whether to interrupt ongoing narration based on severity and confidence thresholds.
          </p>
        </div>
      </Card>
    </div>
  );
}

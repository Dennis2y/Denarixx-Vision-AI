'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { HazardAlert, SafetyDecision } from '@/types';

interface HazardPanelProps {
  alerts: HazardAlert[];
  decision: SafetyDecision | null;
}

const severityBadge = (s: string) => {
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'medium') return 'medium';
  return 'low';
};

export function HazardPanel({ alerts, decision }: HazardPanelProps) {
  const hasAlert = decision?.shouldAlert;

  return (
    <Card
      className={hasAlert ? 'border-red-500 bg-red-950' : ''}
      role="region"
      aria-label="Hazard alerts"
      aria-live="assertive"
      aria-atomic="true"
    >
      <CardHeader>
        <CardTitle className={hasAlert ? 'text-red-300' : ''}>
          ⚠ Hazard Alerts
        </CardTitle>
        {hasAlert && (
          <Badge variant={severityBadge(decision?.urgency ?? 'low')}>
            {decision?.urgency}
          </Badge>
        )}
      </CardHeader>

      {!hasAlert && (
        <p className="text-green-400 text-sm" aria-live="polite">
          ✓ No hazards detected right now.
        </p>
      )}

      {hasAlert && decision && (
        <div className="mb-3 rounded-lg bg-red-900/60 p-3 border border-red-700">
          <p className="text-red-200 font-semibold text-base leading-snug">
            {decision.message}
          </p>
          <p className="text-red-400 text-xs mt-1">
            Confidence: {Math.round(decision.confidence * 100)}%
          </p>
        </div>
      )}

      {alerts.length > 0 && (
        <ul className="space-y-2" role="list" aria-label="Individual hazard items">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-2 text-sm"
              role="listitem"
            >
              <Badge variant={severityBadge(a.severity)} className="mt-0.5 shrink-0">
                {a.severity}
              </Badge>
              <span className="text-gray-200">{a.description}</span>
              <span className="ml-auto text-gray-400 text-xs shrink-0">
                {Math.round(a.confidence * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-gray-500 text-xs">
        Assistive support only — does not guarantee safety.
      </p>
    </Card>
  );
}

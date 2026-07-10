'use client';

import type { SessionReport } from '@/hooks/useVisionSession';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const STEP_LABELS = [
  'Session started',
  'Walking simulated',
  'Safety alert triggered',
  'Guardian decided',
  'Audio guidance spoken',
  'Memory event saved',
  'Report generated',
];

const urgencyVariant = (u: string) => {
  if (u === 'critical') return 'critical';
  if (u === 'high') return 'high';
  if (u === 'medium') return 'medium';
  if (u === 'low') return 'low';
  return 'muted';
};

interface SessionReportProps {
  report: SessionReport;
  onNewSession: () => void;
}

export function SessionReportPanel({ report, onNewSession }: SessionReportProps) {
  const stepsCompleted = report.completedSteps.filter(Boolean).length;
  const mins = Math.floor(report.durationSeconds / 60);
  const secs = report.durationSeconds % 60;
  const durationLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div
      className="rounded-xl border border-green-700/50 bg-green-950/20 p-6"
      role="region"
      aria-label="Session report"
    >
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl" aria-hidden="true">📊</span>
        <div>
          <h2 className="text-xl font-black text-white">Session Report</h2>
          <p className="text-gray-400 text-sm">
            Session ID: <span className="font-mono text-xs text-gray-500">{report.sessionId.slice(0, 8)}…</span>
          </p>
        </div>
        <div className="ml-auto">
          <Badge variant="success">Complete</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Duration', value: durationLabel },
          { label: 'Frames analyzed', value: report.frameCount.toString() },
          { label: 'Hazard alerts', value: report.alertCount.toString() },
          { label: 'Audio events', value: report.audioCount.toString() },
        ].map((m) => (
          <div
            key={m.label}
            className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-center"
          >
            <p className="text-2xl font-black text-white">{m.value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-5">
        <span className="text-gray-400 text-sm">Peak urgency:</span>
        <Badge variant={urgencyVariant(report.peakUrgency)}>
          {report.peakUrgency === 'none' ? 'No alerts' : report.peakUrgency}
        </Badge>
        <span className="ml-auto text-gray-400 text-sm">
          {stepsCompleted}/7 demo steps completed
        </span>
      </div>

      <div className="space-y-1.5 mb-6" role="list" aria-label="Completed demo steps">
        {STEP_LABELS.map((label, i) => {
          const done = report.completedSteps[i];
          return (
            <div
              key={i}
              className="flex items-center gap-2 text-sm"
              role="listitem"
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  done ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-600'
                }`}
                aria-hidden="true"
              >
                {done ? '✓' : '○'}
              </span>
              <span className={done ? 'text-gray-300' : 'text-gray-600'}>
                Step {i + 1}: {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button onClick={onNewSession} size="md">
          ▶ Start New Session
        </Button>
        <Button variant="outline" size="md" onClick={() => window.location.href = '/memory'}>
          View Memory →
        </Button>
      </div>

      <p className="text-gray-600 text-xs mt-4">
        Assistive support only — not medically certified. All data is in-session memory only; cleared on server restart.
      </p>
    </div>
  );
}

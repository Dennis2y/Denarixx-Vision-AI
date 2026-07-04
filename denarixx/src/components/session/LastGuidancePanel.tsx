'use client';

/**
 * LastGuidancePanel (V5)
 *
 * Shows the most recently spoken guidance with context:
 *   - text (what was said)
 *   - risk level badge
 *   - confidence bar
 *   - reason (why it was spoken)
 *   - timestamp
 * Includes a Repeat button that re-speaks the guidance.
 */

import type { GuidanceRecord } from '@/hooks/useLastGuidance';

interface LastGuidancePanelProps {
  guidance: GuidanceRecord | null;
  onRepeat: () => void;
  isActive: boolean;
}

const RISK_STYLES: Record<string, { badge: string; bar: string; label: string }> = {
  critical: { badge: 'bg-red-900/60 border-red-700 text-red-300',   bar: 'bg-red-500',    label: 'Critical' },
  high:     { badge: 'bg-orange-900/60 border-orange-700 text-orange-300', bar: 'bg-orange-500', label: 'High' },
  medium:   { badge: 'bg-yellow-900/60 border-yellow-700 text-yellow-300', bar: 'bg-yellow-400', label: 'Medium' },
  low:      { badge: 'bg-blue-900/60 border-blue-700 text-blue-300', bar: 'bg-blue-500',   label: 'Low' },
  none:     { badge: 'bg-gray-800 border-gray-700 text-gray-400',    bar: 'bg-gray-600',   label: 'None' },
};

function getRiskStyle(riskLevel: string) {
  return RISK_STYLES[riskLevel.toLowerCase()] ?? RISK_STYLES.none;
}

function timeAgo(ts: Date): string {
  const sec = Math.round((Date.now() - ts.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  return `${Math.round(sec / 60)}m ago`;
}

export function LastGuidancePanel({ guidance, onRepeat, isActive }: LastGuidancePanelProps) {
  const style = guidance ? getRiskStyle(guidance.riskLevel) : RISK_STYLES.none;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">🔁 Last Guidance</h3>
        <button
          onClick={onRepeat}
          disabled={!isActive && !guidance}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-xs font-semibold text-gray-200
            hover:bg-gray-600 hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
          aria-label="Repeat the last spoken guidance message"
        >
          🔊 Repeat
        </button>
      </div>

      {guidance ? (
        <div className="space-y-3">
          {/* Spoken text */}
          <blockquote
            className="text-sm text-white leading-relaxed border-l-2 border-yellow-500 pl-3"
            aria-label={`Last spoken guidance: ${guidance.text}`}
          >
            &ldquo;{guidance.text}&rdquo;
          </blockquote>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Risk level */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${style.badge}`}
              aria-label={`Risk level: ${style.label}`}
            >
              {style.label}
            </span>

            {/* Confidence */}
            <div
              className="flex items-center gap-1.5"
              aria-label={`Confidence: ${Math.round(guidance.confidence * 100)} percent`}
            >
              <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${style.bar}`}
                  style={{ width: `${Math.round(guidance.confidence * 100)}%` }}
                />
              </div>
              <span className="text-gray-400 text-xs">{Math.round(guidance.confidence * 100)}%</span>
            </div>

            {/* Time */}
            <span className="text-gray-600 text-xs ml-auto" aria-label={`Guidance was spoken ${timeAgo(guidance.timestamp)}`}>
              {timeAgo(guidance.timestamp)}
            </span>
          </div>

          {/* Reason */}
          {guidance.reason && (
            <p className="text-gray-500 text-xs" aria-label={`Reason: ${guidance.reason}`}>
              Why: {guidance.reason}
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-600 text-sm">
            {isActive
              ? 'No guidance spoken yet — session is scanning…'
              : 'Start a session to see last guidance here.'}
          </p>
        </div>
      )}
    </div>
  );
}

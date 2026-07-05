'use client';

import { useState } from 'react';
import type { ExplainedDecision, FeedbackType } from '@/types/trust';
import { trustLevelLabel, trustScorePercent } from '@/engines/trustScoreEngine';
import { formatExplanationText } from '@/engines/explainableAIEngine';

interface Props {
  decision: ExplainedDecision | null;
  onFeedback?: (type: FeedbackType) => void;
  className?: string;
}

const FEEDBACK_OPTIONS: { type: FeedbackType; label: string; emoji: string }[] = [
  { type: 'useful', label: 'Useful', emoji: '✓' },
  { type: 'too_much', label: 'Too much', emoji: '−' },
  { type: 'too_late', label: 'Too late', emoji: '⏱' },
  { type: 'wrong', label: 'Wrong', emoji: '✗' },
  { type: 'unclear', label: 'Unclear', emoji: '?' },
];

const TRUST_COLORS: Record<string, string> = {
  high: 'bg-green-900 text-green-200 border-green-700',
  medium: 'bg-yellow-900 text-yellow-200 border-yellow-700',
  low: 'bg-orange-900 text-orange-200 border-orange-700',
  uncertain: 'bg-red-900 text-red-200 border-red-700',
  needs_confirmation: 'bg-red-900 text-red-300 border-red-700',
};

export function ExplanationPanel({ decision, onFeedback, className = '' }: Props) {
  const [givenFeedback, setGivenFeedback] = useState<FeedbackType | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (!decision) {
    return (
      <div className={`rounded-lg border border-gray-700 bg-gray-900 p-3 ${className}`}
        role="region" aria-label="AI explanation">
        <p className="text-xs text-gray-500 text-center">
          Why did Denarixx say that? — waiting for a decision…
        </p>
      </div>
    );
  }

  const trustColor = TRUST_COLORS[decision.trust.level] ?? TRUST_COLORS.uncertain;
  const spokenText = formatExplanationText(decision);

  const handleFeedback = (type: FeedbackType) => {
    setGivenFeedback(type);
    onFeedback?.(type);
  };

  return (
    <div
      className={`rounded-lg border border-gray-700 bg-gray-900 ${className}`}
      role="region"
      aria-label="AI decision explanation"
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className="text-sm font-semibold text-white">
          Why did Denarixx {decision.category === 'silent' ? 'stay silent' : 'say that'}?
        </span>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Trust badge always visible */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded border font-medium ${trustColor}`}
          aria-label={`Trust level: ${trustLevelLabel(decision.trust.level)}`}
        >
          {trustLevelLabel(decision.trust.level)} · {trustScorePercent(decision.trust.score)}
        </span>
        <span className="text-xs text-gray-400 capitalize">{decision.source}</span>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-800 pt-3">

          {/* What was seen */}
          {decision.whatWasSeen.detectedLabels.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">What I detected</p>
              <div className="flex flex-wrap gap-1">
                {decision.whatWasSeen.detectedLabels.map(label => (
                  <span
                    key={label}
                    className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Risk & confidence */}
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-gray-400">Risk </span>
              <span className="text-white font-medium capitalize">{decision.riskLevel}</span>
            </div>
            <div>
              <span className="text-gray-400">Confidence </span>
              <span className="text-white font-medium">{Math.round(decision.confidence * 100)}%</span>
            </div>
          </div>

          {/* Why spoke / silent */}
          {decision.whySpoke && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Why I spoke</p>
              <p className="text-xs text-green-300">{decision.whySpoke.triggerLabel}</p>
            </div>
          )}
          {decision.whySilent && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Why I stayed silent</p>
              <p className="text-xs text-yellow-300">{decision.whySilent.reason}</p>
            </div>
          )}

          {/* Recommended action */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Recommended</p>
            <p className="text-xs text-white">{decision.recommendedAction}</p>
          </div>

          {/* Uncertainty note */}
          {decision.uncertaintyNote && (
            <div className="rounded bg-yellow-900/40 border border-yellow-700 p-2">
              <p className="text-xs text-yellow-300">⚠ {decision.uncertaintyNote}</p>
            </div>
          )}

          {/* Full readable explanation */}
          <div className="rounded bg-gray-800 p-2">
            <p className="text-xs text-gray-300 leading-relaxed">{spokenText}</p>
          </div>

          {/* Trust factors */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Trust factors</p>
            <ul className="space-y-0.5">
              {decision.trust.factorsUsed.map((f, i) => (
                <li key={i} className="text-xs text-gray-400">• {f}</li>
              ))}
            </ul>
          </div>

          {/* User feedback */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Was this helpful?</p>
            {givenFeedback ? (
              <p className="text-xs text-green-400">
                Thank you — feedback recorded as &ldquo;{givenFeedback}&rdquo;.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {FEEDBACK_OPTIONS.map(({ type, label, emoji }) => (
                  <button
                    key={type}
                    onClick={() => handleFeedback(type)}
                    className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-300 transition-colors"
                    aria-label={label}
                  >
                    {emoji} {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-600 italic">
            Explanations are AI-generated estimates. Always use your own judgement.
          </p>
        </div>
      )}
    </div>
  );
}

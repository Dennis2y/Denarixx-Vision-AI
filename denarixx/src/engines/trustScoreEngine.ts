// Sprint 9 — Trust Score Engine (pure functional, no async, no I/O)

import type {
  TrustLevel,
  TrustScore,
  FeedbackType,
  UserFeedback,
} from '@/types/trust';

// ─── Classification ───────────────────────────────────────────────────────────

export function classifyTrustLevel(score: number): TrustLevel {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  if (score >= 0.4) return 'low';
  if (score >= 0.2) return 'uncertain';
  return 'needs_confirmation';
}

export function trustLevelLabel(level: TrustLevel): string {
  const labels: Record<TrustLevel, string> = {
    high: 'High Confidence',
    medium: 'Moderate Confidence',
    low: 'Low Confidence',
    uncertain: 'Uncertain',
    needs_confirmation: 'Needs Confirmation',
  };
  return labels[level];
}

export function trustLevelColor(level: TrustLevel): string {
  const colors: Record<TrustLevel, string> = {
    high: 'green',
    medium: 'yellow',
    low: 'orange',
    uncertain: 'red',
    needs_confirmation: 'red',
  };
  return colors[level];
}

// ─── Source reliability weights (0–1) ────────────────────────────────────────

const SOURCE_WEIGHT: Record<string, number> = {
  guardian: 0.90,
  navigation: 0.85,
  memory: 0.80,
  vision: 0.85,
  voice: 0.75,
  system: 0.95,
};

// ─── Compute trust score from raw inputs ──────────────────────────────────────

export function computeTrustScore(
  confidence: number,
  source: string,
  feedbackHistory: UserFeedback[],
): TrustScore {
  const factors: string[] = [];

  // Clamp raw confidence to [0, 1]
  let score = Math.max(0, Math.min(1, confidence));

  // Source reliability
  const sw = SOURCE_WEIGHT[source] ?? 0.80;
  score = score * sw;
  factors.push(
    `Source reliability (${source}): ${Math.round(sw * 100)}%`,
  );

  // Feedback history adjustment
  if (feedbackHistory.length > 0) {
    const usefulCount = feedbackHistory.filter(f => f.type === 'useful').length;
    const wrongCount = feedbackHistory.filter(f => f.type === 'wrong').length;
    const raw =
      (usefulCount - wrongCount * 1.5) / feedbackHistory.length;
    const delta = Math.max(-0.30, Math.min(0.20, raw * 0.3));
    score = Math.max(0, Math.min(1, score + delta));
    factors.push(
      `User feedback adjustment: ${delta >= 0 ? '+' : ''}${Math.round(delta * 100)}%`,
    );
  }

  const rounded = Math.round(score * 100) / 100;
  const level = classifyTrustLevel(rounded);

  const explanations: Record<TrustLevel, string> = {
    high: 'AI is highly confident in this decision.',
    medium: 'AI has moderate confidence. Proceed carefully.',
    low: 'AI confidence is low. Please verify independently.',
    uncertain: 'Conditions are uncertain. Use extra caution.',
    needs_confirmation:
      'AI needs more context. Please confirm before acting.',
  };

  return {
    level,
    score: rounded,
    explanation: explanations[level],
    factorsUsed: factors,
  };
}

// ─── Adjust existing trust score after user feedback ─────────────────────────

export function adjustTrustFromFeedback(
  current: TrustScore,
  feedback: FeedbackType,
): TrustScore {
  const adjustments: Record<FeedbackType, number> = {
    useful: 0.05,
    too_much: -0.03,
    too_late: -0.04,
    wrong: -0.10,
    unclear: -0.03,
  };
  const delta = adjustments[feedback];
  const newScore = Math.max(0, Math.min(1, current.score + delta));
  const level = classifyTrustLevel(newScore);
  return { ...current, score: Math.round(newScore * 100) / 100, level };
}

// ─── Utility: human-readable percentage ──────────────────────────────────────

export function trustScorePercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

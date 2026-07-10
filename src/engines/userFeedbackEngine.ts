// ─── V17 User Feedback Engine ─────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Feedback question bank, collection, summary, and improvement guidance.

import type {
  AlertFeedback,
  FeedbackQuestion,
  FeedbackSummary,
  AlertUsefulness,
  ClarityRating,
  FrequencyRating,
  TimingRating,
} from '@/types/fieldTrial';
import { usefulnessToScore, clarityToScore } from '@/engines/safetyValidationEngine';

// ─── Question Bank (8 questions per spec) ─────────────────────────────────────

export function getFeedbackQuestions(): FeedbackQuestion[] {
  return [
    {
      id: 'usefulness',
      question: 'Was this alert useful?',
      type: 'usefulness',
    },
    {
      id: 'timing',
      question: 'Was the alert too late?',
      type: 'timing',
    },
    {
      id: 'frequency',
      question: 'Was the alert too frequent?',
      type: 'frequency',
    },
    {
      id: 'clarity',
      question: 'Was the wording clear?',
      type: 'clarity',
    },
    {
      id: 'overwhelmed',
      question: 'Did you feel overwhelmed by the AI guidance?',
      type: 'boolean',
    },
    {
      id: 'safer',
      question: 'Did you feel safer with this alert?',
      type: 'boolean',
    },
    {
      id: 'alternative',
      question: 'What should the AI say differently? (optional)',
      type: 'text',
    },
    {
      id: 'missed_hazard',
      question: 'Did the supervisor observe a missed hazard?',
      type: 'boolean',
    },
  ];
}

// ─── Feedback Factory ─────────────────────────────────────────────────────────

export function createAlertFeedback(
  alertId: string,
  sessionId: string,
  responses: {
    usefulness: AlertUsefulness;
    timing: TimingRating;
    frequency: FrequencyRating;
    clarity: ClarityRating;
    userFeltOverwhelmed: boolean;
    userFeltSafer: boolean;
    suggestedAlternativeText?: string;
    supervisorObservedMissedHazard?: boolean;
  },
): AlertFeedback {
  return {
    feedbackId: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    alertId,
    sessionId,
    timestamp: Date.now(),
    usefulness: responses.usefulness,
    timing: responses.timing,
    frequency: responses.frequency,
    clarity: responses.clarity,
    userFeltOverwhelmed: responses.userFeltOverwhelmed,
    userFeltSafer: responses.userFeltSafer,
    suggestedAlternativeText: responses.suggestedAlternativeText ?? '',
    supervisorObservedMissedHazard: responses.supervisorObservedMissedHazard ?? false,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateFeedbackResponses(feedback: AlertFeedback): boolean {
  const validUsefulness: AlertUsefulness[] = ['very_useful', 'useful', 'neutral', 'not_useful', 'harmful'];
  const validTimings: TimingRating[] = ['too_early', 'just_right', 'too_late'];
  const validFrequencies: FrequencyRating[] = ['too_frequent', 'about_right', 'too_infrequent'];
  const validClarities: ClarityRating[] = ['very_clear', 'clear', 'neutral', 'unclear', 'very_unclear'];

  return (
    validUsefulness.includes(feedback.usefulness) &&
    validTimings.includes(feedback.timing) &&
    validFrequencies.includes(feedback.frequency) &&
    validClarities.includes(feedback.clarity) &&
    typeof feedback.userFeltOverwhelmed === 'boolean' &&
    typeof feedback.userFeltSafer === 'boolean' &&
    typeof feedback.supervisorObservedMissedHazard === 'boolean'
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export function calculateFeedbackSummary(feedbacks: AlertFeedback[]): FeedbackSummary {
  if (feedbacks.length === 0) {
    return {
      totalFeedbacks: 0,
      averageUsefulnessScore: 0,
      averageClarityScore: 0,
      overwhelmedCount: 0,
      saferCount: 0,
      lateFeedbackCount: 0,
      frequencyComplaintCount: 0,
      supervisorMissedHazardCount: 0,
      alternativeTextSuggestions: [],
    };
  }

  const avgUsefulness = feedbacks.reduce((s, fb) => s + usefulnessToScore(fb.usefulness), 0) / feedbacks.length;
  const avgClarity = feedbacks.reduce((s, fb) => s + clarityToScore(fb.clarity), 0) / feedbacks.length;

  return {
    totalFeedbacks: feedbacks.length,
    averageUsefulnessScore: Math.round(avgUsefulness),
    averageClarityScore: Math.round(avgClarity),
    overwhelmedCount: feedbacks.filter(fb => fb.userFeltOverwhelmed).length,
    saferCount: feedbacks.filter(fb => fb.userFeltSafer).length,
    lateFeedbackCount: feedbacks.filter(fb => fb.timing === 'too_late').length,
    frequencyComplaintCount: feedbacks.filter(fb => fb.frequency === 'too_frequent').length,
    supervisorMissedHazardCount: feedbacks.filter(fb => fb.supervisorObservedMissedHazard).length,
    alternativeTextSuggestions: feedbacks
      .map(fb => fb.suggestedAlternativeText)
      .filter(t => t && t.trim() !== ''),
  };
}

// ─── Guidance from Feedback ───────────────────────────────────────────────────

export function buildFeedbackGuidance(summary: FeedbackSummary): string[] {
  const guidance: string[] = [];

  if (summary.totalFeedbacks === 0) {
    return ['No feedback collected yet. Collect at least 5 feedbacks before drawing conclusions.'];
  }

  if (summary.averageUsefulnessScore < 50) {
    guidance.push('Alert usefulness is below 50%. Review alert triggers — may be too generic or poorly timed.');
  }

  if (summary.averageClarityScore < 60) {
    guidance.push('Guidance clarity score is low. Simplify language and shorten alert messages.');
  }

  if (summary.overwhelmedCount > summary.totalFeedbacks * 0.3) {
    guidance.push('More than 30% of users felt overwhelmed. Reduce alert frequency or add silence windows.');
  }

  if (summary.lateFeedbackCount > summary.totalFeedbacks * 0.25) {
    guidance.push('More than 25% of alerts were rated as too late. Improve prediction lead time.');
  }

  if (summary.frequencyComplaintCount > summary.totalFeedbacks * 0.3) {
    guidance.push('High frequency complaints. Consider raising alert thresholds or batching nearby alerts.');
  }

  if (summary.supervisorMissedHazardCount > 0) {
    guidance.push(`Supervisor observed ${summary.supervisorMissedHazardCount} missed hazard(s). Review detection coverage.`);
  }

  if (summary.saferCount >= summary.totalFeedbacks * 0.7) {
    guidance.push('Strong safety signal — over 70% of users felt safer. Positive outcome.');
  }

  if (guidance.length === 0) {
    guidance.push('Feedback metrics look healthy. Continue collecting data across more scenarios.');
  }

  return guidance;
}

// ─── Score Formatting ─────────────────────────────────────────────────────────

export function describeUsefulness(u: AlertUsefulness): string {
  const map: Record<AlertUsefulness, string> = {
    very_useful: 'Very useful — clear benefit to user',
    useful: 'Useful — helped the user',
    neutral: 'Neutral — neither helped nor hindered',
    not_useful: 'Not useful — did not help',
    harmful: 'Harmful — caused distraction or confusion',
  };
  return map[u];
}

export function describeClarity(c: ClarityRating): string {
  const map: Record<ClarityRating, string> = {
    very_clear: 'Very clear wording',
    clear: 'Clear enough',
    neutral: 'Acceptable',
    unclear: 'Confusing',
    very_unclear: 'Very confusing — needs rewrite',
  };
  return map[c];
}

export function describeTiming(t: TimingRating): string {
  const map: Record<TimingRating, string> = {
    too_early: 'Alert came too early',
    just_right: 'Alert timing was correct',
    too_late: 'Alert came too late — hazard already encountered',
  };
  return map[t];
}

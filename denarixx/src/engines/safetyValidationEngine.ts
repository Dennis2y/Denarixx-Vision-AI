// ─── V17 Safety Validation Engine ────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Computes safety metrics from field trial sessions.

import type {
  TrialSession,
  AlertFeedback,
  SafetyMetrics,
  IncidentReport,
  SupervisorNote,
} from '@/types/fieldTrial';

// ─── Metric Computation ───────────────────────────────────────────────────────

export function calculateAlertUsefulnessScore(feedbacks: AlertFeedback[]): number {
  if (feedbacks.length === 0) return 50; // neutral placeholder
  const total = feedbacks.reduce((sum, fb) => sum + usefulnessToScore(fb.usefulness), 0);
  return Math.round(total / feedbacks.length);
}

export function calculateGuidanceClarityScore(feedbacks: AlertFeedback[]): number {
  if (feedbacks.length === 0) return 50;
  const total = feedbacks.reduce((sum, fb) => sum + clarityToScore(fb.clarity), 0);
  return Math.round(total / feedbacks.length);
}

export function calculateUserConfidenceScore(feedbacks: AlertFeedback[]): number {
  if (feedbacks.length === 0) return 50;
  const saferCount = feedbacks.filter(fb => fb.userFeltSafer).length;
  const overwhelmedCount = feedbacks.filter(fb => fb.userFeltOverwhelmed).length;
  const base = (saferCount / feedbacks.length) * 100;
  const penalty = (overwhelmedCount / feedbacks.length) * 20;
  return Math.round(Math.max(0, Math.min(100, base - penalty)));
}

export function calculateAlertFatigueScore(session: TrialSession): number {
  // Higher = more fatigue. Computed from alert count + overwhelmed feedback.
  const alertRate = session.alerts.length;
  const overwhelmedCount = session.alertFeedbacks.filter(fb => fb.userFeltOverwhelmed).length;
  const frequencyComplaints = session.alertFeedbacks.filter(fb => fb.frequency === 'too_frequent').length;

  const durationMin = session.startTime
    ? Math.max(1, (Date.now() - session.startTime) / 60000)
    : 1;
  const alertsPerMin = alertRate / durationMin;

  let score = Math.min(100, alertsPerMin * 10); // >10/min = 100 fatigue
  score += overwhelmedCount * 15;
  score += frequencyComplaints * 10;
  return Math.round(Math.min(100, score));
}

export function calculateSupervisorSafetyScore(
  notes: SupervisorNote[],
  incidents: IncidentReport[],
): number {
  let score = 100;
  incidents.forEach(inc => {
    if (inc.severity === 'serious') score -= 30;
    else if (inc.severity === 'moderate') score -= 15;
    else score -= 5;
  });
  const safetyNotes = notes.filter(n => n.category === 'safety').length;
  score -= safetyNotes * 3; // each safety note suggests a concern
  return Math.max(0, Math.min(100, score));
}

export function calculateAverageReactionTimeMs(feedbacks: AlertFeedback[], alerts: TrialSession['alerts']): number {
  const timed = alerts.filter(a => a.responseTimeMs !== null);
  if (timed.length === 0) return 0;
  const total = timed.reduce((sum, a) => sum + (a.responseTimeMs ?? 0), 0);
  return Math.round(total / timed.length);
}

export function calculateSafetyMetrics(session: TrialSession): SafetyMetrics {
  return {
    alertUsefulnessScore: calculateAlertUsefulnessScore(session.alertFeedbacks),
    missedHazardScore: calculateMissedHazardScore(session.alertFeedbacks),
    falseAlertScore: calculateFalseAlertScore(session.alertFeedbacks),
    averageReactionTimeMs: calculateAverageReactionTimeMs(session.alertFeedbacks, session.alerts),
    userConfidenceScore: calculateUserConfidenceScore(session.alertFeedbacks),
    supervisorSafetyScore: calculateSupervisorSafetyScore(session.supervisorNotes, session.incidentReports),
    guidanceClarityScore: calculateGuidanceClarityScore(session.alertFeedbacks),
    alertFatigueScore: calculateAlertFatigueScore(session),
  };
}

// ─── Placeholder Metrics (requires real data to compute) ─────────────────────

export function calculateMissedHazardScore(feedbacks: AlertFeedback[]): number {
  // placeholder — supervisor marks missed hazards
  if (feedbacks.length === 0) return 0;
  const missed = feedbacks.filter(fb => fb.supervisorObservedMissedHazard).length;
  return Math.round((missed / feedbacks.length) * 100);
}

export function calculateFalseAlertScore(feedbacks: AlertFeedback[]): number {
  // placeholder — "not_useful" or "harmful" responses suggest false alerts
  if (feedbacks.length === 0) return 0;
  const falseAlerts = feedbacks.filter(fb =>
    fb.usefulness === 'not_useful' || fb.usefulness === 'harmful'
  ).length;
  return Math.round((falseAlerts / feedbacks.length) * 100);
}

// ─── Score Conversion Helpers ─────────────────────────────────────────────────

export function usefulnessToScore(u: AlertFeedback['usefulness']): number {
  const map: Record<AlertFeedback['usefulness'], number> = {
    very_useful: 100,
    useful: 75,
    neutral: 50,
    not_useful: 25,
    harmful: 0,
  };
  return map[u];
}

export function clarityToScore(c: AlertFeedback['clarity']): number {
  const map: Record<AlertFeedback['clarity'], number> = {
    very_clear: 100,
    clear: 75,
    neutral: 50,
    unclear: 25,
    very_unclear: 0,
  };
  return map[c];
}

// ─── Grade ────────────────────────────────────────────────────────────────────

export function getMetricsGrade(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export function formatMetricsGrade(score: number): string {
  const grade = getMetricsGrade(score);
  const emoji = { excellent: '🟢', good: '🟡', fair: '🟠', poor: '🔴' };
  return `${emoji[grade]} ${score}/100 (${grade})`;
}

// ─── Safety Rule Validation ───────────────────────────────────────────────────

export function validateSafetyRules(session: TrialSession): string[] {
  const violations: string[] = [];

  if (!session.consent.consentGiven) violations.push('Session started without consent');
  if (!session.consent.supervisorPresent) violations.push('No supervisor confirmed');
  if (!session.consent.noVideoStorageConfirmed) violations.push('Video storage consent missing');
  if (!session.consent.noFaceRecognitionConfirmed) violations.push('Face recognition consent missing');

  const seriousIncidents = session.incidentReports.filter(i => i.severity === 'serious');
  if (seriousIncidents.length > 0) {
    violations.push(`${seriousIncidents.length} serious incident(s) occurred`);
  }

  return violations;
}

export function isSafeToPublish(metrics: SafetyMetrics): boolean {
  return (
    metrics.alertUsefulnessScore >= 50 &&
    metrics.guidanceClarityScore >= 50 &&
    metrics.supervisorSafetyScore >= 70 &&
    metrics.falseAlertScore < 30
  );
}

// ─── Threshold Constants ──────────────────────────────────────────────────────

export const SAFETY_THRESHOLDS = {
  minUsefulnessScore: 50,
  minClarityScore: 50,
  minSupervisorSafetyScore: 70,
  maxFalseAlertScore: 30,
  maxAlertFatigueScore: 60,
  maxMissedHazardScore: 20,
} as const;

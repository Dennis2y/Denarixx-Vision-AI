// ─── V17 Trial Report Engine ──────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Generates, formats, and manages field trial reports.

import type {
  TrialSession,
  TrialReport,
  SafetyMetrics,
  FeedbackSummary,
} from '@/types/fieldTrial';
import { getMetricsGrade, isSafeToPublish } from '@/engines/safetyValidationEngine';
import { getScenarioInfo, formatDuration, getSessionDurationMs } from '@/engines/fieldTrialEngine';

// ─── Report Generation ────────────────────────────────────────────────────────

export function generateTrialReport(
  session: TrialSession,
  metrics: SafetyMetrics,
  summary: FeedbackSummary,
): TrialReport {
  if (session.phase === 'deleted') {
    throw new Error('Cannot generate report for deleted session');
  }

  const durationMs = getSessionDurationMs(session);

  return {
    reportId: `report-${session.sessionId}`,
    sessionId: session.sessionId,
    participantId: session.participantId,
    scenario: session.scenario,
    generatedAt: Date.now(),
    durationMs,
    formattedDuration: formatDuration(durationMs),
    alertsTriggered: session.alerts.length,
    silenceDecisions: session.silenceDecisions.length,
    feedbackCount: session.alertFeedbacks.length,
    incidentCount: session.incidentReports.length,
    emergencyStopUsed: session.emergencyStopUsed,
    safetyMetrics: metrics,
    feedbackSummary: summary,
    supervisorNoteCount: session.supervisorNotes.length,
    recommendations: buildRecommendations(metrics, summary, session),
    privacyGuarantees: getPrivacyGuarantees(),
    deleted: false,
  };
}

// ─── Recommendations Builder ─────────────────────────────────────────────────

export function buildRecommendations(
  metrics: SafetyMetrics,
  summary: FeedbackSummary,
  session: TrialSession,
): string[] {
  const recs: string[] = [];

  const usefulnessGrade = getMetricsGrade(metrics.alertUsefulnessScore);
  if (usefulnessGrade === 'poor' || usefulnessGrade === 'fair') {
    recs.push('Improve alert triggers — usefulness score below target. Review hazard detection thresholds.');
  }

  if (metrics.alertFatigueScore > 60) {
    recs.push('Alert fatigue is high. Implement stricter silence windows and reduce medium-priority alerts.');
  }

  if (metrics.missedHazardScore > 20) {
    recs.push('Missed hazard rate above 20%. Expand perception coverage or reduce detection confidence threshold.');
  }

  if (metrics.guidanceClarityScore < 60) {
    recs.push('Guidance clarity needs improvement. Simplify language and test shorter phrase variants.');
  }

  if (metrics.supervisorSafetyScore < 70) {
    recs.push('Supervisor safety score below 70%. Review incident reports and address root causes before next trial.');
  }

  if (session.emergencyStopUsed) {
    recs.push('Emergency stop was triggered. Debrief supervisor and participant before scheduling next trial.');
  }

  if (session.incidentReports.some(i => i.severity === 'serious')) {
    recs.push('Serious incident occurred. Full review required before proceeding with further trials.');
  }

  if (metrics.userConfidenceScore >= 75 && metrics.alertUsefulnessScore >= 70) {
    recs.push('Good user confidence and usefulness scores. Consider expanding to next scenario level.');
  }

  if (summary.supervisorMissedHazardCount > 0) {
    recs.push(`${summary.supervisorMissedHazardCount} supervisor-observed missed hazard(s). Prioritize coverage improvement.`);
  }

  if (recs.length === 0) {
    recs.push('All metrics within acceptable range. Proceed with expanded trial cohort.');
  }

  return recs;
}

// ─── Privacy Guarantees ───────────────────────────────────────────────────────

export function getPrivacyGuarantees(): string[] {
  return [
    'No video footage stored — all frames processed in memory and discarded',
    'No face recognition performed at any stage',
    'No emergency livestreaming',
    'No biometric data collected or stored',
    'Location storage disabled by default — GPS fuzzy mode only',
    'Report stored only after explicit post-session consent',
    'Participant ID is anonymized — no real names stored',
    'Full data deletion available at any time',
  ];
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportReportAsJSON(report: TrialReport): string {
  if (report.deleted) {
    return JSON.stringify({ error: 'Report has been deleted', reportId: report.reportId }, null, 2);
  }
  return JSON.stringify(report, null, 2);
}

// ─── Summary Formatting ───────────────────────────────────────────────────────

export function formatReportSummary(report: TrialReport): string {
  const scenario = report.scenario.replace(/_/g, ' ');
  const safeLabel = isSafeToPublish(report.safetyMetrics) ? 'PASS' : 'REVIEW NEEDED';
  return [
    `Field Trial Report — ${scenario}`,
    `Duration: ${report.formattedDuration}`,
    `Alerts: ${report.alertsTriggered} | Silenced: ${report.silenceDecisions} | Feedback: ${report.feedbackCount}`,
    `Incidents: ${report.incidentCount} | Emergency Stop: ${report.emergencyStopUsed ? 'Yes' : 'No'}`,
    `Safety Status: ${safeLabel}`,
    `Usefulness: ${report.safetyMetrics.alertUsefulnessScore}/100 | Clarity: ${report.safetyMetrics.guidanceClarityScore}/100`,
  ].join('\n');
}

// ─── Delete Report ────────────────────────────────────────────────────────────

export function deleteReport(report: TrialReport): TrialReport {
  return {
    ...report,
    participantId: '[deleted]',
    feedbackSummary: {
      totalFeedbacks: 0,
      averageUsefulnessScore: 0,
      averageClarityScore: 0,
      overwhelmedCount: 0,
      saferCount: 0,
      lateFeedbackCount: 0,
      frequencyComplaintCount: 0,
      supervisorMissedHazardCount: 0,
      alternativeTextSuggestions: [],
    },
    recommendations: ['Report deleted by participant request.'],
    deleted: true,
  };
}

// ─── Scenario Label ───────────────────────────────────────────────────────────

export function getScenarioLabel(scenario: TrialReport['scenario']): string {
  try {
    return getScenarioInfo(scenario).name;
  } catch {
    return scenario.replace(/_/g, ' ');
  }
}

// ─── V11 Pilot Testing Engine ────────────────────────────────────────────────
// Pure functions only — no async, no I/O, no side effects.
// This system is NOT medically certified. It is assistive support only.
// All testing must be supervised, safe, and consent-based.

import type {
  PilotSession,
  TesterConsent,
  AlertFeedback,
  PilotReport,
  FeedbackSummary,
  ScenarioInfo,
  PilotScenario,
  ConsentValidationResult,
} from '@/types/pilot';
import { PILOT_PRIVACY } from '@/types/pilot';

// ─── Scenario Registry ──────────────────────────────────────────────────────

export const SCENARIO_REGISTRY: Record<PilotScenario, ScenarioInfo> = {
  indoor_room: {
    id: 'indoor_room',
    label: 'Indoor Room Navigation',
    description: 'Navigate a familiar room with standard furniture. AI detects chairs, tables, and wall edges.',
    estimatedMinutes: 5,
    difficulty: 'low',
    safetyNotes: [
      'Supervisor must clear all loose floor items before starting.',
      'Begin at the doorway with clear exit path.',
      'Stop immediately if the participant expresses any discomfort.',
    ],
  },
  hallway_walking: {
    id: 'hallway_walking',
    label: 'Hallway Walking',
    description: 'Walk a straight hallway corridor. AI detects doors, junctions, and approaching people.',
    estimatedMinutes: 5,
    difficulty: 'low',
    safetyNotes: [
      'Supervisor walks one step behind participant at all times.',
      'Ensure hallway is clear of other foot traffic.',
      'Use a quiet hallway to reduce audio interference.',
    ],
  },
  stairs_detection: {
    id: 'stairs_detection',
    label: 'Stairs Detection',
    description: 'Approach a staircase and receive AI guidance on step edges and handrail location.',
    estimatedMinutes: 8,
    difficulty: 'high',
    safetyNotes: [
      'Supervisor must maintain physical contact (hand on shoulder) throughout.',
      'Test approach only — do not climb unless participant is fully comfortable.',
      'Handrail must be confirmed functional before starting.',
      'Never test in wet or slippery conditions.',
    ],
  },
  obstacle_avoidance: {
    id: 'obstacle_avoidance',
    label: 'Obstacle Avoidance',
    description: 'Navigate a controlled obstacle course with boxes, chairs, and cones placed by the supervisor.',
    estimatedMinutes: 10,
    difficulty: 'medium',
    safetyNotes: [
      'Place all obstacles to sides only — never directly underfoot.',
      'Use soft, lightweight obstacles (foam blocks, fabric-covered items).',
      'Supervisor monitors spacing and readiness to intervene.',
    ],
  },
  crossing_simulation: {
    id: 'crossing_simulation',
    label: 'Crossing Simulation',
    description: 'Simulate approaching a road crossing in a car-free environment. AI provides timing and gap guidance.',
    estimatedMinutes: 10,
    difficulty: 'high',
    safetyNotes: [
      'Must be performed in a completely car-free environment (parking lot, closed road).',
      'Use cones or markings to simulate crossing boundaries.',
      'Supervisor must have clear line of sight to participant at all times.',
      'Do NOT test near real traffic under any circumstances.',
    ],
  },
  supermarket: {
    id: 'supermarket',
    label: 'Supermarket Simulation',
    description: 'Navigate a mock shop aisle environment with shelves, trolleys, and other shoppers (role-played).',
    estimatedMinutes: 15,
    difficulty: 'medium',
    safetyNotes: [
      'Conduct in a quiet period — avoid real peak shopping hours.',
      'Role-play additional shoppers with briefed volunteers only.',
      'Ensure wide aisle clearance (minimum 1.5 m).',
    ],
  },
  crowded_area: {
    id: 'crowded_area',
    label: 'Crowded Area Simulation',
    description: 'Move through a simulated busy space with multiple moving people to test social-distance alerts.',
    estimatedMinutes: 12,
    difficulty: 'high',
    safetyNotes: [
      'Use briefed volunteers only — no real crowds.',
      'All participants in the simulation must be aware and cooperative.',
      'Keep density low (max 6 people in a 10 m radius) for initial testing.',
      'Supervisor must be identifiable and within arm\'s reach.',
    ],
  },
};

// ─── Consent Validation ─────────────────────────────────────────────────────

export function validateConsent(consent: TesterConsent): ConsentValidationResult {
  const errors: string[] = [];

  if (!consent.consentGiven) {
    errors.push('Participant consent has not been given.');
  }
  if (!consent.supervisorPresent) {
    errors.push('A human supervisor must be confirmed present before testing begins.');
  }
  if (!consent.safetyDisclaimerAcknowledged) {
    errors.push('The safety disclaimer must be acknowledged before testing.');
  }
  if (!consent.testerId || consent.testerId.trim().length === 0) {
    errors.push('An anonymous tester ID is required.');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Session Lifecycle ──────────────────────────────────────────────────────

export function createPilotSession(
  sessionId: string,
  scenario: PilotScenario,
  consent: TesterConsent,
): PilotSession {
  const validation = validateConsent(consent);
  if (!validation.valid) {
    throw new Error(`Cannot create session: ${validation.errors.join('; ')}`);
  }

  return {
    sessionId,
    scenario,
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationMs: null,
    consent,
    alertsTriggered: 0,
    silenceDecisions: 0,
    predictedRisks: [],
    feedbackItems: [],
    confidenceLevels: [],
    failedDetectionsPlaceholder: [
      'Reflective surfaces (windows, mirrors)',
      'Transparent obstacles (glass doors)',
      'Low-contrast edges (white wall on white floor)',
    ],
    deleted: false,
  };
}

export function endPilotSession(session: PilotSession): PilotSession {
  if (session.endedAt !== null) return session;
  const endedAt = new Date().toISOString();
  const durationMs = new Date(endedAt).getTime() - new Date(session.startedAt).getTime();
  return { ...session, endedAt, durationMs };
}

export function recordAlert(session: PilotSession, confidenceLevel: number): PilotSession {
  return {
    ...session,
    alertsTriggered: session.alertsTriggered + 1,
    confidenceLevels: [...session.confidenceLevels, Math.max(0, Math.min(1, confidenceLevel))],
  };
}

export function recordSilenceDecision(session: PilotSession): PilotSession {
  return { ...session, silenceDecisions: session.silenceDecisions + 1 };
}

export function recordPredictedRisk(session: PilotSession, risk: string): PilotSession {
  return { ...session, predictedRisks: [...session.predictedRisks, risk] };
}

// ─── Feedback ───────────────────────────────────────────────────────────────

export function addAlertFeedback(
  session: PilotSession,
  feedback: AlertFeedback,
): PilotSession {
  return {
    ...session,
    feedbackItems: [...session.feedbackItems, feedback],
  };
}

export function buildFeedback(
  alertId: string,
  answers: {
    wasUseful?: boolean | null;
    wasTooLate?: boolean | null;
    wasAnnoying?: boolean | null;
    feltSafe?: boolean | null;
    wordingClear?: boolean | null;
    suggestedWording?: string | null;
  },
): AlertFeedback {
  return {
    alertId,
    wasUseful: answers.wasUseful ?? null,
    wasTooLate: answers.wasTooLate ?? null,
    wasAnnoying: answers.wasAnnoying ?? null,
    feltSafe: answers.feltSafe ?? null,
    wordingClear: answers.wordingClear ?? null,
    suggestedWording: answers.suggestedWording ?? null,
    timestamp: new Date().toISOString(),
  };
}

// ─── Feedback Summary ───────────────────────────────────────────────────────

function pct(items: AlertFeedback[], key: keyof AlertFeedback): number {
  const answered = items.filter((i) => i[key] !== null);
  if (answered.length === 0) return 0;
  const trueCount = answered.filter((i) => i[key] === true).length;
  return Math.round((trueCount / answered.length) * 100);
}

export function calculateFeedbackSummary(items: AlertFeedback[]): FeedbackSummary {
  const suggestions = items
    .map((i) => i.suggestedWording)
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

  return {
    totalResponses: items.length,
    usefulPercent: pct(items, 'wasUseful'),
    tooLatePercent: pct(items, 'wasTooLate'),
    annoyingPercent: pct(items, 'wasAnnoying'),
    feltSafePercent: pct(items, 'feltSafe'),
    wordingClearPercent: pct(items, 'wordingClear'),
    suggestions,
  };
}

// ─── Report Generation ──────────────────────────────────────────────────────

export function generateReport(session: PilotSession): PilotReport {
  if (session.deleted) {
    throw new Error('Cannot generate report: session data has been deleted.');
  }

  const ended = session.endedAt ?? new Date().toISOString();
  const durationMs = session.durationMs ?? (new Date(ended).getTime() - new Date(session.startedAt).getTime());

  const avgConfidence =
    session.confidenceLevels.length > 0
      ? session.confidenceLevels.reduce((a, b) => a + b, 0) / session.confidenceLevels.length
      : 0;

  return {
    sessionId: session.sessionId,
    scenario: session.scenario,
    durationMs,
    alertsTriggered: session.alertsTriggered,
    silenceDecisions: session.silenceDecisions,
    predictedRisks: [...session.predictedRisks],
    averageConfidence: Math.round(avgConfidence * 100) / 100,
    feedbackSummary: calculateFeedbackSummary(session.feedbackItems),
    failedDetections: [...session.failedDetectionsPlaceholder],
    privacyGuarantees: PILOT_PRIVACY,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Privacy — Delete Session Data ──────────────────────────────────────────

export function deletePilotData(session: PilotSession): PilotSession {
  return {
    ...session,
    feedbackItems: [],
    predictedRisks: [],
    confidenceLevels: [],
    failedDetectionsPlaceholder: [],
    alertsTriggered: 0,
    silenceDecisions: 0,
    deleted: true,
    consent: {
      ...session.consent,
      testerId: '[deleted]',
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getScenarioInfo(scenario: PilotScenario): ScenarioInfo {
  return SCENARIO_REGISTRY[scenario];
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

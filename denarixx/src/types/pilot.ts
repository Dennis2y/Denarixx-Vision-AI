// ─── V11 Pilot Testing Types ────────────────────────────────────────────────

export type PilotScenario =
  | 'indoor_room'
  | 'hallway_walking'
  | 'stairs_detection'
  | 'obstacle_avoidance'
  | 'crossing_simulation'
  | 'supermarket'
  | 'crowded_area';

export type PilotPhase = 'consent' | 'scenario' | 'active' | 'report';

// ─── Privacy Constraints ────────────────────────────────────────────────────

export interface PilotPrivacyConfig {
  readonly noVideoStorage: true;
  readonly noFaceRecognition: true;
  readonly noEmergencyStreaming: true;
  readonly consentRequired: true;
}

export const PILOT_PRIVACY: PilotPrivacyConfig = {
  noVideoStorage: true,
  noFaceRecognition: true,
  noEmergencyStreaming: true,
  consentRequired: true,
};

// ─── Consent ────────────────────────────────────────────────────────────────

export interface TesterConsent {
  testerId: string;
  consentGiven: boolean;
  consentTimestamp: string;
  supervisorPresent: boolean;
  safetyDisclaimerAcknowledged: boolean;
}

// ─── Feedback ───────────────────────────────────────────────────────────────

export interface AlertFeedback {
  alertId: string;
  wasUseful: boolean | null;
  wasTooLate: boolean | null;
  wasAnnoying: boolean | null;
  feltSafe: boolean | null;
  wordingClear: boolean | null;
  suggestedWording: string | null;
  timestamp: string;
}

// ─── Session ────────────────────────────────────────────────────────────────

export interface PilotSession {
  sessionId: string;
  scenario: PilotScenario;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  consent: TesterConsent;
  alertsTriggered: number;
  silenceDecisions: number;
  predictedRisks: string[];
  feedbackItems: AlertFeedback[];
  confidenceLevels: number[];
  failedDetectionsPlaceholder: string[];
  deleted: boolean;
}

// ─── Report ─────────────────────────────────────────────────────────────────

export interface FeedbackSummary {
  totalResponses: number;
  usefulPercent: number;
  tooLatePercent: number;
  annoyingPercent: number;
  feltSafePercent: number;
  wordingClearPercent: number;
  suggestions: string[];
}

export interface PilotReport {
  sessionId: string;
  scenario: PilotScenario;
  durationMs: number;
  alertsTriggered: number;
  silenceDecisions: number;
  predictedRisks: string[];
  averageConfidence: number;
  feedbackSummary: FeedbackSummary;
  failedDetections: string[];
  privacyGuarantees: PilotPrivacyConfig;
  generatedAt: string;
}

// ─── Scenario Registry ──────────────────────────────────────────────────────

export interface ScenarioInfo {
  id: PilotScenario;
  label: string;
  description: string;
  estimatedMinutes: number;
  safetyNotes: string[];
  difficulty: 'low' | 'medium' | 'high';
}

// ─── Consent Validation ─────────────────────────────────────────────────────

export interface ConsentValidationResult {
  valid: boolean;
  errors: string[];
}

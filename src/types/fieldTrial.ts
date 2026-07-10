// ─── V17 Real-World Field Trial & Safety Validation Types ─────────────────────
// Separate from src/types/pilot.ts (V11 — lab pilot testing).
// This file owns field trial sessions, safety validation metrics, and reports.

// ─── Trial Scenario ───────────────────────────────────────────────────────────

export type TrialScenario =
  | 'indoor_hallway'
  | 'stairs'
  | 'doorway'
  | 'obstacle_path'
  | 'supermarket_aisle'
  | 'outdoor_pavement'
  | 'road_crossing_simulation'
  | 'public_transport_simulation'
  | 'crowded_area_simulation';

export type TrialPhase = 'consent' | 'setup' | 'active' | 'completed' | 'deleted';

export type IncidentSeverity = 'minor' | 'moderate' | 'serious';
export type SupervisorNoteCategory = 'safety' | 'guidance' | 'hardware' | 'user_behaviour' | 'general';

// ─── Feedback Rating Types ────────────────────────────────────────────────────

export type AlertUsefulness = 'very_useful' | 'useful' | 'neutral' | 'not_useful' | 'harmful';
export type ClarityRating = 'very_clear' | 'clear' | 'neutral' | 'unclear' | 'very_unclear';
export type FrequencyRating = 'too_frequent' | 'about_right' | 'too_infrequent';
export type TimingRating = 'too_early' | 'just_right' | 'too_late';

// ─── Consent ──────────────────────────────────────────────────────────────────

export interface TrialConsent {
  participantId: string;       // Anonymized — never real name
  consentGiven: boolean;
  supervisorPresent: boolean;  // Human supervisor required
  assistiveSupportOnly: boolean; // "AI provides support only, not certainty"
  noVideoStorageConfirmed: boolean;
  noFaceRecognitionConfirmed: boolean;
  consentTimestamp: number;
}

// ─── Scenario Registry ────────────────────────────────────────────────────────

export interface TrialScenarioInfo {
  id: TrialScenario;
  name: string;
  description: string;
  indoorOutdoor: 'indoor' | 'outdoor' | 'both';
  riskLevel: 'low' | 'medium' | 'high';
  safetyNotes: string;
  prerequisiteEquipment: string[];
  minimumSupervisors: number;
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export interface TrialAlert {
  alertId: string;
  timestamp: number;
  alertType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  wasSpoken: boolean;
  wasHaptic: boolean;
  responseTimeMs: number | null;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface FeedbackQuestion {
  id: string;
  question: string;
  type: 'usefulness' | 'timing' | 'frequency' | 'clarity' | 'boolean' | 'text';
}

export interface AlertFeedback {
  feedbackId: string;
  alertId: string;
  sessionId: string;
  timestamp: number;
  usefulness: AlertUsefulness;
  timing: TimingRating;
  frequency: FrequencyRating;
  clarity: ClarityRating;
  userFeltOverwhelmed: boolean;
  userFeltSafer: boolean;
  suggestedAlternativeText: string;
  supervisorObservedMissedHazard: boolean;
}

export interface FeedbackSummary {
  totalFeedbacks: number;
  averageUsefulnessScore: number;    // 0-100
  averageClarityScore: number;       // 0-100
  overwhelmedCount: number;
  saferCount: number;
  lateFeedbackCount: number;
  frequencyComplaintCount: number;   // too_frequent responses
  supervisorMissedHazardCount: number;
  alternativeTextSuggestions: string[];
}

// ─── Incident ─────────────────────────────────────────────────────────────────

export interface IncidentReport {
  incidentId: string;
  sessionId: string;
  timestamp: number;
  description: string;
  severity: IncidentSeverity;
  supervisorAction: string;
  resolved: boolean;
}

// ─── Supervisor Note ──────────────────────────────────────────────────────────

export interface SupervisorNote {
  noteId: string;
  sessionId: string;
  timestamp: number;
  content: string;
  category: SupervisorNoteCategory;
}

// ─── Silence Decision ─────────────────────────────────────────────────────────

export interface TrialSilenceDecision {
  decisionId: string;
  sessionId: string;
  timestamp: number;
  reason: string;
  alertType: string;
}

// ─── Safety Metrics ───────────────────────────────────────────────────────────

export interface SafetyMetrics {
  alertUsefulnessScore: number;    // 0-100 (higher = more useful)
  missedHazardScore: number;       // 0-100 placeholder (lower = fewer misses)
  falseAlertScore: number;         // 0-100 placeholder (lower = fewer false alerts)
  averageReactionTimeMs: number;   // avg response time
  userConfidenceScore: number;     // 0-100
  supervisorSafetyScore: number;   // 0-100
  guidanceClarityScore: number;    // 0-100
  alertFatigueScore: number;       // 0-100 (higher = more fatigue)
}

// ─── Trial Session ────────────────────────────────────────────────────────────

export interface TrialSession {
  sessionId: string;
  participantId: string;    // Anonymized
  scenario: TrialScenario;
  phase: TrialPhase;
  consent: TrialConsent;
  startTime: number | null;
  endTime: number | null;
  alerts: TrialAlert[];
  silenceDecisions: TrialSilenceDecision[];
  alertFeedbacks: AlertFeedback[];
  incidentReports: IncidentReport[];
  supervisorNotes: SupervisorNote[];
  emergencyStopUsed: boolean;
  hardwareMode: string;
}

// ─── Trial Report ─────────────────────────────────────────────────────────────

export interface TrialReport {
  reportId: string;
  sessionId: string;
  participantId: string;    // Anonymized
  scenario: TrialScenario;
  generatedAt: number;
  durationMs: number;
  formattedDuration: string;
  alertsTriggered: number;
  silenceDecisions: number;
  feedbackCount: number;
  incidentCount: number;
  emergencyStopUsed: boolean;
  safetyMetrics: SafetyMetrics;
  feedbackSummary: FeedbackSummary;
  supervisorNoteCount: number;
  recommendations: string[];
  privacyGuarantees: string[];
  deleted: boolean;
}

// ─── Privacy Constants ────────────────────────────────────────────────────────

export const TRIAL_PRIVACY = {
  noVideoStorage: true,
  noFaceRecognition: true,
  noEmergencyStreaming: true,
  noBiometricStorage: true,
  consentRequired: true,
  supervisorRequired: true,
  locationStorageDisabled: true,
  dataDeleteOnRequest: true,
} as const;

// ─── Scenario Registry ────────────────────────────────────────────────────────

export const TRIAL_SCENARIO_REGISTRY: TrialScenarioInfo[] = [
  {
    id: 'indoor_hallway',
    name: 'Indoor Hallway',
    description: 'Navigate a clear hallway with mild obstacles (doors, people).',
    indoorOutdoor: 'indoor',
    riskLevel: 'low',
    safetyNotes: 'Ensure path is clear. Supervisor walks 1m ahead.',
    prerequisiteEquipment: ['phone', 'cane or guide'],
    minimumSupervisors: 1,
  },
  {
    id: 'stairs',
    name: 'Stair Navigation',
    description: 'Approach and descend/ascend a short flight of stairs.',
    indoorOutdoor: 'indoor',
    riskLevel: 'high',
    safetyNotes: 'Supervisor must hold guardrail. One stair at a time. Stop immediately on emergency.',
    prerequisiteEquipment: ['phone', 'cane or guide', 'handrail confirmed'],
    minimumSupervisors: 2,
  },
  {
    id: 'doorway',
    name: 'Doorway Passage',
    description: 'Detect and navigate through a doorway with varying door states.',
    indoorOutdoor: 'indoor',
    riskLevel: 'low',
    safetyNotes: 'Use standard interior doors. No revolving doors in Phase 17.',
    prerequisiteEquipment: ['phone'],
    minimumSupervisors: 1,
  },
  {
    id: 'obstacle_path',
    name: 'Obstacle Path',
    description: 'Controlled obstacle course with boxes, chairs, and signage.',
    indoorOutdoor: 'indoor',
    riskLevel: 'medium',
    safetyNotes: 'All obstacles padded. Supervisor clears path if participant distressed.',
    prerequisiteEquipment: ['phone', 'cane or guide', 'padded obstacle set'],
    minimumSupervisors: 1,
  },
  {
    id: 'supermarket_aisle',
    name: 'Supermarket Aisle',
    description: 'Navigate a supermarket aisle environment (quiet hours only).',
    indoorOutdoor: 'indoor',
    riskLevel: 'medium',
    safetyNotes: 'Quiet hours only. No trolleys near participant. Supervisor ahead.',
    prerequisiteEquipment: ['phone'],
    minimumSupervisors: 1,
  },
  {
    id: 'outdoor_pavement',
    name: 'Outdoor Pavement',
    description: 'Walk on a quiet pavement with curbs and tactile paving.',
    indoorOutdoor: 'outdoor',
    riskLevel: 'medium',
    safetyNotes: 'Low-traffic residential street only. No road crossing in this scenario.',
    prerequisiteEquipment: ['phone', 'cane or guide'],
    minimumSupervisors: 1,
  },
  {
    id: 'road_crossing_simulation',
    name: 'Road Crossing (Simulation)',
    description: 'Simulated road crossing using AI guidance — no actual road traffic.',
    indoorOutdoor: 'both',
    riskLevel: 'high',
    safetyNotes: 'Simulation only. Never test near actual moving traffic in Phase 17. Indoor or car-park environment.',
    prerequisiteEquipment: ['phone', 'cane or guide', 'controlled simulation space'],
    minimumSupervisors: 2,
  },
  {
    id: 'public_transport_simulation',
    name: 'Public Transport (Simulation)',
    description: 'Simulated bus stop / train platform scenario.',
    indoorOutdoor: 'both',
    riskLevel: 'medium',
    safetyNotes: 'Simulation environment. No live train platforms in Phase 17.',
    prerequisiteEquipment: ['phone'],
    minimumSupervisors: 1,
  },
  {
    id: 'crowded_area_simulation',
    name: 'Crowded Area (Simulation)',
    description: 'Navigate a controlled crowd environment using AI social awareness.',
    indoorOutdoor: 'indoor',
    riskLevel: 'medium',
    safetyNotes: 'Controlled number of participants (max 8 people). Participants briefed on safety.',
    prerequisiteEquipment: ['phone'],
    minimumSupervisors: 2,
  },
];

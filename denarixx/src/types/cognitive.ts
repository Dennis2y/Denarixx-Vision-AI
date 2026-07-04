// V2 Cognitive Guardian — type definitions
// Sprint 5: added SpeakTrigger, DeduplicationFrame, GuardianDecisionLogEntry, AlertQualityDecision

export type AlertFatigue = 'none' | 'low' | 'medium' | 'high';
export type UserActivity = 'walking' | 'stopped' | 'turning' | 'crossing' | 'unknown';
export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type RoutinePhase = 'morning' | 'afternoon' | 'evening' | 'night';

/** Sprint 5 — why the Guardian decided to speak */
export type SpeakTrigger =
  | 'new_hazard'           // hazard not seen in previous frame
  | 'hazard_returned'      // hazard was gone, came back
  | 'risk_increased'       // overall risk level went up
  | 'confidence_increased' // confidence rose enough to indicate the object is closer
  | 'user_state_changed'   // activity changed (e.g. stopped → walking)
  | 'repeat_requested'     // user explicitly asked for a repeat
  | 'cooldown_expired'     // past the cooldown window for this hazard type
  | 'critical_never_silenced'; // critical alert always bypasses all rules

export interface ProactiveAlert {
  id: string;
  message: string;
  riskLevel: RiskLevel;
  confidence: number;
  anticipatedIn: number; // seconds until hazard may materialise
  triggerLabel: string;
  timestamp: Date;
}

export interface SilenceDecision {
  shouldSilence: boolean;
  reason: string;
  fatigueLevel: AlertFatigue;
  silenceDurationMs: number;
}

export interface RiskPrediction {
  predictedRisk: RiskLevel;
  confidence: number;
  timeHorizonSeconds: number;
  factors: string[];
  reasoning: string;
}

export interface UserContext {
  activity: UserActivity;
  sessionDurationSeconds: number;
  alertsInLastMinute: number;
  lastAlertTimestamp: Date | null;
  isIndoors: boolean;
  confidence: number;
}

export interface RoutineEntry {
  id: string;
  label: string;
  timeOfDay: RoutinePhase;
  frequency: number;
  lastObserved: Date;
  associatedLocations: string[];
}

/** Sprint 5 — per-frame deduplication result */
export interface DeduplicationFrame {
  /** Labels that appeared this frame but were absent in the previous frame */
  appeared: string[];
  /** Labels that were present in the previous frame but absent this frame */
  disappeared: string[];
  /** Labels present in both the previous and current frame */
  ongoing: string[];
  /** True if this is the very first frame processed (no previous to compare) */
  isFirstFrame: boolean;
}

/** Sprint 5 — single entry in the Guardian's decision ring-buffer log */
export interface GuardianDecisionLogEntry {
  timestamp: Date;
  /** True = Guardian chose to speak; false = Guardian stayed silent */
  spoke: boolean;
  /** When spoke=true: the reason the Guardian spoke */
  speakTrigger: SpeakTrigger | null;
  /** When spoke=false: human-readable reason for silence */
  silenceReason: string | null;
  /** The top hazard type (e.g. 'vehicle', 'stairs') or null when nothing was detected */
  hazardType: string | null;
  /** Severity of the top hazard */
  severity: string | null;
  /** Confidence score of the top hazard (0–1) */
  confidence: number;
  /** Overall predicted risk level */
  riskLevel: RiskLevel;
  /** The message that was spoken (null when silent) */
  message: string | null;
  /** Frame-level deduplication summary */
  deduplicationFrame: DeduplicationFrame;
}

/** Sprint 5 — full quality decision output from AlertQualityEngine */
export interface AlertQualityDecision {
  shouldSpeak: boolean;
  message: string | null;
  speakTrigger: SpeakTrigger | null;
  silenceReason: string | null;
  riskLevel: RiskLevel;
  confidence: number;
  deduplicationFrame: DeduplicationFrame;
  logEntry: GuardianDecisionLogEntry;
}

export interface GuardianDecision {
  shouldAlert: boolean;
  shouldSilence: boolean;
  proactiveAlerts: ProactiveAlert[];
  riskPrediction: RiskPrediction;
  userContext: UserContext;
  message: string | null;
  confidence: number;
  reasoning: string;
  /** Sprint 5: populated when AlertQualityEngine is active (categories provided) */
  qualityDecision?: AlertQualityDecision;
}

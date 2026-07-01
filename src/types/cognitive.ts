// ─── V2 Cognitive Guardian Types ─────────────────────────────────────────────

import type { HazardAlert, SceneDescription, ConfidenceScore } from '@/types';

// ─── User State ───────────────────────────────────────────────────────────────

export type UserMovementState =
  | 'walking'
  | 'standing'
  | 'crossing_road'
  | 'waiting'
  | 'emergency'
  | 'unknown';

export type UserEnvironment = 'indoor' | 'outdoor' | 'unknown';

export interface UserState {
  movement: UserMovementState;
  environment: UserEnvironment;
  speed: 'slow' | 'normal' | 'fast' | 'stationary';
  isAtRisk: boolean;
  confidence: ConfidenceScore;
  updatedAt: Date;
}

// ─── Silence Decision ─────────────────────────────────────────────────────────

export type SilenceReason =
  | 'no_change'           // scene unchanged since last narration
  | 'risky_movement'      // user is crossing road or moving fast near hazard
  | 'recently_spoken'     // spoken within silence cooldown window
  | 'low_confidence'      // not confident enough to be useful
  | 'user_busy'           // user appears engaged in another task
  | 'companion_paused';   // companion mode paused for safety

export interface SilenceDecision {
  shouldBeSilent: boolean;
  reason: SilenceReason | null;
  cooldownRemainingMs: number;
}

// ─── Predictive Risk ──────────────────────────────────────────────────────────

export type RiskHorizon = 'immediate' | 'near' | 'potential';

export interface PredictedRisk {
  id: string;
  description: string;
  likelihood: ConfidenceScore;
  horizon: RiskHorizon;      // immediate <2s, near 2-10s, potential >10s
  triggerLabels: string[];   // which detected objects drove this prediction
  severity: 'critical' | 'high' | 'medium' | 'low';
  actionHint: string;        // what the user should do
  disclaimer: string;
}

// ─── Guardian Decision ────────────────────────────────────────────────────────

export type GuardianAction =
  | 'silent'          // say nothing
  | 'warn'            // urgent safety warning
  | 'guide'           // gentle navigational nudge
  | 'companion'       // contextual companionship message
  | 'acknowledge';    // brief confirmation ("path ahead is clear")

export interface GuardianDecision {
  action: GuardianAction;
  message: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  interrupt: boolean;
  reasoning: string;          // internal explanation (not spoken)
  predictedRisks: PredictedRisk[];
  userState: UserState;
  silenceDecision: SilenceDecision;
  confidence: ConfidenceScore;
}

// ─── Companion Context ────────────────────────────────────────────────────────

export type CompanionTone = 'reassuring' | 'informative' | 'cautious' | 'silent';

export interface CompanionMessage {
  text: string;
  tone: CompanionTone;
  isAppropriate: boolean;     // false if user is mid-risk movement
  suppressedReason?: string;
}

// ─── Routine Learning ─────────────────────────────────────────────────────────

export interface RoutinePattern {
  id: string;
  label: string;              // e.g. "morning walk", "café visit"
  detectionSignatures: string[]; // label combinations that match
  frequency: number;          // times seen
  lastSeen: Date;
  typicalDuration: number;    // seconds
  associatedRisks: string[];  // known hazards on this route
}

export interface RoutineLearningState {
  patterns: RoutinePattern[];
  currentMatch: RoutinePattern | null;
  sessionCount: number;
}

// ─── Engine interfaces ────────────────────────────────────────────────────────

export interface ICognitiveGuardianEngine {
  evaluate(
    scene: SceneDescription,
    alerts: HazardAlert[],
    userState: UserState
  ): Promise<GuardianDecision>;
}

export interface IProactiveAlertEngine {
  shouldAlert(
    alerts: HazardAlert[],
    userState: UserState,
    lastAlertMs: number
  ): { alert: boolean; urgency: 'critical' | 'high' | 'normal' | null };
}

export interface ISilenceDecisionEngine {
  decide(
    scene: SceneDescription,
    userState: UserState,
    lastSpokenMs: number,
    previousScene: SceneDescription | null
  ): SilenceDecision;
}

export interface IPredictiveRiskEngine {
  predict(
    scene: SceneDescription,
    userState: UserState,
    alerts: HazardAlert[]
  ): PredictedRisk[];
}

export interface ICompanionContextEngine {
  compose(
    scene: SceneDescription,
    userState: UserState,
    guardianAction: GuardianAction
  ): CompanionMessage;
}

export interface IRoutineLearningEngine {
  observe(scene: SceneDescription): void;
  getState(): RoutineLearningState;
  matchCurrentRoutine(scene: SceneDescription): RoutinePattern | null;
}

// Sprint 9 — Explainable AI & Trust Engine — type definitions

export type TrustLevel =
  | 'high'
  | 'medium'
  | 'low'
  | 'uncertain'
  | 'needs_confirmation';

export type FeedbackType =
  | 'useful'
  | 'too_much'
  | 'too_late'
  | 'wrong'
  | 'unclear';

export type DecisionSource =
  | 'guardian'
  | 'navigation'
  | 'memory'
  | 'voice'
  | 'vision'
  | 'system';

export type ExplanationCategory =
  | 'spoke'
  | 'silent'
  | 'guided'
  | 'remembered'
  | 'warned';

// ─── Trust scoring ────────────────────────────────────────────────────────────

export interface TrustScore {
  level: TrustLevel;
  /** 0–1 normalised score */
  score: number;
  explanation: string;
  factorsUsed: string[];
}

// ─── What the AI saw ─────────────────────────────────────────────────────────

export interface WhatWasSeen {
  detectedLabels: string[];
  sceneDescription: string | null;
  hazardTypes: string[];
  riskLevel: string;
}

// ─── Why it spoke / was silent ───────────────────────────────────────────────

export interface WhySpoke {
  /** Machine trigger, e.g. 'new_hazard' */
  trigger: string;
  /** Human-readable, e.g. 'New hazard detected' */
  triggerLabel: string;
  confidence: number;
  urgency: string;
}

export interface WhySilent {
  reason: string;
  fatigueLevel: string;
  cooldownRemainingMs: number | null;
}

// ─── Full explained decision ──────────────────────────────────────────────────

export interface ExplainedDecision {
  id: string;
  timestamp: Date;
  category: ExplanationCategory;
  source: DecisionSource;

  whatWasSeen: WhatWasSeen;

  riskLevel: string;
  confidence: number;

  /** Populated when the AI spoke; null when silent */
  whySpoke: WhySpoke | null;
  /** Populated when the AI stayed silent; null when it spoke */
  whySilent: WhySilent | null;

  recommendedAction: string;

  /** Present when confidence is below 0.5 or conditions are ambiguous */
  uncertaintyNote: string | null;

  /** The guidance text that was (or would have been) spoken */
  message: string | null;

  trust: TrustScore;
}

// ─── User feedback ────────────────────────────────────────────────────────────

export interface UserFeedback {
  decisionId: string;
  type: FeedbackType;
  timestamp: Date;
  note: string | null;
}

// ─── Decision trace (decision + optional feedback) ────────────────────────────

export interface DecisionTrace {
  decision: ExplainedDecision;
  feedback: UserFeedback | null;
}

// ─── Feedback summary ─────────────────────────────────────────────────────────

export interface FeedbackSummary {
  total: number;
  useful: number;
  tooMuch: number;
  tooLate: number;
  wrong: number;
  unclear: number;
  /** useful / total; 0 when total is 0 */
  helpfulnessRate: number;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

export interface ExplanationStore {
  /** Ring buffer capped at MAX_TRACE_ENTRIES */
  traces: DecisionTrace[];
  /** decisionId → UserFeedback */
  feedback: Record<string, UserFeedback>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_TRACE_ENTRIES = 50;

export const TRUST_DISCLAIMER =
  'Explanations are AI-generated estimates. Always use your own judgement and the guidance of a sighted assistant when safety is at stake.';

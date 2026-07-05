// Sprint 9 — Explainable AI Engine (pure functional, no async, no I/O)
// Builds human-readable explanations from Guardian / Navigation / Memory decisions.

import { randomUUID } from 'crypto';
import type {
  ExplainedDecision,
  ExplanationCategory,
  WhatWasSeen,
  WhySpoke,
  WhySilent,
} from '@/types/trust';
import type { GuardianDecision } from '@/types/cognitive';
import type { Detection, HazardAlert, SafetyDecision } from '@/types/index';
import { computeTrustScore } from '@/engines/trustScoreEngine';

// ─── Trigger → human-readable label ──────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  new_hazard: 'New hazard detected',
  hazard_returned: 'Hazard reappeared',
  risk_increased: 'Risk level increased',
  confidence_increased: 'AI became more certain',
  user_state_changed: 'Your movement changed',
  repeat_requested: 'You asked for a repeat',
  cooldown_expired: 'Cooldown period ended',
  critical_never_silenced: 'Critical alert — always spoken',
};

function triggerLabel(trigger: string): string {
  return TRIGGER_LABELS[trigger] ?? trigger;
}

// ─── Uncertainty note helper ──────────────────────────────────────────────────

function buildUncertaintyNote(confidence: number, riskLevel: string): string | null {
  if (confidence < 0.4) {
    return 'AI confidence is low — environmental conditions may be reducing accuracy.';
  }
  if (confidence < 0.6) {
    return 'Moderate uncertainty — please verify with your senses.';
  }
  if (riskLevel === 'none') {
    return null;
  }
  return null;
}

// ─── Recommended action builder ───────────────────────────────────────────────

function buildRecommendedAction(
  riskLevel: string,
  spokenMessage: string | null,
): string {
  if (riskLevel === 'critical') return 'Stop immediately and check your surroundings carefully.';
  if (riskLevel === 'high') return 'Slow down and proceed with caution.';
  if (riskLevel === 'medium') return 'Stay alert and be ready to change direction.';
  if (riskLevel === 'low') return 'Continue with awareness of the noted condition.';
  if (spokenMessage) return 'Follow the guidance provided.';
  return 'Continue normally — no immediate action needed.';
}

// ─── Build from Guardian decision ────────────────────────────────────────────

export interface GuardianExplanationInput {
  guardian: GuardianDecision;
  detections: Detection[];
  hazards: HazardAlert[];
  safetyDecision: SafetyDecision | null;
  feedbackHistory?: import('@/types/trust').UserFeedback[];
}

export function buildGuardianExplanation(
  input: GuardianExplanationInput,
): ExplainedDecision {
  const { guardian, detections, hazards, safetyDecision, feedbackHistory = [] } = input;

  const spoke = guardian.shouldAlert && !guardian.shouldSilence;
  const category: ExplanationCategory = spoke ? 'spoke' : 'silent';

  const detectedLabels = detections.map(d => d.label);
  const hazardTypes = hazards.map(h => h.type);
  const riskLevel = guardian.riskPrediction?.predictedRisk ?? 'none';

  const whatWasSeen: WhatWasSeen = {
    detectedLabels,
    sceneDescription: null,
    hazardTypes,
    riskLevel,
  };

  const qd = guardian.qualityDecision;
  const confidence = qd?.confidence ?? guardian.confidence ?? 0.5;

  let whySpoke: WhySpoke | null = null;
  let whySilent: WhySilent | null = null;

  if (spoke) {
    const trigger = qd?.speakTrigger ?? 'new_hazard';
    whySpoke = {
      trigger,
      triggerLabel: triggerLabel(trigger),
      confidence,
      urgency: safetyDecision?.urgency ?? riskLevel,
    };
  } else {
    whySilent = {
      reason: qd?.silenceReason ?? guardian.reasoning ?? 'No immediate action required.',
      fatigueLevel: guardian.userContext?.alertsInLastMinute > 3 ? 'high' : 'low',
      cooldownRemainingMs: null,
    };
  }

  const message = spoke ? (qd?.message ?? guardian.message) : null;
  const trust = computeTrustScore(confidence, 'guardian', feedbackHistory);
  const uncertaintyNote = buildUncertaintyNote(confidence, riskLevel);
  const recommendedAction = buildRecommendedAction(riskLevel, message);

  return {
    id: randomUUID(),
    timestamp: new Date(),
    category,
    source: 'guardian',
    whatWasSeen,
    riskLevel,
    confidence,
    whySpoke,
    whySilent,
    recommendedAction,
    uncertaintyNote,
    message,
    trust,
  };
}

// ─── Build from Navigation guidance ──────────────────────────────────────────

export interface NavigationExplanationInput {
  instruction: string;
  distanceMetres: number;
  riskLevel: string;
  confidence: number;
  reason: string;
  feedbackHistory?: import('@/types/trust').UserFeedback[];
}

export function buildNavigationExplanation(
  input: NavigationExplanationInput,
): ExplainedDecision {
  const { instruction, distanceMetres, riskLevel, confidence, reason, feedbackHistory = [] } = input;

  const whatWasSeen: WhatWasSeen = {
    detectedLabels: [],
    sceneDescription: `Navigation guidance: ${instruction}`,
    hazardTypes: [],
    riskLevel,
  };

  const whySpoke: WhySpoke = {
    trigger: 'navigation_guidance',
    triggerLabel: `Navigation update — ${Math.round(distanceMetres)}m away`,
    confidence,
    urgency: riskLevel,
  };

  const trust = computeTrustScore(confidence, 'navigation', feedbackHistory);
  const uncertaintyNote = buildUncertaintyNote(confidence, riskLevel);

  return {
    id: randomUUID(),
    timestamp: new Date(),
    category: 'guided',
    source: 'navigation',
    whatWasSeen,
    riskLevel,
    confidence,
    whySpoke,
    whySilent: null,
    recommendedAction: reason,
    uncertaintyNote,
    message: instruction,
    trust,
  };
}

// ─── Build from Memory recall ─────────────────────────────────────────────────

export interface MemoryExplanationInput {
  memoryLabel: string;
  memoryCategory: string;
  message: string;
  confidence: number;
  feedbackHistory?: import('@/types/trust').UserFeedback[];
}

export function buildMemoryExplanation(
  input: MemoryExplanationInput,
): ExplainedDecision {
  const { memoryLabel, memoryCategory, message, confidence, feedbackHistory = [] } = input;

  const whatWasSeen: WhatWasSeen = {
    detectedLabels: [memoryLabel],
    sceneDescription: `Memory recall: ${memoryCategory}`,
    hazardTypes: [],
    riskLevel: 'none',
  };

  const whySpoke: WhySpoke = {
    trigger: 'memory_recall',
    triggerLabel: `Remembered: ${memoryLabel}`,
    confidence,
    urgency: 'low',
  };

  const trust = computeTrustScore(confidence, 'memory', feedbackHistory);

  return {
    id: randomUUID(),
    timestamp: new Date(),
    category: 'remembered',
    source: 'memory',
    whatWasSeen,
    riskLevel: 'none',
    confidence,
    whySpoke,
    whySilent: null,
    recommendedAction: 'Use remembered context to navigate more confidently.',
    uncertaintyNote: confidence < 0.6
      ? 'Memory confidence is moderate — conditions may have changed.'
      : null,
    message,
    trust,
  };
}

// ─── Build a silent explanation (no hazard, no guidance) ─────────────────────

export interface SilentExplanationInput {
  reason: string;
  detections: Detection[];
  fatigueLevel: string;
  cooldownRemainingMs?: number | null;
  feedbackHistory?: import('@/types/trust').UserFeedback[];
}

export function buildSilentExplanation(
  input: SilentExplanationInput,
): ExplainedDecision {
  const {
    reason,
    detections,
    fatigueLevel,
    cooldownRemainingMs = null,
    feedbackHistory = [],
  } = input;

  const whatWasSeen: WhatWasSeen = {
    detectedLabels: detections.map(d => d.label),
    sceneDescription: null,
    hazardTypes: [],
    riskLevel: 'none',
  };

  const whySilent: WhySilent = {
    reason,
    fatigueLevel,
    cooldownRemainingMs,
  };

  const trust = computeTrustScore(0.8, 'guardian', feedbackHistory);

  return {
    id: randomUUID(),
    timestamp: new Date(),
    category: 'silent',
    source: 'guardian',
    whatWasSeen,
    riskLevel: 'none',
    confidence: 0.8,
    whySpoke: null,
    whySilent,
    recommendedAction: 'Continue normally — no immediate hazards detected.',
    uncertaintyNote: null,
    message: null,
    trust,
  };
}

// ─── Build from SafetyDecision (session page integration) ────────────────────

export interface SafetyDecisionExplanationInput {
  decision: import('@/types/index').SafetyDecision;
  detections: Detection[];
  hazards: import('@/types/index').HazardAlert[];
  sceneDescription: string | null;
  feedbackHistory?: import('@/types/trust').UserFeedback[];
}

export function buildFromSafetyDecision(
  input: SafetyDecisionExplanationInput,
): ExplainedDecision {
  const { decision, detections, hazards, sceneDescription, feedbackHistory = [] } = input;

  const spoke = decision.shouldAlert && decision.urgency !== 'none';
  const category: ExplanationCategory = spoke ? 'spoke' : 'silent';
  const riskLevel = decision.urgency === 'none' ? 'none' : decision.urgency;

  const whatWasSeen: WhatWasSeen = {
    detectedLabels: detections.map(d => d.label),
    sceneDescription,
    hazardTypes: hazards.map(h => h.type),
    riskLevel,
  };

  const confidence = decision.confidence ?? 0.7;
  const trust = computeTrustScore(confidence, 'guardian', feedbackHistory);

  let whySpoke: WhySpoke | null = null;
  let whySilent: WhySilent | null = null;

  if (spoke) {
    const trigger = hazards.length > 0 ? 'new_hazard' : 'guardian_decision';
    whySpoke = {
      trigger,
      triggerLabel: triggerLabel(trigger),
      confidence,
      urgency: riskLevel,
    };
  } else {
    whySilent = {
      reason: 'No immediate hazard requiring an alert.',
      fatigueLevel: 'low',
      cooldownRemainingMs: null,
    };
  }

  const message = spoke ? decision.message : null;
  const uncertaintyNote = buildUncertaintyNote(confidence, riskLevel);
  const recommendedAction = buildRecommendedAction(riskLevel, message);

  return {
    id: randomUUID(),
    timestamp: new Date(),
    category,
    source: 'guardian',
    whatWasSeen,
    riskLevel,
    confidence,
    whySpoke,
    whySilent,
    recommendedAction,
    uncertaintyNote,
    message,
    trust,
  };
}

// ─── Format explanation as readable text ──────────────────────────────────────

export function formatExplanationText(decision: ExplainedDecision): string {
  const lines: string[] = [];

  if (decision.category === 'spoke' || decision.category === 'warned') {
    lines.push(`Denarixx spoke because: ${decision.whySpoke?.triggerLabel ?? 'alert triggered'}.`);
    if (decision.whatWasSeen.detectedLabels.length > 0) {
      lines.push(`It detected: ${decision.whatWasSeen.detectedLabels.join(', ')}.`);
    }
    if (decision.whatWasSeen.riskLevel !== 'none') {
      lines.push(`Risk level: ${decision.whatWasSeen.riskLevel}.`);
    }
    lines.push(`Confidence: ${Math.round(decision.confidence * 100)}%.`);
    lines.push(`Recommended: ${decision.recommendedAction}`);
  } else if (decision.category === 'silent') {
    lines.push(`Denarixx stayed silent because: ${decision.whySilent?.reason ?? 'no hazard detected'}.`);
    if (decision.whySilent?.fatigueLevel === 'high') {
      lines.push('Alert frequency was high — silence reduces fatigue.');
    }
  } else if (decision.category === 'guided') {
    lines.push(`Navigation guidance: ${decision.message ?? 'continue on route'}.`);
    lines.push(`Reason: ${decision.recommendedAction}`);
  } else if (decision.category === 'remembered') {
    lines.push(`Memory context: ${decision.message ?? decision.whatWasSeen.detectedLabels[0] ?? 'recalled preference'}.`);
  }

  if (decision.uncertaintyNote) {
    lines.push(`Note: ${decision.uncertaintyNote}`);
  }

  lines.push(`Trust: ${decision.trust.explanation}`);

  return lines.join(' ');
}

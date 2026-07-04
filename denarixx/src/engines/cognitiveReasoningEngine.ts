/**
 * CognitiveReasoningEngine (V3)
 *
 * Continuously answers eight internal questions about the situation before
 * any audio output is produced.  This is the "thinking layer" — it transforms
 * raw environmental and risk signals into a structured understanding that the
 * rest of the pipeline uses to decide what to say, when to say it, and how.
 */

import type {
  CognitiveReasoning,
  EnvironmentUnderstanding,
  ReasoningRiskLevel,
  V3RiskPrediction,
} from '@/types/reasoning';

const RISK_ORDER: Record<ReasoningRiskLevel, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  informational: 1,
  none: 0,
};

export class CognitiveReasoningEngine {
  reason(
    environment: EnvironmentUnderstanding,
    risk: V3RiskPrediction
  ): CognitiveReasoning {
    const riskRank = RISK_ORDER[risk.riskLevel] ?? 0;

    // ── The 8 internal questions ──────────────────────────────────────────────

    // 1. What is happening?
    const whatIsHappening = environment.summary;

    // 2. What is likely to happen next?
    let whatIsLikelyNext = 'No immediate hazards predicted.';
    if (risk.predictedEvent) {
      const secs = risk.timeToImpactSeconds;
      whatIsLikelyNext = secs
        ? `${risk.predictedEvent} — estimated ${secs}s away.`
        : risk.predictedEvent;
    }

    // 3. Is the user safe?
    const isUserSafe = riskRank <= 1; // none or informational

    // 4. Does the user need guidance?
    const needsGuidance = riskRank >= 2; // medium and above

    // 5. Should I stay silent?
    //    Silent when everything is clear AND there's nothing reassuring to say
    const shouldStaySilent = riskRank === 0 && environment.detectedLabels.length === 0;

    // 6. Should I interrupt immediately?
    const shouldInterruptImmediately = riskRank >= 4; // critical or high

    // 7. Should I reassure the user?
    const shouldReassure = riskRank <= 1 && environment.detectedLabels.length > 0;

    // 8. Should I predict danger?
    const shouldPredictDanger = risk.predictedEvent !== null && riskRank >= 3;

    // Blended confidence — environment reading + risk certainty
    const blendedConf = environment.confidence * 0.6 + risk.confidence * 0.4;

    return {
      whatIsHappening,
      whatIsLikelyNext,
      isUserSafe,
      needsGuidance,
      shouldStaySilent,
      shouldInterruptImmediately,
      shouldReassure,
      shouldPredictDanger,
      confidence: Math.min(1, Math.max(0, blendedConf)),
    };
  }
}

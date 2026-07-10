/**
 * HumanGuideEngine (V3)
 *
 * Transforms action decisions and cognitive reasoning into natural, human-
 * sounding guidance — the way a skilled sighted guide would speak.
 *
 * GOOD: "The pavement is clear. Keep walking straight."
 *       "There's a cyclist approaching from your left — slow down."
 *       "You're doing fine."
 *
 * BAD:  "Object detected." / "Hazard level medium."
 *
 * Rules:
 *   - Only interrupt for Critical and High priority.
 *   - If confidence < 70%, add an uncertainty note.
 *   - Never sound certain when confidence is low.
 */

import type {
  ActionDecision,
  CognitiveReasoning,
  EnvironmentType,
  EnvironmentUnderstanding,
  HumanGuideMessage,
} from '@/types/reasoning';

const CONFIDENCE_THRESHOLD = 0.7;

const UNCERTAINTY_SUFFIX = "I'm not completely sure — please check carefully.";

const ENVIRONMENT_CONTEXT: Partial<Record<EnvironmentType, string>> = {
  pavement: 'The pavement is clear.',
  traffic: "You're moving beside traffic — stay alert.",
  crossing: "You're near a crossing.",
  market: "You're in a busy area with people around.",
  corridor: "You're in a corridor.",
  train_station: "You're in a busy transit area.",
  supermarket: "You're inside a building.",
  unknown: "I'm scanning your surroundings.",
};

const REASSURANCES = [
  "You're doing fine.",
  "The path ahead looks clear.",
  "Keep walking straight.",
  "All good so far.",
  "The way ahead seems safe.",
];

export class HumanGuideEngine {
  private reassuranceIndex = 0;

  generate(
    action: ActionDecision,
    reasoning: CognitiveReasoning,
    environment: EnvironmentUnderstanding
  ): HumanGuideMessage {
    const isLowConfidence = reasoning.confidence < CONFIDENCE_THRESHOLD;
    const uncertaintyNote = isLowConfidence ? UNCERTAINTY_SUFFIX : null;

    let text: string;

    if (reasoning.shouldInterruptImmediately) {
      // Urgent — use the action instruction directly, clear and short
      text = action.instruction;
    } else if (reasoning.shouldPredictDanger) {
      // Danger coming — give the action instruction with environmental context
      const ctx = ENVIRONMENT_CONTEXT[environment.environmentType];
      text = ctx ? `${ctx} ${action.instruction}` : action.instruction;
    } else if (reasoning.shouldReassure && !reasoning.needsGuidance) {
      // Safe — combine an environment note with a warm reassurance
      const envCtx = ENVIRONMENT_CONTEXT[environment.environmentType] ?? '';
      const reassurance = REASSURANCES[this.reassuranceIndex % REASSURANCES.length];
      this.reassuranceIndex++;
      text = envCtx ? `${envCtx} ${reassurance}` : reassurance;
    } else if (reasoning.needsGuidance) {
      // Guidance needed but not urgent
      text = action.instruction;
    } else {
      // Quiet state — minimal output
      text = action.instruction;
    }

    // Append uncertainty note for non-critical messages
    if (isLowConfidence && !reasoning.shouldInterruptImmediately) {
      text = `${text} ${UNCERTAINTY_SUFFIX}`;
    }

    const shouldSpeak =
      !reasoning.shouldStaySilent || reasoning.shouldInterruptImmediately;

    return {
      text,
      priority: action.priority,
      shouldSpeak,
      uncertaintyNote,
    };
  }

  reset() {
    this.reassuranceIndex = 0;
  }
}

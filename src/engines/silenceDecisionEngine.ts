import type { SceneDescription } from '@/types';
import type {
  ISilenceDecisionEngine,
  SilenceDecision,
  SilenceReason,
  UserState,
} from '@/types/cognitive';

const SILENCE_COOLDOWN_MS = 8000;    // minimum gap between non-urgent narrations
const HIGH_RISK_COOLDOWN_MS = 3000;  // tighter gap during risky movement

function sceneChanged(prev: SceneDescription, next: SceneDescription): boolean {
  const prevLabels = new Set(prev.detections.map((d) => d.label));
  const nextLabels = new Set(next.detections.map((d) => d.label));
  for (const l of nextLabels) if (!prevLabels.has(l)) return true;
  for (const l of prevLabels) if (!nextLabels.has(l)) return true;
  return false;
}

export class SilenceDecisionEngine implements ISilenceDecisionEngine {
  decide(
    scene: SceneDescription,
    userState: UserState,
    lastSpokenMs: number,
    previousScene: SceneDescription | null
  ): SilenceDecision {
    const now = Date.now();
    const msSinceSpeech = now - lastSpokenMs;

    // Never silence during emergency
    if (userState.movement === 'emergency') {
      return { shouldBeSilent: false, reason: null, cooldownRemainingMs: 0 };
    }

    // Risky movement — companion messages must not distract
    if (
      userState.movement === 'crossing_road' ||
      (userState.isAtRisk && userState.speed === 'fast')
    ) {
      return {
        shouldBeSilent: true,
        reason: 'risky_movement',
        cooldownRemainingMs: HIGH_RISK_COOLDOWN_MS,
      };
    }

    // Scene unchanged — nothing new to say
    if (previousScene && !sceneChanged(previousScene, scene)) {
      return {
        shouldBeSilent: true,
        reason: 'no_change',
        cooldownRemainingMs: Math.max(0, SILENCE_COOLDOWN_MS - msSinceSpeech),
      };
    }

    // Still in cooldown window
    if (msSinceSpeech < SILENCE_COOLDOWN_MS) {
      return {
        shouldBeSilent: true,
        reason: 'recently_spoken',
        cooldownRemainingMs: SILENCE_COOLDOWN_MS - msSinceSpeech,
      };
    }

    // Low confidence — don't narrate guesses
    if (scene.confidence < 0.5) {
      return {
        shouldBeSilent: true,
        reason: 'low_confidence',
        cooldownRemainingMs: 0,
      };
    }

    return { shouldBeSilent: false, reason: null, cooldownRemainingMs: 0 };
  }
}

let _instance: SilenceDecisionEngine | null = null;

export function getSilenceEngine(): SilenceDecisionEngine {
  if (!_instance) _instance = new SilenceDecisionEngine();
  return _instance;
}

import type { SceneDescription } from '@/types';
import type {
  ICompanionContextEngine,
  CompanionMessage,
  CompanionTone,
  GuardianAction,
  UserState,
} from '@/types/cognitive';

interface CompanionTemplate {
  matchLabels: string[];
  movement?: UserState['movement'][];
  environment?: UserState['environment'][];
  text: string;
  tone: CompanionTone;
}

const COMPANION_TEMPLATES: CompanionTemplate[] = [
  {
    matchLabels: ['table', 'chair'],
    environment: ['indoor'],
    text: 'You are in a seated area. Take your time.',
    tone: 'reassuring',
  },
  {
    matchLabels: ['pavement'],
    movement: ['walking'],
    environment: ['outdoor'],
    text: 'Path ahead is clear. Continue at your own pace.',
    tone: 'reassuring',
  },
  {
    matchLabels: ['door'],
    text: 'A door or entrance is nearby.',
    tone: 'informative',
  },
  {
    matchLabels: ['person'],
    movement: ['standing', 'waiting'],
    text: 'Someone is nearby. You are not alone.',
    tone: 'reassuring',
  },
  {
    matchLabels: ['road'],
    movement: ['standing', 'waiting'],
    text: 'You appear to be at a roadside. Wait for a safe moment before crossing.',
    tone: 'cautious',
  },
  {
    matchLabels: ['stairs'],
    text: 'Stairs detected. Locate the handrail before you proceed.',
    tone: 'cautious',
  },
];

const SAFE_MOVEMENT: UserState['movement'][] = ['standing', 'walking', 'waiting'];

export class CompanionContextEngine implements ICompanionContextEngine {
  compose(
    scene: SceneDescription,
    userState: UserState,
    guardianAction: GuardianAction
  ): CompanionMessage {
    // Companion messages must never distract during risky movement
    const isRisky =
      userState.movement === 'crossing_road' ||
      userState.movement === 'emergency' ||
      userState.isAtRisk;

    if (isRisky) {
      return {
        text: '',
        tone: 'silent',
        isAppropriate: false,
        suppressedReason: 'User is in a risky movement state — companion messages suppressed.',
      };
    }

    // If the guardian is already warning, companion must stay silent
    if (guardianAction === 'warn') {
      return {
        text: '',
        tone: 'silent',
        isAppropriate: false,
        suppressedReason: 'Warning in progress — companion suppressed.',
      };
    }

    const detectedLabels = new Set(scene.detections.map((d) => d.label));

    for (const tmpl of COMPANION_TEMPLATES) {
      const labelMatch = tmpl.matchLabels.some((l) => detectedLabels.has(l));
      if (!labelMatch) continue;

      const movementMatch =
        !tmpl.movement || tmpl.movement.includes(userState.movement as UserState['movement']);
      if (!movementMatch) continue;

      const envMatch =
        !tmpl.environment || tmpl.environment.includes(userState.environment);
      if (!envMatch) continue;

      return { text: tmpl.text, tone: tmpl.tone, isAppropriate: true };
    }

    // Generic fallback only if scene is clear and user is stationary
    if (
      !scene.isUncertain &&
      SAFE_MOVEMENT.includes(userState.movement as UserState['movement']) &&
      userState.movement === 'standing'
    ) {
      return {
        text: 'Everything seems calm around you.',
        tone: 'reassuring',
        isAppropriate: true,
      };
    }

    return { text: '', tone: 'silent', isAppropriate: false };
  }
}

let _instance: CompanionContextEngine | null = null;

export function getCompanionEngine(): CompanionContextEngine {
  if (!_instance) _instance = new CompanionContextEngine();
  return _instance;
}

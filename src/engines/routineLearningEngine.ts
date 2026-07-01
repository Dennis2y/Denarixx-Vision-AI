import { v4 as uuidv4 } from 'uuid';
import type { SceneDescription } from '@/types';
import type {
  IRoutineLearningEngine,
  RoutineLearningState,
  RoutinePattern,
} from '@/types/cognitive';

const SIGNATURE_MATCH_THRESHOLD = 0.6; // fraction of signature labels that must be present

const SEED_PATTERNS: Omit<RoutinePattern, 'id' | 'frequency' | 'lastSeen'>[] = [
  {
    label: 'Road crossing',
    detectionSignatures: ['vehicle', 'road', 'pavement'],
    typicalDuration: 15,
    associatedRisks: ['vehicle', 'bicycle'],
  },
  {
    label: 'Indoor navigation',
    detectionSignatures: ['table', 'chair', 'door'],
    typicalDuration: 60,
    associatedRisks: ['obstacle', 'step'],
  },
  {
    label: 'Pavement walk',
    detectionSignatures: ['pavement', 'person'],
    typicalDuration: 120,
    associatedRisks: ['step', 'bicycle'],
  },
  {
    label: 'Entrance approach',
    detectionSignatures: ['door', 'stairs', 'text'],
    typicalDuration: 20,
    associatedRisks: ['stairs', 'step'],
  },
];

export class RoutineLearningEngine implements IRoutineLearningEngine {
  private state: RoutineLearningState;

  constructor() {
    this.state = {
      patterns: SEED_PATTERNS.map((p) => ({
        ...p,
        id: uuidv4(),
        frequency: 0,
        lastSeen: new Date(0),
      })),
      currentMatch: null,
      sessionCount: 0,
    };
  }

  observe(scene: SceneDescription): void {
    this.state.sessionCount++;
    const match = this.matchCurrentRoutine(scene);
    if (match) {
      match.frequency++;
      match.lastSeen = new Date();
      this.state.currentMatch = match;
    } else {
      // Learn a new pattern from this scene if it has enough signals
      if (scene.detections.length >= 2 && !scene.isUncertain) {
        const signature = scene.detections
          .filter((d) => d.confidence >= 0.7)
          .map((d) => d.label);
        if (signature.length >= 2) {
          const newPattern: RoutinePattern = {
            id: uuidv4(),
            label: `Observed scene (${signature.slice(0, 2).join('+')})`,
            detectionSignatures: signature,
            frequency: 1,
            lastSeen: new Date(),
            typicalDuration: 30,
            associatedRisks: signature.filter((l) =>
              ['vehicle', 'obstacle', 'step', 'stairs', 'bicycle'].includes(l)
            ),
          };
          this.state.patterns.push(newPattern);
          this.state.currentMatch = newPattern;
        }
      }
    }
  }

  matchCurrentRoutine(scene: SceneDescription): RoutinePattern | null {
    const detectedLabels = new Set(scene.detections.map((d) => d.label));
    let best: RoutinePattern | null = null;
    let bestScore = 0;

    for (const pattern of this.state.patterns) {
      const matches = pattern.detectionSignatures.filter((l) =>
        detectedLabels.has(l)
      ).length;
      const score = matches / pattern.detectionSignatures.length;
      if (score >= SIGNATURE_MATCH_THRESHOLD && score > bestScore) {
        bestScore = score;
        best = pattern;
      }
    }

    return best;
  }

  getState(): RoutineLearningState {
    return { ...this.state, patterns: [...this.state.patterns] };
  }
}

let _instance: RoutineLearningEngine | null = null;

export function getRoutineLearningEngine(): RoutineLearningEngine {
  if (!_instance) _instance = new RoutineLearningEngine();
  return _instance;
}

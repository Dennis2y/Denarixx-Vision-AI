import { v4 as uuidv4 } from 'uuid';
import type { SceneDescription, HazardAlert } from '@/types';
import type {
  IPredictiveRiskEngine,
  PredictedRisk,
  UserState,
} from '@/types/cognitive';
import { SAFETY_DISCLAIMER } from './types';

interface RiskRule {
  triggerLabels: string[];
  condition?: (userState: UserState) => boolean;
  risk: Omit<PredictedRisk, 'id' | 'triggerLabels'>;
}

const RISK_RULES: RiskRule[] = [
  {
    triggerLabels: ['vehicle', 'road'],
    risk: {
      description: 'Vehicle on road ahead — risk of collision if path continues.',
      likelihood: 0.82,
      horizon: 'immediate',
      severity: 'critical',
      actionHint: 'Stop and wait. Do not step into the road.',
      disclaimer: SAFETY_DISCLAIMER,
    },
  },
  {
    triggerLabels: ['bicycle'],
    condition: (s) => s.movement === 'walking',
    risk: {
      description: 'Bicycle nearby — may be moving. Potential crossing path.',
      likelihood: 0.65,
      horizon: 'near',
      severity: 'high',
      actionHint: 'Pause and listen for movement direction.',
      disclaimer: SAFETY_DISCLAIMER,
    },
  },
  {
    triggerLabels: ['step', 'pavement'],
    condition: (s) => s.speed !== 'stationary',
    risk: {
      description: 'Step or kerb change ahead — fall risk if pace continues.',
      likelihood: 0.75,
      horizon: 'immediate',
      severity: 'high',
      actionHint: 'Slow down and feel ahead carefully.',
      disclaimer: SAFETY_DISCLAIMER,
    },
  },
  {
    triggerLabels: ['stairs'],
    risk: {
      description: 'Stairs detected — risk of fall without handrail contact.',
      likelihood: 0.80,
      horizon: 'immediate',
      severity: 'high',
      actionHint: 'Locate the handrail before proceeding.',
      disclaimer: SAFETY_DISCLAIMER,
    },
  },
  {
    triggerLabels: ['obstacle'],
    condition: (s) => s.movement === 'walking',
    risk: {
      description: 'Obstruction in path — collision likely if walking continues.',
      likelihood: 0.78,
      horizon: 'immediate',
      severity: 'high',
      actionHint: 'Stop and navigate around the obstacle.',
      disclaimer: SAFETY_DISCLAIMER,
    },
  },
  {
    triggerLabels: ['person', 'road'],
    risk: {
      description: 'Person near road — shared crossing risk.',
      likelihood: 0.50,
      horizon: 'near',
      severity: 'medium',
      actionHint: 'Follow pedestrian flow carefully.',
      disclaimer: SAFETY_DISCLAIMER,
    },
  },
  {
    triggerLabels: ['vehicle'],
    condition: (s) => s.movement === 'crossing_road',
    risk: {
      description: 'Vehicle detected while crossing — immediate collision risk.',
      likelihood: 0.91,
      horizon: 'immediate',
      severity: 'critical',
      actionHint: 'Stop immediately. Do not move forward.',
      disclaimer: SAFETY_DISCLAIMER,
    },
  },
];

export class PredictiveRiskEngine implements IPredictiveRiskEngine {
  predict(
    scene: SceneDescription,
    userState: UserState,
    alerts: HazardAlert[]
  ): PredictedRisk[] {
    const detectedLabels = new Set(scene.detections.map((d) => d.label));

    const risks: PredictedRisk[] = [];

    for (const rule of RISK_RULES) {
      const triggered = rule.triggerLabels.some((l) => detectedLabels.has(l));
      if (!triggered) continue;
      if (rule.condition && !rule.condition(userState)) continue;

      // Adjust likelihood based on alert confidence and user state
      let likelihood = rule.risk.likelihood;
      const matchingAlert = alerts.find((a) =>
        rule.triggerLabels.includes(a.type)
      );
      if (matchingAlert) {
        likelihood = Math.min(1, likelihood * (0.7 + matchingAlert.confidence * 0.3));
      }
      if (userState.speed === 'fast') likelihood = Math.min(1, likelihood * 1.1);

      risks.push({
        id: uuidv4(),
        ...rule.risk,
        likelihood,
        triggerLabels: rule.triggerLabels,
      });
    }

    // Deduplicate by severity, keep highest likelihood per horizon
    const seen = new Map<string, PredictedRisk>();
    for (const r of risks) {
      const key = `${r.horizon}:${r.severity}`;
      const existing = seen.get(key);
      if (!existing || r.likelihood > existing.likelihood) seen.set(key, r);
    }

    return Array.from(seen.values()).sort((a, b) => {
      const horizonOrder = { immediate: 3, near: 2, potential: 1 };
      return horizonOrder[b.horizon] - horizonOrder[a.horizon];
    });
  }
}

let _instance: PredictiveRiskEngine | null = null;

export function getPredictiveRiskEngine(): PredictiveRiskEngine {
  if (!_instance) _instance = new PredictiveRiskEngine();
  return _instance;
}

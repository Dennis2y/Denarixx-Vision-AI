import { v4 as uuidv4 } from 'uuid';
import type { Detection } from '@/types';
import type { ProactiveAlert, RiskLevel } from '@/types/cognitive';

interface ProactiveRule {
  label: string;
  riskLevel: RiskLevel;
  anticipatedSeconds: number;
  messageTemplate: (confidence: number) => string;
}

const PROACTIVE_RULES: ProactiveRule[] = [
  {
    label: 'vehicle',
    riskLevel: 'high',
    anticipatedSeconds: 3,
    messageTemplate: (c) =>
      c >= 0.7
        ? 'Vehicle may be approaching. Get ready to stop.'
        : 'There might be a vehicle in the area. Move with caution.',
  },
  {
    label: 'bicycle',
    riskLevel: 'medium',
    anticipatedSeconds: 5,
    messageTemplate: (c) =>
      c >= 0.7
        ? 'A cyclist might cross your path. Slow down and wait a moment.'
        : 'Possible cyclist nearby — keep to the side.',
  },
  {
    label: 'step',
    riskLevel: 'medium',
    anticipatedSeconds: 4,
    messageTemplate: (c) =>
      c >= 0.6
        ? 'Elevation change coming up — reduce your pace.'
        : 'There may be a step change ahead. Check with your foot as you move.',
  },
  {
    label: 'stairs',
    riskLevel: 'medium',
    anticipatedSeconds: 4,
    messageTemplate: (c) =>
      c >= 0.6
        ? 'Stairs are coming up. Slow down and reach for a railing.'
        : "I think there may be stairs ahead — be ready to slow down.",
  },
  {
    label: 'obstacle',
    riskLevel: 'medium',
    anticipatedSeconds: 3,
    messageTemplate: (c) =>
      c >= 0.7
        ? "Something's in your path. Slow down now."
        : 'There might be something ahead. Check before continuing.',
  },
  {
    label: 'person',
    riskLevel: 'low',
    anticipatedSeconds: 6,
    messageTemplate: (c) =>
      c >= 0.8
        ? 'Someone is ahead — you may need to navigate around them.'
        : 'There might be someone nearby.',
  },
];

const RISK_ORDER: Record<RiskLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export class ProactiveAlertEngine {
  private confidenceThreshold: number;

  constructor(confidenceThreshold = 0.4) {
    this.confidenceThreshold = confidenceThreshold;
  }

  generate(detections: Detection[]): ProactiveAlert[] {
    const alerts: ProactiveAlert[] = [];

    for (const detection of detections) {
      if (detection.confidence < this.confidenceThreshold) continue;

      const rule = PROACTIVE_RULES.find((r) => r.label === detection.label);
      if (!rule) continue;

      alerts.push({
        id: uuidv4(),
        message: rule.messageTemplate(detection.confidence),
        riskLevel: rule.riskLevel,
        confidence: detection.confidence,
        anticipatedIn: rule.anticipatedSeconds,
        triggerLabel: detection.label,
        timestamp: new Date(),
      });
    }

    return alerts.sort(
      (a, b) => (RISK_ORDER[b.riskLevel] ?? 0) - (RISK_ORDER[a.riskLevel] ?? 0)
    );
  }

  setConfidenceThreshold(threshold: number) {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  getThreshold(): number {
    return this.confidenceThreshold;
  }
}

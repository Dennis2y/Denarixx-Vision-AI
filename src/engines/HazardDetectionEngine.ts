import { v4 as uuidv4 } from 'uuid';
import type { IHazardDetectionEngine } from './types';
import { uncertaintyMessage, SAFETY_DISCLAIMER } from './types';
import type { Detection, HazardAlert, HazardSeverity } from '@/types';

interface HazardRule {
  label: string;
  severity: HazardSeverity;
  messageTemplate: (confidence: number) => string;
  interruptThreshold: number;
}

const HAZARD_RULES: HazardRule[] = [
  {
    label: 'vehicle',
    severity: 'critical',
    messageTemplate: (c) =>
      c >= 0.85
        ? 'Vehicle approaching — please stop and wait for it to pass.'
        : "Something that may be a vehicle is nearby. Please check carefully before moving.",
    interruptThreshold: 0.6,
  },
  {
    label: 'obstacle',
    severity: 'high',
    messageTemplate: (c) =>
      c >= 0.85
        ? "There's an obstacle in your path ahead. I'd recommend pausing."
        : "Something may be blocking your path. I'm not fully certain — check carefully.",
    interruptThreshold: 0.65,
  },
  {
    label: 'step',
    severity: 'high',
    messageTemplate: (c) =>
      c >= 0.75
        ? 'Step down ahead. Use your cane or foot to confirm, then take it slowly.'
        : "There may be a step ahead. I'm not certain — feel ahead carefully.",
    interruptThreshold: 0.55,
  },
  {
    label: 'stairs',
    severity: 'high',
    messageTemplate: (c) =>
      c >= 0.75
        ? 'Stairs are ahead. Grip the handrail if available and take your time.'
        : "I think there may be stairs ahead. Please check carefully before continuing.",
    interruptThreshold: 0.55,
  },
  {
    label: 'bicycle',
    severity: 'medium',
    messageTemplate: (c) =>
      c >= 0.7
        ? 'Cyclist may be approaching from your left. Pause a moment and let them pass.'
        : "There might be a bicycle nearby. I'm not fully sure — stay alert.",
    interruptThreshold: 0.7,
  },
  {
    label: 'person',
    severity: 'low',
    messageTemplate: (c) =>
      c >= 0.8
        ? 'Someone is just ahead of you.'
        : 'There may be someone nearby.',
    interruptThreshold: 0.85,
  },
];

const HAZARD_LABELS = new Set(HAZARD_RULES.map((r) => r.label));

export class HazardDetectionEngine implements IHazardDetectionEngine {
  async evaluate(detections: Detection[]): Promise<HazardAlert[]> {
    const alerts: HazardAlert[] = [];

    for (const detection of detections) {
      const rule = HAZARD_RULES.find((r) => r.label === detection.label);
      if (!rule) continue;
      if (!HAZARD_LABELS.has(detection.label)) continue;

      const description = rule.messageTemplate(detection.confidence);
      const shouldInterrupt = detection.confidence >= rule.interruptThreshold;
      const uncert = uncertaintyMessage(detection.confidence);

      alerts.push({
        id: uuidv4(),
        type: detection.label,
        description,
        severity: rule.severity,
        confidence: detection.confidence,
        timestamp: new Date(),
        shouldInterrupt,
        disclaimer: uncert ? `${uncert} ${SAFETY_DISCLAIMER}` : SAFETY_DISCLAIMER,
      });
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const diff =
        (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
      return diff !== 0 ? diff : b.confidence - a.confidence;
    });
  }
}

let _instance: HazardDetectionEngine | null = null;

export function getHazardEngine(): HazardDetectionEngine {
  if (!_instance) _instance = new HazardDetectionEngine();
  return _instance;
}

import { v4 as uuidv4 } from 'uuid';
import type { IHazardDetectionEngine } from './types';
import { uncertaintyMessage, SAFETY_DISCLAIMER } from './types';
import type { Detection, HazardAlert, HazardSeverity } from '@/types';

interface HazardRule {
  label: string;
  severity: HazardSeverity;
  messageTemplate: (confidence: number) => string;
  interruptThreshold: number; // confidence above which we interrupt narration
}

const HAZARD_RULES: HazardRule[] = [
  {
    label: 'vehicle',
    severity: 'critical',
    messageTemplate: (c) =>
      c >= 0.85
        ? 'Warning: vehicle detected ahead. Confidence high. Stop and wait.'
        : "Possible vehicle nearby. I'm not fully sure. Please check carefully.",
    interruptThreshold: 0.6,
  },
  {
    label: 'obstacle',
    severity: 'high',
    messageTemplate: (c) =>
      c >= 0.85
        ? 'Obstacle ahead, about two metres away. Confidence ' + Math.round(c * 100) + '%.'
        : "Possible obstacle ahead. I'm not fully sure. Please check carefully.",
    interruptThreshold: 0.65,
  },
  {
    label: 'step',
    severity: 'high',
    messageTemplate: (c) =>
      c >= 0.75
        ? 'Step detected ahead. Take care.'
        : "Possible step down ahead. I'm not fully sure. Please check carefully.",
    interruptThreshold: 0.55,
  },
  {
    label: 'stairs',
    severity: 'high',
    messageTemplate: (c) =>
      c >= 0.75
        ? 'Stairs ahead. Confidence ' + Math.round(c * 100) + '%.'
        : "Stairs may be ahead. I'm not fully sure. Please check carefully.",
    interruptThreshold: 0.55,
  },
  {
    label: 'bicycle',
    severity: 'medium',
    messageTemplate: (c) =>
      c >= 0.7
        ? 'A bicycle may cross your path from the left.'
        : "Possible bicycle nearby. Confidence low. Please check carefully.",
    interruptThreshold: 0.7,
  },
  {
    label: 'person',
    severity: 'low',
    messageTemplate: (c) =>
      c >= 0.8
        ? 'A person is ahead.'
        : 'A person may be nearby.',
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

    // Sort: critical first, then by confidence descending
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

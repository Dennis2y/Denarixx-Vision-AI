/**
 * EnvironmentUnderstandingEngine (V3)
 *
 * Instead of evaluating objects individually, this engine understands the
 * overall environment from the full set of detections and describes it in
 * natural language — e.g. "Walking on pavement", "Approaching a pedestrian
 * crossing", "Moving beside traffic".
 */

import type { Detection } from '@/types';
import type { EnvironmentUnderstanding, EnvironmentType } from '@/types/reasoning';

interface EnvironmentRule {
  requiredLabels: string[];
  optionalBoost?: string[];
  type: EnvironmentType;
  summary: string;
  isIndoor: boolean;
  priority: number;
}

const RULES: EnvironmentRule[] = [
  // Traffic / vehicle scenarios
  {
    requiredLabels: ['vehicle', 'road'],
    type: 'traffic',
    summary: 'Moving beside traffic',
    isIndoor: false,
    priority: 10,
  },
  {
    requiredLabels: ['vehicle'],
    optionalBoost: ['road', 'pavement'],
    type: 'crossing',
    summary: 'Approaching a pedestrian crossing',
    isIndoor: false,
    priority: 9,
  },

  // Staircase / elevation
  {
    requiredLabels: ['stairs'],
    type: 'corridor',
    summary: 'Approaching a staircase',
    isIndoor: true,
    priority: 8,
  },
  {
    requiredLabels: ['step'],
    optionalBoost: ['obstacle'],
    type: 'corridor',
    summary: 'Entering a corridor with elevation changes',
    isIndoor: true,
    priority: 7,
  },

  // Crowded outdoor
  {
    requiredLabels: ['bicycle', 'person'],
    type: 'market',
    summary: 'Walking through a busy shared area',
    isIndoor: false,
    priority: 6,
  },
  {
    requiredLabels: ['bicycle'],
    type: 'pavement',
    summary: 'On a shared path with cyclists',
    isIndoor: false,
    priority: 5,
  },

  // Indoor obstacle
  {
    requiredLabels: ['obstacle'],
    optionalBoost: ['pavement'],
    type: 'corridor',
    summary: 'Entering a narrow corridor',
    isIndoor: true,
    priority: 4,
  },

  // People navigation
  {
    requiredLabels: ['person'],
    type: 'market',
    summary: 'Navigating near people',
    isIndoor: false,
    priority: 3,
  },

  // Road / crossing without vehicle
  {
    requiredLabels: ['road', 'pavement'],
    type: 'crossing',
    summary: 'Near a pedestrian crossing',
    isIndoor: false,
    priority: 2,
  },

  // Clear pavement
  {
    requiredLabels: ['pavement'],
    type: 'pavement',
    summary: 'Walking on pavement',
    isIndoor: false,
    priority: 1,
  },
];

export class EnvironmentUnderstandingEngine {
  understand(detections: Detection[]): EnvironmentUnderstanding {
    const labelSet = new Set(detections.map((d) => d.label.toLowerCase()));
    const labels = [...labelSet];
    const avgConf =
      detections.length > 0
        ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length
        : 0;

    const matched = RULES.filter((r) =>
      r.requiredLabels.every((l) => labelSet.has(l))
    ).sort((a, b) => b.priority - a.priority)[0];

    if (!matched) {
      return {
        summary:
          detections.length === 0
            ? 'Surroundings unclear — scanning.'
            : 'Unfamiliar environment — proceed carefully.',
        environmentType: 'unknown',
        confidence: avgConf,
        detectedLabels: labels,
        isIndoor: false,
      };
    }

    return {
      summary: matched.summary,
      environmentType: matched.type,
      confidence: avgConf,
      detectedLabels: labels,
      isIndoor: matched.isIndoor,
    };
  }
}

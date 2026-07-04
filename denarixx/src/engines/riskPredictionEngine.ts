/**
 * RiskPredictionEngine (V3)
 *
 * Predicts specific events before they become dangerous, providing a natural-
 * language predicted event, a risk level, a list of contributing factors, and
 * an estimated time-to-impact in seconds.
 *
 * NOTE: This is the V3 engine. The V2 engine is PredictiveRiskEngine in
 * predictiveRiskEngine.ts — this file is separate.
 */

import type { Detection } from '@/types';
import type {
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

interface PredictionRule {
  label: string;
  minConfidence: number;
  predictedEvent: string;
  riskLevel: ReasoningRiskLevel;
  timeToImpactSeconds: number;
  factor: (confidence: number) => string;
}

const PREDICTION_RULES: PredictionRule[] = [
  {
    label: 'vehicle',
    minConfidence: 0.8,
    predictedEvent: 'Vehicle may be turning toward crossing — risk of collision',
    riskLevel: 'critical',
    timeToImpactSeconds: 2,
    factor: (c) => `High-confidence vehicle (${Math.round(c * 100)}%)`,
  },
  {
    label: 'vehicle',
    minConfidence: 0.4,
    predictedEvent: 'Vehicle approaching your position',
    riskLevel: 'high',
    timeToImpactSeconds: 4,
    factor: (c) => `Vehicle detected (${Math.round(c * 100)}%)`,
  },
  {
    label: 'bicycle',
    minConfidence: 0.7,
    predictedEvent: 'Cyclist may suddenly change direction',
    riskLevel: 'medium',
    timeToImpactSeconds: 5,
    factor: (c) => `Cyclist nearby (${Math.round(c * 100)}%)`,
  },
  {
    label: 'bicycle',
    minConfidence: 0.4,
    predictedEvent: 'Fast bicycle approaching from nearby',
    riskLevel: 'medium',
    timeToImpactSeconds: 6,
    factor: (c) => `Possible cyclist (${Math.round(c * 100)}%)`,
  },
  {
    label: 'stairs',
    minConfidence: 0.5,
    predictedEvent: 'Staircase ahead — risk of fall if unprepared',
    riskLevel: 'high',
    timeToImpactSeconds: 3,
    factor: (c) => `Stairs detected (${Math.round(c * 100)}%)`,
  },
  {
    label: 'step',
    minConfidence: 0.4,
    predictedEvent: 'Step down ahead — uneven surface approaching',
    riskLevel: 'medium',
    timeToImpactSeconds: 3,
    factor: (c) => `Step change detected (${Math.round(c * 100)}%)`,
  },
  {
    label: 'obstacle',
    minConfidence: 0.65,
    predictedEvent: 'Object blocking path directly',
    riskLevel: 'medium',
    timeToImpactSeconds: 3,
    factor: (c) => `Obstacle confirmed (${Math.round(c * 100)}%)`,
  },
  {
    label: 'obstacle',
    minConfidence: 0.3,
    predictedEvent: 'Possible object in path — verification needed',
    riskLevel: 'low',
    timeToImpactSeconds: 5,
    factor: (c) => `Possible obstacle (${Math.round(c * 100)}%)`,
  },
  {
    label: 'person',
    minConfidence: 0.7,
    predictedEvent: 'Person ahead may change direction or stop suddenly',
    riskLevel: 'low',
    timeToImpactSeconds: 6,
    factor: (c) => `Person ahead (${Math.round(c * 100)}%)`,
  },
];

export class RiskPredictionEngine {
  predict(
    detections: Detection[],
    _environment: EnvironmentUnderstanding
  ): V3RiskPrediction {
    const factors: string[] = [];
    let topEvent: string | null = null;
    let topRisk: ReasoningRiskLevel = 'none';
    let topTime: number | null = null;

    for (const detection of detections) {
      const label = detection.label.toLowerCase();
      // Match highest-priority (first matching) rule per label
      const rule = PREDICTION_RULES.find(
        (r) => r.label === label && detection.confidence >= r.minConfidence
      );
      if (!rule) continue;

      factors.push(rule.factor(detection.confidence));

      if (RISK_ORDER[rule.riskLevel] > RISK_ORDER[topRisk]) {
        topRisk = rule.riskLevel;
        topEvent = rule.predictedEvent;
        topTime = rule.timeToImpactSeconds;
      }
    }

    const overallConf =
      detections.length > 0
        ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length
        : 0;

    return {
      predictedEvent: topEvent,
      riskLevel: topRisk,
      confidence: overallConf,
      factors,
      timeToImpactSeconds: topTime,
    };
  }
}

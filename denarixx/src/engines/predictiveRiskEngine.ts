import type { Detection } from '@/types';
import type { RiskPrediction, RiskLevel } from '@/types/cognitive';

interface HistoryEntry {
  detection: Detection;
  timestamp: Date;
}

const RISK_ORDER: Record<RiskLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

function elevateRisk(current: RiskLevel, candidate: RiskLevel): RiskLevel {
  return (RISK_ORDER[candidate] ?? 0) > (RISK_ORDER[current] ?? 0) ? candidate : current;
}

export class PredictiveRiskEngine {
  private history: HistoryEntry[] = [];
  private maxHistoryLength = 20;

  addFrame(detections: Detection[]) {
    const now = new Date();
    for (const detection of detections) {
      this.history.push({ detection, timestamp: now });
    }
    if (this.history.length > this.maxHistoryLength) {
      this.history = this.history.slice(-this.maxHistoryLength);
    }
  }

  predict(timeHorizonSeconds = 5): RiskPrediction {
    if (this.history.length === 0) {
      return {
        predictedRisk: 'none',
        confidence: 0.9,
        timeHorizonSeconds,
        factors: [],
        reasoning: 'No detection history available.',
      };
    }

    const cutoff = new Date(Date.now() - 10_000);
    const recent = this.history.filter((h) => h.timestamp >= cutoff);

    const factors: string[] = [];
    let maxRisk: RiskLevel = 'none';
    let totalConfidence = 0;
    let count = 0;

    for (const h of recent) {
      const { label, confidence } = h.detection;

      if (label === 'vehicle') {
        factors.push(`Vehicle detected (${Math.round(confidence * 100)}%)`);
        maxRisk = elevateRisk(maxRisk, confidence >= 0.7 ? 'high' : 'medium');
        totalConfidence += confidence;
        count++;
      } else if (label === 'obstacle' || label === 'step' || label === 'stairs') {
        factors.push(`${label} detected (${Math.round(confidence * 100)}%)`);
        maxRisk = elevateRisk(maxRisk, 'medium');
        totalConfidence += confidence;
        count++;
      } else if (label === 'bicycle' || label === 'person') {
        factors.push(`${label} detected (${Math.round(confidence * 100)}%)`);
        maxRisk = elevateRisk(maxRisk, 'low');
        totalConfidence += confidence * 0.5;
        count++;
      }
    }

    // Sustained vehicle presence escalates to critical
    const vehicleCount = recent.filter((h) => h.detection.label === 'vehicle').length;
    if (vehicleCount >= 2) {
      maxRisk = 'critical';
      factors.push('Repeated vehicle detections — sustained hazard');
    }

    const avgConf = count > 0 ? Math.min(totalConfidence / count + 0.1, 1.0) : 0.5;
    const reasoning =
      factors.length === 0
        ? 'No hazardous objects detected recently.'
        : `Factors: ${factors.join('; ')}.`;

    return {
      predictedRisk: maxRisk,
      confidence: avgConf,
      timeHorizonSeconds,
      factors,
      reasoning,
    };
  }

  clearHistory() {
    this.history = [];
  }

  getHistoryLength(): number {
    return this.history.length;
  }
}

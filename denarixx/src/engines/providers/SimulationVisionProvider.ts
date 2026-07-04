/**
 * SimulationVisionProvider (V4)
 *
 * Wraps MockVisionProvider to produce a full VisionAnalysisV4 from synthetic
 * detections. This is the default provider when VISION_PROVIDER=simulation
 * (or when no env var is set). No API calls are made.
 */

import { MockVisionProvider } from './MockVisionProvider';
import type { VisionAnalysisProvider, VisionAnalysisV4 } from '@/types/vision';
import type { VisionFrame, HazardSeverity } from '@/types';

const HAZARD_LABELS = new Set(['vehicle', 'bicycle', 'obstacle', 'step', 'stairs']);

const ENVIRONMENT_SUMMARIES: Record<string, string> = {
  vehicle: 'Moving near traffic',
  stairs: 'Approaching a staircase',
  step: 'Entering a corridor with elevation changes',
  obstacle: 'Navigating around an obstacle in path',
  bicycle: 'On a shared path with cyclists',
  person: 'Navigating near people',
  road: 'Near a road or crossing',
  pavement: 'Walking on pavement',
};

function buildEnvironmentSummary(labels: string[]): string {
  for (const label of ['vehicle', 'stairs', 'step', 'obstacle', 'bicycle', 'person', 'road', 'pavement']) {
    if (labels.includes(label)) {
      return ENVIRONMENT_SUMMARIES[label] ?? 'Scanning surroundings';
    }
  }
  return labels.length > 0 ? `Detected: ${labels.slice(0, 3).join(', ')}` : 'Surroundings unclear — scanning';
}

function confidenceToSeverity(confidence: number, label: string): HazardSeverity {
  if (label === 'vehicle') return confidence >= 0.85 ? 'critical' : 'high';
  if (label === 'stairs' || label === 'step') return confidence >= 0.75 ? 'high' : 'medium';
  if (label === 'obstacle') return confidence >= 0.8 ? 'high' : 'medium';
  return 'medium';
}

export class SimulationVisionProvider implements VisionAnalysisProvider {
  readonly providerName = 'SimulationVisionProvider';
  readonly isRealAI = false;
  private mock = new MockVisionProvider();

  async analyzeFrameV4(
    frame: VisionFrame,
    _imageData: string | null
  ): Promise<VisionAnalysisV4> {
    const detections = await this.mock.analyzeFrame(frame);
    const labels = detections.map((d) => d.label.toLowerCase());

    const hazards = detections
      .filter((d) => HAZARD_LABELS.has(d.label))
      .map((d) => ({
        type: d.label,
        severity: confidenceToSeverity(d.confidence, d.label),
        confidence: d.confidence,
        description: `${d.label} detected at ${Math.round(d.confidence * 100)}% confidence (simulation).`,
      }));

    const topHazard = hazards[0];
    const recommendedAction =
      topHazard?.severity === 'critical'
        ? 'Stop immediately — hazard detected.'
        : topHazard?.severity === 'high'
        ? 'Slow down and proceed with caution.'
        : hazards.length > 0
        ? 'Stay alert — something nearby needs attention.'
        : 'Path looks clear — continue walking.';

    const avgConf =
      detections.length > 0
        ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length
        : 0.5;

    return {
      environment: buildEnvironmentSummary(labels),
      objects: detections,
      hazards,
      confidence: avgConf,
      recommendedAction,
      reasoning:
        hazards.length > 0
          ? `Simulation detected ${hazards.map((h) => h.type).join(', ')} — synthetic data only.`
          : 'No significant hazards in synthetic frame.',
      provider: this.providerName,
      isRealAI: false,
      usedFallback: false,
    };
  }
}

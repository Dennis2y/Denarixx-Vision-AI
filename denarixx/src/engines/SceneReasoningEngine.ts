import type { ISceneReasoningEngine } from './types';
import { uncertaintyMessage } from './types';
import type { VisionFrame, Detection, SceneDescription } from '@/types';

interface SceneTemplate {
  labels: string[];
  summary: (detections: Detection[]) => string;
  confidence: number;
}

const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    labels: ['vehicle', 'road'],
    summary: () => 'You appear to be near a road with vehicle traffic.',
    confidence: 0.88,
  },
  {
    labels: ['person', 'pavement'],
    summary: (d) => {
      const people = d.filter((x) => x.label === 'person').length;
      return `${people === 1 ? 'One person is' : `${people} people are`} ahead on the pavement.`;
    },
    confidence: 0.85,
  },
  {
    labels: ['step', 'pavement'],
    summary: () => 'You are approaching a step or kerb on the pavement.',
    confidence: 0.72,
  },
  {
    labels: ['stairs'],
    summary: () => 'There are stairs ahead.',
    confidence: 0.8,
  },
  {
    labels: ['table', 'chair'],
    summary: () => 'You appear to be in an indoor space with seating — possibly a café or office.',
    confidence: 0.82,
  },
  {
    labels: ['door', 'text'],
    summary: () => 'You are near a door or entrance. There is text that may be a sign.',
    confidence: 0.79,
  },
  {
    labels: ['obstacle'],
    summary: () => 'There is an obstruction in your path.',
    confidence: 0.83,
  },
  {
    labels: ['bicycle'],
    summary: () => 'A bicycle is nearby. It may be moving.',
    confidence: 0.76,
  },
];

function pickTemplate(detections: Detection[]): SceneTemplate | null {
  const labels = new Set(detections.map((d) => d.label));
  for (const t of SCENE_TEMPLATES) {
    if (t.labels.some((l) => labels.has(l))) return t;
  }
  return null;
}

export class SceneReasoningEngine implements ISceneReasoningEngine {
  async describe(frame: VisionFrame, detections: Detection[]): Promise<SceneDescription> {
    // Simulate cloud processing latency
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));

    const template = pickTemplate(detections);

    if (!template || detections.length === 0) {
      return {
        summary: 'The scene is unclear. No significant objects detected.',
        confidence: 0.4,
        detections,
        timestamp: new Date(),
        isUncertain: true,
        uncertaintyMessage: "I'm not sure what's around you. Please check carefully.",
      };
    }

    // Average confidence of top 3 detections
    const avgConf =
      detections
        .slice(0, 3)
        .reduce((s, d) => s + d.confidence, 0) / Math.min(3, detections.length);

    const effectiveConf = Math.min(template.confidence, avgConf + 0.05);
    const uncert = uncertaintyMessage(effectiveConf);

    return {
      summary: template.summary(detections),
      confidence: effectiveConf,
      detections,
      timestamp: new Date(),
      isUncertain: effectiveConf < 0.7,
      uncertaintyMessage: uncert,
    };
  }
}

let _instance: SceneReasoningEngine | null = null;

export function getSceneEngine(): SceneReasoningEngine {
  if (!_instance) _instance = new SceneReasoningEngine();
  return _instance;
}

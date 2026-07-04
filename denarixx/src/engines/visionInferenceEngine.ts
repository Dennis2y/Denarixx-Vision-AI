// ─── V12 Vision Inference Engine ─────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Top-level orchestrator: simulation, prioritization, speech guidance, frame building.

import type {
  DetectedObject,
  PerceptionFrame,
  PipelineConfig,
  SceneUnderstanding,
  ObjectLabel,
  ObjectPriority,
  BoundingBox,
  InferenceProvider,
} from '@/types/vision12';
import { PRIORITY_ORDER, PIPELINE_PRIVACY } from '@/types/vision12';
import {
  estimateDepthFromBox,
  assignObjectPriority,
} from '@/engines/depthReasoningEngine';
import { buildSceneUnderstanding } from '@/engines/sceneUnderstandingEngine';

// ─── Re-export for consumers ──────────────────────────────────────────────────
export { assignObjectPriority };

// ─── Simulation Data ─────────────────────────────────────────────────────────

type SimScenario = {
  labels: ObjectLabel[];
  basePositions: BoundingBox[];
};

const SIM_SCENARIOS: SimScenario[] = [
  {
    labels: ['person', 'door', 'chair'],
    basePositions: [
      { x: 0.3, y: 0.2, width: 0.15, height: 0.35 },
      { x: 0.6, y: 0.1, width: 0.20, height: 0.55 },
      { x: 0.05, y: 0.5, width: 0.12, height: 0.10 },
    ],
  },
  {
    labels: ['car', 'traffic_light', 'person'],
    basePositions: [
      { x: 0.2, y: 0.3, width: 0.30, height: 0.25 },
      { x: 0.75, y: 0.05, width: 0.06, height: 0.18 },
      { x: 0.55, y: 0.25, width: 0.10, height: 0.28 },
    ],
  },
  {
    labels: ['shopping_cart', 'person', 'sign'],
    basePositions: [
      { x: 0.4, y: 0.4, width: 0.18, height: 0.22 },
      { x: 0.15, y: 0.2, width: 0.12, height: 0.30 },
      { x: 0.8, y: 0.1, width: 0.10, height: 0.15 },
    ],
  },
  {
    labels: ['stairs', 'construction_barrier'],
    basePositions: [
      { x: 0.25, y: 0.35, width: 0.40, height: 0.30 },
      { x: 0.70, y: 0.45, width: 0.20, height: 0.15 },
    ],
  },
  {
    labels: ['person', 'person', 'bag', 'wheelchair'],
    basePositions: [
      { x: 0.2, y: 0.2, width: 0.12, height: 0.30 },
      { x: 0.5, y: 0.15, width: 0.10, height: 0.28 },
      { x: 0.35, y: 0.55, width: 0.08, height: 0.08 },
      { x: 0.65, y: 0.3, width: 0.14, height: 0.20 },
    ],
  },
];

// Stable pseudo-random using sine
function seeded(seed: number): number {
  return Math.abs(Math.sin(seed * 127.1 + 311.7)) % 1;
}

export function runSimulatedInference(
  tick: number,
  scenarioIndex?: number,
): Array<{ label: ObjectLabel; boundingBox: BoundingBox; confidence: number }> {
  const scIdx = scenarioIndex ?? Math.floor(seeded(Math.floor(tick / 30)) * SIM_SCENARIOS.length);
  const scenario = SIM_SCENARIOS[scIdx % SIM_SCENARIOS.length];

  return scenario.labels.map((label, i) => {
    const base = scenario.basePositions[i];
    // Drift position slowly using sine waves
    const dx = Math.sin(tick * 0.08 + i * 1.3) * 0.03;
    const dy = Math.cos(tick * 0.06 + i * 0.9) * 0.025;
    const confidence = 0.70 + seeded(tick * 3 + i) * 0.28;
    return {
      label,
      boundingBox: {
        x: Math.max(0, Math.min(0.9, base.x + dx)),
        y: Math.max(0, Math.min(0.9, base.y + dy)),
        width: base.width,
        height: base.height,
      },
      confidence: Math.round(confidence * 100) / 100,
    };
  });
}

// ─── Prioritization ───────────────────────────────────────────────────────────

export function prioritizeObjects(objects: DetectedObject[]): DetectedObject[] {
  return [...objects].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return b.confidence - a.confidence;
  });
}

export function filterByPriority(
  objects: DetectedObject[],
  threshold: ObjectPriority,
): DetectedObject[] {
  const maxIdx = PRIORITY_ORDER.indexOf(threshold);
  return objects.filter((o) => PRIORITY_ORDER.indexOf(o.priority) <= maxIdx);
}

// ─── Speech Guidance ─────────────────────────────────────────────────────────

const SPEECH_TEMPLATES: Partial<Record<ObjectLabel, (distance: string) => string>> = {
  car: (d) => d === 'collision' ? 'Vehicle — stop immediately.' : 'Vehicle approaching.',
  person: (d) => d === 'collision' ? 'Person very close.' : 'Person ahead.',
  stairs: (_) => 'Stairs ahead — caution.',
  door: (_) => 'Door ahead.',
  traffic_light: (d) => d === 'near' ? 'Traffic light close.' : 'Traffic light.',
  crosswalk: (_) => 'Crosswalk ahead.',
  construction_barrier: (_) => 'Construction barrier — take care.',
  dog: (d) => d === 'near' ? 'Dog nearby.' : 'Dog ahead.',
  wheelchair: (_) => 'Wheelchair user nearby.',
  shopping_cart: (_) => 'Shopping cart ahead.',
  bike: (d) => d === 'near' ? 'Bicycle close.' : 'Bicycle ahead.',
};

const CLEAR_PATH_MESSAGE = 'Clear path.';
const SPEECH_COOLDOWN_MS = 3000;

export function selectSpeechGuidance(
  objects: DetectedObject[],
  lastSpokenAt: number,
  nowMs: number = Date.now(),
): string | null {
  const cooldownElapsed = nowMs - lastSpokenAt >= SPEECH_COOLDOWN_MS;

  const actionable = objects.filter(
    (o) => o.priority === 'critical' || o.priority === 'high',
  );

  if (actionable.length === 0) {
    // Announce clear path only occasionally
    if (cooldownElapsed && nowMs - lastSpokenAt >= 8000) {
      return CLEAR_PATH_MESSAGE;
    }
    return null;
  }

  if (!cooldownElapsed) return null;

  const top = prioritizeObjects(actionable)[0];
  const template = SPEECH_TEMPLATES[top.label];
  if (template) return template(top.distance);
  return `${top.label.replace(/_/g, ' ')} ahead.`;
}

// ─── Frame Building ───────────────────────────────────────────────────────────

export function buildPerceptionFrame(
  frameId: string,
  objects: DetectedObject[],
  scene: SceneUnderstanding,
  spokenGuidance: string | null,
  frameLatencyMs: number,
  inferenceLatencyMs: number,
  fps: number,
  provider: InferenceProvider,
): PerceptionFrame {
  return {
    frameId,
    timestamp: Date.now(),
    objects: prioritizeObjects(objects),
    scene,
    spokenGuidance,
    shouldSpeak: spokenGuidance !== null,
    frameLatencyMs,
    inferenceLatencyMs,
    fps,
    provider,
  };
}

// ─── Raw detections → DetectedObjects (without tracker) ──────────────────────
// Used for single-frame analysis when no tracker state is available.

export function rawToDetectedObjects(
  raws: Array<{ label: ObjectLabel; boundingBox: BoundingBox; confidence: number }>,
  nowMs: number = Date.now(),
): DetectedObject[] {
  return raws.map((raw, i) => {
    const distance = estimateDepthFromBox(raw.boundingBox);
    const priority = assignObjectPriority(raw.label, distance);
    return {
      trackId: `untracked-${i}`,
      label: raw.label,
      confidence: raw.confidence,
      distance,
      priority,
      boundingBox: raw.boundingBox,
      velocity: null,
      firstSeen: nowMs,
      lastSeen: nowMs,
      frameCount: 1,
      timeToCollision: null,
    };
  });
}

// ─── Full simulation pipeline (single call for page use) ─────────────────────

export function runSimulationPipeline(
  tick: number,
  lastSpokenAt: number,
  config: PipelineConfig,
  scenarioIndex?: number,
): {
  objects: DetectedObject[];
  scene: SceneUnderstanding;
  guidance: string | null;
  inferenceMs: number;
} {
  const start = Date.now();
  const raws = runSimulatedInference(tick, scenarioIndex);
  const objects = rawToDetectedObjects(raws, start);
  const filtered = filterByPriority(objects, config.priorityThreshold);
  const scene = buildSceneUnderstanding(filtered);
  const guidance = selectSpeechGuidance(filtered, lastSpokenAt, start);
  const inferenceMs = Date.now() - start;

  return { objects: filtered, scene, guidance, inferenceMs };
}

// ─── Privacy check ────────────────────────────────────────────────────────────

export function getPipelinePrivacyStatus() {
  return { ...PIPELINE_PRIVACY };
}

// ─── Priority label formatting ────────────────────────────────────────────────

export function formatPriority(p: ObjectPriority): string {
  switch (p) {
    case 'critical': return '🔴 Critical';
    case 'high': return '🟠 High';
    case 'medium': return '🟡 Medium';
    case 'low': return '🟢 Low';
    case 'ignore': return '⬜ Ignore';
  }
}

export function formatLabel(label: ObjectLabel): string {
  return label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

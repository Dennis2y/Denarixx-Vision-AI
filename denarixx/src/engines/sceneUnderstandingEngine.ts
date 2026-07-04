// ─── V12 Scene Understanding Engine ─────────────────────────────────────────
// Pure functions — no async, no I/O.
// Classifies the environment from detected object patterns.

import type {
  ObjectLabel,
  SceneType,
  SceneUnderstanding,
  CrowdingLevel,
  MovementLevel,
  DetectedObject,
} from '@/types/vision12';

// ─── Scene Classification Rules ──────────────────────────────────────────────
// Each scene has a set of "indicator" labels and their weights.

type SceneRule = {
  scene: SceneType;
  indicators: Partial<Record<ObjectLabel, number>>;
  threshold: number;
};

const SCENE_RULES: SceneRule[] = [
  {
    scene: 'street',
    indicators: { car: 3, bike: 2, traffic_light: 3, crosswalk: 3, construction_barrier: 2 },
    threshold: 3,
  },
  {
    scene: 'supermarket',
    indicators: { shopping_cart: 4, sign: 1, person: 1 },
    threshold: 4,
  },
  {
    scene: 'corridor',
    indicators: { door: 3, person: 1, bag: 1 },
    threshold: 3,
  },
  {
    scene: 'office',
    indicators: { chair: 2, table: 2, person: 1, door: 1, bag: 1 },
    threshold: 4,
  },
  {
    scene: 'restaurant',
    indicators: { chair: 2, table: 3, person: 1 },
    threshold: 4,
  },
  {
    scene: 'park',
    indicators: { tree: 3, dog: 2, person: 1, bike: 1 },
    threshold: 3,
  },
  {
    scene: 'station',
    indicators: { person: 1, bag: 1, sign: 2, wheelchair: 1 },
    threshold: 3,
  },
  {
    scene: 'airport',
    indicators: { person: 1, bag: 2, sign: 2, wheelchair: 1 },
    threshold: 4,
  },
  {
    scene: 'shopping_mall',
    indicators: { person: 1, shopping_cart: 2, sign: 1, wheelchair: 1 },
    threshold: 3,
  },
  {
    scene: 'room',
    indicators: { chair: 2, table: 2, door: 1 },
    threshold: 3,
  },
  {
    scene: 'indoor',
    indicators: { chair: 1, table: 1, door: 1, person: 1 },
    threshold: 2,
  },
];

export function classifyScene(objects: DetectedObject[]): SceneType {
  const labelCounts: Partial<Record<ObjectLabel, number>> = {};
  for (const obj of objects) {
    labelCounts[obj.label] = (labelCounts[obj.label] ?? 0) + 1;
  }

  let bestScene: SceneType = 'unknown';
  let bestScore = 0;

  for (const rule of SCENE_RULES) {
    let score = 0;
    for (const [label, weight] of Object.entries(rule.indicators) as [ObjectLabel, number][]) {
      const count = labelCounts[label] ?? 0;
      score += Math.min(count, 2) * weight;
    }
    if (score >= rule.threshold && score > bestScore) {
      bestScore = score;
      bestScene = rule.scene;
    }
  }

  return bestScene;
}

export function classifySceneConfidence(objects: DetectedObject[], scene: SceneType): number {
  if (scene === 'unknown') return 0.1;
  const rule = SCENE_RULES.find((r) => r.scene === scene);
  if (!rule) return 0.3;

  const labelCounts: Partial<Record<ObjectLabel, number>> = {};
  for (const obj of objects) {
    labelCounts[obj.label] = (labelCounts[obj.label] ?? 0) + 1;
  }

  let score = 0;
  let maxScore = 0;
  for (const [label, weight] of Object.entries(rule.indicators) as [ObjectLabel, number][]) {
    const count = labelCounts[label] ?? 0;
    score += Math.min(count, 2) * weight;
    maxScore += 2 * weight;
  }

  return maxScore === 0 ? 0.3 : Math.min(0.99, score / maxScore);
}

// ─── Crowding ────────────────────────────────────────────────────────────────

export function estimateCrowding(objects: DetectedObject[]): CrowdingLevel {
  const personCount = objects.filter((o) => o.label === 'person').length;
  if (personCount === 0) return 'empty';
  if (personCount <= 2) return 'sparse';
  if (personCount <= 5) return 'moderate';
  return 'crowded';
}

// ─── Movement ────────────────────────────────────────────────────────────────

export function estimateMovement(objects: DetectedObject[]): MovementLevel {
  const moving = objects.filter(
    (o) => o.velocity && o.velocity.speed !== 'stationary',
  );
  const ratio = objects.length > 0 ? moving.length / objects.length : 0;
  if (ratio === 0) return 'static';
  if (ratio < 0.25) return 'low';
  if (ratio < 0.6) return 'moderate';
  return 'high';
}

// ─── Lighting ────────────────────────────────────────────────────────────────
// Without real image analysis, default to 'normal' in simulation.
// Real providers would compute from average pixel brightness.

export function estimateLighting(): SceneUnderstanding['lighting'] {
  return 'normal';
}

// ─── Full Scene Understanding ────────────────────────────────────────────────

export function buildSceneUnderstanding(objects: DetectedObject[]): SceneUnderstanding {
  const scene = classifyScene(objects);
  return {
    scene,
    confidence: classifySceneConfidence(objects, scene),
    lighting: estimateLighting(),
    crowding: estimateCrowding(objects),
    movement: estimateMovement(objects),
  };
}

// ─── Scene Label ─────────────────────────────────────────────────────────────

export function getSceneLabel(scene: SceneType): string {
  const labels: Record<SceneType, string> = {
    indoor: 'Indoor',
    office: 'Office',
    restaurant: 'Restaurant',
    supermarket: 'Supermarket',
    park: 'Park / Outdoors',
    street: 'Street / Road',
    station: 'Station / Transit',
    airport: 'Airport',
    shopping_mall: 'Shopping Mall',
    corridor: 'Corridor / Hallway',
    room: 'Room',
    unknown: 'Unknown Environment',
  };
  return labels[scene] ?? scene;
}

export function getSceneSafetyNotes(scene: SceneType): string[] {
  const notes: Partial<Record<SceneType, string[]>> = {
    street: ['Active vehicle traffic possible.', 'Use crossings only.'],
    corridor: ['Moving people may approach from ahead.'],
    supermarket: ['Shopping carts may block path.'],
    park: ['Uneven ground and cyclists possible.'],
    station: ['High foot traffic — slow down.'],
  };
  return notes[scene as keyof typeof notes] ?? [];
}

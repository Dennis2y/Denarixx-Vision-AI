// ─── V12 Depth Reasoning Engine ──────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Estimates depth/distance from bounding box geometry and tracking velocity.
// Also houses assignObjectPriority to avoid circular imports with objectTrackingEngine.

import type {
  BoundingBox,
  DepthEstimate,
  TrackedObject,
  ObjectVelocity,
  ObjectLabel,
  ObjectPriority,
} from '@/types/vision12';

// ─── Depth from Bounding Box Area ────────────────────────────────────────────

const DEPTH_THRESHOLDS = {
  collision: 0.25,
  near: 0.10,
  walkingDistance: 0.04,
  medium: 0.01,
};

export function estimateDepthFromBox(box: BoundingBox): DepthEstimate {
  const area = box.width * box.height;
  if (area >= DEPTH_THRESHOLDS.collision) return 'collision';
  if (area >= DEPTH_THRESHOLDS.near) return 'near';
  if (area >= DEPTH_THRESHOLDS.walkingDistance) return 'walking_distance';
  if (area >= DEPTH_THRESHOLDS.medium) return 'medium';
  return 'far';
}

export function getDepthLabel(depth: DepthEstimate): string {
  switch (depth) {
    case 'collision': return 'Immediate Collision Risk';
    case 'near': return 'Very Close (~1–2 m)';
    case 'walking_distance': return 'Walking Distance (~2–4 m)';
    case 'medium': return 'Medium Range (~4–8 m)';
    case 'far': return 'Far (>8 m)';
  }
}

export function isCriticalDistance(depth: DepthEstimate): boolean {
  return depth === 'collision' || depth === 'near';
}

export function depthToMeters(depth: DepthEstimate): number {
  switch (depth) {
    case 'collision': return 0.5;
    case 'near': return 1.5;
    case 'walking_distance': return 3.0;
    case 'medium': return 6.0;
    case 'far': return 12.0;
  }
}

// ─── Object Priority ─────────────────────────────────────────────────────────

const CRITICAL_LABELS: ObjectLabel[] = [
  'car', 'stairs', 'construction_barrier', 'traffic_light', 'crosswalk',
];
const HIGH_LABELS: ObjectLabel[] = ['person', 'door', 'wheelchair'];
const MEDIUM_LABELS: ObjectLabel[] = ['chair', 'table', 'dog', 'shopping_cart', 'bike'];
const LOW_LABELS: ObjectLabel[] = ['bag', 'tree', 'sign'];

export function assignObjectPriority(
  label: ObjectLabel,
  distance: DepthEstimate,
): ObjectPriority {
  if (distance === 'far') return 'ignore';
  if (CRITICAL_LABELS.includes(label) && (distance === 'collision' || distance === 'near')) {
    return 'critical';
  }
  if (CRITICAL_LABELS.includes(label)) return 'high';
  if (HIGH_LABELS.includes(label) && (distance === 'collision' || distance === 'near')) {
    return 'high';
  }
  if (HIGH_LABELS.includes(label)) return 'medium';
  if (MEDIUM_LABELS.includes(label)) return 'medium';
  if (LOW_LABELS.includes(label)) return 'low';
  return 'low';
}

// ─── Time-to-Collision ────────────────────────────────────────────────────────

export function estimateTimeToCollision(
  tracked: TrackedObject,
  walkingSpeedMs: number = 1.4,
): number | null {
  if (!tracked.velocity) return null;
  const { speed } = tracked.velocity;
  if (speed === 'stationary') return null;
  const distanceM = depthToMeters(tracked.distance);
  const closingSpeedMs =
    speed === 'fast' ? walkingSpeedMs * 2
    : speed === 'moderate' ? walkingSpeedMs * 1.2
    : walkingSpeedMs * 0.6;
  return Math.round((distanceM / closingSpeedMs) * 10) / 10;
}

// ─── Velocity ────────────────────────────────────────────────────────────────

const SPEED_THRESHOLDS = { fast: 0.04, moderate: 0.015, slow: 0.005 };

export function classifySpeed(dx: number, dy: number): ObjectVelocity['speed'] {
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag >= SPEED_THRESHOLDS.fast) return 'fast';
  if (mag >= SPEED_THRESHOLDS.moderate) return 'moderate';
  if (mag >= SPEED_THRESHOLDS.slow) return 'slow';
  return 'stationary';
}

export function buildVelocity(dx: number, dy: number): ObjectVelocity {
  return { dx, dy, speed: classifySpeed(dx, dy) };
}

// ─── Position Prediction ──────────────────────────────────────────────────────

export function predictNextPosition(
  box: BoundingBox,
  velocity: ObjectVelocity,
  framesAhead = 1,
): BoundingBox {
  return {
    x: Math.max(0, Math.min(1, box.x + velocity.dx * framesAhead)),
    y: Math.max(0, Math.min(1, box.y + velocity.dy * framesAhead)),
    width: box.width,
    height: box.height,
  };
}

// ─── Depth Comparison ────────────────────────────────────────────────────────

const DEPTH_RANK: Record<DepthEstimate, number> = {
  collision: 0, near: 1, walking_distance: 2, medium: 3, far: 4,
};

export function isCloserThan(a: DepthEstimate, b: DepthEstimate): boolean {
  return DEPTH_RANK[a] < DEPTH_RANK[b];
}

export function closerDepth(a: DepthEstimate, b: DepthEstimate): DepthEstimate {
  return isCloserThan(a, b) ? a : b;
}

/**
 * PathPlanningEngine (V6)
 *
 * Analyses an array of positioned spatial objects and computes:
 * 1. The available walking corridor (width, clearance, passability)
 * 2. A concrete path recommendation (action + instruction)
 *
 * Pure engine — no async, no I/O.
 */

import type {
  SpatialObject,
  WalkingCorridor,
  PathRecommendation,
  PathAction,
  MovementPrediction,
} from '@/types/spatial';

const SAFE_DISTANCE_AHEAD = 2.0; // metres — anything closer triggers an action
const VERY_CLOSE = 0.8; // metres — stop immediately threshold
const CRITICAL_MOVING_DISTANCE = 3.0; // moving objects within this range are high priority

// ─── Corridor computation ─────────────────────────────────────────────────────

export function computeCorridor(objects: SpatialObject[]): WalkingCorridor {
  // Objects directly ahead (within ±0.4 lateral offset)
  const aheadObjects = objects.filter(
    (o) => Math.abs(o.lateralOffset) < 0.4 && o.distanceMetres > 0
  );

  const clearanceMetres =
    aheadObjects.length > 0
      ? Math.min(...aheadObjects.map((o) => o.distanceMetres))
      : 20; // no obstacles = 20m clear

  // Estimate walkable corridor width
  const leftBlockers = objects.filter(
    (o) => o.lateralOffset < -0.1 && o.distanceMetres < SAFE_DISTANCE_AHEAD * 1.5
  );
  const rightBlockers = objects.filter(
    (o) => o.lateralOffset > 0.1 && o.distanceMetres < SAFE_DISTANCE_AHEAD * 1.5
  );

  const leftClear = leftBlockers.length === 0 ? 2.0 : 0.5;
  const rightClear = rightBlockers.length === 0 ? 2.0 : 0.5;
  const widthMetres = Math.max(0, leftClear + rightClear);
  const isPassable = widthMetres >= 1.0 && clearanceMetres >= VERY_CLOSE;

  // Suggest lateral offset to maximise clearance
  let suggestedOffset = 0;
  if (leftBlockers.length > 0 && rightBlockers.length === 0) suggestedOffset = 0.3; // step right
  else if (rightBlockers.length > 0 && leftBlockers.length === 0) suggestedOffset = -0.3; // step left

  return { widthMetres, clearanceMetres, isPassable, suggestedOffset };
}

// ─── Movement prediction ──────────────────────────────────────────────────────

export function predictMovement(objects: SpatialObject[]): MovementPrediction[] {
  return objects
    .filter((o) => o.isMoving && o.movementDir)
    .map((o): MovementPrediction => {
      const speeds = { slow: 1.0, medium: 2.0, fast: 4.0, stationary: 0 };
      const speed = o.movementSpeed ? speeds[o.movementSpeed] : 1.5;
      const isCrossing =
        o.movementDir === 'crossing_left' || o.movementDir === 'crossing_right';
      const isApproaching = o.movementDir === 'toward';

      const willIntersect =
        (isCrossing && o.distanceMetres < CRITICAL_MOVING_DISTANCE) ||
        (isApproaching && o.distanceMetres < SAFE_DISTANCE_AHEAD * 2);

      const timeToIntersection = willIntersect && speed > 0
        ? Math.round((o.distanceMetres / speed) * 10) / 10
        : null;

      return {
        objectId: o.id,
        willIntersectPath: willIntersect,
        timeToIntersectionSeconds: timeToIntersection,
        predictedPosition: {
          lateralOffset: isCrossing ? 0 : o.lateralOffset,
          distanceMetres: Math.max(0, o.distanceMetres - speed),
        },
      };
    });
}

// ─── Instruction generation ───────────────────────────────────────────────────

function buildInstruction(
  action: PathAction,
  corridor: WalkingCorridor,
  closestAhead: SpatialObject | null,
  predictions: MovementPrediction[]
): string {
  const clearDist = corridor.clearanceMetres;
  const willIntersect = predictions.find((p) => p.willIntersectPath);

  switch (action) {
    case 'continue': {
      if (clearDist >= 10) return 'The path ahead is clear. Continue straight.';
      const distStr = clearDist >= 2 ? `${Math.round(clearDist)} metres` : `${clearDist.toFixed(1)} metres`;
      return `Continue straight for ${distStr}, then reassess.`;
    }
    case 'step_left':
      return 'Step slightly to your left to widen the path.';
    case 'step_right':
      return 'Walk slightly to your right. More room on that side.';
    case 'turn_left':
      return 'Turn left to avoid the obstacle ahead.';
    case 'turn_right':
      return 'Turn right — the path is clearer on that side.';
    case 'stop':
      if (closestAhead) {
        return `Stop. ${closestAhead.label} is ${closestAhead.distanceMetres.toFixed(1)} metres directly ahead.`;
      }
      return 'Stop. Obstacle very close ahead.';
    case 'wait': {
      if (willIntersect && willIntersect.timeToIntersectionSeconds !== null) {
        return `Wait here. Object crossing in approximately ${willIntersect.timeToIntersectionSeconds} seconds.`;
      }
      return 'Wait here while the path clears.';
    }
    case 'cross':
      return 'The crossing looks clear. You may cross now.';
    case 'detour':
      return 'Path blocked ahead. Take a wider route around the obstacle.';
    case 'reverse':
      return 'Move back — the path behind you is safer.';
    default:
      return 'Continue with caution.';
  }
}

// ─── Main recommendation ──────────────────────────────────────────────────────

export function computeRecommendation(
  objects: SpatialObject[],
  corridor: WalkingCorridor,
  predictions: MovementPrediction[]
): PathRecommendation {
  const { clearanceMetres, isPassable, suggestedOffset } = corridor;
  const willIntersect = predictions.find((p) => p.willIntersectPath);

  // Objects directly ahead, sorted by distance
  const aheadObjects = objects
    .filter((o) => Math.abs(o.lateralOffset) < 0.4)
    .sort((a, b) => a.distanceMetres - b.distanceMetres);
  const closestAhead = aheadObjects[0] ?? null;

  let action: PathAction;
  let urgency: PathRecommendation['urgency'];
  let confidence: number;

  if (!isPassable || clearanceMetres < VERY_CLOSE) {
    action = 'stop';
    urgency = 'immediate';
    confidence = 0.95;
  } else if (willIntersect && willIntersect.timeToIntersectionSeconds !== null && willIntersect.timeToIntersectionSeconds < 3) {
    action = 'wait';
    urgency = 'immediate';
    confidence = 0.9;
  } else if (clearanceMetres < SAFE_DISTANCE_AHEAD) {
    if (suggestedOffset < -0.1) {
      action = 'step_left';
    } else if (suggestedOffset > 0.1) {
      action = 'step_right';
    } else {
      action = closestAhead ? 'stop' : 'continue';
    }
    urgency = 'soon';
    confidence = 0.82;
  } else if (suggestedOffset > 0.15) {
    action = 'step_right';
    urgency = 'advisory';
    confidence = 0.75;
  } else if (suggestedOffset < -0.15) {
    action = 'step_left';
    urgency = 'advisory';
    confidence = 0.75;
  } else {
    action = 'continue';
    urgency = 'advisory';
    confidence = 0.9;
  }

  const instruction = buildInstruction(action, corridor, closestAhead, predictions);

  return { action, instruction, urgency, confidence };
}

// ─── Engine class ─────────────────────────────────────────────────────────────

export class PathPlanningEngine {
  plan(objects: SpatialObject[]): {
    corridor: WalkingCorridor;
    recommendation: PathRecommendation;
    predictions: MovementPrediction[];
  } {
    const corridor = computeCorridor(objects);
    const predictions = predictMovement(objects);
    const recommendation = computeRecommendation(objects, corridor, predictions);
    return { corridor, recommendation, predictions };
  }
}

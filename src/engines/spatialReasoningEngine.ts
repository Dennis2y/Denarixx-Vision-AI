/**
 * SpatialReasoningEngine (V6)
 *
 * Converts raw object detections into positioned, directional spatial objects.
 *
 * Camera mode:   uses bounding-box position and size to estimate distance and
 *                lateral offset in a 640×480 normalised coordinate space.
 * Simulation:    generates plausible spatial objects seeded from the detection
 *                list and the frame counter (deterministic within a frame,
 *                varied across frames).
 *
 * Pure engine — no async, no I/O.
 */

import type {
  SpatialObject,
  SpatialObjectType,
  Direction,
  MovementDir,
  MovementSpeed,
  SpatialInput,
} from '@/types/spatial';

// ─── Object classification ────────────────────────────────────────────────────

const LABEL_TYPE_MAP: Record<string, SpatialObjectType> = {
  person: 'person',
  man: 'person',
  woman: 'person',
  child: 'person',
  pedestrian: 'person',
  car: 'vehicle',
  vehicle: 'vehicle',
  truck: 'vehicle',
  bus: 'vehicle',
  motorcycle: 'vehicle',
  motorbike: 'vehicle',
  bicycle: 'bicycle',
  bike: 'bicycle',
  scooter: 'bicycle',
  dog: 'animal',
  cat: 'animal',
  bird: 'animal',
  bench: 'furniture',
  chair: 'furniture',
  table: 'furniture',
  door: 'landmark',
  stairs: 'landmark',
  staircase: 'landmark',
  elevator: 'landmark',
  crosswalk: 'landmark',
  'traffic light': 'landmark',
  'bus stop': 'landmark',
};

function classifyLabel(label: string): SpatialObjectType {
  const lower = label.toLowerCase();
  for (const [key, type] of Object.entries(LABEL_TYPE_MAP)) {
    if (lower.includes(key)) return type;
  }
  return 'obstacle';
}

function isPermanentType(type: SpatialObjectType, label: string): boolean {
  if (type === 'landmark' || type === 'furniture') return true;
  const lower = label.toLowerCase();
  return ['bench', 'post', 'wall', 'pole', 'sign', 'door', 'stairs'].some((k) =>
    lower.includes(k)
  );
}

function isMovingType(type: SpatialObjectType): boolean {
  return type === 'person' || type === 'vehicle' || type === 'bicycle' || type === 'animal';
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/**
 * Convert bbox x-centre (0–1 normalised) → lateral offset (-1 = left, +1 = right).
 * Adjust for typical camera field of view: centre is 0, edges are ±1.
 */
function xToLateralOffset(normX: number): number {
  return (normX - 0.5) * 2;
}

/**
 * Estimate distance from bbox height (larger = closer).
 * Calibrated for typical urban/indoor scenes.
 */
function bboxHeightToDistance(normHeight: number): number {
  if (normHeight <= 0) return 10;
  // bbox height 0.6 ≈ 1m, 0.3 ≈ 2m, 0.1 ≈ 5m, 0.02 ≈ 15m
  return Math.round(Math.max(0.5, 0.06 / normHeight) * 10) / 10;
}

function offsetToDirection(lateralOffset: number, distanceMetres: number): Direction {
  const ahead = distanceMetres >= 0.5;
  if (Math.abs(lateralOffset) < 0.3) return ahead ? 'ahead' : 'behind';
  if (lateralOffset < -0.3) return ahead ? 'ahead_left' : 'left';
  return ahead ? 'ahead_right' : 'right';
}

// ─── Simulation helpers ───────────────────────────────────────────────────────

/** Seeded pseudo-random — deterministic per (label, frameIndex, salt) */
function seededRand(label: string, frameIndex: number, salt: number): number {
  let h = 0xdeadbeef ^ frameIndex ^ salt;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x9e3779b9);
  }
  h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff);
}

function simulateObjectPosition(
  label: string,
  type: SpatialObjectType,
  frameIndex: number,
  index: number
): { distanceMetres: number; lateralOffset: number } {
  const r1 = seededRand(label, frameIndex, index * 7 + 1);
  const r2 = seededRand(label, frameIndex, index * 7 + 2);

  // Different types tend to appear at different distances
  const distanceRanges: Record<SpatialObjectType, [number, number]> = {
    person: [1.5, 8],
    vehicle: [4, 25],
    bicycle: [2, 12],
    animal: [1, 6],
    furniture: [0.5, 4],
    landmark: [2, 15],
    obstacle: [0.5, 5],
    other: [1, 10],
  };
  const [dMin, dMax] = distanceRanges[type];
  const dist = Math.round((dMin + r1 * (dMax - dMin)) * 10) / 10;
  const offset = Math.round((r2 * 2 - 1) * 10) / 10; // -1 to +1

  return { distanceMetres: dist, lateralOffset: offset };
}

function simulateMovement(
  type: SpatialObjectType,
  frameIndex: number,
  label: string,
  index: number
): { movementDir?: MovementDir; movementSpeed?: MovementSpeed } {
  if (!isMovingType(type)) return {};
  const r = seededRand(label, frameIndex, index * 13 + 3);
  const rs = seededRand(label, frameIndex, index * 13 + 4);
  const dirs: MovementDir[] = ['toward', 'away', 'crossing_left', 'crossing_right', 'parallel'];
  const speeds: MovementSpeed[] = ['slow', 'medium', 'fast'];
  return {
    movementDir: dirs[Math.floor(r * dirs.length)],
    movementSpeed: speeds[Math.floor(rs * speeds.length)],
  };
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class SpatialReasoningEngine {
  analyze(input: SpatialInput): SpatialObject[] {
    const { detections, frameIndex, source } = input;
    const now = new Date();

    return detections.map((det, i): SpatialObject => {
      const type = classifyLabel(det.label);
      const id = `obj-${det.label.replace(/\s+/g, '-')}-${i}`;
      const isPermanent = isPermanentType(type, det.label);

      let distanceMetres: number;
      let lateralOffset: number;
      let movementDir: MovementDir | undefined;
      let movementSpeed: MovementSpeed | undefined;

      if (source === 'camera' && det.boundingBox) {
        const bb = det.boundingBox;
        const normX = bb.x + bb.width / 2;
        const normH = bb.height;
        distanceMetres = bboxHeightToDistance(normH);
        lateralOffset = xToLateralOffset(normX);
      } else {
        const pos = simulateObjectPosition(det.label, type, frameIndex, i);
        distanceMetres = pos.distanceMetres;
        lateralOffset = pos.lateralOffset;
      }

      if (isMovingType(type)) {
        const mv = simulateMovement(type, frameIndex, det.label, i);
        movementDir = mv.movementDir;
        movementSpeed = mv.movementSpeed;
      }

      const direction = offsetToDirection(lateralOffset, distanceMetres);

      return {
        id,
        type,
        label: det.label,
        distanceMetres,
        direction,
        lateralOffset,
        isMoving: isMovingType(type),
        movementDir,
        movementSpeed,
        confidence: det.confidence,
        isPermanent,
        lastSeenAt: now,
      };
    });
  }

  /** Natural-language description of a single spatial object */
  describeObject(obj: SpatialObject): string {
    const dist =
      obj.distanceMetres < 1
        ? 'less than a metre'
        : obj.distanceMetres < 2
        ? `${obj.distanceMetres.toFixed(1)} metre`
        : `${obj.distanceMetres.toFixed(0)} metres`;

    const dirStr: Record<Direction, string> = {
      ahead: 'directly ahead',
      ahead_left: 'ahead and to your left',
      ahead_right: 'ahead and to your right',
      left: 'to your left',
      right: 'to your right',
      behind: 'behind you',
      above: 'above',
      below: 'below',
    };

    const base = `${obj.label} ${dist} ${dirStr[obj.direction]}`;

    if (obj.isMoving && obj.movementDir) {
      const mvStr: Record<MovementDir, string> = {
        toward: 'moving toward you',
        away: 'moving away',
        crossing_left: 'crossing left',
        crossing_right: 'crossing right',
        parallel: 'moving alongside',
      };
      return `${base}, ${mvStr[obj.movementDir]}`;
    }
    return base;
  }
}

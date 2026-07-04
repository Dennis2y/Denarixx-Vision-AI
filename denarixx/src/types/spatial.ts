/**
 * Spatial Intelligence types (V6)
 *
 * Shared types for all spatial reasoning, path planning, mobility,
 * and world-model engines.
 */

// ─── Object classification ────────────────────────────────────────────────────

export type SpatialObjectType =
  | 'person'
  | 'vehicle'
  | 'bicycle'
  | 'obstacle'
  | 'landmark'
  | 'animal'
  | 'furniture'
  | 'other';

export type Direction =
  | 'ahead'
  | 'ahead_left'
  | 'ahead_right'
  | 'left'
  | 'right'
  | 'behind'
  | 'above'
  | 'below';

export type MovementDir = 'toward' | 'away' | 'crossing_left' | 'crossing_right' | 'parallel';
export type MovementSpeed = 'stationary' | 'slow' | 'medium' | 'fast';

// ─── Spatial object ───────────────────────────────────────────────────────────

export interface SpatialObject {
  id: string;
  type: SpatialObjectType;
  /** Human-readable label, e.g. "person", "car", "bench" */
  label: string;
  /** Estimated distance in metres. 0 = at user position. */
  distanceMetres: number;
  /** Coarse direction from user's perspective */
  direction: Direction;
  /**
   * Lateral offset relative to forward direction.
   * -1.0 = far left, 0 = directly ahead, +1.0 = far right
   */
  lateralOffset: number;
  isMoving: boolean;
  movementDir?: MovementDir;
  movementSpeed?: MovementSpeed;
  confidence: number;
  /** True for fixed infrastructure (stairs, doors, benches) */
  isPermanent: boolean;
  /** Time this object was last observed */
  lastSeenAt: Date;
}

// ─── Walking corridor ─────────────────────────────────────────────────────────

export interface WalkingCorridor {
  /** Estimated clear width in metres */
  widthMetres: number;
  /** Metres until the nearest obstacle directly ahead */
  clearanceMetres: number;
  /** True if a person can walk without obstruction */
  isPassable: boolean;
  /**
   * Recommended lateral adjustment.
   * -1 = step left, 0 = stay centre, +1 = step right
   */
  suggestedOffset: number;
}

// ─── Path recommendation ──────────────────────────────────────────────────────

export type PathAction =
  | 'continue'
  | 'turn_left'
  | 'turn_right'
  | 'step_left'
  | 'step_right'
  | 'stop'
  | 'wait'
  | 'cross'
  | 'detour'
  | 'reverse';

export interface PathRecommendation {
  action: PathAction;
  /** Full natural-language navigation instruction */
  instruction: string;
  urgency: 'immediate' | 'soon' | 'advisory';
  /** 0–1 */
  confidence: number;
  /** Estimated metres for this action (e.g. "walk 5 metres") */
  distanceMetres?: number;
}

// ─── Movement prediction ──────────────────────────────────────────────────────

export interface MovementPrediction {
  objectId: string;
  /** Will this object cross the user's path? */
  willIntersectPath: boolean;
  /** Seconds until intersection (null = won't intersect) */
  timeToIntersectionSeconds: number | null;
  predictedPosition: {
    lateralOffset: number;
    distanceMetres: number;
  };
}

// ─── Landmark ─────────────────────────────────────────────────────────────────

export type LandmarkType =
  | 'door'
  | 'stairs'
  | 'elevator'
  | 'shop'
  | 'bus_stop'
  | 'crosswalk'
  | 'station'
  | 'traffic_light'
  | 'bench'
  | 'other';

export interface Landmark {
  id: string;
  type: LandmarkType;
  label: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** How many frames this has appeared in */
  sightingCount: number;
  distanceMetres: number;
  direction: Direction;
  notes?: string;
}

// ─── Full world model snapshot ────────────────────────────────────────────────

export interface WorldModelSnapshot {
  /** All currently visible/recently-seen objects */
  objects: SpatialObject[];
  /** Computed safe corridor */
  corridor: WalkingCorridor;
  /** Best path recommendation */
  recommendation: PathRecommendation;
  /** Movement predictions for moving objects */
  predictions: MovementPrediction[];
  /** Persistent landmark registry */
  landmarks: Landmark[];
  /** Frame number this snapshot was built from */
  frameIndex: number;
  timestamp: Date;
}

// ─── Spatial analysis input ───────────────────────────────────────────────────

export interface SpatialInput {
  /** Raw detections from vision engine */
  detections: Array<{
    label: string;
    confidence: number;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
  /** 0-indexed frame counter, used to seed simulation randomness */
  frameIndex: number;
  /** Source for logging */
  source: 'camera' | 'simulation';
}

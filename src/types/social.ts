/**
 * Social Intelligence types (V9)
 *
 * Covers human behaviour detection, social situation awareness,
 * interaction prediction, and crowd understanding.
 *
 * Privacy constraints (enforced throughout):
 *  - No person is identified by name or identity.
 *  - Emotions are NEVER inferred as facts.
 *  - Only observable behaviour is described.
 *  - No biometric data is stored or transmitted.
 */

// ─── Observable human activities ─────────────────────────────────────────────

/**
 * Activities that can be observed without inference about intent or identity.
 */
export type HumanActivity =
  | 'walking'
  | 'running'
  | 'standing'
  | 'sitting'
  | 'waiting'          // stationary for an extended period
  | 'waving'
  | 'pointing'
  | 'approaching'      // moving toward the user
  | 'moving_away'      // moving away from the user
  | 'crossing_road'
  | 'opening_door'
  | 'entering_vehicle'
  | 'leaving_vehicle'
  | 'falling'
  | 'unknown';

// ─── Spatial references ───────────────────────────────────────────────────────

/** Direction relative to the user */
export type RelativeDirection =
  | 'ahead'
  | 'ahead_left'
  | 'ahead_right'
  | 'left'
  | 'right'
  | 'behind'
  | 'behind_left'
  | 'behind_right';

/** Distance zones relative to the user */
export type DistanceZone =
  | 'very_close'   // < 1 m — personal space
  | 'close'        // 1–3 m — interaction zone
  | 'near'         // 3–6 m — conversational zone
  | 'medium'       // 6–15 m — awareness zone
  | 'far';         // > 15 m — background

/** Approach speed of a person */
export type ApproachSpeed =
  | 'stationary'
  | 'slow'       // e.g. walking toward user
  | 'moderate'   // brisk walking
  | 'fast';      // running toward user

// ─── Person descriptor ────────────────────────────────────────────────────────

/**
 * A raw detected person from the vision frame.
 * Input to the human behaviour engine.
 */
export interface DetectedPerson {
  id: string;
  /** Bounding box in normalised 0–1 coordinates */
  boundingBox: { x: number; y: number; width: number; height: number };
  /** Centre of the bounding box in normalised 0–1 coordinates */
  screenPosition: { cx: number; cy: number };
  /** Physical distance estimate in metres (null if unknown) */
  estimatedDistanceM: number | null;
  /** person_height / frame_height — proxy for distance when estimatedDistanceM is null */
  sizeRatio: number;
  /** Detection confidence 0–1 */
  confidence: number;
}

/**
 * An analysed person with behaviour and spatial context attached.
 */
export interface NearbyPerson {
  id: string;
  activity: HumanActivity;
  direction: RelativeDirection;
  distanceZone: DistanceZone;
  /** Physical distance in metres, null if not estimable */
  estimatedDistanceM: number | null;
  approachSpeed: ApproachSpeed;
  /** True if the person is moving toward the user */
  isApproaching: boolean;
  /** Probability (0–1) that this person will interact with the user */
  interactionProbability: number;
  /** True when person is within the user's personal space (< 1.5 m) */
  inPersonalSpace: boolean;
}

// ─── Crowd state ──────────────────────────────────────────────────────────────

export type CrowdDensity =
  | 'empty'       // 0 people
  | 'sparse'      // 1–2 people
  | 'moderate'    // 3–5 people
  | 'dense'       // 6–9 people
  | 'very_dense'; // 10+ people

export interface CrowdState {
  density: CrowdDensity;
  count: number;
  hasQueue: boolean;
  /** Estimated number of people approaching the user */
  approachingCount: number;
  /** Estimated spacing in metres between people (null when count < 2) */
  estimatedSpacingM: number | null;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

// ─── Interaction prediction ───────────────────────────────────────────────────

export interface InteractionPrediction {
  personId: string;
  /** Probability that this person will cross the user's path */
  pathCrossingProbability: number;
  /** Probability of collision if no action is taken */
  collisionRisk: number;
  /** Probability that this person will initiate interaction */
  interactionLikelihood: number;
  /** Estimated seconds until closest approach (null if moving away) */
  timeToClosestApproachSec: number | null;
}

// ─── Social context ───────────────────────────────────────────────────────────

/**
 * The complete social situation snapshot produced by the social pipeline.
 */
export interface SocialContext {
  nearbyPersons: NearbyPerson[];
  crowd: CrowdState;
  predictions: InteractionPrediction[];
  personalSpaceClear: boolean;
  /** Primary spoken guidance for this frame (null if nothing to say) */
  primaryGuidance: string | null;
  /** Ordered list of alerts (most urgent first) */
  alerts: SocialAlert[];
  timestamp: Date;
}

/**
 * A single social alert — safety or informational.
 */
export interface SocialAlert {
  severity: 'info' | 'warning' | 'urgent';
  message: string;
  direction: RelativeDirection | null;
  personId: string | null;
}

// ─── Pipeline input ───────────────────────────────────────────────────────────

/**
 * Input to the social pipeline — comes from vision frame analysis.
 */
export interface SocialInput {
  detectedPersons: DetectedPerson[];
  /** Raw scene description from VisionEngine (used for keyword-based activity inference) */
  sceneDescription: string;
  userMotion: 'stationary' | 'walking' | 'running';
  timestamp: Date;
}

// ─── Simulation scenarios ─────────────────────────────────────────────────────

export type SocialScenario =
  | 'empty_street'
  | 'someone_approaching'
  | 'someone_waiting'
  | 'small_queue'
  | 'people_crossing'
  | 'dense_crowd'
  | 'person_waving'
  | 'person_falling';

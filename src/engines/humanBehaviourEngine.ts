/**
 * HumanBehaviourEngine (V9)
 *
 * Classifies observable human activities from vision frame data.
 *
 * Privacy rules:
 *  - Never identifies or names any person.
 *  - Never infers emotions as facts.
 *  - Only describes what is observable (movement, position, size, speed).
 *
 * Pure engine — no async, no I/O, no React.
 */

import type {
  DetectedPerson,
  NearbyPerson,
  HumanActivity,
  RelativeDirection,
  DistanceZone,
  ApproachSpeed,
} from '@/types/social';

// ─── Activity inference rules ─────────────────────────────────────────────────

/**
 * Infer a human activity from scene description keywords.
 * Keyword matching is used when we don't have frame-over-frame tracking.
 * Returns a ranked list of likely activities.
 */
export function inferActivityFromScene(sceneDescription: string): HumanActivity {
  const s = sceneDescription.toLowerCase();
  if (s.includes('falling') || s.includes('fell') || s.includes('on the ground')) return 'falling';
  if (s.includes('running') || s.includes('sprinting') || s.includes('jogging')) return 'running';
  if (s.includes('waving')) return 'waving';
  if (s.includes('pointing')) return 'pointing';
  if (s.includes('crossing road') || s.includes('crossing the road') || s.includes('jaywalking')) return 'crossing_road';
  if (s.includes('entering vehicle') || s.includes('getting into') || s.includes('boarding')) return 'entering_vehicle';
  if (s.includes('leaving vehicle') || s.includes('getting out') || s.includes('alighting')) return 'leaving_vehicle';
  if (s.includes('opening door')) return 'opening_door';
  if (s.includes('approaching') || s.includes('coming toward') || s.includes('coming towards')) return 'approaching';
  if (s.includes('moving away') || s.includes('walking away') || s.includes('leaving')) return 'moving_away';
  if (s.includes('sitting') || s.includes('seated') || s.includes('bench')) return 'sitting';
  if (s.includes('waiting') || s.includes('standing still') || s.includes('stationary')) return 'waiting';
  if (s.includes('walking') || s.includes('pedestrian') || s.includes('strolling')) return 'walking';
  if (s.includes('standing') || s.includes('person standing')) return 'standing';
  return 'unknown';
}

/**
 * Infer a human activity from the person's size ratio and position.
 *
 * sizeRatio = person_height / frame_height:
 *   > 0.85 → very close (personal space), could be approaching or standing
 *   0.60–0.85 → close, walking
 *   0.30–0.60 → medium distance
 *   < 0.30 → far, standing or walking
 */
export function inferActivityFromSizeRatio(
  sizeRatio: number,
  screenCy: number
): HumanActivity {
  if (sizeRatio > 0.85) {
    // Very large → very close
    return screenCy < 0.3 ? 'falling' : 'approaching';
  }
  if (sizeRatio > 0.6) return 'walking';
  if (sizeRatio > 0.35) return 'walking';
  return 'standing';
}

// ─── Direction inference ──────────────────────────────────────────────────────

/**
 * Infer a relative direction from screen centre-x (0 = left, 1 = right).
 * Optional cy for vertical discrimination (below centre → behind).
 */
export function directionFromScreen(cx: number, cy: number = 0.5): RelativeDirection {
  const isLeft  = cx < 0.33;
  const isRight = cx > 0.67;
  const isBehind = cy > 0.78; // person at bottom of frame is likely beside/behind

  if (isBehind) {
    if (isLeft)  return 'behind_left';
    if (isRight) return 'behind_right';
    return 'behind';
  }

  const isAhead = cy <= 0.4; // person at top of frame is further ahead
  if (isAhead) {
    if (isLeft)  return 'ahead_left';
    if (isRight) return 'ahead_right';
  }

  if (isLeft)  return 'left';
  if (isRight) return 'right';
  return 'ahead';
}

// ─── Distance inference ───────────────────────────────────────────────────────

/** Convert physical distance in metres to a distance zone. */
export function distanceZoneFromMeters(metres: number): DistanceZone {
  if (metres < 1.0)  return 'very_close';
  if (metres < 3.0)  return 'close';
  if (metres < 6.0)  return 'near';
  if (metres < 15.0) return 'medium';
  return 'far';
}

/**
 * Estimate distance zone from sizeRatio when physical distance is unknown.
 * Higher sizeRatio = person takes up more of the frame = closer.
 */
export function distanceZoneFromSizeRatio(sizeRatio: number): DistanceZone {
  if (sizeRatio >= 0.80) return 'very_close';
  if (sizeRatio >= 0.55) return 'close';
  if (sizeRatio >= 0.30) return 'near';
  if (sizeRatio >= 0.12) return 'medium';
  return 'far';
}

/**
 * Estimate metres from sizeRatio (rough inverse proportion).
 * Assumes average person height of 1.7 m, typical focal length.
 */
export function estimateMetersFromSizeRatio(sizeRatio: number): number {
  if (sizeRatio <= 0) return 20;
  // Rough: sizeRatio ~1 at 1.5 m, ~0.1 at 15 m
  return Math.min(50, Math.max(0.5, 1.5 / sizeRatio));
}

// ─── Approach speed ───────────────────────────────────────────────────────────

/**
 * Infer approach speed from activity and size ratio.
 */
export function inferApproachSpeed(activity: HumanActivity, sizeRatio: number): ApproachSpeed {
  if (activity === 'running') return 'fast';
  if (activity === 'approaching' && sizeRatio > 0.6) return 'moderate';
  if (activity === 'approaching') return 'slow';
  if (activity === 'walking') return 'slow';
  return 'stationary';
}

// ─── Interaction probability ──────────────────────────────────────────────────

/**
 * Estimate the probability that this person will interact with the user.
 * Based purely on observable factors: proximity, direction, activity.
 */
export function estimateInteractionProbability(
  activity: HumanActivity,
  distanceZone: DistanceZone,
  direction: RelativeDirection
): number {
  let p = 0;

  // Distance factor
  if (distanceZone === 'very_close') p += 0.5;
  else if (distanceZone === 'close') p += 0.3;
  else if (distanceZone === 'near')  p += 0.15;
  else p += 0.02;

  // Activity factor
  if (activity === 'approaching') p += 0.3;
  else if (activity === 'waving')   p += 0.5;
  else if (activity === 'pointing') p += 0.25;
  else if (activity === 'waiting')  p += 0.1;

  // Direction factor (ahead = more likely to interact)
  if (direction === 'ahead' || direction === 'ahead_left' || direction === 'ahead_right') p += 0.15;
  else if (direction === 'left' || direction === 'right') p += 0.05;

  return Math.min(1, p);
}

// ─── Main analysis function ───────────────────────────────────────────────────

/** Analyse a single detected person and produce a NearbyPerson descriptor. */
export function analyzePerson(
  detected: DetectedPerson,
  sceneDescription: string
): NearbyPerson {
  // Direction
  const direction = directionFromScreen(detected.screenPosition.cx, detected.screenPosition.cy);

  // Distance
  const estimatedDistanceM = detected.estimatedDistanceM
    ?? estimateMetersFromSizeRatio(detected.sizeRatio);
  const distanceZone = detected.estimatedDistanceM !== null
    ? distanceZoneFromMeters(detected.estimatedDistanceM)
    : distanceZoneFromSizeRatio(detected.sizeRatio);

  // Activity — prefer scene description for the primary person, fallback to size
  const sceneActivity = inferActivityFromScene(sceneDescription);
  const activity: HumanActivity = sceneActivity !== 'unknown'
    ? sceneActivity
    : inferActivityFromSizeRatio(detected.sizeRatio, detected.screenPosition.cy);

  // Approach speed
  const approachSpeed = inferApproachSpeed(activity, detected.sizeRatio);
  const isApproaching = activity === 'approaching' || activity === 'running'
    || (approachSpeed !== 'stationary' && (direction === 'ahead' || direction === 'ahead_left' || direction === 'ahead_right'));

  // Interaction probability
  const interactionProbability = estimateInteractionProbability(activity, distanceZone, direction);

  const inPersonalSpace = estimatedDistanceM < 1.5;

  return {
    id: detected.id,
    activity,
    direction,
    distanceZone,
    estimatedDistanceM,
    approachSpeed,
    isApproaching,
    interactionProbability,
    inPersonalSpace,
  };
}

/** Analyse all detected persons in a frame. */
export function analyzePersons(
  detectedPersons: DetectedPerson[],
  sceneDescription: string
): NearbyPerson[] {
  return detectedPersons
    .filter((p) => p.confidence >= 0.5)
    .map((p, i) => {
      // Only use scene description for the first (primary) person to avoid duplication
      const scene = i === 0 ? sceneDescription : '';
      return analyzePerson(p, scene);
    });
}

// ─── Simulation helpers ───────────────────────────────────────────────────────

/**
 * Generate a simulated detected person for testing and demo scenarios.
 */
export function simulateDetectedPerson(
  id: string,
  cx: number,
  cy: number,
  sizeRatio: number,
  distanceM?: number,
  confidence = 0.85
): DetectedPerson {
  return {
    id,
    boundingBox: {
      x: cx - sizeRatio / 2,
      y: cy - sizeRatio / 1.5,
      width: sizeRatio,
      height: sizeRatio * 1.5,
    },
    screenPosition: { cx, cy },
    estimatedDistanceM: distanceM ?? null,
    sizeRatio,
    confidence,
  };
}

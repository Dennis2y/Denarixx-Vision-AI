/**
 * InteractionPredictionEngine (V9)
 *
 * Predicts future interactions between nearby persons and the user.
 *
 * Predictions are probabilistic and describe only observable trajectories.
 * No intent or emotion is inferred as a fact.
 *
 * Pure engine — no async, no I/O, no React.
 */

import type {
  NearbyPerson,
  InteractionPrediction,
  ApproachSpeed,
} from '@/types/social';

// ─── Speed to metres per second ──────────────────────────────────────────────

const SPEED_MPS: Record<ApproachSpeed, number> = {
  stationary: 0,
  slow:       1.0,  // pedestrian walking ~3.6 km/h
  moderate:   1.8,  // brisk walking ~6.5 km/h
  fast:       4.0,  // running ~14 km/h
};

// ─── Path crossing ────────────────────────────────────────────────────────────

/**
 * Estimate the probability that a person will cross the user's path.
 * Lateral persons (left/right) approaching at speed are most likely to cross.
 */
export function pathCrossingProbability(person: NearbyPerson): number {
  if (!person.isApproaching) return 0.02;

  const lateralDirections = new Set([
    'left', 'right', 'ahead_left', 'ahead_right', 'behind_left', 'behind_right',
  ]);
  const isLateral = lateralDirections.has(person.direction);

  let p = 0;
  if (isLateral) p += 0.4;
  else if (person.direction === 'ahead') p += 0.1;

  // Speed factor
  if (person.approachSpeed === 'fast')     p += 0.25;
  else if (person.approachSpeed === 'moderate') p += 0.15;
  else if (person.approachSpeed === 'slow')     p += 0.08;

  // Distance factor — closer persons more likely to actually cross in time
  if (person.distanceZone === 'very_close') p += 0.2;
  else if (person.distanceZone === 'close') p += 0.15;
  else if (person.distanceZone === 'near')  p += 0.05;

  return Math.min(1, p);
}

// ─── Collision risk ───────────────────────────────────────────────────────────

/**
 * Estimate the collision risk: the probability of physical contact
 * if neither party changes course.
 */
export function collisionRisk(
  person: NearbyPerson,
  userMotion: 'stationary' | 'walking' | 'running'
): number {
  if (!person.isApproaching) return 0.01;

  let risk = 0;

  // Direction — head-on collision is riskiest
  if (person.direction === 'ahead') risk += 0.4;
  else if (person.direction === 'ahead_left' || person.direction === 'ahead_right') risk += 0.25;
  else risk += 0.05;

  // Distance
  if (person.distanceZone === 'very_close') risk += 0.35;
  else if (person.distanceZone === 'close') risk += 0.2;
  else if (person.distanceZone === 'near')  risk += 0.08;

  // Combined speed factor
  const personSpeedMps = SPEED_MPS[person.approachSpeed];
  const userSpeedMps: Record<typeof userMotion, number> = {
    stationary: 0,
    walking: 1.2,
    running: 3.5,
  };
  const combinedSpeed = personSpeedMps + userSpeedMps[userMotion];
  if (combinedSpeed > 6) risk += 0.2;
  else if (combinedSpeed > 3) risk += 0.1;

  // Activity factor
  if (person.activity === 'running') risk += 0.15;

  return Math.min(1, risk);
}

// ─── Time to closest approach ─────────────────────────────────────────────────

/**
 * Estimate seconds until closest approach.
 * Returns null if the person is moving away.
 */
export function timeToClosestApproachSec(
  person: NearbyPerson,
  userMotion: 'stationary' | 'walking' | 'running'
): number | null {
  if (!person.isApproaching || person.estimatedDistanceM === null) return null;
  const personSpeedMps = SPEED_MPS[person.approachSpeed];
  const userSpeedMps: Record<typeof userMotion, number> = {
    stationary: 0,
    walking: 1.2,
    running: 3.5,
  };
  const relativeSpeed = personSpeedMps + userSpeedMps[userMotion];
  if (relativeSpeed < 0.1) return null;
  return Math.max(0, person.estimatedDistanceM / relativeSpeed);
}

// ─── Interaction likelihood ───────────────────────────────────────────────────

/**
 * Predict the likelihood of social interaction (someone speaking to / engaging with the user).
 * Observable signals only — no intent inference.
 */
export function interactionLikelihood(person: NearbyPerson): number {
  let p = person.interactionProbability; // already computed by HumanBehaviourEngine

  // Adjust for approach speed — fast approach lowers social interaction likelihood
  if (person.approachSpeed === 'fast') p *= 0.4;

  return Math.min(1, Math.max(0, p));
}

// ─── Main prediction function ─────────────────────────────────────────────────

/** Produce an interaction prediction for a single nearby person. */
export function predictInteraction(
  person: NearbyPerson,
  userMotion: 'stationary' | 'walking' | 'running'
): InteractionPrediction {
  return {
    personId: person.id,
    pathCrossingProbability: pathCrossingProbability(person),
    collisionRisk: collisionRisk(person, userMotion),
    interactionLikelihood: interactionLikelihood(person),
    timeToClosestApproachSec: timeToClosestApproachSec(person, userMotion),
  };
}

/** Produce predictions for all nearby persons, sorted by collision risk descending. */
export function predictAllInteractions(
  persons: NearbyPerson[],
  userMotion: 'stationary' | 'walking' | 'running'
): InteractionPrediction[] {
  return persons
    .map((p) => predictInteraction(p, userMotion))
    .sort((a, b) => b.collisionRisk - a.collisionRisk);
}

// ─── Overall area risk ────────────────────────────────────────────────────────

/** Summarise the highest risk across all predictions. */
export function highestRisk(predictions: InteractionPrediction[]): number {
  if (predictions.length === 0) return 0;
  return Math.max(...predictions.map((p) => p.collisionRisk));
}

/**
 * CrowdUnderstandingEngine (V9)
 *
 * Estimates crowd density, detects queues, and assesses crowd risk from
 * a list of NearbyPerson descriptors.
 *
 * Pure engine — no async, no I/O, no React.
 */

import type {
  NearbyPerson,
  CrowdState,
  CrowdDensity,
  RelativeDirection,
} from '@/types/social';

// ─── Density classification ───────────────────────────────────────────────────

/** Classify crowd density from a raw person count. */
export function densityFromCount(count: number): CrowdDensity {
  if (count === 0)  return 'empty';
  if (count <= 2)   return 'sparse';
  if (count <= 5)   return 'moderate';
  if (count <= 9)   return 'dense';
  return 'very_dense';
}

// ─── Spacing estimation ───────────────────────────────────────────────────────

/**
 * Estimate average spacing between persons in metres.
 * Uses the average distance of all persons as a rough proxy.
 */
export function estimateSpacingM(persons: NearbyPerson[]): number | null {
  if (persons.length < 2) return null;
  const dists = persons
    .map((p) => p.estimatedDistanceM)
    .filter((d): d is number => d !== null);
  if (dists.length < 2) return null;
  const avg = dists.reduce((s, d) => s + d, 0) / dists.length;
  // Heuristic: spacing ≈ average distance / expected persons per metre at this density
  return Math.max(0.5, avg / (dists.length / 2));
}

// ─── Queue detection ──────────────────────────────────────────────────────────

/**
 * Detect a queue: 2 or more stationary/waiting persons in the same general direction
 * from the user.
 */
export function detectQueue(persons: NearbyPerson[]): boolean {
  const stationaryActivities = new Set(['waiting', 'standing', 'sitting']);
  const stationary = persons.filter((p) => stationaryActivities.has(p.activity));
  if (stationary.length < 2) return false;

  // Group by direction
  const byDirection = new Map<RelativeDirection, number>();
  for (const p of stationary) {
    byDirection.set(p.direction, (byDirection.get(p.direction) ?? 0) + 1);
  }

  // Merge adjacent directions (e.g. ahead + ahead_left count together)
  const aheadCount = (byDirection.get('ahead') ?? 0)
    + (byDirection.get('ahead_left') ?? 0)
    + (byDirection.get('ahead_right') ?? 0);
  if (aheadCount >= 2) return true;

  // Any single direction with 2+ stationary counts as a queue
  for (const count of byDirection.values()) {
    if (count >= 2) return true;
  }

  return false;
}

// ─── Crowd risk ───────────────────────────────────────────────────────────────

/** Compute crowd risk from density and approaching count. */
export function crowdRiskLevel(
  density: CrowdDensity,
  approachingCount: number
): CrowdState['riskLevel'] {
  if (density === 'very_dense' && approachingCount >= 2) return 'high';
  if (density === 'very_dense') return 'medium';
  if (density === 'dense' && approachingCount >= 2) return 'medium';
  if (density === 'dense') return 'low';
  if (density === 'moderate' && approachingCount >= 3) return 'medium';
  if (approachingCount >= 1 && density !== 'empty' && density !== 'sparse') return 'low';
  return 'none';
}

// ─── Main analysis function ───────────────────────────────────────────────────

/** Full crowd analysis from a list of nearby persons. */
export function analyzeCrowd(persons: NearbyPerson[]): CrowdState {
  const count = persons.length;
  const density = densityFromCount(count);
  const hasQueue = detectQueue(persons);
  const approachingCount = persons.filter((p) => p.isApproaching).length;
  const estimatedSpacingM = estimateSpacingM(persons);
  const riskLevel = crowdRiskLevel(density, approachingCount);

  return {
    density,
    count,
    hasQueue,
    approachingCount,
    estimatedSpacingM,
    riskLevel,
  };
}

// ─── Human-readable crowd descriptions ────────────────────────────────────────

/** Returns a brief human-readable description of the crowd state. */
export function describeCrowd(crowd: CrowdState): string {
  if (crowd.density === 'empty') return 'No people nearby.';
  if (crowd.density === 'sparse') {
    return crowd.count === 1
      ? 'One person nearby.'
      : `${crowd.count} people nearby.`;
  }
  if (crowd.density === 'moderate') return `${crowd.count} people in the area.`;
  if (crowd.density === 'dense') return 'The area is quite busy.';
  return 'The area is very crowded.';
}

/** Returns a risk warning string, or null if no warning. */
export function crowdRiskWarning(crowd: CrowdState): string | null {
  if (crowd.riskLevel === 'high') return 'The crowd is very dense. Move carefully.';
  if (crowd.riskLevel === 'medium') return 'The area is becoming crowded.';
  if (crowd.riskLevel === 'low' && crowd.approachingCount >= 2) return 'Several people are approaching.';
  return null;
}

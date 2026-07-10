// ─── V13 Crossing Decision Engine ────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Evaluates crossing safety. NEVER claims certainty.
// Privacy: no camera data is stored.

import type {
  CrossingDecision,
  CrossingType,
  RiskLevel,
  GuidanceLine,
  NavigationSession,
  OutdoorEnvironment,
} from '@/types/navigation';
import { RISK_ORDER } from '@/types/navigation';

// ─── Crossing Evaluation ──────────────────────────────────────────────────────

export function evaluateCrossing(
  detectedLabels: string[],
  environment: OutdoorEnvironment,
): CrossingDecision {
  const labels = new Set(detectedLabels);
  const crossingType = determineCrossingType(environment, labels);
  const vehiclesDetected = countVehicles(labels);
  const lightState = detectLightState(labels);
  const riskLevel = computeCrossingRisk(vehiclesDetected, lightState, labels);
  const suggestedAction = determineSuggestedAction(riskLevel, lightState);
  const message = buildCrossingMessage(riskLevel, vehiclesDetected, lightState);

  return {
    crossingType,
    riskLevel,
    detectedObjects: Array.from(labels),
    vehiclesDetected,
    lightState,
    message,
    suggestedAction,
    confidence: computeCrossingConfidence(labels),
  };
}

function determineCrossingType(
  environment: OutdoorEnvironment,
  labels: Set<string>,
): CrossingType {
  if (environment === 'crossing') return 'pedestrian_crossing';
  if (labels.has('traffic_light') || labels.has('crosswalk')) return 'pedestrian_crossing';
  if (environment === 'road') return 'road_crossing';
  return 'junction';
}

function countVehicles(labels: Set<string>): number {
  let count = 0;
  if (labels.has('car')) count += 2; // could be multiple
  if (labels.has('bike')) count += 1;
  return count;
}

function detectLightState(labels: Set<string>): CrossingDecision['lightState'] {
  if (labels.has('traffic_light')) return 'unknown'; // simulation: can't read colour
  return 'unknown';
}

function computeCrossingRisk(
  vehiclesDetected: number,
  lightState: CrossingDecision['lightState'],
  labels: Set<string>,
): RiskLevel {
  if (vehiclesDetected >= 2) return 'critical';
  if (vehiclesDetected === 1) return 'high';
  if (labels.has('construction_barrier')) return 'high';
  if (lightState === 'red') return 'critical';
  if (lightState === 'flashing') return 'high';
  if (labels.has('bike')) return 'moderate';
  return 'moderate'; // crossings are always at least moderate
}

function determineSuggestedAction(
  riskLevel: RiskLevel,
  lightState: CrossingDecision['lightState'],
): CrossingDecision['suggestedAction'] {
  if (riskLevel === 'critical') return 'stop';
  if (riskLevel === 'high') return 'wait_and_check';
  if (lightState === 'red') return 'stop';
  return 'proceed_with_care';
}

// ─── IMPORTANT: Never say "safe to cross" with certainty ─────────────────────

export function buildCrossingMessage(
  riskLevel: RiskLevel,
  vehiclesDetected: number,
  lightState: CrossingDecision['lightState'],
): string {
  if (riskLevel === 'critical') {
    return vehiclesDetected > 0
      ? 'Vehicle detected. Stop and wait.'
      : 'Stop before the crossing. Please check carefully.';
  }
  if (riskLevel === 'high') {
    return 'The crossing appears busy. Stop and wait for a clear moment. Check carefully before proceeding.';
  }
  if (lightState === 'green') {
    return 'Light signal detected. The crossing appears clear, but please check carefully before crossing.';
  }
  // Default — never assert safety
  return 'Approaching a crossing. The path appears clear, but please stop and check carefully before crossing.';
}

function computeCrossingConfidence(labels: Set<string>): number {
  // More detected labels → more confident assessment (but still uncertain)
  const count = labels.size;
  return Math.min(0.7, 0.3 + count * 0.05);
}

// ─── Risk Helpers ─────────────────────────────────────────────────────────────

export function getCrossingRisk(decision: CrossingDecision): RiskLevel {
  return decision.riskLevel;
}

export function isCrossingDecisionNeeded(
  session: NavigationSession,
  detectedLabels: string[],
): boolean {
  if (!session.segments.length) return false;
  const segment = session.segments[session.currentSegmentIndex];
  if (!segment) return false;
  const hasCrossingLabel = detectedLabels.some((l) =>
    ['car', 'traffic_light', 'crosswalk', 'construction_barrier'].includes(l),
  );
  return segment.type === 'crossing' || hasCrossingLabel;
}

export function shouldWarnAboutCrossing(
  session: NavigationSession,
  detectedLabels: string[],
): boolean {
  return (
    isCrossingDecisionNeeded(session, detectedLabels) &&
    session.state === 'navigating'
  );
}

// ─── Guidance Line ────────────────────────────────────────────────────────────

export function buildCrossingGuidanceLine(decision: CrossingDecision): GuidanceLine {
  const priority =
    RISK_ORDER.indexOf(decision.riskLevel) >= RISK_ORDER.indexOf('high') ? 'urgent' : 'high';
  return {
    text: decision.message,
    priority,
    suppressIfSimilar: false,
    spokenAt: null,
  };
}

// ─── Crossing Type Label ──────────────────────────────────────────────────────

export function formatCrossingType(type: CrossingType): string {
  switch (type) {
    case 'pedestrian_crossing': return 'Pedestrian Crossing';
    case 'road_crossing': return 'Road Crossing';
    case 'junction': return 'Junction';
    case 'driveway': return 'Driveway';
  }
}

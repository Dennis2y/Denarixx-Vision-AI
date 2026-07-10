// ─── V13 Outdoor Navigation Engine ───────────────────────────────────────────
// Pure functions — no async, no I/O.
// GPS/compass guidance, landmark awareness, road safety.

import type {
  CardinalDirection,
  OutdoorEnvironment,
  RouteSegment,
  GuidanceLine,
  NavigationSession,
} from '@/types/navigation';

// ─── Heading ─────────────────────────────────────────────────────────────────

export function parseHeading(degrees: number): CardinalDirection {
  const d = ((degrees % 360) + 360) % 360;
  if (d < 22.5 || d >= 337.5) return 'N';
  if (d < 67.5) return 'NE';
  if (d < 112.5) return 'E';
  if (d < 157.5) return 'SE';
  if (d < 202.5) return 'S';
  if (d < 247.5) return 'SW';
  if (d < 292.5) return 'W';
  return 'NW';
}

export function computeHeadingDeviation(currentDeg: number, targetDeg: number): number {
  const diff = ((targetDeg - currentDeg + 180 + 360) % 360) - 180;
  return Math.round(diff);
}

export function buildHeadingInstruction(deviationDeg: number): string {
  const abs = Math.abs(deviationDeg);
  if (abs <= 10) return 'Continue straight.';
  if (abs <= 30) return deviationDeg > 0 ? 'Turn slightly right.' : 'Turn slightly left.';
  if (abs <= 70) return deviationDeg > 0 ? 'Turn right.' : 'Turn left.';
  if (abs <= 130) return deviationDeg > 0 ? 'Turn sharply right.' : 'Turn sharply left.';
  return 'Turn around.';
}

export function formatHeadingWithCardinal(degrees: number): string {
  const cardinal = parseHeading(degrees);
  return `${Math.round(degrees)}° ${cardinal}`;
}

// ─── Route Deviation ──────────────────────────────────────────────────────────

const DEVIATION_THRESHOLD_DEG = 45;

export function detectRouteDeviation(
  targetHeadingDeg: number,
  currentHeadingDeg: number,
): boolean {
  const deviation = Math.abs(computeHeadingDeviation(currentHeadingDeg, targetHeadingDeg));
  return deviation > DEVIATION_THRESHOLD_DEG;
}

export function buildDeviationGuidance(
  targetHeadingDeg: number,
  currentHeadingDeg: number,
): GuidanceLine {
  const deviation = computeHeadingDeviation(currentHeadingDeg, targetHeadingDeg);
  const instruction = buildHeadingInstruction(deviation);
  return {
    text: `Route deviation detected. ${instruction}`,
    priority: 'high',
    suppressIfSimilar: false,
    spokenAt: null,
  };
}

// ─── Outdoor Route Templates ──────────────────────────────────────────────────

const OUTDOOR_TEMPLATES: Record<string, RouteSegment[]> = {
  bus_stop: [
    { segmentId: 'o1', from: 'Start', to: 'Pavement junction', instruction: 'Continue straight on the pavement.', headingDeg: 0, estimatedDistanceM: 50, type: 'straight', riskLevel: 'low' },
    { segmentId: 'o2', from: 'Pavement junction', to: 'Crossing', instruction: 'Stop before the crossing. The crossing appears clear, but please check carefully before proceeding.', headingDeg: 0, estimatedDistanceM: 5, type: 'crossing', riskLevel: 'moderate' },
    { segmentId: 'o3', from: 'Crossing', to: 'Opposite pavement', instruction: 'Continue forward on the pavement.', headingDeg: 0, estimatedDistanceM: 20, type: 'straight', riskLevel: 'low' },
    { segmentId: 'o4', from: 'Opposite pavement', to: 'Bus stop', instruction: 'Bus stop ahead on your left.', headingDeg: 0, estimatedDistanceM: 10, type: 'arrive', riskLevel: 'clear' },
  ],
  park: [
    { segmentId: 'o1', from: 'Start', to: 'Park entrance', instruction: 'Continue straight. Park entrance is ahead.', headingDeg: 90, estimatedDistanceM: 30, type: 'straight', riskLevel: 'low' },
    { segmentId: 'o2', from: 'Park entrance', to: 'Main path', instruction: 'Turn left onto the main park path.', headingDeg: 0, estimatedDistanceM: 15, type: 'turn_left', riskLevel: 'low' },
    { segmentId: 'o3', from: 'Main path', to: 'Park', instruction: 'You have reached the park.', headingDeg: 0, estimatedDistanceM: 0, type: 'arrive', riskLevel: 'clear' },
  ],
  station: [
    { segmentId: 'o1', from: 'Start', to: 'Main road', instruction: 'Head straight towards the road.', headingDeg: 180, estimatedDistanceM: 20, type: 'straight', riskLevel: 'low' },
    { segmentId: 'o2', from: 'Main road', to: 'Station crossing', instruction: 'Stop before the crossing. The crossing appears clear, but please check carefully.', headingDeg: 90, estimatedDistanceM: 5, type: 'crossing', riskLevel: 'moderate' },
    { segmentId: 'o3', from: 'Station crossing', to: 'Station entrance', instruction: 'Station entrance is ahead on your right.', headingDeg: 90, estimatedDistanceM: 15, type: 'straight', riskLevel: 'low' },
    { segmentId: 'o4', from: 'Station entrance', to: 'Station', instruction: 'You have reached the station.', headingDeg: 90, estimatedDistanceM: 0, type: 'arrive', riskLevel: 'clear' },
  ],
  default: [
    { segmentId: 'o1', from: 'Start', to: 'Waypoint 1', instruction: 'Continue straight on the pavement.', headingDeg: 0, estimatedDistanceM: 40, type: 'straight', riskLevel: 'low' },
    { segmentId: 'o2', from: 'Waypoint 1', to: 'Junction', instruction: 'Turn right at the junction.', headingDeg: 90, estimatedDistanceM: 20, type: 'turn_right', riskLevel: 'low' },
    { segmentId: 'o3', from: 'Junction', to: 'Destination', instruction: 'Continue straight. Destination is ahead.', headingDeg: 90, estimatedDistanceM: 25, type: 'straight', riskLevel: 'low' },
    { segmentId: 'o4', from: 'Near destination', to: 'Destination', instruction: 'You have arrived.', headingDeg: 90, estimatedDistanceM: 0, type: 'arrive', riskLevel: 'clear' },
  ],
};

export function generateOutdoorRoute(destination: string): RouteSegment[] {
  const dest = destination.toLowerCase();
  if (dest.includes('bus') || dest.includes('stop')) return OUTDOOR_TEMPLATES.bus_stop;
  if (dest.includes('park') || dest.includes('garden')) return OUTDOOR_TEMPLATES.park;
  if (dest.includes('station') || dest.includes('train') || dest.includes('tube')) return OUTDOOR_TEMPLATES.station;
  return OUTDOOR_TEMPLATES.default;
}

// ─── Environment Classification ───────────────────────────────────────────────

export function classifyOutdoorEnvironment(detectedLabels: string[]): OutdoorEnvironment {
  const labels = new Set(detectedLabels);
  if (labels.has('car') && (labels.has('traffic_light') || labels.has('crosswalk'))) return 'crossing';
  if (labels.has('car')) return 'road';
  if (labels.has('tree') && !labels.has('car')) return 'park';
  if (labels.has('sign') && labels.has('person') && labels.has('bag')) return 'station';
  if (labels.has('construction_barrier')) return 'road';
  return 'pavement';
}

// ─── Traffic-side Awareness ───────────────────────────────────────────────────

export function getTrafficSideWarning(drivingSide: 'left' | 'right' = 'left'): string {
  return drivingSide === 'left'
    ? 'In the UK, traffic comes from your right. Check right, then left, then right again before crossing.'
    : 'Traffic approaches from your left. Check left, then right, then left again before crossing.';
}

// ─── Outdoor Guidance Builder ─────────────────────────────────────────────────

export function buildOutdoorGuidance(session: NavigationSession): GuidanceLine {
  const segment = session.segments[session.currentSegmentIndex];
  if (!segment) {
    return { text: 'Route complete.', priority: 'normal', suppressIfSimilar: true, spokenAt: null };
  }

  const isCrossing = segment.type === 'crossing';
  const priority = isCrossing ? 'urgent' : segment.riskLevel === 'moderate' ? 'high' : 'normal';

  return {
    text: segment.instruction,
    priority,
    suppressIfSimilar: segment.type === 'straight',
    spokenAt: null,
  };
}

// ─── Distance formatting ──────────────────────────────────────────────────────

export function formatDistance(meters: number): string {
  if (meters < 5) return 'very close';
  if (meters < 50) return `${Math.round(meters)} metres`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} metres`;
  return `${(meters / 1000).toFixed(1)} kilometres`;
}

export function getTotalOutdoorDistance(segments: RouteSegment[]): number {
  return segments.reduce((sum, s) => sum + s.estimatedDistanceM, 0);
}

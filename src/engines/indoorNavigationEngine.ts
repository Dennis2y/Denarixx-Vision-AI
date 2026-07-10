// ─── V13 Indoor Navigation Engine ────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Room-to-room guidance, zone detection, landmark awareness.

import type {
  IndoorZone,
  IndoorVenueMode,
  RouteSegment,
  GuidanceLine,
  NavigationSession,
} from '@/types/navigation';

// ─── Zone Detection ───────────────────────────────────────────────────────────

const ZONE_INDICATORS: Record<IndoorZone, string[]> = {
  corridor: ['door', 'person'],
  stairs: ['stairs'],
  elevator: ['elevator'],
  escalator: ['escalator'],
  doorway: ['door'],
  entrance: ['door', 'sign'],
  exit: ['door', 'sign'],
  room: ['chair', 'table'],
  unknown: [],
};

export function detectIndoorZone(detectedLabels: string[]): IndoorZone {
  const labels = new Set(detectedLabels);

  if (labels.has('stairs')) return 'stairs';
  if (labels.has('elevator')) return 'elevator';
  if (labels.has('escalator')) return 'escalator';
  if (labels.has('door')) {
    if (labels.has('sign')) return labels.has('person') ? 'entrance' : 'exit';
    return 'doorway';
  }
  if (labels.has('chair') || labels.has('table')) return 'room';
  if (labels.has('person') && !labels.has('chair')) return 'corridor';
  return 'unknown';
}

// ─── Venue Mode ───────────────────────────────────────────────────────────────

export function classifyIndoorMode(detectedLabels: string[]): IndoorVenueMode {
  const labels = new Set(detectedLabels);
  if (labels.has('shopping_cart')) return 'supermarket';
  if (labels.has('chair') && labels.has('table') && labels.has('sign')) return 'office';
  if (labels.has('wheelchair') && labels.has('sign')) return 'station';
  return 'generic';
}

// ─── Indoor Route Templates ───────────────────────────────────────────────────

const INDOOR_TEMPLATES: Record<string, RouteSegment[]> = {
  exit: [
    { segmentId: 'i1', from: 'Current location', to: 'Corridor', instruction: 'Continue straight along the corridor.', headingDeg: 0, estimatedDistanceM: 15, type: 'straight', riskLevel: 'low' },
    { segmentId: 'i2', from: 'Corridor', to: 'Main exit', instruction: 'The exit is ahead on your right. Look for the door.', headingDeg: 45, estimatedDistanceM: 8, type: 'turn_right', riskLevel: 'low' },
    { segmentId: 'i3', from: 'Exit door', to: 'Main exit', instruction: 'You have reached the exit.', headingDeg: 45, estimatedDistanceM: 0, type: 'arrive', riskLevel: 'clear' },
  ],
  stairs: [
    { segmentId: 'i1', from: 'Current location', to: 'Stairwell', instruction: 'Head forward. Stairs are ahead.', headingDeg: 0, estimatedDistanceM: 10, type: 'straight', riskLevel: 'low' },
    { segmentId: 'i2', from: 'Stairwell', to: 'Stairs', instruction: 'Stairs ahead. Slow down and locate the handrail before descending.', headingDeg: 0, estimatedDistanceM: 3, type: 'stairs', riskLevel: 'moderate' },
    { segmentId: 'i3', from: 'Stairs', to: 'Next floor', instruction: 'You have reached the stairwell.', headingDeg: 0, estimatedDistanceM: 0, type: 'arrive', riskLevel: 'clear' },
  ],
  elevator: [
    { segmentId: 'i1', from: 'Current location', to: 'Elevator lobby', instruction: 'Turn left and continue towards the elevator.', headingDeg: 270, estimatedDistanceM: 12, type: 'turn_left', riskLevel: 'low' },
    { segmentId: 'i2', from: 'Elevator lobby', to: 'Elevator', instruction: 'Elevator ahead. The button panel should be on your right.', headingDeg: 270, estimatedDistanceM: 5, type: 'straight', riskLevel: 'low' },
    { segmentId: 'i3', from: 'Elevator', to: 'Destination floor', instruction: 'You have reached the elevator.', headingDeg: 270, estimatedDistanceM: 0, type: 'arrive', riskLevel: 'clear' },
  ],
  entrance: [
    { segmentId: 'i1', from: 'Current location', to: 'Entrance corridor', instruction: 'Head forward towards the entrance.', headingDeg: 0, estimatedDistanceM: 20, type: 'straight', riskLevel: 'low' },
    { segmentId: 'i2', from: 'Entrance corridor', to: 'Main entrance', instruction: 'Main entrance ahead. Door should be directly in front.', headingDeg: 0, estimatedDistanceM: 5, type: 'arrive', riskLevel: 'clear' },
  ],
  default: [
    { segmentId: 'i1', from: 'Start', to: 'Waypoint', instruction: 'Continue straight.', headingDeg: 0, estimatedDistanceM: 20, type: 'straight', riskLevel: 'low' },
    { segmentId: 'i2', from: 'Waypoint', to: 'Destination', instruction: 'Turn right.', headingDeg: 90, estimatedDistanceM: 10, type: 'turn_right', riskLevel: 'low' },
    { segmentId: 'i3', from: 'Near destination', to: 'Destination', instruction: 'You have arrived.', headingDeg: 90, estimatedDistanceM: 0, type: 'arrive', riskLevel: 'clear' },
  ],
};

export function generateIndoorRoute(destination: string, _mode: IndoorVenueMode): RouteSegment[] {
  const dest = destination.toLowerCase();
  if (dest.includes('exit') || dest.includes('out')) return INDOOR_TEMPLATES.exit;
  if (dest.includes('stair')) return INDOOR_TEMPLATES.stairs;
  if (dest.includes('elevator') || dest.includes('lift')) return INDOOR_TEMPLATES.elevator;
  if (dest.includes('entrance') || dest.includes('door')) return INDOOR_TEMPLATES.entrance;
  return INDOOR_TEMPLATES.default;
}

// ─── Zone Transition Guidance ─────────────────────────────────────────────────

export function getRoomTransitionGuidance(from: IndoorZone, to: IndoorZone): string {
  if (from === 'corridor' && to === 'room') return 'Entering a room. Mind the doorway.';
  if (from === 'room' && to === 'corridor') return 'Entering the corridor.';
  if (to === 'stairs') return 'Stairs ahead. Slow down and find the handrail.';
  if (to === 'elevator') return 'Elevator ahead.';
  if (to === 'exit') return 'Exit ahead.';
  if (to === 'entrance') return 'Entrance ahead.';
  return `Moving from ${from} to ${to}.`;
}

// ─── Detection Helpers ────────────────────────────────────────────────────────

export function detectDoorway(detectedLabels: string[]): boolean {
  return detectedLabels.includes('door');
}

export function detectStairs(detectedLabels: string[]): boolean {
  return detectedLabels.includes('stairs');
}

export function detectElevator(detectedLabels: string[]): boolean {
  return detectedLabels.includes('elevator');
}

// ─── Guidance Builder ─────────────────────────────────────────────────────────

export function buildIndoorGuidance(session: NavigationSession): GuidanceLine {
  const segment = session.segments[session.currentSegmentIndex];
  if (!segment) {
    return { text: 'Route complete.', priority: 'normal', suppressIfSimilar: true, spokenAt: null };
  }

  const priority = segment.riskLevel === 'moderate' ? 'high' : 'normal';
  return {
    text: segment.instruction,
    priority,
    suppressIfSimilar: segment.type === 'straight',
    spokenAt: null,
  };
}

// ─── Venue-specific announcements ─────────────────────────────────────────────

export function getVenueModeIntro(mode: IndoorVenueMode): string {
  switch (mode) {
    case 'supermarket': return 'Supermarket mode. Shopping carts may block the aisle.';
    case 'office': return 'Office mode. Corridors may have foot traffic.';
    case 'station': return 'Station mode. Watch for moving passengers and luggage.';
    case 'airport': return 'Airport mode. Moving walkways and crowds ahead.';
    case 'shopping_mall': return 'Shopping mall mode. Expect crowds and obstacles.';
    default: return 'Indoor navigation active.';
  }
}

export function getTotalIndoorDistance(segments: RouteSegment[]): number {
  return segments.reduce((sum, s) => sum + s.estimatedDistanceM, 0);
}

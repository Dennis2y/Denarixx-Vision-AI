// ─── V13 Landmark Guidance Engine ────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Creates, stores, and announces landmarks along a navigation route.

import type {
  Landmark,
  LandmarkType,
  IndoorZone,
  GuidanceLine,
  NavigationSession,
} from '@/types/navigation';

// ─── Factory ──────────────────────────────────────────────────────────────────

let _landmarkCounter = 1;

export function createLandmark(
  name: string,
  type: LandmarkType,
  options: {
    description?: string;
    indoorZone?: IndoorZone;
    headingDeg?: number;
    estimatedDistanceM?: number;
  } = {},
): Landmark {
  return {
    id: `LM${String(_landmarkCounter++).padStart(3, '0')}`,
    name,
    type,
    description: options.description ?? formatLandmarkType(type),
    indoorZone: options.indoorZone,
    headingDeg: options.headingDeg,
    estimatedDistanceM: options.estimatedDistanceM,
    savedAt: Date.now(),
  };
}

export function resetLandmarkCounter(): void {
  _landmarkCounter = 1;
}

// ─── Session Integration ──────────────────────────────────────────────────────

export function addLandmarkToSession(
  session: NavigationSession,
  landmark: Landmark,
): NavigationSession {
  return {
    ...session,
    landmarks: [...session.landmarks, landmark],
    lastUpdatedAt: Date.now(),
  };
}

export function findNearestLandmark(
  landmarks: Landmark[],
  zone?: IndoorZone,
): Landmark | null {
  if (landmarks.length === 0) return null;
  if (zone) {
    const zoned = landmarks.filter((l) => l.indoorZone === zone);
    if (zoned.length > 0) return zoned[0];
  }
  return landmarks[0];
}

export function findLandmarkByType(
  landmarks: Landmark[],
  type: LandmarkType,
): Landmark | null {
  return landmarks.find((l) => l.type === type) ?? null;
}

// ─── Guidance Generation ──────────────────────────────────────────────────────

export function buildLandmarkAnnouncement(
  landmark: Landmark,
  relation: 'ahead' | 'on your left' | 'on your right' | 'behind you' = 'ahead',
): string {
  const name = landmark.name;
  const type = formatLandmarkType(landmark.type);
  const dist = landmark.estimatedDistanceM
    ? ` in about ${Math.round(landmark.estimatedDistanceM)} metres`
    : '';
  return `${type}: ${name} ${relation}${dist}.`;
}

export function announceLandmark(
  landmark: Landmark,
  relation: 'ahead' | 'on your left' | 'on your right' | 'behind you' = 'ahead',
): GuidanceLine {
  return {
    text: buildLandmarkAnnouncement(landmark, relation),
    priority: landmark.type === 'stairs' || landmark.type === 'crossing' ? 'high' : 'normal',
    suppressIfSimilar: false,
    spokenAt: null,
  };
}

// ─── Landmark Labels ─────────────────────────────────────────────────────────

export function formatLandmarkType(type: LandmarkType): string {
  const labels: Record<LandmarkType, string> = {
    door: 'Door',
    stairs: 'Stairs',
    elevator: 'Elevator',
    escalator: 'Escalator',
    crossing: 'Crossing',
    entrance: 'Entrance',
    exit: 'Exit',
    junction: 'Junction',
    landmark: 'Landmark',
    bus_stop: 'Bus stop',
    traffic_light: 'Traffic light',
    custom: 'Point of interest',
  };
  return labels[type] ?? type;
}

// ─── Detection to Landmark ────────────────────────────────────────────────────

const LABEL_TO_LANDMARK: Partial<Record<string, LandmarkType>> = {
  door: 'door',
  stairs: 'stairs',
  elevator: 'elevator',
  escalator: 'escalator',
  crosswalk: 'crossing',
  traffic_light: 'traffic_light',
};

export function detectLandmarksFromLabels(detectedLabels: string[]): LandmarkType[] {
  const found: LandmarkType[] = [];
  for (const label of detectedLabels) {
    const type = LABEL_TO_LANDMARK[label];
    if (type && !found.includes(type)) found.push(type);
  }
  return found;
}

export function buildLandmarksFromDetections(
  detectedLabels: string[],
): Landmark[] {
  return detectLandmarksFromLabels(detectedLabels).map((type) =>
    createLandmark(formatLandmarkType(type), type),
  );
}

// ─── Saved Route Memory (consent required) ───────────────────────────────────

export function canSaveRouteMemory(session: NavigationSession): boolean {
  return session.locationConsentGiven && session.privacy.routeMemoryOnlyWithConsent;
}

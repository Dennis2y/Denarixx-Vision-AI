// ─── V13 Landmark Guidance Engine ────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Creates, stores, and announces landmarks along a navigation route.
// Sprint 6: adds LandmarkMemoryStore CRUD with consent enforcement.

import type {
  Landmark,
  LandmarkType,
  IndoorZone,
  GuidanceLine,
  NavigationSession,
  SavedLandmark,
  LandmarkMemoryStore,
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

// ─── Sprint 6: Landmark Memory Store ─────────────────────────────────────────

export const LANDMARK_PRIVACY_WARNING =
  'Landmark locations are stored only with your consent. ' +
  'No precise GPS coordinates are saved unless you explicitly agree. ' +
  'You can delete any saved landmark at any time.';

export const LANDMARK_MEMORY_MAX = 50;

export function createLandmarkMemoryStore(consentGiven = false): LandmarkMemoryStore {
  return {
    landmarks: [],
    consentGiven,
    maxLandmarks: LANDMARK_MEMORY_MAX,
  };
}

/**
 * Save a landmark to the store.
 * Requires consentGiven === true.
 * Returns the updated store, plus an optional error string on failure.
 */
export function saveLandmark(
  store: LandmarkMemoryStore,
  landmark: Landmark,
  options: { fuzzyLatitude?: number; fuzzyLongitude?: number } = {},
): { store: LandmarkMemoryStore; error?: string } {
  if (!store.consentGiven) {
    return {
      store,
      error: 'Consent required to save landmarks. Enable location memory in settings.',
    };
  }
  if (store.landmarks.length >= store.maxLandmarks) {
    return {
      store,
      error: `Landmark store is full (${store.maxLandmarks} maximum). Delete an existing landmark first.`,
    };
  }
  const alreadyExists = store.landmarks.some((l) => l.id === landmark.id);
  if (alreadyExists) {
    return { store, error: `Landmark "${landmark.name}" is already saved.` };
  }
  const saved: SavedLandmark = {
    ...landmark,
    ...(options.fuzzyLatitude !== undefined ? { fuzzyLatitude: options.fuzzyLatitude } : {}),
    ...(options.fuzzyLongitude !== undefined ? { fuzzyLongitude: options.fuzzyLongitude } : {}),
  };
  return { store: { ...store, landmarks: [...store.landmarks, saved] } };
}

/**
 * Delete a saved landmark by id.
 * Returns updated store and whether a deletion actually occurred.
 */
export function deleteSavedLandmark(
  store: LandmarkMemoryStore,
  id: string,
): { store: LandmarkMemoryStore; deleted: boolean } {
  const before = store.landmarks.length;
  const landmarks = store.landmarks.filter((l) => l.id !== id);
  return {
    store: { ...store, landmarks },
    deleted: landmarks.length < before,
  };
}

/**
 * Retrieve a saved landmark for navigation by id.
 * Returns null if not found.
 */
export function navigateToLandmark(
  store: LandmarkMemoryStore,
  id: string,
): SavedLandmark | null {
  return store.landmarks.find((l) => l.id === id) ?? null;
}

/**
 * List all saved landmarks, newest first.
 */
export function listSavedLandmarks(store: LandmarkMemoryStore): SavedLandmark[] {
  return [...store.landmarks].sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Find a saved landmark by name (case-insensitive partial match).
 */
export function findLandmarkByName(
  store: LandmarkMemoryStore,
  query: string,
): SavedLandmark | null {
  const q = query.toLowerCase();
  return store.landmarks.find((l) => l.name.toLowerCase().includes(q)) ?? null;
}

/**
 * Update consent status on the store.
 * Existing landmarks are preserved — caller decides whether to purge them.
 */
export function setLandmarkMemoryConsent(
  store: LandmarkMemoryStore,
  consentGiven: boolean,
): LandmarkMemoryStore {
  return { ...store, consentGiven };
}

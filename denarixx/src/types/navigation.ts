// ─── V13 Indoor & Outdoor Navigation Types ───────────────────────────────────
// Separate from src/types/index.ts (V1 NavigationGuidance) to avoid conflicts.

// ─── Modes & Environments ────────────────────────────────────────────────────

export type NavigationMode = 'indoor' | 'outdoor';

export type IndoorZone =
  | 'room'
  | 'corridor'
  | 'stairs'
  | 'elevator'
  | 'escalator'
  | 'doorway'
  | 'entrance'
  | 'exit'
  | 'unknown';

export type OutdoorEnvironment =
  | 'pavement'
  | 'road'
  | 'crossing'
  | 'park'
  | 'station'
  | 'carpark'
  | 'unknown';

export type IndoorVenueMode =
  | 'generic'
  | 'office'
  | 'supermarket'
  | 'station'
  | 'airport'
  | 'shopping_mall';

// ─── Route State ─────────────────────────────────────────────────────────────

export type RouteState =
  | 'idle'
  | 'navigating'
  | 'paused'
  | 'arrived'
  | 'rerouting'
  | 'lost';

export type RiskLevel = 'clear' | 'low' | 'moderate' | 'high' | 'critical';

export const RISK_ORDER: RiskLevel[] = ['clear', 'low', 'moderate', 'high', 'critical'];

// ─── Heading ─────────────────────────────────────────────────────────────────

export type CardinalDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// ─── Landmark ────────────────────────────────────────────────────────────────

export type LandmarkType =
  | 'door'
  | 'stairs'
  | 'elevator'
  | 'escalator'
  | 'crossing'
  | 'entrance'
  | 'exit'
  | 'junction'
  | 'landmark'
  | 'bus_stop'
  | 'traffic_light'
  | 'custom';

export interface Landmark {
  id: string;
  name: string;
  description: string;
  type: LandmarkType;
  indoorZone?: IndoorZone;
  headingDeg?: number;
  estimatedDistanceM?: number;
  savedAt: number;
}

// ─── Route Segment ───────────────────────────────────────────────────────────

export interface RouteSegment {
  segmentId: string;
  from: string;
  to: string;
  instruction: string;
  headingDeg: number;
  estimatedDistanceM: number;
  type: 'straight' | 'turn_left' | 'turn_right' | 'crossing' | 'stairs' | 'arrive';
  riskLevel: RiskLevel;
  landmark?: Landmark;
}

// ─── Guidance Line ───────────────────────────────────────────────────────────

export interface GuidanceLine {
  text: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  suppressIfSimilar: boolean;
  spokenAt: number | null;
}

// ─── Crossing Decision ───────────────────────────────────────────────────────

export type CrossingType = 'pedestrian_crossing' | 'road_crossing' | 'junction' | 'driveway';

export interface CrossingDecision {
  crossingType: CrossingType;
  riskLevel: RiskLevel;
  detectedObjects: string[];
  vehiclesDetected: number;
  lightState: 'unknown' | 'red' | 'green' | 'flashing';
  message: string;
  suggestedAction: 'stop' | 'wait_and_check' | 'proceed_with_care' | 'find_alternative';
  confidence: number;
}

// ─── Navigation Session ──────────────────────────────────────────────────────

export interface NavigationSession {
  sessionId: string;
  mode: NavigationMode;
  destination: string;
  state: RouteState;
  currentSegmentIndex: number;
  segments: RouteSegment[];
  currentHeadingDeg: number;
  distanceRemainingM: number;
  riskLevel: RiskLevel;
  lastCrossingDecision: CrossingDecision | null;
  guidanceQueue: GuidanceLine[];
  landmarks: Landmark[];
  venueMode: IndoorVenueMode;
  environment: OutdoorEnvironment;
  startedAt: number;
  lastUpdatedAt: number;
  locationConsentGiven: boolean;
  privacy: NavigationPrivacy;
}

// ─── Privacy ─────────────────────────────────────────────────────────────────

export interface NavigationPrivacy {
  readonly noPreciseLocation: boolean;
  readonly routeMemoryOnlyWithConsent: boolean;
  readonly noThirdPartySharing: true;
}

export const NAVIGATION_PRIVACY: NavigationPrivacy = {
  noPreciseLocation: true,
  routeMemoryOnlyWithConsent: true,
  noThirdPartySharing: true,
};

// ─── Route Memory ────────────────────────────────────────────────────────────

export interface RouteMemory {
  id: string;
  name: string;
  destination: string;
  mode: NavigationMode;
  segments: RouteSegment[];
  usedAt: number;
  consentGiven: boolean;
}

// ─── Navigation Settings ─────────────────────────────────────────────────────

export interface NavigationSettings {
  mode: NavigationMode;
  locationPrecision: 'fuzzy' | 'precise';
  routeMemoryEnabled: boolean;
  crossingWarningsEnabled: boolean;
  landmarkAnnouncements: boolean;
  venueMode: IndoorVenueMode;
}

export const DEFAULT_NAVIGATION_SETTINGS: NavigationSettings = {
  mode: 'outdoor',
  locationPrecision: 'fuzzy',
  routeMemoryEnabled: false,
  crossingWarningsEnabled: true,
  landmarkAnnouncements: true,
  venueMode: 'generic',
};

// ─── Update Input ────────────────────────────────────────────────────────────

export interface NavigationUpdate {
  headingDeg?: number;
  distanceTraveledM?: number;
  detectedLabels?: string[];
  crossingAttempt?: boolean;
}

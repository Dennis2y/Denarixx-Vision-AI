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
  | 'requesting_location'  // Sprint 6: waiting for geolocation permission
  | 'navigating'
  | 'off_route'            // Sprint 6: user-friendly name for heading deviation
  | 'paused'
  | 'ended'                // Sprint 6: explicit session end (alias for arrived)
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

// ─── Sprint 6: Geolocation Permission ────────────────────────────────────────

export type GeolocationPermission =
  | 'not_requested'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable';

export interface GeolocationState {
  permission: GeolocationPermission;
  /** True if GPS data is available for use */
  hasGPS: boolean;
  /** True if compass/IMU heading is available as fallback */
  hasFallback: boolean;
  /** Which source is providing heading */
  headingSource: 'compass' | 'gps' | 'none';
  /** Human-readable warning text when permission is denied or unavailable */
  warningText: string | null;
}

// ─── Sprint 6: Route Guidance Types ──────────────────────────────────────────

export type RouteGuidanceType =
  | 'continue_straight'
  | 'turn_slightly_left'
  | 'turn_slightly_right'
  | 'turn_left'
  | 'turn_right'
  | 'stop'
  | 'crossing_ahead'
  | 'landmark_ahead';

// ─── Sprint 6: Landmark Memory ────────────────────────────────────────────────

export interface SavedLandmark extends Landmark {
  /** Fuzzy latitude stored only with explicit consent */
  fuzzyLatitude?: number;
  /** Fuzzy longitude stored only with explicit consent */
  fuzzyLongitude?: number;
}

export interface LandmarkMemoryStore {
  landmarks: SavedLandmark[];
  /** Consent must be explicitly granted before saving locations */
  consentGiven: boolean;
  /** Maximum saved landmarks (default 50) */
  maxLandmarks: number;
}

// ─── Sprint 6: Navigation → Guardian Bridge ───────────────────────────────────

export interface NavigationGuardianInput {
  /** Risk from navigation system */
  riskLevel: RiskLevel;
  /** Labels detected by vision that triggered the risk */
  detectedLabels: string[];
  /** Current navigation session state */
  state: RouteState;
  /** True when a crossing segment is immediately ahead */
  crossingAhead: boolean;
  /** True when the user is deviating from the route */
  offRoute: boolean;
  /** Human-readable guidance message for Guardian to speak */
  guidanceMessage: string | null;
}

// ─── Sprint 6: Privacy ────────────────────────────────────────────────────────

export const LOCATION_PRIVACY_WARNING =
  'Location is not stored unless you explicitly save a landmark. ' +
  'Fuzzy mode (default) limits GPS precision to protect your privacy. ' +
  'Precise location requires your explicit consent.';

export const NAVIGATION_PRIVACY_DEFAULTS = {
  noPreciseLocationByDefault: true,
  consentRequiredForLandmarkSaving: true,
  noThirdPartySharing: true,
  showPrivacyWarningOnStart: true,
} as const;

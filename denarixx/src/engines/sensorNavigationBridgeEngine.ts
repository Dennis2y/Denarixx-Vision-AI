// ─── Sprint 6: Sensor Navigation Bridge Engine ───────────────────────────────
// Pure functions — no async, no I/O.
// Connects V7 SensorContext to the V13 NavigationIntelligenceEngine:
//   - Translates sensor readings into NavigationUpdate inputs
//   - Builds GeolocationState from live permission/data status
//   - Selects best heading source (compass > GPS > null)
//   - Builds NavigationGuardianInput to feed nav risk into Cognitive Guardian

import type { SensorContext } from '@/types/sensors';
import type {
  NavigationUpdate,
  GeolocationState,
  GeolocationPermission,
  NavigationGuardianInput,
  NavigationSession,
  RiskLevel,
  RouteState,
} from '@/types/navigation';
import { currentSegment } from '@/engines/navigationIntelligenceEngine';

// ─── Heading Selection ────────────────────────────────────────────────────────

/**
 * Choose the best heading source available.
 * Priority: compass alpha (DeviceOrientation) > GPS track heading > null.
 */
export function selectHeadingFromSensor(ctx: SensorContext): number | null {
  if (ctx.compass !== null) {
    const alpha = ((ctx.compass.alpha % 360) + 360) % 360;
    return alpha;
  }
  if (ctx.gps !== null && ctx.gps.heading !== null) {
    return ctx.gps.heading;
  }
  // headingDegrees is the pre-fused value from sensorFusionEngine
  if (ctx.headingDegrees !== null) {
    return ctx.headingDegrees;
  }
  return null;
}

// ─── Sensor → NavigationUpdate ────────────────────────────────────────────────

/**
 * Build a NavigationUpdate from a live SensorContext.
 * Falls back to simulated distance when GPS speed is unavailable.
 */
export function buildNavigationUpdateFromSensor(
  ctx: SensorContext,
  simulatedDistanceM = 1.2,
): NavigationUpdate {
  const heading = selectHeadingFromSensor(ctx);

  // Derive distance from GPS speed or use simulation value
  let distanceTraveledM: number;
  if (ctx.gps !== null && ctx.gps.speed !== null && ctx.gps.speed >= 0) {
    // Speed in m/s × 0.5 s tick ≈ distance per tick at ~2 Hz
    distanceTraveledM = ctx.gps.speed * 0.5;
  } else {
    // Use simulated walking pace when GPS unavailable
    distanceTraveledM = ctx.motionState === 'standing' ? 0 : simulatedDistanceM;
  }

  return {
    headingDeg: heading ?? undefined,
    distanceTraveledM,
  };
}

// ─── Geolocation State Builder ────────────────────────────────────────────────

export function buildGeolocationState(ctx: SensorContext): GeolocationState {
  const geoPermission = ctx.permissions.geolocation;
  const orientPermission = ctx.permissions.deviceOrientation;

  const permission = mapPermissionStatus(geoPermission);
  const hasGPS = geoPermission === 'granted' && ctx.gps !== null;
  const hasFallback =
    orientPermission === 'granted' && ctx.compass !== null;

  let headingSource: GeolocationState['headingSource'];
  if (ctx.compass !== null) {
    headingSource = 'compass';
  } else if (hasGPS && ctx.gps?.heading !== null) {
    headingSource = 'gps';
  } else {
    headingSource = 'none';
  }

  const warningText = buildGeolocationWarning(permission, hasGPS, hasFallback);

  return { permission, hasGPS, hasFallback, headingSource, warningText };
}

function mapPermissionStatus(
  status: 'granted' | 'denied' | 'prompt' | 'unavailable',
): GeolocationPermission {
  switch (status) {
    case 'granted': return 'granted';
    case 'denied': return 'denied';
    case 'prompt': return 'not_requested';
    case 'unavailable': return 'unavailable';
  }
}

export function buildGeolocationWarning(
  permission: GeolocationPermission,
  hasGPS: boolean,
  hasFallback: boolean,
): string | null {
  if (permission === 'denied') {
    return hasFallback
      ? 'Location access denied. Using compass heading only — distances are estimated.'
      : 'Location access denied. Navigation uses estimated heading and distance only.';
  }
  if (permission === 'unavailable') {
    return 'Location services are not available on this device.';
  }
  if (permission === 'granted' && !hasGPS) {
    return 'Waiting for GPS fix. Navigation will improve once location is confirmed.';
  }
  if (permission === 'not_requested') {
    return 'Location permission not yet requested. Tap to enable GPS guidance.';
  }
  return null;
}

// ─── Heading Instruction ──────────────────────────────────────────────────────

/**
 * Build a human-readable instruction from the heading deviation between
 * the current sensor reading and the target route segment heading.
 */
export function buildSensorHeadingInstruction(
  sensorHeadingDeg: number | null,
  targetHeadingDeg: number,
): string {
  if (sensorHeadingDeg === null) {
    return 'Heading unavailable. Follow route instructions carefully.';
  }
  const diff = ((targetHeadingDeg - sensorHeadingDeg + 180 + 360) % 360) - 180;
  const abs = Math.abs(diff);
  if (abs <= 10) return 'Continue straight.';
  if (abs <= 30) return diff > 0 ? 'Turn slightly right.' : 'Turn slightly left.';
  if (abs <= 70) return diff > 0 ? 'Turn right.' : 'Turn left.';
  if (abs <= 130) return diff > 0 ? 'Turn sharply right.' : 'Turn sharply left.';
  return 'Turn around.';
}

// ─── Navigation → Guardian Bridge ─────────────────────────────────────────────

const NAV_RISK_TO_COGNITIVE: Record<RiskLevel, string> = {
  clear: 'none',
  low: 'low',
  moderate: 'medium',
  high: 'high',
  critical: 'critical',
};

/**
 * Map a navigation risk level to a cognitive guardian risk label.
 * The cognitive guardian uses 'none'|'low'|'medium'|'high'|'critical'.
 */
export function mapNavRiskToCognitive(navRisk: RiskLevel): string {
  return NAV_RISK_TO_COGNITIVE[navRisk];
}

/**
 * Build a NavigationGuardianInput from a navigation session and vision labels.
 * This feeds navigation awareness into the Cognitive Guardian.
 */
export function buildNavigationGuardianInput(
  session: NavigationSession,
  detectedLabels: string[] = [],
): NavigationGuardianInput {
  const seg = currentSegment(session);
  const nextSeg = session.segments[session.currentSegmentIndex + 1] ?? null;
  const crossingAhead =
    seg?.type === 'crossing' ||
    nextSeg?.type === 'crossing' ||
    detectedLabels.includes('crosswalk') ||
    detectedLabels.includes('traffic_light');

  const offRoute = session.state === 'off_route' || session.state === 'rerouting';

  const guidanceMessage = buildGuardianNavigationMessage(session, crossingAhead, offRoute);

  return {
    riskLevel: session.riskLevel,
    detectedLabels,
    state: session.state,
    crossingAhead,
    offRoute,
    guidanceMessage,
  };
}

function buildGuardianNavigationMessage(
  session: NavigationSession,
  crossingAhead: boolean,
  offRoute: boolean,
): string | null {
  if (session.state === 'ended' || session.state === 'arrived') return null;
  if (session.state === 'requesting_location') return null;

  if (session.riskLevel === 'critical') {
    return 'Stop. High-risk area detected on your navigation route.';
  }
  if (crossingAhead && session.riskLevel !== 'clear') {
    return 'Crossing ahead. Please stop and check carefully before proceeding.';
  }
  if (offRoute) {
    return 'You appear to be off your route. Turn to correct your heading.';
  }
  if (session.riskLevel === 'high') {
    return 'Caution. High-risk area on your route.';
  }
  if (crossingAhead) {
    return 'Crossing ahead. Stop before crossing and check carefully.';
  }
  return null;
}

// ─── Motion-Aware Frame Skip ──────────────────────────────────────────────────

/**
 * Determine if the navigation tick should be skipped based on battery and motion.
 * Returns true when the tick should be skipped to conserve power.
 */
export function shouldSkipNavigationTick(
  ctx: SensorContext,
  tickNumber: number,
): boolean {
  if (ctx.isLowPowerMode) {
    // Low power: process every 4th tick only
    return tickNumber % 4 !== 0;
  }
  if (ctx.motionState === 'standing') {
    // Standing still: process every 2nd tick
    return tickNumber % 2 !== 0;
  }
  return false;
}

// ─── Fallback Heading ─────────────────────────────────────────────────────────

/**
 * Return the best available heading with a description of its source.
 * Used for UI display and logging.
 */
export function describeHeadingSource(ctx: SensorContext): {
  degrees: number | null;
  source: 'compass' | 'gps' | 'fused' | 'none';
  isApproximate: boolean;
} {
  if (ctx.compass !== null) {
    return { degrees: ((ctx.compass.alpha % 360) + 360) % 360, source: 'compass', isApproximate: false };
  }
  if (ctx.gps !== null && ctx.gps.heading !== null) {
    return { degrees: ctx.gps.heading, source: 'gps', isApproximate: false };
  }
  if (ctx.headingDegrees !== null) {
    return { degrees: ctx.headingDegrees, source: 'fused', isApproximate: true };
  }
  return { degrees: null, source: 'none', isApproximate: true };
}

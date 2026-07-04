// ─── V13 Navigation Intelligence Engine ──────────────────────────────────────
// Pure functions — no async, no I/O.
// Orchestrates session lifecycle, guidance selection, and route advancement.

import type {
  NavigationSession,
  NavigationMode,
  RouteState,
  GuidanceLine,
  NavigationUpdate,
  RouteSegment,
  NavigationSettings,
} from '@/types/navigation';
import {
  NAVIGATION_PRIVACY,
  DEFAULT_NAVIGATION_SETTINGS,
} from '@/types/navigation';
import { generateIndoorRoute, buildIndoorGuidance } from '@/engines/indoorNavigationEngine';
import { generateOutdoorRoute, buildOutdoorGuidance, detectRouteDeviation } from '@/engines/outdoorNavigationEngine';
import { assessRouteRisk, shouldPauseNavigation, maxRisk } from '@/engines/routeSafetyEngine';

// ─── Session Factory ──────────────────────────────────────────────────────────

export function createNavigationSession(
  destination: string,
  mode: NavigationMode,
  locationConsentGiven = false,
  settings: Partial<NavigationSettings> = {},
): NavigationSession {
  const mergedSettings = { ...DEFAULT_NAVIGATION_SETTINGS, ...settings };
  const segments = mode === 'indoor'
    ? generateIndoorRoute(destination, mergedSettings.venueMode)
    : generateOutdoorRoute(destination);
  const totalDistance = segments.reduce((s, seg) => s + seg.estimatedDistanceM, 0);

  return {
    sessionId: `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    destination,
    state: 'navigating',
    currentSegmentIndex: 0,
    segments,
    currentHeadingDeg: segments[0]?.headingDeg ?? 0,
    distanceRemainingM: totalDistance,
    riskLevel: 'low',
    lastCrossingDecision: null,
    guidanceQueue: [],
    landmarks: [],
    venueMode: mergedSettings.venueMode,
    environment: 'pavement',
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    locationConsentGiven,
    privacy: NAVIGATION_PRIVACY,
  };
}

// ─── Session Lifecycle ────────────────────────────────────────────────────────

export function pauseNavigation(session: NavigationSession): NavigationSession {
  if (session.state === 'arrived' || session.state === 'ended') return session;
  return { ...session, state: 'paused', lastUpdatedAt: Date.now() };
}

export function resumeNavigation(session: NavigationSession): NavigationSession {
  if (session.state !== 'paused') return session;
  return { ...session, state: 'navigating', lastUpdatedAt: Date.now() };
}

export function endNavigationSession(session: NavigationSession): NavigationSession {
  return { ...session, state: 'arrived', lastUpdatedAt: Date.now() };
}

export function markLost(session: NavigationSession): NavigationSession {
  return { ...session, state: 'lost', lastUpdatedAt: Date.now() };
}

export function startRerouting(session: NavigationSession): NavigationSession {
  return { ...session, state: 'rerouting', lastUpdatedAt: Date.now() };
}

// ─── Sprint 6: New State Transitions ─────────────────────────────────────────

/** Request geolocation permission — transitions to 'requesting_location'. */
export function requestLocationPermission(session: NavigationSession): NavigationSession {
  if (session.state !== 'idle') return session;
  return { ...session, state: 'requesting_location', lastUpdatedAt: Date.now() };
}

/**
 * Geolocation permission granted.
 * Transitions from 'requesting_location' → 'navigating'.
 * Also updates locationConsentGiven so route memory is available.
 */
export function onLocationGranted(session: NavigationSession): NavigationSession {
  if (session.state !== 'requesting_location') return session;
  return {
    ...session,
    state: 'navigating',
    locationConsentGiven: true,
    lastUpdatedAt: Date.now(),
  };
}

/**
 * Geolocation permission denied or unavailable.
 * Transitions from 'requesting_location' → 'navigating' with compass/IMU fallback.
 * locationConsentGiven stays false — no route memory allowed.
 */
export function onLocationDenied(session: NavigationSession): NavigationSession {
  if (session.state !== 'requesting_location') return session;
  return { ...session, state: 'navigating', lastUpdatedAt: Date.now() };
}

/**
 * Explicit session end (Sprint 6 alias for arrived).
 * Use when the user manually stops rather than arriving at a destination.
 */
export function endNavigation(session: NavigationSession): NavigationSession {
  return { ...session, state: 'ended', lastUpdatedAt: Date.now() };
}

/**
 * Mark the user as off-route (Sprint 6 user-friendly alias for rerouting).
 * Use when heading deviation > threshold.
 */
export function setOffRoute(session: NavigationSession): NavigationSession {
  if (session.state === 'arrived' || session.state === 'ended') return session;
  return { ...session, state: 'off_route', lastUpdatedAt: Date.now() };
}

/**
 * Return from off-route back to navigating (heading corrected).
 */
export function clearOffRoute(session: NavigationSession): NavigationSession {
  if (session.state !== 'off_route' && session.state !== 'rerouting') return session;
  return { ...session, state: 'navigating', lastUpdatedAt: Date.now() };
}

// ─── Route Advancement ────────────────────────────────────────────────────────

export function advanceRouteSegment(session: NavigationSession): NavigationSession {
  const nextIndex = session.currentSegmentIndex + 1;
  if (nextIndex >= session.segments.length) {
    return endNavigationSession(session);
  }
  const nextSegment = session.segments[nextIndex];
  const distanceConsumed = session.segments[session.currentSegmentIndex]?.estimatedDistanceM ?? 0;
  return {
    ...session,
    currentSegmentIndex: nextIndex,
    currentHeadingDeg: nextSegment.headingDeg,
    distanceRemainingM: Math.max(0, session.distanceRemainingM - distanceConsumed),
    riskLevel: nextSegment.riskLevel,
    lastUpdatedAt: Date.now(),
  };
}

export function currentSegment(session: NavigationSession): RouteSegment | null {
  return session.segments[session.currentSegmentIndex] ?? null;
}

export function nextSegment(session: NavigationSession): RouteSegment | null {
  return session.segments[session.currentSegmentIndex + 1] ?? null;
}

// ─── Session Update ───────────────────────────────────────────────────────────

export function updateNavigationSession(
  session: NavigationSession,
  update: NavigationUpdate,
): NavigationSession {
  if (session.state === 'arrived' || session.state === 'ended') return session;

  let updated = { ...session, lastUpdatedAt: Date.now() };

  if (update.headingDeg !== undefined) {
    const target = currentSegment(session)?.headingDeg ?? session.currentHeadingDeg;
    const deviated = detectRouteDeviation(target, update.headingDeg);
    const isActivelyNavigating = session.state === 'navigating';
    updated = {
      ...updated,
      currentHeadingDeg: update.headingDeg,
      state: deviated && isActivelyNavigating ? 'rerouting' : updated.state,
    };
  }

  if (update.distanceTraveledM !== undefined && update.distanceTraveledM > 0) {
    const seg = currentSegment(session);
    if (seg) {
      const newDist = Math.max(0, session.distanceRemainingM - update.distanceTraveledM);
      updated = { ...updated, distanceRemainingM: newDist };
      // Auto-advance if we've traveled enough
      if (update.distanceTraveledM >= seg.estimatedDistanceM * 0.9) {
        updated = advanceRouteSegment(updated);
      }
    }
  }

  if (update.detectedLabels && update.detectedLabels.length > 0) {
    const riskLevel = assessRouteRisk(update.detectedLabels, session.mode, session.environment);
    const combined = maxRisk(riskLevel, updated.riskLevel);
    if (shouldPauseNavigation(combined) && updated.state === 'navigating') {
      updated = { ...updated, riskLevel: combined, state: 'paused' };
    } else {
      updated = { ...updated, riskLevel: combined };
    }
  }

  return updated;
}

// ─── Guidance Selection ───────────────────────────────────────────────────────

const GUIDANCE_COOLDOWN_MS = 4000;

export function selectGuidance(
  session: NavigationSession,
  lastSpokenAt: number,
  nowMs: number = Date.now(),
): GuidanceLine | null {
  // Terminal states
  if (session.state === 'arrived' || session.state === 'ended') {
    const verb = session.state === 'ended' ? 'Navigation ended.' : `You have arrived at ${session.destination}.`;
    return { text: verb, priority: 'high', suppressIfSimilar: false, spokenAt: null };
  }

  // Waiting states — no movement guidance
  if (session.state === 'idle') return null;
  if (session.state === 'requesting_location') {
    return { text: 'Waiting for location permission. Please grant access to enable GPS guidance.', priority: 'normal', suppressIfSimilar: true, spokenAt: null };
  }

  const cooldownElapsed = nowMs - lastSpokenAt >= GUIDANCE_COOLDOWN_MS;

  // Urgent guidance bypasses cooldown
  if (session.riskLevel === 'critical') {
    const seg = currentSegment(session);
    return { text: seg ? `Stop. ${seg.instruction}` : 'Stop immediately.', priority: 'urgent', suppressIfSimilar: false, spokenAt: null };
  }

  if (!cooldownElapsed) return null;

  // Sprint 6: 'off_route' is the user-friendly name for heading deviation
  if (session.state === 'off_route' || session.state === 'rerouting') {
    return { text: 'You are off your route. Turn to correct your heading.', priority: 'high', suppressIfSimilar: false, spokenAt: null };
  }

  if (session.state === 'paused') {
    return { text: 'Navigation paused. When ready, resume walking.', priority: 'normal', suppressIfSimilar: true, spokenAt: null };
  }

  const guidance = session.mode === 'indoor'
    ? buildIndoorGuidance(session)
    : buildOutdoorGuidance(session);

  return guidance;
}

// ─── Simulation Tick ──────────────────────────────────────────────────────────
// Advances the simulation by one tick (for the UI pipeline).
// Sprint 6: accepts optional sensorUpdate to use real sensor data in place of simulation.

export function processNavigationTick(
  session: NavigationSession,
  tick: number,
  lastSpokenAt: number,
  sensorUpdate?: NavigationUpdate,
): { session: NavigationSession; guidance: GuidanceLine | null } {
  if (
    session.state === 'arrived' ||
    session.state === 'ended' ||
    session.state === 'idle' ||
    session.state === 'requesting_location'
  ) {
    const guidance = selectGuidance(session, lastSpokenAt, Date.now());
    return { session, guidance };
  }

  let update: NavigationUpdate;
  if (sensorUpdate !== undefined) {
    // Use real sensor data when available
    update = sensorUpdate;
  } else {
    // Simulate heading drift and walking distance
    const driftDeg = Math.sin(tick * 0.1) * 8;
    const simHeading = ((session.currentHeadingDeg + driftDeg) + 360) % 360;
    update = { headingDeg: simHeading, distanceTraveledM: 1.2 };
  }

  const updated = updateNavigationSession(session, update);
  const guidance = selectGuidance(updated, lastSpokenAt, Date.now());
  return { session: updated, guidance };
}

// ─── Route Progress ───────────────────────────────────────────────────────────

export function getRouteProgressPct(session: NavigationSession): number {
  const total = session.segments.reduce((s, seg) => s + seg.estimatedDistanceM, 0);
  if (total === 0) return 100;
  return Math.round(Math.max(0, Math.min(100, (1 - session.distanceRemainingM / total) * 100)));
}

export function getRouteStateLabel(state: RouteState): string {
  const labels: Record<RouteState, string> = {
    idle: 'Idle',
    requesting_location: '📍 Requesting Location',
    navigating: '🧭 Navigating',
    off_route: '↩️ Off Route',
    paused: '⏸ Paused',
    ended: '⏹ Ended',
    arrived: '✅ Arrived',
    rerouting: '🔄 Rerouting',
    lost: '❓ Lost',
  };
  return labels[state] ?? state;
}

export function isRouteActive(session: NavigationSession): boolean {
  return (
    session.state === 'navigating' ||
    session.state === 'rerouting' ||
    session.state === 'off_route'
  );
}

/** True when the session has definitively finished (arrived or explicitly ended). */
export function isRouteEnded(session: NavigationSession): boolean {
  return session.state === 'arrived' || session.state === 'ended';
}

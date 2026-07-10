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
  RISK_ORDER,
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
  if (session.state === 'arrived') return session;
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
  if (session.state === 'arrived') return session;

  let updated = { ...session, lastUpdatedAt: Date.now() };

  if (update.headingDeg !== undefined) {
    const target = currentSegment(session)?.headingDeg ?? session.currentHeadingDeg;
    const deviated = detectRouteDeviation(target, update.headingDeg);
    updated = {
      ...updated,
      currentHeadingDeg: update.headingDeg,
      state: deviated && session.state === 'navigating' ? 'rerouting' : updated.state,
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
  if (session.state === 'arrived') {
    return { text: `You have arrived at ${session.destination}.`, priority: 'high', suppressIfSimilar: false, spokenAt: null };
  }
  if (session.state === 'idle') return null;

  const cooldownElapsed = nowMs - lastSpokenAt >= GUIDANCE_COOLDOWN_MS;

  // Urgent guidance bypasses cooldown
  if (session.riskLevel === 'critical') {
    const seg = currentSegment(session);
    return { text: seg ? `Stop. ${seg.instruction}` : 'Stop immediately.', priority: 'urgent', suppressIfSimilar: false, spokenAt: null };
  }

  if (!cooldownElapsed) return null;

  if (session.state === 'rerouting') {
    return { text: 'Route deviation detected. Turn to correct your heading.', priority: 'high', suppressIfSimilar: false, spokenAt: null };
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

export function processNavigationTick(
  session: NavigationSession,
  tick: number,
  lastSpokenAt: number,
): { session: NavigationSession; guidance: GuidanceLine | null } {
  if (session.state === 'arrived' || session.state === 'idle') {
    return { session, guidance: null };
  }

  // Simulate heading drift
  const driftDeg = Math.sin(tick * 0.1) * 8;
  const simHeading = ((session.currentHeadingDeg + driftDeg) + 360) % 360;

  // Simulate distance traveled: ~1.2 m per tick (walking pace at 5 fps)
  const simDistance = 1.2;

  const updated = updateNavigationSession(session, {
    headingDeg: simHeading,
    distanceTraveledM: simDistance,
  });

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
    navigating: '🧭 Navigating',
    paused: '⏸ Paused',
    arrived: '✅ Arrived',
    rerouting: '🔄 Rerouting',
    lost: '❓ Lost',
  };
  return labels[state] ?? state;
}

export function isRouteActive(session: NavigationSession): boolean {
  return session.state === 'navigating' || session.state === 'rerouting';
}

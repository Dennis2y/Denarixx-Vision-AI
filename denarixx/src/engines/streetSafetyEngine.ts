// ─── Sprint 15: Street Safety Engine ─────────────────────────────────────────
// Pure functions — no async, no I/O.
// Main orchestrator for No-Internet Street Safety Mode.
// Glasses compute module is primary. Phone is fallback. Cloud is optional.
// Critical alerts NEVER wait for internet.

import type {
  StreetSafetyState,
  StreetSafetySummary,
  LocalHazardPattern,
  HazardAlert,
  StreetHazardType,
  HazardDirection,
  ConnectivityFallbackConfig,
} from '@/types/streetSafety';
import type { NetworkReading } from '@/types/offline';
import {
  OFFLINE_MODE_ANNOUNCEMENT,
  GLASSES_PRIMARY_NOTE,
} from '@/types/streetSafety';
import {
  buildInitialFallbackConfig,
  updateFallbackConfig,
  calculateOfflineDurationSeconds,
  consumeAnnouncement,
} from './connectivityFallbackEngine';
import {
  buildLocalHazardPattern,
  updateHazardPattern,
} from './localHazardPatternEngine';
import {
  evaluateAllHazards,
  buildCameraFailureAlert,
  prioritizeHazards,
} from './offlineStreetGuardianEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RECENT_ALERTS = 20;
const HAZARD_STALE_TICKS = 10;

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createStreetSafetyState(): StreetSafetyState {
  return {
    mode: 'online',
    connectivity: buildInitialFallbackConfig(),
    activeHazards: [],
    recentAlerts: [],
    cameraHealthy: true,
    sessionTick: 0,
    guardianActive: true,
    totalAlertsSpoken: 0,
    offlineDurationSeconds: 0,
  };
}

// ─── Hazard Management ────────────────────────────────────────────────────────

export function upsertHazard(
  hazards: LocalHazardPattern[],
  type: StreetHazardType,
  direction: HazardDirection,
  confidence: number,
  tick: number
): LocalHazardPattern[] {
  const idx = hazards.findIndex(h => h.hazardType === type);
  if (idx === -1) {
    return [...hazards, buildLocalHazardPattern(type, direction, confidence, tick)];
  }
  const updated = [...hazards];
  updated[idx] = updateHazardPattern(hazards[idx], confidence, direction, tick);
  return updated;
}

export function clearStaleHazards(
  hazards: LocalHazardPattern[],
  currentTick: number
): LocalHazardPattern[] {
  return hazards.filter(h => currentTick - h.lastSeenTick <= HAZARD_STALE_TICKS);
}

// ─── Alert Queue ──────────────────────────────────────────────────────────────

export function addAlerts(
  existing: HazardAlert[],
  newAlerts: HazardAlert[]
): HazardAlert[] {
  const combined = [...existing, ...newAlerts];
  return combined.slice(-MAX_RECENT_ALERTS);
}

// ─── Main Tick Processor ──────────────────────────────────────────────────────

export interface StreetSafetyTickInput {
  network: NetworkReading;
  detectedHazardTypes: Array<{ type: StreetHazardType; direction: HazardDirection; confidence: number }>;
  isCameraHealthy: boolean;
}

export function processStreetSafetyTick(
  state: StreetSafetyState,
  input: StreetSafetyTickInput
): { state: StreetSafetyState; announcements: string[]; alertsSpoken: HazardAlert[] } {
  const tick = state.sessionTick + 1;
  const announcements: string[] = [];

  const connectivity = updateFallbackConfig(state.connectivity, input.network, tick);
  const { announcement, config: connectivityClean } = consumeAnnouncement(connectivity);
  if (announcement) announcements.push(announcement);

  const mode = connectivityClean.mode;

  let activeHazards = clearStaleHazards(state.activeHazards, tick);
  for (const { type, direction, confidence } of input.detectedHazardTypes) {
    activeHazards = upsertHazard(activeHazards, type, direction, confidence, tick);
  }

  if (!input.isCameraHealthy && state.cameraHealthy) {
    activeHazards = upsertHazard(activeHazards, 'camera-failure', 'unknown', 1.0, tick);
  }

  const guardianDecisions = evaluateAllHazards(activeHazards, state.recentAlerts, tick);
  const alertsSpoken: HazardAlert[] = guardianDecisions
    .filter(d => d.decision === 'speak' && d.alert !== null)
    .map(d => d.alert as HazardAlert);

  const recentAlerts = addAlerts(state.recentAlerts, alertsSpoken);
  const offlineDurationSeconds = calculateOfflineDurationSeconds(connectivityClean, tick);

  const nextState: StreetSafetyState = {
    mode,
    connectivity: connectivityClean,
    activeHazards,
    recentAlerts,
    cameraHealthy: input.isCameraHealthy,
    sessionTick: tick,
    guardianActive: true,
    totalAlertsSpoken: state.totalAlertsSpoken + alertsSpoken.length,
    offlineDurationSeconds,
  };

  return { state: nextState, announcements, alertsSpoken };
}

// ─── Summary for UI ───────────────────────────────────────────────────────────

export function buildStreetSafetySummary(state: StreetSafetyState): StreetSafetySummary {
  const critical = state.activeHazards.filter(h => h.severity === 'critical');
  const prioritised = prioritizeHazards(state.activeHazards);

  return {
    mode: state.mode,
    isOffline: state.mode !== 'online',
    cameraHealthy: state.cameraHealthy,
    activeHazardCount: state.activeHazards.length,
    criticalHazardCount: critical.length,
    recentAlertCount: state.recentAlerts.length,
    offlineDurationSeconds: state.offlineDurationSeconds,
    connectivityState: state.connectivity.connectivityState,
    topHazard: prioritised[0] ?? null,
    guardianActive: state.guardianActive,
  };
}

// ─── Mode Indicator ───────────────────────────────────────────────────────────

export function getStreetSafetModeLabel(state: StreetSafetyState): string {
  switch (state.mode) {
    case 'online':
      return 'Online Street Safety Mode';
    case 'offline':
      return 'Offline Street Safety Mode (Glasses Edge AI)';
    case 'degraded':
      return 'Degraded Street Safety Mode (Weak Connection)';
  }
}

export function getStreetSafetyModeColor(state: StreetSafetyState): 'green' | 'yellow' | 'red' {
  switch (state.mode) {
    case 'online':
      return 'green';
    case 'degraded':
      return 'yellow';
    case 'offline':
      return 'red';
  }
}

export function getGlassesPrimaryNote(): string {
  return GLASSES_PRIMARY_NOTE;
}

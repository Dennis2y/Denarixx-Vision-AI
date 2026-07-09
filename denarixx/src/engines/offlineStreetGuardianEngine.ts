// ─── Sprint 15: Offline Street Guardian Engine ────────────────────────────────
// Pure functions — no async, no I/O.
// Guardian decisions for street safety running on glasses compute module.
// Critical alerts are NEVER blocked waiting for internet or phone.

import type {
  LocalHazardPattern,
  HazardAlert,
  OfflineGuardianDecision,
  GuardianDecision,
  StreetHazardType,
  HazardDirection,
  HazardSeverity,
} from '@/types/streetSafety';
import {
  CROSSING_SAFETY_MESSAGE,
  CAMERA_FAILURE_MESSAGE,
} from '@/types/streetSafety';
import {
  getPatternForHazard,
  getOfflineGuidance,
  buildSpokenMessage,
} from './localHazardPatternEngine';

// ─── Cooldown Config (ticks) ──────────────────────────────────────────────────

const COOLDOWN: Record<HazardSeverity, number> = {
  critical: 2,
  high: 5,
  medium: 8,
  low: 12,
};

// ─── ID Generation ────────────────────────────────────────────────────────────

function generateAlertId(type: StreetHazardType, tick: number): string {
  return `alert-${type}-${tick}`;
}

// ─── Throttle Check ───────────────────────────────────────────────────────────

export function isInCooldown(
  hazard: LocalHazardPattern,
  recentAlerts: HazardAlert[],
  currentTick: number
): boolean {
  const cooldownTicks = COOLDOWN[hazard.severity];
  const lastSameType = recentAlerts
    .filter(a => a.hazardType === hazard.hazardType)
    .sort((a, b) => b.tick - a.tick)[0];
  if (!lastSameType) return false;
  return currentTick - lastSameType.tick < cooldownTicks;
}

// ─── Guidance Selection ───────────────────────────────────────────────────────

export function selectGuidanceForHazard(
  type: StreetHazardType,
  direction: HazardDirection,
  confidence: number
): string {
  if (type === 'crossing') return CROSSING_SAFETY_MESSAGE;
  if (type === 'camera-failure') return CAMERA_FAILURE_MESSAGE;
  return getOfflineGuidance(type, direction, confidence);
}

export function buildOfflineAlert(
  hazard: LocalHazardPattern,
  tick: number
): HazardAlert {
  const pattern = getPatternForHazard(hazard.hazardType);
  const guidance = selectGuidanceForHazard(
    hazard.hazardType,
    hazard.direction,
    hazard.confidence
  );
  const spokenMessage = buildSpokenMessage(pattern, hazard.direction, guidance);
  return {
    id: generateAlertId(hazard.hazardType, tick),
    hazardType: hazard.hazardType,
    severity: hazard.severity,
    direction: hazard.direction,
    guidance,
    spokenMessage,
    confidence: hazard.confidence,
    isOffline: true,
    tick,
  };
}

// ─── Critical Bypass ──────────────────────────────────────────────────────────

export function isCriticalBypass(hazard: LocalHazardPattern): boolean {
  return (
    hazard.severity === 'critical' ||
    hazard.hazardType === 'vehicle' ||
    hazard.hazardType === 'stairs' ||
    hazard.hazardType === 'stop' ||
    hazard.hazardType === 'camera-failure'
  );
}

export function buildCriticalBypassAlert(
  hazard: LocalHazardPattern,
  tick: number
): HazardAlert {
  const alert = buildOfflineAlert(hazard, tick);
  return {
    ...alert,
    id: `critical-${alert.id}`,
  };
}

// ─── Priority Sorting ─────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<HazardSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function prioritizeHazards(
  hazards: LocalHazardPattern[]
): LocalHazardPattern[] {
  return [...hazards].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.confidence - a.confidence;
  });
}

// ─── Guardian Decision ────────────────────────────────────────────────────────

export function evaluateHazardForSpeech(
  hazard: LocalHazardPattern,
  recentAlerts: HazardAlert[],
  tick: number
): OfflineGuardianDecision {
  const bypass = isCriticalBypass(hazard);

  if (bypass) {
    const alert = buildCriticalBypassAlert(hazard, tick);
    return {
      decision: 'speak',
      hazard,
      alert,
      reason: 'Critical hazard — cooldown bypassed on glasses compute module.',
      bypassedThrottle: true,
    };
  }

  if (hazard.confidence < 0.2) {
    return {
      decision: 'silent',
      hazard,
      alert: null,
      reason: 'Confidence too low for offline alert.',
      bypassedThrottle: false,
    };
  }

  if (isInCooldown(hazard, recentAlerts, tick)) {
    return {
      decision: 'silent',
      hazard,
      alert: null,
      reason: `In cooldown for ${hazard.hazardType} (${hazard.severity}).`,
      bypassedThrottle: false,
    };
  }

  const alert = buildOfflineAlert(hazard, tick);
  return {
    decision: 'speak',
    hazard,
    alert,
    reason: 'Hazard above threshold — speaking via bone-conduction.',
    bypassedThrottle: false,
  };
}

// ─── Batch Evaluation ─────────────────────────────────────────────────────────

export function evaluateAllHazards(
  hazards: LocalHazardPattern[],
  recentAlerts: HazardAlert[],
  tick: number
): OfflineGuardianDecision[] {
  const prioritised = prioritizeHazards(hazards);
  const results: OfflineGuardianDecision[] = [];
  const usedTypes = new Set<StreetHazardType>();

  for (const hazard of prioritised) {
    if (usedTypes.has(hazard.hazardType) && !isCriticalBypass(hazard)) continue;
    const decision = evaluateHazardForSpeech(hazard, recentAlerts, tick);
    results.push(decision);
    if (decision.decision === 'speak') usedTypes.add(hazard.hazardType);
  }

  return results;
}

// ─── Camera Failure Guard ─────────────────────────────────────────────────────

export function buildCameraFailureAlert(tick: number): HazardAlert {
  return {
    id: `camera-failure-${tick}`,
    hazardType: 'camera-failure',
    severity: 'critical',
    direction: 'unknown',
    guidance: CAMERA_FAILURE_MESSAGE,
    spokenMessage: `Camera alert: ${CAMERA_FAILURE_MESSAGE}`,
    confidence: 1.0,
    isOffline: true,
    tick,
  };
}

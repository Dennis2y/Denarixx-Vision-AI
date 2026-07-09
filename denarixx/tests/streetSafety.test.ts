// Sprint 15: No-Internet Street Safety Mode — test suite
import {
  HAZARD_PATTERN_LIBRARY,
  getPatternForHazard,
  matchHazardFromKeywords,
  getAllCriticalPatterns,
  estimateHazardSeverity,
  buildLocalHazardPattern,
  updateHazardPattern,
  getOfflineGuidance,
  buildSpokenMessage,
} from '../src/engines/localHazardPatternEngine';

import {
  assessConnectivity,
  isCloudAvailable,
  shouldActivateFallback,
  determineSafetyMode,
  buildInitialFallbackConfig,
  updateFallbackConfig,
  calculateOfflineDurationSeconds,
  consumeAnnouncement,
  buildConnectivityTransition,
  getFallbackGuidanceSource,
  getOfflineModeAnnouncement,
  getOnlineRestoredAnnouncement,
} from '../src/engines/connectivityFallbackEngine';

import {
  isInCooldown,
  selectGuidanceForHazard,
  buildOfflineAlert,
  isCriticalBypass,
  buildCriticalBypassAlert,
  prioritizeHazards,
  evaluateHazardForSpeech,
  evaluateAllHazards,
  buildCameraFailureAlert,
} from '../src/engines/offlineStreetGuardianEngine';

import {
  createStreetSafetyState,
  upsertHazard,
  clearStaleHazards,
  addAlerts,
  processStreetSafetyTick,
  buildStreetSafetySummary,
  getStreetSafetModeLabel,
  getStreetSafetyModeColor,
  getGlassesPrimaryNote,
} from '../src/engines/streetSafetyEngine';

import {
  CROSSING_SAFETY_MESSAGE,
  CAMERA_FAILURE_MESSAGE,
  OFFLINE_MODE_ANNOUNCEMENT,
  ONLINE_RESTORED_ANNOUNCEMENT,
  GLASSES_PRIMARY_NOTE,
} from '../src/types/streetSafety';

import type {
  LocalHazardPattern,
  HazardAlert,
  StreetSafetyState,
} from '../src/types/streetSafety';
import type { NetworkReading } from '../src/types/offline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}: ${msg}`);
    failed++;
  }
}

function expect(val: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (val !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toEqual: (expected: unknown) => {
      if (JSON.stringify(val) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toBeTruthy: () => { if (!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`); },
    toBeFalsy: () => { if (val) throw new Error(`Expected falsy, got ${JSON.stringify(val)}`); },
    toBeNull: () => { if (val !== null) throw new Error(`Expected null, got ${JSON.stringify(val)}`); },
    toBeGreaterThan: (n: number) => { if ((val as number) <= n) throw new Error(`Expected > ${n}, got ${val}`); },
    toBeGreaterThanOrEqual: (n: number) => { if ((val as number) < n) throw new Error(`Expected >= ${n}, got ${val}`); },
    toBeLessThanOrEqual: (n: number) => { if ((val as number) > n) throw new Error(`Expected <= ${n}, got ${val}`); },
    toContain: (sub: unknown) => {
      if (Array.isArray(val)) {
        if (!val.includes(sub)) throw new Error(`Expected array to contain ${JSON.stringify(sub)}`);
      } else if (typeof val === 'string') {
        if (!val.includes(sub as string)) throw new Error(`Expected "${val}" to contain "${sub}"`);
      } else {
        throw new Error(`toContain: unsupported type ${typeof val}`);
      }
    },
    toStartWith: (prefix: string) => {
      if (typeof val !== 'string' || !val.startsWith(prefix))
        throw new Error(`Expected "${val}" to start with "${prefix}"`);
    },
    toHaveLength: (n: number) => {
      const len = (val as unknown[]).length;
      if (len !== n) throw new Error(`Expected length ${n}, got ${len}`);
    },
  };
}

const onlineNetwork: NetworkReading = {
  status: 'online', quality: 'excellent', bandwidthEstimateKbps: 10000,
  latencyMs: 20, reconnectAttempts: 0, lastSyncAt: null, lastOnlineAt: 1, offlineDurationMs: 0,
};
const offlineNetwork: NetworkReading = {
  status: 'offline', quality: 'none', bandwidthEstimateKbps: 0,
  latencyMs: 0, reconnectAttempts: 3, lastSyncAt: null, lastOnlineAt: 0, offlineDurationMs: 5000,
};
const weakNetwork: NetworkReading = {
  status: 'weak', quality: 'poor', bandwidthEstimateKbps: 100,
  latencyMs: 800, reconnectAttempts: 1, lastSyncAt: null, lastOnlineAt: 1, offlineDurationMs: 1000,
};

function makeHazard(
  type: LocalHazardPattern['hazardType'] = 'obstacle',
  severity: LocalHazardPattern['severity'] = 'high',
  confidence = 0.8,
  tick = 1
): LocalHazardPattern {
  return {
    hazardType: type,
    severity,
    confidence,
    direction: 'ahead',
    detectionCount: 1,
    firstSeenTick: tick,
    lastSeenTick: tick,
    isCriticalBypass: severity === 'critical',
  };
}

// ─── Suite 1: localHazardPatternEngine ────────────────────────────────────────

console.log('\nlocalHazardPatternEngine');

test('HAZARD_PATTERN_LIBRARY has 12 entries', () => {
  expect(HAZARD_PATTERN_LIBRARY).toHaveLength(12);
});

test('library contains obstacle entry', () => {
  const entry = HAZARD_PATTERN_LIBRARY.find(p => p.hazardType === 'obstacle');
  expect(!!entry).toBeTruthy();
});

test('library contains stairs entry', () => {
  const entry = HAZARD_PATTERN_LIBRARY.find(p => p.hazardType === 'stairs');
  expect(!!entry).toBeTruthy();
});

test('library contains vehicle entry', () => {
  const entry = HAZARD_PATTERN_LIBRARY.find(p => p.hazardType === 'vehicle');
  expect(!!entry).toBeTruthy();
});

test('library contains crossing entry with neverSafeToPass = true', () => {
  const entry = HAZARD_PATTERN_LIBRARY.find(p => p.hazardType === 'crossing');
  expect(entry!.neverSafeToPass).toBe(true);
});

test('library contains camera-failure with criticalConfidenceThreshold = 0', () => {
  const entry = HAZARD_PATTERN_LIBRARY.find(p => p.hazardType === 'camera-failure');
  expect(entry!.criticalConfidenceThreshold).toBe(0.0);
});

test('getPatternForHazard returns correct entry for obstacle', () => {
  const p = getPatternForHazard('obstacle');
  expect(p.hazardType).toBe('obstacle');
});

test('getPatternForHazard returns unknown fallback', () => {
  const p = getPatternForHazard('unknown');
  expect(p.hazardType).toBe('unknown');
});

test('matchHazardFromKeywords - car → vehicle', () => {
  expect(matchHazardFromKeywords(['car'])).toBe('vehicle');
});

test('matchHazardFromKeywords - step → stairs', () => {
  expect(matchHazardFromKeywords(['step'])).toBe('stairs');
});

test('matchHazardFromKeywords - bike → bicycle-scooter', () => {
  expect(matchHazardFromKeywords(['bike'])).toBe('bicycle-scooter');
});

test('matchHazardFromKeywords - person → person-approaching', () => {
  expect(matchHazardFromKeywords(['person'])).toBe('person-approaching');
});

test('matchHazardFromKeywords - crossing → crossing', () => {
  expect(matchHazardFromKeywords(['crossing'])).toBe('crossing');
});

test('matchHazardFromKeywords - unrecognised → unknown', () => {
  expect(matchHazardFromKeywords(['xyzunknown'])).toBe('unknown');
});

test('matchHazardFromKeywords - stop → stop', () => {
  expect(matchHazardFromKeywords(['stop'])).toBe('stop');
});

test('getAllCriticalPatterns includes stairs', () => {
  const criticals = getAllCriticalPatterns();
  const types = criticals.map(p => p.hazardType);
  expect(types.includes('stairs')).toBeTruthy();
});

test('getAllCriticalPatterns includes vehicle', () => {
  const criticals = getAllCriticalPatterns();
  const types = criticals.map(p => p.hazardType);
  expect(types.includes('vehicle')).toBeTruthy();
});

test('getAllCriticalPatterns includes camera-failure', () => {
  const criticals = getAllCriticalPatterns();
  const types = criticals.map(p => p.hazardType);
  expect(types.includes('camera-failure')).toBeTruthy();
});

test('estimateHazardSeverity - vehicle at 0.5 confidence = critical', () => {
  expect(estimateHazardSeverity('vehicle', 0.5)).toBe('critical');
});

test('estimateHazardSeverity - stairs at 0.6 confidence = critical', () => {
  expect(estimateHazardSeverity('stairs', 0.6)).toBe('critical');
});

test('estimateHazardSeverity - person at 0.4 confidence = medium', () => {
  expect(estimateHazardSeverity('person-approaching', 0.4)).toBe('medium');
});

test('estimateHazardSeverity - obstacle at 0.9 confidence = critical', () => {
  expect(estimateHazardSeverity('obstacle', 0.9)).toBe('critical');
});

test('estimateHazardSeverity - obstacle at 0.4 confidence = high (default)', () => {
  expect(estimateHazardSeverity('obstacle', 0.4)).toBe('high');
});

test('buildLocalHazardPattern - correct type', () => {
  const p = buildLocalHazardPattern('vehicle', 'ahead', 0.8, 5);
  expect(p.hazardType).toBe('vehicle');
});

test('buildLocalHazardPattern - vehicle critical bypass set', () => {
  const p = buildLocalHazardPattern('vehicle', 'ahead', 0.5, 5);
  expect(p.isCriticalBypass).toBeTruthy();
});

test('buildLocalHazardPattern - confidence clamped to 0-1', () => {
  const p = buildLocalHazardPattern('obstacle', 'ahead', 1.5, 1);
  expect(p.confidence).toBe(1);
});

test('buildLocalHazardPattern - tick stored correctly', () => {
  const p = buildLocalHazardPattern('obstacle', 'left', 0.7, 42);
  expect(p.firstSeenTick).toBe(42);
  expect(p.lastSeenTick).toBe(42);
});

test('updateHazardPattern - detectionCount increments', () => {
  const p = buildLocalHazardPattern('obstacle', 'ahead', 0.6, 1);
  const updated = updateHazardPattern(p, 0.8, 'ahead', 2);
  expect(updated.detectionCount).toBe(2);
});

test('updateHazardPattern - lastSeenTick updates', () => {
  const p = buildLocalHazardPattern('obstacle', 'ahead', 0.6, 1);
  const updated = updateHazardPattern(p, 0.8, 'ahead', 7);
  expect(updated.lastSeenTick).toBe(7);
});

test('getOfflineGuidance - crossing returns CROSSING_SAFETY_MESSAGE', () => {
  const g = getOfflineGuidance('crossing', 'ahead', 0.9);
  expect(g).toBe(CROSSING_SAFETY_MESSAGE);
});

test('getOfflineGuidance - camera-failure returns CAMERA_FAILURE_MESSAGE', () => {
  const g = getOfflineGuidance('camera-failure', 'unknown', 1.0);
  expect(g).toBe(CAMERA_FAILURE_MESSAGE);
});

test('getOfflineGuidance - low confidence returns possible message', () => {
  const g = getOfflineGuidance('obstacle', 'ahead', 0.1);
  expect(g).toContain('Possible obstacle');
});

test('crossing guidance never says "safe"', () => {
  const g = getOfflineGuidance('crossing', 'ahead', 0.9);
  expect(g.toLowerCase().includes('safe to cross')).toBeFalsy();
});

test('buildSpokenMessage - includes prefix', () => {
  const pattern = getPatternForHazard('vehicle');
  const msg = buildSpokenMessage(pattern, 'ahead', 'Vehicle nearby. Please stop.');
  expect(msg).toContain('Warning:');
});

// ─── Suite 2: connectivityFallbackEngine ──────────────────────────────────────

console.log('\nconnectivityFallbackEngine');

test('assessConnectivity - online/excellent → connected', () => {
  expect(assessConnectivity(onlineNetwork)).toBe('connected');
});

test('assessConnectivity - offline → disconnected', () => {
  expect(assessConnectivity(offlineNetwork)).toBe('disconnected');
});

test('assessConnectivity - weak → weak', () => {
  expect(assessConnectivity(weakNetwork)).toBe('weak');
});

test('assessConnectivity - reconnecting → checking', () => {
  const r: NetworkReading = { ...onlineNetwork, status: 'reconnecting', quality: 'none' };
  expect(assessConnectivity(r)).toBe('checking');
});

test('assessConnectivity - sync-pending → connected', () => {
  const r: NetworkReading = { ...onlineNetwork, status: 'sync-pending' };
  expect(assessConnectivity(r)).toBe('connected');
});

test('assessConnectivity - online/none quality → disconnected', () => {
  const r: NetworkReading = { ...onlineNetwork, quality: 'none' };
  expect(assessConnectivity(r)).toBe('disconnected');
});

test('isCloudAvailable - connected → true', () => {
  expect(isCloudAvailable('connected')).toBeTruthy();
});

test('isCloudAvailable - disconnected → false', () => {
  expect(isCloudAvailable('disconnected')).toBeFalsy();
});

test('isCloudAvailable - weak → false', () => {
  expect(isCloudAvailable('weak')).toBeFalsy();
});

test('shouldActivateFallback - disconnected → true', () => {
  const cfg = { ...buildInitialFallbackConfig(), connectivityState: 'disconnected' as const };
  expect(shouldActivateFallback(cfg)).toBeTruthy();
});

test('shouldActivateFallback - weak → true', () => {
  const cfg = { ...buildInitialFallbackConfig(), connectivityState: 'weak' as const };
  expect(shouldActivateFallback(cfg)).toBeTruthy();
});

test('shouldActivateFallback - connected → false', () => {
  const cfg = buildInitialFallbackConfig();
  expect(shouldActivateFallback(cfg)).toBeFalsy();
});

test('determineSafetyMode - connected → online', () => {
  expect(determineSafetyMode('connected')).toBe('online');
});

test('determineSafetyMode - disconnected → offline', () => {
  expect(determineSafetyMode('disconnected')).toBe('offline');
});

test('determineSafetyMode - weak → degraded', () => {
  expect(determineSafetyMode('weak')).toBe('degraded');
});

test('determineSafetyMode - checking → degraded', () => {
  expect(determineSafetyMode('checking')).toBe('degraded');
});

test('buildInitialFallbackConfig - mode online', () => {
  const cfg = buildInitialFallbackConfig();
  expect(cfg.mode).toBe('online');
});

test('buildInitialFallbackConfig - fallbackActive false', () => {
  const cfg = buildInitialFallbackConfig();
  expect(cfg.fallbackActive).toBeFalsy();
});

test('buildInitialFallbackConfig - cloudEnhancementAvailable true', () => {
  const cfg = buildInitialFallbackConfig();
  expect(cfg.cloudEnhancementAvailable).toBeTruthy();
});

test('updateFallbackConfig - online → mode online', () => {
  const cfg = buildInitialFallbackConfig();
  const updated = updateFallbackConfig(cfg, onlineNetwork, 10);
  expect(updated.mode).toBe('online');
});

test('updateFallbackConfig - offline → mode offline', () => {
  const cfg = buildInitialFallbackConfig();
  const updated = updateFallbackConfig(cfg, offlineNetwork, 10);
  expect(updated.mode).toBe('offline');
});

test('updateFallbackConfig - online→offline sets offlineSince', () => {
  const cfg = buildInitialFallbackConfig();
  const updated = updateFallbackConfig(cfg, offlineNetwork, 15);
  expect(updated.offlineSince).toBe(15);
});

test('updateFallbackConfig - offline→online clears offlineSince', () => {
  const cfg = { ...buildInitialFallbackConfig(), connectivityState: 'disconnected' as const, offlineSince: 5, mode: 'offline' as const };
  const updated = updateFallbackConfig(cfg, onlineNetwork, 20);
  expect(updated.offlineSince).toBeNull();
});

test('updateFallbackConfig - online→offline sets announcementPending', () => {
  const cfg = buildInitialFallbackConfig();
  const updated = updateFallbackConfig(cfg, offlineNetwork, 10);
  expect(updated.announcementPending).toBe(OFFLINE_MODE_ANNOUNCEMENT);
});

test('updateFallbackConfig - same state no announcement', () => {
  const cfg = buildInitialFallbackConfig();
  const updated = updateFallbackConfig(cfg, onlineNetwork, 10);
  expect(updated.announcementPending).toBeNull();
});

test('calculateOfflineDurationSeconds - null offlineSince → 0', () => {
  const cfg = buildInitialFallbackConfig();
  expect(calculateOfflineDurationSeconds(cfg, 10)).toBe(0);
});

test('calculateOfflineDurationSeconds - calculates duration', () => {
  const cfg = { ...buildInitialFallbackConfig(), offlineSince: 5 };
  expect(calculateOfflineDurationSeconds(cfg, 15)).toBe(10);
});

test('consumeAnnouncement - clears pending announcement', () => {
  const cfg = { ...buildInitialFallbackConfig(), announcementPending: OFFLINE_MODE_ANNOUNCEMENT };
  const { announcement, config } = consumeAnnouncement(cfg);
  expect(announcement).toBe(OFFLINE_MODE_ANNOUNCEMENT);
  expect(config.announcementPending).toBeNull();
});

test('consumeAnnouncement - null when no announcement', () => {
  const cfg = buildInitialFallbackConfig();
  const { announcement } = consumeAnnouncement(cfg);
  expect(announcement).toBeNull();
});

test('buildConnectivityTransition - to disconnected → offline message', () => {
  const t = buildConnectivityTransition('connected', 'disconnected', 5);
  expect(t.spokenAnnouncement).toBe(OFFLINE_MODE_ANNOUNCEMENT);
});

test('buildConnectivityTransition - to connected → online message', () => {
  const t = buildConnectivityTransition('disconnected', 'connected', 10);
  expect(t.spokenAnnouncement).toBe(ONLINE_RESTORED_ANNOUNCEMENT);
});

test('buildConnectivityTransition - to disconnected → modeChange offline', () => {
  const t = buildConnectivityTransition('connected', 'disconnected', 5);
  expect(t.modeChange).toBe('offline');
});

test('buildConnectivityTransition - timestamp stored', () => {
  const t = buildConnectivityTransition('connected', 'disconnected', 99);
  expect(t.timestamp).toBe(99);
});

test('getFallbackGuidanceSource - cloudEnhancementAvailable → cloud-enhanced', () => {
  const cfg = buildInitialFallbackConfig();
  expect(getFallbackGuidanceSource(cfg)).toBe('cloud-enhanced');
});

test('getFallbackGuidanceSource - not available → glasses-edge', () => {
  const cfg = { ...buildInitialFallbackConfig(), cloudEnhancementAvailable: false };
  expect(getFallbackGuidanceSource(cfg)).toBe('glasses-edge');
});

test('getOfflineModeAnnouncement returns correct string', () => {
  expect(getOfflineModeAnnouncement()).toBe(OFFLINE_MODE_ANNOUNCEMENT);
});

test('getOnlineRestoredAnnouncement returns correct string', () => {
  expect(getOnlineRestoredAnnouncement()).toBe(ONLINE_RESTORED_ANNOUNCEMENT);
});

// ─── Suite 3: offlineStreetGuardianEngine ─────────────────────────────────────

console.log('\nofflineStreetGuardianEngine');

test('isInCooldown - no recent alerts → false', () => {
  const hazard = makeHazard('obstacle', 'high', 0.8, 1);
  expect(isInCooldown(hazard, [], 5)).toBeFalsy();
});

test('isInCooldown - critical within 2 ticks → true', () => {
  const hazard = makeHazard('vehicle', 'critical', 0.8, 1);
  const alert: HazardAlert = { id: 'x', hazardType: 'vehicle', severity: 'critical', direction: 'ahead', guidance: '', spokenMessage: '', confidence: 0.8, isOffline: true, tick: 4 };
  expect(isInCooldown(hazard, [alert], 5)).toBeTruthy();
});

test('isInCooldown - critical after 2+ ticks → false', () => {
  const hazard = makeHazard('vehicle', 'critical', 0.8, 1);
  const alert: HazardAlert = { id: 'x', hazardType: 'vehicle', severity: 'critical', direction: 'ahead', guidance: '', spokenMessage: '', confidence: 0.8, isOffline: true, tick: 1 };
  expect(isInCooldown(hazard, [alert], 10)).toBeFalsy();
});

test('isInCooldown - high within 5 ticks → true', () => {
  const hazard = makeHazard('obstacle', 'high', 0.8, 1);
  const alert: HazardAlert = { id: 'x', hazardType: 'obstacle', severity: 'high', direction: 'ahead', guidance: '', spokenMessage: '', confidence: 0.8, isOffline: true, tick: 3 };
  expect(isInCooldown(hazard, [alert], 7)).toBeTruthy();
});

test('isInCooldown - different hazard type → false', () => {
  const hazard = makeHazard('stairs', 'critical', 0.8, 1);
  const alert: HazardAlert = { id: 'x', hazardType: 'vehicle', severity: 'critical', direction: 'ahead', guidance: '', spokenMessage: '', confidence: 0.8, isOffline: true, tick: 4 };
  expect(isInCooldown(hazard, [alert], 5)).toBeFalsy();
});

test('selectGuidanceForHazard - crossing returns CROSSING_SAFETY_MESSAGE', () => {
  const g = selectGuidanceForHazard('crossing', 'ahead', 0.9);
  expect(g).toBe(CROSSING_SAFETY_MESSAGE);
});

test('selectGuidanceForHazard - camera-failure returns CAMERA_FAILURE_MESSAGE', () => {
  const g = selectGuidanceForHazard('camera-failure', 'unknown', 1.0);
  expect(g).toBe(CAMERA_FAILURE_MESSAGE);
});

test('selectGuidanceForHazard - vehicle returns guidance text', () => {
  const g = selectGuidanceForHazard('vehicle', 'ahead', 0.8);
  expect(typeof g).toBe('string');
  expect(g.length).toBeGreaterThan(0);
});

test('crossing guidance never says "safe to cross"', () => {
  const g = selectGuidanceForHazard('crossing', 'ahead', 0.9);
  expect(g.toLowerCase().includes('safe to cross')).toBeFalsy();
});

test('buildOfflineAlert - isOffline true', () => {
  const hazard = makeHazard('obstacle', 'high', 0.8, 1);
  const alert = buildOfflineAlert(hazard, 1);
  expect(alert.isOffline).toBeTruthy();
});

test('buildOfflineAlert - id contains type and tick', () => {
  const hazard = makeHazard('obstacle', 'high', 0.8, 5);
  const alert = buildOfflineAlert(hazard, 5);
  expect(alert.id).toContain('obstacle');
  expect(alert.id).toContain('5');
});

test('buildOfflineAlert - spokenMessage not empty', () => {
  const hazard = makeHazard('vehicle', 'critical', 0.8, 1);
  const alert = buildOfflineAlert(hazard, 1);
  expect(alert.spokenMessage.length).toBeGreaterThan(0);
});

test('buildOfflineAlert - crossing guidance is CROSSING_SAFETY_MESSAGE', () => {
  const hazard = makeHazard('crossing', 'high', 0.8, 1);
  const alert = buildOfflineAlert(hazard, 1);
  expect(alert.guidance).toBe(CROSSING_SAFETY_MESSAGE);
});

test('isCriticalBypass - vehicle → true', () => {
  expect(isCriticalBypass(makeHazard('vehicle', 'critical'))).toBeTruthy();
});

test('isCriticalBypass - stairs → true', () => {
  expect(isCriticalBypass(makeHazard('stairs', 'critical'))).toBeTruthy();
});

test('isCriticalBypass - stop → true', () => {
  expect(isCriticalBypass(makeHazard('stop', 'critical'))).toBeTruthy();
});

test('isCriticalBypass - camera-failure → true', () => {
  expect(isCriticalBypass(makeHazard('camera-failure', 'critical'))).toBeTruthy();
});

test('isCriticalBypass - obstacle medium → false', () => {
  expect(isCriticalBypass(makeHazard('obstacle', 'medium'))).toBeFalsy();
});

test('isCriticalBypass - person medium → false', () => {
  expect(isCriticalBypass(makeHazard('person-approaching', 'medium'))).toBeFalsy();
});

test('buildCriticalBypassAlert - id starts with "critical-"', () => {
  const hazard = makeHazard('vehicle', 'critical', 0.9, 10);
  const alert = buildCriticalBypassAlert(hazard, 10);
  expect(alert.id).toStartWith('critical-');
});

test('prioritizeHazards - critical before high', () => {
  const high = makeHazard('obstacle', 'high', 0.8, 1);
  const critical = makeHazard('vehicle', 'critical', 0.7, 1);
  const sorted = prioritizeHazards([high, critical]);
  expect(sorted[0].hazardType).toBe('vehicle');
});

test('prioritizeHazards - same severity: higher confidence first', () => {
  const low = makeHazard('obstacle', 'high', 0.5, 1);
  const high = makeHazard('stairs', 'high', 0.9, 1);
  const sorted = prioritizeHazards([low, high]);
  expect(sorted[0].confidence).toBe(0.9);
});

test('prioritizeHazards - does not mutate input', () => {
  const hazards = [makeHazard('obstacle', 'high', 0.8, 1), makeHazard('vehicle', 'critical', 0.7, 1)];
  const original = hazards[0].hazardType;
  prioritizeHazards(hazards);
  expect(hazards[0].hazardType).toBe(original);
});

test('evaluateHazardForSpeech - critical bypass → speak + bypassedThrottle', () => {
  const hazard = makeHazard('vehicle', 'critical', 0.8, 1);
  const result = evaluateHazardForSpeech(hazard, [], 5);
  expect(result.decision).toBe('speak');
  expect(result.bypassedThrottle).toBeTruthy();
});

test('evaluateHazardForSpeech - low confidence → silent', () => {
  const hazard = makeHazard('obstacle', 'high', 0.1, 1);
  const result = evaluateHazardForSpeech(hazard, [], 5);
  expect(result.decision).toBe('silent');
});

test('evaluateHazardForSpeech - in cooldown → silent', () => {
  const hazard = makeHazard('obstacle', 'high', 0.8, 1);
  const alert: HazardAlert = { id: 'x', hazardType: 'obstacle', severity: 'high', direction: 'ahead', guidance: '', spokenMessage: '', confidence: 0.8, isOffline: true, tick: 4 };
  const result = evaluateHazardForSpeech(hazard, [alert], 5);
  expect(result.decision).toBe('silent');
});

test('evaluateHazardForSpeech - not in cooldown → speak', () => {
  const hazard = makeHazard('obstacle', 'high', 0.8, 1);
  const result = evaluateHazardForSpeech(hazard, [], 5);
  expect(result.decision).toBe('speak');
  expect(result.alert).toBeTruthy();
});

test('evaluateHazardForSpeech - critical bypasses cooldown', () => {
  const hazard = makeHazard('vehicle', 'critical', 0.8, 1);
  const alert: HazardAlert = { id: 'x', hazardType: 'vehicle', severity: 'critical', direction: 'ahead', guidance: '', spokenMessage: '', confidence: 0.8, isOffline: true, tick: 4 };
  const result = evaluateHazardForSpeech(hazard, [alert], 5);
  expect(result.decision).toBe('speak');
  expect(result.bypassedThrottle).toBeTruthy();
});

test('evaluateAllHazards - returns decision for each hazard', () => {
  const hazards = [makeHazard('obstacle', 'high', 0.8, 1), makeHazard('person-approaching', 'medium', 0.6, 1)];
  const results = evaluateAllHazards(hazards, [], 5);
  expect(results.length).toBeGreaterThanOrEqual(2);
});

test('evaluateAllHazards - deduplicates same type non-critical', () => {
  const hazards = [
    makeHazard('obstacle', 'high', 0.8, 1),
    makeHazard('obstacle', 'high', 0.7, 1),
  ];
  const results = evaluateAllHazards(hazards, [], 5);
  const spoken = results.filter(r => r.decision === 'speak' && r.hazard.hazardType === 'obstacle');
  expect(spoken.length).toBeLessThanOrEqual(1);
});

test('evaluateAllHazards - critical hazards always included', () => {
  const hazards = [makeHazard('vehicle', 'critical', 0.9, 1), makeHazard('stairs', 'critical', 0.8, 1)];
  const results = evaluateAllHazards(hazards, [], 5);
  const spoken = results.filter(r => r.decision === 'speak');
  expect(spoken.length).toBeGreaterThanOrEqual(1);
});

test('buildCameraFailureAlert - correct fields', () => {
  const alert = buildCameraFailureAlert(10);
  expect(alert.hazardType).toBe('camera-failure');
  expect(alert.severity).toBe('critical');
  expect(alert.confidence).toBe(1.0);
  expect(alert.isOffline).toBeTruthy();
  expect(alert.guidance).toBe(CAMERA_FAILURE_MESSAGE);
});

test('buildCameraFailureAlert - id contains tick', () => {
  const alert = buildCameraFailureAlert(42);
  expect(alert.id).toContain('42');
});

// ─── Suite 4: streetSafetyEngine ─────────────────────────────────────────────

console.log('\nstreetSafetyEngine');

test('createStreetSafetyState - mode online', () => {
  const s = createStreetSafetyState();
  expect(s.mode).toBe('online');
});

test('createStreetSafetyState - guardianActive true', () => {
  const s = createStreetSafetyState();
  expect(s.guardianActive).toBeTruthy();
});

test('createStreetSafetyState - cameraHealthy true', () => {
  const s = createStreetSafetyState();
  expect(s.cameraHealthy).toBeTruthy();
});

test('createStreetSafetyState - sessionTick 0', () => {
  const s = createStreetSafetyState();
  expect(s.sessionTick).toBe(0);
});

test('createStreetSafetyState - no active hazards', () => {
  const s = createStreetSafetyState();
  expect(s.activeHazards).toHaveLength(0);
});

test('upsertHazard - adds new hazard', () => {
  const hazards = upsertHazard([], 'obstacle', 'ahead', 0.8, 1);
  expect(hazards).toHaveLength(1);
  expect(hazards[0].hazardType).toBe('obstacle');
});

test('upsertHazard - updates existing hazard', () => {
  const first = upsertHazard([], 'obstacle', 'ahead', 0.6, 1);
  const updated = upsertHazard(first, 'obstacle', 'left', 0.8, 2);
  expect(updated).toHaveLength(1);
  expect(updated[0].detectionCount).toBe(2);
});

test('upsertHazard - multiple types stored separately', () => {
  let h = upsertHazard([], 'obstacle', 'ahead', 0.7, 1);
  h = upsertHazard(h, 'vehicle', 'left', 0.9, 1);
  expect(h).toHaveLength(2);
});

test('clearStaleHazards - removes hazard not seen in 10+ ticks', () => {
  const p = buildLocalHazardPattern('obstacle', 'ahead', 0.8, 1);
  const result = clearStaleHazards([p], 12);
  expect(result).toHaveLength(0);
});

test('clearStaleHazards - keeps recent hazard', () => {
  const p = buildLocalHazardPattern('obstacle', 'ahead', 0.8, 5);
  const result = clearStaleHazards([p], 10);
  expect(result).toHaveLength(1);
});

test('addAlerts - appends new alerts', () => {
  const alert: HazardAlert = { id: 'a', hazardType: 'obstacle', severity: 'high', direction: 'ahead', guidance: '', spokenMessage: '', confidence: 0.8, isOffline: true, tick: 1 };
  const result = addAlerts([], [alert]);
  expect(result).toHaveLength(1);
});

test('addAlerts - trims to max 20', () => {
  const existing: HazardAlert[] = Array.from({ length: 20 }, (_, i) => ({
    id: `old-${i}`, hazardType: 'obstacle' as const, severity: 'high' as const,
    direction: 'ahead' as const, guidance: '', spokenMessage: '',
    confidence: 0.8, isOffline: true, tick: i,
  }));
  const newAlert: HazardAlert = { id: 'new', hazardType: 'vehicle', severity: 'critical', direction: 'ahead', guidance: '', spokenMessage: '', confidence: 0.9, isOffline: true, tick: 100 };
  const result = addAlerts(existing, [newAlert]);
  expect(result.length).toBeLessThanOrEqual(20);
});

test('processStreetSafetyTick - increments sessionTick', () => {
  const s = createStreetSafetyState();
  const { state } = processStreetSafetyTick(s, { network: onlineNetwork, detectedHazardTypes: [], isCameraHealthy: true });
  expect(state.sessionTick).toBe(1);
});

test('processStreetSafetyTick - online network keeps mode online', () => {
  const s = createStreetSafetyState();
  const { state } = processStreetSafetyTick(s, { network: onlineNetwork, detectedHazardTypes: [], isCameraHealthy: true });
  expect(state.mode).toBe('online');
});

test('processStreetSafetyTick - offline network switches mode to offline', () => {
  const s = createStreetSafetyState();
  const { state } = processStreetSafetyTick(s, { network: offlineNetwork, detectedHazardTypes: [], isCameraHealthy: true });
  expect(state.mode).toBe('offline');
});

test('processStreetSafetyTick - offline transition produces announcement', () => {
  const s = createStreetSafetyState();
  const { announcements } = processStreetSafetyTick(s, { network: offlineNetwork, detectedHazardTypes: [], isCameraHealthy: true });
  expect(announcements).toContain(OFFLINE_MODE_ANNOUNCEMENT);
});

test('processStreetSafetyTick - camera failure produces alert', () => {
  const s = { ...createStreetSafetyState(), cameraHealthy: true };
  const { alertsSpoken } = processStreetSafetyTick(s, { network: onlineNetwork, detectedHazardTypes: [], isCameraHealthy: false });
  const cameraAlert = alertsSpoken.find(a => a.hazardType === 'camera-failure');
  expect(!!cameraAlert).toBeTruthy();
});

test('processStreetSafetyTick - vehicle hazard produces critical alert', () => {
  const s = createStreetSafetyState();
  const { alertsSpoken } = processStreetSafetyTick(s, { network: onlineNetwork, detectedHazardTypes: [{ type: 'vehicle', direction: 'ahead', confidence: 0.9 }], isCameraHealthy: true });
  const vehicleAlert = alertsSpoken.find(a => a.hazardType === 'vehicle');
  expect(!!vehicleAlert).toBeTruthy();
});

test('processStreetSafetyTick - weak network → degraded mode', () => {
  const s = createStreetSafetyState();
  const { state } = processStreetSafetyTick(s, { network: weakNetwork, detectedHazardTypes: [], isCameraHealthy: true });
  expect(state.mode).toBe('degraded');
});

test('processStreetSafetyTick - stale hazards removed', () => {
  let s = createStreetSafetyState();
  ({ state: s } = processStreetSafetyTick(s, { network: onlineNetwork, detectedHazardTypes: [{ type: 'obstacle', direction: 'ahead', confidence: 0.7 }], isCameraHealthy: true }));
  for (let i = 0; i < 12; i++) {
    ({ state: s } = processStreetSafetyTick(s, { network: onlineNetwork, detectedHazardTypes: [], isCameraHealthy: true }));
  }
  expect(s.activeHazards.filter(h => h.hazardType === 'obstacle')).toHaveLength(0);
});

test('buildStreetSafetySummary - isOffline true when offline', () => {
  const s = { ...createStreetSafetyState(), mode: 'offline' as const };
  const summary = buildStreetSafetySummary(s);
  expect(summary.isOffline).toBeTruthy();
});

test('buildStreetSafetySummary - isOffline false when online', () => {
  const s = createStreetSafetyState();
  const summary = buildStreetSafetySummary(s);
  expect(summary.isOffline).toBeFalsy();
});

test('buildStreetSafetySummary - criticalHazardCount correct', () => {
  const s = { ...createStreetSafetyState(), activeHazards: [makeHazard('vehicle', 'critical'), makeHazard('obstacle', 'high')] };
  const summary = buildStreetSafetySummary(s);
  expect(summary.criticalHazardCount).toBe(1);
});

test('buildStreetSafetySummary - topHazard is critical when present', () => {
  const s = { ...createStreetSafetyState(), activeHazards: [makeHazard('obstacle', 'high', 0.9), makeHazard('vehicle', 'critical', 0.7)] };
  const summary = buildStreetSafetySummary(s);
  expect(summary.topHazard?.severity).toBe('critical');
});

test('buildStreetSafetySummary - topHazard null when no hazards', () => {
  const s = createStreetSafetyState();
  const summary = buildStreetSafetySummary(s);
  expect(summary.topHazard).toBeNull();
});

test('getStreetSafetModeLabel - online mode label', () => {
  const s = createStreetSafetyState();
  const label = getStreetSafetModeLabel(s);
  expect(label).toContain('Online');
});

test('getStreetSafetModeLabel - offline mode label contains "Glasses Edge AI"', () => {
  const s = { ...createStreetSafetyState(), mode: 'offline' as const };
  const label = getStreetSafetModeLabel(s);
  expect(label).toContain('Glasses Edge AI');
});

test('getStreetSafetyModeColor - online → green', () => {
  const s = createStreetSafetyState();
  expect(getStreetSafetyModeColor(s)).toBe('green');
});

test('getStreetSafetyModeColor - offline → red', () => {
  const s = { ...createStreetSafetyState(), mode: 'offline' as const };
  expect(getStreetSafetyModeColor(s)).toBe('red');
});

test('getStreetSafetyModeColor - degraded → yellow', () => {
  const s = { ...createStreetSafetyState(), mode: 'degraded' as const };
  expect(getStreetSafetyModeColor(s)).toBe('yellow');
});

test('getGlassesPrimaryNote returns GLASSES_PRIMARY_NOTE', () => {
  expect(getGlassesPrimaryNote()).toBe(GLASSES_PRIMARY_NOTE);
});

// ─── Suite 5: Safety Rule Verification ───────────────────────────────────────

console.log('\nSafety Rules');

test('CROSSING_SAFETY_MESSAGE does not say "safe to cross"', () => {
  expect(CROSSING_SAFETY_MESSAGE.toLowerCase().includes('safe to cross')).toBeFalsy();
});

test('CROSSING_SAFETY_MESSAGE says "check carefully"', () => {
  expect(CROSSING_SAFETY_MESSAGE).toContain('check carefully');
});

test('OFFLINE_MODE_ANNOUNCEMENT matches required text', () => {
  expect(OFFLINE_MODE_ANNOUNCEMENT).toBe(
    'Internet is unavailable. Offline street safety mode is active.'
  );
});

test('ONLINE_RESTORED_ANNOUNCEMENT says "Safety mode remains active"', () => {
  expect(ONLINE_RESTORED_ANNOUNCEMENT).toContain('Safety mode remains active');
});

test('CAMERA_FAILURE_MESSAGE says "stop"', () => {
  expect(CAMERA_FAILURE_MESSAGE.toLowerCase()).toContain('stop');
});

test('GLASSES_PRIMARY_NOTE mentions compute module', () => {
  expect(GLASSES_PRIMARY_NOTE).toContain('glasses compute module');
});

test('vehicle alert spoken message never says "safe"', () => {
  const hazard = makeHazard('vehicle', 'critical', 0.9, 1);
  const alert = buildOfflineAlert(hazard, 1);
  expect(alert.spokenMessage.toLowerCase().includes('safe to cross')).toBeFalsy();
});

test('stairs alert spoken message warns to stop', () => {
  const hazard = makeHazard('stairs', 'critical', 0.8, 1);
  const alert = buildOfflineAlert(hazard, 1);
  expect(alert.spokenMessage.length).toBeGreaterThan(0);
});

// ─── Result ───────────────────────────────────────────────────────────────────

console.log(`\nStreet Safety Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

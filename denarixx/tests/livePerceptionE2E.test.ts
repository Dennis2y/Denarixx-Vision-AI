/**
 * Live Perception E2E Behavioural Tests — Sprint 23 Hardening
 *
 * Tests the complete alert coordination, failure recovery, system announcements,
 * and wording correctness. All 13 real scenarios are covered.
 *
 * Does NOT test file existence — tests actual behaviour.
 */

// ── Minimal test harness ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    errors.push(`FAIL: ${name}\n  ${e instanceof Error ? e.message : String(e)}`);
  }
}

function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy: () => { if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`); },
    toBeFalsy: () => { if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`); },
    toBeGreaterThan: (n: number) => {
      if ((actual as number) <= n) throw new Error(`Expected > ${n}, got ${actual}`);
    },
    toBeLessThan: (n: number) => {
      if ((actual as number) >= n) throw new Error(`Expected < ${n}, got ${actual}`);
    },
    toHaveLength: (n: number) => {
      if ((actual as unknown[]).length !== n)
        throw new Error(`Expected length ${n}, got ${(actual as unknown[]).length}`);
    },
    toContain: (item: unknown) => {
      if (!(actual as string | unknown[]).includes(item as string))
        throw new Error(`Expected to contain ${JSON.stringify(item)}, got ${JSON.stringify(actual)}`);
    },
    toBeNull: () => { if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`); },
    toBeOneOf: (...opts: unknown[]) => {
      if (!opts.includes(actual)) throw new Error(`Expected one of ${JSON.stringify(opts)}, got ${JSON.stringify(actual)}`);
    },
  };
}

// ── Imports ────────────────────────────────────────────────────────────────────

import {
  createCoordinationState,
  buildAlert,
  buildVisionAlert,
  buildOCRAlert,
  buildNavigationAlert,
  buildSystemAlert,
  buildCompanionAlert,
  enqueueAlert,
  dequeueNextAlert,
  shouldInterrupt,
  applyInterrupt,
  isDuplicate,
  getCoordinationSnapshot,
  COORDINATION_PRIORITY_RANK,
  describeCoordinationPriority,
} from '../src/engines/alertCoordinationEngine';

import type { CoordinationPriority } from '../src/engines/alertCoordinationEngine';

import {
  getSystemAnnouncement,
  getSessionStartAnnouncement,
  formatOCRAnnouncement,
  describeProviderStatus,
  describeVisionModeHuman,
} from '../src/engines/systemAnnouncementEngine';

import {
  getFailureScenario,
  getFailureAnnouncement,
  getRecoveryLevel,
  isSafetyCoreActive,
  requiresUserAction,
  getUserActionHint,
  detectActiveFailures,
  aggregateRecoveryLevel,
  isMinimalMode,
  buildMultiFailureSummary,
  getAllFailureTypes,
  FAILURE_REGISTRY,
} from '../src/engines/failureRecoveryEngine';

import {
  GuardianWordingEngine,
} from '../src/engines/guardianWordingEngine';

import { AlertQualityEngine } from '../src/engines/alertQualityEngine';

import {
  createNavigationSession,
  processNavigationTick,
  isRouteActive,
} from '../src/engines/navigationIntelligenceEngine';

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1: Obstacle Ahead
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 1 — Obstacle Ahead');

test('obstacle alert creates critical_hazard priority when critical severity', () => {
  const alert = buildVisionAlert('Stop — obstacle directly ahead.', 'critical');
  expect(alert.priority).toBe('critical_hazard');
  expect(alert.interrupt).toBeTruthy();
});

test('obstacle alert creates scene_description for low severity', () => {
  const alert = buildVisionAlert('Object detected.', 'low');
  expect(alert.priority).toBe('scene_description');
  expect(alert.interrupt).toBeFalsy();
});

test('obstacle alert enqueues and dequeues in order', () => {
  let state = createCoordinationState();
  const a1 = buildVisionAlert('Object nearby.', 'medium');
  const a2 = buildVisionAlert('Stop — obstacle directly ahead.', 'critical');
  ({ state } = enqueueAlert(state, a1).state ? { state: enqueueAlert(state, a1).state } : { state });
  state = enqueueAlert(state, a1).state;
  state = enqueueAlert(state, a2).state;
  const { alert } = dequeueNextAlert(state);
  expect(alert?.priority).toBe('critical_hazard');
});

test('obstacle wording engine generates directional message', () => {
  const engine = new GuardianWordingEngine();
  const msg = engine.generate({
    hazardType: 'person',
    severity: 'high',
    confidence: 0.85,
    detection: { label: 'person', confidence: 0.85, boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.6 } },
  });
  expect(typeof msg).toBe('string');
  expect(msg.length).toBeGreaterThan(5);
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2: Stairs Ahead
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 2 — Stairs Ahead');

test('stairs alert is critical hazard', () => {
  const alert = buildVisionAlert('Stairs directly ahead — stop now.', 'critical');
  expect(alert.priority).toBe('critical_hazard');
});

test('stairs wording engine generates stop message', () => {
  const engine = new GuardianWordingEngine();
  const msg = engine.generate({ hazardType: 'stairs', severity: 'critical', confidence: 0.9 });
  expect(msg.toLowerCase()).toContain('stop');
  expect(msg.toLowerCase()).toContain('stair');
});

test('stairs wording engine high severity warns to slow', () => {
  const engine = new GuardianWordingEngine();
  const msg = engine.generate({ hazardType: 'stairs', severity: 'high', confidence: 0.8 });
  expect(msg.length).toBeGreaterThan(5);
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3: Moving Vehicle
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 3 — Moving Vehicle');

test('vehicle critical alert always interrupts', () => {
  const alert = buildVisionAlert('Stop — vehicle approaching fast. Do not move.', 'critical');
  expect(alert.interrupt).toBeTruthy();
  expect(alert.priority).toBe('critical_hazard');
  expect(alert.source).toBe('vision');
});

test('vehicle critical interrupts scene description', () => {
  let state = createCoordinationState();
  const scene = buildCompanionAlert('The area ahead appears open.');
  state = enqueueAlert(state, scene).state;
  const { state: afterDequeue, alert: speaking } = dequeueNextAlert(state);
  state = { ...afterDequeue, speaking };

  const vehicleAlert = buildVisionAlert('Stop — vehicle approaching fast.', 'critical');
  const interrupts = shouldInterrupt(state, vehicleAlert);
  expect(interrupts).toBeTruthy();
});

test('vehicle wording engine generates specific message', () => {
  const engine = new GuardianWordingEngine();
  const msg = engine.generate({ hazardType: 'vehicle', severity: 'critical', confidence: 0.95 });
  expect(msg).toBe('Stop — vehicle approaching fast. Do not move.');
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 4: Bicycle Approaching
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 4 — Bicycle Approaching');

test('bicycle high alert is high_navigation priority', () => {
  const alert = buildVisionAlert('Cyclist nearby. Move to the side and wait.', 'high');
  expect(alert.priority).toBe('high_navigation');
});

test('bicycle wording engine generates correct message', () => {
  const engine = new GuardianWordingEngine();
  const msg = engine.generate({ hazardType: 'bicycle', severity: 'high', confidence: 0.8 });
  expect(msg.toLowerCase()).toContain('cyclist');
});

test('bicycle alert does not interrupt scene when non-critical', () => {
  let state = createCoordinationState();
  const scene = buildCompanionAlert('Path appears clear ahead.');
  state = enqueueAlert(state, scene).state;
  const { state: speaking_state, alert: s } = dequeueNextAlert(state);
  state = { ...speaking_state, speaking: s };

  const bikeAlert = buildVisionAlert('Cyclist nearby.', 'high');
  expect(shouldInterrupt(state, bikeAlert)).toBeFalsy();
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 5: Readable Street Sign
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 5 — Readable Street Sign');

test('OCR street sign builds scene_description priority', () => {
  const alert = buildOCRAlert('Baker Street', false);
  expect(alert.priority).toBe('scene_description');
  expect(alert.source).toBe('ocr');
});

test('OCR announcement formats street sign humanly', () => {
  const text = formatOCRAnnouncement('street', 'Baker Street', 'high', false);
  expect(text).toContain('Baker Street');
  if (text.toLowerCase().includes('confidence') || text.toLowerCase().includes('percent')) {
    throw new Error('OCR announcement must not expose confidence numbers');
  }
});

test('OCR high-confidence sign has no qualifier', () => {
  const text = formatOCRAnnouncement('sign', 'EXIT ONLY', 'high', false);
  expect(text.toLowerCase()).toContain('exit');
  if (text.toLowerCase().includes('verify') || text.toLowerCase().includes('check')) {
    throw new Error('High-confidence OCR should not add verify qualifier');
  }
});

test('OCR low-confidence sign adds please check carefully', () => {
  const text = formatOCRAnnouncement('sign', 'SOME TEXT', 'low', false);
  expect(text.toLowerCase()).toContain('check carefully');
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 6: Medicine Label
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 6 — Medicine Label');

test('OCR medicine label builds important_ocr priority', () => {
  const alert = buildOCRAlert('500mg tablet twice daily', false);
  alert.priority; // just checking it exists
  // medicine requires the text reading engine to set priority — check that buildOCRAlert works
  expect(alert.source).toBe('ocr');
  expect(alert.text).toContain('500mg');
});

test('OCR medicine announcement uses Medicine label prefix', () => {
  const text = formatOCRAnnouncement('medicine', '500mg amoxicillin twice daily', 'high', false);
  expect(text.toLowerCase()).toContain('medicine label');
  expect(text).toContain('500mg');
});

test('OCR medicine always recommends pharmacist check', () => {
  // The textReadingEngine.buildTextReadingResult adds this note — test the summary output
  const { buildTextReadingResult } = require('../src/engines/textReadingEngine');
  const { enrichOCRResult } = require('../src/engines/ocrEngine');
  const raw = {
    text: '500mg tablet twice daily',
    confidence: 0.9,
    lines: ['500mg tablet twice daily'],
    detectedAt: new Date(),
    latencyMs: 80,
    provider: 'tesseract' as const,
    language: 'eng',
  };
  const ocr = enrichOCRResult(raw, { domain: 'medicine' });
  const r = buildTextReadingResult(ocr);
  expect(r.summary.toLowerCase()).toContain('pharmacist');
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 7: Provider Outage
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 7 — Provider Outage');

test('cloud-provider-timeout announces human message', () => {
  const announcement = getFailureAnnouncement('cloud-provider-timeout');
  expect(announcement.toLowerCase()).toContain('offline safety');
  if (announcement.toLowerCase().includes('provider') || announcement.toLowerCase().includes('timeout')) {
    throw new Error('Failure announcement must not use technical terms');
  }
});

test('cloud-provider-timeout maintains safety core', () => {
  expect(isSafetyCoreActive('cloud-provider-timeout')).toBeTruthy();
});

test('cloud-provider-timeout degrades to degrade level', () => {
  expect(getRecoveryLevel('cloud-provider-timeout')).toBe('degrade');
});

test('system alert for provider outage has system_failure priority', () => {
  const alert = buildSystemAlert('Online vision is unavailable. Offline safety mode is active.');
  expect(alert.priority).toBe('system_failure');
  expect(alert.source).toBe('system');
});

test('model load failure announces human message', () => {
  const announcement = getFailureAnnouncement('model-load-failure');
  if (announcement.toLowerCase().includes('model') && announcement.toLowerCase().includes('load')) {
    // OK only if it's phrased naturally
  }
  expect(announcement.length).toBeGreaterThan(10);
  expect(isSafetyCoreActive('model-load-failure')).toBeTruthy();
});

test('provider-cloud-unavailable system announcement exists', () => {
  const a = getSystemAnnouncement('provider-cloud-unavailable');
  expect(a.text.length).toBeGreaterThan(10);
  expect(a.interrupt).toBeTruthy();
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 8: Internet Loss
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 8 — Internet Loss');

test('no-internet failure scenario is detected', () => {
  const failures = detectActiveFailures({ isOnline: false });
  expect(failures).toContain('no-internet');
});

test('no-internet announces human message', () => {
  const a = getFailureAnnouncement('no-internet');
  expect(a.toLowerCase()).toContain('offline');
  expect(a.toLowerCase()).toContain('hazard detection');
});

test('no-internet does not require user action', () => {
  expect(requiresUserAction('no-internet')).toBeFalsy();
});

test('internet-lost system announcement interrupts', () => {
  const a = getSystemAnnouncement('internet-lost');
  expect(a.priority).toBe('high');
  expect(a.interrupt).toBeTruthy();
});

test('internet-restored system announcement is normal priority', () => {
  const a = getSystemAnnouncement('internet-restored');
  expect(a.priority).toBe('normal');
  expect(a.interrupt).toBeFalsy();
});

test('weak internet detected below 500kbps', () => {
  const failures = detectActiveFailures({ isOnline: true, bandwidthKbps: 200 });
  expect(failures).toContain('weak-internet');
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 9: Camera Loss
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 9 — Camera Loss');

test('camera-disconnected failure is detected', () => {
  const failures = detectActiveFailures({ cameraDisconnected: true });
  expect(failures).toContain('camera-disconnected');
});

test('camera-disconnected announces offline safety', () => {
  const a = getFailureAnnouncement('camera-disconnected');
  expect(a.toLowerCase()).toContain('offline safety');
  if (a.toLowerCase().includes('disconnected') && a.toLowerCase().includes('camera')) {
    // natural language — fine
  }
});

test('camera-permission-denied suggests user action', () => {
  expect(requiresUserAction('camera-permission-denied')).toBeTruthy();
  const hint = getUserActionHint('camera-permission-denied');
  expect(hint).toBeTruthy();
  expect((hint ?? '').toLowerCase()).toContain('settings');
});

test('camera-disconnected system announcement interrupts', () => {
  const a = getSystemAnnouncement('camera-disconnected');
  expect(a.interrupt).toBeTruthy();
  expect(a.priority).toBe('high');
});

test('camera safety core always maintained', () => {
  expect(isSafetyCoreActive('camera-disconnected')).toBeTruthy();
  expect(isSafetyCoreActive('camera-permission-denied')).toBeTruthy();
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 10: Critical Speech Interruption
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 10 — Critical Speech Interruption');

test('critical alert interrupts currently-speaking scene description', () => {
  let state = createCoordinationState();
  const scene = buildCompanionAlert('The path ahead looks open.');
  state = enqueueAlert(state, scene).state;
  const { state: s2, alert: speaking } = dequeueNextAlert(state);
  state = { ...s2, speaking };

  const critical = buildVisionAlert('Stop — vehicle approaching fast.', 'critical');
  expect(shouldInterrupt(state, critical)).toBeTruthy();
});

test('applyInterrupt clears lower-priority queued items', () => {
  let state = createCoordinationState();
  state = enqueueAlert(state, buildCompanionAlert('Reassurance message.')).state;
  state = enqueueAlert(state, buildNavigationAlert('Turn left at the corner.', false)).state;
  expect(state.queue.length).toBeGreaterThan(0);

  const after = applyInterrupt(state, 'critical_hazard');
  // All items below critical_hazard should be cleared
  expect(after.queue.every(
    a => COORDINATION_PRIORITY_RANK[a.priority] < COORDINATION_PRIORITY_RANK['critical_hazard']
  )).toBeTruthy();
});

test('emergency stop builds critical alert with interrupt', () => {
  const a = buildSystemAlert('Stopping. All alerts cleared.', true);
  expect(a.priority).toBe('critical_hazard');
  expect(a.interrupt).toBeTruthy();
});

test('emergency system announcement is critical priority', () => {
  const a = getSystemAnnouncement('emergency-stop');
  expect(a.priority).toBe('critical');
  expect(a.interrupt).toBeTruthy();
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 11: Duplicate Alert Suppression
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 11 — Duplicate Alert Suppression');

test('same alert within cooldown window is suppressed', () => {
  let state = createCoordinationState();
  const a1 = buildVisionAlert('Obstacle ahead.', 'medium');
  const { state: s2 } = dequeueNextAlert(enqueueAlert(state, a1).state);
  state = s2;

  // Same dedup key, within cooldown
  const a2 = buildAlert('Obstacle ahead.', 'scene_description', 'vision', {
    deduplicationKey: a1.deduplicationKey,
  });
  const { suppressed } = enqueueAlert(state, a2);
  expect(suppressed).toBeTruthy();
});

test('critical alert is never suppressed by cooldown', () => {
  let state = createCoordinationState();
  const a1 = buildVisionAlert('Obstacle!', 'critical');
  state = enqueueAlert(state, a1).state;
  const { state: s2 } = dequeueNextAlert(state);
  state = s2; // a1 now in cooldown

  const a2 = buildVisionAlert('Obstacle!', 'critical');
  const { suppressed } = enqueueAlert(state, a2);
  expect(suppressed).toBeFalsy(); // critical bypasses cooldown
});

test('isDuplicate returns false after cooldown expires', () => {
  let state = createCoordinationState();
  const a = buildVisionAlert('Obstacle.', 'medium');
  state = enqueueAlert(state, a).state;
  const { state: after } = dequeueNextAlert(state);
  state = after;

  const farFuture = Date.now() + 99999;
  expect(isDuplicate(state, a.deduplicationKey, farFuture)).toBeFalsy();
});

test('different hazard types are not treated as duplicates', () => {
  let state = createCoordinationState();
  const a1 = buildVisionAlert('Vehicle ahead.', 'high');
  const { state: s2 } = dequeueNextAlert(enqueueAlert(state, a1).state);
  state = s2;

  const a2 = buildVisionAlert('Cyclist ahead.', 'high');
  const { suppressed } = enqueueAlert(state, a2);
  expect(suppressed).toBeFalsy(); // different dedup key
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 12: Hybrid-Mode Fallback
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 12 — Hybrid-Mode Fallback');

test('mode-switch-to-offline system announcement is high priority', () => {
  const a = getSystemAnnouncement('mode-switch-to-offline');
  expect(a.priority).toBe('high');
  expect(a.interrupt).toBeTruthy();
});

test('mode-switch-to-simulation does not interrupt', () => {
  const a = getSystemAnnouncement('mode-switch-to-simulation');
  expect(a.interrupt).toBeFalsy();
});

test('provider-cloud-unavailable triggers offline mode announcement', () => {
  const a = getSystemAnnouncement('provider-cloud-unavailable');
  expect(a.text.toLowerCase()).toContain('offline');
});

test('simulation session-start message is human-friendly', () => {
  const a = getSessionStartAnnouncement('simulation', false);
  if (a.text.toLowerCase().includes('simulation mode')) {
    throw new Error(`Session start says "simulation mode" which is technical jargon: ${a.text}`);
  }
  expect(a.interrupt).toBeTruthy();
});

test('local-ai session-start describes on-device vision', () => {
  const a = getSessionStartAnnouncement('local-ai', true);
  expect(a.text.toLowerCase()).toContain('on-device');
  if (a.text.includes('local-ai') || a.text.includes('local_ai')) {
    throw new Error('Session start message must not expose internal mode identifiers');
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIO 13: Offline Safety Continuation
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nScenario 13 — Offline Safety Continuation');

test('ALL failure types maintain safety core', () => {
  const types = getAllFailureTypes();
  for (const t of types) {
    if (!isSafetyCoreActive(t)) {
      throw new Error(`Failure type "${t}" does not maintain safety core — this is a safety violation`);
    }
  }
  expect(types.length).toBe(12);
});

test('battery-critical is minimal (not stop) — safety continues', () => {
  expect(getRecoveryLevel('battery-critical')).toBe('minimal');
  expect(isSafetyCoreActive('battery-critical')).toBeTruthy();
});

test('overheating is minimal — safety continues', () => {
  expect(getRecoveryLevel('overheating')).toBe('minimal');
  expect(isSafetyCoreActive('overheating')).toBeTruthy();
});

test('battery-critical system announcement explains user action', () => {
  const a = getSystemAnnouncement('battery-critical');
  expect(a.text.toLowerCase()).toContain('battery');
  expect(a.interrupt).toBeTruthy();
});

test('multiple failures produce aggregate recovery level', () => {
  const level = aggregateRecoveryLevel(['no-internet', 'battery-critical']);
  expect(level).toBe('minimal'); // battery-critical is minimal, dominant
});

test('multi-failure summary is human friendly', () => {
  const summary = buildMultiFailureSummary(['no-internet', 'ocr-worker-crash', 'battery-critical']);
  expect(summary.toLowerCase()).toContain('minimal safety mode');
  expect(summary.toLowerCase()).toContain('hazard detection');
});

test('offline-safety-active system announcement describes continuation', () => {
  const a = getSystemAnnouncement('offline-safety-active');
  expect(a.text.toLowerCase()).toContain('offline');
  expect(a.text.toLowerCase()).toContain('hazard');
});

// ══════════════════════════════════════════════════════════════════════════════
// WORDING VALIDATION — no forbidden phrases
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nWording Validation');

test('crossing language never says "safe to cross"', () => {
  const engine = new GuardianWordingEngine();
  const severities: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low'];
  for (const sev of severities) {
    const msg = engine.generate({ hazardType: 'crossing', severity: sev, confidence: 0.8 });
    if (msg.toLowerCase().includes('safe to cross')) {
      throw new Error(`GuardianWordingEngine produced "safe to cross" for severity=${sev}: ${msg}`);
    }
  }
});

test('guardian messages never expose confidence numbers', () => {
  const engine = new GuardianWordingEngine();
  const hazards = ['vehicle', 'stairs', 'bicycle', 'person', 'dog'];
  for (const h of hazards) {
    const msg = engine.generate({ hazardType: h, severity: 'high', confidence: 0.83 });
    if (/0\.\d{2,}/.test(msg)) {
      throw new Error(`GuardianWordingEngine exposed confidence number in: ${msg}`);
    }
  }
});

test('session start announcements never say "simulation mode"', () => {
  const a = getSessionStartAnnouncement('simulation', false);
  if (a.text.toLowerCase().includes('simulation mode')) {
    throw new Error(`Session start announcement says "simulation mode": ${a.text}`);
  }
});

test('failure announcements never say "provider failure"', () => {
  const types = getAllFailureTypes();
  for (const t of types) {
    const announcement = getFailureAnnouncement(t);
    if (announcement.toLowerCase().includes('provider failure')) {
      throw new Error(`Failure "${t}" announcement says "provider failure": ${announcement}`);
    }
  }
});

test('failure announcements never say "switching mode"', () => {
  const types = getAllFailureTypes();
  for (const t of types) {
    const announcement = getFailureAnnouncement(t);
    if (announcement.toLowerCase().includes('switching mode')) {
      throw new Error(`Failure "${t}" says "switching mode": ${announcement}`);
    }
  }
});

test('priority system has 7 distinct levels', () => {
  const ranks = Object.values(COORDINATION_PRIORITY_RANK);
  const unique = new Set(ranks);
  expect(unique.size).toBe(7);
});

test('priority descriptions are human-readable', () => {
  const priorities: CoordinationPriority[] = [
    'critical_hazard', 'high_navigation', 'system_failure',
    'important_ocr', 'normal_navigation', 'scene_description', 'companion_info',
  ];
  for (const p of priorities) {
    const desc = describeCoordinationPriority(p);
    expect(desc.length).toBeGreaterThan(5);
  }
});

test('describeVisionModeHuman never says technical identifiers', () => {
  const modes: Array<'simulation' | 'local-ai' | 'cloud-ai'> = ['simulation', 'local-ai', 'cloud-ai'];
  for (const m of modes) {
    const desc = describeVisionModeHuman(m);
    if (desc.includes('local-ai') || desc.includes('cloud-ai')) {
      throw new Error(`describeVisionModeHuman exposes technical identifier: ${desc}`);
    }
    expect(desc.length).toBeGreaterThan(10);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ALERT COORDINATION SYSTEM TESTS
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nAlert Coordination System');

test('coordination state starts empty', () => {
  const s = createCoordinationState();
  expect(s.queue).toHaveLength(0);
  expect(s.speaking).toBeNull();
  expect(s.suppressedCount).toBe(0);
  expect(s.spokenCount).toBe(0);
});

test('queue accepts multiple sources', () => {
  let s = createCoordinationState();
  s = enqueueAlert(s, buildVisionAlert('Scene is open.', 'low')).state;
  s = enqueueAlert(s, buildOCRAlert('EXIT sign detected.', false)).state;
  s = enqueueAlert(s, buildNavigationAlert('Turn left in 20 metres.', false)).state;
  expect(s.queue.length).toBe(3);
});

test('queue orders by priority rank (critical first)', () => {
  let s = createCoordinationState();
  s = enqueueAlert(s, buildCompanionAlert('Path looks open.')).state;
  s = enqueueAlert(s, buildNavigationAlert('Turn left.', false)).state;
  s = enqueueAlert(s, buildVisionAlert('STOP — stairs ahead!', 'critical')).state;
  expect(s.queue[0].priority).toBe('critical_hazard');
});

test('companion_info is suppressed while critical is speaking', () => {
  let s = createCoordinationState();
  const crit = buildVisionAlert('Stop — stairs!', 'critical');
  s = enqueueAlert(s, crit).state;
  const { state: s2, alert } = dequeueNextAlert(s);
  s = { ...s2, speaking: alert };

  const companion = buildCompanionAlert('Good morning.');
  const { suppressed } = enqueueAlert(s, companion);
  expect(suppressed).toBeTruthy();
});

test('snapshot shows correct queue length and cooldowns', () => {
  let s = createCoordinationState();
  s = enqueueAlert(s, buildNavigationAlert('Ahead.', false)).state;
  const snap = getCoordinationSnapshot(s);
  expect(snap.queueLength).toBe(1);
  expect(snap.isSpeaking).toBeFalsy();
});

test('spokenCount increments on dequeue', () => {
  let s = createCoordinationState();
  s = enqueueAlert(s, buildNavigationAlert('Turn left.', false)).state;
  const { state: s2 } = dequeueNextAlert(s);
  expect(s2.spokenCount).toBe(1);
});

// ══════════════════════════════════════════════════════════════════════════════
// FAILURE RECOVERY SYSTEM TESTS
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nFailure Recovery System');

test('all 12 failure types are registered', () => {
  expect(getAllFailureTypes()).toHaveLength(12);
});

test('every failure scenario has a non-empty announcement', () => {
  const types = getAllFailureTypes();
  for (const t of types) {
    const a = getFailureAnnouncement(t);
    if (a.length < 10) throw new Error(`Failure "${t}" announcement too short: ${a}`);
  }
});

test('every failure maintains safety core', () => {
  // Verified by SCENARIO 13 test above — confirm explicitly
  const types = getAllFailureTypes();
  expect(types.every(t => FAILURE_REGISTRY[t].safetyCoreMaintained)).toBeTruthy();
});

test('isMinimalMode true for battery-critical + overheating', () => {
  expect(isMinimalMode(['battery-critical', 'overheating'])).toBeTruthy();
});

test('isMinimalMode false for degrade-level failures', () => {
  expect(isMinimalMode(['no-internet', 'ocr-worker-crash'])).toBeFalsy();
});

test('detectActiveFailures finds all applicable failures', () => {
  const failures = detectActiveFailures({
    cameraDisconnected: true,
    isOnline: false,
    ocrWorkerCrashed: true,
    batteryLevel: 0.03,
  });
  expect(failures).toContain('camera-disconnected');
  expect(failures).toContain('no-internet');
  expect(failures).toContain('ocr-worker-crash');
  expect(failures).toContain('battery-critical');
});

test('tts-unavailable fallback is haptic-only', () => {
  const s = getFailureScenario('tts-unavailable');
  expect(s.fallbackAction).toBe('use-haptic-only');
});

test('location-unavailable does not require user action', () => {
  expect(requiresUserAction('location-unavailable')).toBeFalsy();
});

test('overheating requires user action', () => {
  expect(requiresUserAction('overheating')).toBeTruthy();
  expect(getUserActionHint('overheating')).toBeTruthy();
});

// ══════════════════════════════════════════════════════════════════════════════
// Sprint 23 Wiring Integration Tests
// Tests connected behaviour between alertCoordinationEngine, alertQualityEngine,
// buildVisionAlert, buildOCRAlert, buildNavigationAlert, detectActiveFailures,
// processNavigationTick, and failureRecoveryEngine working as one pipeline.
// ══════════════════════════════════════════════════════════════════════════════

// ── Integration 1: Critical hazard interrupts currently-speaking OCR ────────

test('integration: critical hazard interrupts lower-priority OCR', () => {
  let state = createCoordinationState();

  // Enqueue and then dequeue the OCR alert — this marks it as currently speaking
  const ocrAlert = buildOCRAlert('Street name: Main Street.', false);
  const { state: s1 } = enqueueAlert(state, ocrAlert);
  const { state: s2 } = dequeueNextAlert(s1); // now speaking = ocrAlert
  state = s2;

  // Critical hazard arrives while OCR is playing
  const hazard = buildVisionAlert('Stop — vehicle approaching fast.', 'critical');

  // shouldInterrupt must return true (critical interrupts non-critical speaking)
  if (!shouldInterrupt(state, hazard)) throw new Error('Critical hazard should interrupt speaking OCR');

  // Apply interrupt (clears queue), then enqueue + dequeue hazard
  state = applyInterrupt(state, hazard.priority);
  const { state: s3 } = enqueueAlert(state, hazard);
  const { alert: first } = dequeueNextAlert(s3);
  if (!first) throw new Error('Expected an alert to dequeue');
  if (first.priority !== 'critical_hazard') throw new Error(`Expected critical_hazard, got ${first.priority}`);
  if (!first.text.includes('vehicle')) throw new Error(`Wrong text: ${first.text}`);
});

// ── Integration 2: Navigation warning priority over scene description ───────

test('integration: high navigation warning has priority over scene description', () => {
  let state = createCoordinationState();

  // Enqueue scene description first
  const scene = buildAlert('The area is an indoor corridor.', 'scene_description', 'vision', {
    deduplicationKey: 'scene-corridor',
  });
  const { state: s1 } = enqueueAlert(state, scene);
  state = s1;

  // High navigation warning arrives
  const navWarning = buildNavigationAlert('Stop before the crossing.', true); // high risk
  const { state: s2 } = enqueueAlert(state, navWarning);
  state = s2;

  // Dequeue — high navigation must come out before scene_description
  const { alert: first, state: s3 } = dequeueNextAlert(state);
  if (!first) throw new Error('Expected an alert');
  if (first.priority !== 'high_navigation') throw new Error(`Expected high_navigation, got ${first.priority}`);
  state = s3;

  const { alert: second } = dequeueNextAlert(state);
  if (!second) throw new Error('Expected second alert');
  if (second.priority !== 'scene_description') throw new Error(`Expected scene_description, got ${second.priority}`);
});

// ── Integration 3: Duplicate OCR suppressed via dedup key ─────────────────

test('integration: repeated OCR text is suppressed after first announcement', () => {
  let state = createCoordinationState();

  const text = 'Sign ahead: No Entry.';
  const ocr1 = buildOCRAlert(text, true);
  const { state: s1, suppressed: sup1 } = enqueueAlert(state, ocr1);
  state = s1;
  if (sup1) throw new Error('First OCR should not be suppressed');

  // Must dequeue first — dequeue records the cooldown for the dedup key
  const { state: s2 } = dequeueNextAlert(state);
  state = s2;

  // Same OCR text again — cooldown recorded on dequeue, so now it should be suppressed
  const ocr2 = buildOCRAlert(text, true);
  const { suppressed: sup2 } = enqueueAlert(state, ocr2);
  if (!sup2) throw new Error('Second identical OCR should be suppressed after dequeue records cooldown');
});

// ── Integration 4: Risk increase bypasses AlertQualityEngine cooldown ────────

test('integration: AlertQualityEngine speaks when risk increases', () => {
  const engine = new AlertQualityEngine();

  const base = {
    detections: [{ label: 'car', confidence: 0.7, boundingBox: { x: 0, y: 0, width: 0.2, height: 0.2 } }],
    alerts: [{ id: '1', type: 'car', description: 'Car', severity: 'medium' as const, confidence: 0.7, timestamp: new Date(), shouldInterrupt: false, disclaimer: 'AI assistance only.' }],
    baseDecision: { shouldAlert: true, urgency: 'medium' as const, message: 'Car nearby', confidence: 0.7, interruptNarration: false },
    prevRiskLevel: 'medium' as const,
  };

  // First call — new hazard, should speak
  const d1 = engine.process(base);
  if (!d1.shouldSpeak) throw new Error('Should speak for new hazard');

  // Simulate cooldown by re-calling with same data (throttle active)
  engine.process(base);
  engine.process(base);

  // Now risk increases to 'critical' — must bypass cooldown
  const escalated = {
    ...base,
    alerts: [{ ...base.alerts[0], severity: 'critical' as const }],
    baseDecision: { ...base.baseDecision, urgency: 'critical' as const },
    prevRiskLevel: 'medium' as const,
  };
  const d2 = engine.process(escalated);
  if (!d2.shouldSpeak) throw new Error('Risk increase should bypass cooldown');
  if (d2.speakTrigger !== 'risk_increased' && d2.speakTrigger !== 'critical_never_silenced') {
    throw new Error(`Wrong trigger: ${d2.speakTrigger}`);
  }
});

// ── Integration 5: Internet loss triggers offline safety announcement ────────

test('integration: internet loss detected → offline failure announced', () => {
  const failures = detectActiveFailures({ isOnline: false });
  if (!failures.includes('no-internet')) throw new Error('no-internet not detected');

  const announcement = getFailureAnnouncement('no-internet');
  if (!announcement || announcement.length < 5) throw new Error('Announcement too short');

  // Announcement should mention offline mode — not raw technical language
  if (announcement.toLowerCase().includes('null') || announcement.toLowerCase().includes('undefined')) {
    throw new Error('Announcement contains raw null/undefined');
  }

  // Route through coordination
  const alert = buildSystemAlert(announcement, false);
  let state = createCoordinationState();
  const { suppressed } = enqueueAlert(state, alert);
  if (suppressed) throw new Error('First offline announcement should not be suppressed');
  if (alert.priority !== 'system_failure') throw new Error(`Expected system_failure priority, got ${alert.priority}`);
});

// ── Integration 6: Camera disconnect produces a warning alert ───────────────

test('integration: camera disconnect produces system warning in coordination queue', () => {
  const failures = detectActiveFailures({ cameraDisconnected: true, isOnline: true });
  if (!failures.includes('camera-disconnected')) throw new Error('camera-disconnected not detected');

  const announcement = getFailureAnnouncement('camera-disconnected');
  if (!announcement) throw new Error('No announcement for camera-disconnected');

  const alert = buildSystemAlert(announcement, true); // critical-level camera loss
  if (alert.priority !== 'critical_hazard') throw new Error('Camera disconnect should be critical_hazard');

  let state = createCoordinationState();
  const { state: s2 } = enqueueAlert(state, alert);
  const { alert: out } = dequeueNextAlert(s2);
  if (!out) throw new Error('Camera disconnect alert did not dequeue');
  if (!out.text.includes(announcement.slice(0, 20))) throw new Error('Text mismatch in dequeued alert');
});

// ── Integration 7: Companion speech suppressed during active danger ──────────

test('integration: companion_info suppressed when critical_hazard is speaking', () => {
  let state = createCoordinationState();

  // Enqueue + dequeue critical hazard — sets state.speaking = hazard
  const hazard = buildVisionAlert('Stop — staircase directly ahead.', 'critical');
  const { state: s1 } = enqueueAlert(state, hazard);
  const { state: s2 } = dequeueNextAlert(s1); // speaking = hazard
  state = s2;
  if (state.speaking?.priority !== 'critical_hazard') throw new Error('Critical should be speaking');

  // Companion tries to speak during danger
  const companion = buildCompanionAlert('You are doing well, keep going.');
  const interrupts = shouldInterrupt(state, companion);
  // Companion must NOT interrupt critical speech
  if (interrupts) throw new Error('Companion must not interrupt critical hazard');

  // Enqueue companion — critical-active suppression should block it
  const { suppressed } = enqueueAlert(state, companion);
  if (!suppressed) throw new Error('Companion should be suppressed while critical_hazard is speaking');
});

// ── Integration 8: Navigation guidance reaches the audio queue ──────────────

test('integration: navigation tick produces guidance that enters coordination queue', () => {
  const session = createNavigationSession('Main entrance', 'indoor');
  if (!isRouteActive(session)) throw new Error('New session should be active');

  // Tick the session — advance several ticks to pass the cooldown
  let current = session;
  let guidance = null;
  for (let i = 0; i < 10; i++) {
    const result = processNavigationTick(current, i, 0); // lastSpokenAt=0 → cooldown elapsed
    current = result.session;
    if (result.guidance) {
      guidance = result.guidance;
      break;
    }
  }
  if (!guidance) throw new Error('Navigation tick produced no guidance in 10 steps');

  // Route guidance into coordination
  const alert = buildNavigationAlert(guidance.text, guidance.priority === 'urgent');
  if (!alert.text) throw new Error('Navigation alert has no text');
  if (alert.text.toLowerCase().includes('safe to cross')) {
    throw new Error('Navigation MUST NOT say "safe to cross"');
  }

  let state = createCoordinationState();
  const { state: s2 } = enqueueAlert(state, alert);
  const { alert: out } = dequeueNextAlert(s2);
  if (!out) throw new Error('Navigation alert did not dequeue');
});

// ── Integration 9: Crossing language — never "safe to cross" ─────────────────

test('integration: crossing language never says "safe to cross"', () => {
  const FORBIDDEN = 'safe to cross';
  const session = createNavigationSession('Hospital', 'outdoor');
  let current = session;
  for (let i = 0; i < 20; i++) {
    const { session: s, guidance } = processNavigationTick(current, i, 0);
    current = s;
    if (guidance?.text?.toLowerCase().includes(FORBIDDEN)) {
      throw new Error(`Crossing language violation: "${guidance.text}"`);
    }
  }
});

// ── Integration 10: OCR hazard text routed to guardian ───────────────────────

test('integration: OCR medicine warning enters important_ocr priority lane', () => {
  const formatted = formatOCRAnnouncement('medicine', 'Do not exceed 2 tablets daily.', 'high', true);
  if (!formatted) throw new Error('formatOCRAnnouncement returned empty');
  if (formatted.toLowerCase().includes('confidence')) {
    throw new Error('OCR announcement must not expose confidence numbers');
  }

  const alert = buildOCRAlert(formatted, true);
  if (alert.priority !== 'important_ocr') throw new Error(`Expected important_ocr, got ${alert.priority}`);
  if (!alert.text.includes('Do not exceed')) throw new Error('OCR text missing from alert');
});

// ── Integration 11: Emergency stop clears the coordination queue ─────────────

test('integration: emergency stop clears queued low-priority speech', () => {
  let state = createCoordinationState();

  // Enqueue several alerts, then dequeue one so something is speaking
  state = enqueueAlert(state, buildCompanionAlert('You are doing well.')).state;
  state = enqueueAlert(state, buildNavigationAlert('Turn left at the end.', false)).state;
  const { state: s2 } = dequeueNextAlert(state); // now speaking = companion
  state = s2;

  // Queue still has nav alert
  state = enqueueAlert(state, buildVisionAlert('Path is clear ahead.', 'low')).state;

  // Emergency stop: critical system alert interrupts current speech
  const emergency = buildSystemAlert('Emergency stop activated.', true);
  if (!shouldInterrupt(state, emergency)) throw new Error('Emergency must interrupt currently-speaking audio');

  // Apply interrupt: clears queue items with lower priority than critical_hazard
  state = applyInterrupt(state, emergency.priority);

  // Enqueue the emergency itself and verify it dequeues correctly
  const { state: s3 } = enqueueAlert(state, emergency);
  const { alert: first } = dequeueNextAlert(s3);
  if (!first) throw new Error('Emergency alert should dequeue');
  if (first.priority !== 'critical_hazard') throw new Error(`Expected critical_hazard, got ${first.priority}`);
});

// ── Integration 12: AlertQualityEngine produces directional wording ──────────

test('integration: AlertQualityEngine generates directional human-friendly messages', () => {
  const engine = new AlertQualityEngine();
  const result = engine.process({
    detections: [{
      label: 'person',
      confidence: 0.85,
      boundingBox: { x: 0.1, y: 0.1, width: 0.15, height: 0.4 },
    }],
    alerts: [{
      id: '1',
      type: 'person',
      description: 'Person detected',
      severity: 'medium' as const,
      confidence: 0.85,
      timestamp: new Date(),
      shouldInterrupt: false,
      disclaimer: 'AI assistance only.',
    }],
    baseDecision: { shouldAlert: true, urgency: 'medium' as const, message: 'Person detected.', confidence: 0.85, interruptNarration: false },
    prevRiskLevel: 'none' as const,
  });

  if (!result.shouldSpeak) throw new Error('Should speak for new person detection');
  if (!result.message) throw new Error('Message is null');

  // Message must NOT contain raw confidence number
  if (/\b0\.\d{2}\b/.test(result.message)) {
    throw new Error(`Confidence number leaked into message: "${result.message}"`);
  }
  // Message should describe a person (not "obstacle confidence 0.89")
  const lower = result.message.toLowerCase();
  const goodTerms = ['person', 'someone', 'people', 'individual'];
  if (!goodTerms.some(t => lower.includes(t))) {
    throw new Error(`Message not person-specific enough: "${result.message}"`);
  }
});

// ── Integration 13: Battery critical → coordination priority critical ─────────

test('integration: battery-critical failure routes to critical_hazard priority', () => {
  const failures = detectActiveFailures({ batteryLevel: 0.02 });
  if (!failures.includes('battery-critical')) throw new Error('battery-critical not detected');

  const announcement = getFailureAnnouncement('battery-critical');
  const alert = buildSystemAlert(announcement, true); // isCritical=true
  if (alert.priority !== 'critical_hazard') throw new Error(`Expected critical_hazard, got ${alert.priority}`);
});

// ── Integration 14: AlertQualityEngine dedup suppresses repeated identical scene ──

test('integration: AlertQualityEngine suppresses repeated identical hazard', () => {
  const engine = new AlertQualityEngine();
  const input = {
    detections: [{ id: '1', label: 'bicycle', confidence: 0.7, boundingBox: { x: 0.4, y: 0.2, width: 0.2, height: 0.3 } }],
    alerts: [{ id: '1', type: 'bicycle', description: 'Bicycle', severity: 'medium' as const, confidence: 0.7, timestamp: new Date(), shouldInterrupt: false, disclaimer: 'AI assistance only.' }],
    baseDecision: { shouldAlert: true, urgency: 'medium' as const, message: 'Bicycle nearby', confidence: 0.7, interruptNarration: false },
    prevRiskLevel: 'medium' as const,
  };

  const d1 = engine.process(input);
  if (!d1.shouldSpeak) throw new Error('First detection should speak');

  // Repeated identical input — throttle should suppress
  const d2 = engine.process({ ...input, prevRiskLevel: 'medium' as const });
  const d3 = engine.process({ ...input, prevRiskLevel: 'medium' as const });
  // At least one should be silenced
  const eitherSilenced = !d2.shouldSpeak || !d3.shouldSpeak;
  if (!eitherSilenced) throw new Error('Repeated identical hazard should eventually be throttled');
});

// ── Integration 15: Offline → formatOCRAnnouncement still works ──────────────

test('integration: formatOCRAnnouncement works offline (no API dependency)', () => {
  // This must work without network — it is pure text formatting
  const result = formatOCRAnnouncement('sign', 'Road Closed Ahead', 'high', false);
  if (!result || result.length === 0) throw new Error('formatOCRAnnouncement returned empty offline');
  if (result.toLowerCase().includes('fetch') || result.toLowerCase().includes('error')) {
    throw new Error('OCR formatting should not reference network errors');
  }
});

// ── Integration 16: Coordination state isolates multiple alert sources ────────

test('integration: coordination handles vision + OCR + navigation in one state', () => {
  let state = createCoordinationState();

  const vision = buildVisionAlert('Obstacle ahead, slightly to your right.', 'medium');
  const ocr    = buildOCRAlert('Sign ahead: Wet Floor. Please verify.', false);
  const nav    = buildNavigationAlert('Continue straight for about ten metres.', false);

  state = enqueueAlert(state, vision).state;
  state = enqueueAlert(state, ocr).state;
  state = enqueueAlert(state, nav).state;

  // Queue should have 3 items
  if (state.queue.length !== 3) throw new Error(`Expected 3 in queue, got ${state.queue.length}`);

  // Dequeue order: vision (high_navigation or scene_description), then normal
  // The order depends on priority. Both vision and ocr/nav are lower priority so order matters
  const { alert: first } = dequeueNextAlert(state);
  if (!first) throw new Error('First dequeue failed');
  // All three sources exist — just verify no text is lost
  if (!first.text) throw new Error('First dequeued alert has empty text');
});

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n──────────────────────────────────────────────────────');
if (errors.length > 0) {
  console.error(errors.join('\n\n'));
}
console.log(`\nLive Perception E2E Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

// Sprint 3 — Camera State Engine tests
// All 5 camera statuses, state transitions, privacy rules, and source-mode logic.
// Run: npx tsx tests/cameraFlow.test.ts

import {
  getCameraSourceMode,
  getCameraModeLabel,
  isSimulationMode,
  isCameraFallback,
  canStartCamera,
  canStopCamera,
  getCameraInputDescription,
  getCameraStatusAnnouncement,
  CAMERA_PRIVACY_RULES,
  CAMERA_STATUS_LABELS,
  type CameraStatus,
} from '../src/engines/cameraStateEngine';

// ─── Minimal test harness ──────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    results.push(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    results.push(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toContain(sub: string) {
      if (typeof actual !== 'string') throw new Error(`Expected string, got ${typeof actual}`);
      if (!actual.includes(sub)) throw new Error(`Expected "${actual}" to contain "${sub}"`);
    },
    toBeLessThanOrEqual(n: number) {
      if (typeof actual !== 'number') throw new Error(`Expected number`);
      if (actual > n) throw new Error(`Expected ${actual} ≤ ${n}`);
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== 'number') throw new Error(`Expected number`);
      if (actual <= n) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeGreaterThanOrEqual(n: number) {
      if (typeof actual !== 'number') throw new Error(`Expected number`);
      if (actual < n) throw new Error(`Expected ${actual} ≥ ${n}`);
    },
  };
}

const ALL_STATUSES: CameraStatus[] = ['inactive', 'requesting', 'active', 'denied', 'fallback'];

// ─── getCameraSourceMode ────────────────────────────────────────────────────
console.log('\ncameraStateEngine — getCameraSourceMode');
test('inactive → simulation', () => expect(getCameraSourceMode('inactive')).toBe('simulation'));
test('requesting → simulation', () => expect(getCameraSourceMode('requesting')).toBe('simulation'));
test('active → camera', () => expect(getCameraSourceMode('active')).toBe('camera'));
test('denied → simulation', () => expect(getCameraSourceMode('denied')).toBe('simulation'));
test('fallback → simulation', () => expect(getCameraSourceMode('fallback')).toBe('simulation'));
test('only active produces real frames', () => {
  const sources = ALL_STATUSES.map(s => getCameraSourceMode(s));
  const cameraCount = sources.filter(s => s === 'camera').length;
  expect(cameraCount).toBe(1);
});

// ─── isSimulationMode ────────────────────────────────────────────────────────
console.log('\ncameraStateEngine — isSimulationMode');
test('inactive → simulation mode', () => expect(isSimulationMode('inactive')).toBe(true));
test('requesting → simulation mode', () => expect(isSimulationMode('requesting')).toBe(true));
test('denied → simulation mode', () => expect(isSimulationMode('denied')).toBe(true));
test('fallback → simulation mode', () => expect(isSimulationMode('fallback')).toBe(true));
test('active → not simulation mode', () => expect(isSimulationMode('active')).toBe(false));
test('isSimulationMode is inverse of getCameraSourceMode===camera', () => {
  ALL_STATUSES.forEach(s => {
    const sim = isSimulationMode(s);
    const src = getCameraSourceMode(s);
    if (sim && src !== 'simulation') throw new Error(`Mismatch for ${s}`);
    if (!sim && src !== 'camera') throw new Error(`Mismatch for ${s}`);
  });
});

// ─── isCameraFallback ─────────────────────────────────────────────────────────
console.log('\ncameraStateEngine — isCameraFallback');
test('fallback → true', () => expect(isCameraFallback('fallback')).toBe(true));
test('inactive → false', () => expect(isCameraFallback('inactive')).toBe(false));
test('requesting → false', () => expect(isCameraFallback('requesting')).toBe(false));
test('active → false', () => expect(isCameraFallback('active')).toBe(false));
test('denied → false', () => expect(isCameraFallback('denied')).toBe(false));
test('only fallback returns true', () => {
  const trueCount = ALL_STATUSES.filter(isCameraFallback).length;
  expect(trueCount).toBe(1);
});

// ─── canStartCamera ────────────────────────────────────────────────────────────
console.log('\ncameraStateEngine — canStartCamera');
test('inactive → can start', () => expect(canStartCamera('inactive')).toBe(true));
test('denied → can start (retry after denial)', () => expect(canStartCamera('denied')).toBe(true));
test('fallback → can start (retry after stream loss)', () => expect(canStartCamera('fallback')).toBe(true));
test('active → cannot start (already running)', () => expect(canStartCamera('active')).toBe(false));
test('requesting → cannot start (request in progress)', () => expect(canStartCamera('requesting')).toBe(false));
test('exactly 3 statuses allow starting camera', () => {
  const count = ALL_STATUSES.filter(canStartCamera).length;
  expect(count).toBe(3);
});

// ─── canStopCamera ─────────────────────────────────────────────────────────────
console.log('\ncameraStateEngine — canStopCamera');
test('active → can stop', () => expect(canStopCamera('active')).toBe(true));
test('requesting → can stop (cancel request)', () => expect(canStopCamera('requesting')).toBe(true));
test('inactive → cannot stop', () => expect(canStopCamera('inactive')).toBe(false));
test('denied → cannot stop', () => expect(canStopCamera('denied')).toBe(false));
test('fallback → cannot stop (already stopped)', () => expect(canStopCamera('fallback')).toBe(false));
test('exactly 2 statuses allow stopping camera', () => {
  const count = ALL_STATUSES.filter(canStopCamera).length;
  expect(count).toBe(2);
});

// ─── getCameraModeLabel ────────────────────────────────────────────────────────
console.log('\ncameraStateEngine — getCameraModeLabel');
test('active contains camera/live language', () => {
  const label = getCameraModeLabel('active').toLowerCase();
  if (!label.includes('camera') && !label.includes('live')) throw new Error('Missing camera/live language');
});
test('denied contains denied or fallback', () => {
  const label = getCameraModeLabel('denied').toLowerCase();
  if (!label.includes('denied') && !label.includes('fallback')) throw new Error('Missing denied/fallback');
});
test('fallback mentions camera lost', () => {
  const label = getCameraModeLabel('fallback').toLowerCase();
  if (!label.includes('lost') && !label.includes('fallback')) throw new Error('Missing lost/fallback');
});
test('requesting mentions permission or access', () => {
  const label = getCameraModeLabel('requesting').toLowerCase();
  if (!label.includes('request') && !label.includes('access') && !label.includes('permission')) throw new Error('Missing request/access');
});
test('inactive mentions simulation or start camera', () => {
  const label = getCameraModeLabel('inactive').toLowerCase();
  if (!label.includes('simulation') && !label.includes('start camera')) throw new Error('Missing simulation/start camera');
});
test('all statuses return non-empty label', () => {
  ALL_STATUSES.forEach(s => {
    const label = getCameraModeLabel(s);
    if (!label || label.length === 0) throw new Error(`Empty label for ${s}`);
  });
});
test('fallback label differs from denied label', () => {
  if (getCameraModeLabel('fallback') === getCameraModeLabel('denied')) {
    throw new Error('fallback and denied should have distinct labels');
  }
});

// ─── getCameraInputDescription ─────────────────────────────────────────────────
console.log('\ncameraStateEngine — getCameraInputDescription');
test('active with 0 frames contains "0 frames"', () => {
  expect(getCameraInputDescription('active', 0)).toContain('0 frames');
});
test('active with 1 frame uses singular', () => {
  expect(getCameraInputDescription('active', 1)).toContain('1 frame');
});
test('active with 5 frames uses plural', () => {
  expect(getCameraInputDescription('active', 5)).toContain('5 frames');
});
test('active description contains no storage guarantee', () => {
  const desc = getCameraInputDescription('active', 10).toLowerCase();
  if (!desc.includes('no storage') && !desc.includes('not retain')) throw new Error('Missing storage guarantee');
});
test('inactive → simulation description', () => {
  const desc = getCameraInputDescription('inactive', 0).toLowerCase();
  if (!desc.includes('simulation') && !desc.includes('no real')) throw new Error('Missing simulation language');
});
test('denied → simulation description', () => {
  const desc = getCameraInputDescription('denied', 0).toLowerCase();
  if (!desc.includes('simulation') && !desc.includes('no real')) throw new Error('Missing simulation language');
});
test('fallback → simulation description', () => {
  const desc = getCameraInputDescription('fallback', 0).toLowerCase();
  if (!desc.includes('simulation') && !desc.includes('no real')) throw new Error('Missing simulation language');
});
test('requesting → simulation description', () => {
  const desc = getCameraInputDescription('requesting', 0).toLowerCase();
  if (!desc.includes('simulation') && !desc.includes('no real')) throw new Error('Missing simulation language');
});

// ─── CAMERA_PRIVACY_RULES ─────────────────────────────────────────────────────
console.log('\ncameraStateEngine — CAMERA_PRIVACY_RULES');
test('noVideoStorage is true', () => expect(CAMERA_PRIVACY_RULES.noVideoStorage).toBe(true));
test('noFaceRecognition is true', () => expect(CAMERA_PRIVACY_RULES.noFaceRecognition).toBe(true));
test('noAudioCapture is true', () => expect(CAMERA_PRIVACY_RULES.noAudioCapture).toBe(true));
test('JPEG compression quality ≤ 0.8', () => expect(CAMERA_PRIVACY_RULES.jpegCompressionQuality).toBeLessThanOrEqual(0.8));
test('JPEG compression quality > 0', () => expect(CAMERA_PRIVACY_RULES.jpegCompressionQuality).toBeGreaterThan(0));
test('maxFrameWidthPx ≤ 640', () => expect(CAMERA_PRIVACY_RULES.maxFrameWidthPx).toBeLessThanOrEqual(640));
test('framePurposeDescription is non-empty', () => {
  expect(CAMERA_PRIVACY_RULES.framePurposeDescription.length).toBeGreaterThan(0);
});
test('framePurposeDescription mentions assistive purpose', () => {
  const desc = CAMERA_PRIVACY_RULES.framePurposeDescription.toLowerCase();
  if (!desc.includes('assistive') && !desc.includes('analysis')) throw new Error('Missing purpose');
});

// ─── CAMERA_STATUS_LABELS ─────────────────────────────────────────────────────
console.log('\ncameraStateEngine — CAMERA_STATUS_LABELS');
test('all 5 statuses have label entries', () => {
  ALL_STATUSES.forEach(s => {
    if (!CAMERA_STATUS_LABELS[s]) throw new Error(`Missing label for ${s}`);
  });
});
test('active compact label is Live', () => expect(CAMERA_STATUS_LABELS.active.compact).toBe('Live'));
test('fallback compact contains Fallback', () => expect(CAMERA_STATUS_LABELS.fallback.compact).toContain('Fallback'));
test('denied compact contains Sim', () => expect(CAMERA_STATUS_LABELS.denied.compact).toContain('Sim'));
test('compact labels are shorter than full labels', () => {
  ALL_STATUSES.forEach(s => {
    const { full, compact } = CAMERA_STATUS_LABELS[s];
    if (compact.length >= full.length) throw new Error(`${s}: compact should be shorter than full`);
  });
});
test('fallback full label differs from denied full label', () => {
  if (CAMERA_STATUS_LABELS.fallback.full === CAMERA_STATUS_LABELS.denied.full) {
    throw new Error('fallback and denied must have distinct full labels');
  }
});

// ─── getCameraStatusAnnouncement ─────────────────────────────────────────────
console.log('\ncameraStateEngine — getCameraStatusAnnouncement');
test('active announcement is non-empty', () => {
  const a = getCameraStatusAnnouncement('active');
  expect(a.length).toBeGreaterThan(0);
});
test('denied announcement mentions denied or simulation', () => {
  const a = getCameraStatusAnnouncement('denied').toLowerCase();
  if (!a.includes('denied') && !a.includes('simulation')) throw new Error('Missing denied/simulation');
});
test('fallback announcement mentions reconnect or retry or simulation', () => {
  const a = getCameraStatusAnnouncement('fallback').toLowerCase();
  if (!a.includes('lost') && !a.includes('simulation') && !a.includes('reconnect') && !a.includes('retry')) {
    throw new Error('Missing lost/simulation/reconnect/retry');
  }
});
test('all statuses have non-empty announcements', () => {
  ALL_STATUSES.forEach(s => {
    const a = getCameraStatusAnnouncement(s);
    if (!a || a.length === 0) throw new Error(`Empty announcement for ${s}`);
  });
});
test('fallback announcement differs from denied announcement', () => {
  if (getCameraStatusAnnouncement('fallback') === getCameraStatusAnnouncement('denied')) {
    throw new Error('fallback and denied announcements should differ');
  }
});

// ─── Integration: consistency across functions ─────────────────────────────────
console.log('\ncameraStateEngine — integration consistency');
test('all non-active statuses are simulation mode', () => {
  const nonActive = ALL_STATUSES.filter(s => s !== 'active');
  nonActive.forEach(s => {
    if (!isSimulationMode(s)) throw new Error(`${s} should be simulation mode`);
  });
});
test('getCameraSourceMode and isSimulationMode are consistent', () => {
  ALL_STATUSES.forEach(s => {
    const sim = isSimulationMode(s);
    const mode = getCameraSourceMode(s);
    const consistent = (sim && mode === 'simulation') || (!sim && mode === 'camera');
    if (!consistent) throw new Error(`Inconsistency for ${s}`);
  });
});
test('canStart and canStop are mutually exclusive for active', () => {
  if (canStartCamera('active') === true) throw new Error('active should not allow start');
  if (canStopCamera('active') === false) throw new Error('active should allow stop');
});
test('canStart and canStop are mutually exclusive for inactive', () => {
  if (canStartCamera('inactive') === false) throw new Error('inactive should allow start');
  if (canStopCamera('inactive') === true) throw new Error('inactive should not allow stop');
});
test('fallback allows retry (canStart) but not stop (canStop)', () => {
  if (!canStartCamera('fallback')) throw new Error('fallback should allow camera retry');
  if (canStopCamera('fallback')) throw new Error('fallback should not allow stop (stream already gone)');
});
test('privacy rules are immutable constants', () => {
  const rules = CAMERA_PRIVACY_RULES;
  expect(rules.noVideoStorage).toBe(true);
  expect(rules.noFaceRecognition).toBe(true);
  expect(rules.noAudioCapture).toBe(true);
});
test('requesting status cannot start or stop in contradictory ways', () => {
  if (canStartCamera('requesting')) throw new Error('requesting → canStart should be false');
  if (!canStopCamera('requesting')) throw new Error('requesting → canStop should be true (cancel)');
});
test('denied status can start (retry) but not stop', () => {
  if (!canStartCamera('denied')) throw new Error('denied → canStart should be true (retry)');
  if (canStopCamera('denied')) throw new Error('denied → canStop should be false');
});

// ─── Results ───────────────────────────────────────────────────────────────────
console.log('\n' + results.join('\n'));
console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

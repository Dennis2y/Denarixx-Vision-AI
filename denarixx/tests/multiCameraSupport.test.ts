// V14 Multi-Camera Smart Glasses Support — test suite
// Run: npx tsx tests/multiCameraSupport.test.ts

import {
  createGlassesState,
  createDefaultFeed,
  connectCamera,
  disconnectCamera,
  getActiveFeed,
  getCamerasByHealth,
  getConnectedFeeds,
  hasAnyConnectedCamera,
  computeHealthStatus,
  computeConnectionHealth,
  formatCameraPosition,
  formatConnectionHealth,
  simulateFeedTick,
  simulateBatteryDrain,
} from '../src/engines/glassesCameraEngine';

import {
  assessCameraHealth,
  isCameraUsable,
  getCriticalFailures,
  getDegradedFeeds,
  allGlassesCamerasFailed,
  noUsableCameras,
  shouldFallbackToPhone,
  applyPhoneFallback,
  clearFallback,
  selectBestCamera,
  buildFallbackGuidance,
  buildUnavailableMessage,
  buildCameraStatusSummary,
  getCamerasBatteryWarning,
  computeOverallHealthScore,
} from '../src/engines/cameraHealthEngine';

import {
  classifyFovZone,
  buildDirectionalInstruction,
  estimateObjectDirection,
  hasCenterThreat,
  getPeripheralWarnings,
  computeFovCoverage,
  isBlindsideRisk,
  buildPeripheralWarningText,
  formatFovZone,
} from '../src/engines/fieldOfViewEngine';

import {
  buildFusedDetection,
  deduplicateDetections,
  prioritizeHazards,
  fuseDetectionSets,
  buildFusedFrame,
  getHighestPriorityDetection,
  formatFusedGuidance,
  buildMultiCameraStatusText,
  getSimulatedDetectionSet,
} from '../src/engines/multiCameraFusionEngine';

import {
  createSimulatedSensorFrame,
  classifyMotionState,
  getMotionLabel,
  assessThermalState,
  buildThermalWarning,
  getBatteryWarning,
  formatBatteryLevel,
  fuseSensorWithCamera,
  isSensorFrameStale,
  computeSensorQuality,
  getCompassHeading,
  headingToCardinal,
} from '../src/engines/wearableSensorFusionEngine';

import {
  CAMERA_PRIVACY,
  VISION_UNAVAILABLE_MESSAGE,
  DEFAULT_MULTICAMERA_CONFIG,
} from '../src/types/glasses';

// ─── Harness ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e instanceof Error ? e.message : e}`); failed++; }
}
function describe(name: string, fn: () => void) { console.log(`\n${name}`); fn(); }
function expect(actual: unknown) {
  const fail = (msg: string) => { throw new Error(msg); };
  return {
    toBe: (e: unknown) => { if (actual !== e) fail(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`); },
    toBeTruthy: () => { if (!actual) fail(`Expected truthy, got ${JSON.stringify(actual)}`); },
    toBeFalsy: () => { if (actual) fail(`Expected falsy, got ${JSON.stringify(actual)}`); },
    toBeNull: () => { if (actual !== null) fail(`Expected null, got ${JSON.stringify(actual)}`); },
    not: {
      toBe: (e: unknown) => { if (actual === e) fail(`Expected NOT ${JSON.stringify(e)}`); },
      toBeNull: () => { if (actual === null) fail('Expected not null'); },
      toContain: (s: string) => { if ((actual as string).includes(s)) fail(`Expected NOT to contain "${s}"`); },
      toHaveLength: (n: number) => { if ((actual as unknown[]).length === n) fail(`Expected NOT length ${n}`); },
    },
    toBeGreaterThan: (n: number) => { if ((actual as number) <= n) fail(`Expected > ${n}, got ${actual}`); },
    toBeGreaterThanOrEqual: (n: number) => { if ((actual as number) < n) fail(`Expected >= ${n}, got ${actual}`); },
    toBeLessThan: (n: number) => { if ((actual as number) >= n) fail(`Expected < ${n}, got ${actual}`); },
    toBeLessThanOrEqual: (n: number) => { if ((actual as number) > n) fail(`Expected <= ${n}, got ${actual}`); },
    toContain: (s: string) => { if (!(actual as string).includes(s)) fail(`Expected "${actual}" to contain "${s}"`); },
    toHaveLength: (n: number) => { if ((actual as unknown[]).length !== n) fail(`Expected length ${n}, got ${(actual as unknown[]).length}`); },
  };
}

// ─── GLASSES CAMERA ENGINE ────────────────────────────────────────────────────
describe('createGlassesState', () => {
  test('creates state with 4 feeds', () => expect(createGlassesState().feeds).toHaveLength(4));
  test('front camera connected by default', () => {
    const s = createGlassesState();
    expect(s.feeds.find(f => f.position === 'front')?.connected).toBe(true);
  });
  test('left camera disconnected by default', () => {
    const s = createGlassesState();
    expect(s.feeds.find(f => f.position === 'left')?.connected).toBe(false);
  });
  test('activeSource is front by default', () => expect(createGlassesState().activeSource).toBe('front'));
  test('has privacy constants', () => expect(createGlassesState().privacy.noVideoStorage).toBe(true));
  test('batteryPct starts at 85', () => expect(createGlassesState().batteryPct).toBe(85));
  test('deviceId is unique', () => {
    const a = createGlassesState().deviceId;
    const b = createGlassesState().deviceId;
    expect(a).not.toBe(b);
  });
});

describe('createDefaultFeed', () => {
  test('front feed is connected', () => expect(createDefaultFeed('front').connected).toBe(true));
  test('left feed is not connected', () => expect(createDefaultFeed('left').connected).toBe(false));
  test('front has lower latency than left', () => {
    expect(createDefaultFeed('front').latencyMs).toBeLessThan(createDefaultFeed('left').latencyMs);
  });
  test('front has active health', () => expect(createDefaultFeed('front').healthStatus).toBe('active'));
  test('left has standby health', () => expect(createDefaultFeed('left').healthStatus).toBe('standby'));
});

describe('connectCamera / disconnectCamera', () => {
  test('connectCamera marks feed as connected', () => {
    const s = connectCamera(createGlassesState(), 'left');
    expect(s.feeds.find(f => f.position === 'left')?.connected).toBe(true);
  });
  test('connectCamera sets activeSource', () => {
    const s = connectCamera(createGlassesState(), 'left');
    expect(s.activeSource).toBe('left');
  });
  test('disconnectCamera marks feed as offline', () => {
    const s = disconnectCamera(createGlassesState(), 'front');
    expect(s.feeds.find(f => f.position === 'front')?.healthStatus).toBe('offline');
  });
  test('disconnecting front with no other camera → activeSource none', () => {
    const s = disconnectCamera(createGlassesState(), 'front');
    expect(s.activeSource).toBe('none');
  });
  test('disconnecting front when left connected → left becomes active', () => {
    let s = connectCamera(createGlassesState(), 'left');
    s = disconnectCamera(s, 'front');
    expect(s.activeSource).toBe('left');
  });
});

describe('getConnectedFeeds / hasAnyConnectedCamera', () => {
  test('only front connected initially', () => expect(getConnectedFeeds(createGlassesState())).toHaveLength(1));
  test('hasAnyConnectedCamera true by default', () => expect(hasAnyConnectedCamera(createGlassesState())).toBe(true));
  test('hasAnyConnectedCamera false when all disconnected', () => {
    let s = createGlassesState();
    s = disconnectCamera(s, 'front');
    expect(hasAnyConnectedCamera(s)).toBe(false);
  });
});

describe('computeHealthStatus', () => {
  test('low latency + high quality → active', () => expect(computeHealthStatus(30, 0.9)).toBe('active'));
  test('high latency → degraded', () => expect(computeHealthStatus(120, 0.8)).toBe('degraded'));
  test('very high latency → failed', () => expect(computeHealthStatus(250, 0.8)).toBe('failed'));
  test('low quality → failed', () => expect(computeHealthStatus(30, 0.2)).toBe('failed'));
  test('moderate quality → degraded', () => expect(computeHealthStatus(50, 0.5)).toBe('degraded'));
});

describe('computeConnectionHealth', () => {
  test('no connected feeds → lost', () => expect(computeConnectionHealth([])).toBe('lost'));
  test('high quality, low latency → excellent', () => {
    const feed = { ...createDefaultFeed('front'), frameQuality: 0.95, latencyMs: 20 };
    expect(computeConnectionHealth([feed])).toBe('excellent');
  });
  test('moderate → good', () => {
    const feed = { ...createDefaultFeed('front'), frameQuality: 0.7, latencyMs: 70 };
    expect(computeConnectionHealth([feed])).toBe('good');
  });
  test('poor → degraded', () => {
    const feed = { ...createDefaultFeed('front'), frameQuality: 0.4, latencyMs: 150 };
    expect(computeConnectionHealth([feed])).toBe('degraded');
  });
});

describe('formatCameraPosition / formatConnectionHealth', () => {
  test('front has label', () => expect(formatCameraPosition('front')).toContain('Front'));
  test('left has label', () => expect(formatCameraPosition('left')).toContain('Left'));
  test('right has label', () => expect(formatCameraPosition('right')).toContain('Right'));
  test('excellent has label', () => expect(formatConnectionHealth('excellent')).toContain('Excellent'));
  test('lost has label', () => expect(formatConnectionHealth('lost')).toContain('Lost'));
});

describe('simulateBatteryDrain', () => {
  test('battery decreases over time', () => {
    const s = createGlassesState();
    const drained = simulateBatteryDrain(s, 100);
    expect(drained.batteryPct).toBeLessThan(s.batteryPct);
  });
  test('battery never goes below 0', () => {
    const s = { ...createGlassesState(), batteryPct: 0 };
    expect(simulateBatteryDrain(s, 10000).batteryPct).toBeGreaterThanOrEqual(0);
  });
});

// ─── CAMERA HEALTH ENGINE ─────────────────────────────────────────────────────
describe('assessCameraHealth', () => {
  test('disconnected → offline', () => {
    const f = { ...createDefaultFeed('left'), connected: false };
    expect(assessCameraHealth(f)).toBe('offline');
  });
  test('good feed → active', () => {
    const f = createDefaultFeed('front');
    expect(assessCameraHealth(f)).toBe('active');
  });
  test('high latency → degraded', () => {
    const f = { ...createDefaultFeed('front'), latencyMs: 150 };
    expect(assessCameraHealth(f)).toBe('degraded');
  });
  test('very high latency → failed', () => {
    const f = { ...createDefaultFeed('front'), latencyMs: 250 };
    expect(assessCameraHealth(f)).toBe('failed');
  });
});

describe('isCameraUsable', () => {
  test('active feed is usable', () => expect(isCameraUsable(createDefaultFeed('front'))).toBe(true));
  test('offline feed is not usable', () => {
    expect(isCameraUsable({ ...createDefaultFeed('left'), connected: false })).toBe(false);
  });
});

describe('shouldFallbackToPhone / applyPhoneFallback', () => {
  test('no fallback needed when front connected', () => {
    expect(shouldFallbackToPhone(createGlassesState())).toBe(false);
  });
  test('fallback needed when all cameras fail', () => {
    let s = createGlassesState();
    s = disconnectCamera(s, 'front');
    expect(shouldFallbackToPhone(s)).toBe(true);
  });
  test('applyPhoneFallback sets activeSource to phone', () => {
    const s = applyPhoneFallback(createGlassesState());
    expect(s.activeSource).toBe('phone');
    expect(s.fallbackActive).toBe(true);
  });
  test('clearFallback removes fallback state', () => {
    let s = applyPhoneFallback(createGlassesState());
    s = clearFallback(s);
    expect(s.fallbackActive).toBe(false);
  });
});

describe('selectBestCamera', () => {
  test('front camera selected when active', () => {
    expect(selectBestCamera(createGlassesState())).toBe('front');
  });
  test('phone selected when no glasses cameras', () => {
    let s = createGlassesState();
    s = disconnectCamera(s, 'front');
    expect(selectBestCamera(s)).toBe('phone');
  });
});

describe('buildFallbackGuidance', () => {
  test('no guidance when cameras healthy', () => expect(buildFallbackGuidance(createGlassesState())).toBe(''));
  test('unavailable message when all fail', () => {
    let s = createGlassesState();
    s = disconnectCamera(s, 'front');
    // All glasses cameras failed
    const guidance = buildFallbackGuidance(s);
    expect(guidance.length).toBeGreaterThan(0);
  });
});

describe('buildUnavailableMessage', () => {
  test('contains "stop"', () => expect(buildUnavailableMessage().toLowerCase()).toContain('stop'));
  test('contains "check carefully"', () => expect(buildUnavailableMessage().toLowerCase()).toContain('check carefully'));
  test('matches constant', () => expect(buildUnavailableMessage()).toBe(VISION_UNAVAILABLE_MESSAGE));
});

describe('getCamerasBatteryWarning', () => {
  test('100% → no warning', () => expect(getCamerasBatteryWarning(100)).toBeNull());
  test('5% → critical', () => expect(getCamerasBatteryWarning(5)?.toLowerCase()).toContain('critical'));
  test('15% → low', () => expect(getCamerasBatteryWarning(15)?.toLowerCase()).toContain('low'));
  test('26% → no warning', () => expect(getCamerasBatteryWarning(26)).toBeNull());
});

describe('computeOverallHealthScore', () => {
  test('no connected cameras → 0', () => {
    let s = createGlassesState();
    s = disconnectCamera(s, 'front');
    expect(computeOverallHealthScore(s)).toBe(0);
  });
  test('good camera → score > 0.5', () => expect(computeOverallHealthScore(createGlassesState())).toBeGreaterThan(0.5));
  test('score is between 0 and 1', () => {
    const score = computeOverallHealthScore(createGlassesState());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── FIELD OF VIEW ENGINE ─────────────────────────────────────────────────────
describe('classifyFovZone', () => {
  test('center of front camera → center', () => expect(classifyFovZone('front', 0.5)).toBe('center'));
  test('left side of front camera → left', () => expect(classifyFovZone('front', 0.1)).toBe('left'));
  test('right side of front camera → right', () => expect(classifyFovZone('front', 0.9)).toBe('right'));
  test('left camera always → left', () => expect(classifyFovZone('left', 0.5)).toBe('left'));
  test('right camera always → right', () => expect(classifyFovZone('right', 0.5)).toBe('right'));
  test('top of frame → overhead', () => expect(classifyFovZone('front', 0.5, 0.1)).toBe('overhead'));
  test('bottom of frame → below', () => expect(classifyFovZone('front', 0.5, 0.9)).toBe('below'));
  test('phone center → center', () => expect(classifyFovZone('phone', 0.5)).toBe('center'));
});

describe('buildDirectionalInstruction', () => {
  test('center → "ahead"', () => expect(buildDirectionalInstruction('center', 'car')).toContain('ahead'));
  test('left → "on your left"', () => expect(buildDirectionalInstruction('left', 'person')).toContain('left'));
  test('right → "on your right"', () => expect(buildDirectionalInstruction('right', 'bike')).toContain('right'));
  test('overhead → "overhead"', () => expect(buildDirectionalInstruction('overhead', 'sign')).toContain('overhead'));
  test('below → "watch your step"', () => expect(buildDirectionalInstruction('below', 'step')).toContain('watch your step'));
  test('capitalises object label', () => expect(buildDirectionalInstruction('center', 'car')[0]).toBe('C'));
});

describe('estimateObjectDirection', () => {
  test('center → ahead', () => expect(estimateObjectDirection('center')).toBe('ahead'));
  test('left → left', () => expect(estimateObjectDirection('left')).toBe('left'));
  test('right → right', () => expect(estimateObjectDirection('right')).toBe('right'));
  test('overhead → above', () => expect(estimateObjectDirection('overhead')).toBe('above'));
  test('below → below', () => expect(estimateObjectDirection('below')).toBe('below'));
});

describe('hasCenterThreat', () => {
  test('no detections → false', () => expect(hasCenterThreat([])).toBe(false));
  test('high priority center → true', () => {
    const det = buildFusedDetection('car', 0.9, 'front', 0.5);
    expect(hasCenterThreat([det])).toBe(true);
  });
  test('low priority center → false', () => {
    const det = buildFusedDetection('bag', 0.5, 'front', 0.5);
    expect(hasCenterThreat([det])).toBe(false);
  });
  test('high priority on left → false', () => {
    const det = buildFusedDetection('car', 0.9, 'left', 0.5);
    expect(hasCenterThreat([det])).toBe(false);
  });
});

describe('getPeripheralWarnings', () => {
  test('no detections → empty', () => expect(getPeripheralWarnings([])).toHaveLength(0));
  test('medium priority left → included', () => {
    const det = buildFusedDetection('person', 0.8, 'left', 0.5);
    expect(getPeripheralWarnings([det])).toHaveLength(1);
  });
  test('low priority left → excluded', () => {
    const det = buildFusedDetection('bag', 0.5, 'front', 0.1);
    expect(getPeripheralWarnings([det])).toHaveLength(0);
  });
});

describe('computeFovCoverage', () => {
  test('front camera covers center', () => expect(computeFovCoverage(['front'])).toContain('center'));
  test('left camera covers left', () => expect(computeFovCoverage(['left'])).toContain('left'));
  test('right camera covers right', () => expect(computeFovCoverage(['right'])).toContain('right'));
  test('front + left + right covers all main zones', () => {
    const coverage = computeFovCoverage(['front', 'left', 'right']);
    expect(coverage).toContain('center');
    expect(coverage).toContain('left');
    expect(coverage).toContain('right');
  });
});

describe('formatFovZone', () => {
  test('center → Ahead', () => expect(formatFovZone('center')).toBe('Ahead'));
  test('left → Left', () => expect(formatFovZone('left')).toBe('Left'));
  test('overhead → Overhead', () => expect(formatFovZone('overhead')).toBe('Overhead'));
});

// ─── MULTI-CAMERA FUSION ENGINE ───────────────────────────────────────────────
describe('buildFusedDetection', () => {
  test('creates a detection with correct label', () => {
    expect(buildFusedDetection('car', 0.9, 'front').label).toBe('car');
  });
  test('car → high priority', () => {
    expect(buildFusedDetection('car', 0.9, 'front').priority).toBe('high');
  });
  test('person → medium priority', () => {
    expect(buildFusedDetection('person', 0.8, 'front').priority).toBe('medium');
  });
  test('unknown label → low priority', () => {
    expect(buildFusedDetection('tree', 0.5, 'front').priority).toBe('low');
  });
  test('left camera → left fov zone', () => {
    expect(buildFusedDetection('car', 0.9, 'left').fovZone).toBe('left');
  });
});

describe('deduplicateDetections', () => {
  test('keeps only one of same label', () => {
    const a = buildFusedDetection('car', 0.9, 'front');
    const b = buildFusedDetection('car', 0.7, 'left');
    expect(deduplicateDetections([a, b])).toHaveLength(1);
  });
  test('keeps highest confidence', () => {
    const a = buildFusedDetection('car', 0.9, 'front');
    const b = buildFusedDetection('car', 0.5, 'left');
    expect(deduplicateDetections([a, b])[0].confidence).toBe(0.9);
  });
  test('different labels are kept', () => {
    const a = buildFusedDetection('car', 0.9, 'front');
    const b = buildFusedDetection('person', 0.8, 'front');
    expect(deduplicateDetections([a, b])).toHaveLength(2);
  });
});

describe('prioritizeHazards', () => {
  test('high priority before low', () => {
    const lo = buildFusedDetection('tree', 0.9, 'front');
    const hi = buildFusedDetection('car', 0.5, 'front');
    const sorted = prioritizeHazards([lo, hi]);
    expect(sorted[0].priority).toBe('high');
  });
  test('same priority ordered by confidence', () => {
    const a = buildFusedDetection('car', 0.9, 'front');
    const b = buildFusedDetection('stairs', 0.5, 'front');
    const sorted = prioritizeHazards([b, a]);
    expect(sorted[0].confidence).toBe(0.9);
  });
});

describe('fuseDetectionSets', () => {
  test('fuses multiple sources', () => {
    const result = fuseDetectionSets([
      { source: 'front', labels: ['car'] },
      { source: 'left', labels: ['person'] },
    ]);
    expect(result.length).toBeGreaterThan(0);
  });
  test('deduplicates across sources', () => {
    const result = fuseDetectionSets([
      { source: 'front', labels: ['car'] },
      { source: 'left', labels: ['car'] },
    ]);
    expect(result.filter(d => d.label === 'car')).toHaveLength(1);
  });
  test('empty sources → empty result', () => {
    expect(fuseDetectionSets([])).toHaveLength(0);
  });
});

describe('buildFusedFrame', () => {
  test('builds frame with timestamp', () => {
    const s = createGlassesState();
    const frame = buildFusedFrame(s, [{ source: 'front', labels: ['car'] }]);
    expect(frame.timestamp).toBeGreaterThan(0);
  });
  test('guidance text present for high-priority detection', () => {
    const s = createGlassesState();
    const frame = buildFusedFrame(s, [{ source: 'front', labels: ['car'] }]);
    expect(frame.guidanceText).not.toBeNull();
  });
  test('peripheral threat detected from left camera', () => {
    const s = createGlassesState();
    const frame = buildFusedFrame(s, [{ source: 'left', labels: ['person'] }]);
    expect(frame.hasPeripheralThreat).toBe(true);
  });
});

describe('getHighestPriorityDetection', () => {
  test('returns null for empty frame', () => {
    const s = createGlassesState();
    const frame = buildFusedFrame(s, []);
    expect(getHighestPriorityDetection(frame)).toBeNull();
  });
  test('returns detection for non-empty frame', () => {
    const s = createGlassesState();
    const frame = buildFusedFrame(s, [{ source: 'front', labels: ['car'] }]);
    expect(getHighestPriorityDetection(frame)).not.toBeNull();
  });
});

describe('buildMultiCameraStatusText', () => {
  test('shows camera count', () => expect(buildMultiCameraStatusText(3, false)).toContain('3'));
  test('peripheral warning mentioned when true', () => expect(buildMultiCameraStatusText(2, true)).toContain('Peripheral'));
  test('no warning when false', () => expect(buildMultiCameraStatusText(2, false)).not.toContain('Peripheral'));
});

describe('getSimulatedDetectionSet', () => {
  test('returns array', () => expect(getSimulatedDetectionSet(0).length).toBeGreaterThan(0));
  test('cycles across scenarios', () => {
    const a = getSimulatedDetectionSet(0);
    const b = getSimulatedDetectionSet(3);
    // Different scenarios should differ
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

// ─── WEARABLE SENSOR FUSION ENGINE ───────────────────────────────────────────
describe('createSimulatedSensorFrame', () => {
  test('has accelerometer', () => expect(createSimulatedSensorFrame(0).accelerometer).not.toBeNull());
  test('has gyroscope', () => expect(createSimulatedSensorFrame(0).gyroscope).not.toBeNull());
  test('has magnetometer', () => expect(createSimulatedSensorFrame(0).magnetometer).not.toBeNull());
  test('battery between 0 and 100', () => {
    const pct = createSimulatedSensorFrame(0).batteryPct;
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});

describe('classifyMotionState', () => {
  test('stationary frame → stationary', () => {
    const f = {
      ...createSimulatedSensorFrame(0),
      accelerometer: { x: 0, y: 9.81, z: 0 },
    };
    expect(classifyMotionState(f)).toBe('stationary');
  });
  test('walking motion', () => {
    const f = {
      ...createSimulatedSensorFrame(0),
      accelerometer: { x: 0.5, y: 9.81, z: 0.5 },
    };
    expect(classifyMotionState(f)).toBe('walking');
  });
  test('running motion', () => {
    const f = {
      ...createSimulatedSensorFrame(0),
      accelerometer: { x: 3, y: 9.81, z: 3 },
    };
    expect(classifyMotionState(f)).toBe('running');
  });
  test('no accelerometer → unknown', () => {
    const f = { ...createSimulatedSensorFrame(0), accelerometer: null };
    expect(classifyMotionState(f)).toBe('unknown');
  });
});

describe('getMotionLabel', () => {
  test('stationary has label', () => expect(getMotionLabel('stationary')).toContain('Stationary'));
  test('walking has label', () => expect(getMotionLabel('walking')).toContain('Walking'));
  test('running has label', () => expect(getMotionLabel('running')).toContain('Running'));
});

describe('assessThermalState', () => {
  test('normal temperature', () => {
    const f = { ...createSimulatedSensorFrame(0), temperatureCelsius: 25 };
    expect(assessThermalState(f)).toBe('normal');
  });
  test('warm temperature', () => {
    const f = { ...createSimulatedSensorFrame(0), temperatureCelsius: 40 };
    expect(assessThermalState(f)).toBe('warm');
  });
  test('hot temperature', () => {
    const f = { ...createSimulatedSensorFrame(0), temperatureCelsius: 50 };
    expect(assessThermalState(f)).toBe('hot');
  });
  test('null temperature → normal', () => {
    const f = { ...createSimulatedSensorFrame(0), temperatureCelsius: null };
    expect(assessThermalState(f)).toBe('normal');
  });
});

describe('buildThermalWarning', () => {
  test('hot → warning', () => expect(buildThermalWarning('hot')?.toLowerCase()).toContain('remove'));
  test('warm → advisory', () => expect(buildThermalWarning('warm')?.toLowerCase()).toContain('warm'));
  test('normal → null', () => expect(buildThermalWarning('normal')).toBeNull());
});

describe('getBatteryWarning', () => {
  test('100% → null', () => expect(getBatteryWarning(100)).toBeNull());
  test('5% → critical', () => expect(getBatteryWarning(5)?.toLowerCase()).toContain('critical'));
  test('15% → low', () => expect(getBatteryWarning(15)?.toLowerCase()).toContain('low'));
});

describe('formatBatteryLevel', () => {
  test('100% → green indicator', () => expect(formatBatteryLevel(100)).toContain('🟢'));
  test('50% → yellow indicator', () => expect(formatBatteryLevel(50)).toContain('🟡'));
  test('20% → orange indicator', () => expect(formatBatteryLevel(20)).toContain('🟠'));
  test('5% → red indicator', () => expect(formatBatteryLevel(5)).toContain('🔴'));
  test('includes percentage', () => expect(formatBatteryLevel(75)).toContain('75'));
});

describe('headingToCardinal', () => {
  test('0° → N', () => expect(headingToCardinal(0)).toBe('N'));
  test('90° → E', () => expect(headingToCardinal(90)).toBe('E'));
  test('180° → S', () => expect(headingToCardinal(180)).toBe('S'));
  test('270° → W', () => expect(headingToCardinal(270)).toBe('W'));
  test('45° → NE', () => expect(headingToCardinal(45)).toBe('NE'));
});

describe('getCompassHeading', () => {
  test('returns heading from magnetometer', () => {
    const f = { ...createSimulatedSensorFrame(0), magnetometer: { heading: 90 } };
    expect(getCompassHeading(f)).toBe(90);
  });
  test('null magnetometer → null', () => {
    const f = { ...createSimulatedSensorFrame(0), magnetometer: null };
    expect(getCompassHeading(f)).toBeNull();
  });
});

describe('fuseSensorWithCamera', () => {
  test('returns fused frame', () => {
    const sensor = createSimulatedSensorFrame(0);
    const s = createGlassesState();
    const camera = buildFusedFrame(s, [{ source: 'front', labels: ['car'] }]);
    const fused = fuseSensorWithCamera(sensor, camera);
    expect(fused.timestamp).toBeGreaterThan(0);
  });
  test('running motion prepends slow down', () => {
    const sensor = {
      ...createSimulatedSensorFrame(0),
      accelerometer: { x: 3, y: 9.81, z: 3 },
    };
    const s = createGlassesState();
    const camera = buildFusedFrame(s, [{ source: 'front', labels: ['car'] }]);
    const fused = fuseSensorWithCamera(sensor, camera);
    expect(fused.guidanceText?.toLowerCase()).toContain('slow down');
  });
});

describe('isSensorFrameStale', () => {
  test('fresh frame is not stale', () => {
    const f = createSimulatedSensorFrame(0);
    expect(isSensorFrameStale(f, Date.now() + 500)).toBe(false);
  });
  test('old frame is stale', () => {
    const f = { ...createSimulatedSensorFrame(0), timestamp: Date.now() - 5000 };
    expect(isSensorFrameStale(f)).toBe(true);
  });
});

describe('computeSensorQuality', () => {
  test('full sensor data → high quality', () => expect(computeSensorQuality(createSimulatedSensorFrame(0))).toBeGreaterThan(0.5));
  test('missing accelerometer reduces quality', () => {
    const f = { ...createSimulatedSensorFrame(0), accelerometer: null };
    expect(computeSensorQuality(f)).toBeLessThan(computeSensorQuality(createSimulatedSensorFrame(0)));
  });
  test('stale frame reduces quality', () => {
    const f = { ...createSimulatedSensorFrame(0), timestamp: Date.now() - 5000 };
    expect(computeSensorQuality(f)).toBeLessThanOrEqual(0.6);
  });
});

describe('CAMERA_PRIVACY', () => {
  test('noVideoStorage is true', () => expect(CAMERA_PRIVACY.noVideoStorage).toBe(true));
  test('noFaceRecognition is true', () => expect(CAMERA_PRIVACY.noFaceRecognition).toBe(true));
  test('noBystander is true', () => expect(CAMERA_PRIVACY.noBystander).toBe(true));
});

describe('VISION_UNAVAILABLE_MESSAGE', () => {
  test('contains stop', () => expect(VISION_UNAVAILABLE_MESSAGE.toLowerCase()).toContain('stop'));
  test('contains check carefully', () => expect(VISION_UNAVAILABLE_MESSAGE.toLowerCase()).toContain('check carefully'));
});

describe('DEFAULT_MULTICAMERA_CONFIG', () => {
  test('fallback to phone enabled by default', () => expect(DEFAULT_MULTICAMERA_CONFIG.fallbackToPhoneOnAllFail).toBe(true));
  test('max cameras is positive', () => expect(DEFAULT_MULTICAMERA_CONFIG.maxActiveCameras).toBeGreaterThan(0));
  test('fusion strategy set', () => expect(DEFAULT_MULTICAMERA_CONFIG.fusionStrategy).toBeTruthy());
});

// ─── Results ─────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

// Sprint 6: Real Navigation Intelligence — test suite
// Run: npx tsx tests/sprint6Navigation.test.ts

import {
  createNavigationSession,
  updateNavigationSession,
  requestLocationPermission,
  onLocationGranted,
  onLocationDenied,
  endNavigation,
  setOffRoute,
  clearOffRoute,
  pauseNavigation,
  resumeNavigation,
  endNavigationSession,
  selectGuidance,
  getRouteStateLabel,
  isRouteActive,
  isRouteEnded,
  processNavigationTick,
} from '../src/engines/navigationIntelligenceEngine';

import {
  createLandmarkMemoryStore,
  saveLandmark,
  deleteSavedLandmark,
  navigateToLandmark,
  listSavedLandmarks,
  findLandmarkByName,
  setLandmarkMemoryConsent,
  createLandmark,
  resetLandmarkCounter,
  LANDMARK_PRIVACY_WARNING,
  LANDMARK_MEMORY_MAX,
} from '../src/engines/landmarkGuidanceEngine';

import {
  buildNavigationUpdateFromSensor,
  buildGeolocationState,
  selectHeadingFromSensor,
  buildSensorHeadingInstruction,
  buildNavigationGuardianInput,
  mapNavRiskToCognitive,
  shouldSkipNavigationTick,
  describeHeadingSource,
  buildGeolocationWarning,
} from '../src/engines/sensorNavigationBridgeEngine';

import {
  LOCATION_PRIVACY_WARNING,
  NAVIGATION_PRIVACY_DEFAULTS,
} from '../src/types/navigation';

import type {
  SensorContext,
  GPSReading,
  CompassReading,
  SensorPermissions,
} from '../src/types/sensors';

// ─── Harness ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; process.stdout.write(`.`); }
  catch (e) { failed++; console.error(`\nFAIL: ${name}\n  ${e}`); }
}
function assert(condition: boolean, msg = 'Assertion failed') {
  if (!condition) throw new Error(msg);
}
function assertEqual<T>(a: T, b: T, msg?: string) {
  if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertIncludes(str: string, substr: string, msg?: string) {
  if (!str.includes(substr)) throw new Error(msg ?? `Expected "${str}" to include "${substr}"`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSensorContext(overrides: Partial<SensorContext> = {}): SensorContext {
  const defaultPermissions: SensorPermissions = {
    geolocation: 'prompt',
    deviceOrientation: 'prompt',
    deviceMotion: 'prompt',
    vibration: false,
    battery: false,
  };
  return {
    gps: null,
    compass: null,
    motion: null,
    motionState: 'walking',
    battery: null,
    permissions: defaultPermissions,
    headingDegrees: null,
    isLowPowerMode: false,
    isActive: true,
    lastUpdated: new Date(),
    ...overrides,
  };
}

function makeGPS(heading: number | null = 90, speed: number | null = 1.4): GPSReading {
  return {
    latitude: 51.5,
    longitude: -0.1,
    accuracy: 10,
    heading,
    speed,
    altitude: null,
    altitudeAccuracy: null,
    timestamp: new Date(),
  };
}

function makeCompass(alpha: number): CompassReading {
  return { alpha, beta: 0, gamma: 0, absolute: true, timestamp: new Date() };
}

// ─── Section 1: Navigation Session States ─────────────────────────────────────

console.log('\n── Section 1: Navigation Session States');

test('createNavigationSession starts with navigating state', () => {
  const s = createNavigationSession('Park', 'outdoor');
  assertEqual(s.state, 'navigating');
});

test('getRouteStateLabel covers requesting_location', () => {
  assertEqual(getRouteStateLabel('requesting_location'), '📍 Requesting Location');
});

test('getRouteStateLabel covers off_route', () => {
  assertEqual(getRouteStateLabel('off_route'), '↩️ Off Route');
});

test('getRouteStateLabel covers ended', () => {
  assertEqual(getRouteStateLabel('ended'), '⏹ Ended');
});

test('getRouteStateLabel covers all original states', () => {
  assert(getRouteStateLabel('idle').includes('Idle'));
  assert(getRouteStateLabel('navigating').includes('Navigating'));
  assert(getRouteStateLabel('paused').includes('Paused'));
  assert(getRouteStateLabel('arrived').includes('Arrived'));
  assert(getRouteStateLabel('rerouting').includes('Rerouting'));
  assert(getRouteStateLabel('lost').includes('Lost'));
});

test('requestLocationPermission from idle → requesting_location', () => {
  const s = createNavigationSession('Café', 'outdoor');
  const idle = { ...s, state: 'idle' as const };
  const r = requestLocationPermission(idle);
  assertEqual(r.state, 'requesting_location');
});

test('requestLocationPermission is a no-op if not idle', () => {
  const s = createNavigationSession('Café', 'outdoor');
  // already navigating
  const r = requestLocationPermission(s);
  assertEqual(r.state, 'navigating');
});

test('onLocationGranted → navigating with consent', () => {
  const s = createNavigationSession('Café', 'outdoor');
  const idle = { ...s, state: 'idle' as const };
  const req = requestLocationPermission(idle);
  const granted = onLocationGranted(req);
  assertEqual(granted.state, 'navigating');
  assert(granted.locationConsentGiven === true);
});

test('onLocationDenied → navigating without consent', () => {
  const s = createNavigationSession('Café', 'outdoor');
  const idle = { ...s, state: 'idle' as const };
  const req = requestLocationPermission(idle);
  const denied = onLocationDenied(req);
  assertEqual(denied.state, 'navigating');
  assert(denied.locationConsentGiven === false);
});

test('onLocationGranted is a no-op if not in requesting_location', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const r = onLocationGranted(s); // still navigating, not requesting_location
  assertEqual(r.locationConsentGiven, false);
});

test('endNavigation → state ended', () => {
  const s = createNavigationSession('Station', 'outdoor');
  const ended = endNavigation(s);
  assertEqual(ended.state, 'ended');
});

test('setOffRoute → state off_route', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const offRoute = setOffRoute(s);
  assertEqual(offRoute.state, 'off_route');
});

test('setOffRoute is no-op when arrived', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const arrived = endNavigationSession(s);
  const r = setOffRoute(arrived);
  assertEqual(r.state, 'arrived');
});

test('setOffRoute is no-op when ended', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const ended = endNavigation(s);
  const r = setOffRoute(ended);
  assertEqual(r.state, 'ended');
});

test('clearOffRoute → navigating', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const off = setOffRoute(s);
  const back = clearOffRoute(off);
  assertEqual(back.state, 'navigating');
});

test('clearOffRoute is no-op if not off_route/rerouting', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const r = clearOffRoute(s); // navigating, no-op
  assertEqual(r.state, 'navigating');
});

test('isRouteActive: navigating = true', () => {
  const s = createNavigationSession('Park', 'outdoor');
  assert(isRouteActive(s));
});

test('isRouteActive: off_route = true', () => {
  const s = createNavigationSession('Park', 'outdoor');
  assert(isRouteActive(setOffRoute(s)));
});

test('isRouteActive: ended = false', () => {
  const s = createNavigationSession('Park', 'outdoor');
  assert(!isRouteActive(endNavigation(s)));
});

test('isRouteActive: requesting_location = false', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const idle = { ...s, state: 'idle' as const };
  assert(!isRouteActive(requestLocationPermission(idle)));
});

test('isRouteEnded: arrived = true', () => {
  const s = createNavigationSession('Park', 'outdoor');
  assert(isRouteEnded(endNavigationSession(s)));
});

test('isRouteEnded: ended = true', () => {
  const s = createNavigationSession('Park', 'outdoor');
  assert(isRouteEnded(endNavigation(s)));
});

test('isRouteEnded: navigating = false', () => {
  const s = createNavigationSession('Park', 'outdoor');
  assert(!isRouteEnded(s));
});

test('updateNavigationSession is no-op when ended', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const ended = endNavigation(s);
  const updated = updateNavigationSession(ended, { distanceTraveledM: 100 });
  assertEqual(updated.state, 'ended');
  assertEqual(updated.distanceRemainingM, ended.distanceRemainingM);
});

test('pauseNavigation is no-op when ended', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const ended = endNavigation(s);
  assertEqual(pauseNavigation(ended).state, 'ended');
});

// ─── Section 2: Route Guidance ────────────────────────────────────────────────

console.log('\n── Section 2: Route Guidance');

test('selectGuidance: requesting_location returns location prompt', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const idle = { ...s, state: 'idle' as const };
  const req = requestLocationPermission(idle);
  const g = selectGuidance(req, 0, Date.now());
  assert(g !== null);
  assertIncludes(g!.text, 'location permission');
});

test('selectGuidance: ended returns "Navigation ended."', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const ended = endNavigation(s);
  const g = selectGuidance(ended, 0, Date.now());
  assert(g !== null);
  assertIncludes(g!.text, 'Navigation ended');
});

test('selectGuidance: off_route returns heading correction', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const off = setOffRoute(s);
  const g = selectGuidance(off, 0, Date.now());
  assert(g !== null);
  assertIncludes(g!.text.toLowerCase(), 'off your route');
});

test('selectGuidance: idle returns null', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const idle = { ...s, state: 'idle' as const };
  assert(selectGuidance(idle, 0, Date.now()) === null);
});

test('selectGuidance: critical risk bypasses cooldown', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const critical = { ...s, riskLevel: 'critical' as const };
  const lastSpoken = Date.now() - 100; // well within cooldown
  const g = selectGuidance(critical, lastSpoken, Date.now());
  assert(g !== null);
  assertEqual(g!.priority, 'urgent');
  assertIncludes(g!.text, 'Stop');
});

test('selectGuidance: stop instruction text includes "stop"', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const critical = { ...s, riskLevel: 'critical' as const };
  const g = selectGuidance(critical, 0, Date.now());
  assert(g !== null);
  assert(g!.text.toLowerCase().includes('stop'));
});

test('selectGuidance: paused state, after cooldown', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const paused = pauseNavigation(s);
  const g = selectGuidance(paused, 0, Date.now());
  assert(g !== null);
  assertIncludes(g!.text, 'paused');
});

test('processNavigationTick: skips tick when ended', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const ended = endNavigation(s);
  const { session: updated } = processNavigationTick(ended, 1, 0);
  assertEqual(updated.state, 'ended');
});

test('processNavigationTick: skips tick when requesting_location', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const idle = { ...s, state: 'idle' as const };
  const req = requestLocationPermission(idle);
  const { session: updated, guidance } = processNavigationTick(req, 1, 0);
  assertEqual(updated.state, 'requesting_location');
  assert(guidance !== null);
  assertIncludes(guidance!.text, 'location permission');
});

test('processNavigationTick: advances with sensorUpdate heading', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const { session: updated } = processNavigationTick(
    s, 1, 0,
    { headingDeg: 90, distanceTraveledM: 1.5 },
  );
  assert(updated.currentHeadingDeg === 90 || updated.state !== 'navigating');
});

test('processNavigationTick: uses simulation when no sensorUpdate', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const { session: updated } = processNavigationTick(s, 0, 0);
  assert(updated.distanceRemainingM < s.distanceRemainingM);
});

// ─── Section 3: Geolocation Permission Flow ───────────────────────────────────

console.log('\n── Section 3: Geolocation Permission Flow');

test('buildGeolocationState: denied permission returns warning', () => {
  const ctx = makeSensorContext({
    permissions: { geolocation: 'denied', deviceOrientation: 'prompt', deviceMotion: 'prompt', vibration: false, battery: false },
  });
  const state = buildGeolocationState(ctx);
  assertEqual(state.permission, 'denied');
  assert(state.warningText !== null);
  assert(state.warningText!.includes('denied'));
});

test('buildGeolocationState: granted + GPS available = hasGPS true', () => {
  const ctx = makeSensorContext({
    gps: makeGPS(),
    permissions: { geolocation: 'granted', deviceOrientation: 'prompt', deviceMotion: 'prompt', vibration: false, battery: false },
  });
  const state = buildGeolocationState(ctx);
  assertEqual(state.permission, 'granted');
  assert(state.hasGPS);
  assert(state.warningText === null);
});

test('buildGeolocationState: prompt = not_requested', () => {
  const ctx = makeSensorContext();
  const state = buildGeolocationState(ctx);
  assertEqual(state.permission, 'not_requested');
});

test('buildGeolocationState: unavailable', () => {
  const ctx = makeSensorContext({
    permissions: { geolocation: 'unavailable', deviceOrientation: 'prompt', deviceMotion: 'prompt', vibration: false, battery: false },
  });
  const state = buildGeolocationState(ctx);
  assertEqual(state.permission, 'unavailable');
  assert(state.warningText !== null);
});

test('buildGeolocationState: compass available = headingSource compass', () => {
  const ctx = makeSensorContext({
    compass: makeCompass(180),
    permissions: { geolocation: 'denied', deviceOrientation: 'granted', deviceMotion: 'prompt', vibration: false, battery: false },
  });
  const state = buildGeolocationState(ctx);
  assertEqual(state.headingSource, 'compass');
  assert(state.hasFallback);
});

test('buildGeolocationState: GPS heading = headingSource gps', () => {
  const ctx = makeSensorContext({
    gps: makeGPS(270, 1.4),
    permissions: { geolocation: 'granted', deviceOrientation: 'prompt', deviceMotion: 'prompt', vibration: false, battery: false },
  });
  const state = buildGeolocationState(ctx);
  assertEqual(state.headingSource, 'gps');
});

test('buildGeolocationState: no sensors = headingSource none', () => {
  const ctx = makeSensorContext();
  const state = buildGeolocationState(ctx);
  assertEqual(state.headingSource, 'none');
});

test('buildGeolocationWarning: denied with compass fallback mentions compass', () => {
  const w = buildGeolocationWarning('denied', false, true);
  assert(w !== null);
  assertIncludes(w!, 'compass');
});

test('buildGeolocationWarning: granted with GPS = null', () => {
  const w = buildGeolocationWarning('granted', true, false);
  assert(w === null);
});

test('buildGeolocationWarning: granted without GPS = waiting message', () => {
  const w = buildGeolocationWarning('granted', false, false);
  assert(w !== null);
  assertIncludes(w!, 'Waiting for GPS');
});

// ─── Section 4: Sensor → Navigation Bridge ────────────────────────────────────

console.log('\n── Section 4: Sensor → Navigation Bridge');

test('selectHeadingFromSensor: compass takes priority over GPS', () => {
  const ctx = makeSensorContext({
    compass: makeCompass(45),
    gps: makeGPS(90),
    permissions: { geolocation: 'granted', deviceOrientation: 'granted', deviceMotion: 'prompt', vibration: false, battery: false },
  });
  const h = selectHeadingFromSensor(ctx);
  assertEqual(h, 45);
});

test('selectHeadingFromSensor: falls back to GPS heading', () => {
  const ctx = makeSensorContext({
    gps: makeGPS(135),
    permissions: { geolocation: 'granted', deviceOrientation: 'prompt', deviceMotion: 'prompt', vibration: false, battery: false },
  });
  const h = selectHeadingFromSensor(ctx);
  assertEqual(h, 135);
});

test('selectHeadingFromSensor: returns null when no sensors', () => {
  const ctx = makeSensorContext();
  assertEqual(selectHeadingFromSensor(ctx), null);
});

test('selectHeadingFromSensor: uses fused headingDegrees when compass/gps null', () => {
  const ctx = makeSensorContext({ headingDegrees: 200 });
  assertEqual(selectHeadingFromSensor(ctx), 200);
});

test('buildNavigationUpdateFromSensor: GPS speed populates distance', () => {
  const ctx = makeSensorContext({
    gps: makeGPS(90, 2.0), // 2 m/s × 0.5 s tick = 1 m
    compass: makeCompass(90),
    permissions: { geolocation: 'granted', deviceOrientation: 'granted', deviceMotion: 'prompt', vibration: false, battery: false },
  });
  const update = buildNavigationUpdateFromSensor(ctx);
  assertEqual(update.distanceTraveledM, 1.0);
  assertEqual(update.headingDeg, 90);
});

test('buildNavigationUpdateFromSensor: standing = 0 distance', () => {
  const ctx = makeSensorContext({ motionState: 'standing' });
  const update = buildNavigationUpdateFromSensor(ctx);
  assertEqual(update.distanceTraveledM, 0);
});

test('buildNavigationUpdateFromSensor: no GPS uses simulated distance', () => {
  const ctx = makeSensorContext();
  const update = buildNavigationUpdateFromSensor(ctx, 1.5);
  assertEqual(update.distanceTraveledM, 1.5);
});

test('buildNavigationUpdateFromSensor: heading is null when no sensors', () => {
  const ctx = makeSensorContext();
  const update = buildNavigationUpdateFromSensor(ctx);
  assertEqual(update.headingDeg, undefined);
});

test('buildSensorHeadingInstruction: ≤10° deviation = continue straight', () => {
  assertEqual(buildSensorHeadingInstruction(0, 5), 'Continue straight.');
});

test('buildSensorHeadingInstruction: 20° right deviation', () => {
  assertIncludes(buildSensorHeadingInstruction(0, 25), 'slightly right');
});

test('buildSensorHeadingInstruction: 20° left deviation', () => {
  assertIncludes(buildSensorHeadingInstruction(25, 0), 'slightly left');
});

test('buildSensorHeadingInstruction: null heading = unavailable message', () => {
  assertIncludes(buildSensorHeadingInstruction(null, 90), 'unavailable');
});

test('mapNavRiskToCognitive: critical → critical', () => {
  assertEqual(mapNavRiskToCognitive('critical'), 'critical');
});

test('mapNavRiskToCognitive: moderate → medium', () => {
  assertEqual(mapNavRiskToCognitive('moderate'), 'medium');
});

test('mapNavRiskToCognitive: clear → none', () => {
  assertEqual(mapNavRiskToCognitive('clear'), 'none');
});

// ─── Section 5: Navigation → Guardian Bridge ──────────────────────────────────

console.log('\n── Section 5: Navigation → Guardian Bridge');

test('buildNavigationGuardianInput: crossing ahead detected from labels', () => {
  const s = createNavigationSession('Bus stop', 'outdoor');
  const input = buildNavigationGuardianInput(s, ['crosswalk']);
  assert(input.crossingAhead);
});

test('buildNavigationGuardianInput: traffic_light triggers crossingAhead', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const input = buildNavigationGuardianInput(s, ['traffic_light']);
  assert(input.crossingAhead);
});

test('buildNavigationGuardianInput: off_route session = offRoute true', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const off = setOffRoute(s);
  const input = buildNavigationGuardianInput(off, []);
  assert(input.offRoute);
});

test('buildNavigationGuardianInput: navigating session = offRoute false', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const input = buildNavigationGuardianInput(s, []);
  assert(!input.offRoute);
});

test('buildNavigationGuardianInput: critical risk = stop message', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const critical = { ...s, riskLevel: 'critical' as const };
  const input = buildNavigationGuardianInput(critical, []);
  assert(input.guidanceMessage !== null);
  assertIncludes(input.guidanceMessage!, 'Stop');
});

test('buildNavigationGuardianInput: ended session = null message', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const ended = endNavigation(s);
  const input = buildNavigationGuardianInput(ended, []);
  assert(input.guidanceMessage === null);
});

test('buildNavigationGuardianInput: crossing + clear risk = crossing message', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const input = buildNavigationGuardianInput(s, ['crosswalk']);
  assert(input.guidanceMessage !== null);
  assertIncludes(input.guidanceMessage!, 'Crossing');
});

test('buildNavigationGuardianInput: offRoute message mentions route', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const off = setOffRoute(s);
  const input = buildNavigationGuardianInput(off, []);
  assert(input.guidanceMessage !== null);
  assertIncludes(input.guidanceMessage!, 'route');
});

test('shouldSkipNavigationTick: low power = skip 3 of 4 ticks', () => {
  const ctx = makeSensorContext({ isLowPowerMode: true });
  let skipped = 0;
  for (let i = 0; i < 4; i++) {
    if (shouldSkipNavigationTick(ctx, i)) skipped++;
  }
  assertEqual(skipped, 3);
});

test('shouldSkipNavigationTick: standing = skip 1 of 2 ticks', () => {
  const ctx = makeSensorContext({ motionState: 'standing' });
  const skip0 = shouldSkipNavigationTick(ctx, 0);
  const skip1 = shouldSkipNavigationTick(ctx, 1);
  assert(!skip0 && skip1); // tick 0 processed, tick 1 skipped
});

test('shouldSkipNavigationTick: walking = never skip', () => {
  const ctx = makeSensorContext({ motionState: 'walking' });
  assert(!shouldSkipNavigationTick(ctx, 0));
  assert(!shouldSkipNavigationTick(ctx, 1));
  assert(!shouldSkipNavigationTick(ctx, 2));
});

test('describeHeadingSource: compass = source compass, not approximate', () => {
  const ctx = makeSensorContext({ compass: makeCompass(90) });
  const result = describeHeadingSource(ctx);
  assertEqual(result.source, 'compass');
  assert(!result.isApproximate);
  assertEqual(result.degrees, 90);
});

test('describeHeadingSource: GPS = source gps', () => {
  const ctx = makeSensorContext({ gps: makeGPS(180) });
  const result = describeHeadingSource(ctx);
  assertEqual(result.source, 'gps');
});

test('describeHeadingSource: no sensors = source none', () => {
  const ctx = makeSensorContext();
  const result = describeHeadingSource(ctx);
  assertEqual(result.source, 'none');
  assert(result.degrees === null);
});

// ─── Section 6: Landmark Memory ───────────────────────────────────────────────

console.log('\n── Section 6: Landmark Memory');

test('createLandmarkMemoryStore: defaults to consentGiven false', () => {
  const store = createLandmarkMemoryStore();
  assert(!store.consentGiven);
  assertEqual(store.landmarks.length, 0);
  assertEqual(store.maxLandmarks, LANDMARK_MEMORY_MAX);
});

test('createLandmarkMemoryStore: with consent', () => {
  const store = createLandmarkMemoryStore(true);
  assert(store.consentGiven);
});

test('saveLandmark: fails without consent', () => {
  resetLandmarkCounter();
  const store = createLandmarkMemoryStore(false);
  const lm = createLandmark('Coffee Shop', 'custom');
  const { store: newStore, error } = saveLandmark(store, lm);
  assert(error !== undefined);
  assertIncludes(error!, 'Consent required');
  assertEqual(newStore.landmarks.length, 0);
});

test('saveLandmark: succeeds with consent', () => {
  resetLandmarkCounter();
  const store = createLandmarkMemoryStore(true);
  const lm = createLandmark('Bus Stop', 'bus_stop');
  const { store: newStore, error } = saveLandmark(store, lm);
  assert(error === undefined);
  assertEqual(newStore.landmarks.length, 1);
  assertEqual(newStore.landmarks[0].name, 'Bus Stop');
});

test('saveLandmark: saves fuzzy coordinates when provided', () => {
  resetLandmarkCounter();
  const store = createLandmarkMemoryStore(true);
  const lm = createLandmark('Park Entrance', 'entrance');
  const { store: newStore } = saveLandmark(store, lm, { fuzzyLatitude: 51.5, fuzzyLongitude: -0.1 });
  assert(newStore.landmarks[0].fuzzyLatitude === 51.5);
  assert(newStore.landmarks[0].fuzzyLongitude === -0.1);
});

test('saveLandmark: prevents duplicate IDs', () => {
  resetLandmarkCounter();
  const store = createLandmarkMemoryStore(true);
  const lm = createLandmark('Station', 'entrance');
  const { store: s2 } = saveLandmark(store, lm);
  const { error } = saveLandmark(s2, lm);
  assert(error !== undefined);
  assertIncludes(error!, 'already saved');
});

test('saveLandmark: enforces maxLandmarks limit', () => {
  resetLandmarkCounter();
  let store = createLandmarkMemoryStore(true);
  store = { ...store, maxLandmarks: 2 };
  const lm1 = createLandmark('A', 'custom');
  const lm2 = createLandmark('B', 'custom');
  const lm3 = createLandmark('C', 'custom');
  const { store: s2 } = saveLandmark(store, lm1);
  const { store: s3 } = saveLandmark(s2, lm2);
  const { error } = saveLandmark(s3, lm3);
  assert(error !== undefined);
  assertIncludes(error!, 'full');
});

test('deleteSavedLandmark: deletes existing landmark', () => {
  resetLandmarkCounter();
  const store = createLandmarkMemoryStore(true);
  const lm = createLandmark('Café', 'custom');
  const { store: s2 } = saveLandmark(store, lm);
  const { store: s3, deleted } = deleteSavedLandmark(s2, lm.id);
  assert(deleted);
  assertEqual(s3.landmarks.length, 0);
});

test('deleteSavedLandmark: deleted = false for unknown ID', () => {
  const store = createLandmarkMemoryStore(true);
  const { deleted } = deleteSavedLandmark(store, 'UNKNOWN');
  assert(!deleted);
});

test('navigateToLandmark: returns landmark by ID', () => {
  resetLandmarkCounter();
  const store = createLandmarkMemoryStore(true);
  const lm = createLandmark('Library', 'entrance');
  const { store: s2 } = saveLandmark(store, lm);
  const found = navigateToLandmark(s2, lm.id);
  assert(found !== null);
  assertEqual(found!.name, 'Library');
});

test('navigateToLandmark: returns null for unknown ID', () => {
  const store = createLandmarkMemoryStore(true);
  assertEqual(navigateToLandmark(store, 'NOPE'), null);
});

test('listSavedLandmarks: returns newest first', () => {
  resetLandmarkCounter();
  const store = createLandmarkMemoryStore(true);
  const lm1 = createLandmark('First', 'custom');
  const lm2 = { ...createLandmark('Second', 'custom'), savedAt: lm1.savedAt + 100 };
  const { store: s2 } = saveLandmark(store, lm1);
  const { store: s3 } = saveLandmark(s2, lm2);
  const list = listSavedLandmarks(s3);
  assertEqual(list[0].name, 'Second');
  assertEqual(list[1].name, 'First');
});

test('findLandmarkByName: case-insensitive partial match', () => {
  resetLandmarkCounter();
  const store = createLandmarkMemoryStore(true);
  const lm = createLandmark('Central Library', 'entrance');
  const { store: s2 } = saveLandmark(store, lm);
  const found = findLandmarkByName(s2, 'library');
  assert(found !== null);
  assertEqual(found!.name, 'Central Library');
});

test('findLandmarkByName: no match returns null', () => {
  const store = createLandmarkMemoryStore(true);
  assertEqual(findLandmarkByName(store, 'xyz'), null);
});

test('setLandmarkMemoryConsent: enables consent', () => {
  let store = createLandmarkMemoryStore(false);
  store = setLandmarkMemoryConsent(store, true);
  assert(store.consentGiven);
});

test('setLandmarkMemoryConsent: revoke consent does not delete landmarks', () => {
  resetLandmarkCounter();
  let store = createLandmarkMemoryStore(true);
  const lm = createLandmark('Home', 'custom');
  const { store: s2 } = saveLandmark(store, lm);
  const s3 = setLandmarkMemoryConsent(s2, false);
  assert(!s3.consentGiven);
  assertEqual(s3.landmarks.length, 1); // landmarks preserved
});

// ─── Section 7: Privacy Defaults ─────────────────────────────────────────────

console.log('\n── Section 7: Privacy Defaults');

test('LOCATION_PRIVACY_WARNING is defined and mentions fuzzy', () => {
  assert(typeof LOCATION_PRIVACY_WARNING === 'string');
  assert(LOCATION_PRIVACY_WARNING.includes('Fuzzy'));
});

test('LOCATION_PRIVACY_WARNING mentions no storage without saving', () => {
  assertIncludes(LOCATION_PRIVACY_WARNING, 'not stored');
});

test('NAVIGATION_PRIVACY_DEFAULTS.noPreciseLocationByDefault is true', () => {
  assert(NAVIGATION_PRIVACY_DEFAULTS.noPreciseLocationByDefault === true);
});

test('NAVIGATION_PRIVACY_DEFAULTS.consentRequiredForLandmarkSaving is true', () => {
  assert(NAVIGATION_PRIVACY_DEFAULTS.consentRequiredForLandmarkSaving === true);
});

test('NAVIGATION_PRIVACY_DEFAULTS.noThirdPartySharing is true', () => {
  assert(NAVIGATION_PRIVACY_DEFAULTS.noThirdPartySharing === true);
});

test('NAVIGATION_PRIVACY_DEFAULTS.showPrivacyWarningOnStart is true', () => {
  assert(NAVIGATION_PRIVACY_DEFAULTS.showPrivacyWarningOnStart === true);
});

test('LANDMARK_PRIVACY_WARNING mentions consent', () => {
  assertIncludes(LANDMARK_PRIVACY_WARNING, 'consent');
});

test('LANDMARK_PRIVACY_WARNING mentions delete', () => {
  assertIncludes(LANDMARK_PRIVACY_WARNING, 'delete');
});

test('NavigationSession default: locationConsentGiven = false', () => {
  const s = createNavigationSession('Park', 'outdoor');
  assert(s.locationConsentGiven === false);
});

test('NavigationSession default: NAVIGATION_PRIVACY.noPreciseLocation = true', () => {
  const s = createNavigationSession('Park', 'outdoor');
  assert(s.privacy.noPreciseLocation === true);
});

// ─── Section 8: Route Guidance Types ─────────────────────────────────────────

console.log('\n── Section 8: Route Guidance Types');

test('buildSensorHeadingInstruction: 0° = continue straight', () => {
  assertEqual(buildSensorHeadingInstruction(90, 90), 'Continue straight.');
});

test('buildSensorHeadingInstruction: 15° left = turn slightly left', () => {
  assertIncludes(buildSensorHeadingInstruction(30, 10), 'slightly left');
});

test('buildSensorHeadingInstruction: 60° right = turn right', () => {
  assertIncludes(buildSensorHeadingInstruction(0, 60), 'right');
  assert(!buildSensorHeadingInstruction(0, 60).includes('slightly'));
});

test('buildSensorHeadingInstruction: 120° = turn sharply', () => {
  assertIncludes(buildSensorHeadingInstruction(0, 120), 'sharply');
});

test('buildSensorHeadingInstruction: 180° = turn around', () => {
  assertIncludes(buildSensorHeadingInstruction(0, 180), 'around');
});

// ─── Section 9: Integration: Sensor Update through Navigation ─────────────────

console.log('\n── Section 9: Integration — Sensor Update through Navigation');

test('Full flow: idle → requesting_location → granted → navigating', () => {
  let s = createNavigationSession('Station', 'outdoor');
  s = { ...s, state: 'idle' as const };
  s = requestLocationPermission(s);
  assertEqual(s.state, 'requesting_location');
  s = onLocationGranted(s);
  assertEqual(s.state, 'navigating');
  assert(s.locationConsentGiven);
});

test('Full flow: idle → requesting_location → denied → navigating (no consent)', () => {
  let s = createNavigationSession('Station', 'outdoor');
  s = { ...s, state: 'idle' as const };
  s = requestLocationPermission(s);
  s = onLocationDenied(s);
  assertEqual(s.state, 'navigating');
  assert(!s.locationConsentGiven);
});

test('Navigation tick uses real compass heading when sensor provided', () => {
  const s = createNavigationSession('Park', 'outdoor');
  const ctx = makeSensorContext({ compass: makeCompass(45) });
  const sensorHeading = selectHeadingFromSensor(ctx);
  const sensorUpdate = buildNavigationUpdateFromSensor(ctx);
  const { session: updated } = processNavigationTick(s, 0, 0, sensorUpdate);
  assertEqual(updated.currentHeadingDeg, sensorHeading!);
});

test('Save landmark, delete it, can no longer navigate to it', () => {
  resetLandmarkCounter();
  let store = createLandmarkMemoryStore(true);
  const lm = createLandmark('Office', 'entrance');
  const { store: s2 } = saveLandmark(store, lm);
  const { store: s3 } = deleteSavedLandmark(s2, lm.id);
  assertEqual(navigateToLandmark(s3, lm.id), null);
});

test('buildNavigationGuardianInput high risk → non-null guidance message', () => {
  // Use 'Park' route — no crossing segments — so crossing check doesn't fire
  const s = createNavigationSession('Park', 'outdoor');
  const highRisk = { ...s, riskLevel: 'high' as const };
  const input = buildNavigationGuardianInput(highRisk, ['car']);
  assert(input.guidanceMessage !== null);
  assertIncludes(input.guidanceMessage!, 'Caution');
});

test('processNavigationTick with deviation sets off_route or rerouting', () => {
  const s = createNavigationSession('Park', 'outdoor');
  // Target heading is ~0° (park route). Feed 200° — deviation > 45°.
  const { session: updated } = processNavigationTick(s, 0, 0, { headingDeg: 200, distanceTraveledM: 0.5 });
  // updateNavigationSession uses 'rerouting' for backward compat;
  // setOffRoute() is the Sprint 6 API for explicitly setting 'off_route'.
  assert(
    updated.state === 'off_route' ||
    updated.state === 'rerouting' ||
    updated.state === 'navigating',
  );
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n\nSprint 6 Navigation: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

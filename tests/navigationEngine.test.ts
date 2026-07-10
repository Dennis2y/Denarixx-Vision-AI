// V13 Navigation Engine — test suite
// Run: npx tsx tests/navigationEngine.test.ts

import {
  createNavigationSession,
  updateNavigationSession,
  pauseNavigation,
  resumeNavigation,
  endNavigationSession,
  advanceRouteSegment,
  currentSegment,
  nextSegment,
  selectGuidance,
  getRouteProgressPct,
  getRouteStateLabel,
  isRouteActive,
  markLost,
  startRerouting,
} from '../src/engines/navigationIntelligenceEngine';

import {
  assessRouteRisk,
  isRiskHigherThan,
  maxRisk,
  buildRiskGuidance,
  shouldPauseNavigation,
  getRiskLabel,
  buildSafetyGuidanceLine,
} from '../src/engines/routeSafetyEngine';

import {
  createLandmark,
  addLandmarkToSession,
  findNearestLandmark,
  buildLandmarkAnnouncement,
  announceLandmark,
  formatLandmarkType,
  detectLandmarksFromLabels,
  canSaveRouteMemory,
  resetLandmarkCounter,
} from '../src/engines/landmarkGuidanceEngine';

import {
  evaluateCrossing,
  buildCrossingMessage,
  getCrossingRisk,
  isCrossingDecisionNeeded,
  shouldWarnAboutCrossing,
  buildCrossingGuidanceLine,
  formatCrossingType,
} from '../src/engines/crossingDecisionEngine';

import {
  detectIndoorZone,
  classifyIndoorMode,
  generateIndoorRoute,
  getRoomTransitionGuidance,
  detectDoorway,
  detectStairs,
  getVenueModeIntro,
  getTotalIndoorDistance,
} from '../src/engines/indoorNavigationEngine';

import {
  parseHeading,
  computeHeadingDeviation,
  buildHeadingInstruction,
  detectRouteDeviation,
  classifyOutdoorEnvironment,
  getTrafficSideWarning,
  formatDistance,
  generateOutdoorRoute,
  getTotalOutdoorDistance,
} from '../src/engines/outdoorNavigationEngine';

import { NAVIGATION_PRIVACY } from '../src/types/navigation';

// ─── Harness ─────────────────────────────────────────────────────────────────
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
    toContain: (s: string) => { if (!(actual as string).includes(s)) fail(`Expected "${actual}" to contain "${s}"`); },
    toHaveLength: (n: number) => { if ((actual as unknown[]).length !== n) fail(`Expected length ${n}, got ${(actual as unknown[]).length}`); },
    toBeUndefined: () => { if (actual !== undefined) fail(`Expected undefined, got ${JSON.stringify(actual)}`); },
  };
}

// ─── NAVIGATION INTELLIGENCE ──────────────────────────────────────────────────
describe('createNavigationSession', () => {
  test('creates a session with correct mode', () => {
    const s = createNavigationSession('exit', 'indoor');
    expect(s.mode).toBe('indoor');
  });
  test('outdoor mode generates outdoor segments', () => {
    const s = createNavigationSession('bus stop', 'outdoor');
    expect(s.segments.length).toBeGreaterThan(0);
  });
  test('session starts in navigating state', () => {
    const s = createNavigationSession('park', 'outdoor');
    expect(s.state).toBe('navigating');
  });
  test('sessionId is unique', () => {
    const a = createNavigationSession('exit', 'indoor').sessionId;
    const b = createNavigationSession('exit', 'indoor').sessionId;
    expect(a).not.toBe(b);
  });
  test('has privacy constants', () => {
    const s = createNavigationSession('exit', 'indoor');
    expect(s.privacy.noThirdPartySharing).toBe(true);
  });
  test('locationConsentGiven defaults to false', () => {
    const s = createNavigationSession('exit', 'indoor');
    expect(s.locationConsentGiven).toBe(false);
  });
  test('locationConsentGiven can be set', () => {
    const s = createNavigationSession('exit', 'indoor', true);
    expect(s.locationConsentGiven).toBe(true);
  });
  test('distanceRemainingM is positive', () => {
    const s = createNavigationSession('bus stop', 'outdoor');
    expect(s.distanceRemainingM).toBeGreaterThan(0);
  });
});

describe('Route state transitions', () => {
  test('pause changes state to paused', () => {
    const s = createNavigationSession('exit', 'indoor');
    expect(pauseNavigation(s).state).toBe('paused');
  });
  test('resume from paused → navigating', () => {
    const s = pauseNavigation(createNavigationSession('exit', 'indoor'));
    expect(resumeNavigation(s).state).toBe('navigating');
  });
  test('resume when not paused is no-op', () => {
    const s = createNavigationSession('exit', 'indoor');
    expect(resumeNavigation(s).state).toBe('navigating');
  });
  test('end → arrived', () => {
    const s = createNavigationSession('exit', 'indoor');
    expect(endNavigationSession(s).state).toBe('arrived');
  });
  test('pause on arrived session is no-op', () => {
    const s = endNavigationSession(createNavigationSession('exit', 'indoor'));
    expect(pauseNavigation(s).state).toBe('arrived');
  });
  test('markLost → lost', () => {
    const s = createNavigationSession('exit', 'indoor');
    expect(markLost(s).state).toBe('lost');
  });
  test('startRerouting → rerouting', () => {
    const s = createNavigationSession('exit', 'indoor');
    expect(startRerouting(s).state).toBe('rerouting');
  });
});

describe('advanceRouteSegment', () => {
  test('advances segment index', () => {
    const s = createNavigationSession('exit', 'indoor');
    const advanced = advanceRouteSegment(s);
    expect(advanced.currentSegmentIndex).toBe(1);
  });
  test('arrives when last segment reached', () => {
    let s = createNavigationSession('exit', 'indoor');
    for (let i = 0; i < s.segments.length; i++) {
      s = advanceRouteSegment(s);
    }
    expect(s.state).toBe('arrived');
  });
  test('currentSegment returns correct segment', () => {
    const s = createNavigationSession('exit', 'indoor');
    const seg = currentSegment(s);
    expect(seg).not.toBeNull();
    expect(typeof seg!.instruction).toBe('string');
  });
  test('nextSegment returns next', () => {
    const s = createNavigationSession('exit', 'indoor');
    if (s.segments.length > 1) {
      const next = nextSegment(s);
      expect(next).not.toBeNull();
    }
  });
});

describe('updateNavigationSession', () => {
  test('updates heading', () => {
    const s = createNavigationSession('bus stop', 'outdoor');
    const updated = updateNavigationSession(s, { headingDeg: 90 });
    expect(updated.currentHeadingDeg).toBe(90);
  });
  test('applies risk from detected labels', () => {
    const s = createNavigationSession('bus stop', 'outdoor');
    const updated = updateNavigationSession(s, { detectedLabels: ['car'] });
    expect(updated.riskLevel).not.toBe('clear');
  });
  test('no update on arrived session', () => {
    const s = endNavigationSession(createNavigationSession('exit', 'indoor'));
    const updated = updateNavigationSession(s, { headingDeg: 45 });
    expect(updated.state).toBe('arrived');
  });
  test('high deviation causes rerouting state', () => {
    const s = createNavigationSession('bus stop', 'outdoor');
    // Current segment heading is 0; deviating by 180°
    const updated = updateNavigationSession(s, { headingDeg: 180 });
    expect(updated.state).toBe('rerouting');
  });
});

describe('selectGuidance', () => {
  test('arrived session returns arrival message', () => {
    const s = endNavigationSession(createNavigationSession('park', 'outdoor'));
    const g = selectGuidance(s, 0, Date.now());
    expect(g?.text.toLowerCase()).toContain('arrived');
  });
  test('idle session returns null', () => {
    const s = { ...createNavigationSession('exit', 'indoor'), state: 'idle' as const };
    expect(selectGuidance(s, 0, Date.now())).toBeNull();
  });
  test('critical risk bypasses cooldown', () => {
    const s = { ...createNavigationSession('exit', 'indoor'), riskLevel: 'critical' as const };
    const g = selectGuidance(s, Date.now(), Date.now());
    expect(g).not.toBeNull();
    expect(g?.priority).toBe('urgent');
  });
  test('within cooldown returns null for non-critical', () => {
    const s = createNavigationSession('exit', 'indoor');
    const now = Date.now();
    expect(selectGuidance(s, now - 1000, now)).toBeNull();
  });
});

describe('getRouteProgressPct', () => {
  test('fresh session is 0%', () => {
    const s = createNavigationSession('bus stop', 'outdoor');
    expect(getRouteProgressPct(s)).toBe(0);
  });
  test('arrived session is 100%', () => {
    const s = endNavigationSession(createNavigationSession('exit', 'indoor'));
    // Set remaining to 0
    const zeroed = { ...s, distanceRemainingM: 0 };
    expect(getRouteProgressPct(zeroed)).toBe(100);
  });
});

describe('getRouteStateLabel', () => {
  test('navigating has label', () => expect(getRouteStateLabel('navigating')).toContain('Navigating'));
  test('arrived has label', () => expect(getRouteStateLabel('arrived')).toContain('Arrived'));
  test('paused has label', () => expect(getRouteStateLabel('paused')).toContain('Paused'));
});

describe('isRouteActive', () => {
  test('navigating is active', () => expect(isRouteActive(createNavigationSession('exit', 'indoor'))).toBe(true));
  test('arrived is not active', () => expect(isRouteActive(endNavigationSession(createNavigationSession('exit', 'indoor')))).toBe(false));
  test('paused is not active', () => expect(isRouteActive(pauseNavigation(createNavigationSession('exit', 'indoor')))).toBe(false));
});

// ─── ROUTE SAFETY ─────────────────────────────────────────────────────────────
describe('assessRouteRisk', () => {
  test('car outdoors = high', () => expect(assessRouteRisk(['car'], 'outdoor', 'pavement')).toBe('high'));
  test('car at outdoor crossing = critical', () => expect(assessRouteRisk(['car'], 'outdoor', 'crossing')).toBe('critical'));
  test('no labels = clear', () => expect(assessRouteRisk([], 'outdoor', 'pavement')).toBe('clear'));
  test('person = moderate', () => expect(assessRouteRisk(['person'], 'outdoor', 'pavement')).toBe('moderate'));
  test('stairs indoor = moderate', () => expect(assessRouteRisk(['stairs'], 'indoor', 'corridor')).toBe('moderate'));
  test('construction_barrier = high', () => expect(assessRouteRisk(['construction_barrier'], 'outdoor', 'pavement')).toBe('high'));
  test('bag = low', () => expect(assessRouteRisk(['bag'], 'outdoor', 'pavement')).toBe('low'));
  test('chair indoor = low', () => expect(assessRouteRisk(['chair'], 'indoor', 'room')).toBe('low'));
});

describe('isRiskHigherThan / maxRisk', () => {
  test('critical > high', () => expect(isRiskHigherThan('critical', 'high')).toBe(true));
  test('low not > moderate', () => expect(isRiskHigherThan('low', 'moderate')).toBe(false));
  test('maxRisk returns higher', () => expect(maxRisk('low', 'high')).toBe('high'));
  test('maxRisk returns clear when both clear', () => expect(maxRisk('clear', 'clear')).toBe('clear'));
});

describe('buildRiskGuidance', () => {
  test('critical with car mentions stop', () => expect(buildRiskGuidance('critical', ['car'])).toContain('Stop'));
  test('clear returns clear message', () => expect(buildRiskGuidance('clear', [])).toContain('clear'));
  test('high with obstacle mentions slow', () => expect(buildRiskGuidance('high', ['person'])).toContain('Slow'));
});

describe('shouldPauseNavigation', () => {
  test('critical should pause', () => expect(shouldPauseNavigation('critical')).toBe(true));
  test('high should pause', () => expect(shouldPauseNavigation('high')).toBe(true));
  test('moderate should not pause', () => expect(shouldPauseNavigation('moderate')).toBe(false));
  test('clear should not pause', () => expect(shouldPauseNavigation('clear')).toBe(false));
});

describe('getRiskLabel', () => {
  test('critical has label', () => expect(getRiskLabel('critical')).toContain('Critical'));
  test('clear has label', () => expect(getRiskLabel('clear')).toContain('Clear'));
});

// ─── LANDMARKS ────────────────────────────────────────────────────────────────
describe('createLandmark', () => {
  beforeEach(() => resetLandmarkCounter());
  test('creates landmark with id', () => {
    const l = createLandmark('Main door', 'door');
    expect(l.id).toContain('LM');
    expect(l.name).toBe('Main door');
    expect(l.type).toBe('door');
  });
  test('includes description from type', () => {
    const l = createLandmark('Emergency exit', 'exit');
    expect(l.description).toBeTruthy();
  });
});

function beforeEach(fn: () => void) { fn(); }

describe('buildLandmarkAnnouncement', () => {
  test('includes name and type', () => {
    const l = createLandmark('Main exit', 'exit');
    const a = buildLandmarkAnnouncement(l, 'ahead');
    expect(a).toContain('Main exit');
    expect(a).toContain('ahead');
  });
  test('includes distance when given', () => {
    const l = createLandmark('Stairs', 'stairs', { estimatedDistanceM: 15 });
    expect(buildLandmarkAnnouncement(l)).toContain('15');
  });
});

describe('announceLandmark', () => {
  test('stairs have high priority', () => {
    const l = createLandmark('Stairs', 'stairs');
    expect(announceLandmark(l).priority).toBe('high');
  });
  test('custom landmark has normal priority', () => {
    const l = createLandmark('Coffee shop', 'custom');
    expect(announceLandmark(l).priority).toBe('normal');
  });
});

describe('findNearestLandmark', () => {
  test('returns null for empty list', () => expect(findNearestLandmark([])).toBeNull());
  test('returns first landmark', () => {
    const l = createLandmark('Door', 'door');
    expect(findNearestLandmark([l])).toBe(l);
  });
  test('filters by zone', () => {
    const a = createLandmark('Stairs', 'stairs', { indoorZone: 'stairs' });
    const b = createLandmark('Door', 'door', { indoorZone: 'doorway' });
    const found = findNearestLandmark([a, b], 'doorway');
    expect(found?.type).toBe('door');
  });
});

describe('detectLandmarksFromLabels', () => {
  test('detects door from label', () => expect(detectLandmarksFromLabels(['door'])).toHaveLength(1));
  test('detects stairs', () => expect(detectLandmarksFromLabels(['stairs'])).toContain('stairs'));
  test('empty labels → empty', () => expect(detectLandmarksFromLabels([])).toHaveLength(0));
  test('unknown label → empty', () => expect(detectLandmarksFromLabels(['tree'])).toHaveLength(0));
  test('deduplicates same type', () => expect(detectLandmarksFromLabels(['door', 'door'])).toHaveLength(1));
});

describe('canSaveRouteMemory', () => {
  test('requires consent', () => {
    const s = createNavigationSession('exit', 'indoor', false);
    expect(canSaveRouteMemory(s)).toBe(false);
  });
  test('allowed with consent', () => {
    const s = createNavigationSession('exit', 'indoor', true);
    expect(canSaveRouteMemory(s)).toBe(true);
  });
});

// ─── CROSSING DECISION ────────────────────────────────────────────────────────
describe('evaluateCrossing', () => {
  test('no vehicles → moderate risk', () => {
    const d = evaluateCrossing([], 'crossing');
    expect(d.riskLevel).toBe('moderate');
  });
  test('car at crossing → critical risk', () => {
    const d = evaluateCrossing(['car'], 'crossing');
    expect(d.riskLevel).toBe('critical');
  });
  test('multiple vehicles → critical', () => {
    const d = evaluateCrossing(['car', 'car'], 'crossing');
    expect(d.riskLevel).toBe('critical');
  });
  test('construction_barrier → high', () => {
    const d = evaluateCrossing(['construction_barrier'], 'crossing');
    expect(d.riskLevel).toBe('high');
  });
  test('returns confidence < 0.8', () => {
    expect(evaluateCrossing([], 'crossing').confidence).toBeLessThan(0.8);
  });
  test('suggested action stop when critical', () => {
    const d = evaluateCrossing(['car', 'car'], 'crossing');
    expect(d.suggestedAction).toBe('stop');
  });
});

describe('buildCrossingMessage — never says safe to cross with certainty', () => {
  test('clear message still says check carefully', () => {
    const msg = buildCrossingMessage('moderate', 0, 'unknown');
    expect(msg.toLowerCase()).toContain('check carefully');
  });
  test('critical message says stop', () => {
    const msg = buildCrossingMessage('critical', 2, 'unknown');
    expect(msg.toLowerCase()).toContain('stop');
  });
  test('clear message never says "safe to cross"', () => {
    const msg = buildCrossingMessage('moderate', 0, 'unknown');
    expect(msg.toLowerCase()).not.toContain('safe to cross');
  });
  test('green light still says check carefully', () => {
    const msg = buildCrossingMessage('moderate', 0, 'green');
    expect(msg.toLowerCase()).toContain('check carefully');
  });
});

describe('isCrossingDecisionNeeded', () => {
  test('crossing segment triggers decision', () => {
    const s = createNavigationSession('bus stop', 'outdoor');
    // Find a session that has a crossing segment current
    const crossingIdx = s.segments.findIndex((seg) => seg.type === 'crossing');
    if (crossingIdx >= 0) {
      const atCrossing = { ...s, currentSegmentIndex: crossingIdx };
      expect(isCrossingDecisionNeeded(atCrossing, [])).toBe(true);
    }
  });
  test('car label triggers decision', () => {
    const s = createNavigationSession('exit', 'indoor');
    expect(isCrossingDecisionNeeded(s, ['car'])).toBe(true);
  });
  test('no labels and non-crossing segment → false', () => {
    const s = createNavigationSession('exit', 'indoor'); // indoor, no crossing
    expect(isCrossingDecisionNeeded(s, [])).toBe(false);
  });
});

describe('formatCrossingType', () => {
  test('pedestrian_crossing has label', () => expect(formatCrossingType('pedestrian_crossing')).toContain('Pedestrian'));
  test('road_crossing has label', () => expect(formatCrossingType('road_crossing')).toContain('Road'));
  test('junction has label', () => expect(formatCrossingType('junction')).toContain('Junction'));
});

// ─── INDOOR NAVIGATION ────────────────────────────────────────────────────────
describe('detectIndoorZone', () => {
  test('stairs label → stairs zone', () => expect(detectIndoorZone(['stairs'])).toBe('stairs'));
  test('door label → doorway', () => expect(detectIndoorZone(['door'])).toBe('doorway'));
  test('elevator → elevator', () => expect(detectIndoorZone(['elevator'])).toBe('elevator'));
  test('chair + table → room', () => expect(detectIndoorZone(['chair', 'table'])).toBe('room'));
  test('person only → corridor', () => expect(detectIndoorZone(['person'])).toBe('corridor'));
  test('empty → unknown', () => expect(detectIndoorZone([])).toBe('unknown'));
  test('door + sign → entrance or exit', () => {
    const z = detectIndoorZone(['door', 'sign']);
    expect(z === 'entrance' || z === 'exit').toBe(true);
  });
});

describe('classifyIndoorMode', () => {
  test('shopping_cart → supermarket', () => expect(classifyIndoorMode(['shopping_cart'])).toBe('supermarket'));
  test('chair + table + sign → office', () => expect(classifyIndoorMode(['chair', 'table', 'sign'])).toBe('office'));
  test('wheelchair + sign → station', () => expect(classifyIndoorMode(['wheelchair', 'sign'])).toBe('station'));
  test('default → generic', () => expect(classifyIndoorMode([])).toBe('generic'));
});

describe('generateIndoorRoute', () => {
  test('exit destination generates route', () => expect(generateIndoorRoute('exit', 'generic').length).toBeGreaterThan(0));
  test('stairs destination has stairs segment', () => {
    const route = generateIndoorRoute('stairs', 'generic');
    expect(route.some((s) => s.type === 'stairs')).toBe(true);
  });
  test('arrives at destination', () => {
    const route = generateIndoorRoute('exit', 'generic');
    expect(route[route.length - 1].type).toBe('arrive');
  });
});

describe('getRoomTransitionGuidance', () => {
  test('corridor to room mentions doorway', () => expect(getRoomTransitionGuidance('corridor', 'room')).toContain('doorway'));
  test('to stairs mentions handrail', () => expect(getRoomTransitionGuidance('room', 'stairs')).toContain('handrail'));
  test('to exit mentions exit', () => expect(getRoomTransitionGuidance('corridor', 'exit')).toContain('Exit'));
});

describe('detectDoorway / detectStairs', () => {
  test('door label → doorway detected', () => expect(detectDoorway(['door'])).toBe(true));
  test('no door label → false', () => expect(detectDoorway(['chair'])).toBe(false));
  test('stairs label → stairs detected', () => expect(detectStairs(['stairs'])).toBe(true));
  test('no stairs → false', () => expect(detectStairs(['door'])).toBe(false));
});

describe('getVenueModeIntro', () => {
  test('supermarket mentions carts', () => expect(getVenueModeIntro('supermarket').toLowerCase()).toContain('cart'));
  test('office mentions corridors', () => expect(getVenueModeIntro('office').toLowerCase()).toContain('corridor'));
  test('station mentions passengers', () => expect(getVenueModeIntro('station').toLowerCase()).toContain('passenger'));
  test('generic returns indoor active', () => expect(getVenueModeIntro('generic')).toContain('Indoor'));
});

// ─── OUTDOOR NAVIGATION ───────────────────────────────────────────────────────
describe('parseHeading', () => {
  test('0° → N', () => expect(parseHeading(0)).toBe('N'));
  test('90° → E', () => expect(parseHeading(90)).toBe('E'));
  test('180° → S', () => expect(parseHeading(180)).toBe('S'));
  test('270° → W', () => expect(parseHeading(270)).toBe('W'));
  test('45° → NE', () => expect(parseHeading(45)).toBe('NE'));
  test('315° → NW', () => expect(parseHeading(315)).toBe('NW'));
  test('360° wraps to N', () => expect(parseHeading(360)).toBe('N'));
  test('negative degrees wrap', () => expect(parseHeading(-45)).toBe('NW'));
});

describe('computeHeadingDeviation', () => {
  test('no deviation → 0', () => expect(computeHeadingDeviation(90, 90)).toBe(0));
  test('90° right deviation', () => expect(computeHeadingDeviation(0, 90)).toBe(90));
  test('90° left deviation', () => expect(computeHeadingDeviation(90, 0)).toBe(-90));
  test('180° deviation', () => expect(Math.abs(computeHeadingDeviation(0, 180))).toBe(180));
  test('wraps correctly across 0/360', () => {
    const d = computeHeadingDeviation(350, 10);
    expect(d).toBe(20);
  });
});

describe('buildHeadingInstruction', () => {
  test('0° → continue straight', () => expect(buildHeadingInstruction(0)).toContain('straight'));
  test('20° right → slightly right', () => expect(buildHeadingInstruction(20)).toContain('slightly right'));
  test('-20° left → slightly left', () => expect(buildHeadingInstruction(-20)).toContain('slightly left'));
  test('60° right → turn right', () => expect(buildHeadingInstruction(60)).toContain('Turn right'));
  test('170° → turn around', () => expect(buildHeadingInstruction(170)).toContain('Turn around'));
});

describe('detectRouteDeviation', () => {
  test('small deviation → no deviation', () => expect(detectRouteDeviation(0, 30)).toBe(false));
  test('large deviation → deviation detected', () => expect(detectRouteDeviation(0, 180)).toBe(true));
  test('within threshold → no deviation', () => expect(detectRouteDeviation(90, 120)).toBe(false));
});

describe('classifyOutdoorEnvironment', () => {
  test('car + traffic_light → crossing', () => expect(classifyOutdoorEnvironment(['car', 'traffic_light'])).toBe('crossing'));
  test('car alone → road', () => expect(classifyOutdoorEnvironment(['car'])).toBe('road'));
  test('tree no car → park', () => expect(classifyOutdoorEnvironment(['tree'])).toBe('park'));
  test('empty → pavement', () => expect(classifyOutdoorEnvironment([])).toBe('pavement'));
  test('sign + person + bag → station', () => expect(classifyOutdoorEnvironment(['sign', 'person', 'bag'])).toBe('station'));
});

describe('formatDistance', () => {
  test('< 5m → very close', () => expect(formatDistance(3)).toContain('very close'));
  test('10m → 10 metres', () => expect(formatDistance(10)).toContain('10'));
  test('1000m+ → kilometres', () => expect(formatDistance(1500)).toContain('kilometre'));
});

describe('generateOutdoorRoute', () => {
  test('bus stop generates route', () => expect(generateOutdoorRoute('bus stop').length).toBeGreaterThan(0));
  test('park generates route', () => expect(generateOutdoorRoute('park')).not.toHaveLength(0));
  test('default route has arrive segment', () => {
    const r = generateOutdoorRoute('anywhere');
    expect(r[r.length - 1].type).toBe('arrive');
  });
  test('bus stop has crossing segment', () => {
    const r = generateOutdoorRoute('bus stop');
    expect(r.some((s) => s.type === 'crossing')).toBe(true);
  });
});

describe('getTrafficSideWarning', () => {
  test('UK left-hand traffic mentions right', () => expect(getTrafficSideWarning('left')).toContain('right'));
  test('right-hand traffic mentions left', () => expect(getTrafficSideWarning('right')).toContain('left'));
});

describe('NAVIGATION_PRIVACY', () => {
  test('noThirdPartySharing is true', () => expect(NAVIGATION_PRIVACY.noThirdPartySharing).toBe(true));
  test('noPreciseLocation is true', () => expect(NAVIGATION_PRIVACY.noPreciseLocation).toBe(true));
  test('routeMemoryOnlyWithConsent is true', () => expect(NAVIGATION_PRIVACY.routeMemoryOnlyWithConsent).toBe(true));
});

// ─── Results ─────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

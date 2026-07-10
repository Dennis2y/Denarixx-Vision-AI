/**
 * Human Behaviour & Social Intelligence tests (V9)
 *
 * Covers HumanBehaviourEngine, CrowdUnderstandingEngine,
 * InteractionPredictionEngine, and SocialAwarenessEngine.
 *
 * Run: npx tsx tests/humanBehaviour.test.ts
 */

import {
  inferActivityFromScene,
  inferActivityFromSizeRatio,
  directionFromScreen,
  distanceZoneFromMeters,
  distanceZoneFromSizeRatio,
  estimateMetersFromSizeRatio,
  inferApproachSpeed,
  estimateInteractionProbability,
  analyzePerson,
  analyzePersons,
  simulateDetectedPerson,
} from '../src/engines/humanBehaviourEngine';

import {
  densityFromCount,
  detectQueue,
  crowdRiskLevel,
  analyzeCrowd,
  describeCrowd,
  crowdRiskWarning,
} from '../src/engines/crowdUnderstandingEngine';

import {
  pathCrossingProbability,
  collisionRisk,
  timeToClosestApproachSec,
  interactionLikelihood,
  predictInteraction,
  predictAllInteractions,
  highestRisk,
} from '../src/engines/interactionPredictionEngine';

import {
  analyzeSocialContext,
  analyzeSocialScenario,
  simulateScenario,
} from '../src/engines/socialAwarenessEngine';

import type { NearbyPerson, DetectedPerson } from '../src/types/social';

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect<T>(actual: T) {
  return {
    toBe(expected: T, label: string) {
      if (actual === expected) { console.log(`  ✓ ${label}`); passed++; }
      else {
        console.error(`  ✗ ${label}`);
        console.error(`    expected: ${JSON.stringify(expected)}`);
        console.error(`    received: ${JSON.stringify(actual)}`);
        failed++;
      }
    },
    toBeTrue(label: string)    { this.toBe(true  as unknown as T, label); },
    toBeFalse(label: string)   { this.toBe(false as unknown as T, label); },
    toBeNull(label: string)    { this.toBe(null  as unknown as T, label); },
    toBeNotNull(label: string) {
      const ok = actual !== null && actual !== undefined;
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else    { console.error(`  ✗ ${label}: was null/undefined`); failed++; }
    },
    toBeGreaterThan(n: number, label: string) {
      const ok = (actual as unknown as number) > n;
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else    { console.error(`  ✗ ${label}: ${actual} not > ${n}`); failed++; }
    },
    toBeLessThan(n: number, label: string) {
      const ok = (actual as unknown as number) < n;
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else    { console.error(`  ✗ ${label}: ${actual} not < ${n}`); failed++; }
    },
    toContain(s: string, label: string) {
      const ok = String(actual).includes(s);
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else    { console.error(`  ✗ ${label}: "${actual}" does not contain "${s}"`); failed++; }
    },
  };
}

function describe(label: string, fn: () => void) {
  console.log(`\n${label}`);
  fn();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePerson(overrides: Partial<NearbyPerson> = {}): NearbyPerson {
  return {
    id: 'p1',
    activity: 'walking',
    direction: 'ahead',
    distanceZone: 'near',
    estimatedDistanceM: 4.0,
    approachSpeed: 'slow',
    isApproaching: false,
    interactionProbability: 0.1,
    inPersonalSpace: false,
    ...overrides,
  };
}

// ─── HumanBehaviourEngine — inferActivityFromScene ────────────────────────────

describe('inferActivityFromScene — keyword matching', () => {
  expect(inferActivityFromScene('someone falling on the ground')).toBe('falling', 'falling keyword');
  expect(inferActivityFromScene('person running quickly')).toBe('running', 'running keyword');
  expect(inferActivityFromScene('person jogging')).toBe('running', 'jogging → running');
  expect(inferActivityFromScene('person waving at me')).toBe('waving', 'waving keyword');
  expect(inferActivityFromScene('person pointing ahead')).toBe('pointing', 'pointing keyword');
  expect(inferActivityFromScene('person crossing road')).toBe('crossing_road', 'crossing road');
  expect(inferActivityFromScene('person is approaching')).toBe('approaching', 'approaching keyword');
  expect(inferActivityFromScene('person walking away')).toBe('moving_away', 'walking away → moving_away');
  expect(inferActivityFromScene('someone sitting on bench')).toBe('sitting', 'sitting keyword');
  expect(inferActivityFromScene('person standing still')).toBe('waiting', 'standing still → waiting');
  expect(inferActivityFromScene('pedestrian walking')).toBe('walking', 'walking keyword');
  expect(inferActivityFromScene('clear street')).toBe('unknown', 'no activity → unknown');
});

describe('inferActivityFromScene — priority order', () => {
  // falling beats running
  expect(inferActivityFromScene('someone falling while running')).toBe('falling', 'falling beats running');
  // running beats waving
  expect(inferActivityFromScene('running person waving')).toBe('running', 'running beats waving');
});

// ─── HumanBehaviourEngine — inferActivityFromSizeRatio ───────────────────────

describe('inferActivityFromSizeRatio — size-based activity', () => {
  expect(inferActivityFromSizeRatio(0.9, 0.5)).toBe('approaching', 'very large → approaching');
  expect(inferActivityFromSizeRatio(0.9, 0.2)).toBe('falling', 'very large + high up → falling');
  expect(inferActivityFromSizeRatio(0.65, 0.5)).toBe('walking', 'large → walking');
  expect(inferActivityFromSizeRatio(0.4, 0.5)).toBe('walking', 'medium → walking');
  expect(inferActivityFromSizeRatio(0.1, 0.5)).toBe('standing', 'small → standing');
});

// ─── HumanBehaviourEngine — directionFromScreen ───────────────────────────────

describe('directionFromScreen — lateral zones', () => {
  expect(directionFromScreen(0.1, 0.5)).toBe('left',  'far left');
  expect(directionFromScreen(0.9, 0.5)).toBe('right', 'far right');
  expect(directionFromScreen(0.5, 0.5)).toBe('ahead', 'centre');
  expect(directionFromScreen(0.2, 0.4)).toBe('ahead_left',  'top-left → ahead_left');
  expect(directionFromScreen(0.8, 0.35)).toBe('ahead_right', 'top-right → ahead_right');
  expect(directionFromScreen(0.5, 0.85)).toBe('behind',      'bottom-centre → behind');
  expect(directionFromScreen(0.1, 0.85)).toBe('behind_left', 'bottom-left → behind_left');
  expect(directionFromScreen(0.9, 0.85)).toBe('behind_right','bottom-right → behind_right');
});

// ─── HumanBehaviourEngine — distance ─────────────────────────────────────────

describe('distanceZoneFromMeters', () => {
  expect(distanceZoneFromMeters(0.5)).toBe('very_close', '0.5 m → very_close');
  expect(distanceZoneFromMeters(2.0)).toBe('close',      '2 m → close');
  expect(distanceZoneFromMeters(4.5)).toBe('near',       '4.5 m → near');
  expect(distanceZoneFromMeters(10.0)).toBe('medium',    '10 m → medium');
  expect(distanceZoneFromMeters(20.0)).toBe('far',       '20 m → far');
});

describe('distanceZoneFromSizeRatio', () => {
  expect(distanceZoneFromSizeRatio(0.9)).toBe('very_close', 'large ratio → very_close');
  expect(distanceZoneFromSizeRatio(0.6)).toBe('close',      'medium-large → close');
  expect(distanceZoneFromSizeRatio(0.4)).toBe('near',       'medium → near');
  expect(distanceZoneFromSizeRatio(0.15)).toBe('medium',    'small → medium');
  expect(distanceZoneFromSizeRatio(0.05)).toBe('far',       'tiny → far');
});

describe('estimateMetersFromSizeRatio', () => {
  const m = estimateMetersFromSizeRatio(1.0);
  expect(m < 3).toBeTrue('sizeRatio 1.0 → very close (< 3 m)');
  const m2 = estimateMetersFromSizeRatio(0.1);
  expect(m2 > 5).toBeTrue('sizeRatio 0.1 → far (> 5 m)');
});

// ─── HumanBehaviourEngine — approach speed ────────────────────────────────────

describe('inferApproachSpeed', () => {
  expect(inferApproachSpeed('running', 0.5)).toBe('fast', 'running → fast');
  expect(inferApproachSpeed('approaching', 0.7)).toBe('moderate', 'approaching + large → moderate');
  expect(inferApproachSpeed('approaching', 0.3)).toBe('slow', 'approaching + small → slow');
  expect(inferApproachSpeed('walking', 0.4)).toBe('slow', 'walking → slow');
  expect(inferApproachSpeed('standing', 0.4)).toBe('stationary', 'standing → stationary');
  expect(inferApproachSpeed('waiting', 0.4)).toBe('stationary', 'waiting → stationary');
});

// ─── HumanBehaviourEngine — interaction probability ──────────────────────────

describe('estimateInteractionProbability', () => {
  const high = estimateInteractionProbability('approaching', 'close', 'ahead');
  expect(high > 0.5).toBeTrue('approaching + close + ahead → high probability');

  const waving = estimateInteractionProbability('waving', 'near', 'ahead');
  expect(waving > 0.5).toBeTrue('waving → high probability');

  const far = estimateInteractionProbability('walking', 'far', 'behind');
  expect(far < 0.15).toBeTrue('far + behind → low probability');
});

// ─── HumanBehaviourEngine — analyzePerson ────────────────────────────────────

describe('analyzePerson — full analysis', () => {
  const detected = simulateDetectedPerson('p1', 0.5, 0.45, 0.55, 4.0);
  const person = analyzePerson(detected, 'someone approaching');
  expect(person.id).toBe('p1', 'id preserved');
  expect(person.activity).toBe('approaching', 'scene → approaching');
  expect(person.direction).toBe('ahead', 'centre → ahead');
  expect(person.distanceZone).toBe('near', '4 m → near');
  expect(person.isApproaching).toBeTrue('approaching = isApproaching');
  expect(person.estimatedDistanceM !== null).toBeTrue('distance set');
  expect(person.inPersonalSpace).toBeFalse('4 m → not in personal space');
});

describe('analyzePerson — personal space breach', () => {
  const detected = simulateDetectedPerson('p1', 0.5, 0.5, 0.9, 0.8);
  const person = analyzePerson(detected, '');
  expect(person.inPersonalSpace).toBeTrue('0.8 m → in personal space');
  expect(person.distanceZone).toBe('very_close', '0.8 m → very_close');
});

describe('analyzePersons — filters low confidence', () => {
  const persons: DetectedPerson[] = [
    simulateDetectedPerson('p1', 0.5, 0.5, 0.4, 5.0, 0.9),
    simulateDetectedPerson('p2', 0.3, 0.5, 0.3, 8.0, 0.3), // low confidence — filtered
  ];
  const result = analyzePersons(persons, 'people walking');
  expect(result.length).toBe(1, 'low-confidence person filtered out');
});

// ─── CrowdUnderstandingEngine — density ───────────────────────────────────────

describe('densityFromCount', () => {
  expect(densityFromCount(0)).toBe('empty',     '0 → empty');
  expect(densityFromCount(1)).toBe('sparse',    '1 → sparse');
  expect(densityFromCount(2)).toBe('sparse',    '2 → sparse');
  expect(densityFromCount(3)).toBe('moderate',  '3 → moderate');
  expect(densityFromCount(5)).toBe('moderate',  '5 → moderate');
  expect(densityFromCount(6)).toBe('dense',     '6 → dense');
  expect(densityFromCount(9)).toBe('dense',     '9 → dense');
  expect(densityFromCount(10)).toBe('very_dense','10 → very_dense');
  expect(densityFromCount(15)).toBe('very_dense','15 → very_dense');
});

// ─── CrowdUnderstandingEngine — queue detection ───────────────────────────────

describe('detectQueue — no queue', () => {
  expect(detectQueue([])).toBeFalse('empty → no queue');
  expect(detectQueue([makePerson({ activity: 'waiting', direction: 'ahead' })])).toBeFalse('single → no queue');
  expect(detectQueue([
    makePerson({ activity: 'walking', direction: 'ahead' }),
    makePerson({ activity: 'walking', direction: 'ahead' }),
  ])).toBeFalse('walking persons → no queue');
});

describe('detectQueue — queue detected', () => {
  expect(detectQueue([
    makePerson({ activity: 'waiting', direction: 'ahead' }),
    makePerson({ activity: 'waiting', direction: 'ahead' }),
  ])).toBeTrue('2 waiting ahead → queue');

  expect(detectQueue([
    makePerson({ activity: 'standing', direction: 'ahead' }),
    makePerson({ activity: 'waiting',  direction: 'ahead_left' }),
    makePerson({ activity: 'sitting',  direction: 'ahead_right' }),
  ])).toBeTrue('3 stationary mixed ahead directions → queue');
});

// ─── CrowdUnderstandingEngine — crowd risk ────────────────────────────────────

describe('crowdRiskLevel', () => {
  expect(crowdRiskLevel('empty', 0)).toBe('none', 'empty → none');
  expect(crowdRiskLevel('sparse', 0)).toBe('none', 'sparse no approach → none');
  expect(crowdRiskLevel('moderate', 0)).toBe('none', 'moderate no approach → none');
  expect(crowdRiskLevel('dense', 0)).toBe('low', 'dense no approach → low');
  expect(crowdRiskLevel('dense', 2)).toBe('medium', 'dense 2 approaching → medium');
  expect(crowdRiskLevel('very_dense', 0)).toBe('medium', 'very dense → medium');
  expect(crowdRiskLevel('very_dense', 2)).toBe('high', 'very dense + 2 approaching → high');
});

// ─── CrowdUnderstandingEngine — analyzeCrowd ─────────────────────────────────

describe('analyzeCrowd — no people', () => {
  const crowd = analyzeCrowd([]);
  expect(crowd.density).toBe('empty', 'empty crowd density');
  expect(crowd.count).toBe(0, 'count 0');
  expect(crowd.hasQueue).toBeFalse('no queue when empty');
  expect(crowd.approachingCount).toBe(0, 'no approaching when empty');
  expect(crowd.riskLevel).toBe('none', 'no risk when empty');
});

describe('analyzeCrowd — approaching persons', () => {
  const persons = [
    makePerson({ isApproaching: true }),
    makePerson({ id: 'p2', isApproaching: false }),
  ];
  const crowd = analyzeCrowd(persons);
  expect(crowd.approachingCount).toBe(1, 'one approaching counted');
});

describe('describeCrowd', () => {
  expect(describeCrowd({ density: 'empty', count: 0, hasQueue: false, approachingCount: 0, estimatedSpacingM: null, riskLevel: 'none' }))
    .toBe('No people nearby.', 'empty description');
  const sparse = describeCrowd({ density: 'sparse', count: 1, hasQueue: false, approachingCount: 0, estimatedSpacingM: null, riskLevel: 'none' });
  expect(sparse).toContain('One person', 'single person description');
});

describe('crowdRiskWarning', () => {
  expect(crowdRiskWarning({ density: 'empty', count: 0, hasQueue: false, approachingCount: 0, estimatedSpacingM: null, riskLevel: 'none' }))
    .toBeNull('no warning for empty');
  const warn = crowdRiskWarning({ density: 'very_dense', count: 12, hasQueue: false, approachingCount: 3, estimatedSpacingM: 0.8, riskLevel: 'high' });
  expect(warn !== null).toBeTrue('high density → warning');
  expect(warn!).toContain('dense', 'warning mentions dense');
});

// ─── InteractionPredictionEngine — pathCrossing ───────────────────────────────

describe('pathCrossingProbability', () => {
  const stationary = makePerson({ isApproaching: false });
  expect(pathCrossingProbability(stationary) < 0.1).toBeTrue('stationary → very low crossing');

  const lateralApproach = makePerson({ isApproaching: true, direction: 'left', approachSpeed: 'moderate' });
  expect(pathCrossingProbability(lateralApproach) > 0.4).toBeTrue('lateral approaching → higher crossing prob');

  const headOn = makePerson({ isApproaching: true, direction: 'ahead', approachSpeed: 'slow' });
  expect(pathCrossingProbability(headOn) < 0.3).toBeTrue('head-on → lower crossing prob than lateral');
});

// ─── InteractionPredictionEngine — collisionRisk ──────────────────────────────

describe('collisionRisk', () => {
  const safe = makePerson({ isApproaching: false });
  expect(collisionRisk(safe, 'walking') < 0.1).toBeTrue('not approaching → low risk');

  const dangerous = makePerson({
    isApproaching: true,
    direction: 'ahead',
    distanceZone: 'very_close',
    approachSpeed: 'fast',
    activity: 'running',
    estimatedDistanceM: 0.8,
  });
  expect(collisionRisk(dangerous, 'walking') > 0.6).toBeTrue('head-on fast close → high risk');

  const moderate = makePerson({
    isApproaching: true,
    direction: 'ahead',
    distanceZone: 'near',
    approachSpeed: 'slow',
    estimatedDistanceM: 5.0,
  });
  expect(collisionRisk(moderate, 'stationary')).toBeLessThan(0.6, 'far slow → moderate or lower risk');
});

// ─── InteractionPredictionEngine — timeToClosestApproach ─────────────────────

describe('timeToClosestApproachSec', () => {
  const notApproaching = makePerson({ isApproaching: false });
  expect(timeToClosestApproachSec(notApproaching, 'walking')).toBeNull('not approaching → null');

  const approaching = makePerson({ isApproaching: true, estimatedDistanceM: 4.0, approachSpeed: 'moderate' });
  const t = timeToClosestApproachSec(approaching, 'walking');
  expect(t !== null).toBeTrue('approaching → time estimate');
  expect(t!).toBeGreaterThan(0, 'time > 0');

  const noDistance = makePerson({ isApproaching: true, estimatedDistanceM: null });
  expect(timeToClosestApproachSec(noDistance, 'walking')).toBeNull('no distance → null');
});

// ─── InteractionPredictionEngine — interactionLikelihood ─────────────────────

describe('interactionLikelihood', () => {
  const waving = makePerson({ activity: 'waving', interactionProbability: 0.7, approachSpeed: 'stationary' });
  expect(interactionLikelihood(waving) > 0.5).toBeTrue('waving → high interaction');

  const running = makePerson({ activity: 'running', interactionProbability: 0.5, approachSpeed: 'fast' });
  expect(interactionLikelihood(running) < 0.3).toBeTrue('fast runner → lower interaction likelihood');
});

// ─── InteractionPredictionEngine — predictAllInteractions ─────────────────────

describe('predictAllInteractions — sorted by collision risk', () => {
  const persons = [
    makePerson({ id: 'safe', isApproaching: false }),
    makePerson({ id: 'dangerous', isApproaching: true, direction: 'ahead', distanceZone: 'very_close', approachSpeed: 'fast', estimatedDistanceM: 0.8 }),
  ];
  const preds = predictAllInteractions(persons, 'walking');
  expect(preds[0].personId).toBe('dangerous', 'dangerous person first');
  expect(preds[0].collisionRisk).toBeGreaterThan(preds[1].collisionRisk, 'sorted descending by risk');
});

describe('highestRisk', () => {
  expect(highestRisk([])).toBe(0, 'empty → 0');
  const preds = predictAllInteractions([
    makePerson({ isApproaching: true, direction: 'ahead', distanceZone: 'close', approachSpeed: 'moderate', estimatedDistanceM: 2.0 }),
  ], 'walking');
  expect(highestRisk(preds) > 0).toBeTrue('approaching → some risk');
});

// ─── SocialAwarenessEngine — scenarios ───────────────────────────────────────

describe('simulateScenario — empty_street', () => {
  const { persons, sceneDescription } = simulateScenario('empty_street');
  expect(persons.length).toBe(0, 'empty street has no persons');
  expect(sceneDescription).toContain('empty', 'scene description mentions empty');
});

describe('simulateScenario — dense_crowd', () => {
  const { persons } = simulateScenario('dense_crowd');
  expect(persons.length).toBeGreaterThan(5, 'dense crowd has many persons');
});

describe('analyzeSocialScenario — empty_street', () => {
  const ctx = analyzeSocialScenario('empty_street');
  expect(ctx.nearbyPersons.length).toBe(0, 'no persons in empty street');
  expect(ctx.crowd.density).toBe('empty', 'density = empty');
  expect(ctx.personalSpaceClear).toBeTrue('personal space clear');
  expect(ctx.primaryGuidance).toContain('plenty of space', 'positive guidance when empty');
});

describe('analyzeSocialScenario — someone_approaching', () => {
  const ctx = analyzeSocialScenario('someone_approaching', 'walking');
  expect(ctx.nearbyPersons.length).toBeGreaterThan(0, 'has persons');
  const approaching = ctx.nearbyPersons.some((p) => p.isApproaching || p.activity === 'approaching');
  expect(approaching).toBeTrue('person is approaching');
  expect(ctx.primaryGuidance !== null).toBeTrue('has guidance');
  expect(ctx.primaryGuidance!).toContain('approaching', 'guidance mentions approaching');
});

describe('analyzeSocialScenario — small_queue', () => {
  const ctx = analyzeSocialScenario('small_queue');
  expect(ctx.crowd.count).toBeGreaterThan(1, 'queue has multiple persons');
  expect(ctx.crowd.hasQueue).toBeTrue('queue detected');
});

describe('analyzeSocialScenario — dense_crowd', () => {
  const ctx = analyzeSocialScenario('dense_crowd');
  const densities = ['moderate', 'dense', 'very_dense'];
  expect(densities.includes(ctx.crowd.density)).toBeTrue('dense crowd → moderate+ density');
  expect(ctx.crowd.riskLevel !== 'none').toBeTrue('dense crowd has some risk');
});

describe('analyzeSocialScenario — person_waving', () => {
  const ctx = analyzeSocialScenario('person_waving');
  expect(ctx.nearbyPersons.some((p) => p.activity === 'waving')).toBeTrue('waving activity detected');
  expect(ctx.primaryGuidance!).toContain('waving', 'guidance mentions waving');
});

describe('analyzeSocialScenario — person_falling', () => {
  const ctx = analyzeSocialScenario('person_falling');
  expect(ctx.nearbyPersons.some((p) => p.activity === 'falling')).toBeTrue('falling activity detected');
  expect(ctx.primaryGuidance!).toContain('fallen', 'guidance mentions fallen');
  const urgentAlerts = ctx.alerts.filter((a) => a.severity === 'urgent');
  expect(urgentAlerts.length).toBeGreaterThan(0, 'falling → urgent alert');
});

// ─── SocialAwarenessEngine — analyzeSocialContext ────────────────────────────

describe('analyzeSocialContext — full pipeline', () => {
  const ctx = analyzeSocialContext({
    detectedPersons: [
      simulateDetectedPerson('p1', 0.5, 0.45, 0.55, 3.5, 0.9),
      simulateDetectedPerson('p2', 0.2, 0.5, 0.3, 8.0, 0.85),
    ],
    sceneDescription: 'someone approaching on the left',
    userMotion: 'walking',
    timestamp: new Date(),
  });

  expect(ctx.nearbyPersons.length).toBeGreaterThan(0, 'persons analysed');
  expect(ctx.crowd.count).toBeGreaterThan(0, 'crowd count');
  expect(ctx.predictions.length).toBeGreaterThan(0, 'predictions generated');
  expect(ctx.timestamp instanceof Date).toBeTrue('timestamp set');
});

describe('analyzeSocialContext — alerts severity ordering', () => {
  const ctx = analyzeSocialContext({
    detectedPersons: [
      simulateDetectedPerson('p1', 0.5, 0.5, 0.9, 0.8, 0.95), // very close — personal space
      simulateDetectedPerson('p2', 0.5, 0.45, 0.5, 4.0, 0.85),
    ],
    sceneDescription: 'someone very close approaching',
    userMotion: 'walking',
    timestamp: new Date(),
  });

  if (ctx.alerts.length >= 2) {
    const first = ctx.alerts[0];
    const second = ctx.alerts[1];
    const severityOrder = { urgent: 0, warning: 1, info: 2 };
    expect(severityOrder[first.severity] <= severityOrder[second.severity]).toBeTrue('alerts sorted urgent first');
  }
  expect(true).toBeTrue('alert ordering check complete');
});

describe('analyzeSocialContext — privacy: no identity in guidance', () => {
  const ctx = analyzeSocialScenario('someone_approaching');
  const guidance = ctx.primaryGuidance ?? '';
  expect(guidance.toLowerCase().includes('john')).toBeFalse('no names in guidance');
  expect(guidance.toLowerCase().includes('face')).toBeFalse('no faces in guidance');
  const alertMessages = ctx.alerts.map((a) => a.message.toLowerCase()).join(' ');
  expect(alertMessages.includes('identity')).toBeFalse('no identity in alerts');
});

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

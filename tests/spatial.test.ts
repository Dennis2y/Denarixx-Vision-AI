/**
 * Spatial Intelligence tests (V6)
 *
 * Tests SpatialReasoningEngine, PathPlanningEngine, MobilityEngine,
 * WorldModelEngine — no browser or async dependencies.
 *
 * Run: npx tsx tests/spatial.test.ts
 */

import { SpatialReasoningEngine } from '../src/engines/spatialReasoningEngine';
import { PathPlanningEngine, computeCorridor, predictMovement, computeRecommendation } from '../src/engines/pathPlanningEngine';
import { MobilityEngine } from '../src/engines/mobilityEngine';
import { WorldModelEngine } from '../src/engines/worldModelEngine';
import type { SpatialObject, SpatialInput } from '../src/types/spatial';

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect<T>(actual: T) {
  return {
    toBe(expected: T, label: string) {
      if (actual === expected) {
        console.log(`  ✓ ${label}`);
        passed++;
      } else {
        console.error(`  ✗ ${label}`);
        console.error(`    expected: ${JSON.stringify(expected)}`);
        console.error(`    received: ${JSON.stringify(actual)}`);
        failed++;
      }
    },
    toBeTrue(label: string) { this.toBe(true as unknown as T, label); },
    toBeFalse(label: string) { this.toBe(false as unknown as T, label); },
    toBeGreaterThan(n: number, label: string) {
      const ok = (actual as unknown as number) > n;
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else { console.error(`  ✗ ${label}: ${actual} not > ${n}`); failed++; }
    },
    toBeLessThan(n: number, label: string) {
      const ok = (actual as unknown as number) < n;
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else { console.error(`  ✗ ${label}: ${actual} not < ${n}`); failed++; }
    },
    toContain(s: string, label: string) {
      const ok = String(actual).includes(s);
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else { console.error(`  ✗ ${label}: "${actual}" does not contain "${s}"`); failed++; }
    },
  };
}

function describe(label: string, fn: () => void) {
  console.log(`\n${label}`);
  fn();
}

// ─── SpatialReasoningEngine ───────────────────────────────────────────────────

describe('SpatialReasoningEngine — empty input', () => {
  const engine = new SpatialReasoningEngine();
  const input: SpatialInput = { detections: [], frameIndex: 0, source: 'simulation' };
  const result = engine.analyze(input);
  expect(result.length).toBe(0, 'empty detections → empty objects');
});

describe('SpatialReasoningEngine — type classification', () => {
  const engine = new SpatialReasoningEngine();
  const mkInput = (label: string): SpatialInput => ({
    detections: [{ label, confidence: 0.8 }],
    frameIndex: 1,
    source: 'simulation',
  });

  expect(engine.analyze(mkInput('person'))[0].type).toBe('person', 'person → person');
  expect(engine.analyze(mkInput('car'))[0].type).toBe('vehicle', 'car → vehicle');
  expect(engine.analyze(mkInput('bicycle'))[0].type).toBe('bicycle', 'bicycle → bicycle');
  expect(engine.analyze(mkInput('dog'))[0].type).toBe('animal', 'dog → animal');
  expect(engine.analyze(mkInput('bench'))[0].type).toBe('furniture', 'bench → furniture');
  expect(engine.analyze(mkInput('door'))[0].type).toBe('landmark', 'door → landmark');
  expect(engine.analyze(mkInput('random-thing'))[0].type).toBe('obstacle', 'unknown → obstacle');
});

describe('SpatialReasoningEngine — simulation produces valid coordinates', () => {
  const engine = new SpatialReasoningEngine();
  const input: SpatialInput = {
    detections: [
      { label: 'person', confidence: 0.9 },
      { label: 'car', confidence: 0.8 },
    ],
    frameIndex: 5,
    source: 'simulation',
  };
  const result = engine.analyze(input);

  expect(result.length).toBe(2, 'two detections → two objects');
  result.forEach((obj, i) => {
    expect(obj.distanceMetres > 0).toBeTrue(`object ${i} has positive distance`);
    expect(obj.lateralOffset >= -1 && obj.lateralOffset <= 1).toBeTrue(`object ${i} lateral offset in [-1,1]`);
    expect(obj.confidence > 0).toBeTrue(`object ${i} has positive confidence`);
    expect(obj.direction.length > 0).toBeTrue(`object ${i} has direction string`);
  });
});

describe('SpatialReasoningEngine — camera mode uses bbox', () => {
  const engine = new SpatialReasoningEngine();
  const input: SpatialInput = {
    detections: [{
      label: 'person',
      confidence: 0.9,
      boundingBox: { x: 0.0, y: 0.2, width: 0.3, height: 0.5 }, // left side, large → close
    }],
    frameIndex: 1,
    source: 'camera',
  };
  const [obj] = engine.analyze(input);
  expect(obj.distanceMetres).toBeLessThan(5, 'large bbox → close distance');
  expect(obj.lateralOffset).toBeLessThan(0, 'left-side bbox → negative lateral offset');
});

describe('SpatialReasoningEngine — deterministic for same frame', () => {
  const engine = new SpatialReasoningEngine();
  const input: SpatialInput = {
    detections: [{ label: 'person', confidence: 0.9 }],
    frameIndex: 42,
    source: 'simulation',
  };
  const r1 = engine.analyze(input)[0];
  const r2 = engine.analyze(input)[0];
  expect(r1.distanceMetres).toBe(r2.distanceMetres, 'same frame → same distance');
  expect(r1.lateralOffset).toBe(r2.lateralOffset, 'same frame → same lateral offset');
});

describe('SpatialReasoningEngine — varies across frames', () => {
  const engine = new SpatialReasoningEngine();
  const det = [{ label: 'person', confidence: 0.9 }];
  const r1 = engine.analyze({ detections: det, frameIndex: 1, source: 'simulation' })[0];
  const r2 = engine.analyze({ detections: det, frameIndex: 2, source: 'simulation' })[0];
  expect(r1.distanceMetres !== r2.distanceMetres || r1.lateralOffset !== r2.lateralOffset).toBeTrue(
    'different frames produce different positions'
  );
});

describe('SpatialReasoningEngine — isMoving flags', () => {
  const engine = new SpatialReasoningEngine();
  const mk = (label: string) => engine.analyze({ detections: [{ label, confidence: 0.8 }], frameIndex: 1, source: 'simulation' })[0];
  expect(mk('person').isMoving).toBeTrue('person is moving');
  expect(mk('car').isMoving).toBeTrue('car is moving');
  expect(mk('bench').isMoving).toBeFalse('bench is not moving');
  expect(mk('door').isMoving).toBeFalse('door is not moving');
});

describe('SpatialReasoningEngine — isPermanent flags', () => {
  const engine = new SpatialReasoningEngine();
  const mk = (label: string) => engine.analyze({ detections: [{ label, confidence: 0.8 }], frameIndex: 1, source: 'simulation' })[0];
  expect(mk('door').isPermanent).toBeTrue('door is permanent');
  expect(mk('bench').isPermanent).toBeTrue('bench is permanent');
  expect(mk('person').isPermanent).toBeFalse('person is not permanent');
});

describe('SpatialReasoningEngine — describeObject', () => {
  const engine = new SpatialReasoningEngine();
  const obj: SpatialObject = {
    id: 'test-1',
    type: 'person',
    label: 'person',
    distanceMetres: 3,
    direction: 'ahead_left',
    lateralOffset: -0.4,
    isMoving: true,
    movementDir: 'toward',
    movementSpeed: 'slow',
    confidence: 0.9,
    isPermanent: false,
    lastSeenAt: new Date(),
  };
  const desc = engine.describeObject(obj);
  expect(desc).toContain('person', 'description contains label');
  expect(desc).toContain('3', 'description contains distance');
  expect(desc).toContain('ahead', 'description contains direction component');
  expect(desc).toContain('toward', 'description contains movement direction');
});

// ─── PathPlanningEngine — corridor ────────────────────────────────────────────

describe('PathPlanningEngine — empty scene → clear corridor', () => {
  const corridor = computeCorridor([]);
  expect(corridor.clearanceMetres).toBe(20, 'no objects → 20m clearance');
  expect(corridor.isPassable).toBeTrue('empty scene is passable');
});

describe('PathPlanningEngine — close obstacle blocks corridor', () => {
  const close: SpatialObject = {
    id: 'obs-1', type: 'obstacle', label: 'wall', distanceMetres: 0.5,
    direction: 'ahead', lateralOffset: 0, isMoving: false, confidence: 0.9,
    isPermanent: true, lastSeenAt: new Date(),
  };
  const corridor = computeCorridor([close]);
  expect(corridor.clearanceMetres).toBe(0.5, 'clearance = closest obstacle distance');
  expect(corridor.isPassable).toBeFalse('0.5m obstacle → not passable');
});

describe('PathPlanningEngine — lateral obstacle nudges offset', () => {
  const leftObj: SpatialObject = {
    id: 'left-1', type: 'furniture', label: 'bench', distanceMetres: 1.5,
    direction: 'ahead_left', lateralOffset: -0.5, isMoving: false, confidence: 0.85,
    isPermanent: true, lastSeenAt: new Date(),
  };
  const corridor = computeCorridor([leftObj]);
  expect(corridor.suggestedOffset > 0).toBeTrue('left blocker → step right (positive offset)');
});

// ─── PathPlanningEngine — recommendation ──────────────────────────────────────

describe('PathPlanningEngine — clear path → continue', () => {
  const { recommendation } = new PathPlanningEngine().plan([]);
  expect(recommendation.action).toBe('continue', 'no objects → continue');
  expect(recommendation.urgency).toBe('advisory', 'no objects → advisory urgency');
});

describe('PathPlanningEngine — very close object → stop', () => {
  const close: SpatialObject = {
    id: 'c1', type: 'obstacle', label: 'wall', distanceMetres: 0.4,
    direction: 'ahead', lateralOffset: 0, isMoving: false, confidence: 0.95,
    isPermanent: true, lastSeenAt: new Date(),
  };
  const { recommendation } = new PathPlanningEngine().plan([close]);
  expect(recommendation.action).toBe('stop', 'very close obstacle → stop');
  expect(recommendation.urgency).toBe('immediate', 'very close → immediate urgency');
});

describe('PathPlanningEngine — instruction is non-empty string', () => {
  const { recommendation } = new PathPlanningEngine().plan([]);
  expect(recommendation.instruction.length > 0).toBeTrue('instruction is non-empty');
  expect(typeof recommendation.confidence).toBe('number', 'confidence is a number');
});

// ─── PathPlanningEngine — movement prediction ─────────────────────────────────

describe('PathPlanningEngine — stationary object has no prediction', () => {
  const bench: SpatialObject = {
    id: 'b1', type: 'furniture', label: 'bench', distanceMetres: 2,
    direction: 'ahead', lateralOffset: 0.3, isMoving: false, confidence: 0.9,
    isPermanent: true, lastSeenAt: new Date(),
  };
  const preds = predictMovement([bench]);
  expect(preds.length).toBe(0, 'stationary object → no predictions');
});

describe('PathPlanningEngine — approaching person predicts intersection', () => {
  const person: SpatialObject = {
    id: 'p1', type: 'person', label: 'person', distanceMetres: 2,
    direction: 'ahead', lateralOffset: 0, isMoving: true,
    movementDir: 'toward', movementSpeed: 'medium',
    confidence: 0.9, isPermanent: false, lastSeenAt: new Date(),
  };
  const preds = predictMovement([person]);
  expect(preds.length).toBe(1, 'moving person → one prediction');
  expect(preds[0].willIntersectPath).toBeTrue('approaching person → will intersect');
});

// ─── MobilityEngine ───────────────────────────────────────────────────────────

describe('MobilityEngine — analyze returns valid snapshot', () => {
  const engine = new MobilityEngine();
  const input: SpatialInput = {
    detections: [{ label: 'person', confidence: 0.9 }],
    frameIndex: 1,
    source: 'simulation',
  };
  const snapshot = engine.analyze(input, 1);

  expect(snapshot.objects.length).toBe(1, 'snapshot has one object');
  expect(snapshot.recommendation.instruction.length > 0).toBeTrue('snapshot has instruction');
  expect(snapshot.corridor.clearanceMetres > 0).toBeTrue('snapshot has positive clearance');
  expect(snapshot.frameIndex).toBe(1, 'snapshot has correct frameIndex');
});

describe('MobilityEngine — generateGuidance returns string or null', () => {
  const engine = new MobilityEngine();
  const input: SpatialInput = { detections: [], frameIndex: 0, source: 'simulation' };
  const snapshot = engine.analyze(input, 0);

  const guidance = engine.generateGuidance(snapshot, undefined);
  expect(guidance !== null).toBeTrue('first call returns non-null guidance');
  expect(typeof guidance).toBe('string', 'guidance is a string');
  if (guidance) expect(guidance.length > 0).toBeTrue('guidance is non-empty');
});

describe('MobilityEngine — repeated advisory suppressed', () => {
  const engine = new MobilityEngine();
  const input: SpatialInput = { detections: [], frameIndex: 0, source: 'simulation' };
  const snapshot = engine.analyze(input, 0);

  const g1 = engine.generateGuidance(snapshot, undefined);
  const sameInstruction = snapshot.recommendation.instruction;
  // If first guidance was advisory, repeat should be null
  if (snapshot.recommendation.urgency === 'advisory' && g1) {
    const g2 = engine.generateGuidance(snapshot, sameInstruction);
    expect(g2).toBe(null, 'same advisory instruction → null (no repeat)');
  } else {
    console.log('  (skipped — first was not advisory)');
    passed++;
  }
});

describe('MobilityEngine — statusSummary', () => {
  const engine = new MobilityEngine();
  const input: SpatialInput = { detections: [], frameIndex: 0, source: 'simulation' };
  const snapshot = engine.analyze(input, 0);
  const summary = engine.statusSummary(snapshot);
  expect(summary.length > 0).toBeTrue('statusSummary is non-empty');
});

// ─── WorldModelEngine ─────────────────────────────────────────────────────────

describe('WorldModelEngine — update enriches snapshot', () => {
  const engine = new WorldModelEngine();
  const mobilityEngine = new MobilityEngine();
  const input: SpatialInput = { detections: [], frameIndex: 0, source: 'simulation' };
  const snap = mobilityEngine.analyze(input, 0);
  const enriched = engine.update(snap);
  expect(enriched.frameIndex).toBe(snap.frameIndex, 'enriched snapshot keeps frameIndex');
  expect(Array.isArray(enriched.landmarks)).toBeTrue('enriched snapshot has landmarks array');
});

describe('WorldModelEngine — landmark memory accumulates', () => {
  const wm = new WorldModelEngine();
  const me = new MobilityEngine();

  const mkSnap = (label: string) => {
    const s = me.analyze({ detections: [{ label, confidence: 0.9 }], frameIndex: 1, source: 'simulation' }, 1);
    return wm.update(s);
  };

  mkSnap('door'); // sighting 1
  mkSnap('door'); // sighting 2 — should become confirmed
  const lms = wm.getLandmarks();
  expect(lms.length).toBe(1, 'door confirmed after 2 sightings');
  expect(lms[0].type).toBe('door', 'landmark type is door');
});

describe('WorldModelEngine — reset clears state', () => {
  const wm = new WorldModelEngine();
  const me = new MobilityEngine();
  const snap = me.analyze({ detections: [{ label: 'door', confidence: 0.9 }], frameIndex: 1, source: 'simulation' }, 1);
  wm.update(snap);
  wm.update(snap);
  wm.reset();
  expect(wm.getLandmarks().length).toBe(0, 'landmarks cleared after reset');
  expect(wm.getFrameCount()).toBe(0, 'frame count reset to 0');
});

describe('WorldModelEngine — isExtendedSafe tracks hazard frames', () => {
  const wm = new WorldModelEngine();
  const me = new MobilityEngine();
  const safeSnap = me.analyze({ detections: [], frameIndex: 0, source: 'simulation' }, 0);

  wm.update(safeSnap);
  wm.update(safeSnap);
  wm.update(safeSnap);
  expect(wm.isExtendedSafe(3)).toBeTrue('3 safe frames → isExtendedSafe(3) is true');
  expect(wm.isExtendedSafe(5)).toBeFalse('only 3 frames → isExtendedSafe(5) is false');
});

describe('WorldModelEngine — checkLandmarkRecall', () => {
  const wm = new WorldModelEngine();
  const me = new MobilityEngine();
  const snap = me.analyze({ detections: [{ label: 'door', confidence: 0.9 }], frameIndex: 1, source: 'simulation' }, 1);
  wm.update(snap);
  wm.update(snap); // confirm

  const found = wm.checkLandmarkRecall('walking through a door on the left');
  expect(found !== null).toBeTrue('scene containing "door" → landmark recalled');
  const notFound = wm.checkLandmarkRecall('open field with nothing nearby');
  expect(notFound).toBe(null, 'unrelated scene → no recall');
});

// ─── Integration: full pipeline ───────────────────────────────────────────────

describe('Integration — full pipeline smoke test', () => {
  const spatialEngine = new SpatialReasoningEngine();
  const pathEngine = new PathPlanningEngine();
  const mobilityEngine = new MobilityEngine();
  const worldEngine = new WorldModelEngine();

  const detections = [
    { label: 'person', confidence: 0.9 },
    { label: 'car', confidence: 0.85 },
    { label: 'bench', confidence: 0.7 },
  ];

  for (let frame = 0; frame < 5; frame++) {
    const input: SpatialInput = { detections, frameIndex: frame, source: 'simulation' };
    const objects = spatialEngine.analyze(input);
    const { corridor, recommendation, predictions } = pathEngine.plan(objects);
    const snapshot = { objects, corridor, recommendation, predictions, landmarks: [], frameIndex: frame, timestamp: new Date() };
    const enriched = worldEngine.update(snapshot);
    const guidance = mobilityEngine.generateGuidance(enriched, undefined);

    expect(objects.length).toBe(3, `frame ${frame}: 3 objects detected`);
    expect(corridor.clearanceMetres > 0).toBeTrue(`frame ${frame}: positive clearance`);
    expect(recommendation.instruction.length > 0).toBeTrue(`frame ${frame}: instruction non-empty`);
    expect(typeof guidance === 'string' || guidance === null).toBeTrue(`frame ${frame}: guidance is string or null`);
  }
});

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

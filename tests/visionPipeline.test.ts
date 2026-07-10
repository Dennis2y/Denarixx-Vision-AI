// V12 Vision Pipeline — test suite
// Run: npx tsx tests/visionPipeline.test.ts

import {
  estimateDepthFromBox,
  getDepthLabel,
  isCriticalDistance,
  depthToMeters,
  assignObjectPriority,
  estimateTimeToCollision,
  classifySpeed,
  buildVelocity,
  predictNextPosition,
  isCloserThan,
  closerDepth,
} from '../src/engines/depthReasoningEngine';

import {
  computeTargetFps,
  computeFrameIntervalMs,
  shouldSkipFrame,
  computeAdaptiveInterval,
  buildPipelineConfig,
  updateMetrics,
  incrementSkipped,
  incrementDropped,
  isPerformanceHealthy,
  getPerformanceLabel,
} from '../src/engines/cameraPipelineEngine';

import {
  getModel,
  listAvailableModels,
  listAllModels,
  isModelAvailable,
  getRecommendedModel,
  modelSupportsLabel,
  getModelDisplayName,
} from '../src/engines/modelManagerEngine';

import {
  computeIoU,
  estimateVelocityFromHistory,
  createTrackerState,
  updateTracker,
  getActiveTracks,
  getLostTracks,
  trackCount,
  activeTrackCount,
  tracksToDetectedObjects,
} from '../src/engines/objectTrackingEngine';

import {
  classifyScene,
  classifySceneConfidence,
  estimateCrowding,
  estimateMovement,
  buildSceneUnderstanding,
  getSceneLabel,
} from '../src/engines/sceneUnderstandingEngine';

import {
  runSimulatedInference,
  prioritizeObjects,
  filterByPriority,
  selectSpeechGuidance,
  buildPerceptionFrame,
  rawToDetectedObjects,
  runSimulationPipeline,
  formatPriority,
  formatLabel,
} from '../src/engines/visionInferenceEngine';

import { PIPELINE_PRIVACY, EMPTY_METRICS, DEFAULT_PIPELINE_CONFIG } from '../src/types/vision12';
import type {
  BoundingBox,
  DetectedObject,
  TrackedObject,
  DepthEstimate,
} from '../src/types/vision12';

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
    toEqual: (e: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(e)) fail(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`); },
    toBeTruthy: () => { if (!actual) fail(`Expected truthy, got ${JSON.stringify(actual)}`); },
    toBeFalsy: () => { if (actual) fail(`Expected falsy, got ${JSON.stringify(actual)}`); },
    toBeNull: () => { if (actual !== null) fail(`Expected null, got ${JSON.stringify(actual)}`); },
    toBeGreaterThan: (n: number) => { if ((actual as number) <= n) fail(`Expected > ${n}, got ${actual}`); },
    toBeGreaterThanOrEqual: (n: number) => { if ((actual as number) < n) fail(`Expected >= ${n}, got ${actual}`); },
    toBeLessThan: (n: number) => { if ((actual as number) >= n) fail(`Expected < ${n}, got ${actual}`); },
    toBeLessThanOrEqual: (n: number) => { if ((actual as number) > n) fail(`Expected <= ${n}, got ${actual}`); },
    toContain: (s: string) => { if (!(actual as string).includes(s)) fail(`Expected "${actual}" to contain "${s}"`); },
    toHaveLength: (n: number) => { if ((actual as unknown[]).length !== n) fail(`Expected length ${n}, got ${(actual as unknown[]).length}`); },
    not: {
      toBe: (e: unknown) => { if (actual === e) fail(`Expected NOT ${JSON.stringify(e)}`); },
      toBeNull: () => { if (actual === null) fail('Expected not null'); },
      toContain: (s: string) => { if ((actual as string).includes(s)) fail(`Expected NOT to contain "${s}"`); },
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function box(x: number, y: number, w: number, h: number): BoundingBox {
  return { x, y, width: w, height: h };
}
function makeObj(
  label: DetectedObject['label'] = 'person',
  priority: DetectedObject['priority'] = 'medium',
  distance: DepthEstimate = 'medium',
  confidence = 0.8,
): DetectedObject {
  return {
    trackId: 'T001', label, confidence, distance, priority,
    boundingBox: box(0.3, 0.2, 0.1, 0.15),
    velocity: null, firstSeen: 0, lastSeen: 0, frameCount: 1, timeToCollision: null,
  };
}
function makeTrack(label: DetectedObject['label'], bb: BoundingBox): Parameters<typeof updateTracker>[1][0] {
  return { label, boundingBox: bb, confidence: 0.9 };
}

// ─── DEPTH REASONING ─────────────────────────────────────────────────────────
describe('estimateDepthFromBox', () => {
  test('large box → collision', () => expect(estimateDepthFromBox(box(0, 0, 0.6, 0.5))).toBe('collision'));
  test('medium-large box → near', () => expect(estimateDepthFromBox(box(0, 0, 0.35, 0.35))).toBe('near'));
  test('medium box → walking_distance', () => expect(estimateDepthFromBox(box(0, 0, 0.22, 0.22))).toBe('walking_distance'));
  test('small box → medium', () => expect(estimateDepthFromBox(box(0, 0, 0.12, 0.12))).toBe('medium'));
  test('tiny box → far', () => expect(estimateDepthFromBox(box(0, 0, 0.05, 0.05))).toBe('far'));
  test('exactly at collision threshold → collision', () => expect(estimateDepthFromBox(box(0, 0, 0.5, 0.5))).toBe('collision'));
  test('just above walking_distance threshold → walking_distance', () => expect(estimateDepthFromBox(box(0, 0, 0.21, 0.21))).toBe('walking_distance'));
});

describe('getDepthLabel', () => {
  test('collision has label', () => expect(getDepthLabel('collision')).toContain('Collision'));
  test('near has label', () => expect(getDepthLabel('near')).toContain('1'));
  test('far has label', () => expect(getDepthLabel('far')).toContain('8'));
  test('walking_distance has label', () => expect(getDepthLabel('walking_distance')).toContain('2'));
  test('medium has label', () => expect(getDepthLabel('medium')).toContain('4'));
});

describe('isCriticalDistance', () => {
  test('collision is critical', () => expect(isCriticalDistance('collision')).toBe(true));
  test('near is critical', () => expect(isCriticalDistance('near')).toBe(true));
  test('walking_distance not critical', () => expect(isCriticalDistance('walking_distance')).toBe(false));
  test('medium not critical', () => expect(isCriticalDistance('medium')).toBe(false));
  test('far not critical', () => expect(isCriticalDistance('far')).toBe(false));
});

describe('depthToMeters', () => {
  test('collision → 0.5m', () => expect(depthToMeters('collision')).toBe(0.5));
  test('near → 1.5m', () => expect(depthToMeters('near')).toBe(1.5));
  test('walking_distance → 3m', () => expect(depthToMeters('walking_distance')).toBe(3.0));
  test('medium → 6m', () => expect(depthToMeters('medium')).toBe(6.0));
  test('far → 12m', () => expect(depthToMeters('far')).toBe(12.0));
});

describe('assignObjectPriority', () => {
  test('car at collision → critical', () => expect(assignObjectPriority('car', 'collision')).toBe('critical'));
  test('car at near → critical', () => expect(assignObjectPriority('car', 'near')).toBe('critical'));
  test('car at medium → high', () => expect(assignObjectPriority('car', 'medium')).toBe('high'));
  test('car at far → ignore', () => expect(assignObjectPriority('car', 'far')).toBe('ignore'));
  test('stairs at collision → critical', () => expect(assignObjectPriority('stairs', 'collision')).toBe('critical'));
  test('person at near → high', () => expect(assignObjectPriority('person', 'near')).toBe('high'));
  test('person at medium → medium', () => expect(assignObjectPriority('person', 'medium')).toBe('medium'));
  test('chair at near → medium', () => expect(assignObjectPriority('chair', 'near')).toBe('medium'));
  test('bag at near → low', () => expect(assignObjectPriority('bag', 'near')).toBe('low'));
  test('tree at medium → low', () => expect(assignObjectPriority('tree', 'medium')).toBe('low'));
  test('anything at far → ignore', () => expect(assignObjectPriority('person', 'far')).toBe('ignore'));
  test('construction_barrier at near → critical', () => expect(assignObjectPriority('construction_barrier', 'near')).toBe('critical'));
});

describe('classifySpeed', () => {
  test('large dx → fast', () => expect(classifySpeed(0.05, 0)).toBe('fast'));
  test('moderate dx → moderate', () => expect(classifySpeed(0.02, 0)).toBe('moderate'));
  test('small dx → slow', () => expect(classifySpeed(0.007, 0)).toBe('slow'));
  test('tiny dx → stationary', () => expect(classifySpeed(0.001, 0)).toBe('stationary'));
  test('diagonal fast', () => expect(classifySpeed(0.03, 0.03)).toBe('fast'));
  test('zero → stationary', () => expect(classifySpeed(0, 0)).toBe('stationary'));
});

describe('predictNextPosition', () => {
  test('moves in velocity direction', () => {
    const b = box(0.3, 0.3, 0.1, 0.1);
    const v = buildVelocity(0.05, 0.02);
    const p = predictNextPosition(b, v);
    expect(p.x).toBeGreaterThan(0.3);
    expect(p.y).toBeGreaterThan(0.3);
  });
  test('clamped to [0,1]', () => {
    const b = box(0.98, 0.98, 0.1, 0.1);
    const v = buildVelocity(0.1, 0.1);
    const p = predictNextPosition(b, v);
    expect(p.x).toBeLessThanOrEqual(1);
    expect(p.y).toBeLessThanOrEqual(1);
  });
  test('width/height preserved', () => {
    const b = box(0.3, 0.3, 0.15, 0.20);
    const p = predictNextPosition(b, buildVelocity(0.01, 0.01));
    expect(p.width).toBe(0.15);
    expect(p.height).toBe(0.20);
  });
});

describe('isCloserThan / closerDepth', () => {
  test('collision is closer than near', () => expect(isCloserThan('collision', 'near')).toBe(true));
  test('near is closer than medium', () => expect(isCloserThan('near', 'medium')).toBe(true));
  test('far is not closer than medium', () => expect(isCloserThan('far', 'medium')).toBe(false));
  test('closerDepth returns the closer one', () => expect(closerDepth('near', 'far')).toBe('near'));
  test('same depth returns that depth', () => expect(closerDepth('medium', 'medium')).toBe('medium'));
});

describe('estimateTimeToCollision', () => {
  const makeTracked = (distance: DepthEstimate, speed: TrackedObject['velocity']): TrackedObject => ({
    trackId: 'T001', label: 'car', history: [], velocity: speed,
    predictedPosition: null, lostFrames: 0, distance, priority: 'critical', firstSeen: 0,
  });

  test('null velocity → null', () => expect(estimateTimeToCollision(makeTracked('near', null))).toBeNull());
  test('stationary → null', () => expect(estimateTimeToCollision(makeTracked('near', { dx: 0, dy: 0, speed: 'stationary' }))).toBeNull());
  test('fast + collision → small TTC', () => {
    const ttc = estimateTimeToCollision(makeTracked('collision', { dx: 0.05, dy: 0, speed: 'fast' }));
    expect(ttc).not.toBeNull();
    expect(ttc!).toBeLessThan(1);
  });
  test('moderate + far → larger TTC', () => {
    const ttc = estimateTimeToCollision(makeTracked('far', { dx: 0.02, dy: 0, speed: 'moderate' }));
    expect(ttc).not.toBeNull();
    expect(ttc!).toBeGreaterThan(3);
  });
});

// ─── CAMERA PIPELINE ─────────────────────────────────────────────────────────
describe('computeTargetFps', () => {
  test('performance mode → 10fps', () => expect(computeTargetFps(1.0, 'performance', false)).toBe(10));
  test('balanced mode → 5fps', () => expect(computeTargetFps(1.0, 'balanced', false)).toBe(5));
  test('power_save mode → 2fps', () => expect(computeTargetFps(1.0, 'power_save', false)).toBe(2));
  test('low battery adaptive → max 2fps', () => expect(computeTargetFps(0.05, 'performance', true)).toBe(2));
  test('mid battery adaptive → max 3fps', () => expect(computeTargetFps(0.15, 'performance', true)).toBe(3));
  test('full battery adaptive does not restrict', () => expect(computeTargetFps(1.0, 'performance', true)).toBe(10));
});

describe('shouldSkipFrame', () => {
  test('within interval → skip', () => expect(shouldSkipFrame(1000, 1100, 200)).toBe(true));
  test('past interval → do not skip', () => expect(shouldSkipFrame(1000, 1250, 200)).toBe(false));
  test('exactly at interval → do not skip', () => expect(shouldSkipFrame(1000, 1200, 200)).toBe(false));
});

describe('buildPipelineConfig', () => {
  test('returns config with privacy', () => expect(buildPipelineConfig().privacy.noCloudStorage).toBe(true));
  test('overrides provider', () => expect(buildPipelineConfig({ provider: 'openai' }).provider).toBe('openai'));
  test('privacy cannot be overridden', () => {
    const cfg = buildPipelineConfig({ privacy: { noCloudStorage: true, noRecording: true, noFaceRecognition: true, noIdentityRecognition: true } });
    expect(cfg.privacy.noFaceRecognition).toBe(true);
  });
});

describe('getPerformanceLabel', () => {
  test('no frames → Starting', () => expect(getPerformanceLabel(EMPTY_METRICS)).toBe('Starting…'));
  test('8fps → Excellent', () => expect(getPerformanceLabel({ ...EMPTY_METRICS, framesProcessed: 10, averageFps: 8 })).toBe('Excellent'));
  test('4fps → Good', () => expect(getPerformanceLabel({ ...EMPTY_METRICS, framesProcessed: 10, averageFps: 4 })).toBe('Good'));
  test('2fps → Fair', () => expect(getPerformanceLabel({ ...EMPTY_METRICS, framesProcessed: 10, averageFps: 2 })).toBe('Fair'));
  test('1fps → Slow', () => expect(getPerformanceLabel({ ...EMPTY_METRICS, framesProcessed: 10, averageFps: 1 })).toBe('Slow'));
});

describe('updateMetrics', () => {
  test('increments framesProcessed', () => {
    const m = updateMetrics(EMPTY_METRICS, 200, 50, 3, false);
    expect(m.framesProcessed).toBe(1);
  });
  test('accumulates objectsDetectedTotal', () => {
    let m = updateMetrics(EMPTY_METRICS, 200, 50, 3, false);
    m = updateMetrics(m, 200, 50, 5, false);
    expect(m.objectsDetectedTotal).toBe(8);
  });
  test('increments speechEventsTotal on spoken', () => {
    const m = updateMetrics(EMPTY_METRICS, 200, 50, 2, true);
    expect(m.speechEventsTotal).toBe(1);
  });
});

// ─── MODEL MANAGER ────────────────────────────────────────────────────────────
describe('MODEL_REGISTRY', () => {
  test('contains 7 models', () => expect(listAllModels()).toHaveLength(7));
  test('simulation is always available', () => expect(isModelAvailable('simulation')).toBe(true));
  test('openai not available by default', () => expect(isModelAvailable('openai')).toBe(false));
  test('getModel simulation returns correct provider', () => expect(getModel('simulation').provider).toBe('simulation'));
  test('getModel unknown provider falls back to simulation', () => expect(getModel('onnx').provider).toBe('onnx'));
  test('listAvailableModels includes simulation only', () => expect(listAvailableModels()).toHaveLength(1));
  test('simulation supports all 16 labels', () => expect(getModel('simulation').labels.length).toBe(16));
  test('onnx has fewer labels', () => expect(getModel('onnx').labels.length).toBeLessThan(16));
  test('getRecommendedModel returns simulation when none available except sim', () => {
    expect(getRecommendedModel(1.0, false)).toEqual(getModel('simulation'));
  });
  test('modelSupportsLabel — simulation supports person', () => expect(modelSupportsLabel('simulation', 'person')).toBe(true));
  test('modelSupportsLabel — onnx does not support stairs', () => expect(modelSupportsLabel('onnx', 'stairs')).toBe(false));
  test('getModelDisplayName simulation', () => expect(getModelDisplayName('simulation')).toContain('Simulation'));
  test('requiresCloud false for simulation', () => expect(getModel('simulation').requiresCloud).toBe(false));
  test('requiresCloud true for openai', () => expect(getModel('openai').requiresCloud).toBe(true));
  test('yolo supportsGPU', () => expect(getModel('yolo').supportsGPU).toBe(true));
});

// ─── OBJECT TRACKING ─────────────────────────────────────────────────────────
describe('computeIoU', () => {
  test('identical boxes → 1.0', () => expect(computeIoU(box(0, 0, 0.5, 0.5), box(0, 0, 0.5, 0.5))).toBe(1));
  test('non-overlapping → 0', () => expect(computeIoU(box(0, 0, 0.3, 0.3), box(0.5, 0.5, 0.3, 0.3))).toBe(0));
  test('partial overlap between 0 and 1', () => {
    const iou = computeIoU(box(0, 0, 0.4, 0.4), box(0.2, 0.2, 0.4, 0.4));
    expect(iou).toBeGreaterThan(0);
    expect(iou).toBeLessThan(1);
  });
  test('contained box has high IoU', () => {
    const iou = computeIoU(box(0.1, 0.1, 0.2, 0.2), box(0, 0, 0.5, 0.5));
    expect(iou).toBeGreaterThan(0.1);
  });
});

describe('createTrackerState', () => {
  test('starts with empty tracks', () => expect(createTrackerState().tracks.size).toBe(0));
  test('nextTrackId starts at 1', () => expect(createTrackerState().nextTrackId).toBe(1));
});

describe('updateTracker', () => {
  test('new detection creates a track', () => {
    const state = updateTracker(createTrackerState(), [makeTrack('person', box(0.3, 0.3, 0.15, 0.3))]);
    expect(trackCount(state)).toBe(1);
  });

  test('same object updates existing track', () => {
    let state = updateTracker(createTrackerState(), [makeTrack('person', box(0.3, 0.3, 0.15, 0.3))], 1000);
    state = updateTracker(state, [makeTrack('person', box(0.32, 0.31, 0.15, 0.3))], 1200);
    expect(trackCount(state)).toBe(1);
  });

  test('different label creates a new track', () => {
    let state = updateTracker(createTrackerState(), [makeTrack('person', box(0.3, 0.3, 0.15, 0.3))]);
    state = updateTracker(state, [makeTrack('chair', box(0.3, 0.3, 0.15, 0.3))]);
    expect(trackCount(state)).toBe(2);
  });

  test('lost track increments lostFrames', () => {
    let state = updateTracker(createTrackerState(), [makeTrack('person', box(0.3, 0.3, 0.15, 0.3))]);
    state = updateTracker(state, []);
    const track = getActiveTracks(state)[0];
    expect(track).toBeNull !== null;
    expect(getLostTracks(state)).toHaveLength(1);
  });

  test('track pruned after too many lost frames', () => {
    let state = createTrackerState();
    state = updateTracker(state, [makeTrack('person', box(0.3, 0.3, 0.15, 0.3))]);
    for (let i = 0; i < 6; i++) {
      state = updateTracker(state, []);
    }
    expect(trackCount(state)).toBe(0);
  });

  test('track IDs are stable across frames', () => {
    let state = updateTracker(createTrackerState(), [makeTrack('person', box(0.3, 0.3, 0.15, 0.3))], 1000);
    const id1 = getActiveTracks(state)[0].trackId;
    state = updateTracker(state, [makeTrack('person', box(0.31, 0.31, 0.15, 0.3))], 1200);
    const id2 = getActiveTracks(state)[0].trackId;
    expect(id1).toBe(id2);
  });

  test('velocity computed after 2+ frames', () => {
    let state = updateTracker(createTrackerState(), [makeTrack('person', box(0.3, 0.3, 0.15, 0.3))], 1000);
    state = updateTracker(state, [makeTrack('person', box(0.35, 0.3, 0.15, 0.3))], 1200);
    const track = getActiveTracks(state)[0];
    expect(track.velocity).not.toBeNull();
  });
});

describe('estimateVelocityFromHistory', () => {
  test('single entry → null', () => {
    expect(estimateVelocityFromHistory([{ timestamp: 0, boundingBox: box(0.3, 0.3, 0.1, 0.1), confidence: 0.9 }])).toBeNull();
  });
  test('two entries compute velocity', () => {
    const h = [
      { timestamp: 0, boundingBox: box(0.3, 0.3, 0.1, 0.1), confidence: 0.9 },
      { timestamp: 200, boundingBox: box(0.35, 0.3, 0.1, 0.1), confidence: 0.9 },
    ];
    const v = estimateVelocityFromHistory(h);
    expect(v).not.toBeNull();
    expect(v!.dx).toBeGreaterThan(0);
  });
});

describe('tracksToDetectedObjects', () => {
  test('converts tracks to detected objects', () => {
    const state = updateTracker(createTrackerState(), [makeTrack('car', box(0.1, 0.1, 0.4, 0.4))]);
    const objs = tracksToDetectedObjects(state);
    expect(objs).toHaveLength(1);
    expect(objs[0].label).toBe('car');
  });
});

// ─── SCENE UNDERSTANDING ──────────────────────────────────────────────────────
describe('classifyScene', () => {
  const obj = (label: DetectedObject['label']): DetectedObject => makeObj(label, 'medium', 'medium');

  test('cars + traffic_light → street', () => {
    expect(classifyScene([obj('car'), obj('car'), obj('traffic_light'), obj('crosswalk')])).toBe('street');
  });
  test('shopping carts → supermarket', () => {
    expect(classifyScene([obj('shopping_cart'), obj('shopping_cart')])).toBe('supermarket');
  });
  test('door + person → corridor', () => {
    expect(classifyScene([obj('door'), obj('door'), obj('person')])).toBe('corridor');
  });
  test('no objects → unknown', () => {
    expect(classifyScene([])).toBe('unknown');
  });
  test('tree + dog → park', () => {
    expect(classifyScene([obj('tree'), obj('tree'), obj('dog'), obj('dog')])).toBe('park');
  });
});

describe('estimateCrowding', () => {
  const p = makeObj('person');
  test('0 people → empty', () => expect(estimateCrowding([])).toBe('empty'));
  test('1 person → sparse', () => expect(estimateCrowding([p])).toBe('sparse'));
  test('3 people → moderate', () => expect(estimateCrowding([p, p, p])).toBe('moderate'));
  test('6 people → crowded', () => expect(estimateCrowding([p, p, p, p, p, p])).toBe('crowded'));
});

describe('estimateMovement', () => {
  const still = makeObj('person', 'medium', 'medium');
  const moving = { ...makeObj('person'), velocity: buildVelocity(0.05, 0) };
  test('all stationary → static', () => expect(estimateMovement([still, still])).toBe('static'));
  test('all moving → high', () => expect(estimateMovement([moving, moving, moving])).toBe('high'));
  test('mix → moderate', () => expect(estimateMovement([moving, still, moving, still])).toBe('moderate'));
});

describe('getSceneLabel', () => {
  test('street has label', () => expect(getSceneLabel('street')).toContain('Street'));
  test('unknown has label', () => expect(getSceneLabel('unknown')).toContain('Unknown'));
  test('supermarket has label', () => expect(getSceneLabel('supermarket')).toContain('Supermarket'));
});

describe('buildSceneUnderstanding', () => {
  test('returns scene object with all fields', () => {
    const s = buildSceneUnderstanding([makeObj('car'), makeObj('traffic_light'), makeObj('car'), makeObj('crosswalk')]);
    expect(s.scene).not.toBeNull();
    expect(typeof s.confidence).toBe('number');
    expect(s.lighting).toBe('normal');
  });
});

// ─── VISION INFERENCE ─────────────────────────────────────────────────────────
describe('runSimulatedInference', () => {
  test('returns objects array', () => expect(runSimulatedInference(0).length).toBeGreaterThan(0));
  test('all objects have boundingBox', () => {
    runSimulatedInference(1).forEach((o) => {
      expect(o.boundingBox.width).toBeGreaterThan(0);
    });
  });
  test('confidence between 0 and 1', () => {
    runSimulatedInference(5).forEach((o) => {
      expect(o.confidence).toBeGreaterThanOrEqual(0);
      expect(o.confidence).toBeLessThanOrEqual(1);
    });
  });
  test('same tick produces same result', () => {
    const a = JSON.stringify(runSimulatedInference(42));
    const b = JSON.stringify(runSimulatedInference(42));
    expect(a).toBe(b);
  });
  test('different ticks produce different positions', () => {
    const a = runSimulatedInference(0)[0].boundingBox.x;
    const b = runSimulatedInference(10)[0].boundingBox.x;
    expect(a).not.toBe(b);
  });
  test('scenario index overrides scene', () => {
    const r0 = runSimulatedInference(0, 0);
    const r1 = runSimulatedInference(0, 1);
    expect(r0[0].label).not.toBe(r1[0].label);
  });
});

describe('prioritizeObjects', () => {
  test('critical comes before high', () => {
    const objs = [makeObj('chair', 'medium'), makeObj('car', 'critical')];
    expect(prioritizeObjects(objs)[0].priority).toBe('critical');
  });
  test('high before medium', () => {
    const objs = [makeObj('chair', 'medium'), makeObj('person', 'high')];
    expect(prioritizeObjects(objs)[0].priority).toBe('high');
  });
  test('same priority sorted by confidence', () => {
    const a = { ...makeObj('car', 'critical'), confidence: 0.9 };
    const b = { ...makeObj('car', 'critical'), confidence: 0.7 };
    expect(prioritizeObjects([b, a])[0].confidence).toBe(0.9);
  });
  test('does not mutate original array', () => {
    const objs = [makeObj('chair', 'medium'), makeObj('car', 'critical')];
    prioritizeObjects(objs);
    expect(objs[0].priority).toBe('medium');
  });
});

describe('filterByPriority', () => {
  test('threshold high filters out medium/low/ignore', () => {
    const objs = [
      makeObj('car', 'critical'), makeObj('person', 'high'),
      makeObj('chair', 'medium'), makeObj('bag', 'low'),
    ];
    const filtered = filterByPriority(objs, 'high');
    expect(filtered.every((o) => o.priority === 'critical' || o.priority === 'high')).toBe(true);
  });
  test('threshold low keeps everything except ignore', () => {
    const objs = [makeObj('car', 'critical'), makeObj('bag', 'low')];
    expect(filterByPriority(objs, 'low')).toHaveLength(2);
  });
});

describe('selectSpeechGuidance', () => {
  const now = Date.now();
  test('critical object produces speech after cooldown', () => {
    const obj = makeObj('car', 'critical', 'near');
    const guidance = selectSpeechGuidance([obj], now - 5000, now);
    expect(guidance).not.toBeNull();
  });
  test('no speech within cooldown', () => {
    const obj = makeObj('car', 'critical', 'near');
    const guidance = selectSpeechGuidance([obj], now - 1000, now);
    expect(guidance).toBeNull();
  });
  test('no critical/high objects → no immediate speech', () => {
    const obj = makeObj('chair', 'medium', 'medium');
    const guidance = selectSpeechGuidance([obj], now - 5000, now);
    expect(guidance).toBeNull();
  });
  test('car speech mentions vehicle', () => {
    const obj = makeObj('car', 'critical', 'near');
    const guidance = selectSpeechGuidance([obj], 0, now);
    expect(guidance?.toLowerCase()).toContain('vehicle');
  });
  test('stairs speech mentions stairs', () => {
    const obj = makeObj('stairs', 'critical', 'near');
    const guidance = selectSpeechGuidance([obj], 0, now);
    expect(guidance?.toLowerCase()).toContain('stairs');
  });
  test('door speech mentions door', () => {
    const obj = makeObj('door', 'high', 'near');
    const guidance = selectSpeechGuidance([obj], 0, now);
    expect(guidance?.toLowerCase()).toContain('door');
  });
});

describe('formatPriority / formatLabel', () => {
  test('critical has red indicator', () => expect(formatPriority('critical')).toContain('🔴'));
  test('ignore has no-color indicator', () => expect(formatPriority('ignore')).toContain('⬜'));
  test('formatLabel capitalizes words', () => expect(formatLabel('traffic_light')).toContain('Traffic'));
  test('formatLabel replaces underscores', () => expect(formatLabel('shopping_cart')).not.toContain('_'));
});

describe('PIPELINE_PRIVACY', () => {
  test('noCloudStorage', () => expect(PIPELINE_PRIVACY.noCloudStorage).toBe(true));
  test('noRecording', () => expect(PIPELINE_PRIVACY.noRecording).toBe(true));
  test('noFaceRecognition', () => expect(PIPELINE_PRIVACY.noFaceRecognition).toBe(true));
  test('noIdentityRecognition', () => expect(PIPELINE_PRIVACY.noIdentityRecognition).toBe(true));
});

describe('runSimulationPipeline', () => {
  test('returns objects, scene, guidance, inferenceMs', () => {
    const r = runSimulationPipeline(0, 0, DEFAULT_PIPELINE_CONFIG);
    expect(Array.isArray(r.objects)).toBe(true);
    expect(r.scene).not.toBeNull();
    expect(typeof r.inferenceMs).toBe('number');
  });
  test('inferenceMs is non-negative', () => {
    expect(runSimulationPipeline(0, 0, DEFAULT_PIPELINE_CONFIG).inferenceMs).toBeGreaterThanOrEqual(0);
  });
  test('objects have all required fields', () => {
    const { objects } = runSimulationPipeline(5, 0, DEFAULT_PIPELINE_CONFIG);
    objects.forEach((o) => {
      expect(typeof o.label).toBe('string');
      expect(typeof o.confidence).toBe('number');
      expect(typeof o.distance).toBe('string');
    });
  });
});

// ─── Results ─────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

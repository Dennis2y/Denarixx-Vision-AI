// Sprint 4 — Vision Provider tests
// Tests for categorizeDetections, provider factory behaviour, and VisionAnalysisV4 structure.
// Run: npx tsx tests/visionProvider.test.ts

import {
  categorizeDetections,
  hasAnyDetections,
  getPriorityCategory,
  CATEGORY_PRIORITY_ORDER,
} from '../src/engines/providers/categorizeDetections';

import {
  createVisionAnalysisProvider,
  resetVisionAnalysisProvider,
} from '../src/engines/visionProviderFactory';

import { SimulationVisionProvider } from '../src/engines/providers/SimulationVisionProvider';

import type { DetectedCategories } from '../src/types/vision';
import type { Detection } from '../src/types';

// ─── Minimal test harness ──────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results: string[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result instanceof Promise) {
    return result
      .then(() => { passed++; results.push(`  ✓ ${name}`); })
      .catch((e) => { failed++; results.push(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`); });
  }
  try {
    passed++;
    results.push(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    results.push(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return Promise.resolve();
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toContain(sub: string) {
      if (typeof actual !== 'string') throw new Error(`Expected string`);
      if (!actual.includes(sub)) throw new Error(`Expected "${actual}" to contain "${sub}"`);
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== 'number' || actual <= n)
        throw new Error(`Expected ${JSON.stringify(actual)} > ${n}`);
    },
    toBeLessThanOrEqual(n: number) {
      if (typeof actual !== 'number' || actual > n)
        throw new Error(`Expected ${JSON.stringify(actual)} ≤ ${n}`);
    },
    toBeGreaterThanOrEqual(n: number) {
      if (typeof actual !== 'number' || actual < n)
        throw new Error(`Expected ${JSON.stringify(actual)} ≥ ${n}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
    toHaveLength(n: number) {
      if (!Array.isArray(actual)) throw new Error('Expected array');
      if (actual.length !== n) throw new Error(`Expected length ${n}, got ${actual.length}`);
    },
  };
}

function det(label: string, confidence = 0.9): Detection {
  return { label, confidence };
}

// ─── categorizeDetections — obstacles ──────────────────────────────────────────
const allPromises: Promise<void>[] = [];

console.log('\nvisionProvider — categorizeDetections: obstacles');
allPromises.push(test('obstacle label → obstacles category', () => {
  const r = categorizeDetections([det('obstacle')]);
  expect(r.obstacles).toHaveLength(1);
}));
allPromises.push(test('bollard → obstacles', () => expect(categorizeDetections([det('bollard')]).obstacles).toHaveLength(1)));
allPromises.push(test('bin → obstacles', () => expect(categorizeDetections([det('bin')]).obstacles).toHaveLength(1)));
allPromises.push(test('cone → obstacles', () => expect(categorizeDetections([det('cone')]).obstacles).toHaveLength(1)));
allPromises.push(test('table → obstacles', () => expect(categorizeDetections([det('table')]).obstacles).toHaveLength(1)));
allPromises.push(test('chair → obstacles', () => expect(categorizeDetections([det('chair')]).obstacles).toHaveLength(1)));

// ─── categorizeDetections — people ─────────────────────────────────────────────
console.log('\nvisionProvider — categorizeDetections: people');
allPromises.push(test('person → people', () => expect(categorizeDetections([det('person')]).people).toHaveLength(1)));
allPromises.push(test('pedestrian → people', () => expect(categorizeDetections([det('pedestrian')]).people).toHaveLength(1)));
allPromises.push(test('human → people', () => expect(categorizeDetections([det('human')]).people).toHaveLength(1)));

// ─── categorizeDetections — vehicles ───────────────────────────────────────────
console.log('\nvisionProvider — categorizeDetections: vehicles');
allPromises.push(test('vehicle → vehicles', () => expect(categorizeDetections([det('vehicle')]).vehicles).toHaveLength(1)));
allPromises.push(test('car → vehicles', () => expect(categorizeDetections([det('car')]).vehicles).toHaveLength(1)));
allPromises.push(test('bicycle → vehicles', () => expect(categorizeDetections([det('bicycle')]).vehicles).toHaveLength(1)));
allPromises.push(test('bus → vehicles', () => expect(categorizeDetections([det('bus')]).vehicles).toHaveLength(1)));
allPromises.push(test('motorcycle → vehicles', () => expect(categorizeDetections([det('motorcycle')]).vehicles).toHaveLength(1)));
allPromises.push(test('truck → vehicles', () => expect(categorizeDetections([det('truck')]).vehicles).toHaveLength(1)));
allPromises.push(test('cyclist → vehicles', () => expect(categorizeDetections([det('cyclist')]).vehicles).toHaveLength(1)));

// ─── categorizeDetections — stairs ─────────────────────────────────────────────
console.log('\nvisionProvider — categorizeDetections: stairs');
allPromises.push(test('stairs → stairs', () => expect(categorizeDetections([det('stairs')]).stairs).toHaveLength(1)));
allPromises.push(test('step → stairs', () => expect(categorizeDetections([det('step')]).stairs).toHaveLength(1)));
allPromises.push(test('staircase → stairs', () => expect(categorizeDetections([det('staircase')]).stairs).toHaveLength(1)));
allPromises.push(test('escalator → stairs', () => expect(categorizeDetections([det('escalator')]).stairs).toHaveLength(1)));

// ─── categorizeDetections — doors ──────────────────────────────────────────────
console.log('\nvisionProvider — categorizeDetections: doors');
allPromises.push(test('door → doors', () => expect(categorizeDetections([det('door')]).doors).toHaveLength(1)));
allPromises.push(test('gate → doors', () => expect(categorizeDetections([det('gate')]).doors).toHaveLength(1)));
allPromises.push(test('entrance → doors', () => expect(categorizeDetections([det('entrance')]).doors).toHaveLength(1)));
allPromises.push(test('exit → doors', () => expect(categorizeDetections([det('exit')]).doors).toHaveLength(1)));

// ─── categorizeDetections — crossings ──────────────────────────────────────────
console.log('\nvisionProvider — categorizeDetections: crossings');
allPromises.push(test('crossing → crossings', () => expect(categorizeDetections([det('crossing')]).crossings).toHaveLength(1)));
allPromises.push(test('road → crossings', () => expect(categorizeDetections([det('road')]).crossings).toHaveLength(1)));
allPromises.push(test('intersection → crossings', () => expect(categorizeDetections([det('intersection')]).crossings).toHaveLength(1)));
allPromises.push(test('crosswalk → crossings', () => expect(categorizeDetections([det('crosswalk')]).crossings).toHaveLength(1)));
allPromises.push(test('pavement → crossings', () => expect(categorizeDetections([det('pavement')]).crossings).toHaveLength(1)));

// ─── categorizeDetections — signs ──────────────────────────────────────────────
console.log('\nvisionProvider — categorizeDetections: signs');
allPromises.push(test('sign → signs', () => expect(categorizeDetections([det('sign')]).signs).toHaveLength(1)));
allPromises.push(test('text → signs', () => expect(categorizeDetections([det('text')]).signs).toHaveLength(1)));
allPromises.push(test('traffic_light → signs', () => expect(categorizeDetections([det('traffic_light')]).signs).toHaveLength(1)));
allPromises.push(test('signal → signs', () => expect(categorizeDetections([det('signal')]).signs).toHaveLength(1)));

// ─── categorizeDetections — edge cases ─────────────────────────────────────────
console.log('\nvisionProvider — categorizeDetections: edge cases');
allPromises.push(test('empty detections → all categories empty', () => {
  const r = categorizeDetections([]);
  const allEmpty = Object.values(r).every(arr => arr.length === 0);
  if (!allEmpty) throw new Error('Expected all categories to be empty');
}));
allPromises.push(test('unknown label → no categories', () => {
  const r = categorizeDetections([det('foobar_unknown')]);
  const total = Object.values(r).reduce((sum, arr) => sum + arr.length, 0);
  expect(total).toBe(0);
}));
allPromises.push(test('case-insensitive matching', () => {
  expect(categorizeDetections([det('PERSON')]).people).toHaveLength(1);
}));
allPromises.push(test('mixed case matching', () => {
  expect(categorizeDetections([det('Vehicle')]).vehicles).toHaveLength(1);
}));
allPromises.push(test('multiple detections in same category', () => {
  const r = categorizeDetections([det('car'), det('bus'), det('truck')]);
  expect(r.vehicles).toHaveLength(3);
}));
allPromises.push(test('all 7 category keys are present in result', () => {
  const r = categorizeDetections([]);
  const keys = Object.keys(r).sort();
  const expected = ['crossings', 'doors', 'obstacles', 'people', 'signs', 'stairs', 'vehicles'];
  if (JSON.stringify(keys) !== JSON.stringify(expected))
    throw new Error(`Keys mismatch: ${JSON.stringify(keys)}`);
}));
allPromises.push(test('detection confidence is preserved in category', () => {
  const r = categorizeDetections([{ label: 'vehicle', confidence: 0.77 }]);
  expect(r.vehicles[0].confidence).toBe(0.77);
}));

// ─── hasAnyDetections ──────────────────────────────────────────────────────────
console.log('\nvisionProvider — hasAnyDetections');
allPromises.push(test('all empty → false', () => {
  const r = categorizeDetections([]);
  expect(hasAnyDetections(r)).toBe(false);
}));
allPromises.push(test('one detection → true', () => {
  const r = categorizeDetections([det('person')]);
  expect(hasAnyDetections(r)).toBe(true);
}));
allPromises.push(test('vehicle detection → true', () => {
  expect(hasAnyDetections(categorizeDetections([det('car')]))).toBe(true);
}));
allPromises.push(test('sign detection → true', () => {
  expect(hasAnyDetections(categorizeDetections([det('sign')]))).toBe(true);
}));

// ─── getPriorityCategory ───────────────────────────────────────────────────────
console.log('\nvisionProvider — getPriorityCategory');
allPromises.push(test('empty → null', () => {
  expect(getPriorityCategory(categorizeDetections([]))).toBeNull();
}));
allPromises.push(test('vehicle alone → vehicles', () => {
  expect(getPriorityCategory(categorizeDetections([det('car')]))).toBe('vehicles');
}));
allPromises.push(test('stairs alone → stairs', () => {
  expect(getPriorityCategory(categorizeDetections([det('stairs')]))).toBe('stairs');
}));
allPromises.push(test('sign alone → signs', () => {
  expect(getPriorityCategory(categorizeDetections([det('sign')]))).toBe('signs');
}));
allPromises.push(test('vehicle + sign → vehicles (higher priority)', () => {
  expect(getPriorityCategory(categorizeDetections([det('car'), det('sign')]))).toBe('vehicles');
}));
allPromises.push(test('stairs + sign → stairs (higher priority)', () => {
  expect(getPriorityCategory(categorizeDetections([det('stairs'), det('sign')]))).toBe('stairs');
}));
allPromises.push(test('crossing + door → crossings (higher priority)', () => {
  expect(getPriorityCategory(categorizeDetections([det('crossing'), det('door')]))).toBe('crossings');
}));
allPromises.push(test('CATEGORY_PRIORITY_ORDER has 7 entries', () => {
  expect(CATEGORY_PRIORITY_ORDER.length).toBe(7);
}));

// ─── Provider factory ──────────────────────────────────────────────────────────
console.log('\nvisionProvider — factory');
allPromises.push(test('default (no env var) → simulation provider', () => {
  resetVisionAnalysisProvider();
  const saved = process.env.VISION_PROVIDER;
  delete process.env.VISION_PROVIDER;
  const provider = createVisionAnalysisProvider();
  if (saved !== undefined) process.env.VISION_PROVIDER = saved;
  expect(provider.providerName).toBe('SimulationVisionProvider');
  expect(provider.isRealAI).toBe(false);
}));
allPromises.push(test('VISION_PROVIDER=simulation → simulation', () => {
  resetVisionAnalysisProvider();
  process.env.VISION_PROVIDER = 'simulation';
  const provider = createVisionAnalysisProvider();
  expect(provider.providerName).toBe('SimulationVisionProvider');
}));
allPromises.push(test('VISION_PROVIDER=openai without OPENAI_API_KEY → simulation fallback', () => {
  resetVisionAnalysisProvider();
  const savedProvider = process.env.VISION_PROVIDER;
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.VISION_PROVIDER = 'openai';
  delete process.env.OPENAI_API_KEY;
  const provider = createVisionAnalysisProvider();
  process.env.VISION_PROVIDER = savedProvider ?? '';
  if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
  expect(provider.providerName).toBe('SimulationVisionProvider');
}));
allPromises.push(test('VISION_PROVIDER=gemini without GEMINI_API_KEY → simulation fallback', () => {
  resetVisionAnalysisProvider();
  const savedProvider = process.env.VISION_PROVIDER;
  const savedKey = process.env.GEMINI_API_KEY;
  process.env.VISION_PROVIDER = 'gemini';
  delete process.env.GEMINI_API_KEY;
  const provider = createVisionAnalysisProvider();
  process.env.VISION_PROVIDER = savedProvider ?? '';
  if (savedKey !== undefined) process.env.GEMINI_API_KEY = savedKey;
  expect(provider.providerName).toBe('SimulationVisionProvider');
}));
allPromises.push(test('unknown VISION_PROVIDER → simulation fallback', () => {
  resetVisionAnalysisProvider();
  process.env.VISION_PROVIDER = 'nonexistent_provider_xyz';
  const provider = createVisionAnalysisProvider();
  delete process.env.VISION_PROVIDER;
  expect(provider.providerName).toBe('SimulationVisionProvider');
}));

// ─── SimulationVisionProvider analysis ────────────────────────────────────────
console.log('\nvisionProvider — SimulationVisionProvider.analyzeFrameV4');
const frame = { timestamp: new Date(), source: 'simulation' as const };

allPromises.push(test('returns valid VisionAnalysisV4 structure', async () => {
  const provider = new SimulationVisionProvider();
  const result = await provider.analyzeFrameV4(frame, null);
  if (typeof result.environment !== 'string') throw new Error('missing environment');
  if (!Array.isArray(result.objects)) throw new Error('missing objects');
  if (!Array.isArray(result.hazards)) throw new Error('missing hazards');
  if (typeof result.confidence !== 'number') throw new Error('missing confidence');
  if (typeof result.recommendedAction !== 'string') throw new Error('missing recommendedAction');
  if (typeof result.reasoning !== 'string') throw new Error('missing reasoning');
  if (typeof result.provider !== 'string') throw new Error('missing provider');
  if (typeof result.isRealAI !== 'boolean') throw new Error('missing isRealAI');
  if (typeof result.usedFallback !== 'boolean') throw new Error('missing usedFallback');
}));
allPromises.push(test('isRealAI is false', async () => {
  const provider = new SimulationVisionProvider();
  const result = await provider.analyzeFrameV4(frame, null);
  expect(result.isRealAI).toBe(false);
}));
allPromises.push(test('usedFallback is false', async () => {
  const provider = new SimulationVisionProvider();
  const result = await provider.analyzeFrameV4(frame, null);
  expect(result.usedFallback).toBe(false);
}));
allPromises.push(test('categories field is populated', async () => {
  const provider = new SimulationVisionProvider();
  const result = await provider.analyzeFrameV4(frame, null);
  if (!result.categories) throw new Error('categories field missing');
  const keys = Object.keys(result.categories).sort();
  const expected = ['crossings', 'doors', 'obstacles', 'people', 'signs', 'stairs', 'vehicles'];
  if (JSON.stringify(keys) !== JSON.stringify(expected))
    throw new Error(`categories keys: ${JSON.stringify(keys)}`);
}));
allPromises.push(test('confidence is between 0 and 1', async () => {
  const provider = new SimulationVisionProvider();
  const result = await provider.analyzeFrameV4(frame, null);
  if (result.confidence < 0 || result.confidence > 1)
    throw new Error(`confidence out of range: ${result.confidence}`);
}));
allPromises.push(test('environment is non-empty string', async () => {
  const provider = new SimulationVisionProvider();
  const result = await provider.analyzeFrameV4(frame, null);
  expect(result.environment.length).toBeGreaterThan(0);
}));
allPromises.push(test('recommendedAction is non-empty string', async () => {
  const provider = new SimulationVisionProvider();
  const result = await provider.analyzeFrameV4(frame, null);
  expect(result.recommendedAction.length).toBeGreaterThan(0);
}));
allPromises.push(test('no face recognition data in output', async () => {
  const provider = new SimulationVisionProvider();
  const result = await provider.analyzeFrameV4(frame, null);
  const resultStr = JSON.stringify(result).toLowerCase();
  if (resultStr.includes('face') || resultStr.includes('name') || resultStr.includes('identity'))
    throw new Error('Face recognition data detected in output — privacy violation');
}));
allPromises.push(test('provider name is SimulationVisionProvider', async () => {
  const provider = new SimulationVisionProvider();
  const result = await provider.analyzeFrameV4(frame, null);
  expect(result.provider).toBe('SimulationVisionProvider');
}));
allPromises.push(test('objects array is subset of categories detections', async () => {
  const provider = new SimulationVisionProvider();
  const result = await provider.analyzeFrameV4(frame, null);
  // categories contains a subset of objects (only those matching known labels)
  const categorised = Object.values(result.categories).flat();
  const objectLabels = new Set(result.objects.map(o => o.label));
  for (const c of categorised) {
    if (!objectLabels.has(c.label))
      throw new Error(`Category item "${c.label}" not in objects`);
  }
}));

// ─── VisionHazardResult structure ─────────────────────────────────────────────
console.log('\nvisionProvider — VisionHazardResult structure');
allPromises.push(test('hazards have required fields', async () => {
  const provider = new SimulationVisionProvider();
  // Run multiple frames to get a frame with hazards
  let hazards;
  for (let i = 0; i < 10; i++) {
    const r = await provider.analyzeFrameV4(frame, null);
    if (r.hazards.length > 0) { hazards = r.hazards; break; }
  }
  if (!hazards) { results.push('  (skipped — no hazards in 10 frames)'); return; }
  for (const h of hazards) {
    if (!h.type) throw new Error('hazard missing type');
    if (!h.severity) throw new Error('hazard missing severity');
    if (typeof h.confidence !== 'number') throw new Error('hazard missing confidence');
    if (!h.description) throw new Error('hazard missing description');
    if (!['critical', 'high', 'medium', 'low'].includes(h.severity))
      throw new Error(`invalid severity: ${h.severity}`);
  }
}));
allPromises.push(test('hazard confidence is between 0 and 1', async () => {
  const provider = new SimulationVisionProvider();
  for (let i = 0; i < 6; i++) {
    const r = await provider.analyzeFrameV4(frame, null);
    for (const h of r.hazards) {
      if (h.confidence < 0 || h.confidence > 1)
        throw new Error(`hazard confidence out of range: ${h.confidence}`);
    }
  }
}));

// ─── Privacy constraints ───────────────────────────────────────────────────────
console.log('\nvisionProvider — privacy constraints');
allPromises.push(test('SimulationVisionProvider.isRealAI is false', () => {
  const provider = new SimulationVisionProvider();
  expect(provider.isRealAI).toBe(false);
}));
allPromises.push(test('SimulationVisionProvider.providerName is non-empty', () => {
  const provider = new SimulationVisionProvider();
  expect(provider.providerName.length).toBeGreaterThan(0);
}));
allPromises.push(test('factory simulation provider isRealAI is false', () => {
  resetVisionAnalysisProvider();
  process.env.VISION_PROVIDER = 'simulation';
  const provider = createVisionAnalysisProvider();
  expect(provider.isRealAI).toBe(false);
}));

// ─── Run all and print results ─────────────────────────────────────────────────
Promise.all(allPromises).then(() => {
  console.log('\n' + results.join('\n'));
  console.log('\n─────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});

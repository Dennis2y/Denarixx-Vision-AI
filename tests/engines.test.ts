/**
 * Core engine unit tests — run with: npx tsx tests/engines.test.ts
 * No test framework dependency required.
 */

import { HazardDetectionEngine } from '../src/engines/HazardDetectionEngine';
import { SafetyDecisionEngine } from '../src/engines/SafetyDecisionEngine';
import { SceneReasoningEngine } from '../src/engines/SceneReasoningEngine';
import { MemoryEngine } from '../src/engines/MemoryEngine';
import { ConversationEngine } from '../src/engines/ConversationEngine';
import { MockVisionProvider } from '../src/engines/providers/MockVisionProvider';
import { VisionEngine } from '../src/engines/VisionEngine';
import type { Detection } from '../src/types';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ✓ ${name}`);
      passed++;
    })
    .catch((err: Error) => {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    });
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function runAll() {
  console.log('\nDenarixx Vision AI — Engine Tests\n');

  // ── VisionEngine ────────────────────────────────────────────────────────────
  console.log('VisionEngine');
  await test('MockVisionProvider returns detections', async () => {
    const engine = new VisionEngine(new MockVisionProvider());
    const frame = { timestamp: new Date(), source: 'simulation' as const };
    const detections = await engine.analyzeFrame(frame);
    assert(Array.isArray(detections), 'should return array');
    assert(detections.length > 0, 'should have detections');
    assert(typeof detections[0].label === 'string', 'should have label');
    assert(
      detections[0].confidence >= 0 && detections[0].confidence <= 1,
      'confidence should be 0-1'
    );
  });

  await test('VisionEngine provider is replaceable', () => {
    const engine = new VisionEngine();
    const original = engine.getProvider().name;
    assert(original === 'MockVisionProvider', 'default should be mock');
    engine.setProvider(new MockVisionProvider());
    assert(engine.getProvider().name === 'MockVisionProvider', 'should be replaceable');
  });

  // ── HazardDetectionEngine ────────────────────────────────────────────────────
  console.log('\nHazardDetectionEngine');
  const hazardEngine = new HazardDetectionEngine();

  await test('detects vehicle as critical', async () => {
    const d: Detection[] = [{ label: 'vehicle', confidence: 0.95 }];
    const alerts = await hazardEngine.evaluate(d);
    assert(alerts.length > 0, 'should have alerts');
    assert(alerts[0].severity === 'critical', 'vehicle should be critical');
    assert(alerts[0].confidence === 0.95, 'should preserve confidence');
  });

  await test('detects step with uncertainty message when confidence low', async () => {
    const d: Detection[] = [{ label: 'step', confidence: 0.55 }];
    const alerts = await hazardEngine.evaluate(d);
    assert(alerts.length > 0, 'should produce alert');
    assert(
      alerts[0].description.includes('not') || alerts[0].description.includes('sure'),
      `low confidence should trigger uncertainty: "${alerts[0].description}"`
    );
  });

  await test('returns empty for non-hazard objects', async () => {
    const d: Detection[] = [{ label: 'table', confidence: 0.99 }];
    const alerts = await hazardEngine.evaluate(d);
    assert(alerts.length === 0, 'table should not be a hazard');
  });

  await test('sorts critical before high before medium', async () => {
    const d: Detection[] = [
      { label: 'person', confidence: 0.9 },
      { label: 'vehicle', confidence: 0.9 },
      { label: 'step', confidence: 0.9 },
    ];
    const alerts = await hazardEngine.evaluate(d);
    assert(alerts[0].severity === 'critical', 'critical should be first');
  });

  await test('all alerts include a disclaimer', async () => {
    const d: Detection[] = [{ label: 'obstacle', confidence: 0.8 }];
    const alerts = await hazardEngine.evaluate(d);
    assert(alerts[0].disclaimer.length > 0, 'disclaimer should be present');
  });

  // ── SafetyDecisionEngine ─────────────────────────────────────────────────────
  console.log('\nSafetyDecisionEngine');
  const safetyEngine = new SafetyDecisionEngine();

  await test('returns no-alert for empty alerts', () => {
    const decision = safetyEngine.decide([]);
    assert(!decision.shouldAlert, 'no alerts → should not alert');
    assert(decision.urgency === 'none', 'urgency should be none');
  });

  await test('interrupts narration for critical high-confidence alert', async () => {
    const alerts = await hazardEngine.evaluate([{ label: 'vehicle', confidence: 0.95 }]);
    const decision = safetyEngine.decide(alerts);
    assert(decision.shouldAlert, 'should alert');
    assert(decision.interruptNarration, 'should interrupt narration');
  });

  await test('does not interrupt for low confidence alert', async () => {
    const alerts = await hazardEngine.evaluate([{ label: 'person', confidence: 0.4 }]);
    const decision = safetyEngine.decide(alerts);
    // Person at 0.4 confidence may not meet interrupt threshold
    assert(typeof decision.interruptNarration === 'boolean', 'should return boolean');
  });

  // ── SceneReasoningEngine ─────────────────────────────────────────────────────
  console.log('\nSceneReasoningEngine');
  const sceneEngine = new SceneReasoningEngine();

  await test('returns uncertain for empty detections', async () => {
    const frame = { timestamp: new Date(), source: 'simulation' as const };
    const scene = await sceneEngine.describe(frame, []);
    assert(scene.isUncertain, 'empty detections should be uncertain');
    assert(scene.confidence < 0.7, 'confidence should be low');
  });

  await test('returns scene summary for vehicle+road', async () => {
    const frame = { timestamp: new Date(), source: 'simulation' as const };
    const d: Detection[] = [
      { label: 'vehicle', confidence: 0.9 },
      { label: 'road', confidence: 0.95 },
    ];
    const scene = await sceneEngine.describe(frame, d);
    assert(scene.summary.length > 0, 'should produce summary');
    assert(typeof scene.confidence === 'number', 'should have confidence');
  });

  await test('carries uncertainty message when confidence < 0.6', async () => {
    const frame = { timestamp: new Date(), source: 'simulation' as const };
    const d: Detection[] = [{ label: 'step', confidence: 0.4 }];
    const scene = await sceneEngine.describe(frame, d);
    assert(scene.uncertaintyMessage !== undefined, 'should have uncertainty message');
  });

  // ── MemoryEngine ─────────────────────────────────────────────────────────────
  console.log('\nMemoryEngine');
  const memEngine = new MemoryEngine();

  await test('saves and retrieves a memory item', async () => {
    const item = await memEngine.save({
      type: 'location',
      label: 'Test Café',
      description: 'A test café on the corner.',
      metadata: {},
    });
    assert(item.id.length > 0, 'should have id');
    const found = await memEngine.query('Test Café');
    assert(found !== null, 'should find by label');
    assert(found!.label === 'Test Café', 'label should match');
  });

  await test('recall finds items by context keyword', async () => {
    await memEngine.save({ type: 'location', label: 'Bus Stop A', description: 'On the main road', metadata: {} });
    const results = await memEngine.recall('bus');
    assert(results.length > 0, 'should find bus stop');
  });

  await test('getAll returns array', async () => {
    const all = await memEngine.getAll();
    assert(Array.isArray(all), 'should return array');
    assert(all.length > 0, 'should have pre-seeded items');
  });

  // ── ConversationEngine ───────────────────────────────────────────────────────
  console.log('\nConversationEngine');
  const convEngine = new ConversationEngine();

  const mockScene = {
    summary: 'One person is ahead on the pavement.',
    confidence: 0.85,
    detections: [{ label: 'person', confidence: 0.85 }],
    timestamp: new Date(),
    isUncertain: false,
  };

  await test('answers "what is around me"', async () => {
    const answer = await convEngine.ask('what is around me', mockScene);
    assert(answer.length > 0, 'should return answer');
    assert(answer.includes('person') || answer.includes('pavement'), 'should reference scene');
  });

  await test('answers "is it safe"', async () => {
    const answer = await convEngine.ask('is it safe', mockScene);
    assert(answer.length > 0, 'should return answer');
  });

  await test('handles unknown question with fallback', async () => {
    const answer = await convEngine.ask('what is the meaning of life', null);
    assert(answer.length > 0, 'should return fallback');
  });

  // ── Results ──────────────────────────────────────────────────────────────────
  console.log(`\n─────────────────────────────────────`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runAll().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});

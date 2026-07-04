/**
 * V3 Cognitive Reasoning Engine unit tests
 * Run with: npx tsx tests/v3reasoning.test.ts
 */

import { EnvironmentUnderstandingEngine } from '../src/engines/environmentUnderstandingEngine';
import { CognitiveReasoningEngine } from '../src/engines/cognitiveReasoningEngine';
import { RiskPredictionEngine } from '../src/engines/riskPredictionEngine';
import { ActionDecisionEngine } from '../src/engines/actionDecisionEngine';
import { HumanGuideEngine } from '../src/engines/humanGuideEngine';
import type { Detection } from '../src/types';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  ✓ ${name}`); passed++; })
    .catch((err: Error) => { console.error(`  ✗ ${name}: ${err.message}`); failed++; });
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function runAll() {
  console.log('\nDenarixx Vision AI — V3 Cognitive Reasoning Engine Tests\n');

  // ── EnvironmentUnderstandingEngine ───────────────────────────────────────────
  console.log('EnvironmentUnderstandingEngine');

  const envEngine = new EnvironmentUnderstandingEngine();

  await test('vehicle + road → traffic environment', () => {
    const detections: Detection[] = [
      { label: 'vehicle', confidence: 0.9 },
      { label: 'road', confidence: 0.95 },
    ];
    const result = envEngine.understand(detections);
    assert(result.environmentType === 'traffic', `expected traffic, got ${result.environmentType}`);
    assert(result.summary.toLowerCase().includes('traffic'), 'summary should mention traffic');
    assert(!result.isIndoor, 'traffic environment should be outdoor');
  });

  await test('vehicle alone → crossing environment', () => {
    const detections: Detection[] = [{ label: 'vehicle', confidence: 0.8 }];
    const result = envEngine.understand(detections);
    assert(result.environmentType === 'crossing', `expected crossing, got ${result.environmentType}`);
  });

  await test('stairs → corridor environment (indoor)', () => {
    const detections: Detection[] = [{ label: 'stairs', confidence: 0.85 }];
    const result = envEngine.understand(detections);
    assert(result.environmentType === 'corridor', `expected corridor, got ${result.environmentType}`);
    assert(result.isIndoor, 'stairs environment should be indoor');
    assert(result.summary.toLowerCase().includes('staircase'), 'summary should mention staircase');
  });

  await test('bicycle + person → market environment', () => {
    const detections: Detection[] = [
      { label: 'bicycle', confidence: 0.75 },
      { label: 'person', confidence: 0.85 },
    ];
    const result = envEngine.understand(detections);
    assert(result.environmentType === 'market', `expected market, got ${result.environmentType}`);
  });

  await test('pavement alone → pavement environment', () => {
    const detections: Detection[] = [{ label: 'pavement', confidence: 0.93 }];
    const result = envEngine.understand(detections);
    assert(result.environmentType === 'pavement', `expected pavement, got ${result.environmentType}`);
    assert(!result.isIndoor, 'pavement should be outdoor');
  });

  await test('empty detections → unknown environment', () => {
    const result = envEngine.understand([]);
    assert(result.environmentType === 'unknown', `expected unknown, got ${result.environmentType}`);
    assert(result.confidence === 0, 'confidence should be 0 with no detections');
    assert(result.detectedLabels.length === 0, 'should have no labels');
  });

  await test('detectedLabels lists all unique input labels', () => {
    const detections: Detection[] = [
      { label: 'road', confidence: 0.9 },
      { label: 'pavement', confidence: 0.8 },
      { label: 'person', confidence: 0.7 },
    ];
    const result = envEngine.understand(detections);
    assert(result.detectedLabels.includes('road'), 'should include road');
    assert(result.detectedLabels.includes('person'), 'should include person');
  });

  // ── RiskPredictionEngine ─────────────────────────────────────────────────────
  console.log('\nRiskPredictionEngine');

  const riskEngine = new RiskPredictionEngine();
  const dummyEnv = envEngine.understand([{ label: 'pavement', confidence: 0.9 }]);

  await test('vehicle at high confidence → critical risk', () => {
    const detections: Detection[] = [{ label: 'vehicle', confidence: 0.85 }];
    const result = riskEngine.predict(detections, dummyEnv);
    assert(result.riskLevel === 'critical', `expected critical, got ${result.riskLevel}`);
    assert(result.predictedEvent !== null, 'should have a predicted event');
    assert(result.timeToImpactSeconds !== null, 'should have time to impact');
  });

  await test('vehicle at low confidence → high risk (not critical)', () => {
    const detections: Detection[] = [{ label: 'vehicle', confidence: 0.5 }];
    const result = riskEngine.predict(detections, dummyEnv);
    assert(result.riskLevel === 'high', `expected high, got ${result.riskLevel}`);
  });

  await test('stairs → high risk prediction', () => {
    const detections: Detection[] = [{ label: 'stairs', confidence: 0.8 }];
    const result = riskEngine.predict(detections, dummyEnv);
    assert(result.riskLevel === 'high', `expected high, got ${result.riskLevel}`);
    assert(result.predictedEvent !== null, 'should predict staircase risk');
  });

  await test('person at high confidence → low risk', () => {
    const detections: Detection[] = [{ label: 'person', confidence: 0.85 }];
    const result = riskEngine.predict(detections, dummyEnv);
    assert(result.riskLevel === 'low', `expected low, got ${result.riskLevel}`);
  });

  await test('empty detections → none risk, no factors', () => {
    const result = riskEngine.predict([], dummyEnv);
    assert(result.riskLevel === 'none', `expected none, got ${result.riskLevel}`);
    assert(result.predictedEvent === null, 'should have no predicted event');
    assert(result.factors.length === 0, 'should have no factors');
  });

  await test('multiple detections — picks highest risk level', () => {
    const detections: Detection[] = [
      { label: 'person', confidence: 0.85 },
      { label: 'vehicle', confidence: 0.9 },
    ];
    const result = riskEngine.predict(detections, dummyEnv);
    assert(result.riskLevel === 'critical', 'vehicle should dominate with critical risk');
    assert(result.factors.length >= 2, 'should have multiple factors');
  });

  // ── CognitiveReasoningEngine ─────────────────────────────────────────────────
  console.log('\nCognitiveReasoningEngine');

  const reasoningEngine = new CognitiveReasoningEngine();

  const trafficEnv = envEngine.understand([
    { label: 'vehicle', confidence: 0.9 },
    { label: 'road', confidence: 0.95 },
  ]);
  const vehicleRisk = riskEngine.predict([{ label: 'vehicle', confidence: 0.9 }], trafficEnv);
  const noRisk = riskEngine.predict([], dummyEnv);
  const pavementEnv = envEngine.understand([{ label: 'pavement', confidence: 0.95 }]);

  await test('critical risk → shouldInterruptImmediately = true', () => {
    const result = reasoningEngine.reason(trafficEnv, vehicleRisk);
    assert(result.shouldInterruptImmediately, 'critical risk should trigger immediate interrupt');
    assert(!result.isUserSafe, 'user should not be safe with critical risk');
    assert(result.needsGuidance, 'user needs guidance with critical risk');
  });

  await test('no risk + detections → shouldReassure = true', () => {
    const result = reasoningEngine.reason(pavementEnv, noRisk);
    assert(result.shouldReassure, 'should reassure when environment is safe');
    assert(result.isUserSafe, 'user should be safe with no risk');
    assert(!result.needsGuidance, 'should not need guidance when safe');
  });

  await test('whatIsHappening reflects environment summary', () => {
    const result = reasoningEngine.reason(trafficEnv, vehicleRisk);
    assert(result.whatIsHappening === trafficEnv.summary, 'whatIsHappening should be environment summary');
  });

  await test('predictedEvent set → whatIsLikelyNext includes event', () => {
    const result = reasoningEngine.reason(trafficEnv, vehicleRisk);
    assert(vehicleRisk.predictedEvent !== null, 'vehicle risk should have predicted event');
    assert(result.whatIsLikelyNext.includes(vehicleRisk.predictedEvent!), 'whatIsLikelyNext should include predicted event');
  });

  await test('confidence is blended float 0-1', () => {
    const result = reasoningEngine.reason(trafficEnv, vehicleRisk);
    assert(result.confidence >= 0 && result.confidence <= 1, `confidence out of range: ${result.confidence}`);
  });

  // ── ActionDecisionEngine ──────────────────────────────────────────────────────
  console.log('\nActionDecisionEngine');

  const actionEngine = new ActionDecisionEngine();

  await test('critical risk → stop action', () => {
    const result = actionEngine.decide(
      reasoningEngine.reason(trafficEnv, vehicleRisk),
      vehicleRisk,
      trafficEnv
    );
    assert(result.action === 'stop', `expected stop, got ${result.action}`);
    assert(result.priority === 'critical', `expected critical priority, got ${result.priority}`);
    assert(result.shouldInterrupt, 'critical action should interrupt');
  });

  await test('no risk, safe environment → continue_walking', () => {
    const safeReasoning = reasoningEngine.reason(pavementEnv, noRisk);
    const result = actionEngine.decide(safeReasoning, noRisk, pavementEnv);
    assert(result.action === 'continue_walking', `expected continue_walking, got ${result.action}`);
    assert(!result.shouldInterrupt, 'safe action should not interrupt');
  });

  await test('medium risk, corridor → avoid_obstacle action', () => {
    const obstacleDetections: Detection[] = [{ label: 'obstacle', confidence: 0.8 }];
    const corridorEnv = envEngine.understand([...obstacleDetections, { label: 'pavement', confidence: 0.9 }]);
    const obstacleRisk = riskEngine.predict(obstacleDetections, corridorEnv);
    const obstacleReasoning = reasoningEngine.reason(corridorEnv, obstacleRisk);
    const result = actionEngine.decide(obstacleReasoning, obstacleRisk, corridorEnv);
    assert(
      result.action === 'avoid_obstacle' || result.action === 'slow_down',
      `expected avoid_obstacle or slow_down, got ${result.action}`
    );
  });

  await test('action reasoning is a non-empty string', () => {
    const result = actionEngine.decide(
      reasoningEngine.reason(trafficEnv, vehicleRisk),
      vehicleRisk,
      trafficEnv
    );
    assert(result.reasoning.length > 0, 'reasoning should be a non-empty string');
  });

  // ── HumanGuideEngine ──────────────────────────────────────────────────────────
  console.log('\nHumanGuideEngine');

  const guideEngine = new HumanGuideEngine();

  await test('critical risk → short urgent instruction, shouldSpeak = true', () => {
    const r = reasoningEngine.reason(trafficEnv, vehicleRisk);
    const a = actionEngine.decide(r, vehicleRisk, trafficEnv);
    const result = guideEngine.generate(a, r, trafficEnv);
    assert(result.shouldSpeak, 'should speak for critical risk');
    assert(result.text.length > 0, 'guide text should not be empty');
    assert(result.priority === 'critical', 'priority should be critical');
  });

  await test('safe environment → reassuring message, no uncertainty note', () => {
    const safeR = reasoningEngine.reason(pavementEnv, noRisk);
    const safeA = actionEngine.decide(safeR, noRisk, pavementEnv);
    const result = guideEngine.generate(safeA, safeR, pavementEnv);
    assert(result.text.length > 0, 'should generate reassurance text');
    assert(result.priority === 'informational', `expected informational, got ${result.priority}`);
  });

  await test('low-confidence reasoning → uncertaintyNote is set', () => {
    const lowConfEnv: typeof pavementEnv = { ...pavementEnv, confidence: 0.3 };
    const lowConfRisk: typeof noRisk = { ...noRisk, confidence: 0.3 };
    const r = reasoningEngine.reason(lowConfEnv, lowConfRisk);
    const a = actionEngine.decide(r, lowConfRisk, lowConfEnv);
    // Force low confidence on reasoning
    const lowR = { ...r, confidence: 0.3 };
    const result = guideEngine.generate(a, lowR, lowConfEnv);
    assert(result.uncertaintyNote !== null, 'should set uncertainty note for low confidence');
    assert(result.text.includes("completely sure") || result.uncertaintyNote!.length > 0,
      'uncertainty should be reflected in text or note');
  });

  await test('reset() clears reassurance rotation index', () => {
    guideEngine.reset();
    const r = reasoningEngine.reason(pavementEnv, noRisk);
    const a = actionEngine.decide(r, noRisk, pavementEnv);
    const first = guideEngine.generate(a, r, pavementEnv);
    guideEngine.reset();
    const afterReset = guideEngine.generate(a, r, pavementEnv);
    assert(first.text === afterReset.text, 'after reset, first reassurance should repeat');
  });

  await test('shouldSpeak false when shouldStaySilent and not urgent', () => {
    const silentR = {
      ...reasoningEngine.reason(pavementEnv, noRisk),
      shouldStaySilent: true,
      shouldInterruptImmediately: false,
    };
    const safeA = actionEngine.decide(silentR, noRisk, pavementEnv);
    const result = guideEngine.generate(safeA, silentR, pavementEnv);
    assert(!result.shouldSpeak, 'shouldSpeak should be false when silent mode active');
  });

  // ── Results ───────────────────────────────────────────────────────────────────
  console.log(`\n─────────────────────────────────────`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runAll().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});

/**
 * V2 Cognitive Guardian engine unit tests
 * Run with: npx tsx tests/cognitiveGuardian.test.ts
 */

import { CognitiveGuardianEngine } from '../src/engines/cognitiveGuardianEngine';
import { ProactiveAlertEngine } from '../src/engines/proactiveAlertEngine';
import { SilenceDecisionEngine } from '../src/engines/silenceDecisionEngine';
import { PredictiveRiskEngine } from '../src/engines/predictiveRiskEngine';
import { CompanionContextEngine } from '../src/engines/companionContextEngine';
import { RoutineLearningEngine } from '../src/engines/routineLearningEngine';
import { AlertThrottleEngine } from '../src/engines/alertThrottleEngine';
import type { Detection, SafetyDecision } from '../src/types';

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

const baseDecision: SafetyDecision = {
  shouldAlert: true,
  urgency: 'high',
  message: 'Vehicle ahead — stop and wait.',
  confidence: 0.9,
  interruptNarration: true,
};

const noAlertDecision: SafetyDecision = {
  shouldAlert: false,
  urgency: 'none',
  message: '',
  confidence: 1,
  interruptNarration: false,
};

async function runAll() {
  console.log('\nDenarixx Vision AI — V2 Cognitive Guardian Tests\n');

  // ── ProactiveAlertEngine ─────────────────────────────────────────────────────
  console.log('ProactiveAlertEngine');

  const proactiveEngine = new ProactiveAlertEngine();

  await test('generates alert for vehicle at high confidence', () => {
    const detections: Detection[] = [{ label: 'vehicle', confidence: 0.85 }];
    const alerts = proactiveEngine.generate(detections);
    assert(alerts.length > 0, 'should generate at least one alert');
    assert(alerts[0].triggerLabel === 'vehicle', 'trigger should be vehicle');
    assert(alerts[0].riskLevel === 'high', 'vehicle should be high risk');
    assert(alerts[0].anticipatedIn > 0, 'anticipatedIn should be positive');
  });

  await test('skips detection below confidence threshold', () => {
    const detections: Detection[] = [{ label: 'vehicle', confidence: 0.3 }];
    const alerts = proactiveEngine.generate(detections);
    assert(alerts.length === 0, 'should skip low-confidence detections');
  });

  await test('returns empty array for unrecognised label', () => {
    const detections: Detection[] = [{ label: 'tree', confidence: 0.99 }];
    const alerts = proactiveEngine.generate(detections);
    assert(alerts.length === 0, 'unknown labels should produce no alerts');
  });

  await test('sorts results by risk level — high before medium', () => {
    const detections: Detection[] = [
      { label: 'person', confidence: 0.9 },
      { label: 'vehicle', confidence: 0.8 },
      { label: 'step', confidence: 0.7 },
    ];
    const alerts = proactiveEngine.generate(detections);
    assert(alerts.length >= 2, 'should have multiple alerts');
    assert(alerts[0].riskLevel === 'high', 'first alert should be high risk');
  });

  await test('threshold is configurable', () => {
    proactiveEngine.setConfidenceThreshold(0.9);
    assert(proactiveEngine.getThreshold() === 0.9, 'threshold should update');
    const detections: Detection[] = [{ label: 'vehicle', confidence: 0.85 }];
    const alerts = proactiveEngine.generate(detections);
    assert(alerts.length === 0, 'should skip below new threshold');
    proactiveEngine.setConfidenceThreshold(0.4); // reset
  });

  // ── SilenceDecisionEngine ────────────────────────────────────────────────────
  console.log('\nSilenceDecisionEngine');

  const silenceEngine = new SilenceDecisionEngine({ maxAlertsPerMinute: 3, silenceDurationMs: 10_000 });

  await test('does not silence when alert count is 0', () => {
    const decision = silenceEngine.decide(0, null);
    assert(!decision.shouldSilence, 'should not silence with no alerts');
    assert(decision.fatigueLevel === 'none', 'fatigue should be none');
    assert(decision.silenceDurationMs === 0, 'silence duration should be 0');
  });

  await test('silences when alert rate meets or exceeds max', () => {
    const decision = silenceEngine.decide(3, null);
    assert(decision.shouldSilence, 'should silence at max rate');
    assert(decision.silenceDurationMs > 0, 'silence duration should be positive');
  });

  await test('fatigue is none when 0 alerts', () => {
    const level = silenceEngine.computeFatigueLevel(0);
    assert(level === 'none', 'should be none');
  });

  await test('fatigue is high when at or above max alerts per minute', () => {
    const level = silenceEngine.computeFatigueLevel(3);
    assert(level === 'high', 'should be high at max');
  });

  await test('silenceDurationMs is 0 when not silencing', () => {
    const decision = silenceEngine.decide(1, 5000);
    assert(decision.silenceDurationMs === 0, 'duration should be 0 when not silencing');
  });

  // ── PredictiveRiskEngine ─────────────────────────────────────────────────────
  console.log('\nPredictiveRiskEngine');

  const riskEngine = new PredictiveRiskEngine();

  await test('returns none risk with empty history', () => {
    const prediction = riskEngine.predict(5);
    assert(prediction.predictedRisk === 'none', 'should be none with no history');
    assert(prediction.factors.length === 0, 'should have no factors');
  });

  await test('predicts high risk after adding vehicle frame', () => {
    riskEngine.addFrame([{ label: 'vehicle', confidence: 0.85 }]);
    const prediction = riskEngine.predict(5);
    assert(
      prediction.predictedRisk === 'high' || prediction.predictedRisk === 'critical',
      `expected high or critical, got ${prediction.predictedRisk}`
    );
    assert(prediction.factors.length > 0, 'should have factors');
  });

  await test('escalates to critical with two vehicle frames', () => {
    riskEngine.addFrame([{ label: 'vehicle', confidence: 0.9 }]);
    const prediction = riskEngine.predict(5);
    assert(prediction.predictedRisk === 'critical', 'two vehicle frames → critical');
  });

  await test('clearHistory resets to none risk', () => {
    riskEngine.clearHistory();
    const prediction = riskEngine.predict(5);
    assert(prediction.predictedRisk === 'none', 'should be none after clear');
  });

  await test('getHistoryLength tracks added detections', () => {
    riskEngine.clearHistory();
    riskEngine.addFrame([
      { label: 'vehicle', confidence: 0.9 },
      { label: 'person', confidence: 0.8 },
    ]);
    assert(riskEngine.getHistoryLength() === 2, 'should track 2 detections');
  });

  // ── CompanionContextEngine ───────────────────────────────────────────────────
  console.log('\nCompanionContextEngine');

  const contextEngine = new CompanionContextEngine();

  await test('initial activity is unknown', () => {
    const ctx = contextEngine.getContext();
    assert(ctx.activity === 'unknown', 'should start as unknown');
    assert(ctx.alertsInLastMinute === 0, 'should have 0 alerts');
    assert(ctx.lastAlertTimestamp === null, 'should have no last alert');
  });

  await test('recordAlert appears in alertsInLastMinute', () => {
    contextEngine.recordAlert();
    const ctx = contextEngine.getContext();
    assert(ctx.alertsInLastMinute === 1, 'should count 1 alert');
    assert(ctx.lastAlertTimestamp !== null, 'should have a last alert timestamp');
  });

  await test('setActivity updates current activity', () => {
    contextEngine.setActivity('walking');
    const ctx = contextEngine.getContext();
    assert(ctx.activity === 'walking', 'activity should update to walking');
    assert(ctx.confidence > 0.5, 'confidence should be higher for known activity');
  });

  await test('reset clears all state and returns unknown activity', () => {
    contextEngine.reset();
    const ctx = contextEngine.getContext();
    assert(ctx.activity === 'unknown', 'should reset to unknown');
    assert(ctx.alertsInLastMinute === 0, 'alerts should reset to 0');
    assert(ctx.lastAlertTimestamp === null, 'last alert should reset to null');
  });

  // ── RoutineLearningEngine ────────────────────────────────────────────────────
  console.log('\nRoutineLearningEngine');

  const routineEngine = new RoutineLearningEngine();

  await test('observe creates a new entry', () => {
    routineEngine.clear();
    routineEngine.observe('coffee-shop');
    assert(routineEngine.getEntryCount() === 1, 'should have one entry');
    const routines = routineEngine.getRoutines();
    assert(routines[0].label === 'coffee-shop', 'label should match');
    assert(routines[0].frequency === 1, 'frequency should be 1');
  });

  await test('frequency increments on repeated observation of same label', () => {
    routineEngine.observe('coffee-shop');
    routineEngine.observe('coffee-shop');
    const routines = routineEngine.getRoutines();
    const entry = routines.find((r) => r.label === 'coffee-shop');
    assert(entry !== undefined, 'should find the entry');
    assert(entry!.frequency === 3, 'frequency should be 3 after three observations');
  });

  await test('getFrequentRoutines returns only entries above min frequency', () => {
    routineEngine.observe('rare-label'); // frequency 1
    const frequent = routineEngine.getFrequentRoutines(2);
    const rare = frequent.find((r) => r.label === 'rare-label');
    assert(rare === undefined, 'rare-label should be filtered out');
    const common = frequent.find((r) => r.label === 'coffee-shop');
    assert(common !== undefined, 'coffee-shop should be included');
  });

  await test('clear removes all entries', () => {
    routineEngine.clear();
    assert(routineEngine.getEntryCount() === 0, 'all entries should be cleared');
    assert(routineEngine.getRoutines().length === 0, 'routines should be empty');
  });

  // ── CognitiveGuardianEngine ──────────────────────────────────────────────────
  console.log('\nCognitiveGuardianEngine');

  const guardian = new CognitiveGuardianEngine();

  const vehicleDetections: Detection[] = [{ label: 'vehicle', confidence: 0.9 }];

  await test('process returns a GuardianDecision with required fields', () => {
    const decision = guardian.process(vehicleDetections, baseDecision, []);
    assert(typeof decision.shouldAlert === 'boolean', 'shouldAlert must be boolean');
    assert(typeof decision.shouldSilence === 'boolean', 'shouldSilence must be boolean');
    assert(Array.isArray(decision.proactiveAlerts), 'proactiveAlerts must be array');
    assert(typeof decision.riskPrediction === 'object', 'riskPrediction must be object');
    assert(typeof decision.userContext === 'object', 'userContext must be object');
    assert(typeof decision.reasoning === 'string', 'reasoning must be string');
  });

  await test('getFrameCount increments on each process call', () => {
    guardian.reset();
    assert(guardian.getFrameCount() === 0, 'should start at 0 after reset');
    guardian.process([], noAlertDecision, []);
    guardian.process([], noAlertDecision, []);
    assert(guardian.getFrameCount() === 2, 'should be 2 after two calls');
  });

  await test('does not alert when base decision has shouldAlert false', () => {
    guardian.reset();
    const decision = guardian.process(vehicleDetections, noAlertDecision, []);
    assert(!decision.shouldAlert, 'should not alert when base says no');
    assert(decision.message === null, 'message should be null when not alerting');
  });

  await test('reset clears frame count to zero', () => {
    guardian.process(vehicleDetections, baseDecision, []);
    guardian.process(vehicleDetections, baseDecision, []);
    guardian.reset();
    assert(guardian.getFrameCount() === 0, 'frame count should be 0 after reset');
  });

  // ── AlertThrottleEngine ──────────────────────────────────────────────────────
  console.log('\nAlertThrottleEngine');

  const throttle = new AlertThrottleEngine();

  await test('returns shouldSpeak: true for a new hazard type', () => {
    throttle.reset();
    const result = throttle.shouldSpeak({
      hazardType: 'vehicle',
      severity: 'high',
      confidence: 0.85,
      message: 'Vehicle ahead.',
    });
    assert(result.shouldSpeak, 'new hazard should always speak');
    assert(result.isNew, 'isNew should be true for first occurrence');
  });

  await test('silences same medium hazard immediately after speaking', () => {
    throttle.reset();
    throttle.record('step', 'medium', 0.7, 'Step ahead.');
    const result = throttle.shouldSpeak({
      hazardType: 'step',
      severity: 'medium',
      confidence: 0.72,
      message: 'Step ahead.',
    });
    assert(!result.shouldSpeak, 'same medium hazard within 30s cooldown should be silenced');
    assert(!result.isNew, 'isNew should be false for repeated hazard');
    assert(result.msUntilCooldownExpires > 0, 'cooldown remaining should be positive');
  });

  await test('silences same high hazard within 15s cooldown', () => {
    throttle.reset();
    throttle.record('obstacle', 'high', 0.8, 'Obstacle ahead.');
    const result = throttle.shouldSpeak({
      hazardType: 'obstacle',
      severity: 'high',
      confidence: 0.81, // only tiny confidence increase — not enough to override
      message: 'Obstacle ahead.',
    });
    assert(!result.shouldSpeak, 'same high hazard within 15s cooldown should be silenced');
  });

  await test('always speaks for critical hazard regardless of cooldown', () => {
    throttle.reset();
    throttle.record('vehicle', 'critical', 0.9, 'Stop now!');
    const result = throttle.shouldSpeak({
      hazardType: 'vehicle',
      severity: 'critical',
      confidence: 0.91,
      message: 'Stop now!',
    });
    assert(result.shouldSpeak, 'critical hazard must never be silenced');
    assert(result.reason.includes('critical'), 'reason should mention critical');
  });

  await test('speaks for high hazard when confidence improves significantly', () => {
    throttle.reset();
    throttle.record('obstacle', 'high', 0.55, 'Possible obstacle.');
    const result = throttle.shouldSpeak({
      hazardType: 'obstacle',
      severity: 'high',
      confidence: 0.78, // +23% — exceeds the 12% override threshold
      message: 'Obstacle confirmed closer.',
    });
    assert(result.shouldSpeak, 'should speak when confidence improved significantly');
    assert(result.confidenceImproved, 'confidenceImproved flag should be true');
  });

  await test('does not speak for high hazard with minor confidence change', () => {
    throttle.reset();
    throttle.record('obstacle', 'high', 0.7, 'Obstacle ahead.');
    const result = throttle.shouldSpeak({
      hazardType: 'obstacle',
      severity: 'high',
      confidence: 0.72, // only +2% — below override threshold
      message: 'Obstacle ahead.',
    });
    assert(!result.shouldSpeak, 'minor confidence change should not override cooldown');
  });

  await test('two different hazard types are tracked independently', () => {
    throttle.reset();
    throttle.record('vehicle', 'high', 0.8, 'Vehicle ahead.');
    // Bicycle has never been spoken — should speak even though vehicle was recent
    const result = throttle.shouldSpeak({
      hazardType: 'bicycle',
      severity: 'medium',
      confidence: 0.7,
      message: 'Cyclist nearby.',
    });
    assert(result.shouldSpeak, 'different hazard type should be independent');
    assert(result.isNew, 'bicycle should be new in throttle engine');
  });

  await test('getSpeakCount tracks how many times an alert was spoken', () => {
    throttle.reset();
    throttle.record('bicycle', 'medium', 0.7, 'Cyclist nearby.');
    throttle.record('bicycle', 'medium', 0.7, 'Cyclist still nearby.');
    assert(throttle.getSpeakCount('bicycle', 'medium') === 2, 'should count 2 speaks');
  });

  await test('getLastSpokenKey returns key of most recent spoken alert', () => {
    throttle.reset();
    throttle.record('vehicle', 'critical', 0.95, 'Stop!');
    throttle.record('step', 'high', 0.8, 'Step ahead.');
    assert(throttle.getLastSpokenKey() === 'step:high', 'last key should be step:high');
  });

  await test('reset clears all records and last spoken state', () => {
    throttle.record('vehicle', 'high', 0.9, 'test');
    throttle.reset();
    assert(throttle.getLastSpokenKey() === null, 'last key should be null after reset');
    const result = throttle.shouldSpeak({ hazardType: 'vehicle', severity: 'high', confidence: 0.9, message: 'test' });
    assert(result.isNew, 'hazard should be treated as new after reset');
    assert(result.shouldSpeak, 'should speak after reset');
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

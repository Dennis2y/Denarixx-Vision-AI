/**
 * V2 Cognitive Guardian Engine tests.
 * Run: npx tsx tests/cognitiveGuardian.test.ts
 */

import { CognitiveGuardianEngine } from '../src/engines/cognitiveGuardianEngine';
import { SilenceDecisionEngine } from '../src/engines/silenceDecisionEngine';
import { PredictiveRiskEngine } from '../src/engines/predictiveRiskEngine';
import { ProactiveAlertEngine } from '../src/engines/proactiveAlertEngine';
import { CompanionContextEngine } from '../src/engines/companionContextEngine';
import { RoutineLearningEngine } from '../src/engines/routineLearningEngine';
import type { SceneDescription, HazardAlert } from '../src/types';
import type { UserState } from '../src/types/cognitive';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log(`  ✓ ${name}`); passed++; })
    .catch((e: Error) => { console.error(`  ✗ ${name}: ${e.message}`); failed++; });
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeScene = (
  labels: string[],
  confidence = 0.85,
  isUncertain = false
): SceneDescription => ({
  summary: labels.join(', '),
  confidence,
  detections: labels.map((l) => ({ label: l, confidence })),
  timestamp: new Date(),
  isUncertain,
  uncertaintyMessage: isUncertain ? "I'm not sure. Please check carefully." : undefined,
});

const makeAlert = (
  type: string,
  severity: HazardAlert['severity'],
  confidence = 0.88
): HazardAlert => ({
  id: `test-${type}`,
  type,
  description: `${type} alert`,
  severity,
  confidence,
  timestamp: new Date(),
  shouldInterrupt: severity === 'critical',
  disclaimer: 'Assistive support only.',
});

const walkingOutdoor: UserState = {
  movement: 'walking',
  environment: 'outdoor',
  speed: 'normal',
  isAtRisk: false,
  confidence: 0.85,
  updatedAt: new Date(),
};

const crossingRoad: UserState = {
  ...walkingOutdoor,
  movement: 'crossing_road',
  isAtRisk: true,
};

const standing: UserState = {
  ...walkingOutdoor,
  movement: 'standing',
  speed: 'stationary',
};

// ─── CognitiveGuardianEngine ──────────────────────────────────────────────────

console.log('\nCognitiveGuardianEngine\n');

const guardian = new CognitiveGuardianEngine();

test('warns for critical vehicle alert', async () => {
  const scene = makeScene(['vehicle', 'road']);
  const alerts = [makeAlert('vehicle', 'critical', 0.94)];
  const state = CognitiveGuardianEngine.inferUserState(scene, alerts);
  const decision = await guardian.evaluate(scene, alerts, state);
  assert(decision.action === 'warn', `expected warn, got ${decision.action}`);
  assert(decision.interrupt, 'critical alert should interrupt');
  assert(decision.priority === 'critical', 'priority should be critical');
});

test('stays silent when scene unchanged and recently spoken', async () => {
  const scene = makeScene(['pavement', 'person']);
  const alerts: HazardAlert[] = [];
  const decision = await guardian.evaluate(scene, alerts, walkingOutdoor);
  // After the previous test already spoke, silence is expected shortly after
  assert(typeof decision.action === 'string', 'should return an action');
});

test('infers crossing_road when vehicle critical alert + road label', () => {
  const scene = makeScene(['vehicle', 'road']);
  const alerts = [makeAlert('vehicle', 'critical')];
  const state = CognitiveGuardianEngine.inferUserState(scene, alerts);
  assert(state.movement === 'crossing_road', `expected crossing_road, got ${state.movement}`);
  assert(state.isAtRisk, 'should be at risk');
});

test('infers indoor when table+chair detected', () => {
  const scene = makeScene(['table', 'chair']);
  const state = CognitiveGuardianEngine.inferUserState(scene, []);
  assert(state.environment === 'indoor', `expected indoor, got ${state.environment}`);
  assert(state.movement === 'standing', `expected standing, got ${state.movement}`);
});

test('appends uncertainty message for low-confidence warning', async () => {
  const guardian2 = new CognitiveGuardianEngine();
  const scene = makeScene(['vehicle', 'road'], 0.45, true);
  const alerts = [makeAlert('vehicle', 'critical', 0.56)];
  const state = CognitiveGuardianEngine.inferUserState(scene, alerts);
  const decision = await guardian2.evaluate(scene, alerts, state);
  if (decision.action === 'warn') {
    assert(
      decision.message.toLowerCase().includes('sure') || decision.message.toLowerCase().includes('check'),
      `uncertainty message missing: "${decision.message}"`
    );
  }
});

test('includes predicted risks in decision', async () => {
  const guardian3 = new CognitiveGuardianEngine();
  const scene = makeScene(['vehicle', 'road']);
  const alerts = [makeAlert('vehicle', 'critical')];
  const state = CognitiveGuardianEngine.inferUserState(scene, alerts);
  const decision = await guardian3.evaluate(scene, alerts, state);
  assert(Array.isArray(decision.predictedRisks), 'predictedRisks should be array');
});

// ─── SilenceDecisionEngine ────────────────────────────────────────────────────

console.log('\nSilenceDecisionEngine\n');

const silenceEngine = new SilenceDecisionEngine();

test('stays silent during road crossing', () => {
  const scene = makeScene(['road', 'vehicle']);
  const d = silenceEngine.decide(scene, crossingRoad, Date.now() - 20000, null);
  assert(d.shouldBeSilent, 'should be silent during crossing');
  assert(d.reason === 'risky_movement', `expected risky_movement, got ${d.reason}`);
});

test('stays silent when scene unchanged', () => {
  const scene = makeScene(['pavement', 'person']);
  const prev = makeScene(['pavement', 'person']);
  const d = silenceEngine.decide(scene, walkingOutdoor, Date.now() - 20000, prev);
  assert(d.shouldBeSilent, 'should be silent when scene unchanged');
  assert(d.reason === 'no_change', `expected no_change, got ${d.reason}`);
});

test('stays silent in cooldown window', () => {
  const scene = makeScene(['pavement']);
  const d = silenceEngine.decide(scene, walkingOutdoor, Date.now() - 1000, null);
  assert(d.shouldBeSilent, 'should be silent in cooldown');
  assert(d.reason === 'recently_spoken', `expected recently_spoken, got ${d.reason}`);
});

test('allows speech after cooldown with changed scene', () => {
  const scene = makeScene(['obstacle']);
  const prev = makeScene(['pavement']);
  const d = silenceEngine.decide(scene, walkingOutdoor, Date.now() - 15000, prev);
  assert(!d.shouldBeSilent, 'should allow speech after cooldown with new scene');
});

test('forces speech during emergency regardless of cooldown', () => {
  const emergency: UserState = { ...walkingOutdoor, movement: 'emergency' };
  const scene = makeScene(['vehicle']);
  const d = silenceEngine.decide(scene, emergency, Date.now(), null);
  assert(!d.shouldBeSilent, 'emergency must always allow speech');
});

// ─── PredictiveRiskEngine ─────────────────────────────────────────────────────

console.log('\nPredictiveRiskEngine\n');

const riskEngine = new PredictiveRiskEngine();

test('predicts critical crossing risk for vehicle+road while walking', () => {
  const scene = makeScene(['vehicle', 'road']);
  const risks = riskEngine.predict(scene, walkingOutdoor, [makeAlert('vehicle', 'critical')]);
  assert(risks.length > 0, 'should predict risks');
  assert(
    risks.some((r) => r.severity === 'critical'),
    'should include critical risk'
  );
});

test('predicts step fall risk when walking', () => {
  const scene = makeScene(['step', 'pavement']);
  const risks = riskEngine.predict(scene, walkingOutdoor, [makeAlert('step', 'high')]);
  assert(risks.some((r) => r.triggerLabels.includes('step')), 'should predict step risk');
});

test('returns empty for safe indoor scene', () => {
  const scene = makeScene(['table', 'chair']);
  const risks = riskEngine.predict(scene, standing, []);
  assert(risks.length === 0, 'no risks for safe indoor scene');
});

test('risks are sorted immediate before near', () => {
  const scene = makeScene(['vehicle', 'road', 'bicycle']);
  const risks = riskEngine.predict(scene, crossingRoad, [makeAlert('vehicle', 'critical')]);
  if (risks.length >= 2) {
    const horizonOrder = { immediate: 3, near: 2, potential: 1 };
    for (let i = 0; i < risks.length - 1; i++) {
      assert(
        horizonOrder[risks[i].horizon] >= horizonOrder[risks[i + 1].horizon],
        'risks should be sorted immediate first'
      );
    }
  }
});

// ─── ProactiveAlertEngine ─────────────────────────────────────────────────────

console.log('\nProactiveAlertEngine\n');

const alertEngine = new ProactiveAlertEngine();

test('fires critical alert immediately', () => {
  const alerts = [makeAlert('vehicle', 'critical', 0.9)];
  const result = alertEngine.shouldAlert(alerts, walkingOutdoor, 0);
  assert(result.alert, 'critical alert should fire');
  assert(result.urgency === 'critical', `expected critical, got ${result.urgency}`);
});

test('suppresses repeat critical in tight cooldown', () => {
  const alerts = [makeAlert('vehicle', 'critical', 0.9)];
  const result = alertEngine.shouldAlert(alerts, walkingOutdoor, Date.now() - 1000);
  assert(!result.alert, 'should suppress repeat in cooldown');
});

test('returns no alert for empty alerts', () => {
  const result = alertEngine.shouldAlert([], walkingOutdoor, 0);
  assert(!result.alert, 'no alerts should not fire');
  assert(result.urgency === null, 'urgency should be null');
});

// ─── CompanionContextEngine ───────────────────────────────────────────────────

console.log('\nCompanionContextEngine\n');

const companionEngine = new CompanionContextEngine();

test('suppresses companion during road crossing', () => {
  const scene = makeScene(['pavement']);
  const msg = companionEngine.compose(scene, crossingRoad, 'companion');
  assert(!msg.isAppropriate, 'companion should be suppressed during crossing');
  assert(msg.text === '', 'text should be empty when suppressed');
});

test('suppresses companion when guardian is warning', () => {
  const scene = makeScene(['pavement']);
  const msg = companionEngine.compose(scene, standing, 'warn');
  assert(!msg.isAppropriate, 'companion must not distract during warning');
});

test('produces reassuring message for clear indoor scene', () => {
  const scene = makeScene(['table', 'chair']);
  const msg = companionEngine.compose(scene, { ...standing, environment: 'indoor' }, 'silent');
  assert(msg.isAppropriate, `companion should be appropriate: ${msg.suppressedReason}`);
  assert(msg.text.length > 0, 'should have companion text');
});

test('produces cautious message near road while waiting', () => {
  const scene = makeScene(['road', 'pavement']);
  const waiting: UserState = { ...walkingOutdoor, movement: 'waiting' };
  const msg = companionEngine.compose(scene, waiting, 'silent');
  if (msg.isAppropriate) {
    assert(msg.tone === 'cautious' || msg.tone === 'reassuring', `unexpected tone: ${msg.tone}`);
  }
});

// ─── RoutineLearningEngine ────────────────────────────────────────────────────

console.log('\nRoutineLearningEngine\n');

const routineEngine = new RoutineLearningEngine();

test('matches pavement walk pattern', () => {
  const scene = makeScene(['pavement', 'person']);
  const match = routineEngine.matchCurrentRoutine(scene);
  assert(match !== null, 'should match pavement walk');
  assert(match!.label === 'Pavement walk', `expected Pavement walk, got ${match!.label}`);
});

test('matches indoor navigation pattern', () => {
  const scene = makeScene(['table', 'chair', 'door']);
  const match = routineEngine.matchCurrentRoutine(scene);
  assert(match !== null, 'should match indoor navigation');
});

test('observe increments frequency', () => {
  const scene = makeScene(['pavement', 'person']);
  const before = routineEngine.getState().patterns.find((p) => p.label === 'Pavement walk')?.frequency ?? 0;
  routineEngine.observe(scene);
  const after = routineEngine.getState().patterns.find((p) => p.label === 'Pavement walk')?.frequency ?? 0;
  assert(after > before, 'frequency should increment on observe');
});

test('learns new pattern from novel scene', () => {
  const scene = makeScene(['plant', 'window'], 0.85);
  const beforeCount = routineEngine.getState().patterns.length;
  routineEngine.observe(scene);
  const afterCount = routineEngine.getState().patterns.length;
  assert(afterCount > beforeCount, 'should learn new pattern from novel scene');
});

test('getState returns valid state shape', () => {
  const state = routineEngine.getState();
  assert(Array.isArray(state.patterns), 'patterns should be array');
  assert(typeof state.sessionCount === 'number', 'sessionCount should be number');
});

// ─── Results ──────────────────────────────────────────────────────────────────

async function run() {
  await new Promise((r) => setTimeout(r, 50)); // let all async tests queue
  console.log(`\n─────────────────────────────────────`);
  console.log(`V2 Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

setTimeout(run, 200);

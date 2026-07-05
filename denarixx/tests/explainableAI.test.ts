// Sprint 9 — Explainable AI & Trust Engine — test suite
// Run: npx tsx tests/explainableAI.test.ts

import { strict as assert } from 'assert';

// ─── Imports ──────────────────────────────────────────────────────────────────
import {
  classifyTrustLevel,
  trustLevelLabel,
  trustLevelColor,
  computeTrustScore,
  adjustTrustFromFeedback,
  trustScorePercent,
} from '../src/engines/trustScoreEngine';

import {
  buildGuardianExplanation,
  buildNavigationExplanation,
  buildMemoryExplanation,
  buildSilentExplanation,
  formatExplanationText,
} from '../src/engines/explainableAIEngine';

import {
  createStore,
  addTrace,
  getRecentTraces,
  getLatestTrace,
  getDecisionById,
  addFeedback,
  getFeedbackForDecision,
  getAllFeedback,
  getFeedbackSummary,
  filterTracesBySource,
  filterTracesByCategory,
  filterSpokenTraces,
  filterSilentTraces,
  getTraceCount,
  getSilenceRatio,
  getAverageConfidence,
  clearStore,
} from '../src/engines/decisionTraceEngine';

import type {
  TrustLevel,
  FeedbackType,
  ExplainedDecision,
  ExplanationStore,
} from '../src/types/trust';
import { MAX_TRACE_ENTRIES, TRUST_DISCLAIMER } from '../src/types/trust';

import type { GuardianDecision } from '../src/types/cognitive';
import type { Detection, HazardAlert, SafetyDecision } from '../src/types/index';

// ─── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
  }
}

function makeGuardianDecision(overrides: Partial<GuardianDecision> = {}): GuardianDecision {
  return {
    shouldAlert: true,
    shouldSilence: false,
    proactiveAlerts: [],
    riskPrediction: {
      predictedRisk: 'medium',
      confidence: 0.7,
      timeHorizonSeconds: 5,
      factors: ['vehicle nearby'],
      reasoning: 'Vehicle detected within 3 metres',
    },
    userContext: {
      activity: 'walking',
      sessionDurationSeconds: 120,
      alertsInLastMinute: 1,
      lastAlertTimestamp: null,
      isIndoors: false,
      confidence: 0.8,
    },
    message: 'Vehicle approaching from the left.',
    confidence: 0.75,
    reasoning: 'High confidence vehicle detection.',
    qualityDecision: {
      shouldSpeak: true,
      message: 'Vehicle approaching from the left.',
      speakTrigger: 'new_hazard',
      silenceReason: null,
      riskLevel: 'medium',
      confidence: 0.75,
      deduplicationFrame: {
        appeared: ['vehicle'],
        disappeared: [],
        ongoing: [],
        isFirstFrame: false,
      },
      logEntry: {
        timestamp: new Date(),
        spoke: true,
        speakTrigger: 'new_hazard',
        silenceReason: null,
        hazardType: 'vehicle',
        severity: 'medium',
        confidence: 0.75,
        riskLevel: 'medium',
        message: 'Vehicle approaching from the left.',
        deduplicationFrame: {
          appeared: ['vehicle'],
          disappeared: [],
          ongoing: [],
          isFirstFrame: false,
        },
      },
    },
    ...overrides,
  };
}

function makeDetections(): Detection[] {
  return [
    { label: 'vehicle', confidence: 0.85 },
    { label: 'person', confidence: 0.70 },
  ];
}

function makeHazards(): HazardAlert[] {
  return [
    {
      id: 'h1',
      type: 'vehicle',
      description: 'Vehicle approaching',
      severity: 'medium',
      confidence: 0.85,
      timestamp: new Date(),
      shouldInterrupt: false,
      disclaimer: 'AI estimate',
    },
  ];
}

function makeSilentGuardianDecision(): GuardianDecision {
  return makeGuardianDecision({
    shouldAlert: false,
    shouldSilence: true,
    message: null,
    qualityDecision: {
      shouldSpeak: false,
      message: null,
      speakTrigger: null,
      silenceReason: 'Cooldown active — same hazard recently announced.',
      riskLevel: 'low',
      confidence: 0.6,
      deduplicationFrame: {
        appeared: [],
        disappeared: [],
        ongoing: ['vehicle'],
        isFirstFrame: false,
      },
      logEntry: {
        timestamp: new Date(),
        spoke: false,
        speakTrigger: null,
        silenceReason: 'Cooldown active — same hazard recently announced.',
        hazardType: 'vehicle',
        severity: 'low',
        confidence: 0.6,
        riskLevel: 'low',
        message: null,
        deduplicationFrame: {
          appeared: [],
          disappeared: [],
          ongoing: ['vehicle'],
          isFirstFrame: false,
        },
      },
    },
  });
}

// ─── Suite 1: TrustScoreEngine ────────────────────────────────────────────────

console.log('\nTrustScoreEngine');

test('classifyTrustLevel: ≥0.8 → high', () => {
  assert.equal(classifyTrustLevel(0.8), 'high');
  assert.equal(classifyTrustLevel(1.0), 'high');
  assert.equal(classifyTrustLevel(0.95), 'high');
});

test('classifyTrustLevel: 0.6–0.79 → medium', () => {
  assert.equal(classifyTrustLevel(0.6), 'medium');
  assert.equal(classifyTrustLevel(0.79), 'medium');
});

test('classifyTrustLevel: 0.4–0.59 → low', () => {
  assert.equal(classifyTrustLevel(0.4), 'low');
  assert.equal(classifyTrustLevel(0.55), 'low');
});

test('classifyTrustLevel: 0.2–0.39 → uncertain', () => {
  assert.equal(classifyTrustLevel(0.2), 'uncertain');
  assert.equal(classifyTrustLevel(0.35), 'uncertain');
});

test('classifyTrustLevel: <0.2 → needs_confirmation', () => {
  assert.equal(classifyTrustLevel(0.1), 'needs_confirmation');
  assert.equal(classifyTrustLevel(0.0), 'needs_confirmation');
});

test('trustLevelLabel returns non-empty string for all levels', () => {
  const levels: TrustLevel[] = ['high', 'medium', 'low', 'uncertain', 'needs_confirmation'];
  for (const l of levels) {
    const label = trustLevelLabel(l);
    assert.ok(label.length > 0, `Empty label for ${l}`);
  }
});

test('trustLevelColor returns non-empty string for all levels', () => {
  const levels: TrustLevel[] = ['high', 'medium', 'low', 'uncertain', 'needs_confirmation'];
  for (const l of levels) {
    assert.ok(trustLevelColor(l).length > 0);
  }
});

test('computeTrustScore: high confidence guardian → high or medium', () => {
  const ts = computeTrustScore(0.9, 'guardian', []);
  assert.ok(['high', 'medium'].includes(ts.level));
  assert.ok(ts.score > 0.5);
  assert.ok(ts.factorsUsed.length > 0);
});

test('computeTrustScore: low confidence → low or uncertain', () => {
  const ts = computeTrustScore(0.3, 'guardian', []);
  assert.ok(['low', 'uncertain', 'needs_confirmation'].includes(ts.level));
});

test('computeTrustScore: includes source factor', () => {
  const ts = computeTrustScore(0.8, 'guardian', []);
  assert.ok(ts.factorsUsed.some(f => f.includes('guardian')));
});

test('computeTrustScore: feedback history adjusts score positively for useful', () => {
  const base = computeTrustScore(0.7, 'guardian', []);
  const withFeedback = computeTrustScore(0.7, 'guardian', [
    { decisionId: 'x', type: 'useful', timestamp: new Date(), note: null },
    { decisionId: 'y', type: 'useful', timestamp: new Date(), note: null },
  ]);
  assert.ok(withFeedback.score >= base.score);
});

test('computeTrustScore: wrong feedback lowers score', () => {
  const base = computeTrustScore(0.7, 'guardian', []);
  const withWrong = computeTrustScore(0.7, 'guardian', [
    { decisionId: 'x', type: 'wrong', timestamp: new Date(), note: null },
    { decisionId: 'y', type: 'wrong', timestamp: new Date(), note: null },
  ]);
  assert.ok(withWrong.score <= base.score);
});

test('computeTrustScore: score clamped to [0,1]', () => {
  const ts = computeTrustScore(1.5, 'system', []);
  assert.ok(ts.score >= 0 && ts.score <= 1);
  const ts2 = computeTrustScore(-0.5, 'voice', []);
  assert.ok(ts2.score >= 0);
});

test('computeTrustScore: unknown source uses default weight', () => {
  const ts = computeTrustScore(0.8, 'unknown_source', []);
  assert.ok(ts.score >= 0 && ts.score <= 1);
});

test('adjustTrustFromFeedback: useful raises score', () => {
  const base = computeTrustScore(0.6, 'guardian', []);
  const adjusted = adjustTrustFromFeedback(base, 'useful');
  assert.ok(adjusted.score >= base.score);
});

test('adjustTrustFromFeedback: wrong lowers score significantly', () => {
  const base = computeTrustScore(0.8, 'guardian', []);
  const adjusted = adjustTrustFromFeedback(base, 'wrong');
  assert.ok(adjusted.score < base.score);
});

test('adjustTrustFromFeedback: score clamped to [0,1]', () => {
  const base = { level: 'high' as TrustLevel, score: 1.0, explanation: 'x', factorsUsed: [] };
  const up = adjustTrustFromFeedback(base, 'useful');
  assert.ok(up.score <= 1.0);
  const low = { level: 'needs_confirmation' as TrustLevel, score: 0.0, explanation: 'y', factorsUsed: [] };
  const down = adjustTrustFromFeedback(low, 'wrong');
  assert.ok(down.score >= 0.0);
});

test('adjustTrustFromFeedback: level updates with score', () => {
  const base = { level: 'medium' as TrustLevel, score: 0.65, explanation: 'x', factorsUsed: [] };
  const adjusted = adjustTrustFromFeedback(base, 'wrong');
  assert.notEqual(adjusted.level, undefined);
});

test('trustScorePercent formats correctly', () => {
  assert.equal(trustScorePercent(0.82), '82%');
  assert.equal(trustScorePercent(0.5), '50%');
  assert.equal(trustScorePercent(1.0), '100%');
  assert.equal(trustScorePercent(0.0), '0%');
});

// ─── Suite 2: ExplainableAIEngine — Guardian ──────────────────────────────────

console.log('\nExplainableAIEngine — Guardian');

test('buildGuardianExplanation: spoke decision has correct category', () => {
  const result = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  assert.equal(result.category, 'spoke');
  assert.ok(result.whySpoke !== null);
  assert.equal(result.whySilent, null);
});

test('buildGuardianExplanation: silent decision has correct category', () => {
  const result = buildGuardianExplanation({
    guardian: makeSilentGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  assert.equal(result.category, 'silent');
  assert.equal(result.whySpoke, null);
  assert.ok(result.whySilent !== null);
});

test('buildGuardianExplanation: source is guardian', () => {
  const result = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  assert.equal(result.source, 'guardian');
});

test('buildGuardianExplanation: detected labels included', () => {
  const result = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  assert.ok(result.whatWasSeen.detectedLabels.includes('vehicle'));
  assert.ok(result.whatWasSeen.detectedLabels.includes('person'));
});

test('buildGuardianExplanation: hazard types included', () => {
  const result = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  assert.ok(result.whatWasSeen.hazardTypes.includes('vehicle'));
});

test('buildGuardianExplanation: trigger label is human-readable', () => {
  const result = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  assert.ok(result.whySpoke!.triggerLabel.length > 0);
  assert.notEqual(result.whySpoke!.triggerLabel, 'new_hazard');
});

test('buildGuardianExplanation: has trust score', () => {
  const result = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  assert.ok(result.trust.score >= 0 && result.trust.score <= 1);
  assert.ok(result.trust.level.length > 0);
});

test('buildGuardianExplanation: has recommended action', () => {
  const result = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  assert.ok(result.recommendedAction.length > 0);
});

test('buildGuardianExplanation: critical risk → stop action', () => {
  const critical = makeGuardianDecision({
    riskPrediction: {
      predictedRisk: 'critical',
      confidence: 0.9,
      timeHorizonSeconds: 2,
      factors: ['stairs'],
      reasoning: 'Immediate drop-off detected',
    },
    qualityDecision: {
      shouldSpeak: true,
      message: 'Stairs ahead — stop now.',
      speakTrigger: 'critical_never_silenced',
      silenceReason: null,
      riskLevel: 'critical',
      confidence: 0.9,
      deduplicationFrame: {
        appeared: ['stairs'],
        disappeared: [],
        ongoing: [],
        isFirstFrame: false,
      },
      logEntry: {
        timestamp: new Date(),
        spoke: true,
        speakTrigger: 'critical_never_silenced',
        silenceReason: null,
        hazardType: 'stairs',
        severity: 'critical',
        confidence: 0.9,
        riskLevel: 'critical',
        message: 'Stairs ahead — stop now.',
        deduplicationFrame: {
          appeared: ['stairs'],
          disappeared: [],
          ongoing: [],
          isFirstFrame: false,
        },
      },
    },
  });
  const result = buildGuardianExplanation({
    guardian: critical,
    detections: [{ label: 'stairs', confidence: 0.9 }],
    hazards: [],
    safetyDecision: null,
  });
  assert.ok(result.recommendedAction.toLowerCase().includes('stop'));
});

test('buildGuardianExplanation: uncertainty note when confidence < 0.4', () => {
  const lowConf = makeGuardianDecision({ confidence: 0.35 });
  if (lowConf.qualityDecision) lowConf.qualityDecision.confidence = 0.35;
  const result = buildGuardianExplanation({
    guardian: lowConf,
    detections: [],
    hazards: [],
    safetyDecision: null,
  });
  assert.ok(result.uncertaintyNote !== null);
  assert.ok(result.uncertaintyNote!.length > 0);
});

test('buildGuardianExplanation: no uncertainty note for high confidence', () => {
  const result = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  assert.equal(result.uncertaintyNote, null);
});

test('buildGuardianExplanation: id is unique per call', () => {
  const a = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: [],
    hazards: [],
    safetyDecision: null,
  });
  const b = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: [],
    hazards: [],
    safetyDecision: null,
  });
  assert.notEqual(a.id, b.id);
});

test('buildGuardianExplanation: silence reason from qualityDecision', () => {
  const result = buildGuardianExplanation({
    guardian: makeSilentGuardianDecision(),
    detections: [],
    hazards: [],
    safetyDecision: null,
  });
  assert.ok(result.whySilent!.reason.length > 0);
});

// ─── Suite 3: ExplainableAIEngine — Navigation ────────────────────────────────

console.log('\nExplainableAIEngine — Navigation');

test('buildNavigationExplanation: category is guided', () => {
  const result = buildNavigationExplanation({
    instruction: 'Turn left in 20 metres.',
    distanceMetres: 20,
    riskLevel: 'low',
    confidence: 0.85,
    reason: 'Approaching junction.',
  });
  assert.equal(result.category, 'guided');
  assert.equal(result.source, 'navigation');
});

test('buildNavigationExplanation: message is instruction', () => {
  const result = buildNavigationExplanation({
    instruction: 'Turn left in 20 metres.',
    distanceMetres: 20,
    riskLevel: 'low',
    confidence: 0.85,
    reason: 'Approaching junction.',
  });
  assert.equal(result.message, 'Turn left in 20 metres.');
});

test('buildNavigationExplanation: whySpoke contains distance', () => {
  const result = buildNavigationExplanation({
    instruction: 'Continue straight.',
    distanceMetres: 50,
    riskLevel: 'none',
    confidence: 0.9,
    reason: 'On route.',
  });
  assert.ok(result.whySpoke!.triggerLabel.includes('50'));
});

test('buildNavigationExplanation: trust score present', () => {
  const result = buildNavigationExplanation({
    instruction: 'Turn right.',
    distanceMetres: 10,
    riskLevel: 'medium',
    confidence: 0.8,
    reason: 'Risk ahead.',
  });
  assert.ok(result.trust.score >= 0);
});

test('buildNavigationExplanation: uncertainty note for low confidence', () => {
  const result = buildNavigationExplanation({
    instruction: 'Turn right.',
    distanceMetres: 10,
    riskLevel: 'medium',
    confidence: 0.3,
    reason: 'Risk ahead.',
  });
  assert.ok(result.uncertaintyNote !== null);
});

test('buildNavigationExplanation: no whySilent', () => {
  const result = buildNavigationExplanation({
    instruction: 'Continue.',
    distanceMetres: 5,
    riskLevel: 'none',
    confidence: 0.9,
    reason: 'Clear path.',
  });
  assert.equal(result.whySilent, null);
});

// ─── Suite 4: ExplainableAIEngine — Memory ────────────────────────────────────

console.log('\nExplainableAIEngine — Memory');

test('buildMemoryExplanation: category is remembered', () => {
  const result = buildMemoryExplanation({
    memoryLabel: 'Home',
    memoryCategory: 'saved_place',
    message: 'Home is 150 metres ahead.',
    confidence: 0.9,
  });
  assert.equal(result.category, 'remembered');
  assert.equal(result.source, 'memory');
});

test('buildMemoryExplanation: message set correctly', () => {
  const result = buildMemoryExplanation({
    memoryLabel: 'Pharmacy',
    memoryCategory: 'saved_place',
    message: 'Pharmacy is nearby.',
    confidence: 0.8,
  });
  assert.equal(result.message, 'Pharmacy is nearby.');
});

test('buildMemoryExplanation: label in detected list', () => {
  const result = buildMemoryExplanation({
    memoryLabel: 'Supermarket',
    memoryCategory: 'saved_place',
    message: 'Supermarket on your right.',
    confidence: 0.75,
  });
  assert.ok(result.whatWasSeen.detectedLabels.includes('Supermarket'));
});

test('buildMemoryExplanation: moderate confidence adds uncertainty note', () => {
  const result = buildMemoryExplanation({
    memoryLabel: 'Park',
    memoryCategory: 'landmark',
    message: 'Park is nearby.',
    confidence: 0.5,
  });
  assert.ok(result.uncertaintyNote !== null);
});

test('buildMemoryExplanation: high confidence → no uncertainty note', () => {
  const result = buildMemoryExplanation({
    memoryLabel: 'Office',
    memoryCategory: 'saved_place',
    message: 'Office ahead.',
    confidence: 0.9,
  });
  assert.equal(result.uncertaintyNote, null);
});

test('buildMemoryExplanation: riskLevel is none', () => {
  const result = buildMemoryExplanation({
    memoryLabel: 'Home',
    memoryCategory: 'saved_place',
    message: 'Home ahead.',
    confidence: 0.9,
  });
  assert.equal(result.riskLevel, 'none');
});

// ─── Suite 5: ExplainableAIEngine — Silent ────────────────────────────────────

console.log('\nExplainableAIEngine — Silent');

test('buildSilentExplanation: category is silent', () => {
  const result = buildSilentExplanation({
    reason: 'No hazard detected.',
    detections: [],
    fatigueLevel: 'low',
  });
  assert.equal(result.category, 'silent');
  assert.equal(result.whySpoke, null);
  assert.ok(result.whySilent !== null);
});

test('buildSilentExplanation: reason in whySilent', () => {
  const result = buildSilentExplanation({
    reason: 'Alert fatigue — too many recent alerts.',
    detections: [],
    fatigueLevel: 'high',
  });
  assert.equal(result.whySilent!.reason, 'Alert fatigue — too many recent alerts.');
  assert.equal(result.whySilent!.fatigueLevel, 'high');
});

test('buildSilentExplanation: cooldownRemainingMs stored', () => {
  const result = buildSilentExplanation({
    reason: 'Cooldown active.',
    detections: [],
    fatigueLevel: 'low',
    cooldownRemainingMs: 8000,
  });
  assert.equal(result.whySilent!.cooldownRemainingMs, 8000);
});

test('buildSilentExplanation: detections included in whatWasSeen', () => {
  const result = buildSilentExplanation({
    reason: 'Already announced.',
    detections: [{ label: 'bench', confidence: 0.6 }],
    fatigueLevel: 'low',
  });
  assert.ok(result.whatWasSeen.detectedLabels.includes('bench'));
});

test('buildSilentExplanation: no uncertainty note for silence', () => {
  const result = buildSilentExplanation({
    reason: 'No hazard.',
    detections: [],
    fatigueLevel: 'low',
  });
  assert.equal(result.uncertaintyNote, null);
});

// ─── Suite 6: formatExplanationText ──────────────────────────────────────────

console.log('\nExplainableAIEngine — formatExplanationText');

test('formatExplanationText: spoke result includes trigger label', () => {
  const decision = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  const text = formatExplanationText(decision);
  assert.ok(text.length > 20);
  assert.ok(text.includes('Denarixx spoke'));
});

test('formatExplanationText: silent result mentions silence', () => {
  const decision = buildSilentExplanation({
    reason: 'Nothing to report.',
    detections: [],
    fatigueLevel: 'low',
  });
  const text = formatExplanationText(decision);
  assert.ok(text.includes('silent') || text.includes('Denarixx stayed'));
});

test('formatExplanationText: navigation result mentions navigation', () => {
  const decision = buildNavigationExplanation({
    instruction: 'Turn left.',
    distanceMetres: 30,
    riskLevel: 'low',
    confidence: 0.85,
    reason: 'On route.',
  });
  const text = formatExplanationText(decision);
  assert.ok(text.includes('Turn left') || text.includes('Navigation'));
});

test('formatExplanationText: memory result includes message', () => {
  const decision = buildMemoryExplanation({
    memoryLabel: 'Home',
    memoryCategory: 'saved_place',
    message: 'Home is 150 metres ahead.',
    confidence: 0.9,
  });
  const text = formatExplanationText(decision);
  assert.ok(text.includes('Home is 150 metres ahead'));
});

test('formatExplanationText: uncertainty note appended', () => {
  const lowConf = makeGuardianDecision({ confidence: 0.3 });
  if (lowConf.qualityDecision) lowConf.qualityDecision.confidence = 0.3;
  const decision = buildGuardianExplanation({
    guardian: lowConf,
    detections: [],
    hazards: [],
    safetyDecision: null,
  });
  const text = formatExplanationText(decision);
  if (decision.uncertaintyNote) {
    assert.ok(text.includes('Note:'));
  }
});

test('formatExplanationText: always includes trust explanation', () => {
  const decision = buildSilentExplanation({
    reason: 'Nothing to report.',
    detections: [],
    fatigueLevel: 'low',
  });
  const text = formatExplanationText(decision);
  assert.ok(text.includes('Trust:'));
});

// ─── Suite 7: DecisionTraceEngine ────────────────────────────────────────────

console.log('\nDecisionTraceEngine');

function makeSampleDecision(overrides: Partial<ExplainedDecision> = {}): ExplainedDecision {
  return {
    id: Math.random().toString(36).slice(2),
    timestamp: new Date(),
    category: 'spoke',
    source: 'guardian',
    whatWasSeen: {
      detectedLabels: ['vehicle'],
      sceneDescription: null,
      hazardTypes: ['vehicle'],
      riskLevel: 'medium',
    },
    riskLevel: 'medium',
    confidence: 0.75,
    whySpoke: {
      trigger: 'new_hazard',
      triggerLabel: 'New hazard detected',
      confidence: 0.75,
      urgency: 'medium',
    },
    whySilent: null,
    recommendedAction: 'Slow down.',
    uncertaintyNote: null,
    message: 'Vehicle approaching.',
    trust: computeTrustScore(0.75, 'guardian', []),
    ...overrides,
  };
}

test('createStore: empty traces and feedback', () => {
  const store = createStore();
  assert.equal(store.traces.length, 0);
  assert.deepEqual(store.feedback, {});
});

test('addTrace: appends a trace', () => {
  let store = createStore();
  store = addTrace(store, makeSampleDecision());
  assert.equal(store.traces.length, 1);
});

test('addTrace: immutability — original store unchanged', () => {
  const store = createStore();
  const after = addTrace(store, makeSampleDecision());
  assert.equal(store.traces.length, 0);
  assert.equal(after.traces.length, 1);
});

test('addTrace: ring buffer caps at MAX_TRACE_ENTRIES', () => {
  let store = createStore();
  for (let i = 0; i < MAX_TRACE_ENTRIES + 10; i++) {
    store = addTrace(store, makeSampleDecision());
  }
  assert.equal(store.traces.length, MAX_TRACE_ENTRIES);
});

test('addTrace: ring buffer drops oldest entries', () => {
  let store = createStore();
  const first = makeSampleDecision();
  store = addTrace(store, first);
  for (let i = 0; i < MAX_TRACE_ENTRIES; i++) {
    store = addTrace(store, makeSampleDecision());
  }
  assert.ok(!store.traces.some(t => t.decision.id === first.id));
});

test('getRecentTraces: returns last N', () => {
  let store = createStore();
  for (let i = 0; i < 10; i++) store = addTrace(store, makeSampleDecision());
  const recent = getRecentTraces(store, 3);
  assert.equal(recent.length, 3);
});

test('getRecentTraces: n > total → all traces', () => {
  let store = createStore();
  for (let i = 0; i < 5; i++) store = addTrace(store, makeSampleDecision());
  const recent = getRecentTraces(store, 20);
  assert.equal(recent.length, 5);
});

test('getLatestTrace: returns most recent', () => {
  let store = createStore();
  const a = makeSampleDecision();
  const b = makeSampleDecision();
  store = addTrace(store, a);
  store = addTrace(store, b);
  assert.equal(getLatestTrace(store)!.decision.id, b.id);
});

test('getLatestTrace: returns null for empty store', () => {
  assert.equal(getLatestTrace(createStore()), null);
});

test('getDecisionById: finds existing decision', () => {
  let store = createStore();
  const d = makeSampleDecision();
  store = addTrace(store, d);
  const found = getDecisionById(store, d.id);
  assert.ok(found !== null);
  assert.equal(found!.decision.id, d.id);
});

test('getDecisionById: returns null for unknown id', () => {
  const store = createStore();
  assert.equal(getDecisionById(store, 'nonexistent'), null);
});

test('addFeedback: attaches to correct trace', () => {
  let store = createStore();
  const d = makeSampleDecision();
  store = addTrace(store, d);
  store = addFeedback(store, d.id, 'useful');
  assert.equal(store.traces[0].feedback!.type, 'useful');
});

test('addFeedback: stored in feedback map', () => {
  let store = createStore();
  const d = makeSampleDecision();
  store = addTrace(store, d);
  store = addFeedback(store, d.id, 'wrong', 'Detected wrong object');
  assert.ok(store.feedback[d.id] !== undefined);
  assert.equal(store.feedback[d.id].note, 'Detected wrong object');
});

test('getFeedbackForDecision: returns feedback', () => {
  let store = createStore();
  const d = makeSampleDecision();
  store = addTrace(store, d);
  store = addFeedback(store, d.id, 'too_late');
  const fb = getFeedbackForDecision(store, d.id);
  assert.ok(fb !== null);
  assert.equal(fb!.type, 'too_late');
});

test('getFeedbackForDecision: null for no feedback', () => {
  let store = createStore();
  const d = makeSampleDecision();
  store = addTrace(store, d);
  assert.equal(getFeedbackForDecision(store, d.id), null);
});

test('getAllFeedback: returns all', () => {
  let store = createStore();
  const d1 = makeSampleDecision();
  const d2 = makeSampleDecision();
  store = addTrace(store, d1);
  store = addTrace(store, d2);
  store = addFeedback(store, d1.id, 'useful');
  store = addFeedback(store, d2.id, 'wrong');
  assert.equal(getAllFeedback(store).length, 2);
});

test('getFeedbackSummary: counts by type', () => {
  let store = createStore();
  for (let i = 0; i < 3; i++) {
    const d = makeSampleDecision();
    store = addTrace(store, d);
    store = addFeedback(store, d.id, 'useful');
  }
  const d2 = makeSampleDecision();
  store = addTrace(store, d2);
  store = addFeedback(store, d2.id, 'wrong');
  const summary = getFeedbackSummary(store);
  assert.equal(summary.useful, 3);
  assert.equal(summary.wrong, 1);
  assert.equal(summary.total, 4);
});

test('getFeedbackSummary: helpfulnessRate = useful/total', () => {
  let store = createStore();
  const d1 = makeSampleDecision();
  store = addTrace(store, d1);
  store = addFeedback(store, d1.id, 'useful');
  const d2 = makeSampleDecision();
  store = addTrace(store, d2);
  store = addFeedback(store, d2.id, 'wrong');
  const summary = getFeedbackSummary(store);
  assert.equal(summary.helpfulnessRate, 0.5);
});

test('getFeedbackSummary: helpfulnessRate 0 when no feedback', () => {
  const summary = getFeedbackSummary(createStore());
  assert.equal(summary.helpfulnessRate, 0);
  assert.equal(summary.total, 0);
});

test('filterTracesBySource: only guardian traces', () => {
  let store = createStore();
  store = addTrace(store, makeSampleDecision({ source: 'guardian' }));
  store = addTrace(store, makeSampleDecision({ source: 'navigation' }));
  store = addTrace(store, makeSampleDecision({ source: 'guardian' }));
  const result = filterTracesBySource(store, 'guardian');
  assert.equal(result.length, 2);
  assert.ok(result.every(t => t.decision.source === 'guardian'));
});

test('filterTracesByCategory: only spoken traces', () => {
  let store = createStore();
  store = addTrace(store, makeSampleDecision({ category: 'spoke' }));
  store = addTrace(store, makeSampleDecision({ category: 'silent' }));
  store = addTrace(store, makeSampleDecision({ category: 'guided' }));
  const result = filterTracesByCategory(store, 'spoke');
  assert.equal(result.length, 1);
});

test('filterSpokenTraces: excludes silent', () => {
  let store = createStore();
  store = addTrace(store, makeSampleDecision({ category: 'spoke' }));
  store = addTrace(store, makeSampleDecision({ category: 'silent' }));
  store = addTrace(store, makeSampleDecision({ category: 'guided' }));
  const result = filterSpokenTraces(store);
  assert.ok(result.every(t => t.decision.category !== 'silent'));
});

test('filterSilentTraces: only silent', () => {
  let store = createStore();
  store = addTrace(store, makeSampleDecision({ category: 'spoke' }));
  store = addTrace(store, makeSampleDecision({ category: 'silent' }));
  const result = filterSilentTraces(store);
  assert.equal(result.length, 1);
  assert.equal(result[0].decision.category, 'silent');
});

test('getTraceCount: returns total', () => {
  let store = createStore();
  for (let i = 0; i < 7; i++) store = addTrace(store, makeSampleDecision());
  assert.equal(getTraceCount(store), 7);
});

test('getSilenceRatio: 0 for empty store', () => {
  assert.equal(getSilenceRatio(createStore()), 0);
});

test('getSilenceRatio: correct ratio', () => {
  let store = createStore();
  store = addTrace(store, makeSampleDecision({ category: 'silent' }));
  store = addTrace(store, makeSampleDecision({ category: 'spoke' }));
  store = addTrace(store, makeSampleDecision({ category: 'silent' }));
  assert.equal(getSilenceRatio(store), 0.67);
});

test('getAverageConfidence: 0 for empty store', () => {
  assert.equal(getAverageConfidence(createStore()), 0);
});

test('getAverageConfidence: correct average', () => {
  let store = createStore();
  store = addTrace(store, makeSampleDecision({ confidence: 0.8, category: 'spoke' }));
  store = addTrace(store, makeSampleDecision({ confidence: 0.6, category: 'guided' }));
  const avg = getAverageConfidence(store);
  assert.ok(avg > 0.6 && avg < 0.9);
});

test('clearStore: resets to empty', () => {
  let store = createStore();
  for (let i = 0; i < 5; i++) store = addTrace(store, makeSampleDecision());
  const cleared = clearStore(store);
  assert.equal(cleared.traces.length, 0);
  assert.deepEqual(cleared.feedback, {});
});

// ─── Suite 8: Constants & types ───────────────────────────────────────────────

console.log('\nConstants & types');

test('MAX_TRACE_ENTRIES is 50', () => {
  assert.equal(MAX_TRACE_ENTRIES, 50);
});

test('TRUST_DISCLAIMER is non-empty string', () => {
  assert.ok(typeof TRUST_DISCLAIMER === 'string');
  assert.ok(TRUST_DISCLAIMER.length > 10);
});

test('TRUST_DISCLAIMER does not claim certainty', () => {
  assert.ok(!TRUST_DISCLAIMER.toLowerCase().includes('accurate'));
  assert.ok(!TRUST_DISCLAIMER.toLowerCase().includes('guaranteed'));
});

// ─── Suite 9: Privacy rules ───────────────────────────────────────────────────

console.log('\nPrivacy rules');

test('explanations never include face data', () => {
  const result = buildGuardianExplanation({
    guardian: makeGuardianDecision(),
    detections: makeDetections(),
    hazards: makeHazards(),
    safetyDecision: null,
  });
  const text = JSON.stringify(result).toLowerCase();
  assert.ok(!text.includes('face'));
  assert.ok(!text.includes('biometric'));
  assert.ok(!text.includes('voiceprint'));
});

test('decisions do not expose GPS coordinates', () => {
  const result = buildNavigationExplanation({
    instruction: 'Turn left.',
    distanceMetres: 20,
    riskLevel: 'low',
    confidence: 0.85,
    reason: 'On route.',
  });
  const text = JSON.stringify(result);
  assert.ok(!text.match(/\d{2,3}\.\d{4,}/)); // no lat/lng patterns
});

test('memory explanations do not include personal identifiers', () => {
  const result = buildMemoryExplanation({
    memoryLabel: 'Home',
    memoryCategory: 'saved_place',
    message: 'Home is nearby.',
    confidence: 0.9,
  });
  const text = JSON.stringify(result).toLowerCase();
  assert.ok(!text.includes('face'));
  assert.ok(!text.includes('voiceprint'));
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Sprint 9 Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

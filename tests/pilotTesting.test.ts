// V11 Pilot Testing Engine — test suite
// Run: npx tsx tests/pilotTesting.test.ts

import {
  SCENARIO_REGISTRY,
  validateConsent,
  createPilotSession,
  addAlertFeedback,
  buildFeedback,
  endPilotSession,
  recordAlert,
  recordSilenceDecision,
  recordPredictedRisk,
  calculateFeedbackSummary,
  generateReport,
  deletePilotData,
  getScenarioInfo,
  formatDuration,
} from '../src/engines/pilotTestingEngine';
import { PILOT_PRIVACY } from '../src/types/pilot';
import type { TesterConsent, AlertFeedback, PilotScenario } from '../src/types/pilot';

// ─── Simple test harness ─────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
}

function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual: (expected: unknown) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy: () => { if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`); },
    toBeFalsy: () => { if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`); },
    toBeGreaterThan: (n: number) => { if ((actual as number) <= n) throw new Error(`Expected > ${n}, got ${actual}`); },
    toBeGreaterThanOrEqual: (n: number) => { if ((actual as number) < n) throw new Error(`Expected >= ${n}, got ${actual}`); },
    toBeLessThanOrEqual: (n: number) => { if ((actual as number) > n) throw new Error(`Expected <= ${n}, got ${actual}`); },
    toContain: (s: string) => { if (!(actual as string).includes(s)) throw new Error(`Expected "${actual}" to contain "${s}"`); },
    toHaveLength: (n: number) => { if ((actual as unknown[]).length !== n) throw new Error(`Expected length ${n}, got ${(actual as unknown[]).length}`); },
    toBeNull: () => { if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`); },
    not: {
      toBe: (expected: unknown) => { if (actual === expected) throw new Error(`Expected not ${JSON.stringify(expected)}`); },
      toBeNull: () => { if (actual === null) throw new Error('Expected not null'); },
      toContain: (s: string) => { if ((actual as string).includes(s)) throw new Error(`Expected "${actual}" NOT to contain "${s}"`); },
    },
  };
}

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeConsent(overrides: Partial<TesterConsent> = {}): TesterConsent {
  return {
    testerId: 'tester-001',
    consentGiven: true,
    consentTimestamp: new Date().toISOString(),
    supervisorPresent: true,
    safetyDisclaimerAcknowledged: true,
    ...overrides,
  };
}

function makeSession(scenario: PilotScenario = 'indoor_room') {
  return createPilotSession('session-001', scenario, makeConsent());
}

function makeFeedback(overrides: Partial<AlertFeedback> = {}): AlertFeedback {
  return {
    alertId: 'alert-001',
    wasUseful: true,
    wasTooLate: false,
    wasAnnoying: false,
    feltSafe: true,
    wordingClear: true,
    suggestedWording: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ─── PILOT_PRIVACY ───────────────────────────────────────────────────────────
describe('PILOT_PRIVACY constants', () => {
  test('noVideoStorage is true', () => expect(PILOT_PRIVACY.noVideoStorage).toBe(true));
  test('noFaceRecognition is true', () => expect(PILOT_PRIVACY.noFaceRecognition).toBe(true));
  test('noEmergencyStreaming is true', () => expect(PILOT_PRIVACY.noEmergencyStreaming).toBe(true));
  test('consentRequired is true', () => expect(PILOT_PRIVACY.consentRequired).toBe(true));
});

// ─── SCENARIO_REGISTRY ───────────────────────────────────────────────────────
describe('SCENARIO_REGISTRY', () => {
  const ALL_SCENARIOS: PilotScenario[] = [
    'indoor_room', 'hallway_walking', 'stairs_detection',
    'obstacle_avoidance', 'crossing_simulation', 'supermarket', 'crowded_area',
  ];

  test('contains all 7 scenarios', () => expect(Object.keys(SCENARIO_REGISTRY)).toHaveLength(7));

  for (const id of ALL_SCENARIOS) {
    test(`${id} has required fields`, () => {
      const info = SCENARIO_REGISTRY[id];
      expect(info.id).toBe(id);
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
      expect(info.estimatedMinutes).toBeGreaterThan(0);
      expect(info.safetyNotes.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(info.difficulty);
    });
  }

  test('stairs_detection is high difficulty', () => expect(SCENARIO_REGISTRY.stairs_detection.difficulty).toBe('high'));
  test('indoor_room is low difficulty', () => expect(SCENARIO_REGISTRY.indoor_room.difficulty).toBe('low'));
  test('crossing_simulation is high difficulty', () => expect(SCENARIO_REGISTRY.crossing_simulation.difficulty).toBe('high'));
  test('crowded_area is high difficulty', () => expect(SCENARIO_REGISTRY.crowded_area.difficulty).toBe('high'));
  test('obstacle_avoidance is medium difficulty', () => expect(SCENARIO_REGISTRY.obstacle_avoidance.difficulty).toBe('medium'));
  test('supermarket is medium difficulty', () => expect(SCENARIO_REGISTRY.supermarket.difficulty).toBe('medium'));
  test('hallway_walking is low difficulty', () => expect(SCENARIO_REGISTRY.hallway_walking.difficulty).toBe('low'));
  test('stairs_detection has supervisor safety note', () => {
    const notes = SCENARIO_REGISTRY.stairs_detection.safetyNotes.join(' ');
    expect(notes.toLowerCase()).toContain('supervisor');
  });
  test('crossing_simulation has real traffic warning', () => {
    const notes = SCENARIO_REGISTRY.crossing_simulation.safetyNotes.join(' ');
    expect(notes.toLowerCase()).toContain('traffic');
  });
});

// ─── validateConsent ─────────────────────────────────────────────────────────
describe('validateConsent', () => {
  test('valid consent returns valid:true with no errors', () => {
    const r = validateConsent(makeConsent());
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  test('missing consentGiven is invalid', () => {
    const r = validateConsent(makeConsent({ consentGiven: false }));
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  test('missing supervisorPresent is invalid', () => {
    const r = validateConsent(makeConsent({ supervisorPresent: false }));
    expect(r.valid).toBe(false);
  });

  test('missing safetyDisclaimerAcknowledged is invalid', () => {
    const r = validateConsent(makeConsent({ safetyDisclaimerAcknowledged: false }));
    expect(r.valid).toBe(false);
  });

  test('empty testerId is invalid', () => {
    const r = validateConsent(makeConsent({ testerId: '' }));
    expect(r.valid).toBe(false);
  });

  test('whitespace-only testerId is invalid', () => {
    const r = validateConsent(makeConsent({ testerId: '   ' }));
    expect(r.valid).toBe(false);
  });

  test('all three missing produces multiple errors', () => {
    const r = validateConsent(makeConsent({
      consentGiven: false,
      supervisorPresent: false,
      safetyDisclaimerAcknowledged: false,
    }));
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  test('error messages are non-empty strings', () => {
    const r = validateConsent(makeConsent({ consentGiven: false }));
    r.errors.forEach((e) => expect(e.length).toBeGreaterThan(0));
  });
});

// ─── createPilotSession ───────────────────────────────────────────────────────
describe('createPilotSession', () => {
  test('returns session with correct sessionId', () => {
    const s = makeSession();
    expect(s.sessionId).toBe('session-001');
  });

  test('returns session with correct scenario', () => {
    const s = makeSession('hallway_walking');
    expect(s.scenario).toBe('hallway_walking');
  });

  test('startedAt is ISO string', () => {
    const s = makeSession();
    expect(new Date(s.startedAt).toISOString()).toBe(s.startedAt);
  });

  test('endedAt is null initially', () => expect(makeSession().endedAt).toBeNull());
  test('durationMs is null initially', () => expect(makeSession().durationMs).toBeNull());
  test('alertsTriggered starts at 0', () => expect(makeSession().alertsTriggered).toBe(0));
  test('silenceDecisions starts at 0', () => expect(makeSession().silenceDecisions).toBe(0));
  test('feedbackItems is empty initially', () => expect(makeSession().feedbackItems).toHaveLength(0));
  test('confidenceLevels is empty initially', () => expect(makeSession().confidenceLevels).toHaveLength(0));
  test('predictedRisks is empty initially', () => expect(makeSession().predictedRisks).toHaveLength(0));
  test('deleted is false initially', () => expect(makeSession().deleted).toBe(false));
  test('failedDetectionsPlaceholder is pre-populated', () => {
    expect(makeSession().failedDetectionsPlaceholder.length).toBeGreaterThan(0);
  });
  test('consent is stored', () => {
    const consent = makeConsent();
    const s = createPilotSession('s1', 'indoor_room', consent);
    expect(s.consent.testerId).toBe('tester-001');
  });

  test('throws on invalid consent', () => {
    let threw = false;
    try {
      createPilotSession('s1', 'indoor_room', makeConsent({ consentGiven: false }));
    } catch (_) {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test('sessions are independent (immutable origin)', () => {
    const s1 = makeSession();
    const s2 = makeSession();
    expect(s1 === s2).toBe(false);
  });
});

// ─── recordAlert / recordSilenceDecision / recordPredictedRisk ───────────────
describe('session recording helpers', () => {
  test('recordAlert increments alertsTriggered', () => {
    const s = recordAlert(makeSession(), 0.9);
    expect(s.alertsTriggered).toBe(1);
  });

  test('recordAlert appends confidenceLevel', () => {
    const s = recordAlert(makeSession(), 0.85);
    expect(s.confidenceLevels).toHaveLength(1);
    expect(s.confidenceLevels[0]).toBe(0.85);
  });

  test('recordAlert clamps confidence to [0,1]', () => {
    const high = recordAlert(makeSession(), 1.5);
    expect(high.confidenceLevels[0]).toBeLessThanOrEqual(1);
    const low = recordAlert(makeSession(), -0.5);
    expect(low.confidenceLevels[0]).toBeGreaterThanOrEqual(0);
  });

  test('recordAlert is immutable (original unchanged)', () => {
    const original = makeSession();
    recordAlert(original, 0.9);
    expect(original.alertsTriggered).toBe(0);
  });

  test('recordSilenceDecision increments silenceDecisions', () => {
    const s = recordSilenceDecision(makeSession());
    expect(s.silenceDecisions).toBe(1);
  });

  test('multiple silence decisions accumulate', () => {
    let s = makeSession();
    s = recordSilenceDecision(s);
    s = recordSilenceDecision(s);
    expect(s.silenceDecisions).toBe(2);
  });

  test('recordPredictedRisk appends risk string', () => {
    const s = recordPredictedRisk(makeSession(), 'approaching pedestrian');
    expect(s.predictedRisks).toHaveLength(1);
    expect(s.predictedRisks[0]).toContain('pedestrian');
  });

  test('multiple risks accumulate', () => {
    let s = makeSession();
    s = recordPredictedRisk(s, 'risk A');
    s = recordPredictedRisk(s, 'risk B');
    expect(s.predictedRisks).toHaveLength(2);
  });
});

// ─── endPilotSession ─────────────────────────────────────────────────────────
describe('endPilotSession', () => {
  test('sets endedAt to ISO string', () => {
    const s = endPilotSession(makeSession());
    expect(typeof s.endedAt).toBe('string');
    expect(new Date(s.endedAt!).toISOString()).toBe(s.endedAt);
  });

  test('sets non-null durationMs', () => {
    const s = endPilotSession(makeSession());
    expect(typeof s.durationMs).toBe('number');
    expect(s.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('does not re-end an already-ended session', () => {
    const s1 = endPilotSession(makeSession());
    const s2 = endPilotSession(s1);
    expect(s2.endedAt).toBe(s1.endedAt);
  });

  test('original session is not mutated', () => {
    const s = makeSession();
    endPilotSession(s);
    expect(s.endedAt).toBeNull();
  });
});

// ─── buildFeedback ────────────────────────────────────────────────────────────
describe('buildFeedback', () => {
  test('sets alertId', () => {
    const fb = buildFeedback('a1', { wasUseful: true });
    expect(fb.alertId).toBe('a1');
  });

  test('maps provided answers', () => {
    const fb = buildFeedback('a1', { wasUseful: true, wasAnnoying: false });
    expect(fb.wasUseful).toBe(true);
    expect(fb.wasAnnoying).toBe(false);
  });

  test('defaults missing answers to null', () => {
    const fb = buildFeedback('a1', {});
    expect(fb.wasTooLate).toBeNull();
    expect(fb.feltSafe).toBeNull();
  });

  test('timestamp is an ISO string', () => {
    const fb = buildFeedback('a1', {});
    expect(new Date(fb.timestamp).toISOString()).toBe(fb.timestamp);
  });

  test('suggestedWording default is null', () => {
    const fb = buildFeedback('a1', {});
    expect(fb.suggestedWording).toBeNull();
  });

  test('suggestedWording can be set', () => {
    const fb = buildFeedback('a1', { suggestedWording: 'Please slow down' });
    expect(fb.suggestedWording).toBe('Please slow down');
  });
});

// ─── addAlertFeedback ────────────────────────────────────────────────────────
describe('addAlertFeedback', () => {
  test('appends feedback to session', () => {
    const s = addAlertFeedback(makeSession(), makeFeedback());
    expect(s.feedbackItems).toHaveLength(1);
  });

  test('multiple feedbacks accumulate', () => {
    let s = makeSession();
    s = addAlertFeedback(s, makeFeedback({ alertId: 'a1' }));
    s = addAlertFeedback(s, makeFeedback({ alertId: 'a2' }));
    expect(s.feedbackItems).toHaveLength(2);
  });

  test('original session feedbackItems is not mutated', () => {
    const s = makeSession();
    addAlertFeedback(s, makeFeedback());
    expect(s.feedbackItems).toHaveLength(0);
  });

  test('feedback content is preserved', () => {
    const fb = makeFeedback({ wasUseful: false, suggestedWording: 'speak slower' });
    const s = addAlertFeedback(makeSession(), fb);
    expect(s.feedbackItems[0].wasUseful).toBe(false);
    expect(s.feedbackItems[0].suggestedWording).toBe('speak slower');
  });
});

// ─── calculateFeedbackSummary ────────────────────────────────────────────────
describe('calculateFeedbackSummary', () => {
  test('empty items → 0 responses', () => {
    const s = calculateFeedbackSummary([]);
    expect(s.totalResponses).toBe(0);
  });

  test('all-true wasUseful → 100%', () => {
    const items = [
      makeFeedback({ wasUseful: true }),
      makeFeedback({ wasUseful: true }),
    ];
    expect(calculateFeedbackSummary(items).usefulPercent).toBe(100);
  });

  test('all-false wasUseful → 0%', () => {
    const items = [makeFeedback({ wasUseful: false })];
    expect(calculateFeedbackSummary(items).usefulPercent).toBe(0);
  });

  test('50% wasUseful', () => {
    const items = [
      makeFeedback({ wasUseful: true }),
      makeFeedback({ wasUseful: false }),
    ];
    expect(calculateFeedbackSummary(items).usefulPercent).toBe(50);
  });

  test('null answers are excluded from percentage calculation', () => {
    const items = [
      makeFeedback({ wasUseful: null }),
      makeFeedback({ wasUseful: true }),
    ];
    expect(calculateFeedbackSummary(items).usefulPercent).toBe(100);
  });

  test('all-null wasUseful → 0%', () => {
    const items = [makeFeedback({ wasUseful: null })];
    expect(calculateFeedbackSummary(items).usefulPercent).toBe(0);
  });

  test('suggestions collected correctly', () => {
    const items = [
      makeFeedback({ suggestedWording: 'slow down' }),
      makeFeedback({ suggestedWording: null }),
      makeFeedback({ suggestedWording: 'be more specific' }),
    ];
    expect(calculateFeedbackSummary(items).suggestions).toHaveLength(2);
  });

  test('totalResponses matches item count', () => {
    const items = [makeFeedback(), makeFeedback(), makeFeedback()];
    expect(calculateFeedbackSummary(items).totalResponses).toBe(3);
  });

  test('feltSafePercent computed correctly', () => {
    const items = [
      makeFeedback({ feltSafe: true }),
      makeFeedback({ feltSafe: true }),
      makeFeedback({ feltSafe: false }),
    ];
    expect(calculateFeedbackSummary(items).feltSafePercent).toBe(67);
  });

  test('annoyingPercent computed correctly', () => {
    const items = [makeFeedback({ wasAnnoying: true }), makeFeedback({ wasAnnoying: false })];
    expect(calculateFeedbackSummary(items).annoyingPercent).toBe(50);
  });

  test('tooLatePercent computed correctly', () => {
    const items = [makeFeedback({ wasTooLate: false })];
    expect(calculateFeedbackSummary(items).tooLatePercent).toBe(0);
  });

  test('wordingClearPercent computed correctly', () => {
    const items = [makeFeedback({ wordingClear: true })];
    expect(calculateFeedbackSummary(items).wordingClearPercent).toBe(100);
  });
});

// ─── generateReport ───────────────────────────────────────────────────────────
describe('generateReport', () => {
  test('report has correct sessionId', () => {
    const r = generateReport(makeSession());
    expect(r.sessionId).toBe('session-001');
  });

  test('report has correct scenario', () => {
    const r = generateReport(makeSession('supermarket'));
    expect(r.scenario).toBe('supermarket');
  });

  test('durationMs is non-negative', () => {
    const r = generateReport(makeSession());
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('averageConfidence is 0 with no alerts', () => {
    expect(generateReport(makeSession()).averageConfidence).toBe(0);
  });

  test('averageConfidence computed correctly from recorded alerts', () => {
    let s = makeSession();
    s = recordAlert(s, 0.8);
    s = recordAlert(s, 0.6);
    const r = generateReport(s);
    expect(r.averageConfidence).toBe(0.7);
  });

  test('privacyGuarantees match PILOT_PRIVACY', () => {
    const r = generateReport(makeSession());
    expect(r.privacyGuarantees.noVideoStorage).toBe(true);
    expect(r.privacyGuarantees.noFaceRecognition).toBe(true);
  });

  test('feedbackSummary is included', () => {
    const r = generateReport(makeSession());
    expect(typeof r.feedbackSummary.totalResponses).toBe('number');
  });

  test('failedDetections array is present', () => {
    expect(generateReport(makeSession()).failedDetections.length).toBeGreaterThan(0);
  });

  test('generatedAt is ISO string', () => {
    const r = generateReport(makeSession());
    expect(new Date(r.generatedAt).toISOString()).toBe(r.generatedAt);
  });

  test('throws on deleted session', () => {
    const deleted = deletePilotData(makeSession());
    let threw = false;
    try { generateReport(deleted); } catch (_) { threw = true; }
    expect(threw).toBe(true);
  });

  test('predictedRisks in report match session', () => {
    const s = recordPredictedRisk(makeSession(), 'obstacle ahead');
    const r = generateReport(s);
    expect(r.predictedRisks).toHaveLength(1);
  });

  test('alertsTriggered in report matches session', () => {
    let s = makeSession();
    s = recordAlert(s, 0.9);
    s = recordAlert(s, 0.7);
    expect(generateReport(s).alertsTriggered).toBe(2);
  });

  test('silenceDecisions in report matches session', () => {
    const s = recordSilenceDecision(makeSession());
    expect(generateReport(s).silenceDecisions).toBe(1);
  });
});

// ─── deletePilotData ─────────────────────────────────────────────────────────
describe('deletePilotData', () => {
  test('sets deleted to true', () => {
    expect(deletePilotData(makeSession()).deleted).toBe(true);
  });

  test('clears feedbackItems', () => {
    let s = addAlertFeedback(makeSession(), makeFeedback());
    s = deletePilotData(s);
    expect(s.feedbackItems).toHaveLength(0);
  });

  test('clears predictedRisks', () => {
    let s = recordPredictedRisk(makeSession(), 'risk X');
    s = deletePilotData(s);
    expect(s.predictedRisks).toHaveLength(0);
  });

  test('clears confidenceLevels', () => {
    let s = recordAlert(makeSession(), 0.8);
    s = deletePilotData(s);
    expect(s.confidenceLevels).toHaveLength(0);
  });

  test('resets alertsTriggered to 0', () => {
    let s = recordAlert(makeSession(), 0.9);
    s = deletePilotData(s);
    expect(s.alertsTriggered).toBe(0);
  });

  test('resets silenceDecisions to 0', () => {
    let s = recordSilenceDecision(makeSession());
    s = deletePilotData(s);
    expect(s.silenceDecisions).toBe(0);
  });

  test('redacts testerId to [deleted]', () => {
    const s = deletePilotData(makeSession());
    expect(s.consent.testerId).toBe('[deleted]');
  });

  test('clears failedDetectionsPlaceholder', () => {
    const s = deletePilotData(makeSession());
    expect(s.failedDetectionsPlaceholder).toHaveLength(0);
  });

  test('original session is not mutated', () => {
    const s = makeSession();
    deletePilotData(s);
    expect(s.deleted).toBe(false);
    expect(s.consent.testerId).toBe('tester-001');
  });
});

// ─── getScenarioInfo ─────────────────────────────────────────────────────────
describe('getScenarioInfo', () => {
  const SCENARIOS: PilotScenario[] = [
    'indoor_room', 'hallway_walking', 'stairs_detection',
    'obstacle_avoidance', 'crossing_simulation', 'supermarket', 'crowded_area',
  ];

  for (const sc of SCENARIOS) {
    test(`${sc} returns correct info object`, () => {
      const info = getScenarioInfo(sc);
      expect(info.id).toBe(sc);
    });
  }

  test('returns same object as SCENARIO_REGISTRY', () => {
    expect(getScenarioInfo('supermarket')).toEqual(SCENARIO_REGISTRY.supermarket);
  });
});

// ─── formatDuration ───────────────────────────────────────────────────────────
describe('formatDuration', () => {
  test('0ms → "0s"', () => expect(formatDuration(0)).toBe('0s'));
  test('1000ms → "1s"', () => expect(formatDuration(1000)).toBe('1s'));
  test('60000ms → "1m 0s"', () => expect(formatDuration(60000)).toBe('1m 0s'));
  test('90000ms → "1m 30s"', () => expect(formatDuration(90000)).toBe('1m 30s'));
  test('3600000ms → "60m 0s"', () => expect(formatDuration(3600000)).toBe('60m 0s'));
  test('59000ms → "59s"', () => expect(formatDuration(59000)).toBe('59s'));
  test('61000ms → "1m 1s"', () => expect(formatDuration(61000)).toBe('1m 1s'));
  test('0 < 60s formats without minutes', () => expect(formatDuration(30000)).not.toContain('m'));
  test('>= 60s formats with minutes', () => expect(formatDuration(120000)).toContain('m'));
});

// ─── Results ─────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

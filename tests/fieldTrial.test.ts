// V17 Real-World Field Trial & Safety Validation — test suite
// Run: npx tsx tests/fieldTrial.test.ts

import {
  validateConsent,
  createTrialSession,
  startTrialSession,
  endTrialSession,
  triggerEmergencyStop,
  recordTrialAlert,
  recordSilenceDecision,
  addAlertFeedback,
  addIncidentReport,
  addSupervisorNote,
  deleteSessionData,
  getScenarioInfo,
  getScenarioList,
  getScenariosByRiskLevel,
  formatDuration,
  getSessionDurationMs,
  isPrivacyCompliant,
  setHardwareMode,
} from '../src/engines/fieldTrialEngine';

import {
  calculateAlertUsefulnessScore,
  calculateGuidanceClarityScore,
  calculateUserConfidenceScore,
  calculateAlertFatigueScore,
  calculateSupervisorSafetyScore,
  calculateMissedHazardScore,
  calculateFalseAlertScore,
  calculateSafetyMetrics,
  usefulnessToScore,
  clarityToScore,
  getMetricsGrade,
  formatMetricsGrade,
  validateSafetyRules,
  isSafeToPublish,
  SAFETY_THRESHOLDS,
} from '../src/engines/safetyValidationEngine';

import {
  getFeedbackQuestions,
  createAlertFeedback,
  validateFeedbackResponses,
  calculateFeedbackSummary,
  buildFeedbackGuidance,
  describeUsefulness,
  describeClarity,
  describeTiming,
} from '../src/engines/userFeedbackEngine';

import {
  generateTrialReport,
  buildRecommendations,
  getPrivacyGuarantees,
  exportReportAsJSON,
  formatReportSummary,
  deleteReport,
  getScenarioLabel,
} from '../src/engines/trialReportEngine';

import {
  TRIAL_PRIVACY,
  TRIAL_SCENARIO_REGISTRY,
} from '../src/types/fieldTrial';
import type { TrialConsent, AlertFeedback, TrialSession } from '../src/types/fieldTrial';

// ─── Harness ──────────────────────────────────────────────────────────────────
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
    toBeTruthy: () => { if (!actual) fail(`Expected truthy, got ${JSON.stringify(actual)}`); },
    toBeFalsy: () => { if (actual) fail(`Expected falsy, got ${JSON.stringify(actual)}`); },
    toBeNull: () => { if (actual !== null) fail(`Expected null`); },
    not: {
      toBe: (e: unknown) => { if (actual === e) fail(`Expected NOT ${JSON.stringify(e)}`); },
      toBeNull: () => { if (actual === null) fail('Expected not null'); },
      toContain: (s: string) => { if ((actual as string).includes(s)) fail(`Expected NOT to contain "${s}"`); },
    },
    toBeGreaterThan: (n: number) => { if ((actual as number) <= n) fail(`Expected > ${n}, got ${actual}`); },
    toBeGreaterThanOrEqual: (n: number) => { if ((actual as number) < n) fail(`Expected >= ${n}, got ${actual}`); },
    toBeLessThan: (n: number) => { if ((actual as number) >= n) fail(`Expected < ${n}, got ${actual}`); },
    toBeLessThanOrEqual: (n: number) => { if ((actual as number) > n) fail(`Expected <= ${n}, got ${actual}`); },
    toContain: (s: string) => { if (!(actual as string).includes(s)) fail(`Expected "${actual}" to contain "${s}"`); },
    toHaveLength: (n: number) => { if ((actual as unknown[]).length !== n) fail(`Expected length ${n}, got ${(actual as unknown[]).length}`); },
    toThrow: () => { fail('Use direct try/catch for throw assertions'); },
  };
}

// ─── Test Factories ───────────────────────────────────────────────────────────
function makeConsent(overrides: Partial<TrialConsent> = {}): TrialConsent {
  return {
    participantId: 'P001',
    consentGiven: true,
    supervisorPresent: true,
    assistiveSupportOnly: true,
    noVideoStorageConfirmed: true,
    noFaceRecognitionConfirmed: true,
    consentTimestamp: Date.now(),
    ...overrides,
  };
}

function makeSession(): TrialSession {
  return createTrialSession(makeConsent(), 'indoor_hallway');
}

function makeActiveFeedback(overrides: Partial<AlertFeedback> = {}): AlertFeedback {
  return createAlertFeedback('alert-1', 'session-1', {
    usefulness: 'useful',
    timing: 'just_right',
    frequency: 'about_right',
    clarity: 'clear',
    userFeltOverwhelmed: false,
    userFeltSafer: true,
    ...overrides,
  });
}

// ─── FIELD TRIAL ENGINE ───────────────────────────────────────────────────────
describe('validateConsent', () => {
  test('valid consent passes', () => {
    const r = validateConsent(makeConsent());
    expect(r.valid).toBe(true);
  });
  test('no consent → violation', () => {
    const r = validateConsent(makeConsent({ consentGiven: false }));
    expect(r.valid).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
  });
  test('no supervisor → violation', () => {
    expect(validateConsent(makeConsent({ supervisorPresent: false })).valid).toBe(false);
  });
  test('no assistive disclaimer → violation', () => {
    expect(validateConsent(makeConsent({ assistiveSupportOnly: false })).valid).toBe(false);
  });
  test('no video confirmation → violation', () => {
    expect(validateConsent(makeConsent({ noVideoStorageConfirmed: false })).valid).toBe(false);
  });
  test('no face recognition confirmation → violation', () => {
    expect(validateConsent(makeConsent({ noFaceRecognitionConfirmed: false })).valid).toBe(false);
  });
  test('empty participant ID → violation', () => {
    expect(validateConsent(makeConsent({ participantId: '' })).valid).toBe(false);
  });
  test('all invalid → multiple violations', () => {
    const r = validateConsent({ participantId: '', consentGiven: false, supervisorPresent: false, assistiveSupportOnly: false, noVideoStorageConfirmed: false, noFaceRecognitionConfirmed: false, consentTimestamp: 0 });
    expect(r.violations.length).toBeGreaterThan(3);
  });
});

describe('createTrialSession', () => {
  test('creates session with correct scenario', () => {
    const s = makeSession();
    expect(s.scenario).toBe('indoor_hallway');
  });
  test('starts in setup phase', () => expect(makeSession().phase).toBe('setup'));
  test('has empty alerts', () => expect(makeSession().alerts).toHaveLength(0));
  test('has session ID', () => expect(makeSession().sessionId.length).toBeGreaterThan(0));
  test('throws on invalid consent', () => {
    let threw = false;
    try { createTrialSession(makeConsent({ consentGiven: false }), 'indoor_hallway'); }
    catch { threw = true; }
    expect(threw).toBe(true);
  });
  test('stores participant ID', () => expect(makeSession().participantId).toBe('P001'));
  test('emergency stop false', () => expect(makeSession().emergencyStopUsed).toBe(false));
});

describe('startTrialSession', () => {
  test('transitions to active', () => expect(startTrialSession(makeSession()).phase).toBe('active'));
  test('sets startTime', () => expect(startTrialSession(makeSession()).startTime).not.toBeNull());
  test('throws if not in setup', () => {
    const active = startTrialSession(makeSession());
    let threw = false;
    try { startTrialSession(active); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

describe('endTrialSession', () => {
  test('transitions to completed', () => {
    const active = startTrialSession(makeSession());
    expect(endTrialSession(active).phase).toBe('completed');
  });
  test('sets endTime', () => {
    const active = startTrialSession(makeSession());
    expect(endTrialSession(active).endTime).not.toBeNull();
  });
  test('throws if not active', () => {
    let threw = false;
    try { endTrialSession(makeSession()); } catch { threw = true; }
    expect(threw).toBe(true);
  });
});

describe('triggerEmergencyStop', () => {
  test('sets emergencyStopUsed', () => {
    expect(triggerEmergencyStop(startTrialSession(makeSession())).emergencyStopUsed).toBe(true);
  });
  test('transitions to completed', () => {
    expect(triggerEmergencyStop(startTrialSession(makeSession())).phase).toBe('completed');
  });
  test('works from any phase', () => {
    const stopped = triggerEmergencyStop(makeSession());
    expect(stopped.emergencyStopUsed).toBe(true);
  });
});

describe('recordTrialAlert', () => {
  test('adds alert to session', () => {
    const s = startTrialSession(makeSession());
    const updated = recordTrialAlert(s, {
      timestamp: Date.now(), alertType: 'obstacle', severity: 'high',
      message: 'Obstacle ahead', wasSpoken: true, wasHaptic: false, responseTimeMs: 500,
    });
    expect(updated.alerts).toHaveLength(1);
  });
  test('assigns alertId', () => {
    const s = startTrialSession(makeSession());
    const updated = recordTrialAlert(s, {
      timestamp: Date.now(), alertType: 'obstacle', severity: 'critical',
      message: 'Step', wasSpoken: true, wasHaptic: true, responseTimeMs: null,
    });
    expect(updated.alerts[0].alertId.length).toBeGreaterThan(0);
  });
  test('multiple alerts accumulate', () => {
    let s = startTrialSession(makeSession());
    for (let i = 0; i < 5; i++) {
      s = recordTrialAlert(s, { timestamp: Date.now(), alertType: 'x', severity: 'low', message: `alert ${i}`, wasSpoken: true, wasHaptic: false, responseTimeMs: null });
    }
    expect(s.alerts).toHaveLength(5);
  });
});

describe('recordSilenceDecision', () => {
  test('adds silence decision', () => {
    const s = startTrialSession(makeSession());
    const updated = recordSilenceDecision(s, { timestamp: Date.now(), reason: 'context safe', alertType: 'ambient_noise' });
    expect(updated.silenceDecisions).toHaveLength(1);
  });
  test('assigns sessionId', () => {
    const s = startTrialSession(makeSession());
    const updated = recordSilenceDecision(s, { timestamp: Date.now(), reason: 'test', alertType: 'x' });
    expect(updated.silenceDecisions[0].sessionId).toBe(s.sessionId);
  });
});

describe('addIncidentReport', () => {
  test('adds incident', () => {
    const s = startTrialSession(makeSession());
    const updated = addIncidentReport(s, { timestamp: Date.now(), description: 'Minor trip', severity: 'minor', supervisorAction: 'Paused', resolved: true });
    expect(updated.incidentReports).toHaveLength(1);
  });
  test('serious incident captured', () => {
    const s = startTrialSession(makeSession());
    const updated = addIncidentReport(s, { timestamp: Date.now(), description: 'Fall', severity: 'serious', supervisorAction: 'Stopped session', resolved: false });
    expect(updated.incidentReports[0].severity).toBe('serious');
  });
});

describe('addSupervisorNote', () => {
  test('adds note', () => {
    const s = startTrialSession(makeSession());
    const updated = addSupervisorNote(s, { timestamp: Date.now(), content: 'User navigated well', category: 'general' });
    expect(updated.supervisorNotes).toHaveLength(1);
  });
  test('assigns sessionId', () => {
    const s = startTrialSession(makeSession());
    const updated = addSupervisorNote(s, { timestamp: Date.now(), content: 'test', category: 'safety' });
    expect(updated.supervisorNotes[0].sessionId).toBe(s.sessionId);
  });
});

describe('deleteSessionData', () => {
  test('sets phase to deleted', () => expect(deleteSessionData(makeSession()).phase).toBe('deleted'));
  test('redacts participantId', () => expect(deleteSessionData(makeSession()).participantId).toBe('[deleted]'));
  test('clears alerts', () => {
    let s = startTrialSession(makeSession());
    s = recordTrialAlert(s, { timestamp: Date.now(), alertType: 'x', severity: 'low', message: 'x', wasSpoken: true, wasHaptic: false, responseTimeMs: null });
    expect(deleteSessionData(s).alerts).toHaveLength(0);
  });
  test('clears feedback', () => {
    let s = startTrialSession(makeSession());
    s = addAlertFeedback(s, makeActiveFeedback());
    expect(deleteSessionData(s).alertFeedbacks).toHaveLength(0);
  });
  test('clears incidents', () => {
    let s = startTrialSession(makeSession());
    s = addIncidentReport(s, { timestamp: Date.now(), description: 'x', severity: 'minor', supervisorAction: 'x', resolved: true });
    expect(deleteSessionData(s).incidentReports).toHaveLength(0);
  });
});

describe('getScenarioInfo', () => {
  test('returns info for valid scenario', () => expect(getScenarioInfo('indoor_hallway').id).toBe('indoor_hallway'));
  test('stairs has high risk', () => expect(getScenarioInfo('stairs').riskLevel).toBe('high'));
  test('road crossing is high risk', () => expect(getScenarioInfo('road_crossing_simulation').riskLevel).toBe('high'));
  test('throws on invalid scenario', () => {
    let threw = false;
    try { getScenarioInfo('invalid_scenario' as never); } catch { threw = true; }
    expect(threw).toBe(true);
  });
  test('all 9 scenarios present', () => expect(getScenarioList()).toHaveLength(9));
  test('each scenario has safetyNotes', () => {
    getScenarioList().forEach(s => expect(s.safetyNotes.length).toBeGreaterThan(0));
  });
  test('each scenario has prerequisiteEquipment', () => {
    getScenarioList().forEach(s => expect(s.prerequisiteEquipment.length).toBeGreaterThan(0));
  });
});

describe('getScenariosByRiskLevel', () => {
  test('returns low risk scenarios', () => expect(getScenariosByRiskLevel('low').length).toBeGreaterThan(0));
  test('returns high risk scenarios', () => expect(getScenariosByRiskLevel('high').length).toBeGreaterThan(0));
  test('all scenarios classified', () => {
    const total = getScenariosByRiskLevel('low').length + getScenariosByRiskLevel('medium').length + getScenariosByRiskLevel('high').length;
    expect(total).toBe(9);
  });
});

describe('formatDuration', () => {
  test('0 ms → 0s', () => expect(formatDuration(0)).toBe('0s'));
  test('30s', () => expect(formatDuration(30000)).toBe('30s'));
  test('1m 30s', () => expect(formatDuration(90000)).toBe('1m 30s'));
  test('negative → 0s', () => expect(formatDuration(-100)).toBe('0s'));
});

describe('isPrivacyCompliant', () => {
  test('valid session → compliant', () => expect(isPrivacyCompliant(makeSession())).toBe(true));
  test('missing consent → not compliant', () => {
    const s = createTrialSession(makeConsent(), 'doorway');
    const noConsent = { ...s, consent: { ...s.consent, consentGiven: false } };
    expect(isPrivacyCompliant(noConsent)).toBe(false);
  });
});

// ─── SAFETY VALIDATION ENGINE ─────────────────────────────────────────────────
describe('usefulnessToScore', () => {
  test('very_useful → 100', () => expect(usefulnessToScore('very_useful')).toBe(100));
  test('harmful → 0', () => expect(usefulnessToScore('harmful')).toBe(0));
  test('neutral → 50', () => expect(usefulnessToScore('neutral')).toBe(50));
  test('useful → 75', () => expect(usefulnessToScore('useful')).toBe(75));
  test('not_useful → 25', () => expect(usefulnessToScore('not_useful')).toBe(25));
});

describe('clarityToScore', () => {
  test('very_clear → 100', () => expect(clarityToScore('very_clear')).toBe(100));
  test('very_unclear → 0', () => expect(clarityToScore('very_unclear')).toBe(0));
  test('neutral → 50', () => expect(clarityToScore('neutral')).toBe(50));
});

describe('calculateAlertUsefulnessScore', () => {
  test('empty feedbacks → 50 (neutral placeholder)', () => expect(calculateAlertUsefulnessScore([])).toBe(50));
  test('all very_useful → 100', () => {
    const fbs = [makeActiveFeedback({ usefulness: 'very_useful' }), makeActiveFeedback({ usefulness: 'very_useful' })];
    expect(calculateAlertUsefulnessScore(fbs)).toBe(100);
  });
  test('all harmful → 0', () => {
    const fbs = [makeActiveFeedback({ usefulness: 'harmful' })];
    expect(calculateAlertUsefulnessScore(fbs)).toBe(0);
  });
  test('mixed → average', () => {
    const fbs = [makeActiveFeedback({ usefulness: 'very_useful' }), makeActiveFeedback({ usefulness: 'harmful' })];
    expect(calculateAlertUsefulnessScore(fbs)).toBe(50);
  });
});

describe('calculateGuidanceClarityScore', () => {
  test('empty → 50', () => expect(calculateGuidanceClarityScore([])).toBe(50));
  test('all very_clear → 100', () => {
    const fbs = [makeActiveFeedback({ clarity: 'very_clear' })];
    expect(calculateGuidanceClarityScore(fbs)).toBe(100);
  });
});

describe('calculateUserConfidenceScore', () => {
  test('empty → 50', () => expect(calculateUserConfidenceScore([])).toBe(50));
  test('all felt safer → high score', () => {
    const fbs = [makeActiveFeedback({ userFeltSafer: true, userFeltOverwhelmed: false })];
    expect(calculateUserConfidenceScore(fbs)).toBeGreaterThan(50);
  });
  test('all overwhelmed → reduced score', () => {
    const fbs = [makeActiveFeedback({ userFeltSafer: false, userFeltOverwhelmed: true })];
    expect(calculateUserConfidenceScore(fbs)).toBeLessThan(50);
  });
});

describe('calculateAlertFatigueScore', () => {
  test('no alerts → low fatigue', () => {
    const s = startTrialSession(makeSession());
    expect(calculateAlertFatigueScore(s)).toBeLessThan(50);
  });
  test('many overwhelmed feedbacks → high fatigue', () => {
    let s = startTrialSession(makeSession());
    for (let i = 0; i < 5; i++) {
      s = recordTrialAlert(s, { timestamp: Date.now(), alertType: 'x', severity: 'medium', message: 'x', wasSpoken: true, wasHaptic: false, responseTimeMs: null });
    }
    s = addAlertFeedback(s, makeActiveFeedback({ userFeltOverwhelmed: true }));
    s = addAlertFeedback(s, makeActiveFeedback({ userFeltOverwhelmed: true }));
    expect(calculateAlertFatigueScore(s)).toBeGreaterThan(0);
  });
  test('returns 0-100', () => {
    const s = startTrialSession(makeSession());
    const score = calculateAlertFatigueScore(s);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('calculateSupervisorSafetyScore', () => {
  test('no incidents + no notes → 100', () => expect(calculateSupervisorSafetyScore([], [])).toBe(100));
  test('serious incident → large penalty', () => {
    let s = startTrialSession(makeSession());
    s = addIncidentReport(s, { timestamp: Date.now(), description: 'Fall', severity: 'serious', supervisorAction: 'Stopped', resolved: false });
    expect(calculateSupervisorSafetyScore(s.supervisorNotes, s.incidentReports)).toBeLessThan(80);
  });
  test('score is 0-100', () => {
    const score = calculateSupervisorSafetyScore([], []);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('calculateMissedHazardScore', () => {
  test('empty → 0', () => expect(calculateMissedHazardScore([])).toBe(0));
  test('all missed → 100', () => {
    const fbs = [makeActiveFeedback({ supervisorObservedMissedHazard: true })];
    expect(calculateMissedHazardScore(fbs)).toBe(100);
  });
  test('none missed → 0', () => {
    const fbs = [makeActiveFeedback({ supervisorObservedMissedHazard: false })];
    expect(calculateMissedHazardScore(fbs)).toBe(0);
  });
});

describe('calculateFalseAlertScore', () => {
  test('empty → 0', () => expect(calculateFalseAlertScore([])).toBe(0));
  test('harmful → counted', () => {
    const fbs = [makeActiveFeedback({ usefulness: 'harmful' })];
    expect(calculateFalseAlertScore(fbs)).toBeGreaterThan(0);
  });
  test('all useful → 0', () => {
    const fbs = [makeActiveFeedback({ usefulness: 'very_useful' })];
    expect(calculateFalseAlertScore(fbs)).toBe(0);
  });
});

describe('calculateSafetyMetrics', () => {
  test('returns all 8 metrics', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const m = calculateSafetyMetrics(s);
    expect(typeof m.alertUsefulnessScore).toBe('number');
    expect(typeof m.missedHazardScore).toBe('number');
    expect(typeof m.falseAlertScore).toBe('number');
    expect(typeof m.averageReactionTimeMs).toBe('number');
    expect(typeof m.userConfidenceScore).toBe('number');
    expect(typeof m.supervisorSafetyScore).toBe('number');
    expect(typeof m.guidanceClarityScore).toBe('number');
    expect(typeof m.alertFatigueScore).toBe('number');
  });
  test('all scores are 0-100', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const m = calculateSafetyMetrics(s);
    [m.alertUsefulnessScore, m.userConfidenceScore, m.supervisorSafetyScore, m.guidanceClarityScore, m.alertFatigueScore].forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe('getMetricsGrade', () => {
  test('100 → excellent', () => expect(getMetricsGrade(100)).toBe('excellent'));
  test('70 → good', () => expect(getMetricsGrade(70)).toBe('good'));
  test('50 → fair', () => expect(getMetricsGrade(50)).toBe('fair'));
  test('30 → poor', () => expect(getMetricsGrade(30)).toBe('poor'));
});

describe('validateSafetyRules', () => {
  test('valid session → no violations', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    expect(validateSafetyRules(s)).toHaveLength(0);
  });
  test('missing consent → violation', () => {
    const s = { ...makeSession(), consent: { ...makeConsent(), consentGiven: false } };
    expect(validateSafetyRules(s).length).toBeGreaterThan(0);
  });
  test('serious incident → violation', () => {
    let s = startTrialSession(makeSession());
    s = addIncidentReport(s, { timestamp: Date.now(), description: 'Fall', severity: 'serious', supervisorAction: 'Stopped', resolved: false });
    const ended = endTrialSession(s);
    expect(validateSafetyRules(ended).length).toBeGreaterThan(0);
  });
});

describe('isSafeToPublish', () => {
  test('good metrics → safe', () => {
    const metrics = {
      alertUsefulnessScore: 75,
      missedHazardScore: 10,
      falseAlertScore: 10,
      averageReactionTimeMs: 500,
      userConfidenceScore: 80,
      supervisorSafetyScore: 90,
      guidanceClarityScore: 75,
      alertFatigueScore: 20,
    };
    expect(isSafeToPublish(metrics)).toBe(true);
  });
  test('low supervisor score → not safe', () => {
    const metrics = {
      alertUsefulnessScore: 75,
      missedHazardScore: 10,
      falseAlertScore: 10,
      averageReactionTimeMs: 500,
      userConfidenceScore: 80,
      supervisorSafetyScore: 60,
      guidanceClarityScore: 75,
      alertFatigueScore: 20,
    };
    expect(isSafeToPublish(metrics)).toBe(false);
  });
  test('high false alert → not safe', () => {
    const metrics = {
      alertUsefulnessScore: 75,
      missedHazardScore: 10,
      falseAlertScore: 40,
      averageReactionTimeMs: 500,
      userConfidenceScore: 80,
      supervisorSafetyScore: 80,
      guidanceClarityScore: 75,
      alertFatigueScore: 20,
    };
    expect(isSafeToPublish(metrics)).toBe(false);
  });
});

describe('SAFETY_THRESHOLDS', () => {
  test('minUsefulnessScore is 50', () => expect(SAFETY_THRESHOLDS.minUsefulnessScore).toBe(50));
  test('minSupervisorSafetyScore is 70', () => expect(SAFETY_THRESHOLDS.minSupervisorSafetyScore).toBe(70));
  test('maxFalseAlertScore is 30', () => expect(SAFETY_THRESHOLDS.maxFalseAlertScore).toBe(30));
});

// ─── USER FEEDBACK ENGINE ─────────────────────────────────────────────────────
describe('getFeedbackQuestions', () => {
  test('has 8 questions', () => expect(getFeedbackQuestions()).toHaveLength(8));
  test('all have IDs', () => getFeedbackQuestions().forEach(q => expect(q.id.length).toBeGreaterThan(0)));
  test('all have question text', () => getFeedbackQuestions().forEach(q => expect(q.question.length).toBeGreaterThan(0)));
  test('includes usefulness question', () => {
    const qs = getFeedbackQuestions();
    expect(qs.some(q => q.type === 'usefulness')).toBe(true);
  });
  test('includes timing question', () => {
    expect(getFeedbackQuestions().some(q => q.type === 'timing')).toBe(true);
  });
  test('includes boolean question', () => {
    expect(getFeedbackQuestions().some(q => q.type === 'boolean')).toBe(true);
  });
  test('includes text question', () => {
    expect(getFeedbackQuestions().some(q => q.type === 'text')).toBe(true);
  });
});

describe('createAlertFeedback', () => {
  test('creates feedback with correct alertId', () => {
    const fb = makeActiveFeedback();
    expect(fb.alertId).toBe('alert-1');
  });
  test('has feedbackId', () => expect(makeActiveFeedback().feedbackId.length).toBeGreaterThan(0));
  test('has sessionId', () => expect(makeActiveFeedback().sessionId).toBe('session-1'));
  test('stores all responses', () => {
    const fb = makeActiveFeedback({ usefulness: 'very_useful', clarity: 'very_clear' });
    expect(fb.usefulness).toBe('very_useful');
    expect(fb.clarity).toBe('very_clear');
  });
  test('defaults suggestedText to empty', () => {
    const fb = createAlertFeedback('a', 'b', {
      usefulness: 'useful', timing: 'just_right', frequency: 'about_right', clarity: 'clear',
      userFeltOverwhelmed: false, userFeltSafer: true,
    });
    expect(fb.suggestedAlternativeText).toBe('');
  });
});

describe('validateFeedbackResponses', () => {
  test('valid feedback passes', () => expect(validateFeedbackResponses(makeActiveFeedback())).toBe(true));
  test('invalid usefulness fails', () => {
    const fb = { ...makeActiveFeedback(), usefulness: 'maybe' as never };
    expect(validateFeedbackResponses(fb)).toBe(false);
  });
  test('invalid timing fails', () => {
    const fb = { ...makeActiveFeedback(), timing: 'never' as never };
    expect(validateFeedbackResponses(fb)).toBe(false);
  });
  test('invalid clarity fails', () => {
    const fb = { ...makeActiveFeedback(), clarity: 'sort_of' as never };
    expect(validateFeedbackResponses(fb)).toBe(false);
  });
});

describe('calculateFeedbackSummary', () => {
  test('empty → zero summary', () => {
    const s = calculateFeedbackSummary([]);
    expect(s.totalFeedbacks).toBe(0);
    expect(s.averageUsefulnessScore).toBe(0);
  });
  test('counts overwhelmed', () => {
    const fbs = [makeActiveFeedback({ userFeltOverwhelmed: true }), makeActiveFeedback({ userFeltOverwhelmed: false })];
    expect(calculateFeedbackSummary(fbs).overwhelmedCount).toBe(1);
  });
  test('counts safer', () => {
    const fbs = [makeActiveFeedback({ userFeltSafer: true }), makeActiveFeedback({ userFeltSafer: false })];
    expect(calculateFeedbackSummary(fbs).saferCount).toBe(1);
  });
  test('counts late timing', () => {
    const fbs = [makeActiveFeedback({ timing: 'too_late' })];
    expect(calculateFeedbackSummary(fbs).lateFeedbackCount).toBe(1);
  });
  test('counts frequency complaints', () => {
    const fbs = [makeActiveFeedback({ frequency: 'too_frequent' })];
    expect(calculateFeedbackSummary(fbs).frequencyComplaintCount).toBe(1);
  });
  test('collects alternative text suggestions', () => {
    const fbs = [makeActiveFeedback({ suggestedAlternativeText: 'Say it differently' })];
    expect(calculateFeedbackSummary(fbs).alternativeTextSuggestions).toHaveLength(1);
  });
});

describe('buildFeedbackGuidance', () => {
  test('no feedback → default guidance', () => {
    const g = buildFeedbackGuidance(calculateFeedbackSummary([]));
    expect(g.length).toBeGreaterThan(0);
  });
  test('low usefulness → recommendation', () => {
    const fbs = [makeActiveFeedback({ usefulness: 'harmful' }), makeActiveFeedback({ usefulness: 'not_useful' })];
    const g = buildFeedbackGuidance(calculateFeedbackSummary(fbs));
    expect(g.some(r => r.toLowerCase().includes('useful'))).toBe(true);
  });
  test('high overwhelmed → frequency recommendation', () => {
    const fbs = Array(4).fill(null).map(() => makeActiveFeedback({ userFeltOverwhelmed: true }));
    const g = buildFeedbackGuidance(calculateFeedbackSummary(fbs));
    expect(g.length).toBeGreaterThan(0);
  });
  test('returns array', () => expect(Array.isArray(buildFeedbackGuidance(calculateFeedbackSummary([])))).toBe(true));
});

describe('describeUsefulness / describeClarity / describeTiming', () => {
  test('very_useful has description', () => expect(describeUsefulness('very_useful').length).toBeGreaterThan(0));
  test('harmful has description', () => expect(describeUsefulness('harmful').length).toBeGreaterThan(0));
  test('very_clear has description', () => expect(describeClarity('very_clear').length).toBeGreaterThan(0));
  test('too_late has description', () => expect(describeTiming('too_late').length).toBeGreaterThan(0));
  test('just_right has description', () => expect(describeTiming('just_right').length).toBeGreaterThan(0));
});

// ─── TRIAL REPORT ENGINE ──────────────────────────────────────────────────────
describe('generateTrialReport', () => {
  test('generates report for completed session', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const m = calculateSafetyMetrics(s);
    const sum = calculateFeedbackSummary(s.alertFeedbacks);
    const r = generateTrialReport(s, m, sum);
    expect(r.sessionId).toBe(s.sessionId);
  });
  test('has report ID', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const r = generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary(s.alertFeedbacks));
    expect(r.reportId.length).toBeGreaterThan(0);
  });
  test('has recommendations', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const r = generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary(s.alertFeedbacks));
    expect(r.recommendations.length).toBeGreaterThan(0);
  });
  test('has privacy guarantees', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const r = generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary(s.alertFeedbacks));
    expect(r.privacyGuarantees.length).toBeGreaterThan(0);
  });
  test('throws for deleted session', () => {
    const deleted = deleteSessionData(makeSession());
    let threw = false;
    try { generateTrialReport(deleted, calculateSafetyMetrics(deleted), calculateFeedbackSummary([])); }
    catch { threw = true; }
    expect(threw).toBe(true);
  });
  test('records emergency stop', () => {
    const s = triggerEmergencyStop(startTrialSession(makeSession()));
    const r = generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary(s.alertFeedbacks));
    expect(r.emergencyStopUsed).toBe(true);
  });
});

describe('buildRecommendations', () => {
  test('returns array of strings', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const m = calculateSafetyMetrics(s);
    const sum = calculateFeedbackSummary(s.alertFeedbacks);
    const recs = buildRecommendations(m, sum, s);
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
  });
  test('emergency stop → recommendation', () => {
    const s = triggerEmergencyStop(startTrialSession(makeSession()));
    const recs = buildRecommendations(calculateSafetyMetrics(s), calculateFeedbackSummary([]), s);
    expect(recs.some(r => r.toLowerCase().includes('emergency'))).toBe(true);
  });
  test('serious incident → recommendation', () => {
    let s = startTrialSession(makeSession());
    s = addIncidentReport(s, { timestamp: Date.now(), description: 'Fall', severity: 'serious', supervisorAction: 'Stopped', resolved: false });
    const ended = endTrialSession(s);
    const recs = buildRecommendations(calculateSafetyMetrics(ended), calculateFeedbackSummary([]), ended);
    expect(recs.some(r => r.toLowerCase().includes('incident') || r.toLowerCase().includes('serious'))).toBe(true);
  });
});

describe('getPrivacyGuarantees', () => {
  test('returns non-empty array', () => expect(getPrivacyGuarantees().length).toBeGreaterThan(0));
  test('mentions no video', () => expect(getPrivacyGuarantees().some(g => g.toLowerCase().includes('video'))).toBe(true));
  test('mentions no face recognition', () => expect(getPrivacyGuarantees().some(g => g.toLowerCase().includes('face'))).toBe(true));
  test('mentions deletion', () => expect(getPrivacyGuarantees().some(g => g.toLowerCase().includes('delet'))).toBe(true));
});

describe('exportReportAsJSON', () => {
  test('returns valid JSON string', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const r = generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary([]));
    const json = exportReportAsJSON(r);
    let parsed: unknown = null;
    let threw = false;
    try { parsed = JSON.parse(json); } catch { threw = true; }
    expect(threw).toBe(false);
    expect(parsed).not.toBeNull();
  });
  test('deleted report returns error JSON', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const r = deleteReport(generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary([])));
    const json = exportReportAsJSON(r);
    expect(json).toContain('error');
  });
});

describe('formatReportSummary', () => {
  test('contains scenario', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const r = generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary([]));
    expect(formatReportSummary(r)).toContain('hallway');
  });
  test('contains duration', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const r = generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary([]));
    expect(formatReportSummary(r)).toContain('Duration');
  });
});

describe('deleteReport', () => {
  test('sets deleted flag', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const r = generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary([]));
    expect(deleteReport(r).deleted).toBe(true);
  });
  test('redacts participantId', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const r = deleteReport(generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary([])));
    expect(r.participantId).toBe('[deleted]');
  });
  test('clears feedback summary', () => {
    const s = endTrialSession(startTrialSession(makeSession()));
    const r = deleteReport(generateTrialReport(s, calculateSafetyMetrics(s), calculateFeedbackSummary([])));
    expect(r.feedbackSummary.totalFeedbacks).toBe(0);
  });
});

// ─── PRIVACY CONSTANTS ────────────────────────────────────────────────────────
describe('TRIAL_PRIVACY', () => {
  test('noVideoStorage is true', () => expect(TRIAL_PRIVACY.noVideoStorage).toBe(true));
  test('noFaceRecognition is true', () => expect(TRIAL_PRIVACY.noFaceRecognition).toBe(true));
  test('noEmergencyStreaming is true', () => expect(TRIAL_PRIVACY.noEmergencyStreaming).toBe(true));
  test('noBiometricStorage is true', () => expect(TRIAL_PRIVACY.noBiometricStorage).toBe(true));
  test('consentRequired is true', () => expect(TRIAL_PRIVACY.consentRequired).toBe(true));
  test('supervisorRequired is true', () => expect(TRIAL_PRIVACY.supervisorRequired).toBe(true));
  test('locationStorageDisabled is true', () => expect(TRIAL_PRIVACY.locationStorageDisabled).toBe(true));
  test('dataDeleteOnRequest is true', () => expect(TRIAL_PRIVACY.dataDeleteOnRequest).toBe(true));
});

describe('TRIAL_SCENARIO_REGISTRY', () => {
  test('has 9 scenarios', () => expect(TRIAL_SCENARIO_REGISTRY).toHaveLength(9));
  test('road_crossing is simulation only', () => {
    const sc = TRIAL_SCENARIO_REGISTRY.find(s => s.id === 'road_crossing_simulation');
    expect(sc?.safetyNotes.toLowerCase()).toContain('simulation');
  });
  test('stairs requires 2 supervisors', () => {
    const stairs = TRIAL_SCENARIO_REGISTRY.find(s => s.id === 'stairs');
    expect(stairs?.minimumSupervisors).toBe(2);
  });
  test('all scenarios have names', () => TRIAL_SCENARIO_REGISTRY.forEach(s => expect(s.name.length).toBeGreaterThan(0)));
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

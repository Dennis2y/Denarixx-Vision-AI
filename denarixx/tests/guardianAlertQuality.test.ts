/**
 * Sprint 5 — Guardian Alert Quality Tests
 *
 * Tests deduplication, updated cooldowns, silence decisions, priority ordering,
 * improved wording, decision logging, and AlertQualityEngine integration.
 *
 * Run with: npx tsx tests/guardianAlertQuality.test.ts
 */

import { AlertDeduplicationEngine } from '../src/engines/alertDeduplicationEngine';
import { AlertThrottleEngine } from '../src/engines/alertThrottleEngine';
import { GuardianWordingEngine } from '../src/engines/guardianWordingEngine';
import { GuardianDecisionLogger } from '../src/engines/guardianDecisionLogger';
import { AlertQualityEngine } from '../src/engines/alertQualityEngine';
import { CognitiveGuardianEngine } from '../src/engines/cognitiveGuardianEngine';
import type { Detection, HazardSeverity, SafetyDecision } from '../src/types';
import type { DetectedCategories, VisionHazardResult } from '../src/types/vision';
import type { RiskLevel } from '../src/types/cognitive';

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

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) throw new Error(`${msg} — expected ${String(expected)}, got ${String(actual)}`);
}

function makeDetections(labels: string[], confidence = 0.8): Detection[] {
  return labels.map((label) => ({ label, confidence }));
}

function makeCategories(vehicles: Detection[] = [], obstacles: Detection[] = [], stairs: Detection[] = []): DetectedCategories {
  return { vehicles, obstacles, stairs, people: [], doors: [], crossings: [], signs: [] };
}

function makeHazard(type: string, severity: HazardSeverity, confidence = 0.8): VisionHazardResult {
  return { type, severity, confidence, description: `${type} detected` };
}

const baseAlert: SafetyDecision = {
  shouldAlert: true,
  urgency: 'high',
  message: 'Hazard ahead.',
  confidence: 0.8,
  interruptNarration: true,
};

const noAlert: SafetyDecision = {
  shouldAlert: false,
  urgency: 'none',
  message: '',
  confidence: 1,
  interruptNarration: false,
};

async function runAll() {
  console.log('\nDenarixx Vision AI — Sprint 5: Guardian Alert Quality Tests\n');

  // ── AlertDeduplicationEngine ─────────────────────────────────────────────────
  console.log('AlertDeduplicationEngine');

  const dedup = new AlertDeduplicationEngine();

  await test('isFirstFrame true on first update', () => {
    dedup.reset();
    const frame = dedup.update(makeDetections(['vehicle']));
    assert(frame.isFirstFrame, 'first frame should be isFirstFrame=true');
  });

  await test('appeared contains labels in current but not previous frame', () => {
    dedup.reset();
    dedup.update([]);
    const frame = dedup.update(makeDetections(['vehicle']));
    assert(frame.appeared.includes('vehicle'), 'vehicle should appear');
    assert(frame.ongoing.length === 0, 'no ongoing');
    assert(frame.disappeared.length === 0, 'no disappeared');
  });

  await test('ongoing contains labels present in both frames', () => {
    dedup.reset();
    dedup.update(makeDetections(['stairs']));
    const frame = dedup.update(makeDetections(['stairs']));
    assert(frame.ongoing.includes('stairs'), 'stairs should be ongoing');
    assert(frame.appeared.length === 0, 'no appeared');
  });

  await test('disappeared contains labels present in prev but not current', () => {
    dedup.reset();
    dedup.update(makeDetections(['person']));
    const frame = dedup.update([]);
    assert(frame.disappeared.includes('person'), 'person should disappear');
    assert(frame.appeared.length === 0, 'no appeared');
    assert(frame.ongoing.length === 0, 'no ongoing');
  });

  await test('isNew returns true for a label never seen before', () => {
    dedup.reset();
    dedup.update([]);
    dedup.update(makeDetections(['crossing']));
    assert(dedup.isNew('crossing'), 'crossing should be new');
  });

  await test('isNew returns false for a label seen in a prior frame', () => {
    dedup.reset();
    dedup.update(makeDetections(['vehicle']));
    dedup.update(makeDetections(['vehicle']));
    assert(!dedup.isNew('vehicle'), 'vehicle seen before — not new');
  });

  await test('isReturn true when a label was gone and comes back', () => {
    dedup.reset();
    dedup.update(makeDetections(['obstacle'])); // frame 1: seen
    dedup.update([]);                            // frame 2: gone
    dedup.update(makeDetections(['obstacle'])); // frame 3: returned
    assert(dedup.isReturn('obstacle'), 'obstacle should be a return');
    assert(!dedup.isNew('obstacle'), 'obstacle should NOT be new (was seen before)');
  });

  await test('isMeaningfulChange true when confidence rises by ≥ 10%', () => {
    dedup.reset();
    dedup.update([{ label: 'vehicle', confidence: 0.5 }]);
    dedup.update([{ label: 'vehicle', confidence: 0.62 }]); // +12% — meaningful
    assert(dedup.isMeaningfulChange('vehicle', 0.62), 'should be meaningful change');
  });

  await test('isMeaningfulChange false for small confidence rise (< 10%)', () => {
    dedup.reset();
    dedup.update([{ label: 'vehicle', confidence: 0.8 }]);
    dedup.update([{ label: 'vehicle', confidence: 0.84 }]); // +4% — not meaningful
    assert(!dedup.isMeaningfulChange('vehicle', 0.84), 'small rise should not be meaningful');
  });

  await test('isMeaningfulChange false for new or absent labels', () => {
    dedup.reset();
    dedup.update([]);
    dedup.update([{ label: 'stairs', confidence: 0.9 }]);
    assert(!dedup.isMeaningfulChange('stairs', 0.9), 'new label cannot be an ongoing change');
  });

  await test('reset clears all state', () => {
    dedup.reset();
    dedup.update(makeDetections(['vehicle', 'obstacle']));
    dedup.reset();
    assertEqual(dedup.getFrameIndex(), 0, 'frameIndex should reset to 0');
    assertEqual(dedup.getCurrentLabels().size, 0, 'current labels should be empty');
    assertEqual(dedup.getEverSeen().size, 0, 'ever-seen should be empty');
  });

  await test('label normalisation: uppercase input matches lowercase tracking', () => {
    dedup.reset();
    dedup.update([]);
    dedup.update([{ label: 'VEHICLE', confidence: 0.9 }]);
    assert(dedup.isNew('vehicle'), 'should normalise to lowercase');
  });

  await test('multiple labels in same frame tracked independently', () => {
    dedup.reset();
    dedup.update(makeDetections(['vehicle']));
    const frame = dedup.update(makeDetections(['vehicle', 'stairs']));
    assert(frame.ongoing.includes('vehicle'), 'vehicle ongoing');
    assert(frame.appeared.includes('stairs'), 'stairs appeared');
  });

  await test('getConfidenceDelta returns correct delta for ongoing label', () => {
    dedup.reset();
    dedup.update([{ label: 'obstacle', confidence: 0.6 }]);
    dedup.update([{ label: 'obstacle', confidence: 0.75 }]);
    const delta = dedup.getConfidenceDelta('obstacle', 0.75);
    assert(Math.abs(delta - 0.15) < 0.001, `expected delta ~0.15, got ${delta}`);
  });

  // ── AlertThrottleEngine cooldowns (Sprint 5 values) ──────────────────────────
  console.log('\nAlertThrottleEngine — Sprint 5 cooldown values');

  const throttle = new AlertThrottleEngine();

  await test('critical cooldown: 5s — always speaks within cooldown', () => {
    throttle.reset();
    throttle.record('vehicle', 'critical', 0.9, 'Stop!');
    const result = throttle.shouldSpeak({ hazardType: 'vehicle', severity: 'critical', confidence: 0.91, message: 'Stop!' });
    assert(result.shouldSpeak, 'critical always speaks');
    assert(result.msUntilCooldownExpires > 0, 'cooldown should be active (5s)');
    assert(result.msUntilCooldownExpires <= 5000, 'cooldown should not exceed 5s');
  });

  await test('high cooldown: 10s — silenced immediately after record', () => {
    throttle.reset();
    throttle.record('obstacle', 'high', 0.8, 'Obstacle ahead.');
    const result = throttle.shouldSpeak({ hazardType: 'obstacle', severity: 'high', confidence: 0.82, message: 'Obstacle ahead.' });
    assert(!result.shouldSpeak, 'high silenced within 10s cooldown');
    assert(result.msUntilCooldownExpires > 0, 'cooldown remaining > 0');
    assert(result.msUntilCooldownExpires <= 10_000, 'cooldown should not exceed 10s');
  });

  await test('medium cooldown: 20s — silenced immediately after record', () => {
    throttle.reset();
    throttle.record('step', 'medium', 0.7, 'Step ahead.');
    const result = throttle.shouldSpeak({ hazardType: 'step', severity: 'medium', confidence: 0.71, message: 'Step ahead.' });
    assert(!result.shouldSpeak, 'medium silenced within 20s cooldown');
    assert(result.msUntilCooldownExpires <= 20_000, 'cooldown should not exceed 20s');
  });

  await test('low cooldown: 30s — silenced immediately after record', () => {
    throttle.reset();
    throttle.record('sign', 'low', 0.5, 'Sign detected.');
    const result = throttle.shouldSpeak({ hazardType: 'sign', severity: 'low', confidence: 0.51, message: 'Sign detected.' });
    assert(!result.shouldSpeak, 'low silenced within 30s cooldown');
    assert(result.msUntilCooldownExpires <= 30_000, 'cooldown should not exceed 30s');
  });

  await test('high cooldown < medium cooldown (10s < 20s)', () => {
    throttle.reset();
    throttle.record('obstacle', 'high', 0.8, 'test');
    throttle.record('step', 'medium', 0.7, 'test');
    const highResult = throttle.shouldSpeak({ hazardType: 'obstacle', severity: 'high', confidence: 0.81, message: 'test' });
    const medResult = throttle.shouldSpeak({ hazardType: 'step', severity: 'medium', confidence: 0.71, message: 'test' });
    assert(highResult.msUntilCooldownExpires < medResult.msUntilCooldownExpires, 'high cooldown expires sooner than medium');
  });

  // ── GuardianWordingEngine ────────────────────────────────────────────────────
  console.log('\nGuardianWordingEngine');

  const wording = new GuardianWordingEngine();

  await test('vehicle critical — contains "stop" (case insensitive)', () => {
    const msg = wording.generate({ hazardType: 'vehicle', severity: 'critical', confidence: 0.95 });
    assert(msg.toLowerCase().includes('stop'), `vehicle critical should say stop, got: "${msg}"`);
  });

  await test('obstacle high — does NOT say "hazard detected"', () => {
    const msg = wording.generate({ hazardType: 'obstacle', severity: 'high', confidence: 0.85 });
    assert(!msg.toLowerCase().includes('hazard detected'), `should not say "hazard detected", got: "${msg}"`);
  });

  await test('stairs high — mentions railing or slow', () => {
    const msg = wording.generate({ hazardType: 'stairs', severity: 'high', confidence: 0.8 });
    const lower = msg.toLowerCase();
    assert(lower.includes('railing') || lower.includes('slow'), `stairs should mention railing or slow, got: "${msg}"`);
  });

  await test('crossing critical — mentions stop', () => {
    const msg = wording.generate({ hazardType: 'crossing', severity: 'critical', confidence: 0.9 });
    assert(msg.toLowerCase().includes('stop'), `crossing critical should say stop, got: "${msg}"`);
  });

  await test('person high — actionable (mentions navigate or around)', () => {
    const msg = wording.generate({ hazardType: 'person', severity: 'high', confidence: 0.85 });
    const lower = msg.toLowerCase();
    assert(lower.includes('navigat') || lower.includes('around') || lower.includes('blocking'), `person high should be actionable, got: "${msg}"`);
  });

  await test('low confidence (<0.5) — adds uncertainty prefix', () => {
    const msg = wording.generate({ hazardType: 'obstacle', severity: 'medium', confidence: 0.4 });
    const lower = msg.toLowerCase();
    assert(lower.includes("not certain") || lower.includes('may be'), `low confidence should hedge, got: "${msg}"`);
  });

  await test('high confidence (≥0.7) — no uncertainty prefix', () => {
    const msg = wording.generate({ hazardType: 'obstacle', severity: 'high', confidence: 0.9 });
    assert(!msg.toLowerCase().includes('not certain'), `high confidence should not hedge, got: "${msg}"`);
  });

  await test('return hazard — message contains return phrasing', () => {
    const msg = wording.generate({ hazardType: 'vehicle', severity: 'high', confidence: 0.8, isReturn: true });
    assert(msg.toLowerCase().includes('return'), `return hazard should say returned, got: "${msg}"`);
  });

  await test('directional left hint when bounding box x is small', () => {
    const det: Detection = { label: 'obstacle', confidence: 0.85, boundingBox: { x: 0.1, y: 0.5, width: 0.2, height: 0.3 } };
    const msg = wording.generate({ hazardType: 'obstacle', severity: 'high', confidence: 0.85, detection: det });
    assert(msg.toLowerCase().includes('left'), `should say left, got: "${msg}"`);
  });

  await test('directional right hint when bounding box x is large', () => {
    const det: Detection = { label: 'obstacle', confidence: 0.85, boundingBox: { x: 0.8, y: 0.5, width: 0.1, height: 0.3 } };
    const msg = wording.generate({ hazardType: 'obstacle', severity: 'high', confidence: 0.85, detection: det });
    assert(msg.toLowerCase().includes('right'), `should say right, got: "${msg}"`);
  });

  await test('generateFromCategories: vehicle category takes priority over stairs', () => {
    const categories = makeCategories(
      [{ label: 'vehicle', confidence: 0.8 }],
      [],
      [{ label: 'stairs', confidence: 0.7 }]
    );
    const msg = wording.generateFromCategories(categories, 'high', 0.8);
    assert(msg.toLowerCase().includes('vehicle') || msg.toLowerCase().includes('slow') || msg.toLowerCase().includes('stop'),
      `vehicle should take priority, got: "${msg}"`);
  });

  await test('generateFromCategories: stairs when no vehicles', () => {
    const categories = makeCategories([], [], [{ label: 'stairs', confidence: 0.8 }]);
    const msg = wording.generateFromCategories(categories, 'high', 0.8);
    const lower = msg.toLowerCase();
    assert(lower.includes('stair') || lower.includes('railing') || lower.includes('slow'),
      `stairs message expected, got: "${msg}"`);
  });

  await test('unknown hazard type — generic but actionable (no "hazard detected")', () => {
    const msg = wording.generate({ hazardType: 'unknown_thing_xyz', severity: 'medium', confidence: 0.75 });
    assert(!msg.toLowerCase().includes('hazard detected'), `should not say "hazard detected", got: "${msg}"`);
    assert(msg.length > 5, 'should produce some message');
  });

  // ── GuardianDecisionLogger ───────────────────────────────────────────────────
  console.log('\nGuardianDecisionLogger');

  const logger = new GuardianDecisionLogger();
  const emptyFrame = { appeared: [], disappeared: [], ongoing: [], isFirstFrame: false };

  await test('starts empty', () => {
    logger.clear();
    assertEqual(logger.size(), 0, 'size should be 0');
    assertEqual(logger.getTotalSpoken(), 0, 'totalSpoken should be 0');
    assertEqual(logger.getTotalSilent(), 0, 'totalSilent should be 0');
  });

  await test('log spoke entry increments totalSpoken', () => {
    logger.clear();
    logger.log({ spoke: true, speakTrigger: 'new_hazard', silenceReason: null, hazardType: 'vehicle', severity: 'high', confidence: 0.85, riskLevel: 'high', message: 'Vehicle ahead.', deduplicationFrame: emptyFrame });
    assertEqual(logger.getTotalSpoken(), 1, 'totalSpoken should be 1');
    assertEqual(logger.getTotalSilent(), 0, 'totalSilent should be 0');
  });

  await test('log silent entry increments totalSilent', () => {
    logger.clear();
    logger.log({ spoke: false, speakTrigger: null, silenceReason: 'cooldown active', hazardType: 'step', severity: 'medium', confidence: 0.7, riskLevel: 'medium', message: null, deduplicationFrame: emptyFrame });
    assertEqual(logger.getTotalSilent(), 1, 'totalSilent should be 1');
    assertEqual(logger.getTotalSpoken(), 0, 'totalSpoken should be 0');
  });

  await test('getRecentLogs returns newest first', () => {
    logger.clear();
    logger.log({ spoke: true, speakTrigger: 'new_hazard', silenceReason: null, hazardType: 'vehicle', severity: 'high', confidence: 0.8, riskLevel: 'high', message: 'first', deduplicationFrame: emptyFrame });
    logger.log({ spoke: true, speakTrigger: 'risk_increased', silenceReason: null, hazardType: 'vehicle', severity: 'critical', confidence: 0.95, riskLevel: 'critical', message: 'second', deduplicationFrame: emptyFrame });
    const logs = logger.getRecentLogs(2);
    assertEqual(logs[0].message, 'second', 'most recent should be first');
    assertEqual(logs[1].message, 'first', 'older should be second');
  });

  await test('getSpokenLogs filters to spoke=true only', () => {
    logger.clear();
    logger.log({ spoke: true, speakTrigger: 'new_hazard', silenceReason: null, hazardType: 'v', severity: 'high', confidence: 0.8, riskLevel: 'high', message: 'spoke', deduplicationFrame: emptyFrame });
    logger.log({ spoke: false, speakTrigger: null, silenceReason: 'cooldown', hazardType: 'v', severity: 'high', confidence: 0.8, riskLevel: 'high', message: null, deduplicationFrame: emptyFrame });
    const spoken = logger.getSpokenLogs();
    assert(spoken.every((l) => l.spoke), 'all returned entries should have spoke=true');
    assertEqual(spoken.length, 1, 'should be 1 spoken entry');
  });

  await test('getSilentLogs filters to spoke=false only', () => {
    logger.clear();
    logger.log({ spoke: true, speakTrigger: 'new_hazard', silenceReason: null, hazardType: 'v', severity: 'high', confidence: 0.8, riskLevel: 'high', message: 'spoke', deduplicationFrame: emptyFrame });
    logger.log({ spoke: false, speakTrigger: null, silenceReason: 'cooldown', hazardType: 'v', severity: 'high', confidence: 0.8, riskLevel: 'high', message: null, deduplicationFrame: emptyFrame });
    const silent = logger.getSilentLogs();
    assert(silent.every((l) => !l.spoke), 'all returned entries should have spoke=false');
    assertEqual(silent.length, 1, 'should be 1 silent entry');
  });

  await test('getSilenceRatio returns correct ratio', () => {
    logger.clear();
    logger.log({ spoke: true, speakTrigger: 'new_hazard', silenceReason: null, hazardType: null, severity: null, confidence: 0.8, riskLevel: 'high', message: 'yes', deduplicationFrame: emptyFrame });
    logger.log({ spoke: false, speakTrigger: null, silenceReason: 'cooldown', hazardType: null, severity: null, confidence: 0.8, riskLevel: 'high', message: null, deduplicationFrame: emptyFrame });
    logger.log({ spoke: false, speakTrigger: null, silenceReason: 'dedup', hazardType: null, severity: null, confidence: 0.8, riskLevel: 'high', message: null, deduplicationFrame: emptyFrame });
    const ratio = logger.getSilenceRatio();
    assert(Math.abs(ratio - (2 / 3)) < 0.001, `expected ~0.667, got ${ratio}`);
  });

  await test('clear resets all counters and entries', () => {
    logger.log({ spoke: true, speakTrigger: 'new_hazard', silenceReason: null, hazardType: null, severity: null, confidence: 0.8, riskLevel: 'none', message: null, deduplicationFrame: emptyFrame });
    logger.clear();
    assertEqual(logger.size(), 0, 'size should be 0');
    assertEqual(logger.getTotalSpoken(), 0, 'totalSpoken should be 0');
    assertEqual(logger.getTotalSilent(), 0, 'totalSilent should be 0');
    assertEqual(logger.getSilenceRatio(), 0, 'ratio should be 0');
  });

  await test('getSpeakTriggerSummary groups by trigger type', () => {
    logger.clear();
    logger.log({ spoke: true, speakTrigger: 'new_hazard', silenceReason: null, hazardType: null, severity: null, confidence: 0.8, riskLevel: 'high', message: null, deduplicationFrame: emptyFrame });
    logger.log({ spoke: true, speakTrigger: 'new_hazard', silenceReason: null, hazardType: null, severity: null, confidence: 0.8, riskLevel: 'high', message: null, deduplicationFrame: emptyFrame });
    logger.log({ spoke: true, speakTrigger: 'risk_increased', silenceReason: null, hazardType: null, severity: null, confidence: 0.8, riskLevel: 'critical', message: null, deduplicationFrame: emptyFrame });
    const summary = logger.getSpeakTriggerSummary();
    assertEqual(summary['new_hazard'], 2, 'new_hazard count should be 2');
    assertEqual(summary['risk_increased'], 1, 'risk_increased count should be 1');
  });

  // ── AlertQualityEngine — speak-when rules ────────────────────────────────────
  console.log('\nAlertQualityEngine — speak-when rules');

  const quality = new AlertQualityEngine();

  await test('new hazard → shouldSpeak=true with trigger=new_hazard or hazard_returned', () => {
    quality.reset();
    quality.process({ detections: [], categories: makeCategories(), baseDecision: noAlert }); // empty frame 1
    const result = quality.process({
      detections: makeDetections(['vehicle']),
      categories: makeCategories([{ label: 'vehicle', confidence: 0.85 }]),
      aiHazards: [makeHazard('vehicle', 'high', 0.85)],
      baseDecision: baseAlert,
    });
    assert(result.shouldSpeak, 'new vehicle should trigger speak');
    assert(result.speakTrigger === 'new_hazard' || result.speakTrigger === 'hazard_returned',
      `expected new_hazard or hazard_returned, got: ${result.speakTrigger}`);
  });

  await test('same hazard immediately after → shouldSpeak=false (cooldown)', () => {
    quality.reset();
    // Frame 1: first time (speaks)
    quality.process({
      detections: makeDetections(['stairs']),
      categories: makeCategories([], [], [{ label: 'stairs', confidence: 0.8 }]),
      aiHazards: [makeHazard('stairs', 'medium', 0.8)],
      baseDecision: baseAlert,
    });
    // Frame 2: same hazard, tiny confidence change (should be silenced)
    const result = quality.process({
      detections: makeDetections(['stairs'], 0.81),
      categories: makeCategories([], [], [{ label: 'stairs', confidence: 0.81 }]),
      aiHazards: [makeHazard('stairs', 'medium', 0.81)],
      baseDecision: baseAlert,
    });
    assert(!result.shouldSpeak, `ongoing same hazard should be silent, got trigger=${result.speakTrigger}, silence=${result.silenceReason}`);
    assert(result.silenceReason !== null, 'silence reason should be provided');
  });

  await test('critical hazard → always speaks regardless of cooldown', () => {
    quality.reset();
    // Record a critical first
    quality.process({
      detections: makeDetections(['vehicle']),
      categories: makeCategories([{ label: 'vehicle', confidence: 0.9 }]),
      aiHazards: [makeHazard('vehicle', 'critical', 0.9)],
      baseDecision: { ...baseAlert, urgency: 'critical' },
    });
    // Again immediately — still speaks
    const result = quality.process({
      detections: makeDetections(['vehicle'], 0.91),
      categories: makeCategories([{ label: 'vehicle', confidence: 0.91 }]),
      aiHazards: [makeHazard('vehicle', 'critical', 0.91)],
      baseDecision: { ...baseAlert, urgency: 'critical' },
    });
    assert(result.shouldSpeak, 'critical should always speak');
    assertEqual(result.speakTrigger, 'critical_never_silenced', 'trigger should be critical_never_silenced');
  });

  await test('confidence_increased trigger when confidence rises by ≥ 10%', () => {
    quality.reset();
    // Frame 1: first seen (speaks - new_hazard)
    quality.process({
      detections: [{ label: 'obstacle', confidence: 0.55 }],
      aiHazards: [makeHazard('obstacle', 'medium', 0.55)],
      baseDecision: baseAlert,
    });
    // Frame 2: ongoing, significant confidence rise (+15%)
    const result = quality.process({
      detections: [{ label: 'obstacle', confidence: 0.70 }],
      aiHazards: [makeHazard('obstacle', 'medium', 0.70)],
      baseDecision: baseAlert,
    });
    assert(result.shouldSpeak, 'significant confidence rise should trigger speak');
    assertEqual(result.speakTrigger, 'confidence_increased', 'trigger should be confidence_increased');
  });

  await test('risk_increased trigger when risk level goes up', () => {
    // Scenario: vehicle is ongoing (seen in frame 1), AND risk increases frame 2 → frame 3
    const q2 = new AlertQualityEngine();
    // Frame 1: vehicle at medium-level severity (first time)
    q2.process({
      detections: makeDetections(['vehicle']),
      aiHazards: [makeHazard('vehicle', 'medium', 0.6)],
      baseDecision: baseAlert,
      prevRiskLevel: 'none',
    });
    // Frame 2: same vehicle, risk escalates to high — still ongoing, so not new_hazard
    const result = q2.process({
      detections: makeDetections(['vehicle'], 0.61), // tiny confidence change — not meaningful
      aiHazards: [makeHazard('vehicle', 'high', 0.61)],
      baseDecision: baseAlert,
      prevRiskLevel: 'medium', // explicitly tell engine risk went from medium → high
    });
    assert(result.shouldSpeak, 'risk increase should trigger speak');
    assertEqual(result.speakTrigger, 'risk_increased', 'trigger should be risk_increased');
  });

  await test('repeat_requested=true always speaks', () => {
    quality.reset();
    // First time (new hazard)
    quality.process({
      detections: makeDetections(['obstacle']),
      aiHazards: [makeHazard('obstacle', 'high', 0.85)],
      baseDecision: baseAlert,
    });
    // Same hazard immediately + repeat requested
    const result = quality.process({
      detections: makeDetections(['obstacle'], 0.86),
      aiHazards: [makeHazard('obstacle', 'high', 0.86)],
      baseDecision: baseAlert,
      repeatRequested: true,
    });
    assert(result.shouldSpeak, 'repeat requested should always speak');
    assertEqual(result.speakTrigger, 'repeat_requested', 'trigger should be repeat_requested');
  });

  await test('no hazard (shouldAlert=false) → shouldSpeak=false', () => {
    quality.reset();
    const result = quality.process({ detections: [], baseDecision: noAlert });
    assert(!result.shouldSpeak, 'no hazard should not speak');
    assert(result.silenceReason !== null, 'silence reason should be set');
  });

  await test('user_state_changed trigger when activity changes', () => {
    quality.reset();
    // First speak on new hazard
    quality.process({
      detections: makeDetections(['obstacle']),
      aiHazards: [makeHazard('obstacle', 'medium', 0.7)],
      baseDecision: baseAlert,
      prevUserActivity: 'walking',
      currentUserActivity: 'walking',
    });
    // Ongoing same hazard, user stopped walking
    const result = quality.process({
      detections: makeDetections(['obstacle'], 0.71),
      aiHazards: [makeHazard('obstacle', 'medium', 0.71)],
      baseDecision: baseAlert,
      prevUserActivity: 'walking',
      currentUserActivity: 'stopped',
    });
    assert(result.shouldSpeak, 'user state change should trigger speak');
    assertEqual(result.speakTrigger, 'user_state_changed', 'trigger should be user_state_changed');
  });

  // ── AlertQualityEngine — message quality ─────────────────────────────────────
  console.log('\nAlertQualityEngine — message quality');

  await test('spoken message is not null and actionable', () => {
    quality.reset();
    quality.process({ detections: [], baseDecision: noAlert }); // frame 1: empty
    const result = quality.process({
      detections: makeDetections(['vehicle']),
      categories: makeCategories([{ label: 'vehicle', confidence: 0.85 }]),
      aiHazards: [makeHazard('vehicle', 'high', 0.85)],
      baseDecision: baseAlert,
    });
    assert(result.shouldSpeak, 'should speak');
    assert(result.message !== null, 'message should not be null');
    assert(result.message!.length > 10, 'message should be meaningful');
    assert(!result.message!.toLowerCase().includes('hazard detected'), 'no generic "hazard detected"');
  });

  await test('silent decision has null message', () => {
    const q = new AlertQualityEngine();
    const result = q.process({ detections: [], baseDecision: noAlert });
    assert(!result.shouldSpeak, 'should not speak');
    assert(result.message === null, 'message should be null when silent');
  });

  // ── AlertQualityEngine — deduplication frame in output ───────────────────────
  console.log('\nAlertQualityEngine — deduplication frame in decision');

  await test('logEntry contains correct deduplicationFrame', () => {
    const q = new AlertQualityEngine();
    q.process({ detections: [], baseDecision: noAlert });
    const result = q.process({
      detections: makeDetections(['stairs']),
      aiHazards: [makeHazard('stairs', 'high', 0.8)],
      baseDecision: baseAlert,
    });
    assert(result.logEntry.deduplicationFrame.appeared.length > 0 || result.logEntry.deduplicationFrame.isFirstFrame,
      'deduplication frame should show appeared stairs');
    assert(result.logEntry.hazardType === 'stairs', 'logEntry should record hazardType');
    assertEqual(result.logEntry.severity, 'high', 'logEntry should record severity');
  });

  await test('logger tracks decisions across frames', () => {
    const q = new AlertQualityEngine();
    q.process({ detections: makeDetections(['vehicle']), aiHazards: [makeHazard('vehicle', 'high', 0.8)], baseDecision: baseAlert });
    q.process({ detections: makeDetections(['vehicle'], 0.81), aiHazards: [makeHazard('vehicle', 'high', 0.81)], baseDecision: baseAlert });
    q.process({ detections: makeDetections(['vehicle'], 0.82), aiHazards: [makeHazard('vehicle', 'high', 0.82)], baseDecision: baseAlert });
    const logs = q.getLogger().getRecentLogs();
    assert(logs.length >= 2, 'logger should have entries');
    const spokenCount = q.getLogger().getTotalSpoken();
    const silentCount = q.getLogger().getTotalSilent();
    assert(spokenCount >= 1, 'at least one spoken entry');
    assert(spokenCount + silentCount === 3, 'total should be 3');
  });

  // ── Priority ordering ────────────────────────────────────────────────────────
  console.log('\nAlertQualityEngine — priority ordering');

  await test('vehicle (high) prioritised over person (low) when both present', () => {
    const q = new AlertQualityEngine();
    q.process({ detections: [], baseDecision: noAlert }); // empty first frame
    const result = q.process({
      detections: [...makeDetections(['vehicle'], 0.85), ...makeDetections(['person'], 0.7)],
      aiHazards: [makeHazard('vehicle', 'high', 0.85), makeHazard('person', 'low', 0.7)],
      baseDecision: baseAlert,
    });
    assert(result.shouldSpeak, 'should speak');
    // Message should address vehicle (higher priority), not just "person nearby"
    const lower = result.message?.toLowerCase() ?? '';
    assert(lower.includes('vehicle') || lower.includes('slow') || lower.includes('stop'),
      `vehicle should dominate message, got: "${result.message}"`);
  });

  await test('stairs (medium) prioritised over sign (low)', () => {
    const q = new AlertQualityEngine();
    q.process({ detections: [], baseDecision: noAlert });
    const result = q.process({
      detections: [...makeDetections(['stairs'], 0.8), ...makeDetections(['sign'], 0.6)],
      aiHazards: [makeHazard('stairs', 'medium', 0.8), makeHazard('sign', 'low', 0.6)],
      baseDecision: baseAlert,
    });
    assert(result.shouldSpeak, 'should speak');
    const lower = result.message?.toLowerCase() ?? '';
    assert(lower.includes('stair') || lower.includes('railing') || lower.includes('slow'),
      `stairs should dominate, got: "${result.message}"`);
  });

  // ── CognitiveGuardianEngine — Sprint 5 integration ───────────────────────────
  console.log('\nCognitiveGuardianEngine — Sprint 5 integration');

  const guardian = new CognitiveGuardianEngine();

  await test('process with categories populates qualityDecision', () => {
    guardian.reset();
    const categories = makeCategories([{ label: 'vehicle', confidence: 0.85 }]);
    const decision = guardian.process(
      makeDetections(['vehicle']),
      baseAlert,
      [],
      categories,
      [makeHazard('vehicle', 'high', 0.85)]
    );
    assert(decision.qualityDecision !== undefined, 'qualityDecision should be populated');
    assert(typeof decision.qualityDecision!.shouldSpeak === 'boolean', 'shouldSpeak must be boolean');
    assert(typeof decision.qualityDecision!.riskLevel === 'string', 'riskLevel must be string');
  });

  await test('process without categories — qualityDecision is undefined', () => {
    guardian.reset();
    const decision = guardian.process(makeDetections(['vehicle']), baseAlert, []);
    assert(decision.qualityDecision === undefined, 'no categories → no qualityDecision');
  });

  await test('process with categories — message comes from GuardianWordingEngine', () => {
    guardian.reset();
    guardian.process(makeDetections([]), noAlert, [], makeCategories()); // empty frame
    const categories = makeCategories([{ label: 'vehicle', confidence: 0.85 }]);
    const decision = guardian.process(
      makeDetections(['vehicle']),
      baseAlert,
      [],
      categories,
      [makeHazard('vehicle', 'high', 0.85)]
    );
    if (decision.qualityDecision?.shouldSpeak) {
      assert(decision.message !== null, 'should have a message');
      assert(!decision.message!.toLowerCase().includes('hazard detected'), 'no generic wording');
    }
  });

  await test('reset clears quality engine state', () => {
    guardian.reset();
    guardian.process(makeDetections(['vehicle']), baseAlert, [], makeCategories([{ label: 'vehicle', confidence: 0.9 }]));
    guardian.reset();
    assertEqual(guardian.getFrameCount(), 0, 'frameCount should be 0 after reset');
    assert(guardian.getQualityEngine().getLogger().getTotalSpoken() === 0, 'logger should clear on reset');
  });

  await test('reasoning string includes quality trigger when categories provided', () => {
    guardian.reset();
    guardian.process(makeDetections([]), noAlert, [], makeCategories()); // empty frame
    const decision = guardian.process(
      makeDetections(['stairs']),
      baseAlert,
      [],
      makeCategories([], [], [{ label: 'stairs', confidence: 0.8 }]),
      [makeHazard('stairs', 'high', 0.8)]
    );
    assert(decision.reasoning.includes('Quality'), `reasoning should include Quality prefix, got: "${decision.reasoning}"`);
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

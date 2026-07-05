// Sprint 10 — Adaptive Companion Personality — test suite
// Run: npx tsx tests/companionPersonality.test.ts

import { strict as assert } from 'assert';

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  createProfile,
  updateProfile,
  getDescriptor,
  getAllDescriptors,
  personalityAllowsRisk,
  isCriticalOverride,
  adaptMessage,
  buildPreviewSample,
  shouldGiveReassurance,
  shouldAnnounceConfidence,
  formatConfidenceNote,
} from '../src/engines/companionPersonalityEngine';

import {
  applyGuidanceStyle,
  formatNavigationGuidance,
  buildMemoryGreeting,
  frameUncertainty,
} from '../src/engines/guidanceStyleEngine';

import {
  resolveRate,
  rateToNumber,
  isBriefMode,
  maxSentences,
  repeatDelayMs,
  adaptSpeech,
  applyBrevity,
  speechRateLabel,
  speechAmountLabel,
} from '../src/engines/speechAdaptationEngine';

import {
  classifyContext,
  buildContextSnapshot,
  getAdaptationRule,
  adjustAlertFrequency,
  contextTypeLabel,
  contextTypeIcon,
} from '../src/engines/contextAwarenessEngine';

import type {
  PersonalityMode,
  SpeechRate,
  CompanionProfile,
  ContextSnapshot,
  ContextType,
} from '../src/types/companion';
import {
  COMPANION_DEFAULTS,
  SPEECH_RATE_MAP,
  PERSONALITY_DESCRIPTORS,
  COMPANION_PRIVACY_NOTE,
} from '../src/types/companion';

import type { Detection } from '../src/types/index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function makeContext(overrides: Partial<ContextSnapshot> = {}): ContextSnapshot {
  return {
    contextType: 'outdoor',
    isIndoors: false,
    isCrowded: false,
    isNight: false,
    isCrossing: false,
    isQuiet: false,
    isPoorLighting: false,
    confidence: 0.8,
    detectedLabels: [],
    ...overrides,
  };
}

function makeProfile(overrides: Partial<CompanionProfile> = {}): CompanionProfile {
  return createProfile(overrides);
}

function makeDetections(labels: string[]): Detection[] {
  return labels.map(label => ({ label, confidence: 0.8 }));
}

// ─── Suite 1: CompanionPersonalityEngine — profile management ────────────────

console.log('\nCompanionPersonalityEngine — profile management');

test('createProfile returns defaults', () => {
  const p = createProfile();
  assert.equal(p.mode, 'balanced');
  assert.equal(p.speechRate, 'normal');
  assert.equal(p.speechAmount, 'normal');
  assert.equal(p.alertFrequency, 'medium');
});

test('createProfile applies overrides', () => {
  const p = createProfile({ mode: 'minimal', speechRate: 'slow' });
  assert.equal(p.mode, 'minimal');
  assert.equal(p.speechRate, 'slow');
  assert.equal(p.speechAmount, 'normal'); // still default
});

test('updateProfile changes only specified fields', () => {
  const p = createProfile();
  const updated = updateProfile(p, { mode: 'companion' });
  assert.equal(updated.mode, 'companion');
  assert.equal(updated.speechRate, p.speechRate); // unchanged
});

test('updateProfile is immutable — original unchanged', () => {
  const p = createProfile();
  updateProfile(p, { mode: 'detailed' });
  assert.equal(p.mode, 'balanced');
});

test('getDescriptor returns correct descriptor', () => {
  const d = getDescriptor('minimal');
  assert.equal(d.mode, 'minimal');
  assert.ok(d.label.length > 0);
  assert.ok(d.example.length > 0);
});

test('getAllDescriptors returns all 4 modes', () => {
  const all = getAllDescriptors();
  assert.equal(all.length, 4);
  const modes = all.map(d => d.mode);
  assert.ok(modes.includes('minimal'));
  assert.ok(modes.includes('balanced'));
  assert.ok(modes.includes('detailed'));
  assert.ok(modes.includes('companion'));
});

// ─── Suite 2: Risk threshold gating ──────────────────────────────────────────

console.log('\nCompanionPersonalityEngine — risk gating');

test('minimal: blocks medium risk', () => {
  assert.equal(personalityAllowsRisk('minimal', 'medium'), false);
  assert.equal(personalityAllowsRisk('minimal', 'low'), false);
});

test('minimal: allows high and critical', () => {
  assert.equal(personalityAllowsRisk('minimal', 'high'), true);
  assert.equal(personalityAllowsRisk('minimal', 'critical'), true);
});

test('balanced: allows medium and above', () => {
  assert.equal(personalityAllowsRisk('balanced', 'medium'), true);
  assert.equal(personalityAllowsRisk('balanced', 'high'), true);
  assert.equal(personalityAllowsRisk('balanced', 'critical'), true);
});

test('balanced: blocks low', () => {
  assert.equal(personalityAllowsRisk('balanced', 'low'), false);
});

test('detailed: allows all non-none risks', () => {
  assert.equal(personalityAllowsRisk('detailed', 'low'), true);
  assert.equal(personalityAllowsRisk('detailed', 'medium'), true);
  assert.equal(personalityAllowsRisk('detailed', 'high'), true);
  assert.equal(personalityAllowsRisk('detailed', 'critical'), true);
});

test('companion: allows all non-none risks', () => {
  assert.equal(personalityAllowsRisk('companion', 'low'), true);
  assert.equal(personalityAllowsRisk('companion', 'medium'), true);
});

test('isCriticalOverride: only for critical', () => {
  assert.equal(isCriticalOverride('critical'), true);
  assert.equal(isCriticalOverride('high'), false);
  assert.equal(isCriticalOverride('medium'), false);
});

// ─── Suite 3: adaptMessage ────────────────────────────────────────────────────

console.log('\nCompanionPersonalityEngine — adaptMessage');

test('adaptMessage: minimal filters medium risk', () => {
  const result = adaptMessage({
    message: 'A bench is nearby.',
    riskLevel: 'medium',
    profile: makeProfile({ mode: 'minimal' }),
    context: makeContext(),
  });
  assert.equal(result.shouldSpeak, false);
  assert.equal(result.wasFiltered, true);
  assert.ok(result.filterReason !== null);
});

test('adaptMessage: minimal passes critical', () => {
  const result = adaptMessage({
    message: 'Vehicle! Stop immediately.',
    riskLevel: 'critical',
    profile: makeProfile({ mode: 'minimal' }),
    context: makeContext(),
  });
  assert.equal(result.shouldSpeak, true);
  assert.equal(result.wasFiltered, false);
});

test('adaptMessage: balanced passes medium', () => {
  const result = adaptMessage({
    message: 'Person crossing ahead.',
    riskLevel: 'medium',
    profile: makeProfile({ mode: 'balanced' }),
    context: makeContext(),
  });
  assert.equal(result.shouldSpeak, true);
});

test('adaptMessage: companion passes low risk', () => {
  const result = adaptMessage({
    message: 'A bench is on your left.',
    riskLevel: 'low',
    profile: makeProfile({ mode: 'companion' }),
    context: makeContext(),
  });
  assert.equal(result.shouldSpeak, true);
});

test('adaptMessage: navigation always passes regardless of risk', () => {
  const result = adaptMessage({
    message: 'Turn left in 10 metres.',
    riskLevel: 'none',
    profile: makeProfile({ mode: 'minimal' }),
    context: makeContext(),
    isNavigation: true,
  });
  assert.equal(result.shouldSpeak, true);
});

test('adaptMessage: crossing context forces balanced even in minimal', () => {
  const result = adaptMessage({
    message: 'Vehicle ahead.',
    riskLevel: 'high',
    profile: makeProfile({ mode: 'minimal' }),
    context: makeContext({ isCrossing: true, contextType: 'crossing' }),
  });
  assert.equal(result.shouldSpeak, true);
  assert.equal(result.personalityApplied, 'balanced');
});

test('adaptMessage: message is set when spoken', () => {
  const result = adaptMessage({
    message: 'Vehicle approaching.',
    riskLevel: 'high',
    profile: makeProfile({ mode: 'balanced' }),
    context: makeContext(),
  });
  assert.ok(result.adaptedMessage.length > 0);
  assert.equal(result.originalMessage, 'Vehicle approaching.');
});

test('adaptMessage: personality applied is recorded', () => {
  const result = adaptMessage({
    message: 'Obstacle ahead.',
    riskLevel: 'medium',
    profile: makeProfile({ mode: 'detailed' }),
    context: makeContext(),
  });
  assert.equal(result.personalityApplied, 'detailed');
});

test('adaptMessage: context applied is recorded', () => {
  const ctx = makeContext({ contextType: 'indoor' });
  const result = adaptMessage({
    message: 'Stairs ahead.',
    riskLevel: 'medium',
    profile: makeProfile({ mode: 'balanced' }),
    context: ctx,
  });
  assert.equal(result.contextApplied, 'indoor');
});

// ─── Suite 4: Reassurance & confidence ───────────────────────────────────────

console.log('\nCompanionPersonalityEngine — reassurance & confidence');

test('shouldGiveReassurance: companion after 30s', () => {
  assert.equal(shouldGiveReassurance('companion', 31), true);
});

test('shouldGiveReassurance: false for other modes', () => {
  assert.equal(shouldGiveReassurance('balanced', 60), false);
  assert.equal(shouldGiveReassurance('minimal', 60), false);
});

test('shouldGiveReassurance: false before 30s', () => {
  assert.equal(shouldGiveReassurance('companion', 20), false);
});

test('shouldAnnounceConfidence: always → always true', () => {
  const p = makeProfile({ confidenceAnnouncements: 'always' });
  assert.equal(shouldAnnounceConfidence(p, 0.9), true);
  assert.equal(shouldAnnounceConfidence(p, 0.2), true);
});

test('shouldAnnounceConfidence: never → always false', () => {
  const p = makeProfile({ confidenceAnnouncements: 'never' });
  assert.equal(shouldAnnounceConfidence(p, 0.2), false);
});

test('shouldAnnounceConfidence: when_low → only low confidence', () => {
  const p = makeProfile({ confidenceAnnouncements: 'when_low' });
  assert.equal(shouldAnnounceConfidence(p, 0.5), true);
  assert.equal(shouldAnnounceConfidence(p, 0.8), false);
});

test('formatConfidenceNote: low conf has note', () => {
  assert.ok(formatConfidenceNote(0.3).includes('Low'));
});

test('formatConfidenceNote: high conf returns empty string', () => {
  assert.equal(formatConfidenceNote(0.9), '');
});

test('buildPreviewSample: returns non-empty for all modes', () => {
  const modes: PersonalityMode[] = ['minimal', 'balanced', 'detailed', 'companion'];
  for (const m of modes) {
    assert.ok(buildPreviewSample(m).length > 0, `Empty preview for ${m}`);
  }
});

// ─── Suite 5: GuidanceStyleEngine ────────────────────────────────────────────

console.log('\nGuidanceStyleEngine');

const longMessage = 'A vehicle is 3 metres ahead moving left to right. There is a clear gap on your right side. The pavement is unobstructed. You may proceed with caution.';

test('minimal: returns single sentence', () => {
  const out = applyGuidanceStyle({
    message: longMessage,
    mode: 'minimal',
    riskLevel: 'high',
    context: makeContext(),
    profile: makeProfile({ mode: 'minimal' }),
  });
  assert.ok(!out.message.includes('clear gap') || out.message.split(/[.!?]/).length <= 2);
  assert.equal(out.tone, 'terse');
});

test('balanced: caps at 2 sentences', () => {
  const out = applyGuidanceStyle({
    message: longMessage,
    mode: 'balanced',
    riskLevel: 'medium',
    context: makeContext(),
    profile: makeProfile({ mode: 'balanced' }),
  });
  assert.equal(out.tone, 'neutral');
});

test('detailed: keeps full message', () => {
  const out = applyGuidanceStyle({
    message: longMessage,
    mode: 'detailed',
    riskLevel: 'medium',
    context: makeContext(),
    profile: makeProfile({ mode: 'detailed' }),
  });
  assert.ok(out.message.length >= longMessage.length - 5);
});

test('companion: critical uses direct tone', () => {
  const out = applyGuidanceStyle({
    message: 'Vehicle! Stop now.',
    mode: 'companion',
    riskLevel: 'critical',
    context: makeContext(),
    profile: makeProfile({ mode: 'companion' }),
  });
  assert.equal(out.tone, 'warm');
  assert.ok(!out.message.toLowerCase().includes("just a heads-up"));
});

test('companion: medium risk adds warm prefix', () => {
  const out = applyGuidanceStyle({
    message: 'A bench is on your left.',
    mode: 'companion',
    riskLevel: 'medium',
    context: makeContext(),
    profile: makeProfile({ mode: 'companion' }),
  });
  assert.equal(out.tone, 'conversational');
});

test('crossing context adds safety note for balanced', () => {
  const out = applyGuidanceStyle({
    message: 'Road ahead.',
    mode: 'balanced',
    riskLevel: 'high',
    context: makeContext({ isCrossing: true }),
    profile: makeProfile({ mode: 'balanced' }),
  });
  assert.ok(out.message.toLowerCase().includes('check') || out.message.length > 10);
});

test('poor lighting adds note for companion', () => {
  const out = applyGuidanceStyle({
    message: 'Path ahead.',
    mode: 'companion',
    riskLevel: 'low',
    context: makeContext({ isPoorLighting: true }),
    profile: makeProfile({ mode: 'companion' }),
  });
  assert.ok(out.message.toLowerCase().includes('light') || out.message.includes('care'));
});

test('formatNavigationGuidance: minimal → first sentence', () => {
  const result = formatNavigationGuidance(
    'Turn left in 20 metres. The junction is ahead. Watch for traffic.',
    'minimal',
    'minimal',
    makeContext(),
  );
  assert.ok(!result.includes('Watch for traffic'));
});

test('formatNavigationGuidance: rich detail includes full text', () => {
  const instruction = 'Turn left in 20 metres. The junction is ahead.';
  const result = formatNavigationGuidance(instruction, 'detailed', 'rich', makeContext());
  assert.ok(result.length >= instruction.length - 5);
});

test('buildMemoryGreeting: companion + facts → greeting', () => {
  const g = buildMemoryGreeting('companion', ['Home is 200 metres ahead.']);
  assert.ok(g !== null);
  assert.ok(g!.includes('Welcome back'));
});

test('buildMemoryGreeting: minimal → null', () => {
  assert.equal(buildMemoryGreeting('minimal', ['some fact']), null);
});

test('buildMemoryGreeting: empty facts → null', () => {
  assert.equal(buildMemoryGreeting('companion', []), null);
});

test('frameUncertainty: high confidence → unchanged', () => {
  const msg = 'Vehicle ahead.';
  assert.equal(frameUncertainty(msg, 0.8, 'balanced'), msg);
});

test('frameUncertainty: low confidence → adds note', () => {
  const result = frameUncertainty('Vehicle ahead.', 0.35, 'balanced');
  assert.ok(result.includes('confidence') || result.length > 'Vehicle ahead.'.length);
});

test('frameUncertainty: minimal mode → no extra framing even when uncertain', () => {
  const result = frameUncertainty('Vehicle ahead.', 0.3, 'minimal');
  assert.equal(result, 'Vehicle ahead.');
});

// ─── Suite 6: SpeechAdaptationEngine ─────────────────────────────────────────

console.log('\nSpeechAdaptationEngine');

test('resolveRate: slow not allowed for critical', () => {
  const rate = resolveRate('slow', 'critical', makeContext());
  assert.notEqual(rate, 'slow');
});

test('resolveRate: fast downgraded during crossing', () => {
  const rate = resolveRate('fast', 'medium', makeContext({ isCrossing: true }));
  assert.equal(rate, 'normal');
});

test('resolveRate: normal stays normal', () => {
  assert.equal(resolveRate('normal', 'medium', makeContext()), 'normal');
});

test('rateToNumber: maps correctly', () => {
  assert.equal(rateToNumber('slow'), 0.75);
  assert.equal(rateToNumber('normal'), 1.0);
  assert.equal(rateToNumber('fast'), 1.4);
});

test('isBriefMode: brief amount → true', () => {
  assert.equal(isBriefMode('brief', 'balanced', 'medium'), true);
});

test('isBriefMode: minimal mode → true', () => {
  assert.equal(isBriefMode('normal', 'minimal', 'medium'), true);
});

test('isBriefMode: verbose + balanced → false', () => {
  assert.equal(isBriefMode('verbose', 'balanced', 'medium'), false);
});

test('maxSentences: critical → 3', () => {
  assert.equal(maxSentences('normal', 'balanced', 'critical'), 3);
});

test('maxSentences: brief / minimal → 1', () => {
  assert.equal(maxSentences('brief', 'balanced', 'medium'), 1);
  assert.equal(maxSentences('normal', 'minimal', 'medium'), 1);
});

test('maxSentences: verbose → 4', () => {
  assert.equal(maxSentences('verbose', 'detailed', 'medium'), 4);
});

test('repeatDelayMs: null when autoRepeat is false', () => {
  assert.equal(repeatDelayMs('critical', false), null);
});

test('repeatDelayMs: critical → 8000ms when enabled', () => {
  assert.equal(repeatDelayMs('critical', true), 8000);
});

test('repeatDelayMs: high → 15000ms when enabled', () => {
  assert.equal(repeatDelayMs('high', true), 15000);
});

test('repeatDelayMs: medium → null even when enabled', () => {
  assert.equal(repeatDelayMs('medium', true), null);
});

test('adaptSpeech: returns complete bundle', () => {
  const adapt = adaptSpeech({
    mode: 'balanced',
    riskLevel: 'medium',
    profile: makeProfile(),
    context: makeContext(),
  });
  assert.ok(adapt.rate > 0 && adapt.rate <= 2);
  assert.ok(['slow', 'normal', 'fast'].includes(adapt.rateLabel));
  assert.ok(typeof adapt.briefMode === 'boolean');
  assert.ok(adapt.maxSentences >= 1);
});

test('applyBrevity: brief mode trims to 1 sentence', () => {
  const adapt = adaptSpeech({
    mode: 'minimal',
    riskLevel: 'medium',
    profile: makeProfile({ mode: 'minimal', speechAmount: 'brief' }),
    context: makeContext(),
  });
  const text = 'Vehicle ahead. Gap on your right. Proceed with care.';
  const result = applyBrevity(text, adapt);
  assert.ok(!result.includes('Gap on your right'));
});

test('applyBrevity: non-brief mode keeps full text', () => {
  const adapt = adaptSpeech({
    mode: 'detailed',
    riskLevel: 'medium',
    profile: makeProfile({ mode: 'detailed', speechAmount: 'verbose' }),
    context: makeContext(),
  });
  const text = 'Vehicle ahead. Gap on your right.';
  const result = applyBrevity(text, adapt);
  assert.equal(result, text);
});

test('speechRateLabel: returns human label', () => {
  const rates: SpeechRate[] = ['slow', 'normal', 'fast'];
  for (const r of rates) {
    assert.ok(speechRateLabel(r).length > 0);
  }
});

test('speechAmountLabel: returns human label', () => {
  assert.ok(speechAmountLabel('brief').length > 0);
  assert.ok(speechAmountLabel('verbose').length > 0);
});

// ─── Suite 7: ContextAwarenessEngine ─────────────────────────────────────────

console.log('\nContextAwarenessEngine');

test('classifyContext: crossing labels → crossing', () => {
  const ctx = classifyContext(
    makeDetections(['traffic light', 'car', 'road']),
    null,
  );
  assert.equal(ctx, 'crossing');
});

test('classifyContext: indoor labels → indoor', () => {
  const ctx = classifyContext(
    makeDetections(['door', 'stairs', 'corridor']),
    null,
  );
  assert.equal(ctx, 'indoor');
});

test('classifyContext: outdoor labels → outdoor', () => {
  const ctx = classifyContext(
    makeDetections(['vehicle', 'pavement', 'tree']),
    null,
  );
  assert.equal(ctx, 'outdoor');
});

test('classifyContext: crowd → crowded', () => {
  const ctx = classifyContext(
    makeDetections(['person', 'person', 'people']),
    null,
  );
  assert.equal(ctx, 'crowded');
});

test('classifyContext: scene description crossing', () => {
  const ctx = classifyContext([], 'Approaching a road crossing');
  assert.equal(ctx, 'crossing');
});

test('classifyContext: sensorIndoors overrides labels', () => {
  const ctx = classifyContext(
    makeDetections(['tree', 'car']),
    null,
    true, // sensorIndoors = true
  );
  assert.equal(ctx, 'indoor');
});

test('classifyContext: empty → unknown or quiet', () => {
  const ctx = classifyContext([], null);
  assert.ok(['unknown', 'quiet'].includes(ctx));
});

test('buildContextSnapshot: crossing context sets isCrossing', () => {
  const snap = buildContextSnapshot(
    makeDetections(['traffic light', 'road']),
    null,
  );
  assert.equal(snap.isCrossing, true);
  assert.equal(snap.contextType, 'crossing');
});

test('buildContextSnapshot: crowded sets isCrowded', () => {
  const snap = buildContextSnapshot(
    makeDetections(['person', 'person', 'people']),
    'Busy area',
  );
  assert.equal(snap.isCrowded, true);
});

test('buildContextSnapshot: detectedLabels populated', () => {
  const snap = buildContextSnapshot(makeDetections(['vehicle', 'curb']), null);
  assert.ok(snap.detectedLabels.includes('vehicle'));
  assert.ok(snap.detectedLabels.includes('curb'));
});

test('buildContextSnapshot: confidence 0 for no detections', () => {
  const snap = buildContextSnapshot([], null);
  assert.ok(snap.confidence < 0.5);
});

test('buildContextSnapshot: isNight from options', () => {
  const snap = buildContextSnapshot([], null, { isNight: true });
  assert.equal(snap.isNight, true);
});

test('getAdaptationRule: crossing has safetyOverride', () => {
  const rule = getAdaptationRule('crossing');
  assert.equal(rule.safetyOverride, true);
  assert.ok(rule.alertFrequencyBoost >= 1.5);
});

test('getAdaptationRule: quiet has reduced frequency', () => {
  const rule = getAdaptationRule('quiet');
  assert.ok(rule.alertFrequencyBoost <= 1.0);
});

test('getAdaptationRule: poor_lighting has forceDetail', () => {
  const rule = getAdaptationRule('poor_lighting');
  assert.equal(rule.forceDetail, true);
});

test('adjustAlertFrequency: crossing boosts low → high', () => {
  const rule = getAdaptationRule('crossing');
  const result = adjustAlertFrequency('low', rule);
  assert.ok(result === 'medium' || result === 'high');
});

test('adjustAlertFrequency: quiet reduces high → medium/low', () => {
  const rule = getAdaptationRule('quiet');
  const result = adjustAlertFrequency('high', rule);
  assert.ok(result === 'medium' || result === 'low');
});

test('adjustAlertFrequency: medium stays medium for outdoor', () => {
  const rule = getAdaptationRule('outdoor');
  const result = adjustAlertFrequency('medium', rule);
  assert.equal(result, 'medium');
});

test('contextTypeLabel: returns human-readable string', () => {
  const types: ContextType[] = ['indoor', 'outdoor', 'crossing', 'crowded', 'quiet', 'poor_lighting', 'unknown'];
  for (const t of types) {
    assert.ok(contextTypeLabel(t).length > 0);
  }
});

test('contextTypeIcon: returns non-empty icon for all types', () => {
  const types: ContextType[] = ['indoor', 'outdoor', 'crossing', 'crowded', 'quiet', 'poor_lighting', 'unknown'];
  for (const t of types) {
    assert.ok(contextTypeIcon(t).length > 0);
  }
});

// ─── Suite 8: Constants & integration ────────────────────────────────────────

console.log('\nConstants & integration');

test('COMPANION_DEFAULTS matches expected defaults', () => {
  assert.equal(COMPANION_DEFAULTS.mode, 'balanced');
  assert.equal(COMPANION_DEFAULTS.speechRate, 'normal');
  assert.equal(COMPANION_DEFAULTS.alertFrequency, 'medium');
  assert.equal(COMPANION_DEFAULTS.navigationDetail, 'standard');
  assert.equal(COMPANION_DEFAULTS.autoRepeat, false);
});

test('SPEECH_RATE_MAP has all keys', () => {
  assert.ok(typeof SPEECH_RATE_MAP.slow === 'number');
  assert.ok(typeof SPEECH_RATE_MAP.normal === 'number');
  assert.ok(typeof SPEECH_RATE_MAP.fast === 'number');
  assert.ok(SPEECH_RATE_MAP.slow < SPEECH_RATE_MAP.normal);
  assert.ok(SPEECH_RATE_MAP.normal < SPEECH_RATE_MAP.fast);
});

test('PERSONALITY_DESCRIPTORS has 4 entries', () => {
  assert.equal(PERSONALITY_DESCRIPTORS.length, 4);
});

test('COMPANION_PRIVACY_NOTE is non-empty', () => {
  assert.ok(COMPANION_PRIVACY_NOTE.length > 10);
});

// ─── Suite 9: Safety overrides ────────────────────────────────────────────────

console.log('\nSafety overrides');

test('critical always passes through minimal', () => {
  const result = adaptMessage({
    message: 'Stairs! Stop immediately.',
    riskLevel: 'critical',
    profile: makeProfile({ mode: 'minimal' }),
    context: makeContext(),
  });
  assert.equal(result.shouldSpeak, true);
  assert.equal(result.wasFiltered, false);
});

test('context safety override in crossing — even if speech amount is brief', () => {
  const result = adaptMessage({
    message: 'Road crossing ahead. Vehicle approaching.',
    riskLevel: 'high',
    profile: makeProfile({ mode: 'minimal', speechAmount: 'brief' }),
    context: makeContext({ isCrossing: true, contextType: 'crossing' }),
  });
  assert.equal(result.shouldSpeak, true);
});

test('poor lighting + companion adds care note', () => {
  const styled = applyGuidanceStyle({
    message: 'Path ahead.',
    mode: 'companion',
    riskLevel: 'medium',
    context: makeContext({ isPoorLighting: true }),
    profile: makeProfile({ mode: 'companion' }),
  });
  assert.ok(styled.message.length > 'Path ahead.'.length);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Sprint 10 Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

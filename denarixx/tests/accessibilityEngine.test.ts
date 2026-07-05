// Sprint 11 — Accessibility & Personal Preferences Tests
// Run: cd denarixx && npx tsx tests/accessibilityEngine.test.ts

import {
  ACCESSIBILITY_PRESETS,
  getPreset,
  getAllPresets,
  applyPreset,
  deriveAccessibilityClasses,
  buildAriaLabel,
  buildSrOnlyAlert,
  getAlertColor,
  accessibilityModeLabel,
  displayRequiresHighContrast,
  displayRequiresLargeText,
} from '../src/engines/accessibilityEngine';
import {
  createDefaultPreferences,
  clonePreferences,
  updateAudio,
  updateHaptic,
  updateNavigation,
  updateAlert,
  updateDisplay,
  updatePersonality,
  updateAccessibilityMode,
  mergeWithDefaults,
  validatePreferences,
  toAppSettings,
  buildChangeEvent,
  diffPreferences,
} from '../src/engines/userPreferenceEngine';
import {
  clampSpeechRate,
  speechRateToBucketLabel,
  bucketLabelToRate,
  clampVolume,
  volumePercent,
  volumeLabel,
  shouldSpeakForRisk,
  verbosityToSentenceCount,
  repeatDelayForRisk,
  isSilenced,
  shouldAnnounceConfidence,
  confidenceNote,
  getEarconId,
  buildAudioSummary,
  mergeAudioDefaults,
} from '../src/engines/audioPreferenceEngine';
import {
  intensityMultiplier,
  intensityLabel,
  getAllPatterns,
  getPatternForRisk,
  scalePattern,
  shouldVibrate,
  buildVibrationCommand,
  buildHapticSummary,
  mergeHapticDefaults,
} from '../src/engines/hapticPreferenceEngine';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_AUDIO,
  DEFAULT_HAPTIC,
  PREFERENCES_VERSION,
} from '../src/types/preferences';

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`  ✗ ${name}\n    → ${msg}`);
    process.stdout.write(`  ✗ ${name}\n    → ${msg}\n`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe: (expected: T) => {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual: (expected: T) => {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
    },
    toBeGreaterThan: (n: number) => {
      if ((actual as number) <= n) throw new Error(`Expected ${actual} > ${n}`);
    },
    toBeLessThanOrEqual: (n: number) => {
      if ((actual as number) > n) throw new Error(`Expected ${actual} <= ${n}`);
    },
    toBeGreaterThanOrEqual: (n: number) => {
      if ((actual as number) < n) throw new Error(`Expected ${actual} >= ${n}`);
    },
    toContain: (sub: string) => {
      if (!(actual as string).includes(sub)) throw new Error(`Expected "${actual}" to contain "${sub}"`);
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`Expected truthy, got ${actual}`);
    },
    toBeFalsy: () => {
      if (actual) throw new Error(`Expected falsy, got ${actual}`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected null, got ${actual}`);
    },
    toHaveLength: (n: number) => {
      if ((actual as unknown[]).length !== n) throw new Error(`Expected length ${n}, got ${(actual as unknown[]).length}`);
    },
  };
}

function section(name: string) {
  process.stdout.write(`\n${name}\n`);
}

// ─── Section 1: Preset registry and lookup ────────────────────────────────────

section('Section 1: Preset registry and lookup');

test('ACCESSIBILITY_PRESETS has 5 presets', () => {
  expect(ACCESSIBILITY_PRESETS).toHaveLength(5);
});

test('getAllPresets returns a copy with 5 items', () => {
  const all = getAllPresets();
  expect(all).toHaveLength(5);
});

test('getPreset("standard") returns standard preset', () => {
  const p = getPreset('standard');
  expect(p.id).toBe('standard');
  expect(p.name).toBe('Standard');
});

test('getPreset("blind") returns blind preset with icon', () => {
  const p = getPreset('blind');
  expect(p.id).toBe('blind');
  expect(p.icon).toBe('🔊');
});

test('getPreset("hearing_impaired") has correct description', () => {
  const p = getPreset('hearing_impaired');
  expect(p.description).toContain('haptic');
});

test('getPreset for unknown mode falls back to standard', () => {
  const p = getPreset('unknown_mode' as any);
  expect(p.id).toBe('standard');
});

// ─── Section 2: Apply preset ──────────────────────────────────────────────────

section('Section 2: Apply preset');

test('applyPreset("standard") returns unchanged accessibility mode', () => {
  const base = createDefaultPreferences();
  const result = applyPreset(base, 'standard');
  expect(result.accessibilityMode).toBe('standard');
});

test('applyPreset("blind") sets verbose verbosity', () => {
  const base = createDefaultPreferences();
  const result = applyPreset(base, 'blind');
  expect(result.audio.guidanceVerbosity).toBe('verbose');
});

test('applyPreset("blind") enables earcons', () => {
  const base = createDefaultPreferences();
  const result = applyPreset(base, 'blind');
  expect(result.audio.earconAlerts).toBe(true);
});

test('applyPreset("blind") sets navigationDetail to rich', () => {
  const base = createDefaultPreferences();
  const result = applyPreset(base, 'blind');
  expect(result.navigation.navigationDetail).toBe('rich');
});

test('applyPreset("blind") enables screen reader', () => {
  const base = createDefaultPreferences();
  const result = applyPreset(base, 'blind');
  expect(result.display.screenReaderOptimised).toBe(true);
});

test('applyPreset("blind") sets strong vibration', () => {
  const base = createDefaultPreferences();
  const result = applyPreset(base, 'blind');
  expect(result.haptic.vibrationIntensity).toBe('strong');
});

test('applyPreset("low_vision") enables high contrast', () => {
  const base = createDefaultPreferences();
  const result = applyPreset(base, 'low_vision');
  expect(result.display.highContrastMode).toBe(true);
});

test('applyPreset("low_vision") sets large text', () => {
  const base = createDefaultPreferences();
  const result = applyPreset(base, 'low_vision');
  expect(result.display.textSize).toBe('large');
});

test('applyPreset("hearing_impaired") mutes speech volume', () => {
  const base = createDefaultPreferences();
  const result = applyPreset(base, 'hearing_impaired');
  expect(result.audio.speechVolume).toBe(0.0);
});

test('applyPreset("hearing_impaired") sets strong vibration', () => {
  const base = createDefaultPreferences();
  const result = applyPreset(base, 'hearing_impaired');
  expect(result.haptic.vibrationIntensity).toBe('strong');
});

test('applyPreset does not mutate base', () => {
  const base = createDefaultPreferences();
  applyPreset(base, 'blind');
  expect(base.accessibilityMode).toBe('standard');
});

// ─── Section 3: CSS class derivation ─────────────────────────────────────────

section('Section 3: CSS class derivation');

test('standard mode produces no special classes', () => {
  const prefs = createDefaultPreferences();
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.htmlClasses).toHaveLength(0);
});

test('high contrast mode adds high-contrast-mode class', () => {
  const prefs = updateDisplay(createDefaultPreferences(), { highContrastMode: true });
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.htmlClasses).toContain('high-contrast-mode');
});

test('hearing_impaired mode adds high-contrast-mode class', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'hearing_impaired');
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.htmlClasses).toContain('high-contrast-mode');
});

test('reducedMotion adds reduced-motion class', () => {
  const prefs = updateDisplay(createDefaultPreferences(), { reducedMotion: true });
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.htmlClasses).toContain('reduced-motion');
});

test('large text adds text-size-large class', () => {
  const prefs = updateDisplay(createDefaultPreferences(), { textSize: 'large' });
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.htmlClasses).toContain('text-size-large');
});

test('extra_large text adds text-size-xl class', () => {
  const prefs = updateDisplay(createDefaultPreferences(), { textSize: 'extra_large' });
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.htmlClasses).toContain('text-size-xl');
});

test('colorBlindFriendly adds color-blind-friendly class', () => {
  const prefs = updateDisplay(createDefaultPreferences(), { colorBlindFriendly: true });
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.htmlClasses).toContain('color-blind-friendly');
});

test('blind mode adds screen-reader-mode class', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'blind');
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.htmlClasses).toContain('screen-reader-mode');
});

test('blind mode sets ariaLive to assertive', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'blind');
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.ariaLive).toBe('assertive');
});

test('hearing_impaired mode sets ariaLive to off', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'hearing_impaired');
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.ariaLive).toBe('off');
});

test('standard mode sets ariaLive to polite', () => {
  const prefs = createDefaultPreferences();
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.ariaLive).toBe('polite');
});

test('one_hand mode sets larger buttonSizeClass', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'one_hand');
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.buttonSizeClass).toBe('min-h-14');
});

// ─── Section 4: ARIA helpers ──────────────────────────────────────────────────

section('Section 4: ARIA helpers');

test('buildAriaLabel without risk returns simple label', () => {
  const label = buildAriaLabel('Detected', 'step ahead');
  expect(label).toBe('Detected: step ahead');
});

test('buildAriaLabel with critical risk prepends Critical alert', () => {
  const label = buildAriaLabel('Hazard', 'car approaching', 'critical');
  expect(label).toContain('Critical alert');
});

test('buildAriaLabel with high risk prepends High priority', () => {
  const label = buildAriaLabel('Hazard', 'bicycle', 'high');
  expect(label).toContain('High priority');
});

test('buildAriaLabel with low risk prepends Information', () => {
  const label = buildAriaLabel('Scene', 'open space', 'low');
  expect(label).toContain('Information');
});

test('buildSrOnlyAlert in blind mode returns message unchanged', () => {
  const msg = buildSrOnlyAlert('Step detected', 'blind');
  expect(msg).toBe('Step detected');
});

test('buildSrOnlyAlert in hearing_impaired mode prefixes [Visual alert]', () => {
  const msg = buildSrOnlyAlert('Step detected', 'hearing_impaired');
  expect(msg).toContain('[Visual alert]');
});

test('accessibilityModeLabel returns human-readable name', () => {
  expect(accessibilityModeLabel('blind')).toBe('Blind / No Vision');
  expect(accessibilityModeLabel('low_vision')).toBe('Low Vision');
  expect(accessibilityModeLabel('hearing_impaired')).toBe('Hearing Impaired');
  expect(accessibilityModeLabel('one_hand')).toBe('One-Hand Operation');
  expect(accessibilityModeLabel('standard')).toBe('Standard');
});

test('getAlertColor returns standard colours by default', () => {
  const color = getAlertColor('danger', false);
  expect(color).toBe('#ef4444');
});

test('getAlertColor returns colour-blind palette when enabled', () => {
  const color = getAlertColor('danger', true);
  expect(color).toBe('#d55e00');
});

test('displayRequiresHighContrast true when highContrastMode', () => {
  const prefs = createDefaultPreferences();
  expect(displayRequiresHighContrast({ ...prefs.display, highContrastMode: true })).toBe(true);
});

test('displayRequiresLargeText true when textSize is large', () => {
  const prefs = createDefaultPreferences();
  expect(displayRequiresLargeText({ ...prefs.display, textSize: 'large' })).toBe(true);
});

// ─── Section 5: User preference engine ───────────────────────────────────────

section('Section 5: User preference engine');

test('createDefaultPreferences returns version 1', () => {
  const p = createDefaultPreferences();
  expect(p.version).toBe(PREFERENCES_VERSION);
});

test('createDefaultPreferences has standard mode', () => {
  const p = createDefaultPreferences();
  expect(p.accessibilityMode).toBe('standard');
});

test('clonePreferences creates a new object', () => {
  const a = createDefaultPreferences();
  const b = clonePreferences(a);
  expect(a === b).toBe(false);
});

test('clonePreferences audio object is independent', () => {
  const a = createDefaultPreferences();
  const b = clonePreferences(a);
  expect(a.audio === b.audio).toBe(false);
});

test('updateAudio returns new preferences without mutation', () => {
  const a = createDefaultPreferences();
  const b = updateAudio(a, { speechRate: 1.5 });
  expect(b.audio.speechRate).toBe(1.5);
  expect(a.audio.speechRate).toBe(DEFAULT_AUDIO.speechRate);
});

test('updateHaptic returns new preferences without mutation', () => {
  const a = createDefaultPreferences();
  const b = updateHaptic(a, { vibrationIntensity: 'strong' });
  expect(b.haptic.vibrationIntensity).toBe('strong');
  expect(a.haptic.vibrationIntensity).toBe(DEFAULT_HAPTIC.vibrationIntensity);
});

test('updateNavigation returns updated navigation', () => {
  const a = createDefaultPreferences();
  const b = updateNavigation(a, { navigationDetail: 'rich' });
  expect(b.navigation.navigationDetail).toBe('rich');
});

test('updateAlert returns updated alert prefs', () => {
  const a = createDefaultPreferences();
  const b = updateAlert(a, { alertFrequency: 'high' });
  expect(b.alert.alertFrequency).toBe('high');
});

test('updateDisplay returns updated display prefs', () => {
  const a = createDefaultPreferences();
  const b = updateDisplay(a, { textSize: 'extra_large' });
  expect(b.display.textSize).toBe('extra_large');
});

test('updatePersonality changes personalityMode', () => {
  const a = createDefaultPreferences();
  const b = updatePersonality(a, 'companion');
  expect(b.personalityMode).toBe('companion');
});

test('updateAccessibilityMode changes mode only', () => {
  const a = createDefaultPreferences();
  const b = updateAccessibilityMode(a, 'low_vision');
  expect(b.accessibilityMode).toBe('low_vision');
  expect(b.audio.speechRate).toBe(a.audio.speechRate);
});

test('mergeWithDefaults fills missing keys from defaults', () => {
  const partial = { version: 1, accessibilityMode: 'blind' } as any;
  const merged = mergeWithDefaults(partial);
  expect(merged.audio.speechRate).toBe(DEFAULT_AUDIO.speechRate);
});

test('validatePreferences: out-of-range speechRate is invalid', () => {
  const p = updateAudio(createDefaultPreferences(), { speechRate: 3.0 });
  const result = validatePreferences(p);
  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
});

test('validatePreferences: valid default prefs pass', () => {
  const p = createDefaultPreferences();
  const result = validatePreferences(p);
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('validatePreferences: hearing impaired + vibration off generates warning', () => {
  const p = applyPreset(createDefaultPreferences(), 'hearing_impaired');
  const p2 = updateHaptic(p, { vibrationIntensity: 'off' });
  const result = validatePreferences(p2);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('validatePreferences: blind + volume 0 generates warning', () => {
  const p = applyPreset(createDefaultPreferences(), 'blind');
  const p2 = updateAudio(p, { speechVolume: 0 });
  const result = validatePreferences(p2);
  expect(result.warnings.length).toBeGreaterThan(0);
});

test('toAppSettings maps speechRate', () => {
  const p = updateAudio(createDefaultPreferences(), { speechRate: 1.5 });
  const settings = toAppSettings(p);
  expect(settings.speechRate).toBe(1.5);
});

test('toAppSettings maps verbose to full alertVerbosity', () => {
  const p = updateAudio(createDefaultPreferences(), { guidanceVerbosity: 'verbose' });
  const settings = toAppSettings(p);
  expect(settings.alertVerbosity).toBe('full');
});

test('toAppSettings maps brief to minimal alertVerbosity', () => {
  const p = updateAudio(createDefaultPreferences(), { guidanceVerbosity: 'brief' });
  const settings = toAppSettings(p);
  expect(settings.alertVerbosity).toBe('minimal');
});

test('buildChangeEvent creates correct event', () => {
  const ev = buildChangeEvent('audio', 'speechRate', 1.0, 1.5);
  expect(ev.group).toBe('audio');
  expect(ev.key).toBe('speechRate');
  expect(ev.oldValue).toBe(1.0);
  expect(ev.newValue).toBe(1.5);
});

test('diffPreferences detects audio change', () => {
  const a = createDefaultPreferences();
  const b = updateAudio(a, { speechRate: 1.5 });
  const diffs = diffPreferences(a, b);
  const rateChange = diffs.find(d => d.key === 'speechRate');
  expect(rateChange?.newValue).toBe(1.5);
});

test('diffPreferences detects personality change', () => {
  const a = createDefaultPreferences();
  const b = updatePersonality(a, 'companion');
  const diffs = diffPreferences(a, b);
  const change = diffs.find(d => d.key === 'personalityMode');
  expect(change?.newValue).toBe('companion');
});

test('diffPreferences returns empty array for identical prefs', () => {
  const a = createDefaultPreferences();
  const b = clonePreferences(a);
  const diffs = diffPreferences(a, b);
  expect(diffs).toHaveLength(0);
});

// ─── Section 6: Audio preference engine ──────────────────────────────────────

section('Section 6: Audio preference engine');

test('clampSpeechRate clamps below 0.5', () => {
  expect(clampSpeechRate(0.1)).toBe(0.5);
});

test('clampSpeechRate clamps above 2.0', () => {
  expect(clampSpeechRate(3.0)).toBe(2.0);
});

test('clampSpeechRate keeps valid value unchanged', () => {
  expect(clampSpeechRate(1.2)).toBe(1.2);
});

test('speechRateToBucketLabel: 0.75 → slow', () => {
  expect(speechRateToBucketLabel(0.75)).toBe('slow');
});

test('speechRateToBucketLabel: 1.0 → normal', () => {
  expect(speechRateToBucketLabel(1.0)).toBe('normal');
});

test('speechRateToBucketLabel: 1.5 → fast', () => {
  expect(speechRateToBucketLabel(1.5)).toBe('fast');
});

test('bucketLabelToRate("slow") returns 0.75', () => {
  expect(bucketLabelToRate('slow')).toBe(0.75);
});

test('bucketLabelToRate("fast") returns 1.4', () => {
  expect(bucketLabelToRate('fast')).toBe(1.4);
});

test('clampVolume clamps below 0', () => {
  expect(clampVolume(-0.5)).toBe(0);
});

test('clampVolume clamps above 1', () => {
  expect(clampVolume(1.5)).toBe(1);
});

test('volumePercent(0.5) returns 50', () => {
  expect(volumePercent(0.5)).toBe(50);
});

test('volumeLabel(0) returns Muted', () => {
  expect(volumeLabel(0)).toBe('Muted');
});

test('volumeLabel(1.0) returns Loud', () => {
  expect(volumeLabel(1.0)).toBe('Loud');
});

test('shouldSpeakForRisk: always silence mode → false', () => {
  const audio = { ...DEFAULT_AUDIO, automaticSilence: 'always' as const };
  expect(shouldSpeakForRisk('critical', audio, 'standard')).toBe(false);
});

test('shouldSpeakForRisk: hearing_impaired + volume 0 → false', () => {
  const audio = { ...DEFAULT_AUDIO, speechVolume: 0 };
  expect(shouldSpeakForRisk('critical', audio, 'hearing_impaired')).toBe(false);
});

test('shouldSpeakForRisk: standard mode → true', () => {
  expect(shouldSpeakForRisk('critical', DEFAULT_AUDIO, 'standard')).toBe(true);
});

test('verbosityToSentenceCount: brief + medium → 1', () => {
  expect(verbosityToSentenceCount('brief', 'medium')).toBe(1);
});

test('verbosityToSentenceCount: verbose + medium → 4', () => {
  expect(verbosityToSentenceCount('verbose', 'medium')).toBe(4);
});

test('verbosityToSentenceCount: critical always → 3', () => {
  expect(verbosityToSentenceCount('brief', 'critical')).toBe(3);
});

test('repeatDelayForRisk: never → null', () => {
  expect(repeatDelayForRisk('never', 'critical')).toBeNull();
});

test('repeatDelayForRisk: critical_only + medium → null', () => {
  expect(repeatDelayForRisk('critical_only', 'medium')).toBeNull();
});

test('repeatDelayForRisk: critical_only + critical → 8000ms', () => {
  expect(repeatDelayForRisk('critical_only', 'critical')).toBe(8_000);
});

test('isSilenced: always → true', () => {
  expect(isSilenced('always')).toBe(true);
});

test('isSilenced: never → false', () => {
  expect(isSilenced('never')).toBe(false);
});

test('shouldAnnounceConfidence: always → true at any confidence', () => {
  expect(shouldAnnounceConfidence('always', 0.9)).toBe(true);
});

test('shouldAnnounceConfidence: when_low + low conf → true', () => {
  expect(shouldAnnounceConfidence('when_low', 0.3)).toBe(true);
});

test('shouldAnnounceConfidence: when_low + high conf → false', () => {
  expect(shouldAnnounceConfidence('when_low', 0.9)).toBe(false);
});

test('shouldAnnounceConfidence: never → false', () => {
  expect(shouldAnnounceConfidence('never', 0.1)).toBe(false);
});

test('confidenceNote: 0.3 → low confidence message', () => {
  expect(confidenceNote(0.3)).toContain('Low confidence');
});

test('confidenceNote: 0.9 → empty string', () => {
  expect(confidenceNote(0.9)).toBe('');
});

test('getEarconId("critical") returns three-short-beeps', () => {
  expect(getEarconId('critical')).toBe('three-short-beeps');
});

test('buildAudioSummary: default prefs gives normal rate', () => {
  const summary = buildAudioSummary(DEFAULT_AUDIO);
  expect(summary.rateBucket).toBe('normal');
});

test('buildAudioSummary: muted gives Muted volumeLabel', () => {
  const audio = { ...DEFAULT_AUDIO, speechVolume: 0 };
  const summary = buildAudioSummary(audio);
  expect(summary.volumeLabel).toBe('Muted');
});

test('mergeAudioDefaults fills missing keys', () => {
  const merged = mergeAudioDefaults({ speechRate: 1.5 });
  expect(merged.speechRate).toBe(1.5);
  expect(merged.earconAlerts).toBe(DEFAULT_AUDIO.earconAlerts);
});

// ─── Section 7: Haptic preference engine ─────────────────────────────────────

section('Section 7: Haptic preference engine');

test('intensityMultiplier("off") returns 0', () => {
  expect(intensityMultiplier('off')).toBe(0);
});

test('intensityMultiplier("light") returns 0.5', () => {
  expect(intensityMultiplier('light')).toBe(0.5);
});

test('intensityMultiplier("strong") returns 1.5', () => {
  expect(intensityMultiplier('strong')).toBe(1.5);
});

test('intensityLabel("off") returns Off', () => {
  expect(intensityLabel('off')).toBe('Off');
});

test('getAllPatterns returns 6 patterns', () => {
  expect(getAllPatterns()).toHaveLength(6);
});

test('getPatternForRisk("critical") returns Critical Alert pattern', () => {
  const p = getPatternForRisk('critical');
  expect(p.name).toBe('Critical Alert');
});

test('getPatternForRisk("navigation") returns Navigation Turn pattern', () => {
  const p = getPatternForRisk('navigation');
  expect(p.name).toBe('Navigation Turn');
});

test('scalePattern by 0 (off) returns empty array', () => {
  expect(scalePattern([200, 100], 'off')).toHaveLength(0);
});

test('scalePattern by strong scales up', () => {
  const scaled = scalePattern([200], 'strong');
  expect(scaled[0]).toBe(300);
});

test('scalePattern by light scales down', () => {
  const scaled = scalePattern([200], 'light');
  expect(scaled[0]).toBe(100);
});

test('shouldVibrate: haptic disabled → false', () => {
  const prefs = { ...DEFAULT_HAPTIC, hapticEnabled: false };
  expect(shouldVibrate(prefs, 'critical')).toBe(false);
});

test('shouldVibrate: intensity off → false', () => {
  const prefs = { ...DEFAULT_HAPTIC, vibrationIntensity: 'off' as const };
  expect(shouldVibrate(prefs, 'critical')).toBe(false);
});

test('shouldVibrate: critical event with hapticForCritical → true', () => {
  expect(shouldVibrate(DEFAULT_HAPTIC, 'critical')).toBe(true);
});

test('shouldVibrate: low risk → always false', () => {
  expect(shouldVibrate(DEFAULT_HAPTIC, 'low')).toBe(false);
});

test('shouldVibrate: navigation with hapticForNavigation → true', () => {
  expect(shouldVibrate(DEFAULT_HAPTIC, 'navigation')).toBe(true);
});

test('buildVibrationCommand: haptic off → shouldVibrate false', () => {
  const prefs = { ...DEFAULT_HAPTIC, hapticEnabled: false };
  const cmd = buildVibrationCommand(prefs, 'critical');
  expect(cmd.shouldVibrate).toBe(false);
  expect(cmd.pattern).toHaveLength(0);
});

test('buildVibrationCommand: critical with strong intensity → non-empty pattern', () => {
  const prefs = { ...DEFAULT_HAPTIC, vibrationIntensity: 'strong' as const };
  const cmd = buildVibrationCommand(prefs, 'critical');
  expect(cmd.shouldVibrate).toBe(true);
  expect(cmd.pattern.length).toBeGreaterThan(0);
});

test('buildHapticSummary: default prefs → enabled', () => {
  const summary = buildHapticSummary(DEFAULT_HAPTIC);
  expect(summary.enabled).toBe(true);
});

test('mergeHapticDefaults fills missing keys', () => {
  const merged = mergeHapticDefaults({ vibrationIntensity: 'strong' });
  expect(merged.vibrationIntensity).toBe('strong');
  expect(merged.hapticEnabled).toBe(DEFAULT_HAPTIC.hapticEnabled);
});

// ─── Section 8: Integration across engines ───────────────────────────────────

section('Section 8: Integration across engines');

test('blind preset → shouldSpeakForRisk is true with full audio', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'blind');
  expect(shouldSpeakForRisk('critical', prefs.audio, prefs.accessibilityMode)).toBe(true);
});

test('hearing_impaired preset → shouldSpeakForRisk is false', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'hearing_impaired');
  expect(shouldSpeakForRisk('medium', prefs.audio, prefs.accessibilityMode)).toBe(false);
});

test('blind preset → verbosityToSentenceCount critical → 3', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'blind');
  expect(verbosityToSentenceCount(prefs.audio.guidanceVerbosity, 'critical')).toBe(3);
});

test('hearing_impaired preset → buildVibrationCommand critical vibrates', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'hearing_impaired');
  const cmd = buildVibrationCommand(prefs.haptic, 'critical');
  expect(cmd.shouldVibrate).toBe(true);
});

test('standard preset → deriveAccessibilityClasses empty html classes', () => {
  const prefs = createDefaultPreferences();
  const cls = deriveAccessibilityClasses(prefs);
  expect(cls.htmlClasses).toHaveLength(0);
});

test('toAppSettings from blind preset has screenReaderOptimised mapped', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'blind');
  const settings = toAppSettings(prefs);
  expect(settings.alertVerbosity).toBe('full');
});

test('diffPreferences after blind preset has multiple changes', () => {
  const base = createDefaultPreferences();
  const blind = applyPreset(base, 'blind');
  const diffs = diffPreferences(base, blind);
  expect(diffs.length).toBeGreaterThan(3);
});

test('validatePreferences on hearing_impaired preset is valid', () => {
  const prefs = applyPreset(createDefaultPreferences(), 'hearing_impaired');
  const result = validatePreferences(prefs);
  expect(result.valid).toBe(true);
});

test('updateAudio then diffPreferences detects single change', () => {
  const a = createDefaultPreferences();
  const b = updateAudio(a, { speechRate: 1.8 });
  const diffs = diffPreferences(a, b);
  const rateChange = diffs.find(d => d.group === 'audio' && d.key === 'speechRate');
  expect(rateChange).toBeTruthy();
});

test('full pipeline: apply preset → update audio → validate → toAppSettings', () => {
  const base = createDefaultPreferences();
  const preset = applyPreset(base, 'low_vision');
  const fine = updateAudio(preset, { speechRate: 1.2 });
  const validated = validatePreferences(fine);
  const settings = toAppSettings(fine);
  expect(validated.valid).toBe(true);
  expect(settings.speechRate).toBe(1.2);
  expect(settings.highContrastMode).toBe(true);
});

test('updatePersonality to companion mode works', () => {
  const a = createDefaultPreferences();
  const b = updatePersonality(a, 'companion');
  expect(b.personalityMode).toBe('companion');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

process.stdout.write(`\n${'─'.repeat(60)}\n`);
process.stdout.write(`Sprint 11 Accessibility Preference Tests\n`);
process.stdout.write(`Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}\n`);
if (failures.length) {
  process.stdout.write(`\nFailures:\n${failures.join('\n')}\n`);
  process.exit(1);
} else {
  process.stdout.write('All tests passed.\n');
  process.exit(0);
}

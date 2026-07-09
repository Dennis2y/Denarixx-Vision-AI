// Sprint 13 — Multi-Language AI Engine Tests
// Tests for languageDetectionEngine, languageEngine, translationEngine,
// and speechLanguageEngine.

import { strict as assert } from 'assert';

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  mapLocaleToLanguage,
  detectFromLocale,
  detectFromText,
  detectLanguage,
  isSupportedLanguage,
  detectFromLanguageList,
} from '../src/engines/languageDetectionEngine';

import {
  LANGUAGE_REGISTRY,
  getLanguageInfo,
  getSupportedLanguages,
  isRTL,
  getLanguageName,
  getNativeName,
  getVoiceLangCode,
  getFlag,
  isLanguageSupported,
  buildDefaultVoicePreferences,
  createDefaultPreferences,
  validatePreferences,
  setPreferredLanguage,
  setAutoDetect,
  setFallbackLanguage,
  applyAutoDetect,
  updateVoicePreference,
  getVoicePreferenceForLanguage,
  getTextDirection,
  getCssClass,
  diffLanguagePreferences,
} from '../src/engines/languageEngine';

import {
  PHRASE_DICTIONARY,
  translateText,
  translateHazardAlert,
  translateSceneDescription,
  translateNavigationGuidance,
  translateCompanionSpeech,
  translateAIExplanation,
  translateMemorySummary,
  batchTranslate,
  listPhraseKeys,
  getAllTranslations,
  addPhrase,
  formatForRTL,
} from '../src/engines/translationEngine';

import {
  VOICE_OPTIONS,
  getVoicesForLanguage,
  getVoiceById,
  getDefaultVoice,
  getAllVoices,
  getVoicesByGender,
  getVoicesByStyle,
  buildVoicePreference,
  selectBestVoice,
  switchVoiceForLanguage,
  buildSpeechUtteranceConfig,
  adjustRateForAccessibility,
  clampVoicePreference,
  getDirectionForLanguage,
} from '../src/engines/speechLanguageEngine';

import type { SupportedLanguage, LanguagePreferences } from '../src/types/language';
import { SUPPORTED_LANGUAGES, LANGUAGE_DEFAULTS } from '../src/types/language';

// ─── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
}

// ─── Language Detection Engine ────────────────────────────────────────────────

console.log('\nLanguage Detection Engine');

test('mapLocaleToLanguage — exact matches', () => {
  assert.equal(mapLocaleToLanguage('en'), 'en');
  assert.equal(mapLocaleToLanguage('de'), 'de');
  assert.equal(mapLocaleToLanguage('fr'), 'fr');
  assert.equal(mapLocaleToLanguage('es'), 'es');
  assert.equal(mapLocaleToLanguage('it'), 'it');
  assert.equal(mapLocaleToLanguage('pt'), 'pt');
  assert.equal(mapLocaleToLanguage('ar'), 'ar');
  assert.equal(mapLocaleToLanguage('sw'), 'sw');
});

test('mapLocaleToLanguage — regional variants', () => {
  assert.equal(mapLocaleToLanguage('en-GB'), 'en');
  assert.equal(mapLocaleToLanguage('en-US'), 'en');
  assert.equal(mapLocaleToLanguage('de-AT'), 'de');
  assert.equal(mapLocaleToLanguage('fr-CA'), 'fr');
  assert.equal(mapLocaleToLanguage('es-MX'), 'es');
  assert.equal(mapLocaleToLanguage('pt-BR'), 'pt');
  assert.equal(mapLocaleToLanguage('ar-SA'), 'ar');
  assert.equal(mapLocaleToLanguage('sw-KE'), 'sw');
});

test('mapLocaleToLanguage — unknown locale returns null', () => {
  assert.equal(mapLocaleToLanguage('zh'), null);
  assert.equal(mapLocaleToLanguage('ja'), null);
  assert.equal(mapLocaleToLanguage('ru'), null);
  assert.equal(mapLocaleToLanguage('ko'), null);
  assert.equal(mapLocaleToLanguage(''), null);
});

test('mapLocaleToLanguage — case insensitive', () => {
  assert.equal(mapLocaleToLanguage('EN-GB'), 'en');
  assert.equal(mapLocaleToLanguage('De'), 'de');
  assert.equal(mapLocaleToLanguage('FR-FR'), 'fr');
});

test('detectFromLocale — known locale has high confidence', () => {
  const result = detectFromLocale('en-GB');
  assert.equal(result.detectedLanguage, 'en');
  assert.ok(result.confidence >= 0.9);
  assert.equal(result.method, 'browser');
  assert.equal(result.rawLocale, 'en-GB');
});

test('detectFromLocale — unknown locale falls back to English', () => {
  const result = detectFromLocale('zh-CN');
  assert.equal(result.detectedLanguage, 'en');
  assert.equal(result.method, 'fallback');
  assert.ok(result.confidence < 0.5);
});

test('detectFromText — Arabic script detection', () => {
  const result = detectFromText('في المدينة والطريق');
  assert.equal(result.detectedLanguage, 'ar');
  assert.ok(result.confidence >= 0.95);
  assert.equal(result.method, 'text_analysis');
});

test('detectFromText — English word markers', () => {
  const result = detectFromText('the path is clear and the obstacle was removed');
  assert.equal(result.detectedLanguage, 'en');
  assert.ok(result.confidence > 0.3);
});

test('detectFromText — German word markers', () => {
  const result = detectFromText('die Straße ist frei und das Hindernis ist nicht vorhanden');
  assert.equal(result.detectedLanguage, 'de');
  assert.ok(result.confidence > 0.3);
});

test('detectFromText — French word markers', () => {
  const result = detectFromText('le chemin est libre et les obstacles ne sont pas présents');
  assert.equal(result.detectedLanguage, 'fr');
  assert.ok(result.confidence > 0.3);
});

test('detectFromText — empty text returns fallback', () => {
  const result = detectFromText('');
  assert.equal(result.detectedLanguage, 'en');
  assert.equal(result.method, 'fallback');
});

test('detectLanguage — prefers locale when confident', () => {
  const result = detectLanguage('de-DE', 'the path is clear');
  assert.equal(result.detectedLanguage, 'de');
  assert.equal(result.method, 'browser');
});

test('detectLanguage — falls back to text when locale unknown', () => {
  const result = detectLanguage('zh-CN', 'في المدينة والطريق');
  assert.equal(result.detectedLanguage, 'ar');
  assert.equal(result.method, 'text_analysis');
});

test('detectLanguage — no inputs returns fallback', () => {
  const result = detectLanguage();
  assert.equal(result.detectedLanguage, 'en');
  assert.equal(result.method, 'fallback');
});

test('detectLanguage — only text, no locale', () => {
  const result = detectLanguage(undefined, 'le chemin est libre et les obstacles ne sont pas là');
  assert.equal(result.detectedLanguage, 'fr');
});

test('isSupportedLanguage — all 8 languages return true', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    assert.ok(isSupportedLanguage(lang), `Expected ${lang} to be supported`);
  }
});

test('isSupportedLanguage — unsupported codes return false', () => {
  assert.ok(!isSupportedLanguage('zh'));
  assert.ok(!isSupportedLanguage('ja'));
  assert.ok(!isSupportedLanguage(''));
  assert.ok(!isSupportedLanguage('ru'));
});

test('detectFromLanguageList — finds first supported language', () => {
  const result = detectFromLanguageList(['zh-CN', 'de-DE', 'en-US']);
  assert.equal(result.detectedLanguage, 'de');
});

test('detectFromLanguageList — all unsupported falls back', () => {
  const result = detectFromLanguageList(['zh', 'ja', 'ko']);
  assert.equal(result.detectedLanguage, 'en');
  assert.equal(result.method, 'fallback');
});

test('detectFromLanguageList — empty array falls back', () => {
  const result = detectFromLanguageList([]);
  assert.equal(result.detectedLanguage, 'en');
});

// ─── Language Engine ──────────────────────────────────────────────────────────

console.log('\nLanguage Engine');

test('LANGUAGE_REGISTRY — contains all 8 languages', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    assert.ok(LANGUAGE_REGISTRY[lang], `Missing registry entry for ${lang}`);
  }
});

test('LANGUAGE_REGISTRY — Arabic is RTL', () => {
  assert.equal(LANGUAGE_REGISTRY['ar'].rtl, true);
});

test('LANGUAGE_REGISTRY — all other languages are LTR', () => {
  const ltrLanguages: SupportedLanguage[] = ['en', 'de', 'fr', 'es', 'it', 'pt', 'sw'];
  for (const lang of ltrLanguages) {
    assert.equal(LANGUAGE_REGISTRY[lang].rtl, false, `${lang} should be LTR`);
  }
});

test('LANGUAGE_REGISTRY — all entries have required fields', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    const info = LANGUAGE_REGISTRY[lang];
    assert.ok(info.code, `${lang}: missing code`);
    assert.ok(info.name, `${lang}: missing name`);
    assert.ok(info.nativeName, `${lang}: missing nativeName`);
    assert.ok(info.flag, `${lang}: missing flag`);
    assert.ok(info.voiceLang, `${lang}: missing voiceLang`);
    assert.ok(info.region, `${lang}: missing region`);
  }
});

test('getLanguageInfo — returns correct info', () => {
  const info = getLanguageInfo('de');
  assert.equal(info.name, 'German');
  assert.equal(info.nativeName, 'Deutsch');
  assert.equal(info.flag, '🇩🇪');
});

test('getSupportedLanguages — returns 8 languages', () => {
  const langs = getSupportedLanguages();
  assert.equal(langs.length, 8);
});

test('isRTL — Arabic is RTL', () => {
  assert.equal(isRTL('ar'), true);
});

test('isRTL — English is LTR', () => {
  assert.equal(isRTL('en'), false);
});

test('getLanguageName — correct English names', () => {
  assert.equal(getLanguageName('en'), 'English');
  assert.equal(getLanguageName('de'), 'German');
  assert.equal(getLanguageName('fr'), 'French');
  assert.equal(getLanguageName('es'), 'Spanish');
  assert.equal(getLanguageName('sw'), 'Swahili');
});

test('getNativeName — returns native language names', () => {
  assert.equal(getNativeName('de'), 'Deutsch');
  assert.equal(getNativeName('fr'), 'Français');
  assert.equal(getNativeName('es'), 'Español');
  assert.equal(getNativeName('ar'), 'العربية');
  assert.equal(getNativeName('sw'), 'Kiswahili');
});

test('getVoiceLangCode — returns BCP-47 tags', () => {
  assert.equal(getVoiceLangCode('en'), 'en-GB');
  assert.equal(getVoiceLangCode('de'), 'de-DE');
  assert.equal(getVoiceLangCode('ar'), 'ar-SA');
});

test('getFlag — returns emoji flags', () => {
  assert.equal(getFlag('en'), '🇬🇧');
  assert.equal(getFlag('de'), '🇩🇪');
  assert.equal(getFlag('ar'), '🇸🇦');
  assert.equal(getFlag('sw'), '🇰🇪');
});

test('isLanguageSupported — all 8 are supported', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    assert.ok(isLanguageSupported(lang));
  }
});

test('isLanguageSupported — unsupported codes return false', () => {
  assert.ok(!isLanguageSupported('zh'));
  assert.ok(!isLanguageSupported(''));
});

test('buildDefaultVoicePreferences — creates entry for every language', () => {
  const prefs = buildDefaultVoicePreferences();
  for (const lang of SUPPORTED_LANGUAGES) {
    assert.ok(prefs[lang], `Missing voice prefs for ${lang}`);
    assert.equal(prefs[lang].language, lang);
    assert.equal(prefs[lang].pitch, 1.0);
    assert.equal(prefs[lang].rate, 1.0);
    assert.equal(prefs[lang].volume, 1.0);
  }
});

test('createDefaultPreferences — guardianLanguage is always en', () => {
  const prefs = createDefaultPreferences();
  assert.equal(prefs.guardianLanguage, 'en');
  assert.equal(prefs.preferredLanguage, 'en');
  assert.equal(prefs.autoDetect, true);
  assert.equal(prefs.translateHazardsImmediately, true);
});

test('validatePreferences — fills in missing fields', () => {
  const prefs = validatePreferences({ preferredLanguage: 'fr' });
  assert.equal(prefs.preferredLanguage, 'fr');
  assert.equal(prefs.guardianLanguage, 'en');
  assert.equal(prefs.autoDetect, true);
});

test('validatePreferences — unsupported language falls back to en', () => {
  const prefs = validatePreferences({ preferredLanguage: 'zh' as SupportedLanguage });
  assert.equal(prefs.preferredLanguage, 'en');
});

test('validatePreferences — guardianLanguage always en regardless of input', () => {
  const prefs = validatePreferences({ preferredLanguage: 'de' });
  assert.equal(prefs.guardianLanguage, 'en');
});

test('setPreferredLanguage — returns new object with updated language', () => {
  const prefs = createDefaultPreferences();
  const updated = setPreferredLanguage(prefs, 'fr');
  assert.equal(updated.preferredLanguage, 'fr');
  assert.equal(prefs.preferredLanguage, 'en'); // original unchanged
});

test('setAutoDetect — toggles auto-detection', () => {
  const prefs = createDefaultPreferences();
  const disabled = setAutoDetect(prefs, false);
  assert.equal(disabled.autoDetect, false);
});

test('setFallbackLanguage — sets fallback', () => {
  const prefs = createDefaultPreferences();
  const updated = setFallbackLanguage(prefs, 'fr');
  assert.equal(updated.fallbackLanguage, 'fr');
});

test('applyAutoDetect — changes language when autoDetect true and confidence sufficient', () => {
  const prefs = createDefaultPreferences();
  const result = applyAutoDetect(prefs, { detectedLanguage: 'de', confidence: 0.9, method: 'browser' });
  assert.equal(result.preferredLanguage, 'de');
});

test('applyAutoDetect — ignores detection when autoDetect false', () => {
  const prefs = { ...createDefaultPreferences(), autoDetect: false };
  const result = applyAutoDetect(prefs, { detectedLanguage: 'de', confidence: 0.9, method: 'browser' });
  assert.equal(result.preferredLanguage, 'en');
});

test('applyAutoDetect — ignores low-confidence detection', () => {
  const prefs = createDefaultPreferences();
  const result = applyAutoDetect(prefs, { detectedLanguage: 'sw', confidence: 0.3, method: 'fallback' });
  assert.equal(result.preferredLanguage, 'en');
});

test('updateVoicePreference — updates pitch for specific language', () => {
  const prefs = createDefaultPreferences();
  const updated = updateVoicePreference(prefs, 'fr', { pitch: 1.2 });
  assert.equal(updated.voicePreferences['fr'].pitch, 1.2);
  assert.equal(prefs.voicePreferences['fr'].pitch, 1.0); // original unchanged
});

test('getVoicePreferenceForLanguage — returns defaults when not set', () => {
  const prefs = createDefaultPreferences();
  const voice = getVoicePreferenceForLanguage(prefs, 'de');
  assert.equal(voice.language, 'de');
  assert.equal(voice.pitch, 1.0);
});

test('getTextDirection — returns rtl for Arabic', () => {
  assert.equal(getTextDirection('ar'), 'rtl');
  assert.equal(getTextDirection('en'), 'ltr');
});

test('getCssClass — returns lang-rtl for Arabic', () => {
  assert.equal(getCssClass('ar'), 'lang-rtl');
  assert.equal(getCssClass('en'), 'lang-ltr');
});

test('diffLanguagePreferences — detects language change', () => {
  const prev = createDefaultPreferences();
  const next = setPreferredLanguage(prev, 'de');
  const diff = diffLanguagePreferences(prev, next);
  assert.equal(diff.languageChanged, true);
  assert.equal(diff.fromLanguage, 'en');
  assert.equal(diff.toLanguage, 'de');
  assert.equal(diff.requiresVoiceSwitch, true); // autoSwitchVoice defaults to true
});

test('diffLanguagePreferences — no change when language same', () => {
  const prefs = createDefaultPreferences();
  const diff = diffLanguagePreferences(prefs, prefs);
  assert.equal(diff.languageChanged, false);
  assert.equal(diff.requiresVoiceSwitch, false);
});

// ─── Translation Engine ───────────────────────────────────────────────────────

console.log('\nTranslation Engine');

test('PHRASE_DICTIONARY — contains hazard alerts', () => {
  assert.ok(PHRASE_DICTIONARY['Hazard ahead']);
  assert.ok(PHRASE_DICTIONARY['Stop immediately']);
  assert.ok(PHRASE_DICTIONARY['Obstacle detected']);
  assert.ok(PHRASE_DICTIONARY['Clear path ahead']);
});

test('PHRASE_DICTIONARY — contains navigation phrases', () => {
  assert.ok(PHRASE_DICTIONARY['Turn left']);
  assert.ok(PHRASE_DICTIONARY['Turn right']);
  assert.ok(PHRASE_DICTIONARY['Continue straight ahead']);
  assert.ok(PHRASE_DICTIONARY['You have arrived']);
});

test('PHRASE_DICTIONARY — every phrase has all 8 languages', () => {
  for (const [key, translations] of Object.entries(PHRASE_DICTIONARY)) {
    for (const lang of SUPPORTED_LANGUAGES) {
      assert.ok(
        translations[lang],
        `Phrase "${key}" missing translation for "${lang}"`,
      );
    }
  }
});

test('translateText — same source and target returns original', () => {
  const result = translateText({
    text: 'Hazard ahead',
    context: 'hazard',
    sourceLanguage: 'en',
    targetLanguage: 'en',
  });
  assert.equal(result.translatedText, 'Hazard ahead');
});

test('translateText — translates known phrase to German', () => {
  const result = translateText({
    text: 'Hazard ahead',
    context: 'hazard',
    sourceLanguage: 'en',
    targetLanguage: 'de',
  });
  assert.equal(result.translatedText, 'Gefahr voraus');
  assert.equal(result.targetLanguage, 'de');
  assert.equal(result.context, 'hazard');
  assert.equal(result.wasSimulated, true);
});

test('translateText — translates to French', () => {
  const result = translateText({ text: 'Turn left', context: 'navigation', targetLanguage: 'fr' });
  assert.equal(result.translatedText, 'Tournez à gauche');
});

test('translateText — translates to Spanish', () => {
  const result = translateText({ text: 'Turn right', context: 'navigation', targetLanguage: 'es' });
  assert.equal(result.translatedText, 'Gire a la derecha');
});

test('translateText — translates to Arabic', () => {
  const result = translateText({ text: 'Stop immediately', context: 'hazard', targetLanguage: 'ar' });
  assert.equal(result.translatedText, 'توقف فوراً');
});

test('translateText — translates to Swahili', () => {
  const result = translateText({ text: 'Clear path ahead', context: 'navigation', targetLanguage: 'sw' });
  assert.equal(result.translatedText, 'Njia wazi mbele');
});

test('translateText — unknown phrase falls back to original text', () => {
  const result = translateText({
    text: 'Some unknown custom phrase',
    context: 'general',
    targetLanguage: 'de',
  });
  assert.equal(result.translatedText, 'Some unknown custom phrase');
  assert.equal(result.wasSimulated, true);
});

test('translateText — latencyMs is a non-negative number', () => {
  const result = translateText({ text: 'Turn left', context: 'navigation', targetLanguage: 'fr' });
  assert.ok(result.latencyMs >= 0);
});

test('translateText — timestamp is populated', () => {
  const result = translateText({ text: 'Turn left', context: 'navigation', targetLanguage: 'fr' });
  assert.ok(result.timestamp > 0);
});

test('translateHazardAlert — translates hazard to Italian', () => {
  const result = translateHazardAlert('Hazard ahead', 'it');
  assert.equal(result.translatedText, 'Pericolo davanti');
  assert.equal(result.context, 'hazard');
});

test('translateHazardAlert — critical flag is passed', () => {
  const result = translateHazardAlert('Stop immediately', 'de');
  assert.equal(result.translatedText, 'Sofort anhalten');
  assert.equal(result.context, 'hazard');
});

test('translateHazardAlert — all hazard phrases translate to all 8 languages', () => {
  const hazards = ['Hazard ahead', 'Stop immediately', 'Obstacle detected', 'Clear path ahead'];
  for (const hazard of hazards) {
    for (const lang of SUPPORTED_LANGUAGES) {
      const result = translateHazardAlert(hazard, lang);
      assert.ok(result.translatedText, `${hazard} → ${lang} produced empty string`);
    }
  }
});

test('translateSceneDescription — correct context', () => {
  const result = translateSceneDescription('Indoor scene detected', 'fr');
  assert.equal(result.translatedText, 'Scène intérieure détectée');
  assert.equal(result.context, 'scene');
});

test('translateNavigationGuidance — correct context', () => {
  const result = translateNavigationGuidance('Recalculating route', 'pt');
  assert.equal(result.translatedText, 'Recalculando rota');
  assert.equal(result.context, 'navigation');
});

test('translateCompanionSpeech — correct context', () => {
  const result = translateCompanionSpeech('Session started', 'es');
  assert.equal(result.translatedText, 'Sesión iniciada');
  assert.equal(result.context, 'companion');
});

test('translateAIExplanation — correct context', () => {
  const result = translateAIExplanation('High confidence decision', 'de');
  assert.equal(result.translatedText, 'Entscheidung mit hoher Konfidenz');
  assert.equal(result.context, 'ai');
});

test('translateMemorySummary — correct context', () => {
  const result = translateMemorySummary('Memory saved', 'fr');
  assert.equal(result.translatedText, 'Souvenir enregistré');
  assert.equal(result.context, 'memory');
});

test('batchTranslate — translates multiple phrases', () => {
  const phrases = ['Turn left', 'Turn right', 'Continue straight ahead'];
  const results = batchTranslate(phrases, 'de', 'navigation');
  assert.equal(results.length, 3);
  assert.equal(results[0].translatedText, 'Links abbiegen');
  assert.equal(results[1].translatedText, 'Rechts abbiegen');
  assert.equal(results[2].translatedText, 'Geradeaus weiterfahren');
});

test('batchTranslate — empty array returns empty array', () => {
  const results = batchTranslate([], 'fr', 'navigation');
  assert.equal(results.length, 0);
});

test('listPhraseKeys — returns non-empty array', () => {
  const keys = listPhraseKeys();
  assert.ok(keys.length > 0);
  assert.ok(keys.includes('Hazard ahead'));
  assert.ok(keys.includes('Turn left'));
});

test('getAllTranslations — returns all translations for a known phrase', () => {
  const translations = getAllTranslations('Turn left');
  assert.ok(translations);
  assert.equal(translations!['en'], 'Turn left');
  assert.equal(translations!['de'], 'Links abbiegen');
});

test('getAllTranslations — returns null for unknown phrase', () => {
  const result = getAllTranslations('This phrase does not exist');
  assert.equal(result, null);
});

test('addPhrase — adds custom phrase to dictionary copy', () => {
  const newPhrase = {
    en: 'Emergency stop', de: 'Notfall-Stopp', fr: 'Arrêt d\'urgence',
    es: 'Parada de emergencia', it: 'Arresto di emergenza',
    pt: 'Paragem de emergência', ar: 'توقف طارئ', sw: 'Simama dharura',
  };
  const updated = addPhrase(PHRASE_DICTIONARY, 'Emergency stop', newPhrase);
  assert.ok(updated['Emergency stop']);
  assert.equal(updated['Emergency stop']['de'], 'Notfall-Stopp');
  assert.ok(!PHRASE_DICTIONARY['Emergency stop']); // original unchanged
});

test('formatForRTL — wraps Arabic text', () => {
  const wrapped = formatForRTL('خطر أمامك', true);
  assert.ok(wrapped.includes('خطر أمامك'));
  assert.ok(wrapped.length > 'خطر أمامك'.length);
});

test('formatForRTL — does not wrap LTR text', () => {
  const result = formatForRTL('Hazard ahead', false);
  assert.equal(result, 'Hazard ahead');
});

// ─── Speech Language Engine ───────────────────────────────────────────────────

console.log('\nSpeech Language Engine');

test('VOICE_OPTIONS — contains entries for all 8 languages', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    assert.ok(VOICE_OPTIONS[lang]?.length > 0, `Missing voice options for ${lang}`);
  }
});

test('VOICE_OPTIONS — all voices have required fields', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    for (const voice of VOICE_OPTIONS[lang]) {
      assert.ok(voice.id, `${lang} voice missing id`);
      assert.ok(voice.name, `${lang} voice missing name`);
      assert.ok(voice.gender, `${lang} voice missing gender`);
      assert.ok(voice.style, `${lang} voice missing style`);
      assert.ok(voice.description, `${lang} voice missing description`);
      assert.equal(voice.language, lang);
    }
  }
});

test('getVoicesForLanguage — returns voices for English', () => {
  const voices = getVoicesForLanguage('en');
  assert.ok(voices.length >= 2);
});

test('getVoicesForLanguage — returns voices for Arabic', () => {
  const voices = getVoicesForLanguage('ar');
  assert.ok(voices.length >= 1);
});

test('getVoiceById — finds voice by id', () => {
  const voice = getVoiceById('en', 'en-female-natural');
  assert.ok(voice);
  assert.equal(voice!.name, 'Alice');
});

test('getVoiceById — returns null for unknown id', () => {
  const voice = getVoiceById('en', 'en-unknown-voice');
  assert.equal(voice, null);
});

test('getDefaultVoice — returns first voice for each language', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    const voice = getDefaultVoice(lang);
    assert.ok(voice.id, `${lang} default voice missing id`);
    assert.equal(voice.language, lang);
  }
});

test('getAllVoices — returns voices for all languages', () => {
  const voices = getAllVoices();
  assert.ok(voices.length >= 16); // at least 2 per language × 8 languages
});

test('getVoicesByGender — filters by female', () => {
  const voices = getVoicesByGender('female');
  assert.ok(voices.length > 0);
  assert.ok(voices.every(v => v.gender === 'female'));
});

test('getVoicesByGender — filters by male', () => {
  const voices = getVoicesByGender('male');
  assert.ok(voices.length > 0);
  assert.ok(voices.every(v => v.gender === 'male'));
});

test('getVoicesByStyle — filters by natural', () => {
  const voices = getVoicesByStyle('natural');
  assert.ok(voices.length > 0);
  assert.ok(voices.every(v => v.style === 'natural'));
});

test('buildVoicePreference — creates preference with defaults', () => {
  const pref = buildVoicePreference('de');
  assert.equal(pref.language, 'de');
  assert.equal(pref.pitch, 1.0);
  assert.equal(pref.rate, 1.0);
  assert.equal(pref.volume, 1.0);
});

test('buildVoicePreference — respects overrides', () => {
  const pref = buildVoicePreference('fr', 'fr-male-clear', { pitch: 1.2, rate: 0.8 });
  assert.equal(pref.voiceId, 'fr-male-clear');
  assert.equal(pref.pitch, 1.2);
  assert.equal(pref.rate, 0.8);
});

test('selectBestVoice — returns default when no preference', () => {
  const voice = selectBestVoice('es');
  assert.equal(voice.language, 'es');
});

test('selectBestVoice — returns matching voice by id', () => {
  const voice = selectBestVoice('en', { voiceId: 'en-male-clear' });
  assert.equal(voice.id, 'en-male-clear');
});

test('switchVoiceForLanguage — switches to new language', () => {
  const prefs = createDefaultPreferences();
  const updated = switchVoiceForLanguage(prefs, 'fr');
  assert.equal(updated.preferredLanguage, 'fr');
});

test('switchVoiceForLanguage — auto-assigns default voice when no preference exists', () => {
  const prefs = { ...createDefaultPreferences(), voicePreferences: {} as LanguagePreferences['voicePreferences'] };
  const updated = switchVoiceForLanguage(prefs, 'de');
  assert.equal(updated.preferredLanguage, 'de');
  assert.ok(updated.voicePreferences['de']?.voiceId);
});

test('switchVoiceForLanguage — preserves existing voice preference', () => {
  const prefs = createDefaultPreferences();
  // Pre-set a valid voice preference for French
  const withFr = updateVoicePreference(prefs, 'fr', { voiceId: 'fr-male-clear' });
  const updated = switchVoiceForLanguage(withFr, 'fr');
  assert.equal(updated.voicePreferences['fr'].voiceId, 'fr-male-clear');
});

test('switchVoiceForLanguage — respects autoSwitchVoice:false', () => {
  const prefs = { ...createDefaultPreferences(), autoSwitchVoice: false };
  const updated = switchVoiceForLanguage(prefs, 'de');
  assert.equal(updated.preferredLanguage, 'de');
  // Voice preference for de should not be auto-assigned
  assert.equal(updated.voicePreferences['de']?.voiceId, 'de-default');
});

test('buildSpeechUtteranceConfig — builds correct config', () => {
  const pref = buildVoicePreference('fr', 'fr-female-natural');
  const config = buildSpeechUtteranceConfig('Tournez à gauche', 'fr', pref);
  assert.equal(config.text, 'Tournez à gauche');
  assert.equal(config.lang, 'fr-FR');
  assert.equal(config.pitch, 1.0);
  assert.equal(config.rate, 1.0);
  assert.equal(config.volume, 1.0);
});

test('buildSpeechUtteranceConfig — Arabic uses correct BCP-47', () => {
  const pref = buildVoicePreference('ar', 'ar-female-natural');
  const config = buildSpeechUtteranceConfig('خطر أمامك', 'ar', pref);
  assert.equal(config.lang, 'ar-SA');
});

test('adjustRateForAccessibility — slow mode reduces rate', () => {
  const pref = buildVoicePreference('en');
  const slow = adjustRateForAccessibility(pref, 'slow');
  assert.ok(slow.rate < 1.0);
  assert.equal(slow.rate, 0.75);
});

test('adjustRateForAccessibility — fast mode increases rate', () => {
  const pref = buildVoicePreference('en');
  const fast = adjustRateForAccessibility(pref, 'fast');
  assert.ok(fast.rate > 1.0);
});

test('adjustRateForAccessibility — normal mode keeps rate at 1.0', () => {
  const pref = buildVoicePreference('en');
  const normal = adjustRateForAccessibility(pref, 'normal');
  assert.equal(normal.rate, 1.0);
});

test('clampVoicePreference — clamps pitch to 0.5–2.0', () => {
  const pref = { ...buildVoicePreference('en'), pitch: 5.0 };
  const clamped = clampVoicePreference(pref);
  assert.equal(clamped.pitch, 2.0);
});

test('clampVoicePreference — clamps rate below minimum', () => {
  const pref = { ...buildVoicePreference('en'), rate: 0.1 };
  const clamped = clampVoicePreference(pref);
  assert.equal(clamped.rate, 0.5);
});

test('clampVoicePreference — clamps volume to 0.0–1.0', () => {
  const pref = { ...buildVoicePreference('en'), volume: 2.5 };
  const clamped = clampVoicePreference(pref);
  assert.equal(clamped.volume, 1.0);
});

test('getDirectionForLanguage — Arabic is rtl', () => {
  assert.equal(getDirectionForLanguage('ar'), 'rtl');
});

test('getDirectionForLanguage — all others are ltr', () => {
  const ltrLangs: SupportedLanguage[] = ['en', 'de', 'fr', 'es', 'it', 'pt', 'sw'];
  for (const lang of ltrLangs) {
    assert.equal(getDirectionForLanguage(lang), 'ltr');
  }
});

// ─── Integration scenarios ────────────────────────────────────────────────────

console.log('\nIntegration scenarios');

test('Guardian pipeline: hazard in English → translated for presentation', () => {
  // Guardian always generates in English first
  const guardianOutput = 'Hazard ahead'; // Guardian output (English)

  // User's display language is German
  const translated = translateHazardAlert(guardianOutput, 'de');
  assert.equal(translated.translatedText, 'Gefahr voraus');
  assert.equal(translated.sourceLanguage, 'en');
  assert.equal(translated.targetLanguage, 'de');
});

test('Guardian pipeline: critical alert never delayed (sync resolution)', () => {
  const start = Date.now();
  const result = translateHazardAlert('Stop immediately', 'fr');
  const elapsed = Date.now() - start;
  assert.equal(result.translatedText, 'Arrêtez immédiatement');
  assert.ok(elapsed < 50, `Translation took ${elapsed}ms — should be < 50ms`);
});

test('Language switch: detect browser → apply → switch voice', () => {
  const detected = detectFromLocale('es-ES');
  assert.equal(detected.detectedLanguage, 'es');

  let prefs = createDefaultPreferences();
  prefs = applyAutoDetect(prefs, detected);
  assert.equal(prefs.preferredLanguage, 'es');

  prefs = switchVoiceForLanguage(prefs, 'es');
  assert.equal(prefs.preferredLanguage, 'es');
  assert.ok(prefs.voicePreferences['es'].voiceId);
});

test('Full navigation sequence in Swahili', () => {
  const phrases = ['Continue straight ahead', 'Turn left', 'You have arrived'];
  const results = batchTranslate(phrases, 'sw', 'navigation');
  assert.equal(results[0].translatedText, 'Endelea moja kwa moja');
  assert.equal(results[1].translatedText, 'Geuka kushoto');
  assert.equal(results[2].translatedText, 'Umefika');
});

test('Arabic RTL: translation + formatting', () => {
  const result = translateHazardAlert('Stop immediately', 'ar');
  assert.equal(result.translatedText, 'توقف فوراً');
  const formatted = formatForRTL(result.translatedText, true);
  assert.ok(formatted.length > result.translatedText.length);
  const dir = getDirectionForLanguage('ar');
  assert.equal(dir, 'rtl');
});

test('Memory phrase in Portuguese', () => {
  const result = translateMemorySummary('I remember this place', 'pt');
  assert.equal(result.translatedText, 'Lembro-me deste lugar');
});

test('Settings phrase in Italian', () => {
  const result = translateText({ text: 'Settings', context: 'settings', targetLanguage: 'it' });
  assert.equal(result.translatedText, 'Impostazioni');
});

test('Companion speech in Arabic', () => {
  const result = translateCompanionSpeech('I am here to help you navigate safely', 'ar');
  assert.equal(result.translatedText, 'أنا هنا لمساعدتك في التنقل بأمان');
});

test('Trust message in German', () => {
  const result = translateText({ text: 'Low confidence — please verify', context: 'trust', targetLanguage: 'de' });
  assert.equal(result.translatedText, 'Geringe Konfidenz — bitte überprüfen');
});

test('Auto-detect disabled — manual selection persists', () => {
  let prefs = createDefaultPreferences();
  prefs = setAutoDetect(prefs, false);
  prefs = setPreferredLanguage(prefs, 'it');

  const detected = detectFromLocale('de-DE');
  prefs = applyAutoDetect(prefs, detected);

  assert.equal(prefs.preferredLanguage, 'it'); // unchanged despite detection
  assert.equal(prefs.autoDetect, false);
});

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\nLanguage Engine Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

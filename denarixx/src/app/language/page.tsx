'use client';

import { useState, useCallback } from 'react';
import {
  LANGUAGE_REGISTRY,
  createDefaultPreferences,
  setPreferredLanguage,
  setAutoDetect,
  updateVoicePreference,
  isRTL,
  getSupportedLanguages,
} from '@/engines/languageEngine';
import {
  getVoicesForLanguage,
  switchVoiceForLanguage,
  buildSpeechUtteranceConfig,
  adjustRateForAccessibility,
  clampVoicePreference,
} from '@/engines/speechLanguageEngine';
import {
  translateText,
  translateHazardAlert,
  translateNavigationGuidance,
  translateCompanionSpeech,
  translateAIExplanation,
} from '@/engines/translationEngine';
import { detectFromLocale } from '@/engines/languageDetectionEngine';
import type { SupportedLanguage, LanguagePreferences, VoicePreference } from '@/types/language';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_PRIVACY_NOTE,
  GUARDIAN_SAFETY_NOTE,
} from '@/types/language';

type Tab = 'language' | 'voice' | 'preview' | 'test';

const PREVIEW_PHRASES: { label: string; text: string; context: 'hazard' | 'navigation' | 'companion' | 'ai' | 'general' }[] = [
  { label: 'Hazard Alert',     text: 'Hazard ahead',                          context: 'hazard' },
  { label: 'Navigation',       text: 'Turn left',                              context: 'navigation' },
  { label: 'Companion',        text: 'I am here to help you navigate safely',  context: 'companion' },
  { label: 'AI Explanation',   text: 'High confidence decision',               context: 'ai' },
  { label: 'Clear Path',       text: 'Clear path ahead',                       context: 'navigation' },
  { label: 'Session',         text: 'Session started',                         context: 'companion' },
];

const TEST_PHRASES: { label: string; text: string }[] = [
  { label: 'Stop!',       text: 'Stop immediately' },
  { label: 'Turn Left',   text: 'Turn left' },
  { label: 'Arrived',     text: 'You have arrived' },
  { label: 'Memory',      text: 'I remember this place' },
];

export default function LanguagePage() {
  const [tab, setTab] = useState<Tab>('language');
  const [prefs, setPrefs] = useState<LanguagePreferences>(createDefaultPreferences);
  const [saved, setSaved] = useState(false);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [detected, setDetected] = useState<string | null>(null);

  const lang = prefs.preferredLanguage;
  const info = LANGUAGE_REGISTRY[lang];
  const dir = isRTL(lang) ? 'rtl' : 'ltr';
  const voicePref = prefs.voicePreferences[lang] ?? { language: lang, voiceId: `${lang}-default`, pitch: 1.0, rate: 1.0, volume: 1.0 };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectLanguage = useCallback((code: SupportedLanguage) => {
    setPrefs(p => switchVoiceForLanguage(setPreferredLanguage(p, code), code));
    setSaved(false);
  }, []);

  const handleAutoDetect = useCallback(() => {
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en';
    const result = detectFromLocale(locale);
    setDetected(`Detected: ${LANGUAGE_REGISTRY[result.detectedLanguage].name} (${Math.round(result.confidence * 100)}% confidence, ${result.method})`);
    setPrefs(p => switchVoiceForLanguage(setPreferredLanguage(p, result.detectedLanguage), result.detectedLanguage));
    setSaved(false);
  }, []);

  const handleVoiceChange = useCallback((field: keyof VoicePreference, value: string | number) => {
    setPrefs(p => updateVoicePreference(p, lang, { [field]: value }));
    setSaved(false);
  }, [lang]);

  const handleSave = useCallback(() => setSaved(true), []);

  const handleSpeak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clamped = clampVoicePreference(voicePref);
    const config = buildSpeechUtteranceConfig(text, lang, clamped);
    const utterance = new SpeechSynthesisUtterance(config.text);
    utterance.lang = config.lang;
    utterance.pitch = config.pitch;
    utterance.rate = config.rate;
    utterance.volume = config.volume;
    setSpeaking(text);
    utterance.onend = () => setSpeaking(null);
    utterance.onerror = () => setSpeaking(null);
    window.speechSynthesis.speak(utterance);
  }, [lang, voicePref]);

  const handleTestPhrase = useCallback((phrase: string) => {
    const result = translateText({ text: phrase, context: 'general', targetLanguage: lang });
    handleSpeak(result.translatedText);
  }, [lang, handleSpeak]);

  // ─── Render helpers ────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: 'language', label: 'Language' },
    { id: 'voice',    label: 'Voice' },
    { id: 'preview',  label: 'Preview' },
    { id: 'test',     label: 'Test' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">🌐 Language Settings</h1>
            <p className="text-gray-400 mt-1 text-sm">
              Multi-language AI engine — Sprint 13 · 8 languages supported
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl" title={info.name}>{info.flag}</span>
            <div>
              <div className="font-semibold">{info.name}</div>
              <div className="text-gray-400 text-sm" dir={dir}>{info.nativeName}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 mb-6" role="tablist">
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Language tab ──────────────────────────────────────────────────── */}
        {tab === 'language' && (
          <div className="space-y-6">
            {/* Auto-detect */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">Auto-Detect Language</div>
                  <div className="text-gray-400 text-sm">Detect from your browser settings</div>
                </div>
                <button
                  onClick={handleAutoDetect}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                >
                  Detect Now
                </button>
              </div>
              {detected && (
                <div className="text-sm text-blue-300 bg-blue-950 rounded-lg p-3 mt-2">{detected}</div>
              )}
              <div className="flex items-center gap-3 mt-3">
                <button
                  role="switch"
                  aria-checked={prefs.autoDetect}
                  onClick={() => setPrefs(p => setAutoDetect(p, !p.autoDetect))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    prefs.autoDetect ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.autoDetect ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm text-gray-300">
                  Auto-detect when opening the app
                </span>
              </div>
            </div>

            {/* Language grid */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Select Language</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {getSupportedLanguages().map(langInfo => (
                  <button
                    key={langInfo.code}
                    onClick={() => handleSelectLanguage(langInfo.code)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      lang === langInfo.code
                        ? 'border-blue-500 bg-blue-950'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-2xl mb-1">{langInfo.flag}</div>
                    <div className="font-medium text-sm">{langInfo.name}</div>
                    <div
                      className="text-gray-400 text-xs mt-0.5"
                      dir={langInfo.rtl ? 'rtl' : 'ltr'}
                    >
                      {langInfo.nativeName}
                    </div>
                    {langInfo.rtl && (
                      <div className="text-xs text-amber-400 mt-1">RTL</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy note */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-400 flex gap-2">
                <span>🔒</span>
                <span>{LANGUAGE_PRIVACY_NOTE}</span>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
              >
                Save Language
              </button>
              {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
            </div>
          </div>
        )}

        {/* ── Voice tab ─────────────────────────────────────────────────────── */}
        {tab === 'voice' && (
          <div className="space-y-6">
            {/* Auto switch */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 flex items-center justify-between">
              <div>
                <div className="font-semibold">Auto-Switch Voice</div>
                <div className="text-gray-400 text-sm">Automatically select the best voice when language changes</div>
              </div>
              <button
                role="switch"
                aria-checked={prefs.autoSwitchVoice}
                onClick={() => setPrefs(p => ({ ...p, autoSwitchVoice: !p.autoSwitchVoice }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  prefs.autoSwitchVoice ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.autoSwitchVoice ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {/* Voice selector */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <h2 className="font-semibold mb-3">Voice for {info.flag} {info.name}</h2>
              <div className="grid gap-2">
                {getVoicesForLanguage(lang).map(voice => (
                  <button
                    key={voice.id}
                    onClick={() => handleVoiceChange('voiceId', voice.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      voicePref.voiceId === voice.id
                        ? 'border-blue-500 bg-blue-950'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{voice.gender === 'female' ? '👩' : '👨'}</span>
                      <div>
                        <div className="font-medium text-sm">{voice.name}</div>
                        <div className="text-gray-400 text-xs">{voice.description}</div>
                      </div>
                      <span className="ml-auto text-xs text-gray-500 capitalize">{voice.style}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Pitch, Rate, Volume */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-5">
              <h2 className="font-semibold">Voice Parameters</h2>
              {([
                { key: 'pitch' as const, label: 'Pitch', min: 0.5, max: 2.0, step: 0.05 },
                { key: 'rate' as const,  label: 'Speed', min: 0.5, max: 2.0, step: 0.05 },
                { key: 'volume' as const, label: 'Volume', min: 0.0, max: 1.0, step: 0.05 },
              ] as const).map(({ key, label, min, max, step }) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{label}</span>
                    <span className="text-gray-400">{voicePref[key].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={voicePref[key]}
                    onChange={e => handleVoiceChange(key, parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                    aria-label={label}
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                    <span>{min}</span>
                    <span>{max}</span>
                  </div>
                </div>
              ))}

              {/* Accessibility presets */}
              <div>
                <div className="text-sm text-gray-400 mb-2">Quick presets</div>
                <div className="flex gap-2">
                  {(['slow', 'normal', 'fast'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => {
                        const adjusted = adjustRateForAccessibility(voicePref, mode);
                        handleVoiceChange('rate', adjusted.rate);
                      }}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm capitalize transition-colors"
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview button */}
            <button
              onClick={() => handleSpeak('I am here to help you navigate safely')}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
            >
              🔊 Preview Voice
            </button>
          </div>
        )}

        {/* ── Preview tab ───────────────────────────────────────────────────── */}
        {tab === 'preview' && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              Live translation preview — all phrases translated using the built-in dictionary.
            </p>

            {/* Guardian safety note */}
            <div className="bg-amber-950 border border-amber-700 rounded-xl p-4">
              <div className="text-sm text-amber-200 flex gap-2">
                <span>🛡</span>
                <span>{GUARDIAN_SAFETY_NOTE}</span>
              </div>
            </div>

            <div className="space-y-3">
              {PREVIEW_PHRASES.map(({ label, text, context }) => {
                const result = (() => {
                  switch (context) {
                    case 'hazard':     return translateHazardAlert(text, lang);
                    case 'navigation': return translateNavigationGuidance(text, lang);
                    case 'companion':  return translateCompanionSpeech(text, lang);
                    case 'ai':         return translateAIExplanation(text, lang);
                    default:           return translateText({ text, context: 'general', targetLanguage: lang });
                  }
                })();

                return (
                  <div key={text} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            context === 'hazard' ? 'bg-red-900 text-red-300' :
                            context === 'navigation' ? 'bg-blue-900 text-blue-300' :
                            context === 'companion' ? 'bg-purple-900 text-purple-300' :
                            'bg-gray-800 text-gray-400'
                          }`}>
                            {label}
                          </span>
                          {lang !== 'en' && (
                            <span className="text-xs text-gray-500">{info.flag} {info.nativeName}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 mb-1">EN: {result.originalText}</div>
                        <div
                          className="text-white font-medium"
                          dir={isRTL(lang) ? 'rtl' : 'ltr'}
                          lang={lang}
                        >
                          {result.translatedText}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSpeak(result.translatedText)}
                        disabled={speaking === result.translatedText}
                        className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                          speaking === result.translatedText
                            ? 'bg-blue-700 text-white'
                            : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                        }`}
                        aria-label={`Speak: ${result.translatedText}`}
                      >
                        {speaking === result.translatedText ? '⏸' : '▶'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Test tab ──────────────────────────────────────────────────────── */}
        {tab === 'test' && (
          <div className="space-y-6">
            <p className="text-gray-400 text-sm">
              Test how Denarixx speaks in {info.flag} {info.name}. Tap any phrase to hear it.
            </p>

            {/* Current language display */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <div className="text-4xl mb-2">{info.flag}</div>
              <div className="text-xl font-bold">{info.name}</div>
              <div className="text-gray-400" dir={dir}>{info.nativeName}</div>
              <div className="text-sm text-gray-500 mt-1">{info.voiceLang}</div>
              {isRTL(lang) && (
                <div className="mt-2 text-amber-400 text-sm">Right-to-left script</div>
              )}
            </div>

            {/* Test phrases */}
            <div className="grid grid-cols-2 gap-3">
              {TEST_PHRASES.map(({ label, text }) => {
                const result = translateText({ text, context: 'general', targetLanguage: lang });
                return (
                  <button
                    key={text}
                    onClick={() => handleTestPhrase(text)}
                    disabled={speaking === result.translatedText}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      speaking === result.translatedText
                        ? 'border-blue-500 bg-blue-950'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    <div className="text-sm text-gray-300 mb-1">{text}</div>
                    <div
                      className="text-white font-medium text-sm"
                      dir={dir}
                      lang={lang}
                    >
                      {result.translatedText}
                    </div>
                    <div className="text-2xl mt-2 text-center">
                      {speaking === result.translatedText ? '⏸' : '▶'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* All 8 languages test */}
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                &ldquo;Hazard ahead&rdquo; in all languages
              </h2>
              <div className="space-y-2">
                {SUPPORTED_LANGUAGES.map(code => {
                  const result = translateHazardAlert('Hazard ahead', code);
                  const li = LANGUAGE_REGISTRY[code];
                  return (
                    <button
                      key={code}
                      onClick={() => handleSpeak(result.translatedText)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-600 transition-colors text-left"
                    >
                      <span className="text-xl shrink-0">{li.flag}</span>
                      <div className="flex-1">
                        <span className="text-xs text-gray-500 mr-2">{li.name}</span>
                        <span
                          className="text-white"
                          dir={li.rtl ? 'rtl' : 'ltr'}
                          lang={code}
                        >
                          {result.translatedText}
                        </span>
                      </div>
                      <span className="text-gray-500 text-sm shrink-0">▶</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Sprint 13 — Speech Language Engine (pure functional, no async, no I/O)
// Manages per-language voice options, voice preferences, and voice switching.

import type {
  SupportedLanguage,
  VoiceOption,
  VoicePreference,
  LanguagePreferences,
  SpeechUtteranceConfig,
} from '@/types/language';
import { SUPPORTED_LANGUAGES } from '@/types/language';
import { getVoiceLangCode, isRTL } from './languageEngine';

// ─── Voice registry ───────────────────────────────────────────────────────────
// Each language has 2–3 simulated voice options.
// In production these map to Web Speech API SpeechSynthesisVoice objects.

export const VOICE_OPTIONS: Record<SupportedLanguage, VoiceOption[]> = {
  en: [
    { id: 'en-female-natural', name: 'Alice', language: 'en', gender: 'female', style: 'natural', description: 'Warm, natural British female voice' },
    { id: 'en-male-clear',     name: 'Daniel', language: 'en', gender: 'male', style: 'clear', description: 'Clear, articulate British male voice' },
    { id: 'en-female-formal',  name: 'Karen', language: 'en', gender: 'female', style: 'formal', description: 'Formal, professional female voice' },
  ],
  de: [
    { id: 'de-female-natural', name: 'Anna',   language: 'de', gender: 'female', style: 'natural', description: 'Natürliche deutsche Frauenstimme' },
    { id: 'de-male-clear',     name: 'Stefan', language: 'de', gender: 'male', style: 'clear', description: 'Klare deutsche Männerstimme' },
  ],
  fr: [
    { id: 'fr-female-natural', name: 'Marie',   language: 'fr', gender: 'female', style: 'natural', description: 'Voix féminine française naturelle' },
    { id: 'fr-male-clear',     name: 'Thomas', language: 'fr', gender: 'male', style: 'clear', description: 'Voix masculine française claire' },
  ],
  es: [
    { id: 'es-female-natural', name: 'Lucía',  language: 'es', gender: 'female', style: 'natural', description: 'Voz femenina española natural' },
    { id: 'es-male-clear',     name: 'Carlos', language: 'es', gender: 'male', style: 'clear', description: 'Voz masculina española clara' },
  ],
  it: [
    { id: 'it-female-natural', name: 'Giulia', language: 'it', gender: 'female', style: 'natural', description: 'Voce femminile italiana naturale' },
    { id: 'it-male-clear',     name: 'Luca',   language: 'it', gender: 'male', style: 'clear', description: 'Voce maschile italiana chiara' },
  ],
  pt: [
    { id: 'pt-female-natural', name: 'Sofia',  language: 'pt', gender: 'female', style: 'natural', description: 'Voz feminina portuguesa natural' },
    { id: 'pt-male-clear',     name: 'Diogo',  language: 'pt', gender: 'male', style: 'clear', description: 'Voz masculina portuguesa clara' },
  ],
  ar: [
    { id: 'ar-female-natural', name: 'Layla',  language: 'ar', gender: 'female', style: 'natural', description: 'صوت نسائي عربي طبيعي' },
    { id: 'ar-male-clear',     name: 'Omar',   language: 'ar', gender: 'male', style: 'clear', description: 'صوت ذكوري عربي واضح' },
  ],
  sw: [
    { id: 'sw-female-natural', name: 'Amina',  language: 'sw', gender: 'female', style: 'natural', description: 'Sauti ya asili ya kike ya Kiswahili' },
    { id: 'sw-male-clear',     name: 'Juma',   language: 'sw', gender: 'male', style: 'clear', description: 'Sauti ya wazi ya kiume ya Kiswahili' },
  ],
};

// ─── Registry queries ─────────────────────────────────────────────────────────

export function getVoicesForLanguage(lang: SupportedLanguage): VoiceOption[] {
  return VOICE_OPTIONS[lang] ?? [];
}

export function getVoiceById(lang: SupportedLanguage, voiceId: string): VoiceOption | null {
  return VOICE_OPTIONS[lang]?.find(v => v.id === voiceId) ?? null;
}

export function getDefaultVoice(lang: SupportedLanguage): VoiceOption {
  return VOICE_OPTIONS[lang]?.[0] ?? {
    id: `${lang}-default`,
    name: 'Default',
    language: lang,
    gender: 'neutral',
    style: 'natural',
    description: 'Default voice',
  };
}

export function getAllVoices(): VoiceOption[] {
  return SUPPORTED_LANGUAGES.flatMap(lang => VOICE_OPTIONS[lang] ?? []);
}

export function getVoicesByGender(gender: VoiceOption['gender']): VoiceOption[] {
  return getAllVoices().filter(v => v.gender === gender);
}

export function getVoicesByStyle(style: VoiceOption['style']): VoiceOption[] {
  return getAllVoices().filter(v => v.style === style);
}

// ─── Voice preference helpers ─────────────────────────────────────────────────

export function buildVoicePreference(
  lang: SupportedLanguage,
  voiceId?: string,
  overrides?: Partial<VoicePreference>,
): VoicePreference {
  const defaultVoice = getDefaultVoice(lang);
  return {
    language: lang,
    voiceId: voiceId ?? defaultVoice.id,
    pitch: 1.0,
    rate: 1.0,
    volume: 1.0,
    ...overrides,
  };
}

export function selectBestVoice(
  lang: SupportedLanguage,
  preference?: Partial<VoicePreference>,
): VoiceOption {
  const voices = getVoicesForLanguage(lang);
  if (!preference?.voiceId) return getDefaultVoice(lang);
  return voices.find(v => v.id === preference.voiceId) ?? getDefaultVoice(lang);
}

// ─── Voice switching ──────────────────────────────────────────────────────────

/**
 * Updates LanguagePreferences to auto-switch voice when language changes.
 * If autoSwitchVoice is false, only the language is changed.
 */
export function switchVoiceForLanguage(
  prefs: LanguagePreferences,
  newLang: SupportedLanguage,
): LanguagePreferences {
  const updated = { ...prefs, preferredLanguage: newLang };
  if (!prefs.autoSwitchVoice) return updated;

  // Preserve existing voice preference if it exists and is valid
  const existing = prefs.voicePreferences[newLang];
  if (existing && getVoiceById(newLang, existing.voiceId)) return updated;

  // Assign default voice for the new language
  const defaultVoice = getDefaultVoice(newLang);
  return {
    ...updated,
    voicePreferences: {
      ...prefs.voicePreferences,
      [newLang]: buildVoicePreference(newLang, defaultVoice.id),
    },
  };
}

// ─── Speech utterance config ──────────────────────────────────────────────────

/**
 * Builds the config object needed to invoke the Web Speech API.
 * Pure function — no DOM access.
 */
export function buildSpeechUtteranceConfig(
  text: string,
  lang: SupportedLanguage,
  pref: VoicePreference,
): SpeechUtteranceConfig {
  return {
    text,
    lang: getVoiceLangCode(lang),
    pitch: clamp(pref.pitch, 0.5, 2.0),
    rate: clamp(pref.rate, 0.5, 2.0),
    volume: clamp(pref.volume, 0.0, 1.0),
    voiceId: pref.voiceId,
  };
}

/**
 * Adjusts speech rate for accessibility.
 * Slow speech for blind/low-vision users; faster for advanced users.
 */
export function adjustRateForAccessibility(
  pref: VoicePreference,
  mode: 'slow' | 'normal' | 'fast',
): VoicePreference {
  const rates = { slow: 0.75, normal: 1.0, fast: 1.35 };
  return { ...pref, rate: rates[mode] };
}

/**
 * Validates and clamps voice preference values to safe ranges.
 */
export function clampVoicePreference(pref: VoicePreference): VoicePreference {
  return {
    ...pref,
    pitch: clamp(pref.pitch, 0.5, 2.0),
    rate: clamp(pref.rate, 0.5, 2.0),
    volume: clamp(pref.volume, 0.0, 1.0),
  };
}

/**
 * Returns the CSS `direction` value for the given language.
 */
export function getDirectionForLanguage(lang: SupportedLanguage): 'rtl' | 'ltr' {
  return isRTL(lang) ? 'rtl' : 'ltr';
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

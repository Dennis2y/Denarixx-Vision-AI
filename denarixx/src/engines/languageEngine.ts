// Sprint 13 — Language Engine (pure functional, no async, no I/O)
// Core language registry, preference management, and language utilities.

import type {
  SupportedLanguage,
  LanguageInfo,
  LanguagePreferences,
  VoicePreference,
  LanguageDetectionResult,
} from '@/types/language';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_DEFAULTS,
  VOICE_DEFAULTS,
} from '@/types/language';

// ─── Language registry ────────────────────────────────────────────────────────

export const LANGUAGE_REGISTRY: Record<SupportedLanguage, LanguageInfo> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    rtl: false,
    flag: '🇬🇧',
    voiceLang: 'en-GB',
    region: 'GB',
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    rtl: false,
    flag: '🇩🇪',
    voiceLang: 'de-DE',
    region: 'DE',
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    rtl: false,
    flag: '🇫🇷',
    voiceLang: 'fr-FR',
    region: 'FR',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    rtl: false,
    flag: '🇪🇸',
    voiceLang: 'es-ES',
    region: 'ES',
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    rtl: false,
    flag: '🇮🇹',
    voiceLang: 'it-IT',
    region: 'IT',
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    rtl: false,
    flag: '🇵🇹',
    voiceLang: 'pt-PT',
    region: 'PT',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    rtl: true,
    flag: '🇸🇦',
    voiceLang: 'ar-SA',
    region: 'SA',
  },
  sw: {
    code: 'sw',
    name: 'Swahili',
    nativeName: 'Kiswahili',
    rtl: false,
    flag: '🇰🇪',
    voiceLang: 'sw-KE',
    region: 'KE',
  },
};

// ─── Registry queries ─────────────────────────────────────────────────────────

export function getLanguageInfo(lang: SupportedLanguage): LanguageInfo {
  return LANGUAGE_REGISTRY[lang];
}

export function getSupportedLanguages(): LanguageInfo[] {
  return SUPPORTED_LANGUAGES.map(code => LANGUAGE_REGISTRY[code]);
}

export function isRTL(lang: SupportedLanguage): boolean {
  return LANGUAGE_REGISTRY[lang].rtl;
}

export function getLanguageName(lang: SupportedLanguage): string {
  return LANGUAGE_REGISTRY[lang].name;
}

export function getNativeName(lang: SupportedLanguage): string {
  return LANGUAGE_REGISTRY[lang].nativeName;
}

export function getVoiceLangCode(lang: SupportedLanguage): string {
  return LANGUAGE_REGISTRY[lang].voiceLang;
}

export function getFlag(lang: SupportedLanguage): string {
  return LANGUAGE_REGISTRY[lang].flag;
}

export function isLanguageSupported(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as string[]).includes(code);
}

// ─── Default voice preferences ────────────────────────────────────────────────

export function buildDefaultVoicePreferences(): Record<SupportedLanguage, VoicePreference> {
  const record = {} as Record<SupportedLanguage, VoicePreference>;
  for (const lang of SUPPORTED_LANGUAGES) {
    record[lang] = {
      ...VOICE_DEFAULTS,
      language: lang,
      voiceId: `${lang}-default`,
    };
  }
  return record;
}

// ─── Preference management ────────────────────────────────────────────────────

export function createDefaultPreferences(): LanguagePreferences {
  return {
    ...LANGUAGE_DEFAULTS,
    voicePreferences: buildDefaultVoicePreferences(),
  };
}

export function validatePreferences(
  partial: Partial<LanguagePreferences>,
): LanguagePreferences {
  const defaults = createDefaultPreferences();
  const lang: SupportedLanguage = isLanguageSupported(partial.preferredLanguage ?? '')
    ? (partial.preferredLanguage as SupportedLanguage)
    : defaults.preferredLanguage;
  const fallback: SupportedLanguage = isLanguageSupported(partial.fallbackLanguage ?? '')
    ? (partial.fallbackLanguage as SupportedLanguage)
    : defaults.fallbackLanguage;

  return {
    preferredLanguage: lang,
    autoDetect: partial.autoDetect ?? defaults.autoDetect,
    fallbackLanguage: fallback,
    voicePreferences: partial.voicePreferences ?? buildDefaultVoicePreferences(),
    autoSwitchVoice: partial.autoSwitchVoice ?? defaults.autoSwitchVoice,
    guardianLanguage: 'en', // immutable — always English for safety decisions
    translateHazardsImmediately: partial.translateHazardsImmediately ?? defaults.translateHazardsImmediately,
  };
}

export function setPreferredLanguage(
  prefs: LanguagePreferences,
  lang: SupportedLanguage,
): LanguagePreferences {
  return { ...prefs, preferredLanguage: lang };
}

export function setAutoDetect(
  prefs: LanguagePreferences,
  enabled: boolean,
): LanguagePreferences {
  return { ...prefs, autoDetect: enabled };
}

export function setFallbackLanguage(
  prefs: LanguagePreferences,
  lang: SupportedLanguage,
): LanguagePreferences {
  return { ...prefs, fallbackLanguage: lang };
}

export function applyAutoDetect(
  prefs: LanguagePreferences,
  detected: LanguageDetectionResult,
): LanguagePreferences {
  if (!prefs.autoDetect) return prefs;
  if (detected.confidence < 0.5) return prefs;
  return { ...prefs, preferredLanguage: detected.detectedLanguage };
}

export function updateVoicePreference(
  prefs: LanguagePreferences,
  lang: SupportedLanguage,
  voice: Partial<VoicePreference>,
): LanguagePreferences {
  return {
    ...prefs,
    voicePreferences: {
      ...prefs.voicePreferences,
      [lang]: { ...prefs.voicePreferences[lang], ...voice },
    },
  };
}

export function getVoicePreferenceForLanguage(
  prefs: LanguagePreferences,
  lang: SupportedLanguage,
): VoicePreference {
  return prefs.voicePreferences[lang] ?? { ...VOICE_DEFAULTS, language: lang, voiceId: `${lang}-default` };
}

// ─── RTL helpers ──────────────────────────────────────────────────────────────

export function getTextDirection(lang: SupportedLanguage): 'rtl' | 'ltr' {
  return isRTL(lang) ? 'rtl' : 'ltr';
}

export function getCssClass(lang: SupportedLanguage): string {
  return isRTL(lang) ? 'lang-rtl' : 'lang-ltr';
}

// ─── Language diff ────────────────────────────────────────────────────────────

export interface LanguageDiff {
  languageChanged: boolean;
  voiceChanged: boolean;
  fromLanguage: SupportedLanguage;
  toLanguage: SupportedLanguage;
  requiresVoiceSwitch: boolean;
}

export function diffLanguagePreferences(
  prev: LanguagePreferences,
  next: LanguagePreferences,
): LanguageDiff {
  const languageChanged = prev.preferredLanguage !== next.preferredLanguage;
  const prevVoice = prev.voicePreferences[prev.preferredLanguage];
  const nextVoice = next.voicePreferences[next.preferredLanguage];
  const voiceChanged = prevVoice?.voiceId !== nextVoice?.voiceId
    || prevVoice?.pitch !== nextVoice?.pitch
    || prevVoice?.rate !== nextVoice?.rate;

  return {
    languageChanged,
    voiceChanged,
    fromLanguage: prev.preferredLanguage,
    toLanguage: next.preferredLanguage,
    requiresVoiceSwitch: languageChanged && next.autoSwitchVoice,
  };
}

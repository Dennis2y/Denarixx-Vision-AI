// Sprint 13 — Language Detection Engine (pure functional, no async, no I/O)
// Infers the user's language from browser locale or sample text.

import type {
  SupportedLanguage,
  LanguageDetectionResult,
  DetectionMethod,
} from '@/types/language';
import { SUPPORTED_LANGUAGES } from '@/types/language';

// ─── Locale → language map ────────────────────────────────────────────────────

const LOCALE_MAP: Record<string, SupportedLanguage> = {
  // English
  en: 'en', 'en-us': 'en', 'en-gb': 'en', 'en-au': 'en', 'en-ca': 'en',
  'en-nz': 'en', 'en-ie': 'en', 'en-za': 'en', 'en-in': 'en',
  // German
  de: 'de', 'de-de': 'de', 'de-at': 'de', 'de-ch': 'de',
  // French
  fr: 'fr', 'fr-fr': 'fr', 'fr-be': 'fr', 'fr-ch': 'fr', 'fr-ca': 'fr',
  // Spanish
  es: 'es', 'es-es': 'es', 'es-mx': 'es', 'es-ar': 'es', 'es-co': 'es',
  'es-cl': 'es', 'es-pe': 'es', 'es-ve': 'es', 'es-419': 'es',
  // Italian
  it: 'it', 'it-it': 'it', 'it-ch': 'it',
  // Portuguese
  pt: 'pt', 'pt-pt': 'pt', 'pt-br': 'pt',
  // Arabic
  ar: 'ar', 'ar-sa': 'ar', 'ar-eg': 'ar', 'ar-ma': 'ar', 'ar-dz': 'ar',
  'ar-tn': 'ar', 'ar-ly': 'ar', 'ar-ae': 'ar', 'ar-jo': 'ar',
  // Swahili
  sw: 'sw', 'sw-ke': 'sw', 'sw-tz': 'sw', 'sw-ug': 'sw',
};

// ─── Text-analysis markers ────────────────────────────────────────────────────
// High-frequency, language-specific words used to identify language from a
// small text sample. Confidence is proportional to match count.

const TEXT_MARKERS: Array<{ language: SupportedLanguage; words: string[] }> = [
  { language: 'de', words: ['und', 'die', 'der', 'ist', 'nicht', 'ich', 'das', 'ein', 'mit', 'auf'] },
  { language: 'fr', words: ['le', 'la', 'les', 'est', 'pas', 'je', 'un', 'une', 'que', 'sont'] },
  { language: 'es', words: ['el', 'la', 'los', 'las', 'es', 'no', 'yo', 'que', 'una', 'con'] },
  { language: 'it', words: ['il', 'la', 'le', 'è', 'non', 'io', 'un', 'una', 'che', 'con'] },
  { language: 'pt', words: ['o', 'a', 'os', 'as', 'é', 'não', 'eu', 'um', 'uma', 'com'] },
  { language: 'ar', words: ['في', 'من', 'إلى', 'على', 'هو', 'هي', 'أن', 'مع', 'ما', 'لا'] },
  { language: 'sw', words: ['na', 'ya', 'kwa', 'ni', 'wa', 'la', 'hii', 'hata', 'sana', 'mtu'] },
  { language: 'en', words: ['the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'was'] },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Maps a BCP-47 locale string to a supported language code.
 * Returns null when the locale is not in the supported set.
 */
export function mapLocaleToLanguage(locale: string): SupportedLanguage | null {
  const normalised = locale.toLowerCase().trim();
  // Try exact match first
  if (LOCALE_MAP[normalised]) return LOCALE_MAP[normalised];
  // Try primary subtag only (e.g. "en-US" → "en")
  const primary = normalised.split('-')[0];
  return LOCALE_MAP[primary] ?? null;
}

/**
 * Detects language from a BCP-47 locale string (e.g. from navigator.language).
 */
export function detectFromLocale(locale: string): LanguageDetectionResult {
  const mapped = mapLocaleToLanguage(locale);
  if (mapped) {
    return {
      detectedLanguage: mapped,
      confidence: 0.95,
      method: 'browser',
      rawLocale: locale,
    };
  }
  return {
    detectedLanguage: 'en',
    confidence: 0.3,
    method: 'fallback',
    rawLocale: locale,
  };
}

/**
 * Detects language from a text sample using frequency analysis.
 * Works with as few as 5 words; more text → higher confidence.
 */
export function detectFromText(text: string): LanguageDetectionResult {
  if (!text || text.trim().length === 0) {
    return { detectedLanguage: 'en', confidence: 0.3, method: 'fallback' };
  }

  // Check for Arabic script characters
  const arabicScript = /[\u0600-\u06FF]/.test(text);
  if (arabicScript) {
    return { detectedLanguage: 'ar', confidence: 0.98, method: 'text_analysis' };
  }

  const words = text
    .toLowerCase()
    .replace(/[^a-zàáâäèéêëìíîïòóôöùúûüÿçñäöü\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (words.length === 0) {
    return { detectedLanguage: 'en', confidence: 0.3, method: 'fallback' };
  }

  const wordSet = new Set(words);
  let bestLang: SupportedLanguage = 'en';
  let bestScore = 0;

  for (const { language, words: markers } of TEXT_MARKERS) {
    const hits = markers.filter(m => wordSet.has(m)).length;
    const score = hits / markers.length;
    if (score > bestScore) {
      bestScore = score;
      bestLang = language;
    }
  }

  const confidence = Math.min(0.3 + bestScore * 0.7, 0.9);
  const method: DetectionMethod = bestScore > 0 ? 'text_analysis' : 'fallback';

  return { detectedLanguage: bestLang, confidence, method };
}

/**
 * Combined detection: prefers locale when available and confident;
 * falls back to text analysis.
 */
export function detectLanguage(
  locale?: string,
  sampleText?: string,
): LanguageDetectionResult {
  if (locale) {
    const localeResult = detectFromLocale(locale);
    if (localeResult.confidence >= 0.8) return localeResult;

    if (sampleText) {
      const textResult = detectFromText(sampleText);
      if (textResult.confidence > localeResult.confidence) return textResult;
      return localeResult;
    }
    return localeResult;
  }

  if (sampleText) return detectFromText(sampleText);

  return { detectedLanguage: 'en', confidence: 0.3, method: 'fallback' };
}

/**
 * Returns whether a string is a recognised supported language code.
 */
export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as string[]).includes(code);
}

/**
 * Selects the best language from a browser's navigator.languages array.
 */
export function detectFromLanguageList(languages: readonly string[]): LanguageDetectionResult {
  for (const locale of languages) {
    const mapped = mapLocaleToLanguage(locale);
    if (mapped) {
      return {
        detectedLanguage: mapped,
        confidence: 0.9,
        method: 'browser',
        rawLocale: locale,
      };
    }
  }
  return { detectedLanguage: 'en', confidence: 0.3, method: 'fallback' };
}

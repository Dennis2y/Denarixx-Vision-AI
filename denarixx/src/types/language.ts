// Sprint 13 — Language Types (pure types, no I/O)
// Separate file — never merge with index.ts or other type files.

// ─── Supported languages ───────────────────────────────────────────────────────

export type SupportedLanguage =
  | 'en'   // English
  | 'de'   // German
  | 'fr'   // French
  | 'es'   // Spanish
  | 'it'   // Italian
  | 'pt'   // Portuguese
  | 'ar'   // Arabic
  | 'sw';  // Swahili

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'en', 'de', 'fr', 'es', 'it', 'pt', 'ar', 'sw',
];

// ─── Language info ────────────────────────────────────────────────────────────

export interface LanguageInfo {
  code: SupportedLanguage;
  /** English name */
  name: string;
  /** Name in that language */
  nativeName: string;
  /** Right-to-left script */
  rtl: boolean;
  /** Emoji flag */
  flag: string;
  /** BCP-47 language tag for Web Speech API */
  voiceLang: string;
  /** ISO 3166-1 region */
  region: string;
}

// ─── Translation ──────────────────────────────────────────────────────────────

export type TranslationContext =
  | 'scene'        // Scene descriptions
  | 'hazard'       // Hazard alerts — time-critical, must never be delayed
  | 'navigation'   // Navigation guidance
  | 'companion'    // Companion speech
  | 'memory'       // Memory summaries
  | 'ai'           // Explainable AI output
  | 'trust'        // Trust messages
  | 'settings'     // Settings labels
  | 'general';     // General purpose

export interface TranslationInput {
  text: string;
  context: TranslationContext;
  sourceLanguage?: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  /** Critical hazard alerts must resolve synchronously — no async look-up */
  isCritical?: boolean;
}

export interface TranslationOutput {
  originalText: string;
  translatedText: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  context: TranslationContext;
  /** True when using built-in phrase dictionary (Phase 1 simulation) */
  wasSimulated: boolean;
  latencyMs: number;
  timestamp: number;
}

// ─── Voice ────────────────────────────────────────────────────────────────────

export type VoiceGender = 'male' | 'female' | 'neutral';
export type VoiceStyle  = 'natural' | 'clear' | 'formal';

export interface VoiceOption {
  id: string;
  name: string;
  language: SupportedLanguage;
  gender: VoiceGender;
  style: VoiceStyle;
  description: string;
}

export interface VoicePreference {
  language: SupportedLanguage;
  voiceId: string;
  pitch: number;   // 0.5–2.0
  rate: number;    // 0.5–2.0
  volume: number;  // 0.0–1.0
}

// ─── Language preferences ─────────────────────────────────────────────────────

export interface LanguagePreferences {
  preferredLanguage: SupportedLanguage;
  autoDetect: boolean;
  fallbackLanguage: SupportedLanguage;
  voicePreferences: Record<SupportedLanguage, VoicePreference>;
  autoSwitchVoice: boolean;
  /**
   * Guardian always generates safety decisions in English first,
   * then the result is translated for presentation.
   * This field is read-only — always 'en'.
   */
  guardianLanguage: 'en';
  translateHazardsImmediately: boolean;
}

// ─── Language detection ───────────────────────────────────────────────────────

export type DetectionMethod = 'browser' | 'text_analysis' | 'manual' | 'fallback';

export interface LanguageDetectionResult {
  detectedLanguage: SupportedLanguage;
  confidence: number;  // 0–1
  method: DetectionMethod;
  rawLocale?: string;
}

// ─── Speech utterance config ──────────────────────────────────────────────────

export interface SpeechUtteranceConfig {
  text: string;
  lang: string;   // BCP-47
  pitch: number;
  rate: number;
  volume: number;
  voiceId: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const LANGUAGE_DEFAULTS: Omit<LanguagePreferences, 'voicePreferences'> = {
  preferredLanguage: 'en',
  autoDetect: true,
  fallbackLanguage: 'en',
  autoSwitchVoice: true,
  guardianLanguage: 'en',
  translateHazardsImmediately: true,
};

export const VOICE_DEFAULTS: VoicePreference = {
  language: 'en',
  voiceId: 'en-default',
  pitch: 1.0,
  rate: 1.0,
  volume: 1.0,
};

/** Privacy note: no user text is sent to external servers in simulation mode */
export const LANGUAGE_PRIVACY_NOTE =
  'Translation runs locally using a built-in phrase dictionary. ' +
  'No text is sent to external servers unless you opt in to cloud translation.';

/** Safety guarantee */
export const GUARDIAN_SAFETY_NOTE =
  'Critical safety decisions are always generated in English first by the ' +
  'Cognitive Guardian, then translated for presentation. ' +
  'Translation never delays a critical alert.';

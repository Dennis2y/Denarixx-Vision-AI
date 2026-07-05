// Sprint 11 — Accessibility & Personal Preferences — type definitions
// Separate from all other type files. Never merge into index.ts, companion.ts, etc.

import type { PersonalityMode } from '@/types/companion';

// ─── Core enumerations ────────────────────────────────────────────────────────

export type AccessibilityMode =
  | 'standard'
  | 'blind'
  | 'low_vision'
  | 'hearing_impaired'
  | 'one_hand';

export type ContrastMode = 'standard' | 'high_contrast' | 'dark_high' | 'monochrome';

export type TextSize = 'standard' | 'large' | 'extra_large';

export type IndoorGuidanceStyle = 'minimal' | 'standard' | 'detailed' | 'spatial';

export type OutdoorGuidanceStyle = 'minimal' | 'standard' | 'full' | 'explorer';

export type VibrationIntensity = 'off' | 'light' | 'medium' | 'strong';

export type SilenceMode = 'never' | 'auto' | 'always';

export type RepeatMode = 'never' | 'critical_only' | 'all_alerts';

export type DistanceUnit = 'metres' | 'feet' | 'steps';

// ─── Preference groups ────────────────────────────────────────────────────────

export interface AudioPreferences {
  /** Web Speech API rate: 0.5 (slow) – 2.0 (fast) */
  speechRate: number;
  /** 0–1 overall speech volume */
  speechVolume: number;
  /** 0–1 alert tone volume */
  alertVolume: number;
  /** SpeechSynthesisVoice.name — empty = system default */
  voiceName: string;
  guidanceVerbosity: 'brief' | 'normal' | 'verbose';
  repeatReminders: RepeatMode;
  automaticSilence: SilenceMode;
  confidenceAnnouncements: 'always' | 'when_low' | 'never';
  /** Short audio tones accompanying visual alerts */
  earconAlerts: boolean;
}

export interface HapticPreferences {
  hapticEnabled: boolean;
  vibrationIntensity: VibrationIntensity;
  /** Vibrate on critical/high alerts */
  hapticForCritical: boolean;
  /** Vibrate on turn-by-turn navigation instructions */
  hapticForNavigation: boolean;
  /** Gentle pulse for companion reassurance messages */
  hapticForReassurance: boolean;
}

export interface NavigationPreferences {
  navigationDetail: 'minimal' | 'standard' | 'rich';
  indoorGuidanceStyle: IndoorGuidanceStyle;
  outdoorGuidanceStyle: OutdoorGuidanceStyle;
  landmarkAnnouncements: boolean;
  distanceUnit: DistanceUnit;
  /** Always give extra detail at road crossings */
  crossingExtraWarning: boolean;
}

export interface AlertPreferences {
  alertFrequency: 'low' | 'medium' | 'high';
  hazardSensitivity: 'low' | 'medium' | 'high';
  criticalAlertRepeat: boolean;
  /** Never speak alerts below medium risk */
  silentLowRisk: boolean;
}

export interface DisplayPreferences {
  contrastMode: ContrastMode;
  textSize: TextSize;
  highContrastMode: boolean;
  reducedMotion: boolean;
  colorBlindFriendly: boolean;
  screenReaderOptimised: boolean;
}

// ─── Full user preference profile ────────────────────────────────────────────

export interface UserPreferences {
  version: number;
  accessibilityMode: AccessibilityMode;
  personalityMode: PersonalityMode;
  audio: AudioPreferences;
  haptic: HapticPreferences;
  navigation: NavigationPreferences;
  alert: AlertPreferences;
  display: DisplayPreferences;
  lastUpdated: string;
}

// ─── Accessibility preset ────────────────────────────────────────────────────

export interface AccessibilityPreset {
  id: AccessibilityMode;
  name: string;
  description: string;
  icon: string;
  overrides: DeepPartial<Omit<UserPreferences, 'version' | 'lastUpdated'>>;
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ─── Haptic pattern descriptor ────────────────────────────────────────────────

export interface HapticPattern {
  name: string;
  /** Vibration pattern in ms: [on, off, on, …] */
  pattern: number[];
  /** Intensity label for display */
  intensityLabel: VibrationIntensity;
}

// ─── Preference change event (for live preview) ───────────────────────────────

export interface PreferenceChangeEvent {
  group: 'audio' | 'haptic' | 'navigation' | 'alert' | 'display' | 'personality' | 'accessibility';
  key: string;
  oldValue: unknown;
  newValue: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PREFERENCES_VERSION = 1;
export const PREFERENCES_STORAGE_KEY = 'denarixx_preferences_v1';

export const DEFAULT_AUDIO: AudioPreferences = {
  speechRate: 1.0,
  speechVolume: 1.0,
  alertVolume: 1.0,
  voiceName: '',
  guidanceVerbosity: 'normal',
  repeatReminders: 'critical_only',
  automaticSilence: 'never',
  confidenceAnnouncements: 'when_low',
  earconAlerts: false,
};

export const DEFAULT_HAPTIC: HapticPreferences = {
  hapticEnabled: true,
  vibrationIntensity: 'medium',
  hapticForCritical: true,
  hapticForNavigation: true,
  hapticForReassurance: false,
};

export const DEFAULT_NAVIGATION: NavigationPreferences = {
  navigationDetail: 'standard',
  indoorGuidanceStyle: 'standard',
  outdoorGuidanceStyle: 'standard',
  landmarkAnnouncements: true,
  distanceUnit: 'metres',
  crossingExtraWarning: true,
};

export const DEFAULT_ALERT: AlertPreferences = {
  alertFrequency: 'medium',
  hazardSensitivity: 'medium',
  criticalAlertRepeat: true,
  silentLowRisk: false,
};

export const DEFAULT_DISPLAY: DisplayPreferences = {
  contrastMode: 'standard',
  textSize: 'standard',
  highContrastMode: false,
  reducedMotion: false,
  colorBlindFriendly: false,
  screenReaderOptimised: false,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  version: PREFERENCES_VERSION,
  accessibilityMode: 'standard',
  personalityMode: 'balanced',
  audio: { ...DEFAULT_AUDIO },
  haptic: { ...DEFAULT_HAPTIC },
  navigation: { ...DEFAULT_NAVIGATION },
  alert: { ...DEFAULT_ALERT },
  display: { ...DEFAULT_DISPLAY },
  lastUpdated: '',
};

export const PREFERENCES_PRIVACY_NOTE =
  'All preferences are stored locally on this device. No personal data is shared externally.';

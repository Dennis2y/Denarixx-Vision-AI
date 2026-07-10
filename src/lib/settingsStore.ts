/**
 * settingsStore — persistent app settings via localStorage.
 *
 * Server-safe: all operations guard against SSR (typeof window === 'undefined').
 * Used by the Settings page and the session hook.
 *
 * V7: adds SensorSettings fields to AppSettings.
 * V10: adds highContrastMode, reducedMotion, fullscreenWalkingMode.
 */

import type { GuidancePersonality } from '@/engines/guidancePersonalityEngine';
import type { LocationPrivacyLevel } from '@/types/sensors';

export type { GuidancePersonality };

export interface AppSettings {
  /** Speech synthesis rate: 0.5 = slow, 2.0 = fast */
  speechRate: number;
  /** Speech synthesis volume: 0 = silent, 1 = full */
  speechVolume: number;
  /** Alert tone volume separate from speech: 0–1 */
  alertVolume: number;
  /** SpeechSynthesisVoice.name — empty string = system default */
  voiceName: string;
  /** How much personality / warmth in voice output */
  guidancePersonality: GuidancePersonality;
  /** How much detail per alert */
  alertVerbosity: 'minimal' | 'standard' | 'full';
  /** How aggressively hazards are flagged */
  hazardSensitivity: 'low' | 'medium' | 'high';
  /** Auto-repeat critical alerts after 10 s if still active */
  repeatCriticalAlerts: boolean;
  // ── V7: Sensor & Privacy settings ───────────────────────────────────────
  /** Whether to request GPS at all */
  locationEnabled: boolean;
  /** GPS coordinate precision */
  locationPrecision: LocationPrivacyLevel;
  /** Whether to store locations to AI memory */
  locationMemoryEnabled: boolean;
  /** Whether to request DeviceMotion / DeviceOrientation */
  motionEnabled: boolean;
  /** Whether to use navigator.vibrate for haptic alerts */
  vibrationEnabled: boolean;
  /** Reduce frame rate + audio when battery < 20% */
  batteryAwareMode: boolean;
  // ── V10: Mobile / Accessibility settings ────────────────────────────────────
  /** Apply CSS high-contrast class globally */
  highContrastMode: boolean;
  /** Disable CSS transitions and animations globally */
  reducedMotion: boolean;
  /** Automatically enter fullscreen walking overlay when session starts */
  fullscreenWalkingMode: boolean;
}

const DEFAULTS: AppSettings = {
  speechRate: 1.0,
  speechVolume: 1.0,
  alertVolume: 1.0,
  voiceName: '',
  guidancePersonality: 'balanced',
  alertVerbosity: 'standard',
  hazardSensitivity: 'medium',
  repeatCriticalAlerts: true,
  // V7 sensor defaults
  locationEnabled: false,
  locationPrecision: 'fuzzy',
  locationMemoryEnabled: false,
  motionEnabled: true,
  vibrationEnabled: true,
  batteryAwareMode: true,
  // V10 mobile / accessibility defaults
  highContrastMode: false,
  reducedMotion: false,
  fullscreenWalkingMode: false,
};

const STORAGE_KEY = 'denarixx_settings';

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const updated = { ...current, ...patch };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage quota or privacy mode — silently ignore
    }
  }
  return updated;
}

export function resetSettings(): AppSettings {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return { ...DEFAULTS };
}

export { DEFAULTS as SETTINGS_DEFAULTS };

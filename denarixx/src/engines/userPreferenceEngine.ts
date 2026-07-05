// Sprint 11 — User Preference Engine (pure functional, no async, no I/O)
// Save/load preferences, merge updates, validate, and derive bridged AppSettings.

import type {
  UserPreferences,
  AudioPreferences,
  HapticPreferences,
  NavigationPreferences,
  AlertPreferences,
  DisplayPreferences,
  AccessibilityMode,
  PreferenceChangeEvent,
} from '@/types/preferences';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_VERSION,
  PREFERENCES_STORAGE_KEY,
} from '@/types/preferences';
import type { PersonalityMode } from '@/types/companion';

// ─── Create & clone ───────────────────────────────────────────────────────────

export function createDefaultPreferences(): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    audio: { ...DEFAULT_PREFERENCES.audio },
    haptic: { ...DEFAULT_PREFERENCES.haptic },
    navigation: { ...DEFAULT_PREFERENCES.navigation },
    alert: { ...DEFAULT_PREFERENCES.alert },
    display: { ...DEFAULT_PREFERENCES.display },
    lastUpdated: new Date().toISOString(),
  };
}

export function clonePreferences(prefs: UserPreferences): UserPreferences {
  return {
    ...prefs,
    audio: { ...prefs.audio },
    haptic: { ...prefs.haptic },
    navigation: { ...prefs.navigation },
    alert: { ...prefs.alert },
    display: { ...prefs.display },
  };
}

// ─── Partial update helpers ───────────────────────────────────────────────────

export function updateAudio(
  prefs: UserPreferences,
  changes: Partial<AudioPreferences>,
): UserPreferences {
  return {
    ...prefs,
    audio: { ...prefs.audio, ...changes },
    lastUpdated: new Date().toISOString(),
  };
}

export function updateHaptic(
  prefs: UserPreferences,
  changes: Partial<HapticPreferences>,
): UserPreferences {
  return {
    ...prefs,
    haptic: { ...prefs.haptic, ...changes },
    lastUpdated: new Date().toISOString(),
  };
}

export function updateNavigation(
  prefs: UserPreferences,
  changes: Partial<NavigationPreferences>,
): UserPreferences {
  return {
    ...prefs,
    navigation: { ...prefs.navigation, ...changes },
    lastUpdated: new Date().toISOString(),
  };
}

export function updateAlert(
  prefs: UserPreferences,
  changes: Partial<AlertPreferences>,
): UserPreferences {
  return {
    ...prefs,
    alert: { ...prefs.alert, ...changes },
    lastUpdated: new Date().toISOString(),
  };
}

export function updateDisplay(
  prefs: UserPreferences,
  changes: Partial<DisplayPreferences>,
): UserPreferences {
  return {
    ...prefs,
    display: { ...prefs.display, ...changes },
    lastUpdated: new Date().toISOString(),
  };
}

export function updatePersonality(
  prefs: UserPreferences,
  mode: PersonalityMode,
): UserPreferences {
  return { ...prefs, personalityMode: mode, lastUpdated: new Date().toISOString() };
}

export function updateAccessibilityMode(
  prefs: UserPreferences,
  mode: AccessibilityMode,
): UserPreferences {
  return { ...prefs, accessibilityMode: mode, lastUpdated: new Date().toISOString() };
}

// ─── localStorage persistence (server-safe) ──────────────────────────────────

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable (private mode, quota exceeded)
  }
}

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return createDefaultPreferences();
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return createDefaultPreferences();
    const parsed = JSON.parse(raw) as UserPreferences;
    // Migrate if version mismatch
    if (parsed.version !== PREFERENCES_VERSION) {
      return migratePreferences(parsed);
    }
    return mergeWithDefaults(parsed);
  } catch {
    return createDefaultPreferences();
  }
}

export function clearPreferences(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ─── Migration ────────────────────────────────────────────────────────────────

function migratePreferences(old: Partial<UserPreferences>): UserPreferences {
  // Future: handle v1→v2+ migrations here
  return mergeWithDefaults({ ...old, version: PREFERENCES_VERSION });
}

/** Merge persisted prefs with defaults (handles new keys added in later versions) */
export function mergeWithDefaults(persisted: Partial<UserPreferences>): UserPreferences {
  const base = createDefaultPreferences();
  return {
    ...base,
    ...persisted,
    audio: { ...base.audio, ...(persisted.audio ?? {}) },
    haptic: { ...base.haptic, ...(persisted.haptic ?? {}) },
    navigation: { ...base.navigation, ...(persisted.navigation ?? {}) },
    alert: { ...base.alert, ...(persisted.alert ?? {}) },
    display: { ...base.display, ...(persisted.display ?? {}) },
    version: PREFERENCES_VERSION,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePreferences(prefs: UserPreferences): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (prefs.audio.speechRate < 0.5 || prefs.audio.speechRate > 2.0) {
    errors.push('Speech rate must be between 0.5 and 2.0');
  }
  if (prefs.audio.speechVolume < 0 || prefs.audio.speechVolume > 1) {
    errors.push('Speech volume must be between 0 and 1');
  }
  if (prefs.audio.alertVolume < 0 || prefs.audio.alertVolume > 1) {
    errors.push('Alert volume must be between 0 and 1');
  }
  if (
    prefs.accessibilityMode === 'hearing_impaired' &&
    prefs.haptic.vibrationIntensity === 'off'
  ) {
    warnings.push('Hearing impaired mode works best with vibration enabled.');
  }
  if (
    prefs.accessibilityMode === 'blind' &&
    prefs.audio.speechVolume === 0
  ) {
    warnings.push('Blind mode with zero speech volume will produce no audio guidance.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Bridge to existing AppSettings ──────────────────────────────────────────

/** Convert Sprint 11 UserPreferences to the AppSettings shape (settingsStore.ts) */
export function toAppSettings(
  prefs: UserPreferences,
): Record<string, unknown> {
  return {
    speechRate: prefs.audio.speechRate,
    speechVolume: prefs.audio.speechVolume,
    alertVolume: prefs.audio.alertVolume,
    voiceName: prefs.audio.voiceName,
    guidancePersonality: prefs.personalityMode,
    alertVerbosity:
      prefs.audio.guidanceVerbosity === 'brief' ? 'minimal'
      : prefs.audio.guidanceVerbosity === 'verbose' ? 'full'
      : 'standard',
    hazardSensitivity: prefs.alert.hazardSensitivity,
    repeatCriticalAlerts: prefs.alert.criticalAlertRepeat,
    vibrationEnabled: prefs.haptic.hapticEnabled,
    highContrastMode: prefs.display.highContrastMode,
    reducedMotion: prefs.display.reducedMotion,
  };
}

// ─── Change event builder ─────────────────────────────────────────────────────

export function buildChangeEvent(
  group: PreferenceChangeEvent['group'],
  key: string,
  oldValue: unknown,
  newValue: unknown,
): PreferenceChangeEvent {
  return { group, key, oldValue, newValue };
}

// ─── Diff utility ────────────────────────────────────────────────────────────

export function diffPreferences(
  a: UserPreferences,
  b: UserPreferences,
): PreferenceChangeEvent[] {
  const events: PreferenceChangeEvent[] = [];

  const checkGroup = (
    group: PreferenceChangeEvent['group'],
    objA: Record<string, unknown>,
    objB: Record<string, unknown>,
  ) => {
    for (const key of Object.keys(objB)) {
      if (objA[key] !== objB[key]) {
        events.push(buildChangeEvent(group, key, objA[key], objB[key]));
      }
    }
  };

  checkGroup('audio', a.audio as unknown as Record<string, unknown>, b.audio as unknown as Record<string, unknown>);
  checkGroup('haptic', a.haptic as unknown as Record<string, unknown>, b.haptic as unknown as Record<string, unknown>);
  checkGroup('navigation', a.navigation as unknown as Record<string, unknown>, b.navigation as unknown as Record<string, unknown>);
  checkGroup('alert', a.alert as unknown as Record<string, unknown>, b.alert as unknown as Record<string, unknown>);
  checkGroup('display', a.display as unknown as Record<string, unknown>, b.display as unknown as Record<string, unknown>);

  if (a.personalityMode !== b.personalityMode) {
    events.push(buildChangeEvent('personality', 'personalityMode', a.personalityMode, b.personalityMode));
  }
  if (a.accessibilityMode !== b.accessibilityMode) {
    events.push(buildChangeEvent('accessibility', 'accessibilityMode', a.accessibilityMode, b.accessibilityMode));
  }

  return events;
}

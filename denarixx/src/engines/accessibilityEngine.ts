// Sprint 11 — Accessibility Engine (pure functional, no async, no I/O)
// Manages accessibility modes, presets, and UI adaptation logic.

import type {
  AccessibilityMode,
  AccessibilityPreset,
  UserPreferences,
  DisplayPreferences,
} from '@/types/preferences';

// ─── Accessibility presets ────────────────────────────────────────────────────

export const ACCESSIBILITY_PRESETS: AccessibilityPreset[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Default settings for sighted users.',
    icon: '👁',
    overrides: {},
  },
  {
    id: 'blind',
    name: 'Blind / No Vision',
    description: 'Audio-first mode. Maximum speech detail, no visual-only cues. Screen reader optimised.',
    icon: '🔊',
    overrides: {
      accessibilityMode: 'blind',
      personalityMode: 'detailed',
      audio: {
        guidanceVerbosity: 'verbose',
        confidenceAnnouncements: 'when_low',
        earconAlerts: true,
        repeatReminders: 'critical_only',
      },
      haptic: {
        hapticEnabled: true,
        hapticForCritical: true,
        hapticForNavigation: true,
        vibrationIntensity: 'strong',
      },
      navigation: {
        navigationDetail: 'rich',
        landmarkAnnouncements: true,
        crossingExtraWarning: true,
        indoorGuidanceStyle: 'spatial',
        outdoorGuidanceStyle: 'full',
      },
      alert: {
        alertFrequency: 'high',
        criticalAlertRepeat: true,
        silentLowRisk: false,
      },
      display: {
        screenReaderOptimised: true,
        reducedMotion: true,
      },
    },
  },
  {
    id: 'low_vision',
    name: 'Low Vision',
    description: 'High contrast, large text, enhanced audio with visual support.',
    icon: '🔍',
    overrides: {
      accessibilityMode: 'low_vision',
      personalityMode: 'balanced',
      audio: {
        guidanceVerbosity: 'normal',
        earconAlerts: true,
      },
      display: {
        highContrastMode: true,
        contrastMode: 'high_contrast',
        textSize: 'large',
        colorBlindFriendly: true,
      },
      navigation: {
        landmarkAnnouncements: true,
        crossingExtraWarning: true,
      },
    },
  },
  {
    id: 'hearing_impaired',
    name: 'Hearing Impaired',
    description: 'Maximised haptic feedback with visual alerts. Reduced audio reliance.',
    icon: '📳',
    overrides: {
      accessibilityMode: 'hearing_impaired',
      personalityMode: 'minimal',
      audio: {
        speechVolume: 0.0,
        alertVolume: 0.0,
        guidanceVerbosity: 'brief',
      },
      haptic: {
        hapticEnabled: true,
        vibrationIntensity: 'strong',
        hapticForCritical: true,
        hapticForNavigation: true,
        hapticForReassurance: true,
      },
      display: {
        highContrastMode: true,
        colorBlindFriendly: true,
      },
      alert: {
        alertFrequency: 'high',
        criticalAlertRepeat: true,
      },
    },
  },
  {
    id: 'one_hand',
    name: 'One-Hand Operation',
    description: 'Optimised for single-hand use. Larger tap targets and simplified navigation.',
    icon: '🤚',
    overrides: {
      accessibilityMode: 'one_hand',
      display: {
        textSize: 'large',
        reducedMotion: false,
      },
      audio: {
        guidanceVerbosity: 'normal',
      },
    },
  },
];

// ─── Preset lookup ────────────────────────────────────────────────────────────

export function getPreset(mode: AccessibilityMode): AccessibilityPreset {
  return ACCESSIBILITY_PRESETS.find(p => p.id === mode) ?? ACCESSIBILITY_PRESETS[0];
}

export function getAllPresets(): AccessibilityPreset[] {
  return [...ACCESSIBILITY_PRESETS];
}

// ─── Apply preset to user preferences ────────────────────────────────────────

export function applyPreset(
  base: UserPreferences,
  mode: AccessibilityMode,
): UserPreferences {
  const preset = getPreset(mode);
  const overrides = preset.overrides;

  return {
    ...base,
    accessibilityMode: mode,
    personalityMode: overrides.personalityMode ?? base.personalityMode,
    audio: { ...base.audio, ...(overrides.audio ?? {}) },
    haptic: { ...base.haptic, ...(overrides.haptic ?? {}) },
    navigation: { ...base.navigation, ...(overrides.navigation ?? {}) },
    alert: { ...base.alert, ...(overrides.alert ?? {}) },
    display: { ...base.display, ...(overrides.display ?? {}) },
    lastUpdated: new Date().toISOString(),
  };
}

// ─── CSS class derivation ─────────────────────────────────────────────────────

export interface AccessibilityClasses {
  /** Classes to apply to <html> element */
  htmlClasses: string[];
  /** aria-live region behaviour */
  ariaLive: 'off' | 'polite' | 'assertive';
  /** Minimum button size class */
  buttonSizeClass: string;
}

export function deriveAccessibilityClasses(
  prefs: UserPreferences,
): AccessibilityClasses {
  const htmlClasses: string[] = [];

  if (prefs.display.highContrastMode || prefs.accessibilityMode === 'hearing_impaired') {
    htmlClasses.push('high-contrast-mode');
  }
  if (prefs.display.reducedMotion) {
    htmlClasses.push('reduced-motion');
  }
  if (prefs.display.textSize === 'large') {
    htmlClasses.push('text-size-large');
  }
  if (prefs.display.textSize === 'extra_large') {
    htmlClasses.push('text-size-xl');
  }
  if (prefs.display.colorBlindFriendly) {
    htmlClasses.push('color-blind-friendly');
  }
  if (prefs.display.screenReaderOptimised || prefs.accessibilityMode === 'blind') {
    htmlClasses.push('screen-reader-mode');
  }

  const ariaLive: 'off' | 'polite' | 'assertive' =
    prefs.accessibilityMode === 'blind' ? 'assertive'
    : prefs.accessibilityMode === 'hearing_impaired' ? 'off'
    : 'polite';

  const buttonSizeClass =
    prefs.accessibilityMode === 'one_hand' || prefs.display.textSize !== 'standard'
      ? 'min-h-14'
      : 'min-h-10';

  return { htmlClasses, ariaLive, buttonSizeClass };
}

// ─── Screen reader text helpers ───────────────────────────────────────────────

export function buildAriaLabel(
  action: string,
  context: string,
  riskLevel?: string,
): string {
  if (!riskLevel) return `${action}: ${context}`;
  const urgency =
    riskLevel === 'critical' ? 'Critical alert' :
    riskLevel === 'high' ? 'High priority' :
    riskLevel === 'medium' ? 'Medium priority' : 'Information';
  return `${urgency}. ${action}: ${context}`;
}

export function buildSrOnlyAlert(
  message: string,
  mode: AccessibilityMode,
): string {
  if (mode === 'blind') return message;
  if (mode === 'hearing_impaired') return `[Visual alert] ${message}`;
  return message;
}

// ─── Colour-blind safe palette helper ────────────────────────────────────────

const STANDARD_PALETTE = { danger: '#ef4444', warning: '#f59e0b', safe: '#22c55e' };
const COLORBLIND_PALETTE = { danger: '#d55e00', warning: '#e69f00', safe: '#009e73' };

export function getAlertColor(
  level: 'danger' | 'warning' | 'safe',
  colorBlindFriendly: boolean,
): string {
  return (colorBlindFriendly ? COLORBLIND_PALETTE : STANDARD_PALETTE)[level];
}

// ─── Mode label helpers ───────────────────────────────────────────────────────

export function accessibilityModeLabel(mode: AccessibilityMode): string {
  const labels: Record<AccessibilityMode, string> = {
    standard: 'Standard',
    blind: 'Blind / No Vision',
    low_vision: 'Low Vision',
    hearing_impaired: 'Hearing Impaired',
    one_hand: 'One-Hand Operation',
  };
  return labels[mode] ?? 'Standard';
}

export function displayRequiresHighContrast(display: DisplayPreferences): boolean {
  return display.highContrastMode || display.contrastMode !== 'standard';
}

export function displayRequiresLargeText(display: DisplayPreferences): boolean {
  return display.textSize !== 'standard';
}

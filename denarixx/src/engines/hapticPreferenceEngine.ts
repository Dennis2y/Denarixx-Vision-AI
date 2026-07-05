// Sprint 11 — Haptic Preference Engine (pure functional, no async, no I/O)
// Manages vibration patterns, intensity scaling, and haptic routing.

import type {
  HapticPreferences,
  VibrationIntensity,
  HapticPattern,
} from '@/types/preferences';
import { DEFAULT_HAPTIC } from '@/types/preferences';

// ─── Intensity multipliers ────────────────────────────────────────────────────

const INTENSITY_MULTIPLIERS: Record<VibrationIntensity, number> = {
  off: 0,
  light: 0.5,
  medium: 1.0,
  strong: 1.5,
};

export function intensityMultiplier(intensity: VibrationIntensity): number {
  return INTENSITY_MULTIPLIERS[intensity] ?? 1.0;
}

export function intensityLabel(intensity: VibrationIntensity): string {
  const labels: Record<VibrationIntensity, string> = {
    off: 'Off',
    light: 'Light',
    medium: 'Medium',
    strong: 'Strong',
  };
  return labels[intensity] ?? 'Medium';
}

// ─── Built-in patterns ────────────────────────────────────────────────────────

const BASE_PATTERNS: HapticPattern[] = [
  {
    name: 'Critical Alert',
    pattern: [200, 100, 200, 100, 400],
    intensityLabel: 'strong',
  },
  {
    name: 'High Alert',
    pattern: [200, 100, 200],
    intensityLabel: 'medium',
  },
  {
    name: 'Medium Alert',
    pattern: [150, 100, 150],
    intensityLabel: 'medium',
  },
  {
    name: 'Navigation Turn',
    pattern: [100, 50, 100],
    intensityLabel: 'light',
  },
  {
    name: 'Reassurance',
    pattern: [80],
    intensityLabel: 'light',
  },
  {
    name: 'Crossing Warning',
    pattern: [300, 100, 300, 100, 300],
    intensityLabel: 'strong',
  },
];

export function getAllPatterns(): HapticPattern[] {
  return [...BASE_PATTERNS];
}

export function getPatternForRisk(riskLevel: string): HapticPattern {
  const map: Record<string, HapticPattern> = {
    critical: BASE_PATTERNS[0],
    high: BASE_PATTERNS[1],
    medium: BASE_PATTERNS[2],
    low: BASE_PATTERNS[4],
    navigation: BASE_PATTERNS[3],
    crossing: BASE_PATTERNS[5],
  };
  return map[riskLevel] ?? BASE_PATTERNS[2];
}

// ─── Scale pattern by intensity ───────────────────────────────────────────────

export function scalePattern(
  pattern: number[],
  intensity: VibrationIntensity,
): number[] {
  const mult = intensityMultiplier(intensity);
  if (mult === 0) return [];
  return pattern.map(ms => Math.round(ms * mult));
}

// ─── Should vibrate decision ──────────────────────────────────────────────────

export function shouldVibrate(
  prefs: HapticPreferences,
  eventType: 'critical' | 'high' | 'medium' | 'low' | 'navigation' | 'reassurance',
): boolean {
  if (!prefs.hapticEnabled) return false;
  if (prefs.vibrationIntensity === 'off') return false;

  switch (eventType) {
    case 'critical':
    case 'high':
      return prefs.hapticForCritical;
    case 'navigation':
      return prefs.hapticForNavigation;
    case 'reassurance':
      return prefs.hapticForReassurance;
    case 'medium':
      return prefs.hapticForCritical; // medium inherits critical setting
    case 'low':
      return false; // never vibrate for low risk
    default:
      return false;
  }
}

// ─── Build vibration command ──────────────────────────────────────────────────

export interface VibrationCommand {
  shouldVibrate: boolean;
  pattern: number[];
  patternName: string;
}

export function buildVibrationCommand(
  prefs: HapticPreferences,
  riskLevel: string,
): VibrationCommand {
  const eventType = riskLevel as Parameters<typeof shouldVibrate>[1];
  const vibrate = shouldVibrate(prefs, eventType as 'critical' | 'high' | 'medium' | 'low' | 'navigation' | 'reassurance');

  if (!vibrate) {
    return { shouldVibrate: false, pattern: [], patternName: 'none' };
  }

  const hapticPattern = getPatternForRisk(riskLevel);
  const scaled = scalePattern(hapticPattern.pattern, prefs.vibrationIntensity);

  return {
    shouldVibrate: true,
    pattern: scaled,
    patternName: hapticPattern.name,
  };
}

// ─── Merge with defaults ──────────────────────────────────────────────────────

export function mergeHapticDefaults(partial: Partial<HapticPreferences>): HapticPreferences {
  return { ...DEFAULT_HAPTIC, ...partial };
}

// ─── Haptic summary ───────────────────────────────────────────────────────────

export interface HapticSummary {
  enabled: boolean;
  intensityLabel: string;
  criticalEnabled: boolean;
  navigationEnabled: boolean;
}

export function buildHapticSummary(prefs: HapticPreferences): HapticSummary {
  return {
    enabled: prefs.hapticEnabled && prefs.vibrationIntensity !== 'off',
    intensityLabel: intensityLabel(prefs.vibrationIntensity),
    criticalEnabled: prefs.hapticForCritical,
    navigationEnabled: prefs.hapticForNavigation,
  };
}

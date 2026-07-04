// ─── V16 Haptic Wearable Engine ───────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Haptic pattern library, health assessment, audio fallback routing.

import type {
  HapticConfig,
  HapticPattern,
  HapticAlertType,
  ComponentStatus,
  DenarixxGlassesState,
} from '@/types/denarixxGlasses';

// ─── Config Factory ───────────────────────────────────────────────────────────

export function createHapticConfig(): HapticConfig {
  return {
    motorCount: 2,
    supportsIntensityControl: true,
    maxPatternDurationMs: 3000,
    status: 'ok',
  };
}

// ─── Pattern Library ──────────────────────────────────────────────────────────

const HAPTIC_PATTERNS: Record<HapticAlertType, HapticPattern> = {
  critical_hazard: {
    alertType: 'critical_hazard',
    pulseMs: [200, 200, 200],
    pauseMs: [50, 50],
    intensity: 100,
    repeatCount: 3,
    description: 'Long triple pulse — maximum urgency',
  },
  high_hazard: {
    alertType: 'high_hazard',
    pulseMs: [150, 150],
    pauseMs: [75],
    intensity: 85,
    repeatCount: 2,
    description: 'Double strong pulse',
  },
  medium_hazard: {
    alertType: 'medium_hazard',
    pulseMs: [100],
    pauseMs: [],
    intensity: 70,
    repeatCount: 2,
    description: 'Single medium pulse ×2',
  },
  navigation_turn: {
    alertType: 'navigation_turn',
    pulseMs: [80, 80],
    pauseMs: [200],
    intensity: 60,
    repeatCount: 1,
    description: 'Quick double tap',
  },
  crossing_warning: {
    alertType: 'crossing_warning',
    pulseMs: [100, 300, 100],
    pauseMs: [100, 100],
    intensity: 90,
    repeatCount: 2,
    description: 'Short-long-short — crossing caution',
  },
  battery_low: {
    alertType: 'battery_low',
    pulseMs: [500],
    pauseMs: [],
    intensity: 50,
    repeatCount: 1,
    description: 'Single long gentle pulse',
  },
  disconnected: {
    alertType: 'disconnected',
    pulseMs: [200, 200, 200, 200],
    pauseMs: [100, 100, 100],
    intensity: 80,
    repeatCount: 1,
    description: 'Quadruple pulse — device disconnected',
  },
  notification: {
    alertType: 'notification',
    pulseMs: [60],
    pauseMs: [],
    intensity: 40,
    repeatCount: 1,
    description: 'Short gentle tap',
  },
};

export function buildHapticPattern(alertType: HapticAlertType): HapticPattern {
  return HAPTIC_PATTERNS[alertType];
}

export function getHapticPatternLibrary(): HapticPattern[] {
  return Object.values(HAPTIC_PATTERNS);
}

// ─── Health Assessment ────────────────────────────────────────────────────────

export function assessHapticHealth(state: DenarixxGlassesState): ComponentStatus {
  if (state.connection === 'disconnected') return 'offline';
  return state.hapticStatus;
}

export function isHapticOperational(state: DenarixxGlassesState): boolean {
  const health = assessHapticHealth(state);
  return health === 'ok' || health === 'degraded';
}

// ─── Fallback Logic ───────────────────────────────────────────────────────────

export function getHapticFallbackGuidance(): string {
  return 'Haptic alerts unavailable. Audio guidance only.';
}

export function shouldUsHapticForPriority(
  alertType: HapticAlertType,
  audioAvailable: boolean,
): boolean {
  // Always pair haptic with audio for critical/high alerts when available
  if (!audioAvailable) return true;
  return alertType === 'critical_hazard' || alertType === 'high_hazard' || alertType === 'crossing_warning';
}

// ─── Pattern Duration ─────────────────────────────────────────────────────────

export function calculatePatternDurationMs(pattern: HapticPattern): number {
  const totalPulse = pattern.pulseMs.reduce((s, v) => s + v, 0);
  const totalPause = pattern.pauseMs.reduce((s, v) => s + v, 0);
  return (totalPulse + totalPause) * pattern.repeatCount;
}

export function isPatternWithinBudget(
  pattern: HapticPattern,
  config: HapticConfig,
): boolean {
  return calculatePatternDurationMs(pattern) <= config.maxPatternDurationMs;
}

// ─── Intensity Validation ─────────────────────────────────────────────────────

export function clampIntensity(intensity: number): number {
  return Math.max(0, Math.min(100, intensity));
}

export function scaleIntensityForBattery(intensity: number, batteryPct: number): number {
  if (batteryPct <= 10) return Math.round(intensity * 0.5);
  if (batteryPct <= 20) return Math.round(intensity * 0.75);
  return intensity;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatHapticStatus(state: DenarixxGlassesState): string {
  const health = assessHapticHealth(state);
  const map: Record<ComponentStatus, string> = {
    ok: '📳 Haptic active',
    degraded: '📳 Haptic degraded',
    failed: '❌ Haptic failed — audio only',
    offline: '⚫ Haptic offline',
  };
  return map[health];
}

export function describePattern(pattern: HapticPattern): string {
  const durationMs = calculatePatternDurationMs(pattern);
  return `${pattern.description} · ${durationMs}ms · intensity ${pattern.intensity}%`;
}

// ─── Alert Routing ────────────────────────────────────────────────────────────

export function routeAlert(
  alertType: HapticAlertType,
  audioAvailable: boolean,
  hapticAvailable: boolean,
): { useAudio: boolean; useHaptic: boolean; explanation: string } {
  const wantsHaptic = shouldUsHapticForPriority(alertType, audioAvailable);
  return {
    useAudio: audioAvailable,
    useHaptic: hapticAvailable && wantsHaptic,
    explanation:
      !audioAvailable && !hapticAvailable ? 'Both audio and haptic unavailable — alert queued.' :
      !audioAvailable ? 'Audio unavailable — haptic only.' :
      !hapticAvailable ? 'Haptic unavailable — audio only.' :
      wantsHaptic ? 'Audio + haptic (reinforced alert).' : 'Audio only.',
  };
}

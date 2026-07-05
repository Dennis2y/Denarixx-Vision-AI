// Sprint 11 — Audio Preference Engine (pure functional, no async, no I/O)
// Applies user audio preferences to speech synthesis and alert routing.

import type {
  AudioPreferences,
  RepeatMode,
  SilenceMode,
  AccessibilityMode,
} from '@/types/preferences';
import { DEFAULT_AUDIO } from '@/types/preferences';

// ─── Speech rate helpers ──────────────────────────────────────────────────────

export function clampSpeechRate(rate: number): number {
  return Math.min(2.0, Math.max(0.5, rate));
}

export function speechRateToBucketLabel(rate: number): 'slow' | 'normal' | 'fast' {
  if (rate <= 0.8) return 'slow';
  if (rate >= 1.3) return 'fast';
  return 'normal';
}

export function bucketLabelToRate(label: 'slow' | 'normal' | 'fast'): number {
  return label === 'slow' ? 0.75 : label === 'fast' ? 1.4 : 1.0;
}

// ─── Volume helpers ───────────────────────────────────────────────────────────

export function clampVolume(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function volumePercent(v: number): number {
  return Math.round(clampVolume(v) * 100);
}

export function volumeLabel(v: number): string {
  const pct = volumePercent(v);
  if (pct === 0) return 'Muted';
  if (pct <= 30) return 'Quiet';
  if (pct <= 70) return 'Normal';
  return 'Loud';
}

// ─── Should speak decision (from audio prefs) ─────────────────────────────────

export function shouldSpeakForRisk(
  riskLevel: string,
  prefs: AudioPreferences,
  accessibilityMode: AccessibilityMode,
): boolean {
  // Hearing impaired: volume 0 — no speech
  if (accessibilityMode === 'hearing_impaired' && prefs.speechVolume === 0) {
    return false;
  }
  // Auto silence
  if (prefs.automaticSilence === 'always') return false;
  return true;
}

// ─── Guidance verbosity → sentence count ─────────────────────────────────────

export function verbosityToSentenceCount(
  verbosity: AudioPreferences['guidanceVerbosity'],
  riskLevel: string,
): number {
  if (riskLevel === 'critical') return 3;
  switch (verbosity) {
    case 'brief':   return 1;
    case 'normal':  return 2;
    case 'verbose': return 4;
    default:        return 2;
  }
}

// ─── Repeat mode ──────────────────────────────────────────────────────────────

export function repeatDelayForRisk(
  mode: RepeatMode,
  riskLevel: string,
): number | null {
  if (mode === 'never') return null;
  if (mode === 'critical_only' && riskLevel !== 'critical') return null;
  if (riskLevel === 'critical') return 8_000;
  if (riskLevel === 'high') return 15_000;
  return null;
}

// ─── Silence mode ─────────────────────────────────────────────────────────────

export function isSilenced(mode: SilenceMode): boolean {
  return mode === 'always';
}

// ─── Confidence announcement ──────────────────────────────────────────────────

export function shouldAnnounceConfidence(
  mode: AudioPreferences['confidenceAnnouncements'],
  confidence: number,
): boolean {
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return confidence < 0.6;
}

export function confidenceNote(confidence: number): string {
  if (confidence < 0.4) return '(Low confidence — please verify.)';
  if (confidence < 0.6) return '(Moderate confidence.)';
  return '';
}

// ─── Earcon selection ─────────────────────────────────────────────────────────

const EARCON_MAP: Record<string, string> = {
  critical: 'three-short-beeps',
  high: 'two-short-beeps',
  medium: 'one-beep',
  low: 'soft-tone',
  navigation: 'ding',
};

export function getEarconId(type: string): string {
  return EARCON_MAP[type] ?? EARCON_MAP.medium;
}

// ─── Merge with defaults ──────────────────────────────────────────────────────

export function mergeAudioDefaults(partial: Partial<AudioPreferences>): AudioPreferences {
  return { ...DEFAULT_AUDIO, ...partial };
}

// ─── Audio preference summary ─────────────────────────────────────────────────

export interface AudioSummary {
  rateBucket: 'slow' | 'normal' | 'fast';
  volumeLabel: string;
  alertVolumeLabel: string;
  verbosityLabel: string;
  silenced: boolean;
}

export function buildAudioSummary(prefs: AudioPreferences): AudioSummary {
  const verbosityLabels = { brief: 'Brief', normal: 'Normal', verbose: 'Verbose' };
  return {
    rateBucket: speechRateToBucketLabel(prefs.speechRate),
    volumeLabel: volumeLabel(prefs.speechVolume),
    alertVolumeLabel: volumeLabel(prefs.alertVolume),
    verbosityLabel: verbosityLabels[prefs.guidanceVerbosity] ?? 'Normal',
    silenced: isSilenced(prefs.automaticSilence),
  };
}

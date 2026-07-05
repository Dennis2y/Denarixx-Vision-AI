// Sprint 10 — Speech Adaptation Engine (pure functional, no async, no I/O)
// Controls speech rate, brevity, and repetition logic.

import type {
  PersonalityMode,
  SpeechRate,
  SpeechAmount,
  CompanionProfile,
  ContextSnapshot,
  SpeechAdaptation,
} from '@/types/companion';
import { SPEECH_RATE_MAP } from '@/types/companion';

// ─── Speech rate resolution ───────────────────────────────────────────────────

export function resolveRate(
  profileRate: SpeechRate,
  riskLevel: string,
  context: ContextSnapshot,
): SpeechRate {
  // Critical alerts always delivered at normal or fast rate
  if (riskLevel === 'critical' && profileRate === 'slow') return 'normal';
  // In crossing context, use normal minimum for clarity
  if (context.isCrossing && profileRate === 'fast') return 'normal';
  return profileRate;
}

export function rateToNumber(rate: SpeechRate): number {
  return SPEECH_RATE_MAP[rate] ?? 1.0;
}

// ─── Brief mode ───────────────────────────────────────────────────────────────

export function isBriefMode(
  amount: SpeechAmount,
  mode: PersonalityMode,
  riskLevel: string,
): boolean {
  if (amount === 'brief') return true;
  if (mode === 'minimal') return true;
  // Even verbose mode goes brief during critical alerts to maximise clarity
  if (riskLevel === 'critical' && amount === 'verbose') return false; // keep full message
  return false;
}

export function maxSentences(
  amount: SpeechAmount,
  mode: PersonalityMode,
  riskLevel: string,
): number {
  if (riskLevel === 'critical') return 3;
  if (amount === 'brief' || mode === 'minimal') return 1;
  if (amount === 'normal' || mode === 'balanced') return 2;
  return 4; // verbose / detailed / companion
}

// ─── Auto-repeat ──────────────────────────────────────────────────────────────

export function repeatDelayMs(
  riskLevel: string,
  autoRepeat: boolean,
): number | null {
  if (!autoRepeat) return null;
  if (riskLevel === 'critical') return 8_000;   // repeat critical after 8 s
  if (riskLevel === 'high') return 15_000;      // repeat high after 15 s
  return null;                                  // low/medium never auto-repeat
}

// ─── Full speech adaptation bundle ───────────────────────────────────────────

export interface AdaptSpeechInput {
  mode: PersonalityMode;
  riskLevel: string;
  profile: CompanionProfile;
  context: ContextSnapshot;
}

export function adaptSpeech(input: AdaptSpeechInput): SpeechAdaptation {
  const { mode, riskLevel, profile, context } = input;

  const rateLabel = resolveRate(profile.speechRate, riskLevel, context);
  const rate = rateToNumber(rateLabel);
  const briefMode = isBriefMode(profile.speechAmount, mode, riskLevel);
  const sentences = maxSentences(profile.speechAmount, mode, riskLevel);
  const repeatAfterMs = repeatDelayMs(riskLevel, profile.autoRepeat);

  return { rate, rateLabel, briefMode, maxSentences: sentences, repeatAfterMs };
}

// ─── Apply brevity to text ────────────────────────────────────────────────────

export function applyBrevity(text: string, adaptation: SpeechAdaptation): string {
  if (!adaptation.briefMode) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, adaptation.maxSentences).join(' ').trim();
}

// ─── Rate label helpers ───────────────────────────────────────────────────────

export function speechRateLabel(rate: SpeechRate): string {
  const labels: Record<SpeechRate, string> = {
    slow: 'Slow (0.75×)',
    normal: 'Normal (1.0×)',
    fast: 'Fast (1.4×)',
  };
  return labels[rate];
}

export function speechAmountLabel(amount: SpeechAmount): string {
  const labels: Record<SpeechAmount, string> = {
    brief: 'Brief — one sentence',
    normal: 'Normal — two sentences',
    verbose: 'Verbose — full descriptions',
  };
  return labels[amount];
}

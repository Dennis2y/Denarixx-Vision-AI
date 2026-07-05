// Sprint 10 — Companion Personality Engine (pure functional, no async, no I/O)
// Manages personality mode selection and message filtering.
// Extends (does NOT replace) the Sprint 5 GuidancePersonalityEngine class.

import type {
  PersonalityMode,
  CompanionProfile,
  AdaptedGuidance,
  ContextSnapshot,
  PersonalityDescriptor,
} from '@/types/companion';
import {
  COMPANION_DEFAULTS,
  PERSONALITY_DESCRIPTORS,
} from '@/types/companion';
import { applyGuidanceStyle } from '@/engines/guidanceStyleEngine';
import { adaptSpeech } from '@/engines/speechAdaptationEngine';

// ─── Profile management ───────────────────────────────────────────────────────

export function createProfile(overrides: Partial<CompanionProfile> = {}): CompanionProfile {
  return { ...COMPANION_DEFAULTS, ...overrides };
}

export function updateProfile(
  profile: CompanionProfile,
  changes: Partial<CompanionProfile>,
): CompanionProfile {
  return { ...profile, ...changes };
}

export function getDescriptor(mode: PersonalityMode): PersonalityDescriptor {
  return PERSONALITY_DESCRIPTORS.find(d => d.mode === mode) ?? PERSONALITY_DESCRIPTORS[1];
}

export function getAllDescriptors(): PersonalityDescriptor[] {
  return [...PERSONALITY_DESCRIPTORS];
}

// ─── Risk threshold gate ──────────────────────────────────────────────────────

const RISK_RANKS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export function personalityAllowsRisk(
  mode: PersonalityMode,
  riskLevel: string,
): boolean {
  const rank = RISK_RANKS[riskLevel] ?? 0;
  switch (mode) {
    case 'minimal':   return rank >= 3; // critical + high only
    case 'balanced':  return rank >= 2; // medium and above
    case 'detailed':  return rank >= 1; // all except none
    case 'companion': return rank >= 1; // all except none
    default:          return rank >= 2;
  }
}

// Safety override: critical always speaks regardless of personality
export function isCriticalOverride(riskLevel: string): boolean {
  return riskLevel === 'critical';
}

// ─── Core adaptation pipeline ─────────────────────────────────────────────────

export interface AdaptInput {
  message: string;
  riskLevel: string;
  profile: CompanionProfile;
  context: ContextSnapshot;
  isNavigation?: boolean;
}

export function adaptMessage(input: AdaptInput): AdaptedGuidance {
  const { message, riskLevel, profile, context, isNavigation = false } = input;

  // Safety override — critical always passes through
  const critical = isCriticalOverride(riskLevel);

  // Context may force detail (e.g. crossing)
  const contextForcesDetail = context.isCrossing || context.isPoorLighting;
  const effectiveMode: PersonalityMode = contextForcesDetail && profile.mode === 'minimal'
    ? 'balanced'
    : profile.mode;

  // Risk gate (navigation always passes)
  if (!critical && !isNavigation && !personalityAllowsRisk(effectiveMode, riskLevel)) {
    return {
      originalMessage: message,
      adaptedMessage: '',
      speechRate: profile.speechRate,
      speechAmount: profile.speechAmount,
      shouldSpeak: false,
      wasFiltered: true,
      filterReason: `Personality mode "${effectiveMode}" filters ${riskLevel} risk.`,
      personalityApplied: effectiveMode,
      contextApplied: context.contextType,
    };
  }

  // Apply style
  const styled = applyGuidanceStyle({
    message,
    mode: effectiveMode,
    riskLevel,
    context,
    profile,
  });

  // Apply speech adaptation
  const speechAdapt = adaptSpeech({
    mode: effectiveMode,
    riskLevel,
    profile,
    context,
  });

  return {
    originalMessage: message,
    adaptedMessage: styled.message,
    speechRate: speechAdapt.rateLabel,
    speechAmount: speechAdapt.briefMode ? 'brief' : profile.speechAmount,
    shouldSpeak: true,
    wasFiltered: false,
    filterReason: null,
    personalityApplied: effectiveMode,
    contextApplied: context.contextType,
  };
}

// ─── Preview sample for UI ────────────────────────────────────────────────────

export function buildPreviewSample(mode: PersonalityMode): string {
  const descriptor = getDescriptor(mode);
  return descriptor.example;
}

// ─── Reassurance check (companion mode, idle) ─────────────────────────────────

const COMPANION_REASSURANCES = [
  "You're doing well — I'm watching your surroundings carefully.",
  "All clear ahead. Take your time.",
  "No hazards visible. Feel free to continue at your own pace.",
  "Your surroundings look calm. I'm keeping watch.",
  "I'm here with you. The path looks clear right now.",
];

let reassuranceIndex = 0;

export function getNextReassurance(): string {
  const msg = COMPANION_REASSURANCES[reassuranceIndex % COMPANION_REASSURANCES.length];
  reassuranceIndex++;
  return msg;
}

export function shouldGiveReassurance(
  mode: PersonalityMode,
  secondsSinceLastAlert: number,
): boolean {
  return mode === 'companion' && secondsSinceLastAlert >= 30;
}

// ─── Confidence announcement ──────────────────────────────────────────────────

export function shouldAnnounceConfidence(
  profile: CompanionProfile,
  confidence: number,
): boolean {
  switch (profile.confidenceAnnouncements) {
    case 'always':   return true;
    case 'when_low': return confidence < 0.6;
    case 'never':    return false;
    default:         return false;
  }
}

export function formatConfidenceNote(confidence: number): string {
  if (confidence < 0.4) return '(Low confidence — please verify.)';
  if (confidence < 0.6) return '(Moderate confidence.)';
  return '';
}

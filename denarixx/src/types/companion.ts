// Sprint 10 — Adaptive Companion Personality — type definitions
// Separate from guidancePersonalityEngine.ts (Sprint 5 class) — never merge.

export type PersonalityMode = 'minimal' | 'balanced' | 'detailed' | 'companion';

export type SpeechRate = 'slow' | 'normal' | 'fast';

export type SpeechAmount = 'brief' | 'normal' | 'verbose';

export type AlertFrequency = 'low' | 'medium' | 'high';

export type NavigationDetail = 'minimal' | 'standard' | 'rich';

export type ConfidenceAnnouncements = 'always' | 'when_low' | 'never';

export type ContextType =
  | 'indoor'
  | 'outdoor'
  | 'crossing'
  | 'crowded'
  | 'quiet'
  | 'poor_lighting'
  | 'unknown';

// ─── Companion profile (user preference state) ────────────────────────────────

export interface CompanionProfile {
  mode: PersonalityMode;
  speechRate: SpeechRate;
  speechAmount: SpeechAmount;
  alertFrequency: AlertFrequency;
  navigationDetail: NavigationDetail;
  confidenceAnnouncements: ConfidenceAnnouncements;
  /** Auto-repeat critical alerts after a cooldown */
  autoRepeat: boolean;
  /** Speak a sample when the user changes a setting */
  previewMode: boolean;
}

// ─── Context snapshot — what the AI currently knows about the environment ─────

export interface ContextSnapshot {
  contextType: ContextType;
  isIndoors: boolean;
  isCrowded: boolean;
  isNight: boolean;
  isCrossing: boolean;
  isQuiet: boolean;
  isPoorLighting: boolean;
  confidence: number;
  detectedLabels: string[];
}

// ─── Adapted guidance — output of the adaptation pipeline ────────────────────

export interface AdaptedGuidance {
  originalMessage: string;
  adaptedMessage: string;
  speechRate: SpeechRate;
  speechAmount: SpeechAmount;
  shouldSpeak: boolean;
  wasFiltered: boolean;
  filterReason: string | null;
  personalityApplied: PersonalityMode;
  contextApplied: ContextType;
}

// ─── Style output — from guidanceStyleEngine ─────────────────────────────────

export interface StyleOutput {
  message: string;
  tone: 'terse' | 'neutral' | 'warm' | 'conversational';
  addReassurance: boolean;
  reassurance: string | null;
}

// ─── Speech adaptation — from speechAdaptationEngine ─────────────────────────

export interface SpeechAdaptation {
  /** Numeric rate for Web Speech API (0.5–2.0) */
  rate: number;
  rateLabel: SpeechRate;
  briefMode: boolean;
  /** Max number of sentences to output in brief mode */
  maxSentences: number;
  /** If non-null, repeat message after this many ms (critical alerts only) */
  repeatAfterMs: number | null;
}

// ─── Personality trait descriptors (used by UI preview) ──────────────────────

export interface PersonalityDescriptor {
  mode: PersonalityMode;
  label: string;
  description: string;
  example: string;
  riskThreshold: 'critical_high_only' | 'medium_and_above' | 'all_risks' | 'all_with_warmth';
}

// ─── Context adaptation rule ──────────────────────────────────────────────────

export interface ContextAdaptationRule {
  contextType: ContextType;
  alertFrequencyBoost: number;     // multiplier, e.g. 1.5 = more frequent
  speechAmountAdjustment: number;  // +1 = more verbose, -1 = more brief, 0 = no change
  forceDetail: boolean;            // override to detailed even in minimal mode
  safetyOverride: boolean;         // always speak regardless of personality
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const COMPANION_DEFAULTS: CompanionProfile = {
  mode: 'balanced',
  speechRate: 'normal',
  speechAmount: 'normal',
  alertFrequency: 'medium',
  navigationDetail: 'standard',
  confidenceAnnouncements: 'when_low',
  autoRepeat: false,
  previewMode: false,
};

export const SPEECH_RATE_MAP: Record<SpeechRate, number> = {
  slow: 0.75,
  normal: 1.0,
  fast: 1.4,
};

export const PERSONALITY_DESCRIPTORS: PersonalityDescriptor[] = [
  {
    mode: 'minimal',
    label: 'Minimal',
    description: 'Only critical hazards. Very short messages.',
    example: 'Vehicle ahead.',
    riskThreshold: 'critical_high_only',
  },
  {
    mode: 'balanced',
    label: 'Balanced',
    description: 'Standard navigation and moderate hazard descriptions.',
    example: 'Vehicle approaching from the left. Slow down.',
    riskThreshold: 'medium_and_above',
  },
  {
    mode: 'detailed',
    label: 'Detailed',
    description: 'Rich environmental descriptions, landmarks, and navigation reasoning.',
    example: 'A white van is 4 metres ahead moving left to right. There is a clear path to your right. The pavement is unobstructed.',
    riskThreshold: 'all_risks',
  },
  {
    mode: 'companion',
    label: 'Companion',
    description: 'Conversational, warm, and encouraging. Stays concise during danger.',
    example: 'Just a heads-up — a vehicle is passing on your left. Take it easy, you\'re doing great.',
    riskThreshold: 'all_with_warmth',
  },
];

export const COMPANION_PRIVACY_NOTE =
  'Personality preferences are stored locally. No speech data is sent to external servers.';

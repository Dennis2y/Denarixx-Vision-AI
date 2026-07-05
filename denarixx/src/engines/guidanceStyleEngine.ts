// Sprint 10 — Guidance Style Engine (pure functional, no async, no I/O)
// Formats guidance messages for each personality mode + context.

import type {
  PersonalityMode,
  CompanionProfile,
  ContextSnapshot,
  StyleOutput,
} from '@/types/companion';

// ─── Warm prefixes for companion mode ────────────────────────────────────────

const COMPANION_PREFIXES_MEDIUM = [
  'Just a heads-up — ',
  'Worth noting — ',
  'Quick note — ',
  'Heads-up — ',
];

const COMPANION_PREFIXES_LOW = [
  'No rush, but — ',
  'FYI — ',
  'Just so you know — ',
];

function pickPrefix(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Context-specific additions ───────────────────────────────────────────────

function getContextSuffix(context: ContextSnapshot, mode: PersonalityMode): string {
  if (mode === 'minimal') return '';
  if (context.isCrossing) {
    return ' Please check carefully before proceeding.';
  }
  if (context.isPoorLighting && (mode === 'detailed' || mode === 'companion')) {
    return ' Low lighting detected — take extra care.';
  }
  if (context.isCrowded && mode === 'detailed') {
    return ' Area is crowded.';
  }
  return '';
}

// ─── Sentence trimmer ─────────────────────────────────────────────────────────

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  if (match) return match[0].trim();
  return text.trim();
}

function capSentences(text: string, max: number): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, max).join(' ');
}

// ─── Apply indoor/outdoor context framing ────────────────────────────────────

function addContextFrame(message: string, context: ContextSnapshot, mode: PersonalityMode): string {
  if (mode !== 'detailed' && mode !== 'companion') return message;
  if (context.isIndoors && !message.toLowerCase().includes('inside')) {
    // subtle — don't repeat known context
  }
  return message;
}

// ─── Main style application ───────────────────────────────────────────────────

export interface StyleInput {
  message: string;
  mode: PersonalityMode;
  riskLevel: string;
  context: ContextSnapshot;
  profile: CompanionProfile;
}

export function applyGuidanceStyle(input: StyleInput): StyleOutput {
  const { message, mode, riskLevel, context } = input;

  const suffix = getContextSuffix(context, mode);

  switch (mode) {
    case 'minimal': {
      const terse = firstSentence(message);
      return {
        message: terse,
        tone: 'terse',
        addReassurance: false,
        reassurance: null,
      };
    }

    case 'balanced': {
      const base = capSentences(message, 2);
      return {
        message: (base + suffix).trim(),
        tone: 'neutral',
        addReassurance: false,
        reassurance: null,
      };
    }

    case 'detailed': {
      const full = addContextFrame(message, context, mode);
      return {
        message: (full + suffix).trim(),
        tone: 'neutral',
        addReassurance: false,
        reassurance: null,
      };
    }

    case 'companion': {
      // Critical alerts stay direct — no warm prefix
      if (riskLevel === 'critical') {
        return {
          message: (message + suffix).trim(),
          tone: 'warm',
          addReassurance: false,
          reassurance: null,
        };
      }

      // High — short warm prefix
      if (riskLevel === 'high') {
        const prefix = pickPrefix(COMPANION_PREFIXES_MEDIUM);
        const capped = capSentences(message, 2);
        return {
          message: (prefix + capped + suffix).trim(),
          tone: 'warm',
          addReassurance: false,
          reassurance: null,
        };
      }

      // Medium / low — friendlier prefix, add reassurance opportunity
      const prefix = pickPrefix(COMPANION_PREFIXES_LOW);
      const base = capSentences(message, 2);
      return {
        message: (prefix + base + suffix).trim(),
        tone: 'conversational',
        addReassurance: true,
        reassurance: null,
      };
    }

    default:
      return { message, tone: 'neutral', addReassurance: false, reassurance: null };
  }
}

// ─── Navigation-specific formatting ──────────────────────────────────────────

export function formatNavigationGuidance(
  instruction: string,
  mode: PersonalityMode,
  detail: import('@/types/companion').NavigationDetail,
  context: ContextSnapshot,
): string {
  if (mode === 'minimal') {
    return firstSentence(instruction);
  }
  if (mode === 'companion') {
    const base = capSentences(instruction, 2);
    const suffix = context.isCrossing ? ' Check carefully before crossing.' : '';
    return base + suffix;
  }
  if (detail === 'rich' || mode === 'detailed') {
    const suffix = getContextSuffix(context, mode);
    return (instruction + suffix).trim();
  }
  return capSentences(instruction, 2);
}

// ─── Memory-integrated greeting ───────────────────────────────────────────────

export function buildMemoryGreeting(
  mode: PersonalityMode,
  memoryFacts: string[],
): string | null {
  if (mode !== 'companion' && mode !== 'detailed') return null;
  if (memoryFacts.length === 0) return null;
  const fact = memoryFacts[0];
  if (mode === 'companion') {
    return `Welcome back. ${fact}`;
  }
  return `Note: ${fact}`;
}

// ─── Uncertainty framing ──────────────────────────────────────────────────────

export function frameUncertainty(
  message: string,
  confidence: number,
  mode: PersonalityMode,
): string {
  if (confidence >= 0.7) return message;
  if (mode === 'minimal') return message;
  if (mode === 'companion') {
    return `${message} (I'm not fully certain — please check yourself.)`;
  }
  if (confidence < 0.4) {
    return `${message} (Low confidence — please verify.)`;
  }
  return `${message} (Moderate confidence.)`;
}

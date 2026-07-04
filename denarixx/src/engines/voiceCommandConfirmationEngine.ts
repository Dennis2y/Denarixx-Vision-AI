/**
 * VoiceCommandConfirmationEngine (Sprint 7)
 *
 * Returns the spoken confirmation message for each executed voice command.
 * Pure engine — no async, no I/O, no browser dependencies.
 *
 * Personality rules:
 *   minimal   — skip low-value confirmations; very short phrasing
 *   balanced  — standard confirmations for all commands
 *   detailed  — more descriptive; explains what will happen
 *   companion — warm, natural language
 *
 * Safety invariants:
 *   - emergency_stop confirmation is NEVER suppressed regardless of personality.
 *   - save_this_place only confirms after consent is verified by the router.
 *   - No confirmation ever mentions face recognition.
 *   - No confirmation stores or returns location data.
 */

import type { VoiceCommandType } from './voiceCommandEngine';
import type { GuidancePersonality } from './guidancePersonalityEngine';

export interface CommandConfirmation {
  /** Text to speak aloud. Null means suppress (do not speak). */
  spokenMessage: string | null;
  /** Whether this confirmation bypasses personality suppression. */
  alwaysSpeak: boolean;
}

// ─── Per-personality confirmation tables ──────────────────────────────────────

type PersonalityTable = Record<GuidancePersonality, string | null>;

const CONFIRMATIONS: Partial<Record<VoiceCommandType, PersonalityTable>> = {
  start_session: {
    minimal: 'Starting vision.',
    balanced: 'Starting vision session.',
    detailed: 'Starting vision session. I will describe your surroundings and alert you to hazards.',
    companion: "Starting your vision session. I'm here with you.",
  },
  stop_session: {
    minimal: 'Stopping.',
    balanced: 'Stopping vision session.',
    detailed: 'Stopping vision session. All scanning has ended.',
    companion: "Stopping your session. Stay safe.",
  },
  repeat_last: {
    minimal: null,
    balanced: 'Repeating last guidance.',
    detailed: 'Repeating the last spoken guidance message.',
    companion: 'Of course. Repeating last guidance for you.',
  },
  describe_surroundings: {
    minimal: null,
    balanced: 'Describing surroundings.',
    detailed: 'Analysing and describing your surroundings now.',
    companion: 'Let me take a look around for you.',
  },
  where_am_i: {
    minimal: null,
    balanced: 'Checking your location.',
    detailed: 'Looking up your current location and nearby context.',
    companion: "I'll describe where you are right now.",
  },
  what_should_i_do: {
    minimal: null,
    balanced: 'Reading recommended action.',
    detailed: 'Reading the current recommended action based on your surroundings.',
    companion: "Here is my guidance for what you should do right now.",
  },
  save_this_place: {
    minimal: 'Place saved.',
    balanced: 'Place saved.',
    detailed: 'Place saved to your landmark memory. No precise coordinates are stored.',
    companion: "I've saved this place to your memory. You can return here by name.",
  },
  start_navigation: {
    minimal: 'Starting navigation.',
    balanced: 'Starting navigation.',
    detailed: 'Starting navigation. I will give you turn-by-turn directions and hazard alerts.',
    companion: "Let's go. Starting navigation — I'll guide you step by step.",
  },
  stop_navigation: {
    minimal: 'Navigation stopped.',
    balanced: 'Stopping navigation.',
    detailed: 'Navigation ended. I will stop giving route directions.',
    companion: "Navigation stopped. You can restart any time by saying start navigation.",
  },
  emergency_stop: {
    minimal: 'Emergency stop.',
    balanced: 'Emergency stop. All activity halted.',
    detailed: 'Emergency stop. All activity halted. Please stop and wait for assistance.',
    companion: 'Emergency stop. I have halted everything. Please stop and stay still.',
  },
};

// ─── Engine ───────────────────────────────────────────────────────────────────

export function getCommandConfirmation(
  command: VoiceCommandType,
  personality: GuidancePersonality,
): CommandConfirmation {
  if (command === 'emergency_stop') {
    const table = CONFIRMATIONS.emergency_stop!;
    return { spokenMessage: table[personality] ?? table.balanced, alwaysSpeak: true };
  }

  if (command === 'unknown') {
    return { spokenMessage: null, alwaysSpeak: false };
  }

  const table = CONFIRMATIONS[command];
  if (!table) {
    return { spokenMessage: null, alwaysSpeak: false };
  }

  return {
    spokenMessage: table[personality] ?? null,
    alwaysSpeak: false,
  };
}

/**
 * Returns a blocked-command message when a command cannot be executed.
 * Always spoken (user needs to know why their command was ignored).
 */
export function getBlockedConfirmation(
  command: VoiceCommandType,
  blockReason: string,
  personality: GuidancePersonality,
): string {
  if (personality === 'minimal') {
    return `Cannot execute. ${blockReason}`;
  }
  if (personality === 'companion') {
    const label = commandLabel(command);
    return `I cannot ${label.toLowerCase()} right now. ${blockReason}`;
  }
  const label = commandLabel(command);
  return `${label} blocked. ${blockReason}`;
}

function commandLabel(command: VoiceCommandType): string {
  const LABELS: Partial<Record<VoiceCommandType, string>> = {
    start_session: 'Start Session',
    stop_session: 'Stop Session',
    start_navigation: 'Start Navigation',
    stop_navigation: 'Stop Navigation',
    save_this_place: 'Save This Place',
    repeat_last: 'Repeat',
    describe_surroundings: 'Describe',
    where_am_i: 'Locate',
    what_should_i_do: 'Advise',
    emergency_stop: 'Emergency Stop',
  };
  return LABELS[command] ?? 'Command';
}

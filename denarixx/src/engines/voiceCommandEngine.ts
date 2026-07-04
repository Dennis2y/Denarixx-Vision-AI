/**
 * VoiceCommandEngine (V5, extended Sprint 7)
 *
 * Parses raw speech-recognition transcript strings into structured
 * VoiceCommandType values. Pure function — no side effects, no I/O.
 * Designed for easy unit testing without a browser environment.
 *
 * Sprint 7 adds: start_navigation, stop_navigation
 */

export type VoiceCommandType =
  | 'start_session'
  | 'stop_session'
  | 'repeat_last'
  | 'describe_surroundings'
  | 'where_am_i'
  | 'what_should_i_do'
  | 'save_this_place'
  | 'start_navigation'
  | 'stop_navigation'
  | 'emergency_stop'
  | 'unknown';

export interface ParsedVoiceCommand {
  command: VoiceCommandType;
  confidence: number;
  rawText: string;
  matchedPattern: string;
}

interface CommandPattern {
  command: VoiceCommandType;
  patterns: string[];
  confidence: number;
}

// NOTE: Order matters — more-specific patterns must appear before bare
// single-word patterns ('start', 'stop', 'where') that would otherwise
// swallow multi-word intents.
const COMMAND_PATTERNS: CommandPattern[] = [
  {
    command: 'emergency_stop',
    patterns: ['emergency', 'danger', 'stop everything', 'abort', 'panic'],
    confidence: 0.97,
  },
  // ── Navigation commands (before session commands to avoid 'start'/'stop' swallowing) ──
  {
    command: 'start_navigation',
    patterns: [
      'start navigation',
      'begin navigation',
      'start navigating',
      'begin navigating',
      'navigate to',
      'navigate me',
      'open navigation',
    ],
    confidence: 0.92,
  },
  {
    command: 'stop_navigation',
    patterns: [
      'stop navigation',
      'end navigation',
      'stop navigating',
      'finish navigation',
      'cancel navigation',
      'exit navigation',
    ],
    confidence: 0.92,
  },
  // ── Session commands ──────────────────────────────────────────────────────────
  {
    command: 'start_session',
    patterns: [
      'start session',
      'begin session',
      'start vision',
      'begin vision',
      'start scanning',
      'start the session',
      'begin',
      'start',
    ],
    confidence: 0.9,
  },
  {
    command: 'stop_session',
    patterns: [
      'stop session',
      'end session',
      'finish session',
      'stop vision',
      'stop scanning',
      'stop the session',
      'end the session',
      'quit session',
    ],
    confidence: 0.9,
  },
  {
    command: 'repeat_last',
    patterns: [
      'repeat',
      'repeat that',
      'say that again',
      'repeat last',
      'what did you say',
      'say again',
      'repeat guidance',
      'again',
    ],
    confidence: 0.88,
  },
  {
    command: 'describe_surroundings',
    patterns: [
      'describe surroundings',
      'describe',
      'what is around me',
      'what do you see',
      'look around',
      'what is around',
      'what can you see',
      'describe what you see',
      'what is nearby',
      'what is near me',
    ],
    confidence: 0.88,
  },
  {
    command: 'where_am_i',
    patterns: [
      'where am i',
      'where are we',
      'where am I',
      'what is this place',
      'what place is this',
      'where is this',
      'location',
      'where',
    ],
    confidence: 0.85,
  },
  {
    command: 'what_should_i_do',
    patterns: [
      'what should i do',
      'what do i do',
      'what should i do now',
      'help',
      'advise me',
      'what is the recommended action',
      'what next',
      'guide me',
    ],
    confidence: 0.85,
  },
  {
    command: 'save_this_place',
    patterns: [
      'save this place',
      'save location',
      'remember this',
      'remember this place',
      'save this',
      'save here',
      'bookmark this',
      'mark this location',
    ],
    confidence: 0.88,
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class VoiceCommandEngine {
  parse(transcript: string): ParsedVoiceCommand {
    const normalized = normalize(transcript);

    for (const entry of COMMAND_PATTERNS) {
      for (const pattern of entry.patterns) {
        if (normalized.includes(pattern)) {
          return {
            command: entry.command,
            confidence: entry.confidence,
            rawText: transcript,
            matchedPattern: pattern,
          };
        }
      }
    }

    return {
      command: 'unknown',
      confidence: 0,
      rawText: transcript,
      matchedPattern: '',
    };
  }

  /** Returns a short human-readable label for a command type */
  label(command: VoiceCommandType): string {
    const LABELS: Record<VoiceCommandType, string> = {
      start_session: 'Start Session',
      stop_session: 'Stop Session',
      repeat_last: 'Repeat Last',
      describe_surroundings: 'Describe Surroundings',
      where_am_i: 'Where Am I',
      what_should_i_do: 'What Should I Do',
      save_this_place: 'Save This Place',
      start_navigation: 'Start Navigation',
      stop_navigation: 'Stop Navigation',
      emergency_stop: 'Emergency Stop',
      unknown: 'Unknown',
    };
    return LABELS[command];
  }

  /** Returns all supported command types (excluding 'unknown') */
  supportedCommands(): VoiceCommandType[] {
    return [
      'start_session',
      'stop_session',
      'repeat_last',
      'describe_surroundings',
      'where_am_i',
      'what_should_i_do',
      'save_this_place',
      'start_navigation',
      'stop_navigation',
      'emergency_stop',
    ];
  }
}

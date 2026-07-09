/**
 * Speech Recognition Engine — Sprint 22: Real Perception Integration
 * Wraps STT provider logic: wake word detection, offline placeholder,
 * streaming recognition, interrupt-safe command routing.
 * Reuses voiceCommandEngine.ts for command parsing — does NOT duplicate it.
 * No browser API calls here — engines must be testable in Node.js.
 */

import type {
  STTConfig,
  STTProvider,
  STTStatus,
  SpeechRecognitionResult,
  WakeWordConfig,
  WakeWordState,
  STTProviderInterface,
} from '@/types/speech';
import {
  DEFAULT_STT_CONFIG,
  DEFAULT_WAKE_WORD,
  OFFLINE_STT_NOTE,
  WEB_SPEECH_SUPPORT_NOTE,
} from '@/types/speech';

// ── Provider availability detection ───────────────────────────────────────────

export function isWebSpeechSTTAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function isOfflineSTTAvailable(): boolean {
  return false; // Placeholder — future: Whisper WebAssembly
}

export function getBestAvailableSTTProvider(): STTProvider {
  if (isWebSpeechSTTAvailable()) return 'web-speech';
  return 'none';
}

// ── Wake word detection ────────────────────────────────────────────────────────

export function detectWakeWord(transcript: string, config: WakeWordConfig): boolean {
  if (!config.enabled || !config.phrase) return false;
  const normalize = (s: string) =>
    config.caseSensitive ? s.trim() : s.trim().toLowerCase();
  return normalize(transcript).includes(normalize(config.phrase));
}

export function stripWakeWord(transcript: string, config: WakeWordConfig): string {
  if (!config.phrase) return transcript;
  const pattern = new RegExp(
    config.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    config.caseSensitive ? 'g' : 'gi',
  );
  return transcript.replace(pattern, '').trim();
}

// ── Wake word state machine ────────────────────────────────────────────────────

export interface WakeWordStateMachine {
  state: WakeWordState;
  detectedAt: Date | null;
  cooldownUntil: Date | null;
}

export function createWakeWordStateMachine(): WakeWordStateMachine {
  return { state: 'idle', detectedAt: null, cooldownUntil: null };
}

export function transitionWakeWord(
  machine: WakeWordStateMachine,
  event: 'detect' | 'cooldown-expire' | 'reset',
  config: WakeWordConfig,
  now: Date = new Date(),
): WakeWordStateMachine {
  switch (event) {
    case 'detect':
      return {
        state: 'cooldown',
        detectedAt: now,
        cooldownUntil: new Date(now.getTime() + config.cooldownMs),
      };
    case 'cooldown-expire':
      return { state: 'idle', detectedAt: null, cooldownUntil: null };
    case 'reset':
      return { state: 'idle', detectedAt: null, cooldownUntil: null };
    default:
      return machine;
  }
}

export function isWakeWordCooldownExpired(
  machine: WakeWordStateMachine,
  now: Date = new Date(),
): boolean {
  if (!machine.cooldownUntil) return true;
  return now >= machine.cooldownUntil;
}

// ── Null STT Provider (always available, does nothing) ────────────────────────

export class NullSTTProvider implements STTProviderInterface {
  readonly name: STTProvider = 'none';
  readonly isAvailable = true;
  isReady(): boolean { return true; }
  start(_config: STTConfig, _onResult: (r: SpeechRecognitionResult) => void): void {}
  stop(): void {}
}

// ── Offline STT Provider stub ─────────────────────────────────────────────────

export class OfflineSTTProvider implements STTProviderInterface {
  readonly name: STTProvider = 'offline-stt';
  readonly isAvailable = false; // not yet implemented
  isReady(): boolean { return false; }

  start(_config: STTConfig, _onResult: (r: SpeechRecognitionResult) => void): void {
    console.warn('[OfflineSTTProvider]', OFFLINE_STT_NOTE);
  }
  stop(): void {}
}

// ── Transcript filtering ───────────────────────────────────────────────────────

export function normalizeTranscript(raw: string): string {
  return raw.trim().toLowerCase().replace(/[.,!?;:]+$/, '');
}

export function isMeaningfulTranscript(transcript: string, minLength = 2): boolean {
  return transcript.trim().length >= minLength;
}

// ── Emergency speech detection ─────────────────────────────────────────────────

const EMERGENCY_PHRASES: readonly string[] = [
  'emergency stop',
  'stop everything',
  'cancel everything',
  'help',
  'danger',
  'call 999',
  'call 911',
  'call ambulance',
];

export function isEmergencyTranscript(transcript: string): boolean {
  const lower = transcript.toLowerCase().trim();
  return EMERGENCY_PHRASES.some(phrase => lower.includes(phrase));
}

// ── Streaming result buffer ────────────────────────────────────────────────────

export interface StreamingBuffer {
  partials: string[];
  finalised: SpeechRecognitionResult[];
  isListening: boolean;
}

export function createStreamingBuffer(): StreamingBuffer {
  return { partials: [], finalised: [], isListening: false };
}

export function appendInterimResult(buffer: StreamingBuffer, text: string): StreamingBuffer {
  return { ...buffer, partials: [...buffer.partials, text] };
}

export function finalizeFinalResult(
  buffer: StreamingBuffer,
  result: SpeechRecognitionResult,
): StreamingBuffer {
  return {
    partials: [],
    finalised: [...buffer.finalised.slice(-20), result], // keep last 20
    isListening: buffer.isListening,
  };
}

export function getLatestInterim(buffer: StreamingBuffer): string {
  return buffer.partials[buffer.partials.length - 1] ?? '';
}

// ── Status helpers ─────────────────────────────────────────────────────────────

export function describeSTTStatus(status: STTStatus): string {
  switch (status) {
    case 'idle':        return 'Microphone ready';
    case 'listening':   return 'Listening…';
    case 'recognizing': return 'Recognizing speech…';
    case 'error':       return 'Speech recognition error';
    case 'unsupported': return 'Speech recognition not supported in this browser';
    default:            return 'Unknown';
  }
}

export function getSTTProviderInfo(provider: STTProvider): {
  available: boolean;
  note: string;
} {
  switch (provider) {
    case 'web-speech':
      return { available: isWebSpeechSTTAvailable(), note: WEB_SPEECH_SUPPORT_NOTE };
    case 'offline-stt':
      return { available: false, note: OFFLINE_STT_NOTE };
    case 'none':
      return { available: true, note: 'Speech recognition disabled.' };
    default:
      return { available: false, note: 'Unknown provider.' };
  }
}

export { DEFAULT_STT_CONFIG, DEFAULT_WAKE_WORD, OFFLINE_STT_NOTE };

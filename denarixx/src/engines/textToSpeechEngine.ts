/**
 * Text-to-Speech Engine — Sprint 22: Real Perception Integration
 * Priority queue with interrupt support and emergency bypass.
 * Streaming speech events, silence gaps, and voice configuration.
 * No browser API calls here — engines must be testable in Node.js.
 * Reuses guidancePersonalityEngine.ts personality types — does NOT replace them.
 */

import type {
  TTSConfig,
  TTSProvider,
  TTSStatus,
  AlertPriority,
  TtsQueueItem,
  TTSSpokenRecord,
  StreamingSpeechEvent,
  SpeechProviderInterface,
} from '@/types/speech';
import { DEFAULT_TTS_CONFIG, PRIORITY_WEIGHTS } from '@/types/speech';

// ── Priority queue ─────────────────────────────────────────────────────────────

export function createTtsItem(
  text: string,
  priority: AlertPriority,
  interruptIfSpeaking = false,
): TtsQueueItem {
  return {
    id: `tts-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    priority,
    interruptIfSpeaking: interruptIfSpeaking || priority === 'critical',
    addedAt: new Date(),
    speakingStartedAt: null,
  };
}

export function insertIntoQueue(
  queue: TtsQueueItem[],
  item: TtsQueueItem,
): TtsQueueItem[] {
  const next = [...queue, item];
  return sortQueue(next);
}

export function sortQueue(queue: TtsQueueItem[]): TtsQueueItem[] {
  return [...queue].sort((a, b) => {
    const weightDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
    if (weightDiff !== 0) return weightDiff;
    return a.addedAt.getTime() - b.addedAt.getTime();
  });
}

export function dequeueNext(queue: TtsQueueItem[]): {
  item: TtsQueueItem | null;
  remaining: TtsQueueItem[];
} {
  if (queue.length === 0) return { item: null, remaining: [] };
  const [item, ...remaining] = sortQueue(queue);
  return { item, remaining };
}

export function purgeLowPriority(queue: TtsQueueItem[], maxLength = 10): TtsQueueItem[] {
  const sorted = sortQueue(queue);
  return sorted.slice(0, maxLength);
}

export function hasHigherPriorityPending(
  queue: TtsQueueItem[],
  currentPriority: AlertPriority,
): boolean {
  const currentWeight = PRIORITY_WEIGHTS[currentPriority];
  return queue.some(item => PRIORITY_WEIGHTS[item.priority] > currentWeight);
}

// ── Emergency bypass ───────────────────────────────────────────────────────────

export function isEmergencyItem(item: TtsQueueItem): boolean {
  return item.priority === 'critical' && item.interruptIfSpeaking;
}

export function buildEmergencyItem(text: string): TtsQueueItem {
  return createTtsItem(text, 'critical', true);
}

// ── Text preprocessing for TTS ────────────────────────────────────────────────

export function preprocessForTTS(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // ensure spacing after sentences
    .replace(/([,;:])\s*/g, '$1 ')
    .slice(0, 500); // safety cap — TTS engines may truncate long strings
}

export function splitIntoChunks(text: string, maxChars = 200): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current.length + s.length > maxChars) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += ' ' + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

// ── Null TTS Provider (always available, silent) ─────────────────────────────

export class NullTTSProvider implements SpeechProviderInterface {
  readonly name: TTSProvider = 'none';
  readonly isAvailable = true;
  isReady(): boolean { return true; }
  async speak(_text: string, _config: TTSConfig): Promise<void> {}
  interrupt(): void {}
}

// ── Spoken record management ──────────────────────────────────────────────────

export function createSpokenRecord(
  item: TtsQueueItem,
  durationMs: number,
): TTSSpokenRecord {
  return {
    id: item.id,
    text: item.text,
    priority: item.priority,
    spokenAt: new Date(),
    durationMs,
  };
}

export function estimateSpeechDuration(text: string, rateMultiplier = 1.0): number {
  const wordsPerMinute = 150 * rateMultiplier;
  const words = text.split(/\s+/).length;
  return Math.ceil((words / wordsPerMinute) * 60 * 1000);
}

// ── Streaming speech events ───────────────────────────────────────────────────

export function buildStartEvent(text: string): StreamingSpeechEvent {
  return { type: 'start', text };
}

export function buildWordEvent(text: string, wordIndex: number): StreamingSpeechEvent {
  return { type: 'word', text, wordIndex };
}

export function buildEndEvent(): StreamingSpeechEvent {
  return { type: 'end' };
}

export function buildInterruptEvent(): StreamingSpeechEvent {
  return { type: 'interrupt' };
}

export function buildErrorEvent(error: string): StreamingSpeechEvent {
  return { type: 'error', error };
}

// ── Status helpers ─────────────────────────────────────────────────────────────

export function describeTTSStatus(status: TTSStatus): string {
  switch (status) {
    case 'idle':        return 'Voice output ready';
    case 'speaking':    return 'Speaking…';
    case 'interrupted': return 'Speech interrupted';
    case 'error':       return 'Speech output error';
    default:            return 'Unknown';
  }
}

export function getTTSProviderInfo(provider: TTSProvider): {
  available: boolean;
  note: string;
} {
  switch (provider) {
    case 'web-speech':
      return {
        available: typeof window !== 'undefined' && 'speechSynthesis' in window,
        note: 'Web Speech API — real TTS in Chrome, Edge, Firefox, and Safari.',
      };
    case 'offline-tts':
      return {
        available: false,
        note: 'Offline TTS not yet available. Requires WebAssembly TTS engine.',
      };
    case 'none':
      return { available: true, note: 'Voice output disabled.' };
    default:
      return { available: false, note: 'Unknown provider.' };
  }
}

export { DEFAULT_TTS_CONFIG };

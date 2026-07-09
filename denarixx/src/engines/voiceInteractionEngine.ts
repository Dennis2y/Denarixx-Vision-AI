/**
 * Voice Interaction Engine — Sprint 22: Real Perception Integration
 * Orchestrates STT + TTS + wake word state + emergency priority mode.
 * Reuses voiceCommandEngine.ts for command parsing, guidancePersonalityEngine.ts
 * for personality, and useAudioGuidance.ts hook for actual browser speech.
 * No browser API calls here — engines must be testable in Node.js.
 */

import type {
  VoiceInteractionState,
  AlertPriority,
  TTSStatus,
  STTStatus,
  WakeWordState,
  WakeWordConfig,
  TtsQueueItem,
  SpeechMode,
} from '@/types/speech';
import {
  DEFAULT_WAKE_WORD,
  PRIORITY_WEIGHTS,
} from '@/types/speech';
import {
  createWakeWordStateMachine,
  transitionWakeWord,
  isWakeWordCooldownExpired,
  detectWakeWord,
  stripWakeWord,
  isEmergencyTranscript,
  normalizeTranscript,
} from './speechRecognitionEngine';
import {
  createTtsItem,
  insertIntoQueue,
  dequeueNext,
  sortQueue,
  purgeLowPriority,
  buildEmergencyItem,
} from './textToSpeechEngine';

// ── Voice Interaction Session ─────────────────────────────────────────────────

export interface VoiceInteractionSession {
  id: string;
  startedAt: Date;
  mode: SpeechMode;
  wakeWordConfig: WakeWordConfig;
  wakeWordMachine: ReturnType<typeof createWakeWordStateMachine>;
  ttsQueue: TtsQueueItem[];
  ttsStatus: TTSStatus;
  sttStatus: STTStatus;
  isEmergencyMode: boolean;
  lastSpoken: string | null;
  lastRecognized: string | null;
  spokenCount: number;
  recognizedCount: number;
}

export function createVoiceInteractionSession(
  mode: SpeechMode = 'continuous',
  wakeWordConfig: WakeWordConfig = DEFAULT_WAKE_WORD,
): VoiceInteractionSession {
  return {
    id: `voice-${Date.now()}`,
    startedAt: new Date(),
    mode,
    wakeWordConfig,
    wakeWordMachine: createWakeWordStateMachine(),
    ttsQueue: [],
    ttsStatus: 'idle',
    sttStatus: 'idle',
    isEmergencyMode: false,
    lastSpoken: null,
    lastRecognized: null,
    spokenCount: 0,
    recognizedCount: 0,
  };
}

// ── Enqueue speech ─────────────────────────────────────────────────────────────

export function enqueueGuidance(
  session: VoiceInteractionSession,
  text: string,
  priority: AlertPriority = 'normal',
): VoiceInteractionSession {
  const item = createTtsItem(text, priority, priority === 'critical');
  const ttsQueue = purgeLowPriority(insertIntoQueue(session.ttsQueue, item));
  return { ...session, ttsQueue };
}

export function enqueueEmergency(
  session: VoiceInteractionSession,
  text: string,
): VoiceInteractionSession {
  const item = buildEmergencyItem(text);
  // Emergency items go to front — clear low/normal queue
  const filteredQueue = session.ttsQueue.filter(
    i => PRIORITY_WEIGHTS[i.priority] >= PRIORITY_WEIGHTS.high,
  );
  const ttsQueue = sortQueue([item, ...filteredQueue]);
  return { ...session, ttsQueue, isEmergencyMode: true };
}

export function clearEmergencyMode(session: VoiceInteractionSession): VoiceInteractionSession {
  return { ...session, isEmergencyMode: false };
}

// ── Dequeue and mark as speaking ──────────────────────────────────────────────

export function startSpeaking(session: VoiceInteractionSession): {
  item: TtsQueueItem | null;
  session: VoiceInteractionSession;
} {
  const { item, remaining } = dequeueNext(session.ttsQueue);
  if (!item) return { item: null, session: { ...session, ttsStatus: 'idle' } };
  return {
    item,
    session: {
      ...session,
      ttsQueue: remaining,
      ttsStatus: 'speaking',
      lastSpoken: item.text,
      spokenCount: session.spokenCount + 1,
    },
  };
}

export function finishSpeaking(session: VoiceInteractionSession): VoiceInteractionSession {
  const ttsStatus: TTSStatus = session.ttsQueue.length > 0 ? 'speaking' : 'idle';
  return { ...session, ttsStatus };
}

export function interruptSpeaking(session: VoiceInteractionSession): VoiceInteractionSession {
  return { ...session, ttsStatus: 'interrupted' };
}

// ── STT state transitions ──────────────────────────────────────────────────────

export function setSTTListening(session: VoiceInteractionSession): VoiceInteractionSession {
  return { ...session, sttStatus: 'listening' };
}

export function setSTTIdle(session: VoiceInteractionSession): VoiceInteractionSession {
  return { ...session, sttStatus: 'idle' };
}

export function setSTTError(session: VoiceInteractionSession): VoiceInteractionSession {
  return { ...session, sttStatus: 'error' };
}

// ── Process incoming transcript ────────────────────────────────────────────────

export interface TranscriptProcessResult {
  session: VoiceInteractionSession;
  isEmergency: boolean;
  isWakeWord: boolean;
  commandText: string | null;
}

export function processTranscript(
  session: VoiceInteractionSession,
  rawTranscript: string,
  now: Date = new Date(),
): TranscriptProcessResult {
  const normalized = normalizeTranscript(rawTranscript);

  // Emergency check — always takes priority
  if (isEmergencyTranscript(normalized)) {
    return {
      session: {
        ...session,
        sttStatus: 'recognizing',
        lastRecognized: normalized,
        recognizedCount: session.recognizedCount + 1,
        isEmergencyMode: true,
      },
      isEmergency: true,
      isWakeWord: false,
      commandText: normalized,
    };
  }

  // Wake word mode processing
  if (session.mode === 'wake-word') {
    const wakeDetected = detectWakeWord(normalized, session.wakeWordConfig);
    if (wakeDetected) {
      const updatedMachine = transitionWakeWord(
        session.wakeWordMachine, 'detect', session.wakeWordConfig, now,
      );
      const commandText = stripWakeWord(normalized, session.wakeWordConfig);
      return {
        session: {
          ...session,
          wakeWordMachine: updatedMachine,
          sttStatus: 'recognizing',
          lastRecognized: normalized,
          recognizedCount: session.recognizedCount + 1,
        },
        isEmergency: false,
        isWakeWord: true,
        commandText: commandText || null,
      };
    }
    // Check if cooldown has expired
    if (isWakeWordCooldownExpired(session.wakeWordMachine, now)) {
      const updatedMachine = transitionWakeWord(
        session.wakeWordMachine, 'cooldown-expire', session.wakeWordConfig, now,
      );
      return {
        session: { ...session, wakeWordMachine: updatedMachine },
        isEmergency: false,
        isWakeWord: false,
        commandText: null,
      };
    }
    return {
      session,
      isEmergency: false,
      isWakeWord: false,
      commandText: null,
    };
  }

  // Continuous / push-to-talk mode — pass all transcripts
  return {
    session: {
      ...session,
      sttStatus: 'recognizing',
      lastRecognized: normalized,
      recognizedCount: session.recognizedCount + 1,
    },
    isEmergency: false,
    isWakeWord: false,
    commandText: normalized,
  };
}

// ── State snapshot ────────────────────────────────────────────────────────────

export function getVoiceInteractionState(
  session: VoiceInteractionSession,
): VoiceInteractionState {
  const wakeWordState: WakeWordState =
    session.mode === 'wake-word'
      ? (session.wakeWordMachine.state as WakeWordState)
      : 'idle';
  return {
    sttStatus: session.sttStatus,
    ttsStatus: session.ttsStatus,
    wakeWordState,
    isEmergencyMode: session.isEmergencyMode,
    queueLength: session.ttsQueue.length,
    lastSpoken: session.lastSpoken,
    lastRecognized: session.lastRecognized,
    sessionActive: true,
  };
}

// ── Silence / noise gate decision ─────────────────────────────────────────────

export function shouldSpeakNow(
  session: VoiceInteractionSession,
  priority: AlertPriority,
): boolean {
  if (session.ttsStatus !== 'speaking') return true;
  if (priority === 'critical') return true; // always interrupt
  if (priority === 'high' && session.ttsQueue.length === 0) return true;
  return false;
}

// ── Statistics ────────────────────────────────────────────────────────────────

export function getSessionStats(session: VoiceInteractionSession): {
  spokenCount: number;
  recognizedCount: number;
  queueLength: number;
  runningForMs: number;
} {
  return {
    spokenCount: session.spokenCount,
    recognizedCount: session.recognizedCount,
    queueLength: session.ttsQueue.length,
    runningForMs: Date.now() - session.startedAt.getTime(),
  };
}

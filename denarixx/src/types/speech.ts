/**
 * Speech Types — Sprint 22: Real Perception Integration
 * Provider-agnostic TTS and STT types.
 * Never merge into index.ts — keep speech types isolated.
 */

export type TTSProvider = 'web-speech' | 'offline-tts' | 'none';
export type STTProvider = 'web-speech' | 'offline-stt' | 'none';
export type AlertPriority = 'critical' | 'high' | 'normal' | 'low';
export type WakeWordState = 'idle' | 'listening' | 'detected' | 'cooldown';
export type TTSStatus = 'idle' | 'speaking' | 'interrupted' | 'error';
export type STTStatus = 'idle' | 'listening' | 'recognizing' | 'error' | 'unsupported';
export type SpeechMode = 'continuous' | 'push-to-talk' | 'wake-word' | 'off';

export interface TTSConfig {
  provider: TTSProvider;
  rate: number;
  volume: number;
  pitch: number;
  voice: string | null;
  lang: string;
}

export interface STTConfig {
  provider: STTProvider;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export interface TtsQueueItem {
  id: string;
  text: string;
  priority: AlertPriority;
  interruptIfSpeaking: boolean;
  addedAt: Date;
  speakingStartedAt: Date | null;
}

export interface TTSSpokenRecord {
  id: string;
  text: string;
  priority: AlertPriority;
  spokenAt: Date;
  durationMs: number;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  isWakeWord: boolean;
  timestamp: Date;
}

export interface WakeWordConfig {
  phrase: string;
  enabled: boolean;
  cooldownMs: number;
  caseSensitive: boolean;
}

export interface VoiceInteractionState {
  sttStatus: STTStatus;
  ttsStatus: TTSStatus;
  wakeWordState: WakeWordState;
  isEmergencyMode: boolean;
  queueLength: number;
  lastSpoken: string | null;
  lastRecognized: string | null;
  sessionActive: boolean;
}

export interface StreamingSpeechEvent {
  type: 'start' | 'word' | 'end' | 'interrupt' | 'error';
  text?: string;
  wordIndex?: number;
  error?: string;
}

export interface SpeechProviderInterface {
  readonly name: TTSProvider;
  readonly isAvailable: boolean;
  speak(text: string, config: TTSConfig): Promise<void>;
  interrupt(): void;
  isReady(): boolean;
}

export interface STTProviderInterface {
  readonly name: STTProvider;
  readonly isAvailable: boolean;
  start(config: STTConfig, onResult: (r: SpeechRecognitionResult) => void): void;
  stop(): void;
  isReady(): boolean;
}

export const DEFAULT_TTS_CONFIG: TTSConfig = {
  provider: 'web-speech',
  rate: 1.0,
  volume: 0.9,
  pitch: 1.0,
  voice: null,
  lang: 'en-US',
};

export const DEFAULT_STT_CONFIG: STTConfig = {
  provider: 'web-speech',
  lang: 'en-US',
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
};

export const DEFAULT_WAKE_WORD: WakeWordConfig = {
  phrase: 'hey aria',
  enabled: false,
  cooldownMs: 3000,
  caseSensitive: false,
};

export const PRIORITY_WEIGHTS: Record<AlertPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export const OFFLINE_STT_NOTE =
  'Offline speech recognition is not yet available. An internet connection is required for voice commands.';

export const EMERGENCY_PRIORITY_NOTE =
  'Emergency speech bypass: critical alerts always interrupt any ongoing audio immediately.';

export const WEB_SPEECH_SUPPORT_NOTE =
  'Web Speech API is fully supported in Chrome and Edge. Limited support in Firefox. Not available in Safari on iOS.';

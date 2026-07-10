'use client';

/**
 * useAudioGuidance (V5)
 *
 * Priority-queued speech synthesis hook. Settings (rate, volume, voice)
 * are applied per-utterance from a mutable ref — callers can call
 * updateSettings() at any time without re-mounting the hook.
 */

import { useCallback, useEffect, useRef } from 'react';

export type AudioPriority = 'critical' | 'high' | 'normal' | 'low';

export interface AudioSettings {
  rate: number;
  volume: number;
  voiceName: string;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  rate: 1.0,
  volume: 1.0,
  voiceName: '',
};

interface QueueItem {
  text: string;
  priority: AudioPriority;
  interrupt: boolean;
}

const PRIORITY_ORDER: Record<AudioPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export function useAudioGuidance(initialSettings?: Partial<AudioSettings>) {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const isSpeakingRef = useRef(false);
  const settingsRef = useRef<AudioSettings>({
    ...DEFAULT_AUDIO_SETTINGS,
    ...initialSettings,
  });

  const getSynth = useCallback((): SpeechSynthesis | null => {
    if (typeof window === 'undefined') return null;
    if (!synthRef.current) synthRef.current = window.speechSynthesis;
    return synthRef.current;
  }, []);

  /** Find the best matching voice by name. Empty name → system default. */
  const resolveVoice = useCallback(
    (synth: SpeechSynthesis, name: string): SpeechSynthesisVoice | undefined => {
      if (!name) return undefined;
      const voices = synth.getVoices();
      return voices.find((v) => v.name === name) ?? undefined;
    },
    []
  );

  const processQueue = useCallback(() => {
    const synth = getSynth();
    if (!synth || isSpeakingRef.current || queueRef.current.length === 0) return;

    const item = queueRef.current.shift()!;
    isSpeakingRef.current = true;

    const utterance = new SpeechSynthesisUtterance(item.text);
    const s = settingsRef.current;
    utterance.rate = Math.max(0.1, Math.min(10, s.rate));
    utterance.volume = Math.max(0, Math.min(1, s.volume));

    const voice = resolveVoice(synth, s.voiceName);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      isSpeakingRef.current = false;
      processQueue();
    };
    utterance.onerror = () => {
      isSpeakingRef.current = false;
      processQueue();
    };

    synth.speak(utterance);
  }, [getSynth, resolveVoice]);

  const speak = useCallback(
    (text: string, priority: AudioPriority = 'normal', interrupt = false) => {
      const synth = getSynth();
      if (!synth) return;

      if (interrupt || priority === 'critical') {
        synth.cancel();
        isSpeakingRef.current = false;
        queueRef.current = [];
      }

      const item: QueueItem = { text, priority, interrupt };
      const insertAt = queueRef.current.findIndex(
        (q) => PRIORITY_ORDER[q.priority] < PRIORITY_ORDER[priority]
      );
      if (insertAt === -1) {
        queueRef.current.push(item);
      } else {
        queueRef.current.splice(insertAt, 0, item);
      }

      processQueue();
    },
    [getSynth, processQueue]
  );

  const stop = useCallback(() => {
    const synth = getSynth();
    if (synth) {
      synth.cancel();
      isSpeakingRef.current = false;
      queueRef.current = [];
    }
  }, [getSynth]);

  /** Update speech settings live — applies to all subsequent utterances */
  const updateSettings = useCallback((patch: Partial<AudioSettings>) => {
    settingsRef.current = { ...settingsRef.current, ...patch };
  }, []);

  /** Returns all available voices — empty array in SSR or before voices load */
  const getVoices = useCallback((): SpeechSynthesisVoice[] => {
    return getSynth()?.getVoices() ?? [];
  }, [getSynth]);

  // Sync voices after the browser loads them asynchronously
  useEffect(() => {
    const synth = getSynth();
    if (!synth) return;
    const handler = () => { /* voices updated — no state needed */ };
    synth.addEventListener('voiceschanged', handler);
    return () => synth.removeEventListener('voiceschanged', handler);
  }, [getSynth]);

  return { speak, stop, updateSettings, getVoices };
}

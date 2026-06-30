'use client';

import { useCallback, useRef } from 'react';

export type AudioPriority = 'critical' | 'high' | 'normal' | 'low';

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

export function useAudioGuidance() {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const isSpeakingRef = useRef(false);

  const getSynth = useCallback((): SpeechSynthesis | null => {
    if (typeof window === 'undefined') return null;
    if (!synthRef.current) synthRef.current = window.speechSynthesis;
    return synthRef.current;
  }, []);

  const processQueue = useCallback(() => {
    const synth = getSynth();
    if (!synth || isSpeakingRef.current || queueRef.current.length === 0) return;

    const item = queueRef.current.shift()!;
    isSpeakingRef.current = true;

    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.rate = 1.1;
    utterance.volume = 1;
    utterance.onend = () => {
      isSpeakingRef.current = false;
      processQueue();
    };
    utterance.onerror = () => {
      isSpeakingRef.current = false;
      processQueue();
    };

    synth.speak(utterance);
  }, [getSynth]);

  const speak = useCallback(
    (text: string, priority: AudioPriority = 'normal', interrupt = false) => {
      const synth = getSynth();
      if (!synth) return;

      if (interrupt || priority === 'critical') {
        synth.cancel();
        isSpeakingRef.current = false;
        queueRef.current = [];
      }

      // Insert at correct priority position
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

  return { speak, stop };
}

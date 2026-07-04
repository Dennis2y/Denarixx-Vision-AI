'use client';

/**
 * useLastGuidance (V5)
 *
 * Tracks the last spoken guidance message with its context (risk level,
 * confidence, reason). The ref-based store is safe inside setInterval
 * closures — always reads the latest value without stale closure issues.
 */

import { useCallback, useRef, useState } from 'react';
import type { AudioPriority } from './useAudioGuidance';

export type { AudioPriority };

export interface GuidanceRecord {
  text: string;
  riskLevel: string;
  confidence: number;
  reason: string;
  priority: AudioPriority;
  timestamp: Date;
}

export interface UseLastGuidanceReturn {
  lastGuidance: GuidanceRecord | null;
  setGuidance: (record: GuidanceRecord) => void;
  repeatGuidance: (
    speak: (text: string, priority: AudioPriority, interrupt?: boolean) => void
  ) => void;
  clearGuidance: () => void;
}

export function useLastGuidance(): UseLastGuidanceReturn {
  const [lastGuidance, setLastGuidanceState] = useState<GuidanceRecord | null>(null);
  const lastGuidanceRef = useRef<GuidanceRecord | null>(null);

  const setGuidance = useCallback((record: GuidanceRecord) => {
    lastGuidanceRef.current = record;
    setLastGuidanceState(record);
  }, []);

  const repeatGuidance = useCallback(
    (speak: (text: string, priority: AudioPriority, interrupt?: boolean) => void) => {
      const rec = lastGuidanceRef.current;
      if (!rec) {
        speak('No previous guidance available. Session has not detected any alerts yet.', 'normal', true);
        return;
      }
      const timeSec = Math.round((Date.now() - rec.timestamp.getTime()) / 1000);
      const ago = timeSec < 60
        ? `${timeSec} seconds ago`
        : `${Math.round(timeSec / 60)} minutes ago`;
      speak(`Last guidance, ${ago}: ${rec.text}`, rec.priority, true);
    },
    []
  );

  const clearGuidance = useCallback(() => {
    lastGuidanceRef.current = null;
    setLastGuidanceState(null);
  }, []);

  return { lastGuidance, setGuidance, repeatGuidance, clearGuidance };
}

'use client';

/**
 * useVoiceCommands (V5)
 *
 * Listens for speech via the Web Speech API and routes recognized text
 * through VoiceCommandEngine. Falls back gracefully when the API is
 * unavailable (Firefox, Safari, non-HTTPS).
 *
 * Minimal browser types are declared inline so this file compiles
 * regardless of whether lib.dom includes the Speech Recognition API.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceCommandEngine } from '@/engines/voiceCommandEngine';
import type { ParsedVoiceCommand, VoiceCommandType } from '@/engines/voiceCommandEngine';

export type { ParsedVoiceCommand, VoiceCommandType };

// ─── Inline Web Speech API type declarations ──────────────────────────────────
// These aren't in all TypeScript DOM builds, so we declare them locally.

interface ISpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): ISpeechRecognitionAlternative;
  readonly [index: number]: ISpeechRecognitionAlternative;
}

interface ISpeechRecognitionResultList {
  readonly length: number;
  item(index: number): ISpeechRecognitionResult;
  readonly [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: ISpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
}

type SpeechRecognitionCtor = new () => ISpeechRecognition;

// ─── Hook ─────────────────────────────────────────────────────────────────────

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition ??
    null
  );
}

export interface UseVoiceCommandsReturn {
  isListening: boolean;
  isSupported: boolean;
  lastTranscript: string;
  lastCommand: ParsedVoiceCommand | null;
  startListening: () => void;
  stopListening: () => void;
}

export function useVoiceCommands(
  onCommand: (cmd: ParsedVoiceCommand) => void
): UseVoiceCommandsReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState<ParsedVoiceCommand | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const engineRef = useRef(new VoiceCommandEngine());
  const onCommandRef = useRef(onCommand);
  const shouldRestartRef = useRef(false);
  onCommandRef.current = onCommand;

  useEffect(() => {
    setIsSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const createRecognition = useCallback((): ISpeechRecognition | null => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal && result[0]) {
          transcript += result[0].transcript;
        }
      }
      if (!transcript.trim()) return;

      setLastTranscript(transcript.trim());
      const cmd = engineRef.current.parse(transcript.trim());
      setLastCommand(cmd);
      if (cmd.command !== 'unknown') {
        onCommandRef.current(cmd);
      }
    };

    recognition.onend = () => {
      if (shouldRestartRef.current && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { /* ignore */ }
      }
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldRestartRef.current = false;
        recognitionRef.current = null;
        setIsListening(false);
      }
    };

    return recognition;
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || recognitionRef.current) return;
    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    shouldRestartRef.current = true;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      shouldRestartRef.current = false;
    }
  }, [isSupported, createRecognition]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setLastTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isListening, isSupported, lastTranscript, lastCommand, startListening, stopListening };
}

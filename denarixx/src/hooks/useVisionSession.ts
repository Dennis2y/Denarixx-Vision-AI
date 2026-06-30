'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioGuidance } from './useAudioGuidance';
import type { Detection, HazardAlert, SceneDescription, SafetyDecision } from '@/types';

export interface SessionState {
  sessionId: string | null;
  isActive: boolean;
  isLoading: boolean;
  frameCount: number;
  alertCount: number;
  currentScene: SceneDescription | null;
  currentAlerts: HazardAlert[];
  currentDecision: SafetyDecision | null;
  log: string[];
  error: string | null;
}

const SIMULATION_INTERVAL_MS = 3000;

export function useVisionSession() {
  const { speak, stop: stopAudio } = useAudioGuidance();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [state, setState] = useState<SessionState>({
    sessionId: null,
    isActive: false,
    isLoading: false,
    frameCount: 0,
    alertCount: 0,
    currentScene: null,
    currentAlerts: [],
    currentDecision: null,
    log: [],
    error: null,
  });

  const addLog = useCallback((msg: string) => {
    setState((s) => ({
      ...s,
      log: [`[${new Date().toLocaleTimeString()}] ${msg}`, ...s.log].slice(0, 50),
    }));
  }, []);

  const runFrame = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    try {
      // 1. Analyze frame
      const visionRes = await fetch('/api/vision/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, source: 'simulation' }),
      });
      const { data: visionData } = await visionRes.json();
      const detections: Detection[] = visionData.detections ?? [];

      setState((s) => ({ ...s, frameCount: s.frameCount + 1 }));

      // 2. Describe scene
      const sceneRes = await fetch('/api/scene/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, source: 'simulation', detections }),
      });
      const { data: sceneData } = await sceneRes.json();
      const scene: SceneDescription = sceneData.scene;

      setState((s) => ({ ...s, currentScene: scene }));
      addLog(`Scene: ${scene.summary}`);

      // 3. Evaluate hazards
      const hazardRes = await fetch('/api/hazards/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, detections }),
      });
      const { data: hazardData } = await hazardRes.json();
      const alerts: HazardAlert[] = hazardData.alerts ?? [];

      // 4. Safety decision
      const safetyRes = await fetch('/api/safety/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, alerts }),
      });
      const { data: safetyData } = await safetyRes.json();
      const decision: SafetyDecision = safetyData.decision;

      setState((s) => ({
        ...s,
        currentAlerts: alerts,
        currentDecision: decision,
        alertCount: s.alertCount + alerts.length,
      }));

      // 5. Audio output — speak alerts first, then scene
      if (decision.shouldAlert && decision.message) {
        const priority =
          decision.urgency === 'critical'
            ? 'critical'
            : decision.urgency === 'high'
            ? 'high'
            : 'normal';
        speak(decision.message, priority, decision.interruptNarration);
        addLog(`ALERT [${decision.urgency}]: ${decision.message}`);
      } else if (!scene.isUncertain) {
        speak(scene.summary, 'low');
      } else if (scene.uncertaintyMessage) {
        speak(scene.uncertaintyMessage, 'normal');
        addLog(`Uncertainty: ${scene.uncertaintyMessage}`);
      }

      // 6. Memory recall check
      const memoryRes = await fetch('/api/memory');
      const { data: memData } = await memoryRes.json();
      const sceneLower = scene.summary.toLowerCase();
      const recalled = (memData.items ?? []).find(
        (m: { label: string }) =>
          sceneLower.includes(m.label.toLowerCase()) ||
          m.label.toLowerCase().split(' ').some((w: string) => sceneLower.includes(w))
      );
      if (recalled) {
        const memMsg = `You are near a previously saved location: ${recalled.label}.`;
        speak(memMsg, 'normal');
        addLog(`Memory recall: ${memMsg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Error: ${msg}`);
      setState((s) => ({ ...s, error: msg }));
    }
  }, [speak, addLog]);

  const startSession = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch('/api/sessions/start', { method: 'POST' });
      const { data } = await res.json();
      sessionIdRef.current = data.sessionId;
      setState((s) => ({
        ...s,
        sessionId: data.sessionId,
        isActive: true,
        isLoading: false,
        frameCount: 0,
        alertCount: 0,
        log: [],
        currentAlerts: [],
        currentScene: null,
        currentDecision: null,
      }));
      speak('Vision session started. Scanning your surroundings.', 'high', true);
      addLog('Session started');
      intervalRef.current = setInterval(runFrame, SIMULATION_INTERVAL_MS);
      runFrame();
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to start',
      }));
    }
  }, [speak, addLog, runFrame]);

  const stopSession = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopAudio();
    const sid = sessionIdRef.current;
    if (sid) {
      await fetch('/api/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      }).catch(() => {});
    }
    sessionIdRef.current = null;
    setState((s) => ({ ...s, isActive: false, sessionId: null }));
    addLog('Session ended');
  }, [stopAudio, addLog]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { state, startSession, stopSession };
}

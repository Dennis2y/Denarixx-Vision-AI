'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioGuidance } from './useAudioGuidance';
import { useCameraCapture } from './useCameraCapture';
import type { CameraStatus } from './useCameraCapture';
import type { Detection, HazardAlert, SceneDescription, SafetyDecision } from '@/types';

export type { CameraStatus };

export interface SessionReport {
  sessionId: string;
  durationSeconds: number;
  frameCount: number;
  alertCount: number;
  audioCount: number;
  peakUrgency: string;
  completedSteps: boolean[];
  cameraFrames: number;
}

export interface SessionState {
  sessionId: string | null;
  isActive: boolean;
  isLoading: boolean;
  frameCount: number;
  alertCount: number;
  cameraFrames: number;
  currentScene: SceneDescription | null;
  currentAlerts: HazardAlert[];
  currentDecision: SafetyDecision | null;
  log: string[];
  error: string | null;
  completedSteps: boolean[];
  audioCount: number;
  report: SessionReport | null;
}

const FRAME_INTERVAL_MS = 3000;
const BLANK_STEPS = [false, false, false, false, false, false, false];

export function useVisionSession() {
  const { speak, stop: stopAudio } = useAudioGuidance();
  const camera = useCameraCapture();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const audioCountRef = useRef(0);
  const cameraFramesRef = useRef(0);
  const peakUrgencyRef = useRef<string>('none');
  const currentSceneRef = useRef<SceneDescription | null>(null);

  // Refs for camera access inside the interval callback (avoids stale closures)
  const cameraStatusRef = useRef<CameraStatus>('inactive');
  const captureFrameRef = useRef<typeof camera.captureFrame>(camera.captureFrame);
  cameraStatusRef.current = camera.status;
  captureFrameRef.current = camera.captureFrame;

  const [state, setState] = useState<SessionState>({
    sessionId: null,
    isActive: false,
    isLoading: false,
    frameCount: 0,
    alertCount: 0,
    cameraFrames: 0,
    currentScene: null,
    currentAlerts: [],
    currentDecision: null,
    log: [],
    error: null,
    completedSteps: [...BLANK_STEPS],
    audioCount: 0,
    report: null,
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

    // Capture real camera frame if available; fall back to simulation
    const isCamera = cameraStatusRef.current === 'active';
    const imageData = isCamera ? captureFrameRef.current() : null;
    const source = imageData ? 'camera' : 'simulation';

    try {
      // 1. Analyze frame
      const visionRes = await fetch('/api/vision/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, source, imageData: imageData ?? undefined }),
      });
      const { data: visionData } = await visionRes.json();
      const detections: Detection[] = visionData.detections ?? [];

      setState((s) => {
        const newCount = s.frameCount + 1;
        const camCount = s.cameraFrames + (imageData ? 1 : 0);
        const steps = [...s.completedSteps];
        if (newCount >= 2) steps[1] = true; // Step 2: walking
        return { ...s, frameCount: newCount, cameraFrames: camCount, completedSteps: steps };
      });
      if (imageData) cameraFramesRef.current += 1;

      // 2. Describe scene
      const sceneRes = await fetch('/api/scene/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, source, detections }),
      });
      const { data: sceneData } = await sceneRes.json();
      const scene: SceneDescription = sceneData.scene;
      currentSceneRef.current = scene;

      setState((s) => ({ ...s, currentScene: scene }));
      addLog(`Scene [${source}]: ${scene.summary}`);

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

      // Track peak urgency
      if (decision.urgency !== 'none') {
        const rank = { critical: 4, high: 3, medium: 2, low: 1, none: 0 } as const;
        const cur = rank[peakUrgencyRef.current as keyof typeof rank] ?? 0;
        const inc = rank[decision.urgency as keyof typeof rank] ?? 0;
        if (inc > cur) peakUrgencyRef.current = decision.urgency;
      }

      setState((s) => {
        const steps = [...s.completedSteps];
        if (alerts.length > 0) steps[2] = true; // Step 3: alert
        if (decision.shouldAlert) steps[3] = true; // Step 4: guardian
        return {
          ...s,
          currentAlerts: alerts,
          currentDecision: decision,
          alertCount: s.alertCount + alerts.length,
          completedSteps: steps,
        };
      });

      // 5. Audio output
      if (decision.shouldAlert && decision.message) {
        const priority =
          decision.urgency === 'critical'
            ? 'critical'
            : decision.urgency === 'high'
            ? 'high'
            : 'normal';
        speak(decision.message, priority, decision.interruptNarration);
        audioCountRef.current += 1;
        setState((s) => {
          const steps = [...s.completedSteps];
          steps[4] = true; // Step 5: audio spoken
          return { ...s, audioCount: s.audioCount + 1, completedSteps: steps };
        });
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
      startTimeRef.current = Date.now();
      audioCountRef.current = 0;
      cameraFramesRef.current = 0;
      peakUrgencyRef.current = 'none';
      currentSceneRef.current = null;
      setState((s) => ({
        ...s,
        sessionId: data.sessionId,
        isActive: true,
        isLoading: false,
        frameCount: 0,
        alertCount: 0,
        cameraFrames: 0,
        audioCount: 0,
        log: [],
        currentAlerts: [],
        currentScene: null,
        currentDecision: null,
        completedSteps: [true, false, false, false, false, false, false],
        report: null,
      }));

      const mode = cameraStatusRef.current === 'active' ? 'camera mode' : 'simulation mode';
      speak(`Vision session started in ${mode}. Scanning your surroundings.`, 'high', true);
      addLog(`Session started · ${mode}`);
      intervalRef.current = setInterval(runFrame, FRAME_INTERVAL_MS);
      runFrame();
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to start',
      }));
    }
  }, [speak, addLog, runFrame]);

  const saveMemoryEvent = useCallback(async () => {
    const scene = currentSceneRef.current;
    const label = `Session location — ${new Date().toLocaleTimeString()}`;
    const description = scene ? scene.summary : 'Location saved during vision session';
    try {
      await fetch('/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'location',
          label,
          description,
          metadata: { savedFromSession: true },
        }),
      });
      setState((s) => {
        const steps = [...s.completedSteps];
        steps[5] = true; // Step 6: memory saved
        return { ...s, completedSteps: steps };
      });
      addLog(`Memory saved: ${label}`);
    } catch {
      addLog('Error: could not save memory event');
    }
  }, [addLog]);

  const stopSession = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopAudio();
    const sid = sessionIdRef.current;
    const durationSeconds = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0;

    if (sid) {
      await fetch('/api/sessions/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      }).catch(() => {});
    }
    sessionIdRef.current = null;

    setState((s) => {
      const steps = [...s.completedSteps];
      steps[6] = true; // Step 7: report
      const report: SessionReport = {
        sessionId: sid ?? 'unknown',
        durationSeconds,
        frameCount: s.frameCount,
        alertCount: s.alertCount,
        audioCount: audioCountRef.current,
        peakUrgency: peakUrgencyRef.current,
        completedSteps: steps,
        cameraFrames: cameraFramesRef.current,
      };
      return { ...s, isActive: false, sessionId: null, completedSteps: steps, report };
    });
    addLog('Session ended');
  }, [stopAudio, addLog]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    state,
    cameraStatus: camera.status,
    videoRef: camera.videoRef,
    canvasRef: camera.canvasRef,
    startSession,
    stopSession,
    saveMemoryEvent,
    startCamera: camera.requestCamera,
    stopCamera: camera.stopCamera,
  };
}

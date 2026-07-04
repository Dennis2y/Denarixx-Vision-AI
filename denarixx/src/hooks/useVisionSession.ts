'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioGuidance } from './useAudioGuidance';
import { useCameraCapture } from './useCameraCapture';
import type { CameraStatus } from './useCameraCapture';
import { useDeviceSensors } from './useDeviceSensors';
import { AlertThrottleEngine } from '@/engines/alertThrottleEngine';
import { GuidancePersonalityEngine } from '@/engines/guidancePersonalityEngine';
import type { PersonalityRiskLevel } from '@/engines/guidancePersonalityEngine';
import { MobilityEngine } from '@/engines/mobilityEngine';
import { WorldModelEngine } from '@/engines/worldModelEngine';
import { SensorFusionEngine } from '@/engines/sensorFusionEngine';
import { useLastGuidance } from './useLastGuidance';
import { loadSettings } from '@/lib/settingsStore';
import type { Detection, HazardAlert, SceneDescription, SafetyDecision } from '@/types';
import type { WorldModelSnapshot } from '@/types/spatial';
import type { SensorContext, VibrationPattern } from '@/types/sensors';

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
  silencedAlerts: number;
}

export interface SessionState {
  sessionId: string | null;
  isActive: boolean;
  isLoading: boolean;
  frameCount: number;
  alertCount: number;
  cameraFrames: number;
  silencedAlerts: number;
  currentScene: SceneDescription | null;
  currentAlerts: HazardAlert[];
  currentDecision: SafetyDecision | null;
  log: string[];
  error: string | null;
  completedSteps: boolean[];
  audioCount: number;
  report: SessionReport | null;
  // V6: live spatial intelligence snapshot
  spatialData: WorldModelSnapshot | null;
  // V7: live sensor context
  sensorContext: SensorContext | null;
}

const FRAME_INTERVAL_MS = 3000;
const BLANK_STEPS = [false, false, false, false, false, false, false];
const VALID_RISK_LEVELS = new Set<PersonalityRiskLevel>(['critical','high','medium','low','none']);

function toPersonalityRisk(urgency: string): PersonalityRiskLevel {
  return VALID_RISK_LEVELS.has(urgency as PersonalityRiskLevel)
    ? (urgency as PersonalityRiskLevel)
    : 'none';
}

export function useVisionSession() {
  const { speak, stop: stopAudio, updateSettings } = useAudioGuidance();
  const camera = useCameraCapture();
  const { lastGuidance, setGuidance, repeatGuidance } = useLastGuidance();

  // ── V7: Sensor integration ─────────────────────────────────────────────────
  const {
    sensorContext,
    requestGPS,
    requestMotionSensors,
    stopGPS,
    vibrate: vibrateRaw,
    isGPSSupported,
    isMotionSupported,
  } = useDeviceSensors(true);

  // Stable refs for closures
  const sensorContextRef = useRef<SensorContext | null>(null);
  const sensorFusionEngineRef = useRef(new SensorFusionEngine());

  // Keep ref in sync with hook state
  useEffect(() => {
    sensorContextRef.current = sensorContext;
  }, [sensorContext]);

  // Engine refs
  const alertThrottleRef = useRef(new AlertThrottleEngine());
  const personalityEngineRef = useRef(new GuidancePersonalityEngine());
  const mobilityEngineRef = useRef(new MobilityEngine());
  const worldModelEngineRef = useRef(new WorldModelEngine());

  // Session refs (stale-closure proof)
  const sessionIdRef = useRef<string | null>(null);
  const sessionSettingsRef = useRef(loadSettings());
  const cameraStatusRef = useRef<CameraStatus>('inactive');
  const captureFrameRef = useRef<() => string | null>(() => null);
  const audioCountRef = useRef(0);
  const cameraFramesRef = useRef(0);
  const silencedAlertsRef = useRef(0);
  const peakUrgencyRef = useRef('none');
  const startTimeRef = useRef<number | null>(null);
  const lastAlertTimeRef = useRef<number | null>(null);
  const prevSceneSummaryRef = useRef<string | null>(null);
  const currentSceneRef = useRef<SceneDescription | null>(null);
  const prevSpatialInstructionRef = useRef<string | undefined>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // V7: track last frame time for battery-aware frame skipping
  const lastFrameTimeRef = useRef<number>(0);

  // Keep camera refs in sync
  useEffect(() => {
    cameraStatusRef.current = camera.status;
    captureFrameRef.current = camera.captureFrame;
  }, [camera.status, camera.captureFrame]);

  const [state, setState] = useState<SessionState>({
    sessionId: null,
    isActive: false,
    isLoading: false,
    frameCount: 0,
    alertCount: 0,
    cameraFrames: 0,
    silencedAlerts: 0,
    currentScene: null,
    currentAlerts: [],
    currentDecision: null,
    log: [],
    error: null,
    completedSteps: [...BLANK_STEPS],
    audioCount: 0,
    report: null,
    spatialData: null,
    sensorContext: null,
  });

  const addLog = useCallback((msg: string) => {
    setState((s) => ({
      ...s,
      log: [`[${new Date().toLocaleTimeString()}] ${msg}`, ...s.log].slice(0, 50),
    }));
  }, []);

  // Expose vibrate respecting the vibrationEnabled setting
  const vibrate = useCallback((pattern: VibrationPattern): boolean => {
    if (!sessionSettingsRef.current.vibrationEnabled) return false;
    return vibrateRaw(pattern);
  }, [vibrateRaw]);

  const runFrame = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    // V7: Battery-aware frame skipping
    const sensorCtx = sensorContextRef.current;
    const recommended = sensorFusionEngineRef.current.recommendedFrameInterval(
      sensorCtx?.motionState ?? 'unknown',
      sensorCtx?.isLowPowerMode ?? false
    );
    const now = Date.now();
    if (now - lastFrameTimeRef.current < recommended && lastFrameTimeRef.current > 0) {
      return; // skip this tick — too soon based on motion/battery state
    }
    lastFrameTimeRef.current = now;

    const isCamera = cameraStatusRef.current === 'active';
    const imageData = isCamera ? captureFrameRef.current() : null;
    const source = imageData ? 'camera' : 'simulation';

    const personality = sessionSettingsRef.current.guidancePersonality;
    const personalityEngine = personalityEngineRef.current;

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
        if (newCount >= 2) steps[1] = true;
        return { ...s, frameCount: newCount, cameraFrames: camCount, completedSteps: steps };
      });
      if (imageData) cameraFramesRef.current += 1;

      // V6 + V7: Spatial analysis — runs from detections immediately after vision
      const currentFrame = worldModelEngineRef.current.getFrameCount();
      const rawSpatial = mobilityEngineRef.current.analyze(
        {
          detections,
          frameIndex: currentFrame,
          source,
          sensorContext: sensorContextRef.current ?? undefined,
        },
        currentFrame
      );
      const enrichedSpatial = worldModelEngineRef.current.update(rawSpatial);

      // Expose both spatial + sensor context in state
      setState((s) => ({
        ...s,
        spatialData: enrichedSpatial,
        sensorContext: sensorContextRef.current,
      }));

      // 2. Describe scene
      const sceneRes = await fetch('/api/scene/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, source, detections }),
      });
      const { data: sceneData } = await sceneRes.json();
      const scene: SceneDescription = sceneData.scene;
      currentSceneRef.current = scene;

      const sceneChanged = prevSceneSummaryRef.current !== scene.summary;
      prevSceneSummaryRef.current = scene.summary;
      setState((s) => ({ ...s, currentScene: scene }));

      if (sceneChanged) {
        addLog(`Scene [${source}]: ${scene.summary}`);
      } else {
        addLog(`[scene] Unchanged · ${scene.summary.slice(0, 50)}${scene.summary.length > 50 ? '…' : ''}`);
      }

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
        if (alerts.length > 0) steps[2] = true;
        if (decision.shouldAlert) steps[3] = true;
        return {
          ...s,
          currentAlerts: alerts,
          currentDecision: decision,
          alertCount: s.alertCount + alerts.length,
          completedSteps: steps,
        };
      });

      // 5. Audio output — throttle + personality aware
      if (decision.shouldAlert && decision.message) {
        const topAlert = alerts[0];
        const riskLevel = toPersonalityRisk(decision.urgency);

        if (topAlert) {
          const throttleResult = alertThrottleRef.current.shouldSpeak({
            hazardType: topAlert.type,
            severity: topAlert.severity,
            confidence: topAlert.confidence,
            message: decision.message,
          });

          if (throttleResult.shouldSpeak) {
            if (!personalityEngine.shouldSpeak(riskLevel, personality)) {
              silencedAlertsRef.current += 1;
              setState((s) => ({ ...s, silencedAlerts: s.silencedAlerts + 1 }));
              addLog(`[${personality}] Silenced: ${personalityEngine.getSilenceReason(riskLevel, personality)}`);
            } else {
              const priority =
                decision.urgency === 'critical' ? 'critical' :
                decision.urgency === 'high' ? 'high' : 'normal';

              const formattedMessage = personalityEngine.formatMessage(
                decision.message, personality, riskLevel
              );

              speak(formattedMessage, priority, decision.interruptNarration);

              // V7: haptic feedback for high/critical alerts
              if (decision.urgency === 'critical') vibrate('critical');
              else if (decision.urgency === 'high') vibrate('high');
              else if (decision.urgency === 'medium') vibrate('medium');

              alertThrottleRef.current.record(
                topAlert.type, topAlert.severity, topAlert.confidence, formattedMessage
              );

              lastAlertTimeRef.current = Date.now();
              audioCountRef.current += 1;

              setGuidance({
                text: formattedMessage,
                riskLevel: decision.urgency,
                confidence: topAlert.confidence,
                reason: `${topAlert.type} hazard detected`,
                priority,
                timestamp: new Date(),
              });

              setState((s) => {
                const steps = [...s.completedSteps];
                steps[4] = true;
                return { ...s, audioCount: s.audioCount + 1, completedSteps: steps };
              });
              addLog(`ALERT [${decision.urgency}]: ${formattedMessage}`);
            }
          } else {
            silencedAlertsRef.current += 1;
            setState((s) => ({ ...s, silencedAlerts: s.silencedAlerts + 1 }));
            addLog(`[quiet] ${topAlert.type} · ${throttleResult.reason}`);
          }
        } else {
          const priority = decision.urgency === 'critical' ? 'critical' : decision.urgency === 'high' ? 'high' : 'normal';
          speak(decision.message, priority, decision.interruptNarration);

          // V7: haptic for no-top-alert path too
          if (decision.urgency === 'critical') vibrate('critical');
          else if (decision.urgency === 'high') vibrate('high');

          audioCountRef.current += 1;
          setGuidance({
            text: decision.message,
            riskLevel: decision.urgency,
            confidence: 0.7,
            reason: 'Safety decision triggered',
            priority,
            timestamp: new Date(),
          });
          setState((s) => {
            const steps = [...s.completedSteps];
            steps[4] = true;
            return { ...s, audioCount: s.audioCount + 1, completedSteps: steps };
          });
          addLog(`ALERT [${decision.urgency}]: ${decision.message}`);
        }
      } else {
        // No hazard alert — V6 spatial guidance or companion reassurance
        const secondsSinceAlert = lastAlertTimeRef.current
          ? (Date.now() - lastAlertTimeRef.current) / 1000
          : 999;

        if (personalityEngine.shouldReassure(personality, secondsSinceAlert)) {
          const reassurance = personalityEngine.getReassurance(personality);
          speak(reassurance, 'low');
          lastAlertTimeRef.current = Date.now();
          addLog(`[companion] ${reassurance}`);
        } else {
          // V6 spatial mobility guidance (advisory only)
          // V7: prepend motion note when relevant
          const motionNote = sensorCtx
            ? sensorFusionEngineRef.current.motionNote(sensorCtx.motionState)
            : null;

          const spatialGuidance = mobilityEngineRef.current.generateGuidance(
            enrichedSpatial,
            prevSpatialInstructionRef.current
          );
          if (spatialGuidance) {
            prevSpatialInstructionRef.current = enrichedSpatial.recommendation.instruction;
            const fullGuidance = motionNote
              ? `${motionNote} ${spatialGuidance}`
              : spatialGuidance;
            speak(fullGuidance, 'low');
            addLog(`[spatial] ${fullGuidance}`);
          } else if (!scene.isUncertain && sceneChanged) {
            speak(scene.summary, 'low');
          } else if (scene.uncertaintyMessage && sceneChanged) {
            speak(scene.uncertaintyMessage, 'normal');
            addLog(`Uncertainty: ${scene.uncertaintyMessage}`);
          }
        }
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
  }, [speak, addLog, setGuidance, vibrate]);

  const startSession = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const settings = loadSettings();
      sessionSettingsRef.current = settings;
      updateSettings({ rate: settings.speechRate, volume: settings.speechVolume, voiceName: settings.voiceName });

      // V7: start sensors if enabled
      if (settings.locationEnabled) requestGPS();
      if (settings.motionEnabled) requestMotionSensors();

      const res = await fetch('/api/sessions/start', { method: 'POST' });
      const { data } = await res.json();
      sessionIdRef.current = data.sessionId;
      startTimeRef.current = Date.now();
      audioCountRef.current = 0;
      cameraFramesRef.current = 0;
      silencedAlertsRef.current = 0;
      peakUrgencyRef.current = 'none';
      currentSceneRef.current = null;
      prevSceneSummaryRef.current = null;
      lastAlertTimeRef.current = null;
      prevSpatialInstructionRef.current = undefined;
      lastFrameTimeRef.current = 0;
      alertThrottleRef.current.reset();
      personalityEngineRef.current.reset();
      worldModelEngineRef.current.reset();
      sensorFusionEngineRef.current.reset();

      setState((s) => ({
        ...s,
        sessionId: data.sessionId,
        isActive: true,
        isLoading: false,
        frameCount: 0,
        alertCount: 0,
        cameraFrames: 0,
        silencedAlerts: 0,
        audioCount: 0,
        log: [],
        currentAlerts: [],
        currentScene: null,
        currentDecision: null,
        completedSteps: [true, false, false, false, false, false, false],
        report: null,
        spatialData: null,
        sensorContext: sensorContextRef.current,
      }));

      const mode = cameraStatusRef.current === 'active' ? 'camera mode' : 'simulation mode';
      speak(`Vision session started in ${mode}. Scanning your surroundings.`, 'high', true);
      addLog(`Session started · ${mode} · personality: ${settings.guidancePersonality}`);
      intervalRef.current = setInterval(runFrame, FRAME_INTERVAL_MS);
      runFrame();
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to start',
      }));
    }
  }, [speak, addLog, runFrame, updateSettings, requestGPS, requestMotionSensors]);

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
      // V7: waypoint haptic
      vibrate('waypoint');
      setState((s) => {
        const steps = [...s.completedSteps];
        steps[5] = true;
        return { ...s, completedSteps: steps };
      });
      addLog(`Memory saved: ${label}`);
    } catch {
      addLog('Error: could not save memory event');
    }
  }, [addLog, vibrate]);

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
      steps[6] = true;
      const report: SessionReport = {
        sessionId: sid ?? 'unknown',
        durationSeconds,
        frameCount: s.frameCount,
        alertCount: s.alertCount,
        audioCount: audioCountRef.current,
        peakUrgency: peakUrgencyRef.current,
        completedSteps: steps,
        cameraFrames: cameraFramesRef.current,
        silencedAlerts: silencedAlertsRef.current,
      };
      return { ...s, isActive: false, sessionId: null, completedSteps: steps, report };
    });
    addLog('Session ended');
  }, [stopAudio, addLog]);

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
    // V5
    lastGuidance,
    repeatLastGuidance: () => repeatGuidance(speak),
    speak,
    // V7: sensor controls
    sensorContext,
    requestGPS,
    requestMotionSensors,
    stopGPS,
    vibrate,
    isGPSSupported,
    isMotionSupported,
  };
}

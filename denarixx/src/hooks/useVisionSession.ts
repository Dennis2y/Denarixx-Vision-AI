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
import type { VisionAnalysisV4, VisionHazardResult } from '@/types/vision';
import type { WorldModelSnapshot } from '@/types/spatial';
import type { SensorContext, VibrationPattern } from '@/types/sensors';
import { AlertQualityEngine } from '@/engines/alertQualityEngine';
import type { AlertQualityInput } from '@/engines/alertQualityEngine';
import type { RiskLevel } from '@/types/cognitive';
import {
  createCoordinationState,
  enqueueAlert,
  dequeueNextAlert,
  buildAlert,
  buildVisionAlert,
  buildOCRAlert,
  buildNavigationAlert,
  buildSystemAlert,
  buildCompanionAlert,
  shouldInterrupt,
  applyInterrupt,
} from '@/engines/alertCoordinationEngine';
import type { CoordinationState, CoordinatedAlert } from '@/engines/alertCoordinationEngine';
import { formatOCRAnnouncement } from '@/engines/systemAnnouncementEngine';
import { detectActiveFailures, getFailureAnnouncement } from '@/engines/failureRecoveryEngine';
import type { FailureType } from '@/engines/failureRecoveryEngine';
import {
  processNavigationTick,
  isRouteActive,
  createNavigationSession,
} from '@/engines/navigationIntelligenceEngine';
import type { NavigationSession, NavigationMode } from '@/types/navigation';

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
  // Real AI Integration: capture-to-speech latency in ms
  lastLatencyMs: number | null;
  avgLatencyMs: number | null;
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

  // Sprint 23: connected engines
  const alertQualityEngineRef = useRef(new AlertQualityEngine());
  const coordinationStateRef = useRef<CoordinationState>(createCoordinationState());
  const prevRiskLevelRef = useRef<RiskLevel>('none');
  const prevUserActivityRef = useRef<string | undefined>(undefined);
  const announcedFailuresRef = useRef<Set<FailureType>>(new Set());
  const ocrPendingRef = useRef<{ text: string; domain: string; isHazard: boolean } | null>(null);
  const navSessionRef = useRef<NavigationSession | null>(null);
  const navTickRef = useRef(0);
  const navLastSpokenRef = useRef(0);

  // Real AI Integration refs
  const localDetectionsRef = useRef<Detection[]>([]);
  const latencySamplesRef = useRef<number[]>([]); // rolling 10-sample window

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
    lastLatencyMs: null,
    avgLatencyMs: null,
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

  // Sprint 23: Single coordinated speech path — 7-level priority queue
  // All spoken output must flow through here (vision, OCR, navigation, companion, system).
  const speakCoordinated = useCallback((alert: CoordinatedAlert): boolean => {
    const cur = coordinationStateRef.current;

    // Interrupt lower-priority speech when this alert demands it
    if (shouldInterrupt(cur, alert)) {
      stopAudio();
      coordinationStateRef.current = applyInterrupt(cur, alert.priority);
    }

    // Enqueue — deduplicated by key + cooldown
    const { state: s2, suppressed, reason } = enqueueAlert(coordinationStateRef.current, alert);
    if (suppressed) {
      silencedAlertsRef.current += 1;
      setState((s) => ({ ...s, silencedAlerts: s.silencedAlerts + 1 }));
      addLog(`[coord-dedup] ${reason ?? 'suppressed'}: ${alert.text.slice(0, 60)}`);
      return false;
    }
    coordinationStateRef.current = s2;

    // Dequeue next ready alert and speak it
    const { state: s3, alert: toSpeak } = dequeueNextAlert(coordinationStateRef.current);
    coordinationStateRef.current = s3;
    if (!toSpeak) return false;

    const spPriority: 'critical' | 'high' | 'normal' | 'low' =
      toSpeak.priority === 'critical_hazard' || toSpeak.priority === 'system_failure' ? 'critical' :
      toSpeak.priority === 'high_navigation'  || toSpeak.priority === 'important_ocr'  ? 'high'     :
      toSpeak.priority === 'normal_navigation' || toSpeak.priority === 'scene_description' ? 'normal' :
      'low';

    speak(toSpeak.text, spPriority, toSpeak.interrupt);

    // Haptic for critical / high
    if (toSpeak.priority === 'critical_hazard') vibrate('critical');
    else if (toSpeak.priority === 'high_navigation' || toSpeak.priority === 'system_failure') vibrate('high');

    audioCountRef.current += 1;
    lastAlertTimeRef.current = Date.now();

    const riskLvl =
      toSpeak.priority === 'critical_hazard'  ? 'critical' :
      toSpeak.priority === 'high_navigation'  || toSpeak.priority === 'system_failure' ? 'high' :
      toSpeak.priority === 'important_ocr'    ? 'medium' : 'low';

    setGuidance({
      text: toSpeak.text,
      riskLevel: riskLvl,
      confidence: 0.8,
      reason: `${toSpeak.source} via coordination (${toSpeak.priority})`,
      priority: spPriority,
      timestamp: new Date(),
    });

    setState((s) => {
      const steps = [...s.completedSteps];
      steps[4] = true;
      return { ...s, audioCount: s.audioCount + 1, completedSteps: steps };
    });

    return true;
  }, [speak, stopAudio, vibrate, addLog, setGuidance]);

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

    const visionMode = sessionSettingsRef.current.visionMode ?? 'simulation';
    const isCamera = cameraStatusRef.current === 'active';
    const imageData = isCamera ? captureFrameRef.current() : null;
    const source = imageData ? 'camera' : 'simulation';

    const personality = sessionSettingsRef.current.guidancePersonality;
    const personalityEngine = personalityEngineRef.current;
    const frameStart = now;

    try {
      // 1. Detect objects
      // local-ai mode: use TFJS detections pushed by the client (no server round-trip)
      // simulation / cloud-ai: call the server vision provider as before
      type ServerVisionData = { detections: Detection[]; visionAnalysis?: VisionAnalysisV4 } | null;
      let detections: Detection[];
      let serverVisionData: ServerVisionData = null;

      if (visionMode === 'local-ai') {
        detections = localDetectionsRef.current;
        addLog(`[local-ai] ${detections.length} object(s) from TF.js COCO-SSD`);
      } else {
        const visionRes = await fetch('/api/vision/analyze-frame', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, source, imageData: imageData ?? undefined }),
        });
        const body = (await visionRes.json()) as { data: ServerVisionData };
        serverVisionData = body.data;
        detections = serverVisionData?.detections ?? [];
      }

      setState((s) => {
        const newCount = s.frameCount + 1;
        const usedCamera = imageData != null || visionMode === 'local-ai';
        const camCount = s.cameraFrames + (usedCamera ? 1 : 0);
        const steps = [...s.completedSteps];
        if (newCount >= 2) steps[1] = true;
        return { ...s, frameCount: newCount, cameraFrames: camCount, completedSteps: steps };
      });
      if (imageData || visionMode === 'local-ai') cameraFramesRef.current += 1;

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

      // 3 + 4. Hazard evaluation + safety decision
      // Sprint 4: when real cloud-AI analysis is available, feed its hazards directly
      // into the cognitive pipeline — skip simulated evaluation round-trips.
      // In local-ai mode serverVisionData is null, so isRealVision stays false
      // and we use the standard hazard/safety evaluation with TFJS detections.
      const visionAnalysis = serverVisionData?.visionAnalysis;
      const isRealVision = !!(visionAnalysis?.isRealAI && !visionAnalysis?.usedFallback);

      let alerts: HazardAlert[];
      let decision: SafetyDecision;

      if (isRealVision && visionAnalysis) {
        // Feed real AI hazards directly — no simulated evaluation needed
        alerts = visionAnalysis.hazards.map((h: VisionHazardResult, i: number) => ({
          id: `ai-${Date.now()}-${i}`,
          type: h.type,
          description: h.description,
          severity: h.severity,
          confidence: h.confidence,
          timestamp: new Date(),
          shouldInterrupt: h.severity === 'critical' || h.severity === 'high',
          disclaimer: 'AI vision analysis — please verify before acting.',
        }));
        // Build safety decision from V4 structured output
        const topHazard =
          alerts.find((a) => a.severity === 'critical') ??
          alerts.find((a) => a.severity === 'high') ??
          alerts[0];
        const shouldAlert = alerts.length > 0 && (topHazard?.confidence ?? 0) >= 0.5;
        decision = {
          shouldAlert,
          urgency: shouldAlert ? (topHazard?.severity ?? 'none') : 'none',
          message: visionAnalysis.recommendedAction,
          confidence: visionAnalysis.confidence,
          interruptNarration: !!(topHazard?.shouldInterrupt),
        };
      } else {
        // Simulation or fallback — use existing evaluation pipeline
        const hazardRes = await fetch('/api/hazards/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, detections }),
        });
        const { data: hazardData } = await hazardRes.json();
        alerts = hazardData.alerts ?? [];

        const safetyRes = await fetch('/api/safety/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, alerts }),
        });
        const { data: safetyData } = await safetyRes.json();
        decision = safetyData.decision;
      }

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

      // 5. Audio output — AlertQualityEngine → AlertCoordinationEngine → speak()
      // AlertQualityEngine decides speak/silent, generates directional wording, and
      // deduplicates across frames — replacing the old alertThrottleRef path.
      const qualityInput: AlertQualityInput = {
        detections,
        categories: serverVisionData?.visionAnalysis?.categories,
        aiHazards: visionAnalysis?.hazards,
        alerts,
        baseDecision: decision,
        prevRiskLevel: prevRiskLevelRef.current,
        prevUserActivity: prevUserActivityRef.current,
        currentUserActivity: sensorCtx?.motionState,
      };
      const qualityDecision = alertQualityEngineRef.current.process(qualityInput);
      prevRiskLevelRef.current = qualityDecision.riskLevel;
      prevUserActivityRef.current = sensorCtx?.motionState;

      if (qualityDecision.shouldSpeak && qualityDecision.message) {
        const riskLevel = toPersonalityRisk(decision.urgency);
        if (!personalityEngine.shouldSpeak(riskLevel, personality)) {
          silencedAlertsRef.current += 1;
          setState((s) => ({ ...s, silencedAlerts: s.silencedAlerts + 1 }));
          addLog(`[${personality}] Silenced: ${personalityEngine.getSilenceReason(riskLevel, personality)}`);
        } else {
          speakCoordinated(
            buildVisionAlert(
              qualityDecision.message,
              decision.urgency as 'critical' | 'high' | 'medium' | 'low',
            ),
          );
          addLog(`ALERT [${decision.urgency}] (${qualityDecision.speakTrigger ?? 'quality'}): ${qualityDecision.message}`);
        }
      } else {
        // Quality engine decided to stay silent, or no active hazard
        if (qualityDecision.silenceReason && qualityDecision.silenceReason !== 'no active hazard') {
          silencedAlertsRef.current += 1;
          setState((s) => ({ ...s, silencedAlerts: s.silencedAlerts + 1 }));
          addLog(`[quiet] ${qualityDecision.silenceReason}`);
        }

        // No hazard — companion reassurance or spatial/scene guidance
        const secondsSinceAlert = lastAlertTimeRef.current
          ? (Date.now() - lastAlertTimeRef.current) / 1000
          : 999;

        if (personalityEngine.shouldReassure(personality, secondsSinceAlert)) {
          const reassurance = personalityEngine.getReassurance(personality);
          speakCoordinated(buildCompanionAlert(reassurance));
          addLog(`[companion] ${reassurance}`);
        } else {
          const motionNote = sensorCtx
            ? sensorFusionEngineRef.current.motionNote(sensorCtx.motionState)
            : null;

          const spatialGuidance = mobilityEngineRef.current.generateGuidance(
            enrichedSpatial,
            prevSpatialInstructionRef.current,
          );
          if (spatialGuidance) {
            prevSpatialInstructionRef.current = enrichedSpatial.recommendation.instruction;
            const fullGuidance = motionNote ? `${motionNote} ${spatialGuidance}` : spatialGuidance;
            speakCoordinated(buildNavigationAlert(fullGuidance, false));
            addLog(`[spatial] ${fullGuidance}`);
          } else if (!scene.isUncertain && sceneChanged) {
            speakCoordinated(buildAlert(scene.summary, 'scene_description', 'vision', {
              deduplicationKey: `scene:${scene.summary.slice(0, 40)}`,
              cooldownMs: 15_000,
            }));
          } else if (scene.uncertaintyMessage && sceneChanged) {
            speakCoordinated(buildAlert(scene.uncertaintyMessage, 'normal_navigation', 'vision', {
              deduplicationKey: `uncertain:${scene.uncertaintyMessage.slice(0, 40)}`,
              cooldownMs: 10_000,
            }));
            addLog(`Uncertainty: ${scene.uncertaintyMessage}`);
          }
        }
      }

      // 5b. OCR → Guardian → alert coordination
      // OCR results are pushed in via reportOCRResult(); processed here per frame.
      if (ocrPendingRef.current) {
        const { text, domain, isHazard } = ocrPendingRef.current;
        ocrPendingRef.current = null;
        const formattedOCR = formatOCRAnnouncement(domain, text, isHazard ? 'high' : 'medium', isHazard);
        speakCoordinated(buildOCRAlert(formattedOCR, isHazard));
        addLog(`[OCR→guardian] ${domain}: ${formattedOCR}`);
      }

      // 5c. Navigation intelligence tick
      // If a nav session is active, advance it with current sensor heading and
      // route guidance into the coordination queue.
      if (navSessionRef.current && isRouteActive(navSessionRef.current)) {
        const sensorUpdate =
          sensorCtx?.headingDegrees != null
            ? { headingDeg: sensorCtx.headingDegrees, distanceTraveledM: 0.5 }
            : undefined;
        const { session: updatedNav, guidance } = processNavigationTick(
          navSessionRef.current,
          navTickRef.current++,
          navLastSpokenRef.current,
          sensorUpdate,
        );
        navSessionRef.current = updatedNav;
        if (guidance) {
          navLastSpokenRef.current = Date.now();
          speakCoordinated(buildNavigationAlert(guidance.text, guidance.priority === 'urgent'));
          addLog(`[nav] ${guidance.text}`);
        }
      }

      // 5d. Failure monitoring — announce each failure exactly once per session transition.
      if (typeof navigator !== 'undefined') {
        const isOnline = navigator.onLine;
        const activeFailures = detectActiveFailures({
          isOnline,
          cameraDisconnected: cameraStatusRef.current !== 'active' && visionMode !== 'simulation',
          batteryLevel: sensorCtx?.battery?.level ?? undefined,
        });
        for (const failureType of activeFailures) {
          if (!announcedFailuresRef.current.has(failureType)) {
            announcedFailuresRef.current.add(failureType);
            const announcement = getFailureAnnouncement(failureType);
            const isCritical = failureType === 'battery-critical' || failureType === 'camera-disconnected';
            speakCoordinated(buildSystemAlert(announcement, isCritical));
            addLog(`[failure→announced] ${failureType}: ${announcement}`);
          }
        }
        // Clear resolved failures so they re-announce if they come back
        for (const announced of [...announcedFailuresRef.current]) {
          if (!activeFailures.includes(announced)) {
            announcedFailuresRef.current.delete(announced);
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
        speakCoordinated(buildCompanionAlert(memMsg));
        addLog(`Memory recall: ${memMsg}`);
      }

      // Latency: capture→decision pipeline time
      const latencyMs = Date.now() - frameStart;
      const newSamples = [...latencySamplesRef.current, latencyMs].slice(-10);
      latencySamplesRef.current = newSamples;
      const avgMs = Math.round(newSamples.reduce((a, b) => a + b, 0) / newSamples.length);
      setState((s) => ({ ...s, lastLatencyMs: latencyMs, avgLatencyMs: avgMs }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`Error: ${msg}`);
      setState((s) => ({ ...s, error: msg }));
    }
  }, [speak, addLog, setGuidance, vibrate, speakCoordinated]);

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
      alertQualityEngineRef.current.reset();
      coordinationStateRef.current = createCoordinationState();
      prevRiskLevelRef.current = 'none';
      prevUserActivityRef.current = undefined;
      announcedFailuresRef.current = new Set();
      ocrPendingRef.current = null;
      navSessionRef.current = null;
      navTickRef.current = 0;
      navLastSpokenRef.current = 0;

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
      speakCoordinated(buildSystemAlert(`Vision session started in ${mode}. Scanning your surroundings.`, false));
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
  }, [speak, addLog, runFrame, updateSettings, requestGPS, requestMotionSensors, speakCoordinated]);

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

  // Real AI Integration: allow session page to push TFJS detections into the pipeline
  const setLocalDetections = useCallback((dets: Detection[]) => {
    localDetectionsRef.current = dets;
  }, []);

  // Sprint 23: OCR → Guardian pipeline entry point.
  // Call this when useOCR returns a new result so it enters the priority queue.
  const reportOCRResult = useCallback((text: string, domain: string, isHazard: boolean) => {
    ocrPendingRef.current = { text, domain, isHazard };
  }, []);

  // Sprint 23: Navigation integration — start a turn-by-turn nav session inside the pipeline.
  const startNavigation = useCallback((destination: string, mode: NavigationMode = 'outdoor') => {
    navSessionRef.current = createNavigationSession(destination, mode, false);
    navTickRef.current = 0;
    navLastSpokenRef.current = 0;
    addLog(`[nav] Started → ${destination} (${mode})`);
  }, [addLog]);

  const stopNavigation = useCallback(() => {
    navSessionRef.current = null;
    addLog('[nav] Stopped');
  }, [addLog]);

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
    // Real AI Integration
    setLocalDetections,
    // Sprint 23: pipeline connections
    reportOCRResult,
    startNavigation,
    stopNavigation,
  };
}

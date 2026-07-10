// ─── Embedded Guardian Orchestrator ──────────────────────────────────────────
// Shared, runtime-neutral pipeline that processes ONNX detections through the
// same intelligent Guardian, alert-quality, and coordination engines used by
// the browser session (useVisionSession.ts).
//
// Both embedded-prototype and browser runtimes share this contract. Only the
// adapter layer differs: browser uses Web Speech/browser camera; embedded uses
// ONNX provider + Linux hardware adapters.
//
// Pipeline:
//   EmbeddedInferenceDetection[]
//   → Detection[] (normalize className→label)
//   → HazardDetectionEngine (alerts)
//   → SafetyDecisionEngine (baseDecision)
//   → CognitiveGuardianEngine (guardianDecision + alertQuality)
//   → AlertCoordinationEngine (priority queue)
//   → EmbeddedGuardianOutput (message + haptic)
//
// Safety invariants:
//   - Embedded-prototype mode rejects isSimulated=true detections (caller must
//     call assertNoSimulatedDetectionsInEmbeddedMode before calling this).
//   - Navigation crossing language never asserts certainty ("safe to cross" is
//     forbidden). Use "The crossing appears clear, but please check carefully."
//   - If all detected objects are below the confidence threshold, output
//     shouldSpeak=false rather than fabricating a guidance message.

import type { Detection, HazardAlert } from '@/types';
import { getHazardEngine } from '@/engines/HazardDetectionEngine';
import { getSafetyEngine } from '@/engines/SafetyDecisionEngine';
import { CognitiveGuardianEngine } from '@/engines/cognitiveGuardianEngine';
import {
  createCoordinationState,
  enqueueAlert,
  dequeueNextAlert,
  buildVisionAlert,
  buildSystemAlert,
} from '@/engines/alertCoordinationEngine';
import type { CoordinationState } from '@/engines/alertCoordinationEngine';
import type { EmbeddedGuardianInput, EmbeddedGuardianOutput } from '@/types/embeddedGuardian';
import type { RiskLevel } from '@/types/cognitive';

// ─── Context (holds stateful engine instances) ────────────────────────────────
// Created once per session, updated on each frame tick.

export interface EmbeddedGuardianContext {
  guardian: CognitiveGuardianEngine;
  coordinationState: CoordinationState;
}

export function createEmbeddedGuardianContext(): EmbeddedGuardianContext {
  return {
    guardian: new CognitiveGuardianEngine(),
    coordinationState: createCoordinationState(),
  };
}

// ─── Detection normalisation ──────────────────────────────────────────────────
// ONNX uses className; the domain engines use label.

function normalizeDetections(
  input: EmbeddedGuardianInput,
): Detection[] {
  return input.detections
    .filter(d => !d.isSimulated || input.providerSource === 'simulation-test')
    .map(d => ({
      label: d.className,
      confidence: d.confidence,
      ...(d.boundingBox ? { boundingBox: d.boundingBox } : {}),
    }));
}

// ─── Risk → haptic mapping ────────────────────────────────────────────────────

function riskToHaptic(riskLevel: RiskLevel, urgency: string): string | null {
  if (riskLevel === 'critical' || urgency === 'critical') return 'obstacle-ahead';
  if (riskLevel === 'high' || urgency === 'high') return 'obstacle-ahead';
  return null;
}

// ─── Risk → recommended action ────────────────────────────────────────────────

function riskToAction(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case 'critical': return 'stop-immediately';
    case 'high':     return 'slow-down';
    case 'medium':   return 'proceed-with-caution';
    case 'low':      return 'stay-alert';
    default:         return 'continue';
  }
}

// ─── Main pipeline function ───────────────────────────────────────────────────

export async function runEmbeddedGuardianPipeline(
  input: EmbeddedGuardianInput,
  context: EmbeddedGuardianContext,
): Promise<{ output: EmbeddedGuardianOutput; context: EmbeddedGuardianContext }> {
  const detections = normalizeDetections(input);

  // 1. Hazard detection
  const hazardEngine = getHazardEngine();
  let alerts: HazardAlert[] = [];
  try {
    alerts = await hazardEngine.evaluate(detections);
  } catch {
    alerts = [];
  }

  // 2. Safety decision
  const safetyEngine = getSafetyEngine();
  const baseDecision = safetyEngine.decide(alerts);

  // 3. Cognitive Guardian (includes AlertQualityEngine when categories present)
  const guardianDecision = context.guardian.process(
    detections,
    baseDecision,
    alerts,
    undefined,   // categories: not available from raw ONNX yet
    undefined,   // aiHazards
    input.repeatRequested ?? false,
  );

  // 4. Derive final speak decision
  // Prefer the Sprint 5 quality decision when available (richer wording + dedup)
  const quality = guardianDecision.qualityDecision;
  const shouldSpeak = quality ? quality.shouldSpeak : guardianDecision.shouldAlert;
  const rawMessage = quality ? quality.message : (guardianDecision.shouldAlert ? baseDecision.message : null);
  const riskLevel: RiskLevel = quality ? quality.riskLevel : (
    baseDecision.urgency === 'none' ? 'none' : baseDecision.urgency as RiskLevel
  );
  const confidence = quality ? quality.confidence : baseDecision.confidence;
  const decisionReason = quality
    ? (quality.speakTrigger ?? quality.silenceReason ?? 'guardian-decision')
    : (guardianDecision.shouldAlert ? 'safety-alert' : 'silent');

  // 5. Enqueue into coordination queue (priority determined by urgency)
  let updatedCoordination = context.coordinationState;
  let dequeuedText: string | null = null;
  let shouldInterrupt = false;

  if (shouldSpeak && rawMessage) {
    const urgency = baseDecision.urgency === 'none' ? 'low' : baseDecision.urgency;
    const alert = buildVisionAlert(rawMessage, urgency as 'critical' | 'high' | 'medium' | 'low');

    const enqueueResult = enqueueAlert(updatedCoordination, alert);
    updatedCoordination = enqueueResult.state;

    const dequeueResult = dequeueNextAlert(updatedCoordination);
    updatedCoordination = dequeueResult.state;

    if (dequeueResult.alert) {
      dequeuedText = dequeueResult.alert.text;
      shouldInterrupt = dequeueResult.alert.interrupt;
    }
  } else if (!shouldSpeak && rawMessage) {
    // Quality engine suppressed — still enqueue low-priority so it eventually plays
    const lowAlert = buildVisionAlert(rawMessage, 'low');
    const enqueueResult = enqueueAlert(updatedCoordination, lowAlert);
    updatedCoordination = enqueueResult.state;
  }

  const output: EmbeddedGuardianOutput = {
    riskLevel,
    recommendedAction: riskToAction(riskLevel),
    message: dequeuedText,
    shouldSpeak: dequeuedText !== null,
    shouldInterrupt,
    hapticPattern: shouldSpeak ? riskToHaptic(riskLevel, baseDecision.urgency) : null,
    confidence,
    uncertaintyStatement: confidence < 0.6
      ? 'Confidence is low — please check carefully.'
      : null,
    decisionReason,
    cooldownKey: `vision:${(rawMessage ?? '').slice(0, 50)}`,
  };

  return {
    output,
    context: {
      ...context,
      coordinationState: updatedCoordination,
    },
  };
}

// ─── Battery / thermal system alert ──────────────────────────────────────────
// Produces a system-level alert and haptic (bypasses Guardian dedup/cooldown).

export interface BatteryThermalAlert {
  message: string;
  hapticPattern: string;
  isCritical: boolean;
}

export function buildBatteryThermalAlert(
  batteryPct: number | undefined,
  temperatureC: number | undefined,
  coordinationState: CoordinationState,
): { alert: BatteryThermalAlert | null; coordinationState: CoordinationState } {
  let text: string | null = null;
  let hapticPattern = 'low-battery';
  let isCritical = false;

  if (batteryPct !== undefined) {
    if (batteryPct <= 5) {
      text = 'Battery is critically low. Safety guidance will stop soon.';
      isCritical = true;
    } else if (batteryPct <= 10) {
      text = 'Battery is low. Please charge soon.';
    }
  }

  if (temperatureC !== undefined && temperatureC >= 90) {
    text = 'Device is overheating. Shutting down for safety.';
    hapticPattern = 'device-failure';
    isCritical = true;
  }

  if (!text) return { alert: null, coordinationState };

  const coordAlert = buildSystemAlert(text, isCritical);
  const result = enqueueAlert(coordinationState, coordAlert);

  return {
    alert: { message: text, hapticPattern, isCritical },
    coordinationState: result.state,
  };
}

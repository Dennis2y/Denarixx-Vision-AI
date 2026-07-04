/**
 * CognitiveGuardianEngine — V2 + Sprint 5
 *
 * Orchestrates the full V2 cognitive pipeline (ProactiveAlertEngine,
 * SilenceDecisionEngine, PredictiveRiskEngine, CompanionContextEngine,
 * RoutineLearningEngine) with optional Sprint 5 quality layer.
 *
 * Sprint 5: when `categories` (DetectedCategories from Sprint 4) are provided,
 * the AlertQualityEngine runs deduplication, improved wording, and logs the
 * speak/silent decision with a structured reason. The result is available in
 * `GuardianDecision.qualityDecision`.
 *
 * Backward-compatible: existing callers that do NOT pass `categories` see
 * identical behaviour to V2.
 */

import type { Detection, HazardAlert, SafetyDecision } from '@/types';
import type { DetectedCategories, VisionHazardResult } from '@/types/vision';
import type { GuardianDecision, RiskLevel } from '@/types/cognitive';
import { ProactiveAlertEngine } from './proactiveAlertEngine';
import { SilenceDecisionEngine } from './silenceDecisionEngine';
import { PredictiveRiskEngine } from './predictiveRiskEngine';
import { CompanionContextEngine } from './companionContextEngine';
import { RoutineLearningEngine } from './routineLearningEngine';
import { AlertQualityEngine } from './alertQualityEngine';

interface CognitiveGuardianOptions {
  maxAlertsPerMinute?: number;
  proactiveThreshold?: number;
}

export class CognitiveGuardianEngine {
  private proactiveEngine: ProactiveAlertEngine;
  private silenceEngine: SilenceDecisionEngine;
  private riskEngine: PredictiveRiskEngine;
  private contextEngine: CompanionContextEngine;
  private routineEngine: RoutineLearningEngine;
  private qualityEngine: AlertQualityEngine;
  private frameCount = 0;
  private alertCount = 0;
  private prevRiskLevel: RiskLevel = 'none';

  constructor(options: CognitiveGuardianOptions = {}) {
    this.proactiveEngine = new ProactiveAlertEngine(options.proactiveThreshold ?? 0.4);
    this.silenceEngine = new SilenceDecisionEngine({
      maxAlertsPerMinute: options.maxAlertsPerMinute ?? 3,
      silenceDurationMs: 10_000,
    });
    this.riskEngine = new PredictiveRiskEngine();
    this.contextEngine = new CompanionContextEngine();
    this.routineEngine = new RoutineLearningEngine();
    this.qualityEngine = new AlertQualityEngine();
  }

  /**
   * Process a frame and return a GuardianDecision.
   *
   * @param detections  Legacy Detection[] — always required.
   * @param baseDecision The safety decision from the evaluation pipeline.
   * @param alerts       Legacy HazardAlert[] — pass [] if none.
   * @param categories   Sprint 4 DetectedCategories — when provided, activates the
   *                     Sprint 5 AlertQualityEngine (dedup, wording, logging).
   * @param aiHazards    Real AI hazard results from VisionAnalysisV4 — used by the
   *                     quality engine when categories are present.
   * @param repeatRequested  True when the user explicitly asked for a repeat.
   */
  process(
    detections: Detection[],
    baseDecision: SafetyDecision,
    alerts: HazardAlert[],
    categories?: DetectedCategories,
    aiHazards?: VisionHazardResult[],
    repeatRequested?: boolean
  ): GuardianDecision {
    this.frameCount++;
    this.riskEngine.addFrame(detections);

    for (const d of detections) {
      this.routineEngine.observe(d.label);
    }

    this.contextEngine.updateActivity(this.frameCount, this.alertCount);
    const userContext = this.contextEngine.getContext();

    const proactiveAlerts = this.proactiveEngine.generate(detections);

    const lastAlertMs = userContext.lastAlertTimestamp
      ? Date.now() - userContext.lastAlertTimestamp.getTime()
      : null;

    const silenceDecision = this.silenceEngine.decide(
      userContext.alertsInLastMinute,
      lastAlertMs
    );

    const riskPrediction = this.riskEngine.predict(5);

    // Never silence critical urgency — always speak life-safety alerts
    const isCritical = baseDecision.urgency === 'critical';
    const shouldSilence = silenceDecision.shouldSilence && !isCritical;
    const shouldAlert = baseDecision.shouldAlert && !shouldSilence;

    if (shouldAlert) {
      this.alertCount++;
      this.contextEngine.recordAlert();
    }

    const reasoning = [
      `Silence: ${silenceDecision.shouldSilence ? silenceDecision.reason : 'no'}`,
      `Risk: ${riskPrediction.predictedRisk}`,
      `Fatigue: ${silenceDecision.fatigueLevel}`,
    ].join(' | ');

    // Sprint 5: run quality engine when categories are provided
    let qualityDecision = undefined;
    if (categories) {
      qualityDecision = this.qualityEngine.process({
        detections,
        categories,
        aiHazards,
        alerts,
        baseDecision,
        prevRiskLevel: this.prevRiskLevel,
        repeatRequested,
      });
    }

    this.prevRiskLevel = riskPrediction.predictedRisk;

    return {
      shouldAlert: qualityDecision ? qualityDecision.shouldSpeak : shouldAlert,
      shouldSilence: qualityDecision ? !qualityDecision.shouldSpeak : silenceDecision.shouldSilence,
      proactiveAlerts,
      riskPrediction,
      userContext,
      message: qualityDecision ? qualityDecision.message : (shouldAlert ? baseDecision.message : null),
      confidence: qualityDecision ? qualityDecision.confidence : baseDecision.confidence,
      reasoning: qualityDecision
        ? `Quality[${qualityDecision.speakTrigger ?? qualityDecision.silenceReason}] | ${reasoning}`
        : reasoning,
      qualityDecision,
    };
  }

  reset() {
    this.frameCount = 0;
    this.alertCount = 0;
    this.prevRiskLevel = 'none';
    this.contextEngine.reset();
    this.riskEngine.clearHistory();
    this.routineEngine.clear();
    this.qualityEngine.reset();
  }

  getFrameCount(): number { return this.frameCount; }

  getQualityEngine(): AlertQualityEngine { return this.qualityEngine; }
}

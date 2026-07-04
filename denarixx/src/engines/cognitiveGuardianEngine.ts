import type { Detection, HazardAlert, SafetyDecision } from '@/types';
import type { GuardianDecision } from '@/types/cognitive';
import { ProactiveAlertEngine } from './proactiveAlertEngine';
import { SilenceDecisionEngine } from './silenceDecisionEngine';
import { PredictiveRiskEngine } from './predictiveRiskEngine';
import { CompanionContextEngine } from './companionContextEngine';
import { RoutineLearningEngine } from './routineLearningEngine';

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
  private frameCount = 0;
  private alertCount = 0;

  constructor(options: CognitiveGuardianOptions = {}) {
    this.proactiveEngine = new ProactiveAlertEngine(options.proactiveThreshold ?? 0.4);
    this.silenceEngine = new SilenceDecisionEngine({
      maxAlertsPerMinute: options.maxAlertsPerMinute ?? 3,
      silenceDurationMs: 10_000,
    });
    this.riskEngine = new PredictiveRiskEngine();
    this.contextEngine = new CompanionContextEngine();
    this.routineEngine = new RoutineLearningEngine();
  }

  process(
    detections: Detection[],
    baseDecision: SafetyDecision,
    _alerts: HazardAlert[]
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

    return {
      shouldAlert,
      shouldSilence: silenceDecision.shouldSilence,
      proactiveAlerts,
      riskPrediction,
      userContext,
      message: shouldAlert ? baseDecision.message : null,
      confidence: baseDecision.confidence,
      reasoning,
    };
  }

  reset() {
    this.frameCount = 0;
    this.alertCount = 0;
    this.contextEngine.reset();
    this.riskEngine.clearHistory();
    this.routineEngine.clear();
  }

  getFrameCount(): number {
    return this.frameCount;
  }
}

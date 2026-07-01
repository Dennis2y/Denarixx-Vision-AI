/**
 * Cognitive Guardian Engine — V2 orchestrator.
 *
 * Answers the seven core questions every frame:
 *  1. Is the user safe?
 *  2. Should the AI stay silent?
 *  3. Should the AI warn immediately?
 *  4. Should the AI guide gently?
 *  5. Should the AI provide companionship?
 *  6. What matters right now?
 *  7. What might happen in the next few seconds?
 */

import type { SceneDescription, HazardAlert } from '@/types';
import type {
  ICognitiveGuardianEngine,
  GuardianDecision,
  GuardianAction,
  UserState,
} from '@/types/cognitive';
import { uncertaintyMessage, SAFETY_DISCLAIMER } from './types';
import { getSilenceEngine } from './silenceDecisionEngine';
import { getPredictiveRiskEngine } from './predictiveRiskEngine';
import { getProactiveAlertEngine } from './proactiveAlertEngine';
import { getCompanionEngine } from './companionContextEngine';
import { getRoutineLearningEngine } from './routineLearningEngine';

export class CognitiveGuardianEngine implements ICognitiveGuardianEngine {
  private lastSpokenAt = 0;
  private lastAlertAt = 0;
  private previousScene: SceneDescription | null = null;

  async evaluate(
    scene: SceneDescription,
    alerts: HazardAlert[],
    userState: UserState
  ): Promise<GuardianDecision> {
    const silenceEngine = getSilenceEngine();
    const predictiveEngine = getPredictiveRiskEngine();
    const proactiveEngine = getProactiveAlertEngine();
    const companionEngine = getCompanionEngine();
    const routineEngine = getRoutineLearningEngine();

    // 1. Observe for routine learning
    routineEngine.observe(scene);

    // 2. Predict upcoming risks
    const predictedRisks = predictiveEngine.predict(scene, userState, alerts);

    // 3. Decide silence
    const silenceDecision = silenceEngine.decide(
      scene,
      userState,
      this.lastSpokenAt,
      this.previousScene
    );

    // 4. Proactive alert check
    const alertCheck = proactiveEngine.shouldAlert(alerts, userState, this.lastAlertAt);

    // 5. Determine action
    let action: GuardianAction = 'silent';
    let message = '';
    let priority: GuardianDecision['priority'] = 'low';
    let interrupt = false;
    let reasoning = '';

    const criticalAlert = alerts.find(
      (a) => a.severity === 'critical' && a.confidence >= 0.55
    );
    const highAlert = alerts.find(
      (a) => a.severity === 'high' && a.confidence >= 0.6
    );
    const topRisk = predictedRisks[0];

    if (criticalAlert || userState.movement === 'emergency') {
      // Q3: Warn immediately
      const alert = criticalAlert ?? alerts[0];
      action = 'warn';
      message = alert.description;
      priority = 'critical';
      interrupt = true;
      reasoning = `Critical hazard: ${alert.type} at ${Math.round(alert.confidence * 100)}% confidence.`;
      this.lastAlertAt = Date.now();
      this.lastSpokenAt = Date.now();
    } else if (alertCheck.alert && highAlert) {
      // Q3: Warn — high severity
      action = 'warn';
      message = highAlert.description;
      priority = 'high';
      interrupt = false;
      reasoning = `High hazard: ${highAlert.type} at ${Math.round(highAlert.confidence * 100)}% confidence.`;
      this.lastAlertAt = Date.now();
      this.lastSpokenAt = Date.now();
    } else if (
      topRisk &&
      topRisk.horizon === 'immediate' &&
      topRisk.likelihood >= 0.75 &&
      !silenceDecision.shouldBeSilent
    ) {
      // Q4: Guide gently based on predicted risk
      action = 'guide';
      message = `${topRisk.actionHint} — ${topRisk.description}`;
      priority = 'normal';
      interrupt = false;
      reasoning = `Predicted immediate risk: ${topRisk.description} (${Math.round(topRisk.likelihood * 100)}% likelihood).`;
      this.lastSpokenAt = Date.now();
    } else if (!silenceDecision.shouldBeSilent) {
      // Q5: Companion or acknowledge
      const companion = companionEngine.compose(scene, userState, action);

      if (companion.isAppropriate && companion.text) {
        action = 'companion';
        message = companion.text;
        priority = 'low';
        interrupt = false;
        reasoning = `Companion message appropriate. User is ${userState.movement}.`;
        this.lastSpokenAt = Date.now();
      } else if (!scene.isUncertain && alerts.length === 0) {
        action = 'acknowledge';
        message = 'Path ahead appears clear.';
        priority = 'low';
        interrupt = false;
        reasoning = 'No hazards, scene clear — brief acknowledgement.';
        this.lastSpokenAt = Date.now();
      } else {
        action = 'silent';
        reasoning = silenceDecision.reason ?? 'No useful information to convey.';
      }
    } else {
      action = 'silent';
      reasoning = `Silent: ${silenceDecision.reason}.`;
    }

    // Append uncertainty message for low-confidence warnings
    if (
      (action === 'warn' || action === 'guide') &&
      scene.confidence < 0.6
    ) {
      const uncert = uncertaintyMessage(scene.confidence);
      if (uncert) message = `${uncert} ${message}`;
    }

    // Never companion during risky movement
    if (
      action === 'companion' &&
      (userState.movement === 'crossing_road' || userState.isAtRisk)
    ) {
      action = 'silent';
      message = '';
      reasoning = 'Companion suppressed — user is in risky movement.';
    }

    this.previousScene = scene;

    return {
      action,
      message,
      priority,
      interrupt,
      reasoning,
      predictedRisks,
      userState,
      silenceDecision,
      confidence: scene.confidence,
    };
  }

  /** Infer user state from scene + alerts (simulation heuristic for Phase 2). */
  static inferUserState(
    scene: SceneDescription,
    alerts: HazardAlert[]
  ): UserState {
    const labels = new Set(scene.detections.map((d) => d.label));
    const hasCritical = alerts.some((a) => a.severity === 'critical');

    let movement: UserState['movement'] = 'walking';
    if (hasCritical && labels.has('road')) movement = 'crossing_road';
    else if (hasCritical) movement = 'emergency';
    else if (labels.has('road') && !hasCritical) movement = 'waiting';
    else if (labels.has('table') || labels.has('chair')) movement = 'standing';

    const environment: UserState['environment'] =
      labels.has('road') || labels.has('pavement') ? 'outdoor' : 'indoor';

    return {
      movement,
      environment,
      speed: movement === 'walking' ? 'normal' : 'stationary',
      isAtRisk: hasCritical || alerts.some((a) => a.severity === 'high' && a.confidence >= 0.7),
      confidence: scene.confidence,
      updatedAt: new Date(),
    };
  }
}

let _instance: CognitiveGuardianEngine | null = null;

export function getCognitiveGuardian(): CognitiveGuardianEngine {
  if (!_instance) _instance = new CognitiveGuardianEngine();
  return _instance;
}

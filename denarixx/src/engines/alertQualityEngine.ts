/**
 * AlertQualityEngine — Sprint 5 orchestrator
 *
 * Makes the Guardian speak less and speak better. Combines:
 *   - AlertDeduplicationEngine  (cross-frame appearance tracking)
 *   - AlertThrottleEngine       (per-severity cooldowns)
 *   - GuardianWordingEngine     (specific, directional messages)
 *   - GuardianDecisionLogger    (ring-buffer decision log)
 *
 * "Speak when" rules (all evaluated in priority order):
 *   1. Critical alert           → always speak (never silenced)
 *   2. New hazard appeared      → speak (new_hazard)
 *   3. Hazard returned          → speak (hazard_returned)
 *   4. Risk level increased     → speak (risk_increased)
 *   5. Confidence increased ≥10%→ speak (confidence_increased / distance decreased)
 *   6. User state changed       → speak (user_state_changed)
 *   7. Repeat requested         → speak (repeat_requested)
 *   8. Cooldown expired         → speak (cooldown_expired)
 *   Otherwise                   → silent (deduplication or cooldown)
 *
 * Pure — no async, no I/O. All dependencies injected.
 */

import type { Detection, HazardAlert, SafetyDecision } from '@/types';
import type { DetectedCategories, VisionHazardResult } from '@/types/vision';
import type {
  AlertQualityDecision,
  DeduplicationFrame,
  GuardianDecisionLogEntry,
  RiskLevel,
  SpeakTrigger,
} from '@/types/cognitive';

import { AlertDeduplicationEngine } from './alertDeduplicationEngine';
import { AlertThrottleEngine } from './alertThrottleEngine';
import { GuardianWordingEngine } from './guardianWordingEngine';
import { GuardianDecisionLogger } from './guardianDecisionLogger';

export interface AlertQualityInput {
  detections: Detection[];
  categories?: DetectedCategories;
  /** Hazards from the AI provider (when isRealAI=true) */
  aiHazards?: VisionHazardResult[];
  /** Legacy hazard alerts from the evaluation pipeline */
  alerts?: HazardAlert[];
  /** Overall safety decision */
  baseDecision: SafetyDecision;
  /** Previous risk level (used to detect risk_increased trigger) */
  prevRiskLevel?: RiskLevel;
  /** Previous user activity string (used to detect user_state_changed) */
  prevUserActivity?: string;
  currentUserActivity?: string;
  /** True when the user explicitly requested a repeat announcement */
  repeatRequested?: boolean;
}

const RISK_ORDER: Record<RiskLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

function toRiskLevel(severity: string): RiskLevel {
  if (['critical', 'high', 'medium', 'low', 'none'].includes(severity)) {
    return severity as RiskLevel;
  }
  return 'none';
}

function selectTopHazard(
  aiHazards?: VisionHazardResult[],
  alerts?: HazardAlert[],
  baseDecision?: SafetyDecision
): { type: string; severity: string; confidence: number; description: string } | null {
  // Prefer real AI hazards
  if (aiHazards && aiHazards.length > 0) {
    const sorted = [...aiHazards].sort(
      (a, b) => (RISK_ORDER[toRiskLevel(b.severity)] ?? 0) - (RISK_ORDER[toRiskLevel(a.severity)] ?? 0)
    );
    return { type: sorted[0].type, severity: sorted[0].severity, confidence: sorted[0].confidence, description: sorted[0].description };
  }
  // Fall back to legacy alerts
  if (alerts && alerts.length > 0) {
    const sorted = [...alerts].sort(
      (a, b) => (RISK_ORDER[toRiskLevel(b.severity)] ?? 0) - (RISK_ORDER[toRiskLevel(a.severity)] ?? 0)
    );
    return { type: sorted[0].type, severity: sorted[0].severity, confidence: sorted[0].confidence, description: sorted[0].description };
  }
  // Fall back to base decision urgency
  if (baseDecision && baseDecision.shouldAlert && baseDecision.urgency !== 'none') {
    return { type: 'unknown', severity: baseDecision.urgency, confidence: baseDecision.confidence, description: baseDecision.message };
  }
  return null;
}

export class AlertQualityEngine {
  private dedup = new AlertDeduplicationEngine();
  private throttle = new AlertThrottleEngine();
  private wording = new GuardianWordingEngine();
  private logger = new GuardianDecisionLogger();

  process(input: AlertQualityInput): AlertQualityDecision {
    // 1. Compute frame-level deduplication diff
    const dedupFrame: DeduplicationFrame = this.dedup.update(input.detections);

    // 2. Select the top hazard for this frame
    const topHazard = selectTopHazard(input.aiHazards, input.alerts, input.baseDecision);

    const riskLevel: RiskLevel = topHazard ? toRiskLevel(topHazard.severity) : 'none';
    const confidence = topHazard?.confidence ?? input.baseDecision.confidence;

    // 3. Apply "speak when" rules in priority order
    let shouldSpeak = false;
    let speakTrigger: SpeakTrigger | null = null;
    let silenceReason: string | null = null;
    let message: string | null = null;

    const noHazard = !topHazard || !input.baseDecision.shouldAlert;

    if (noHazard) {
      silenceReason = 'no active hazard';
    } else {
      const { type, severity, confidence: conf } = topHazard;

      // Rule 1: Critical — never silenced
      if (severity === 'critical') {
        shouldSpeak = true;
        speakTrigger = 'critical_never_silenced';
      }
      // Rule 7: Repeat requested — always speak
      else if (input.repeatRequested) {
        shouldSpeak = true;
        speakTrigger = 'repeat_requested';
      }
      // Rule 2: New hazard appeared this frame
      else if (dedupFrame.appeared.includes(type.toLowerCase())) {
        shouldSpeak = true;
        // Use dedup.isReturn() which checks the pre-frame everSeen snapshot
        speakTrigger = this.dedup.isReturn(type) ? 'hazard_returned' : 'new_hazard';
      }
      // Rule 3: Risk level increased from previous frame
      else if (
        input.prevRiskLevel !== undefined &&
        (RISK_ORDER[riskLevel] ?? 0) > (RISK_ORDER[input.prevRiskLevel] ?? 0)
      ) {
        shouldSpeak = true;
        speakTrigger = 'risk_increased';
      }
      // Rule 4: Confidence increased ≥ 10% (object is getting closer)
      else if (this.dedup.isMeaningfulChange(type, conf)) {
        shouldSpeak = true;
        speakTrigger = 'confidence_increased';
      }
      // Rule 5: User state changed
      else if (
        input.prevUserActivity &&
        input.currentUserActivity &&
        input.prevUserActivity !== input.currentUserActivity
      ) {
        shouldSpeak = true;
        speakTrigger = 'user_state_changed';
      }
      // Rules 6+: Check throttle cooldown
      else {
        const throttleDecision = this.throttle.shouldSpeak({
          hazardType: type,
          severity,
          confidence: conf,
          message: topHazard.description ?? '',
        });

        if (throttleDecision.shouldSpeak) {
          shouldSpeak = true;
          speakTrigger = 'cooldown_expired';
        } else {
          silenceReason = throttleDecision.reason;
        }
      }

      // 4. Generate improved wording when speaking
      if (shouldSpeak) {
        const detectionMatch = input.detections.find(
          (d) => d.label.toLowerCase() === type.toLowerCase()
        );
        const isReturn = speakTrigger === 'hazard_returned';

        if (input.categories) {
          // Check if categories provide richer context
          const hasCategory =
            input.categories.vehicles.some((d) => d.label === type) ||
            input.categories.stairs.some((d) => d.label === type) ||
            input.categories.crossings.some((d) => d.label === type) ||
            input.categories.obstacles.some((d) => d.label === type) ||
            input.categories.people.some((d) => d.label === type) ||
            input.categories.doors.some((d) => d.label === type) ||
            input.categories.signs.some((d) => d.label === type);

          if (!hasCategory && topHazard.type === 'unknown') {
            message = this.wording.generateFromCategories(input.categories, severity, conf);
          } else {
            message = this.wording.generate({ hazardType: type, severity, confidence: conf, detection: detectionMatch, isReturn });
          }
        } else {
          message = this.wording.generate({ hazardType: type, severity, confidence: conf, detection: detectionMatch, isReturn });
        }

        // Record in throttle so cooldowns apply on next frame
        this.throttle.record(type, severity, conf, message);
      }
    }

    // 5. Log the decision
    const logEntry = this.logger.log({
      spoke: shouldSpeak,
      speakTrigger,
      silenceReason,
      hazardType: topHazard?.type ?? null,
      severity: topHazard?.severity ?? null,
      confidence,
      riskLevel,
      message,
      deduplicationFrame: dedupFrame,
    });

    return {
      shouldSpeak,
      message,
      speakTrigger,
      silenceReason,
      riskLevel,
      confidence,
      deduplicationFrame: dedupFrame,
      logEntry,
    };
  }

  getLogger(): GuardianDecisionLogger { return this.logger; }
  getDedup(): AlertDeduplicationEngine { return this.dedup; }

  reset(): void {
    this.dedup.reset();
    this.throttle.reset();
    this.logger.clear();
  }
}

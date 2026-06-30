import type { ISafetyDecisionEngine } from './types';
import { SAFETY_DISCLAIMER } from './types';
import type { HazardAlert, SafetyDecision } from '@/types';

export class SafetyDecisionEngine implements ISafetyDecisionEngine {
  decide(alerts: HazardAlert[]): SafetyDecision {
    if (alerts.length === 0) {
      return {
        shouldAlert: false,
        urgency: 'none',
        message: '',
        confidence: 1,
        interruptNarration: false,
      };
    }

    const critical = alerts.find((a) => a.severity === 'critical');
    const high = alerts.find((a) => a.severity === 'high');
    const top = critical ?? high ?? alerts[0];

    const shouldAlert = top.confidence >= 0.5;
    const interruptNarration = top.shouldInterrupt && top.confidence >= 0.6;

    let message = top.description;

    // If confidence is low, prepend an uncertainty signal
    if (top.confidence < 0.6) {
      message = `Uncertain: ${message} — ${SAFETY_DISCLAIMER}`;
    }

    return {
      shouldAlert,
      urgency: shouldAlert ? top.severity : 'none',
      message,
      confidence: top.confidence,
      interruptNarration,
    };
  }
}

let _instance: SafetyDecisionEngine | null = null;

export function getSafetyEngine(): SafetyDecisionEngine {
  if (!_instance) _instance = new SafetyDecisionEngine();
  return _instance;
}

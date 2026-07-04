import type { SilenceDecision, AlertFatigue } from '@/types/cognitive';

interface SilenceEngineOptions {
  maxAlertsPerMinute: number;
  silenceDurationMs: number;
}

export class SilenceDecisionEngine {
  private maxAlertsPerMinute: number;
  private silenceDurationMs: number;

  constructor(
    options: SilenceEngineOptions = {
      maxAlertsPerMinute: 3,
      silenceDurationMs: 10_000,
    }
  ) {
    this.maxAlertsPerMinute = options.maxAlertsPerMinute;
    this.silenceDurationMs = options.silenceDurationMs;
  }

  decide(alertsInLastMinute: number, lastAlertMs: number | null): SilenceDecision {
    const fatigue = this.computeFatigueLevel(alertsInLastMinute);
    const tooFrequent = alertsInLastMinute >= this.maxAlertsPerMinute;
    const veryRecent = lastAlertMs !== null && lastAlertMs < 2000;

    const shouldSilence = tooFrequent || (fatigue === 'high' && veryRecent);

    let reason = 'No silencing needed';
    if (tooFrequent) {
      reason = `Alert rate exceeded (${alertsInLastMinute}/${this.maxAlertsPerMinute} per minute)`;
    } else if (veryRecent && fatigue !== 'none') {
      reason = 'Alert spoken too recently';
    }

    return {
      shouldSilence,
      reason,
      fatigueLevel: fatigue,
      silenceDurationMs: shouldSilence ? this.silenceDurationMs : 0,
    };
  }

  computeFatigueLevel(alertsInLastMinute: number): AlertFatigue {
    if (alertsInLastMinute === 0) return 'none';
    if (alertsInLastMinute < 2) return 'low';
    if (alertsInLastMinute < this.maxAlertsPerMinute) return 'medium';
    return 'high';
  }
}

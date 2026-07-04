/**
 * AlertThrottleEngine — prevents alert fatigue by enforcing per-hazard cooldowns.
 *
 * Cooldowns by severity:
 *   critical  →  5 seconds  (danger is still present — allow repeats)
 *   high      → 15 seconds  (override if confidence improves significantly)
 *   medium    → 30 seconds
 *   low       → 30 seconds
 *
 * The engine tracks each hazard by a key of `{type}:{severity}`.
 * Call `shouldSpeak()` before speaking. If it returns true, call `record()` after.
 */

export interface ThrottleDecision {
  shouldSpeak: boolean;
  reason: string;
  isNew: boolean;
  confidenceImproved: boolean;
  msUntilCooldownExpires: number;
}

interface ThrottleRecord {
  key: string;
  lastSpokenAt: number;
  lastConfidence: number;
  severity: string;
  speakCount: number;
  lastMessage: string;
}

const COOLDOWN_MS: Record<string, number> = {
  critical: 5_000,
  high: 15_000,
  medium: 30_000,
  low: 30_000,
};

// Minimum confidence delta to override the high-severity cooldown
const HIGH_CONFIDENCE_OVERRIDE_DELTA = 0.12;

export class AlertThrottleEngine {
  private records = new Map<string, ThrottleRecord>();
  private lastSpokenKey: string | null = null;
  private lastSpokenMessage: string | null = null;

  makeKey(hazardType: string, severity: string): string {
    return `${hazardType}:${severity}`;
  }

  /**
   * Decide whether to speak an alert.
   * Call this BEFORE speaking. If shouldSpeak is true, call record() after speaking.
   */
  shouldSpeak(params: {
    hazardType: string;
    severity: string;
    confidence: number;
    message: string;
  }): ThrottleDecision {
    const key = this.makeKey(params.hazardType, params.severity);
    const now = Date.now();
    const cooldownMs = COOLDOWN_MS[params.severity] ?? 30_000;
    const record = this.records.get(key);

    // First time seeing this hazard type → always speak
    if (!record) {
      return {
        shouldSpeak: true,
        reason: 'new hazard detected',
        isNew: true,
        confidenceImproved: false,
        msUntilCooldownExpires: 0,
      };
    }

    const msSinceLast = now - record.lastSpokenAt;
    const remainingMs = Math.max(0, cooldownMs - msSinceLast);
    const confidenceImproved =
      params.confidence > record.lastConfidence + HIGH_CONFIDENCE_OVERRIDE_DELTA;

    // Past cooldown — speak again
    if (msSinceLast >= cooldownMs) {
      return {
        shouldSpeak: true,
        reason: 'cooldown expired',
        isNew: false,
        confidenceImproved,
        msUntilCooldownExpires: 0,
      };
    }

    // Within cooldown — apply severity-specific rules

    // Critical: life-safety, always speak regardless of cooldown
    if (params.severity === 'critical') {
      return {
        shouldSpeak: true,
        reason: 'critical hazard — never silenced',
        isNew: false,
        confidenceImproved,
        msUntilCooldownExpires: remainingMs,
      };
    }

    // High: override cooldown if confidence improved significantly (danger is escalating)
    if (params.severity === 'high' && confidenceImproved) {
      return {
        shouldSpeak: true,
        reason: 'confidence increased significantly — risk may be escalating',
        isNew: false,
        confidenceImproved: true,
        msUntilCooldownExpires: remainingMs,
      };
    }

    // Medium / low — silence within cooldown
    const secSince = Math.round(msSinceLast / 1000);
    const cooldownSec = Math.round(cooldownMs / 1000);
    return {
      shouldSpeak: false,
      reason: `${params.hazardType} within ${cooldownSec}s cooldown (${secSince}s ago)`,
      isNew: false,
      confidenceImproved,
      msUntilCooldownExpires: remainingMs,
    };
  }

  /**
   * Record a spoken alert. Call this after successfully calling speak().
   */
  record(
    hazardType: string,
    severity: string,
    confidence: number,
    message: string
  ) {
    const key = this.makeKey(hazardType, severity);
    const existing = this.records.get(key);
    this.records.set(key, {
      key,
      lastSpokenAt: Date.now(),
      lastConfidence: confidence,
      severity,
      speakCount: (existing?.speakCount ?? 0) + 1,
      lastMessage: message,
    });
    this.lastSpokenKey = key;
    this.lastSpokenMessage = message;
  }

  getLastSpokenKey(): string | null {
    return this.lastSpokenKey;
  }

  getLastSpokenMessage(): string | null {
    return this.lastSpokenMessage;
  }

  getSpeakCount(hazardType: string, severity: string): number {
    return this.records.get(this.makeKey(hazardType, severity))?.speakCount ?? 0;
  }

  reset() {
    this.records.clear();
    this.lastSpokenKey = null;
    this.lastSpokenMessage = null;
  }
}

/**
 * GuardianDecisionLogger — Sprint 5
 *
 * Maintains a ring buffer of GuardianDecisionLogEntry records so that the Guardian
 * can explain — for every frame — why it spoke or why it stayed silent.
 *
 * Maximum capacity: MAX_LOG_SIZE entries (oldest are dropped). Pure state — no I/O.
 */

import type { GuardianDecisionLogEntry, RiskLevel, SpeakTrigger, DeduplicationFrame } from '@/types/cognitive';

const MAX_LOG_SIZE = 100;

export type { GuardianDecisionLogEntry };

export interface LogInput {
  spoke: boolean;
  speakTrigger: SpeakTrigger | null;
  silenceReason: string | null;
  hazardType: string | null;
  severity: string | null;
  confidence: number;
  riskLevel: RiskLevel;
  message: string | null;
  deduplicationFrame: DeduplicationFrame;
}

export class GuardianDecisionLogger {
  private logs: GuardianDecisionLogEntry[] = [];
  private totalSpoken = 0;
  private totalSilent = 0;

  /** Record a single Guardian decision. Newest entries appear first. */
  log(input: LogInput): GuardianDecisionLogEntry {
    const entry: GuardianDecisionLogEntry = { ...input, timestamp: new Date() };
    this.logs.unshift(entry);
    if (this.logs.length > MAX_LOG_SIZE) this.logs.pop();
    if (input.spoke) this.totalSpoken++;
    else this.totalSilent++;
    return entry;
  }

  /** Most recent entries first, up to `count` (default: 20) */
  getRecentLogs(count = 20): GuardianDecisionLogEntry[] {
    return this.logs.slice(0, Math.min(count, this.logs.length));
  }

  /** Only entries where the Guardian spoke */
  getSpokenLogs(count = 10): GuardianDecisionLogEntry[] {
    return this.logs.filter((l) => l.spoke).slice(0, count);
  }

  /** Only entries where the Guardian stayed silent */
  getSilentLogs(count = 10): GuardianDecisionLogEntry[] {
    return this.logs.filter((l) => !l.spoke).slice(0, count);
  }

  /** Total decision count (spoke + silent) */
  getTotalCount(): number { return this.logs.length + Math.max(0, this.totalSpoken + this.totalSilent - MAX_LOG_SIZE); }

  /** How many times the Guardian has spoken in total (across ring-buffer evictions too) */
  getTotalSpoken(): number { return this.totalSpoken; }

  /** How many times the Guardian has stayed silent in total */
  getTotalSilent(): number { return this.totalSilent; }

  /** Ratio of silent decisions to total decisions (0–1). High = guardian is conservative. */
  getSilenceRatio(): number {
    const total = this.totalSpoken + this.totalSilent;
    if (total === 0) return 0;
    return this.totalSilent / total;
  }

  /** True when the ring buffer has reached max capacity */
  isAtCapacity(): boolean { return this.logs.length >= MAX_LOG_SIZE; }

  /** Number of entries currently in the buffer */
  size(): number { return this.logs.length; }

  getSilenceReasonSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const log of this.logs) {
      if (!log.spoke && log.silenceReason) {
        summary[log.silenceReason] = (summary[log.silenceReason] ?? 0) + 1;
      }
    }
    return summary;
  }

  getSpeakTriggerSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const log of this.logs) {
      if (log.spoke && log.speakTrigger) {
        summary[log.speakTrigger] = (summary[log.speakTrigger] ?? 0) + 1;
      }
    }
    return summary;
  }

  clear(): void {
    this.logs = [];
    this.totalSpoken = 0;
    this.totalSilent = 0;
  }
}

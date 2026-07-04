// ─── V15 Latency Budget Engine ────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Latency budgeting, recording, analysis, and critical alert timing.

import type {
  LatencyBudget,
  LatencyRecord,
  BatteryMode,
} from '@/types/onDeviceAI';
import { DEFAULT_LATENCY_BUDGET } from '@/types/onDeviceAI';

// ─── Budget Creation ──────────────────────────────────────────────────────────

export function createLatencyBudget(overrides: Partial<LatencyBudget> = {}): LatencyBudget {
  return { ...DEFAULT_LATENCY_BUDGET, ...overrides };
}

export function adjustBudgetForBattery(
  budget: LatencyBudget,
  batteryMode: BatteryMode,
): LatencyBudget {
  const multipliers: Record<BatteryMode, number> = {
    performance: 0.8,   // tighter budget — push for speed
    balanced: 1.0,
    power_saver: 1.5,   // relax budget — allow slower processing
    critical: 2.0,      // very relaxed for non-critical; critical path still ≤500ms
  };
  const m = multipliers[batteryMode];
  return {
    perceptionMs: Math.round(budget.perceptionMs * m),
    reasoningMs: Math.round(budget.reasoningMs * m),
    speechMs: Math.round(budget.speechMs * m),
    totalMs: Math.round(budget.totalMs * m),
    criticalTargetMs: budget.criticalTargetMs, // never relaxed
  };
}

// ─── Recording ────────────────────────────────────────────────────────────────

export function recordLatency(
  budget: LatencyBudget,
  actual: { perceptionMs: number; reasoningMs: number; speechMs: number },
  isCritical = false,
): LatencyRecord {
  const totalMs = actual.perceptionMs + actual.reasoningMs + actual.speechMs;
  const withinBudget = isCritical
    ? totalMs <= budget.criticalTargetMs
    : totalMs <= budget.totalMs;
  return {
    perceptionMs: actual.perceptionMs,
    reasoningMs: actual.reasoningMs,
    speechMs: actual.speechMs,
    totalMs,
    timestamp: Date.now(),
    withinBudget,
    isCritical,
  };
}

// ─── Budget Checks ────────────────────────────────────────────────────────────

export function isBudgetExceeded(budget: LatencyBudget, actual: LatencyRecord): boolean {
  if (actual.isCritical) return actual.totalMs > budget.criticalTargetMs;
  return actual.totalMs > budget.totalMs;
}

export function isCriticalAlertOnTime(actualTotalMs: number, budget: LatencyBudget): boolean {
  return actualTotalMs <= budget.criticalTargetMs;
}

export function isPerceptionOnTime(perceptionMs: number, budget: LatencyBudget): boolean {
  return perceptionMs <= budget.perceptionMs;
}

export function isReasoningOnTime(reasoningMs: number, budget: LatencyBudget): boolean {
  return reasoningMs <= budget.reasoningMs;
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export function buildLatencyReport(records: LatencyRecord[]): {
  count: number;
  avgTotalMs: number;
  maxTotalMs: number;
  minTotalMs: number;
  budgetExceededCount: number;
  budgetExceededPct: number;
  criticalOnTimePct: number;
} {
  if (records.length === 0) {
    return {
      count: 0, avgTotalMs: 0, maxTotalMs: 0, minTotalMs: 0,
      budgetExceededCount: 0, budgetExceededPct: 0, criticalOnTimePct: 100,
    };
  }
  const totals = records.map((r) => r.totalMs);
  const exceeded = records.filter((r) => !r.withinBudget);
  const criticals = records.filter((r) => r.isCritical);
  const critOnTime = criticals.filter((r) => r.withinBudget).length;
  return {
    count: records.length,
    avgTotalMs: Math.round(totals.reduce((s, v) => s + v, 0) / totals.length),
    maxTotalMs: Math.max(...totals),
    minTotalMs: Math.min(...totals),
    budgetExceededCount: exceeded.length,
    budgetExceededPct: Math.round((exceeded.length / records.length) * 100),
    criticalOnTimePct: criticals.length > 0
      ? Math.round((critOnTime / criticals.length) * 100)
      : 100,
  };
}

// ─── Simulated Latency ────────────────────────────────────────────────────────

export function buildSimulatedLatencyRecord(
  budget: LatencyBudget,
  tick: number,
  isCritical = false,
): LatencyRecord {
  const noise = Math.sin(tick * 1.7) * 20;
  const perception = Math.max(5, budget.perceptionMs * 0.8 + noise);
  const reasoning = Math.max(5, budget.reasoningMs * 0.75 + noise * 0.5);
  const speech = Math.max(10, budget.speechMs * 0.9 + noise * 0.3);
  return recordLatency(budget, {
    perceptionMs: Math.round(perception),
    reasoningMs: Math.round(reasoning),
    speechMs: Math.round(speech),
  }, isCritical);
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatLatencyMs(ms: number): string {
  return `${ms}ms`;
}

export function formatBudgetStatus(record: LatencyRecord): string {
  return record.withinBudget ? '✅ Within budget' : '⚠ Budget exceeded';
}

export function formatBudget(budget: LatencyBudget): string {
  return `P:${budget.perceptionMs}ms + R:${budget.reasoningMs}ms + S:${budget.speechMs}ms = ${budget.totalMs}ms (crit: ≤${budget.criticalTargetMs}ms)`;
}

// Sprint 9 — Decision Trace Engine (pure functional, no async, no I/O)
// Manages the ring-buffer of ExplainedDecision traces and user feedback.

import type {
  ExplanationStore,
  DecisionTrace,
  ExplainedDecision,
  UserFeedback,
  FeedbackType,
  FeedbackSummary,
} from '@/types/trust';
import { MAX_TRACE_ENTRIES } from '@/types/trust';

// ─── Store lifecycle ──────────────────────────────────────────────────────────

export function createStore(): ExplanationStore {
  return { traces: [], feedback: {} };
}

// ─── Add a new decision trace ─────────────────────────────────────────────────

export function addTrace(
  store: ExplanationStore,
  decision: ExplainedDecision,
): ExplanationStore {
  const trace: DecisionTrace = { decision, feedback: null };
  const traces = [...store.traces, trace];
  // Ring buffer: drop oldest when over cap
  const trimmed =
    traces.length > MAX_TRACE_ENTRIES
      ? traces.slice(traces.length - MAX_TRACE_ENTRIES)
      : traces;
  return { ...store, traces: trimmed };
}

// ─── Retrieve traces ──────────────────────────────────────────────────────────

export function getRecentTraces(
  store: ExplanationStore,
  n: number,
): DecisionTrace[] {
  const all = store.traces;
  return all.slice(Math.max(0, all.length - n));
}

export function getLatestTrace(
  store: ExplanationStore,
): DecisionTrace | null {
  if (store.traces.length === 0) return null;
  return store.traces[store.traces.length - 1];
}

export function getDecisionById(
  store: ExplanationStore,
  id: string,
): DecisionTrace | null {
  return store.traces.find(t => t.decision.id === id) ?? null;
}

export function getAllTraces(store: ExplanationStore): DecisionTrace[] {
  return [...store.traces];
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export function addFeedback(
  store: ExplanationStore,
  decisionId: string,
  type: FeedbackType,
  note: string | null = null,
): ExplanationStore {
  const feedback: UserFeedback = {
    decisionId,
    type,
    timestamp: new Date(),
    note,
  };

  // Attach to matching trace
  const traces = store.traces.map(t =>
    t.decision.id === decisionId ? { ...t, feedback } : t,
  );

  return {
    traces,
    feedback: { ...store.feedback, [decisionId]: feedback },
  };
}

export function getFeedbackForDecision(
  store: ExplanationStore,
  decisionId: string,
): UserFeedback | null {
  return store.feedback[decisionId] ?? null;
}

export function getAllFeedback(store: ExplanationStore): UserFeedback[] {
  return Object.values(store.feedback);
}

// ─── Feedback summary ─────────────────────────────────────────────────────────

export function getFeedbackSummary(store: ExplanationStore): FeedbackSummary {
  const all = getAllFeedback(store);
  const total = all.length;
  const useful = all.filter(f => f.type === 'useful').length;
  const tooMuch = all.filter(f => f.type === 'too_much').length;
  const tooLate = all.filter(f => f.type === 'too_late').length;
  const wrong = all.filter(f => f.type === 'wrong').length;
  const unclear = all.filter(f => f.type === 'unclear').length;
  return {
    total,
    useful,
    tooMuch,
    tooLate,
    wrong,
    unclear,
    helpfulnessRate: total === 0 ? 0 : Math.round((useful / total) * 100) / 100,
  };
}

// ─── Filter traces by source / category ──────────────────────────────────────

export function filterTracesBySource(
  store: ExplanationStore,
  source: string,
): DecisionTrace[] {
  return store.traces.filter(t => t.decision.source === source);
}

export function filterTracesByCategory(
  store: ExplanationStore,
  category: string,
): DecisionTrace[] {
  return store.traces.filter(t => t.decision.category === category);
}

export function filterSpokenTraces(store: ExplanationStore): DecisionTrace[] {
  return store.traces.filter(t => t.decision.category !== 'silent');
}

export function filterSilentTraces(store: ExplanationStore): DecisionTrace[] {
  return store.traces.filter(t => t.decision.category === 'silent');
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export function getTraceCount(store: ExplanationStore): number {
  return store.traces.length;
}

export function getSilenceRatio(store: ExplanationStore): number {
  const total = store.traces.length;
  if (total === 0) return 0;
  const silent = filterSilentTraces(store).length;
  return Math.round((silent / total) * 100) / 100;
}

export function getAverageConfidence(store: ExplanationStore): number {
  const spoken = filterSpokenTraces(store);
  if (spoken.length === 0) return 0;
  const sum = spoken.reduce((acc, t) => acc + t.decision.confidence, 0);
  return Math.round((sum / spoken.length) * 100) / 100;
}

// ─── Clear ────────────────────────────────────────────────────────────────────

export function clearStore(_store: ExplanationStore): ExplanationStore {
  return createStore();
}

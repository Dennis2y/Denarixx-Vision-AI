// Sprint 9 — In-memory trust/explanation store (server-side singleton)

import type { ExplanationStore } from '@/types/trust';
import { createStore, addTrace, addFeedback } from '@/engines/decisionTraceEngine';
import type { ExplainedDecision, FeedbackType } from '@/types/trust';

let store: ExplanationStore = createStore();

export function getTrustStore(): ExplanationStore {
  return store;
}

export function recordDecision(decision: ExplainedDecision): void {
  store = addTrace(store, decision);
}

export function recordFeedback(
  decisionId: string,
  type: FeedbackType,
  note: string | null = null,
): boolean {
  const exists = store.traces.some(t => t.decision.id === decisionId);
  if (!exists) return false;
  store = addFeedback(store, decisionId, type, note);
  return true;
}

export function resetTrustStore(): void {
  store = createStore();
}

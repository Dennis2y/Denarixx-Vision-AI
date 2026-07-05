---
name: Sprint 9 trust types separation
description: trust.ts is its own type file — TrustLevel, FeedbackType, ExplainedDecision, etc. live here only; never merge into index.ts or cognitive.ts.
---

## Rule

`src/types/trust.ts` is the Sprint 9 type file. Never merge into `src/types/index.ts` (V1 types) or `src/types/cognitive.ts` (V2 Guardian types).

**Why:** trust.ts introduces `TrustLevel`, `FeedbackType`, `DecisionSource`, `ExplanationCategory`, `ExplainedDecision`, `UserFeedback`, `DecisionTrace`, `FeedbackSummary`, `ExplanationStore` — all Sprint 9 concerns. Merging would create circular import risks with explainableAIEngine which imports both cognitive.ts and trust.ts.

**How to apply:** Always import Sprint 9 types from `@/types/trust`. The three Sprint 9 engines (`explainableAIEngine`, `trustScoreEngine`, `decisionTraceEngine`) are pure functional. `trustStore.ts` is the server-side singleton.

## Architecture decisions

- `ExplanationStore` is an immutable value object — each mutation returns a new store (functional pattern).
- Ring buffer cap: `MAX_TRACE_ENTRIES = 50`. Oldest entries drop automatically on `addTrace`.
- `buildFromSafetyDecision` in explainableAIEngine bridges the existing `SafetyDecision` (V1) to `ExplainedDecision` (Sprint 9) for the session page integration.
- `TRUST_DISCLAIMER` must NOT contain words like "accurate" or "guaranteed" — tested by the suite.
- The two pre-existing lint warnings in `alertQualityEngine.ts` and `sensorNavigationBridgeEngine.ts` (unused vars) are pre-Sprint 9 and do not block builds — they are warnings only.

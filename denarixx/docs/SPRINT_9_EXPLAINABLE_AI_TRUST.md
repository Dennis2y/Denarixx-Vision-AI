# Sprint 9 — Explainable AI & Trust Engine

## Overview

Sprint 9 gives Denarixx Vision AI the ability to explain every decision it makes: why it spoke, why it stayed silent, what it saw, how confident it was, and what the user should do next. A trust scoring system quantifies AI reliability, and a feedback loop lets users mark decisions as useful, wrong, unclear, or late.

## Architecture

### Types (`src/types/trust.ts`)

| Type | Purpose |
|------|---------|
| `TrustLevel` | `high \| medium \| low \| uncertain \| needs_confirmation` |
| `FeedbackType` | `useful \| too_much \| too_late \| wrong \| unclear` |
| `DecisionSource` | `guardian \| navigation \| memory \| voice \| vision \| system` |
| `ExplanationCategory` | `spoke \| silent \| guided \| remembered \| warned` |
| `TrustScore` | level, score (0–1), explanation, factorsUsed |
| `WhatWasSeen` | detectedLabels, sceneDescription, hazardTypes, riskLevel |
| `WhySpoke` | trigger, triggerLabel, confidence, urgency |
| `WhySilent` | reason, fatigueLevel, cooldownRemainingMs |
| `ExplainedDecision` | full explanation record (all fields above combined) |
| `UserFeedback` | decisionId, type, timestamp, note |
| `DecisionTrace` | ExplainedDecision + optional UserFeedback |
| `FeedbackSummary` | per-type counts + helpfulnessRate |
| `ExplanationStore` | ring-buffer of traces + feedback map |

`MAX_TRACE_ENTRIES = 50` — oldest entries are dropped when the buffer is full.

---

### Engines

#### `explainableAIEngine.ts`
Pure functional. No async, no I/O.

| Function | Purpose |
|----------|---------|
| `buildGuardianExplanation(input)` | Converts a `GuardianDecision` → `ExplainedDecision` |
| `buildNavigationExplanation(input)` | Converts navigation guidance → `ExplainedDecision` |
| `buildMemoryExplanation(input)` | Converts a memory recall event → `ExplainedDecision` |
| `buildSilentExplanation(input)` | Records a silence decision (no hazard, cooldown, fatigue) |
| `formatExplanationText(decision)` | Returns a single readable string for screen readers |

Integration points:
- **Guardian**: reads `GuardianDecision.qualityDecision.speakTrigger` and `silenceReason`
- **Navigation**: reads instruction, distance, and risk level
- **Memory**: reads label, category, and confidence from `LongTermMemoryEntry`
- **Vision**: detections passed as `Detection[]` arrays

#### `trustScoreEngine.ts`
Pure functional. No async, no I/O.

| Function | Purpose |
|----------|---------|
| `classifyTrustLevel(score)` | `number → TrustLevel` |
| `computeTrustScore(confidence, source, history)` | Weighted score with feedback adjustment |
| `adjustTrustFromFeedback(current, type)` | Shifts score ±5–10% per feedback type |
| `trustLevelLabel(level)` | Human-readable label string |
| `trustLevelColor(level)` | CSS colour hint |
| `trustScorePercent(score)` | `0.82 → "82%"` |

Source reliability weights:
| Source | Weight |
|--------|--------|
| system | 95% |
| guardian | 90% |
| navigation | 85% |
| vision | 85% |
| memory | 80% |
| voice | 75% |

#### `decisionTraceEngine.ts`
Pure functional. Operates on `ExplanationStore` value objects.

| Function | Purpose |
|----------|---------|
| `createStore()` | Empty store |
| `addTrace(store, decision)` | Appends trace, enforces ring buffer |
| `getRecentTraces(store, n)` | Last N traces |
| `getLatestTrace(store)` | Most recent trace |
| `getDecisionById(store, id)` | O(n) lookup |
| `addFeedback(store, id, type, note)` | Attaches feedback to matching trace |
| `getFeedbackSummary(store)` | Per-type counts and helpfulness rate |
| `getSilenceRatio(store)` | silent / total |
| `getAverageConfidence(store)` | Mean confidence of spoken decisions |
| `filterTracesBySource(store, source)` | Filter by origin |
| `clearStore(store)` | Returns a fresh empty store |

---

### API Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/trust/explanation?n=10` | Last N explained decisions |
| `POST` | `/api/trust/explanation` | Record a new silent explanation |
| `POST` | `/api/trust/feedback` | Submit user feedback on a decision |
| `GET` | `/api/trust/feedback` | All feedback + summary |
| `GET` | `/api/trust/trace?source=guardian` | Decision trace stats + recent entries |

---

### Store (`src/lib/trustStore.ts`)

Server-side in-memory singleton. Resets on server restart (Phase 1).

| Export | Purpose |
|--------|---------|
| `getTrustStore()` | Read current store |
| `recordDecision(decision)` | Append a trace |
| `recordFeedback(id, type, note)` | Attach feedback, returns false if ID not found |
| `resetTrustStore()` | Test/reset utility |

---

### UI Component (`ExplanationPanel.tsx`)

Located at `src/components/session/ExplanationPanel.tsx`.

- Collapsible panel on the Session page
- Always shows trust badge (level + percentage)
- Expanded view shows: what was detected, risk, confidence, why spoke/silent, recommended action, uncertainty note, full readable text, trust factors, feedback buttons
- Feedback buttons: ✓ Useful / − Too much / ⏱ Too late / ✗ Wrong / ? Unclear
- Once feedback given, shows confirmation text
- Fully accessible: `role="region"`, `aria-label`, `aria-expanded`

---

## Confidence System

| Level | Score range | Meaning |
|-------|-------------|---------|
| High | ≥ 0.80 | Reliable detection, act with confidence |
| Medium | 0.60–0.79 | Proceed carefully |
| Low | 0.40–0.59 | Verify independently |
| Uncertain | 0.20–0.39 | Extra caution required |
| Needs Confirmation | < 0.20 | Cannot act alone on this |

---

## Privacy Model

- No explanation data is tied to face recognition (never enabled)
- No biometric data is included in any trace
- Explanations reference detected _labels_ only (e.g. "vehicle", "stairs"), never personal identifiers
- All store data is in-memory and resets on server restart (Phase 1)
- `TRUST_DISCLAIMER` is embedded in every API response

---

## User Feedback Loop

Feedback adjusts trust scores in future decisions from the same source:

| Feedback | Score Δ |
|----------|---------|
| Useful | +5% |
| Too much | −3% |
| Too late | −4% |
| Wrong | −10% |
| Unclear | −3% |

---

## Integration with Other Systems

| System | How explanation is generated |
|--------|------------------------------|
| Cognitive Guardian | `buildGuardianExplanation` reads `GuardianDecision` + `qualityDecision` |
| Navigation Engine | `buildNavigationExplanation` reads instruction + distance + risk |
| Long-Term Memory | `buildMemoryExplanation` reads label + category + confidence |
| Voice Companion | Explanations can reference voice preference context |
| Vision Session | `ExplanationPanel` renders the latest decision on the Session page |

---

## Future: Cloud Sync (Phase 2)

- Persist `ExplanationStore` to PostgreSQL
- Aggregate feedback across sessions to tune trust weights per user
- Surface trends: "You often find evening guidance too late — adjusting timing"
- Allow users to export their decision history as JSON

---

## Files

| File | Lines |
|------|-------|
| `src/types/trust.ts` | types |
| `src/engines/explainableAIEngine.ts` | explanation builder |
| `src/engines/trustScoreEngine.ts` | trust scoring |
| `src/engines/decisionTraceEngine.ts` | ring-buffer + feedback |
| `src/lib/trustStore.ts` | server singleton |
| `src/app/api/trust/explanation/route.ts` | GET + POST |
| `src/app/api/trust/feedback/route.ts` | POST + GET |
| `src/app/api/trust/trace/route.ts` | GET |
| `src/components/session/ExplanationPanel.tsx` | UI panel |
| `tests/explainableAI.test.ts` | test suite |

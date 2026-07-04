# Sprint 5 — Cognitive Guardian Alert Quality

## Goal

Make the Guardian speak **less**, speak **better**, and **prioritise real danger**.  
Input: Sprint 4 real vision categories (`DetectedCategories`).  
Output: Fewer, smarter, actionable alerts with auditable decision logs.

---

## Problems Solved

| Before Sprint 5 | After Sprint 5 |
|---|---|
| Repeated alert every frame for the same hazard | Cross-frame deduplication — only speaks on change |
| Generic "hazard detected" wording | Specific directional: "Obstacle in your path. Move to the side." |
| No explanation for silence | Logged reason: `cooldown: vehicle within 10s (3s ago)` |
| High cooldown: 15s, Medium: 30s | High: 10s, Medium: 20s — better hazard tracking |
| No category awareness | Uses Sprint 4 `DetectedCategories` for richer wording |

---

## Architecture

```
CognitiveGuardianEngine
  └── AlertQualityEngine (Sprint 5 — activated when categories provided)
        ├── AlertDeduplicationEngine   — frame-level appeared/disappeared/ongoing
        ├── AlertThrottleEngine        — per-severity cooldowns (Sprint 5 values)
        ├── GuardianWordingEngine      — specific, directional messages
        └── GuardianDecisionLogger     — ring buffer of 100 decisions
```

### Backward compatibility

`CognitiveGuardianEngine.process()` gains optional parameters `categories`, `aiHazards`, and `repeatRequested`. When **not** provided, behaviour is identical to V2. When provided, the Sprint 5 quality layer activates and the result includes `GuardianDecision.qualityDecision`.

---

## Speak-When Rules (Priority Order)

| Priority | Condition | Trigger |
|---|---|---|
| 1 | Critical severity | `critical_never_silenced` |
| 2 | User asked for repeat | `repeat_requested` |
| 3 | Hazard not in previous frame | `new_hazard` or `hazard_returned` |
| 4 | Risk level went up | `risk_increased` |
| 5 | Confidence rose ≥ 10% (object closer) | `confidence_increased` |
| 6 | User activity changed (walking → stopped) | `user_state_changed` |
| 7 | Past cooldown window | `cooldown_expired` |
| — | Otherwise | silent (reason logged) |

---

## Updated Cooldowns

| Severity | Sprint 4 (V2) | Sprint 5 | Rationale |
|---|---|---|---|
| critical | 5 s | 5 s | Unchanged — life-safety, repeats needed |
| high | 15 s | **10 s** | Reduced for faster re-alert on serious hazards |
| medium | 30 s | **20 s** | Better tracking of evolving medium hazards |
| low | 30 s | 30 s | Unchanged |

---

## Wording Improvements

### Guiding principle
> Every alert must say **what** is there and **what to do**.  
> Never say "hazard detected".

### Examples

| Hazard | Severity | Old wording | New wording |
|---|---|---|---|
| obstacle | high | "hazard detected" | "Obstacle in your path. Move to the side." |
| vehicle | critical | "Vehicle ahead — stop and wait." | "Stop — vehicle approaching fast. Do not move." |
| stairs | high | "stairs ahead" | "Stairs ahead. Slow down and reach for a railing." |
| crossing | high | "road ahead" | "Crossing ahead. Stop and wait for a safe gap." |
| person | high | "person detected" | "Someone is blocking your way. Navigate around them." |

### Directional hints

When a bounding box is available, the wording engine adds directional context:
- `boundingBox.x < 0.35` → "It appears to be on your left."
- `boundingBox.x > 0.65` → "It appears to be on your right."

### Confidence hedging

| Confidence | Prefix |
|---|---|
| ≥ 0.70 | None (definitive) |
| 0.50–0.69 | "There may be something ahead." |
| < 0.50 | "I'm not certain, but..." |

---

## Deduplication Logic

`AlertDeduplicationEngine` tracks labels across frames in a rolling 2-frame window.

| Scenario | Classification |
|---|---|
| Label absent in frame N, present in frame N+1, never seen before | `new_hazard` |
| Label absent in frame N, present in frame N+1, seen in earlier frames | `hazard_returned` |
| Label in both frame N and frame N+1 | `ongoing` |
| Label in frame N, absent in frame N+1 | `disappeared` (no alert) |
| Ongoing label, confidence rises ≥ 10% | `confidence_increased` speak trigger |

---

## Decision Log

Every frame produces a `GuardianDecisionLogEntry`:

```typescript
{
  timestamp: Date;
  spoke: boolean;
  speakTrigger: SpeakTrigger | null;  // why it spoke
  silenceReason: string | null;        // why it stayed silent
  hazardType: string | null;
  severity: string | null;
  confidence: number;
  riskLevel: RiskLevel;
  message: string | null;
  deduplicationFrame: {
    appeared: string[];
    disappeared: string[];
    ongoing: string[];
    isFirstFrame: boolean;
  };
}
```

The logger holds a ring buffer of **100 entries**. Query methods:
- `getRecentLogs(n)` — newest first
- `getSpokenLogs(n)` — only spoke=true
- `getSilentLogs(n)` — only spoke=false
- `getSilenceRatio()` — ratio of silent to total decisions
- `getSpeakTriggerSummary()` — counts by trigger type
- `getSilenceReasonSummary()` — counts by silence reason

---

## New Files

| File | Purpose |
|---|---|
| `src/engines/alertDeduplicationEngine.ts` | Cross-frame tracking |
| `src/engines/guardianWordingEngine.ts` | Specific, directional messages |
| `src/engines/guardianDecisionLogger.ts` | Ring-buffer decision log |
| `src/engines/alertQualityEngine.ts` | Sprint 5 orchestrator |
| `src/types/cognitive.ts` | Added: `SpeakTrigger`, `DeduplicationFrame`, `GuardianDecisionLogEntry`, `AlertQualityDecision` |

## Updated Files

| File | Change |
|---|---|
| `src/engines/alertThrottleEngine.ts` | medium: 30→20s, high: 15→10s |
| `src/engines/cognitiveGuardianEngine.ts` | Accepts `categories?`, `aiHazards?`, `repeatRequested?`; activates AlertQualityEngine |
| `tests/cognitiveGuardian.test.ts` | Updated test description "15s" → "10s" |

---

## Tests

- **Existing:** `tests/cognitiveGuardian.test.ts` — 37 tests, all green
- **New:** `tests/guardianAlertQuality.test.ts` — 80 tests covering:
  - Deduplication engine (13 tests)
  - Updated throttle cooldowns (5 tests)
  - Wording engine (13 tests)
  - Decision logger (8 tests)
  - AlertQualityEngine speak-when rules (8 tests)
  - Message quality (2 tests)
  - Deduplication frame in decision (2 tests)
  - Priority ordering (2 tests)
  - CognitiveGuardianEngine integration (5 tests)

---

## Privacy

No changes to privacy guarantees. Sprint 5 is a pure decision-quality layer:
- No audio recording, no storage of spoken content
- No user identification or emotion inference
- Decision logs exist only in-memory; cleared on session end
- All new engines are pure functions with no I/O

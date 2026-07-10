# V3 Cognitive Reasoning Engine

## Overview

Version 3 transforms Denarixx Vision AI from an object-detection system into a **situational understanding system**. Instead of detecting individual objects and emitting raw alerts, the V3 pipeline:

1. Understands the **entire environment** as a coherent scene
2. **Reasons internally** about what is happening and what is likely to happen next
3. Predicts **specific future events** before they become dangerous
4. Decides on a **concrete recommended action**
5. Generates natural, **human-sounding guidance** — the way a skilled sighted guide would speak

---

## Architecture

```
Detections
    │
    ▼
┌─────────────────────────────────────┐
│ EnvironmentUnderstandingEngine      │  "Moving beside traffic"
│  Rule-based environment inference   │  "Walking on pavement"
└────────────────────┬────────────────┘
                     │
              environment
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                │
┌──────────────┐  ┌──────────────┐   │
│ Risk         │  │ Cognitive    │   │
│ Prediction   │  │ Reasoning    │   │
│ Engine       │  │ Engine       │   │
└──────┬───────┘  └──────┬───────┘   │
       │                 │           │
    risk              reasoning      │
       │                 │           │
       └────────┬────────┘           │
                │                    │
                ▼                    │
┌───────────────────────────────────┐ │
│ ActionDecisionEngine              │◄┘
│  Maps risk + reasoning → action   │
└────────────────┬──────────────────┘
                 │
              action
                 │
                 ▼
┌───────────────────────────────────┐
│ HumanGuideEngine                  │
│  Generates natural language        │
└───────────────────────────────────┘
```

---

## Engines

### 1. EnvironmentUnderstandingEngine

**File:** `src/engines/environmentUnderstandingEngine.ts`

Maps a set of detections to a coherent environmental description using a priority-ordered rule system. Higher-priority rules take precedence — a vehicle+road scene is classified as "traffic" even if pavement is also present.

**Example outputs:**
- `vehicle + road` → "Moving beside traffic" (type: `traffic`)
- `vehicle` → "Approaching a pedestrian crossing" (type: `crossing`)
- `stairs` → "Approaching a staircase" (type: `corridor`, indoor)
- `bicycle + person` → "Walking through a busy shared area" (type: `market`)
- `pavement` → "Walking on pavement" (type: `pavement`)
- _(empty)_ → "Surroundings unclear — scanning." (type: `unknown`)

---

### 2. RiskPredictionEngine

**File:** `src/engines/riskPredictionEngine.ts`

Predicts specific upcoming events before they become dangerous. Each detection label and confidence level maps to a predicted event, risk level, and estimated time-to-impact.

**Risk levels:** `critical` · `high` · `medium` · `low` · `informational` · `none`

**Example predictions:**
| Detection | Confidence | Predicted Event | Risk | Time |
|---|---|---|---|---|
| vehicle | ≥ 0.80 | Vehicle may be turning toward crossing | critical | 2s |
| vehicle | ≥ 0.40 | Vehicle approaching your position | high | 4s |
| stairs | ≥ 0.50 | Staircase ahead — risk of fall | high | 3s |
| bicycle | ≥ 0.70 | Cyclist may suddenly change direction | medium | 5s |
| obstacle | ≥ 0.65 | Object blocking path directly | medium | 3s |
| person | ≥ 0.70 | Person may change direction suddenly | low | 6s |

When multiple detections are present, the highest risk level wins.

> **Note:** This is a different engine from the V2 `PredictiveRiskEngine` (in `predictiveRiskEngine.ts`). The V3 version predicts specific events with time estimates; the V2 version tracks historical frame sequences.

---

### 3. CognitiveReasoningEngine

**File:** `src/engines/cognitiveReasoningEngine.ts`

Answers eight internal questions before any audio is produced:

| # | Question | Derivation |
|---|---|---|
| 1 | What is happening? | From `EnvironmentUnderstanding.summary` |
| 2 | What is likely to happen next? | From `RiskPrediction.predictedEvent` + `timeToImpactSeconds` |
| 3 | Is the user safe? | `riskLevel` ≤ `informational` |
| 4 | Does the user need guidance? | `riskLevel` ≥ `medium` |
| 5 | Should I stay silent? | Risk is `none` and scene is empty |
| 6 | Should I interrupt immediately? | `riskLevel` ≥ `high` |
| 7 | Should I reassure the user? | Risk ≤ `informational` and detections exist |
| 8 | Should I predict danger? | Predicted event exists and risk ≥ `medium` |

Confidence is a weighted blend: `environment.confidence × 0.6 + risk.confidence × 0.4`.

---

### 4. ActionDecisionEngine

**File:** `src/engines/actionDecisionEngine.ts`

Maps cognitive reasoning + risk prediction + environment to a concrete recommended action and a human-readable instruction.

**Possible actions:**
`continue_walking` · `slow_down` · `stop` · `turn_left` · `turn_right` · `move_left` · `move_right` · `wait` · `cross_now` · `avoid_obstacle` · `none`

**Decision rules (priority order):**
1. `critical` risk → **stop** (interrupt, priority: critical)
2. `high` risk + traffic environment → **wait** (interrupt, priority: high)
3. `high` risk → **slow_down** (interrupt, priority: high)
4. `medium` risk + crossing → **wait** (no interrupt, priority: medium)
5. `medium` risk + corridor → **avoid_obstacle** (no interrupt, priority: medium)
6. `medium` risk → **slow_down** (no interrupt, priority: medium)
7. `low` risk → **slow_down** (no interrupt, priority: low)
8. Safe + reassure → **continue_walking** (no interrupt, priority: informational)
9. Default → **continue_walking** (no interrupt, priority: informational)

---

### 5. HumanGuideEngine

**File:** `src/engines/humanGuideEngine.ts`

Generates natural, guide-like audio messages. Never says "Object detected" or "Hazard level medium".

**Priority logic:**
- **shouldInterruptImmediately** → Speaks action instruction directly, short and clear
- **shouldPredictDanger** → Combines environment context + action instruction
- **shouldReassure** (safe) → Cycles through warm reassurances + environment context
- **needsGuidance** → Speaks action instruction

**Uncertainty:** If `reasoning.confidence < 0.70`, appends *"I'm not completely sure — please check carefully."* to non-critical messages.

**Reassurance rotation:**
```
"You're doing fine."
"The path ahead looks clear."
"Keep walking straight."
"All good so far."
"The way ahead seems safe."
```

**shouldSpeak rules:**
- `true` if `shouldInterruptImmediately` (always speak critical messages)
- `false` if `shouldStaySilent` and not urgent
- `true` in all other cases

---

## Decision Flow

```
Frame received
      │
      ▼
EnvironmentUnderstandingEngine.understand(detections)
      │
      ├──► RiskPredictionEngine.predict(detections, environment)
      │
      ├──► CognitiveReasoningEngine.reason(environment, risk)
      │          Answers 8 internal questions
      │
      ├──► ActionDecisionEngine.decide(reasoning, risk, environment)
      │          Picks action from priority-ordered rule table
      │
      └──► HumanGuideEngine.generate(action, reasoning, environment)
                 Returns { text, priority, shouldSpeak, uncertaintyNote }
```

Total pipeline: **<1 ms** per frame (pure computation, no I/O)

---

## Reasoning Pipeline UI

The `/reasoning` page provides a live interactive debugger showing all pipeline stages for each frame of a simulated scenario.

**6-panel layout:**
1. **Environment** — type, summary, indoor/outdoor, detected labels, confidence
2. **Cognitive Reasoning** — all 8 internal question answers with boolean indicators
3. **Risk Prediction** — predicted event, risk level, factors, time to impact, confidence bar
4. **Action Decision** — recommended action, instruction, priority, "why" explanation, interrupt flag
5. **Human Guide Message** — the exact text that would be spoken, with uncertainty note if applicable
6. **Pipeline Stats** — frames done, timing, blended confidence, peak risk, stage checklist

A scrollable **Frame Log** at the bottom shows all completed frames with guide text, risk level, and timing.

---

## Confidence Handling

- If overall confidence is below **70%**, the HumanGuideEngine appends an uncertainty note to all non-critical messages.
- The engine never sounds certain when confidence is low.
- Confidence is computed as a blended float (0–1) combining environment and risk confidence.

---

## Priority Levels

| Level | When | Interrupts |
|---|---|---|
| Critical | Immediate danger — stop required | ✅ Always |
| High | Significant risk — caution required | ✅ Always |
| Medium | Moderate risk — awareness needed | ✗ No |
| Low | Minor risk — informational | ✗ No |
| Informational | Path clear — reassurance | ✗ No |

Only **Critical** and **High** interrupt current audio narration.

---

## Future Integration (Phase 4)

When real camera inference is available (Phase 4), the V3 engines slot in as the reasoning layer on top of real model detections:

```
Real Camera Frame
        │
        ▼
 CV Model (Phase 4)   ←── replaces MockVisionProvider
        │
     Detections
        │
        ▼
  V3 Reasoning Pipeline   ←── unchanged
        │
    GuideMessage
        │
        ▼
   AudioGuidance (spoken to user)
```

No changes are required to the V3 engines when switching from simulation to real inference — only the detection source changes.

---

## Backward Compatibility

V3 is fully additive:
- All V1 core engine tests continue to pass (24/24)
- All V2 Cognitive Guardian + AlertThrottleEngine tests continue to pass (37/37)
- V3 engines import only from `@/types` (V1) and `@/types/reasoning` (V3 new)
- No existing engine files were modified
- The `/reasoning` page is a new route; all existing pages are unchanged

---

## Tests

**File:** `denarixx/tests/v3reasoning.test.ts`

Run with:
```bash
npx tsx tests/v3reasoning.test.ts
```

Coverage:
- **EnvironmentUnderstandingEngine** — 7 tests: traffic, crossing, stairs, market, pavement, empty input, label listing
- **RiskPredictionEngine** — 6 tests: critical/high vehicle, stairs, person, empty, multi-detection dominance
- **CognitiveReasoningEngine** — 5 tests: interrupt flag, reassure flag, whatIsHappening, whatIsLikelyNext, confidence range
- **ActionDecisionEngine** — 4 tests: stop for critical, continue for safe, corridor obstacle, reasoning string
- **HumanGuideEngine** — 5 tests: critical speaks, reassurance priority, uncertainty note, reset, silent mode

# V9 Human Behaviour & Social Intelligence

Phase 9 adds a **Social Intelligence Layer** to Denarixx Vision AI.
It enables the platform to understand human behaviour and social situations
in real time — helping blind and visually impaired users navigate safely
through environments with other people present.

---

## Goal

Enable the AI to:
- Recognise what nearby people are doing (walking, running, waiting, crossing, etc.)
- Understand social situations (approaching person, queue, crowd)
- Predict whether someone will cross the user's path or interact with them
- Provide calm, clear, privacy-respecting spoken guidance

---

## Architecture

```
Vision Frame (DetectedPerson[])
        │
        ▼
HumanBehaviourEngine
  - inferActivityFromScene()     ← scene description keywords
  - inferActivityFromSizeRatio() ← bounding box size proxy
  - directionFromScreen()        ← lateral position
  - distanceZoneFromMeters()     ← physical distance
  - estimateInteractionProbability()
        │
        ▼ NearbyPerson[]
        ├─────────────────────────────────────────────────────┐
        ▼                                                     ▼
CrowdUnderstandingEngine                   InteractionPredictionEngine
  - densityFromCount()                       - pathCrossingProbability()
  - detectQueue()                            - collisionRisk()
  - crowdRiskLevel()                         - timeToClosestApproachSec()
  - describeCrowd()                          - interactionLikelihood()
        │                                                     │
        └─────────────────┬───────────────────────────────────┘
                          ▼
               SocialAwarenessEngine
                 - analyzeSocialContext()   ← full pipeline
                 - buildPrimaryGuidance()   ← spoken output
                 - buildAlerts()            ← ordered alerts
                          │
                          ▼
               SocialContext (guidance, alerts, crowd, predictions)
                          │
                          ▼
               SocialAwarenessPanel (UI)
```

---

## Engines

### HumanBehaviourEngine (`src/engines/humanBehaviourEngine.ts`)

Classifies human activities from vision data. Never identifies individuals.

**Inputs:**
- `DetectedPerson[]` — bounding boxes, size ratios, screen positions from vision
- `sceneDescription: string` — raw text from the VisionEngine

**Activity inference:**
1. Scene keywords take priority (`falling` > `running` > `waving` > …)
2. Size ratio fallback: `sizeRatio > 0.85` → very close / approaching; `< 0.12` → far / standing

**Direction inference:**
- Screen cx < 0.33 → left; cx > 0.67 → right; else ahead
- Screen cy > 0.78 → behind; cy < 0.4 → further ahead

**Distance zones:**
| Zone | Physical | Size ratio |
|------|----------|------------|
| very_close | < 1 m | > 0.80 |
| close | 1–3 m | 0.55–0.80 |
| near | 3–6 m | 0.30–0.55 |
| medium | 6–15 m | 0.12–0.30 |
| far | > 15 m | < 0.12 |

---

### CrowdUnderstandingEngine (`src/engines/crowdUnderstandingEngine.ts`)

Estimates crowd state from a list of `NearbyPerson` descriptors.

**Density:**
| Density | Person count |
|---------|-------------|
| empty | 0 |
| sparse | 1–2 |
| moderate | 3–5 |
| dense | 6–9 |
| very_dense | 10+ |

**Queue detection:** 2+ stationary/waiting persons in the same forward direction.

**Crowd risk:**
| Density | Approaching count | Risk |
|---------|------------------|------|
| very_dense | ≥ 2 | high |
| very_dense | 0–1 | medium |
| dense | ≥ 2 | medium |
| dense | 0–1 | low |
| moderate | ≥ 3 | medium |
| any | ≥ 1 | low |

---

### InteractionPredictionEngine (`src/engines/interactionPredictionEngine.ts`)

Produces probabilistic predictions about each nearby person's trajectory.
No intent is inferred — only observable movement patterns are extrapolated.

**Predictions per person:**
- `pathCrossingProbability` — will they cross the user's path?
- `collisionRisk` — probability of contact if neither changes course
- `interactionLikelihood` — probability of social engagement
- `timeToClosestApproachSec` — estimated seconds to closest point

**Speed model (approach speed → m/s):**
| Speed | m/s |
|-------|-----|
| stationary | 0 |
| slow | 1.0 |
| moderate | 1.8 |
| fast | 4.0 |

---

### SocialAwarenessEngine (`src/engines/socialAwarenessEngine.ts`)

Orchestrates all three engines and produces the final `SocialContext`:
- Runs behaviour analysis → crowd analysis → predictions
- Builds primary guidance (single most important spoken message)
- Builds alert list (ordered urgent → warning → info)
- Provides 8 simulation scenarios for testing and demo

---

## Guidance examples

| Situation | Guidance |
|-----------|----------|
| Approaching from right | "Someone is approaching from your right." |
| Fast approach | "Someone is approaching quickly ahead." |
| Person waiting | "A person appears to be waiting ahead." |
| Small queue | "A small queue is ahead." (via hasQueue) |
| Dense crowd | "The area is becoming crowded." |
| No one nearby | "There is plenty of space to continue walking." |
| Person waving | "Someone ahead appears to be waving." |
| Person falling | "A person may have fallen ahead." |

---

## Privacy & Safety

### Privacy rules (enforced throughout all engines)

| Rule | Implementation |
|------|----------------|
| No identity inference | People are never named or identified |
| No emotion as fact | Hedging language: "appears to", "may be" |
| No intent guessing | Only observable movement described |
| No biometric storage | No face data stored or transmitted |
| Observable-only language | Activity, direction, distance, speed |

### Safety rules

- **Falling person** is always elevated to `urgent` alert and primary guidance
- **Personal space breach** (< 1.5 m) is elevated to `urgent`
- **High collision risk** is elevated to `warning`
- **Fast approaching runner** is elevated to `warning`

### Limitations

- All data is **simulation only** in Phase 9 — no real camera inference
- Distance estimates from `sizeRatio` are approximate (±50% accuracy)
- Activity inference relies on scene description keywords and bounding box proxies, not true pose estimation
- No temporal tracking — each frame is independent (no speed history)
- Crowd density is based on visible frame only — off-screen crowds not counted

---

## UI: Social Awareness Panel

`src/components/session/SocialAwarenessPanel.tsx`

Displayed on the Vision Session page. Updates every 4 s during a session.

Shows:
- **Primary guidance** — most important spoken message (yellow highlight)
- **Stats row** — nearby count · approaching count · personal space status
- **Crowd density bar** — 5-level visual indicator
- **Alerts list** — ordered urgent → warning → info
- **Nearby persons list** — activity, direction, distance, interaction probability
- **Privacy notice** — reminder that no identity is inferred

---

## Simulation scenarios

| Scenario | Persons | Key signals |
|----------|---------|-------------|
| `empty_street` | 0 | Clear guidance |
| `someone_approaching` | 1 | Approaching, ahead |
| `someone_waiting` | 1 | Waiting, near entrance |
| `small_queue` | 3 | Stationary, queue detected |
| `people_crossing` | 2 | Crossing from left |
| `dense_crowd` | 7 | Dense, moderate risk |
| `person_waving` | 1 | Waving, interaction alert |
| `person_falling` | 1 | Falling, urgent alert |

---

## Tests

```bash
cd denarixx && npx tsx tests/humanBehaviour.test.ts
```

Covers 80+ cases across all four engines:
- Activity inference: scene keywords, size ratio, priority ordering
- Direction: all 8 zones from screen cx/cy
- Distance: both metres and size-ratio paths
- Approach speed: all activity types
- Interaction probability: distance × direction × activity
- Crowd density: 0–15 person counts
- Queue detection: 0–3 stationary persons in various directions
- Crowd risk: full risk matrix
- Interaction prediction: collision risk, path crossing, time to approach
- Scenario simulation: all 8 scenarios with expected outputs
- Privacy: no names or identity in any output

---

## File map

| File | Role |
|------|------|
| `src/types/social.ts` | All V9 types — HumanActivity, NearbyPerson, SocialContext, … |
| `src/engines/humanBehaviourEngine.ts` | Activity, direction, distance, interaction probability |
| `src/engines/crowdUnderstandingEngine.ts` | Density, queue detection, crowd risk |
| `src/engines/interactionPredictionEngine.ts` | Collision risk, path crossing, time to approach |
| `src/engines/socialAwarenessEngine.ts` | Full pipeline, guidance, alerts, scenarios |
| `src/components/session/SocialAwarenessPanel.tsx` | Live UI panel |
| `tests/humanBehaviour.test.ts` | Comprehensive V9 tests |

---

## Future extensions

- **Real pose estimation:** Replace keyword inference with ML pose landmarks
- **Temporal tracking:** Maintain person tracks across frames for speed measurement
- **Sign language detection:** Recognise BSL / ASL as a special waving/pointing case
- **Group behaviour:** Detect families, tour groups, protest crowds as distinct entities
- **Phase 10 integration:** Combine with V8 glasses camera for egocentric social view

# Denarixx Vision AI — V2 Cognitive Guardian Roadmap

> "Act like a careful human guide, not an object-labeling tool."

---

## What V2 Is

Version 1 built the safety core: hazard detection, scene description, audio guidance, memory, and a conversation stub. Everything was **reactive** — the user asked, the system answered.

Version 2 transforms Denarixx into a **proactive AI guardian companion**. The system continuously watches the environment and makes autonomous decisions:

1. Is the user safe?
2. Should the AI stay silent?
3. Should the AI warn immediately?
4. Should the AI guide gently?
5. Should the AI provide companionship?
6. What matters right now?
7. What might happen in the next few seconds?

---

## The Seven-Question Framework

Every frame cycle, the Cognitive Guardian Engine answers all seven questions before deciding what to say (or whether to stay quiet).

| Question | Engine | Output |
|---|---|---|
| Is the user safe? | `CognitiveGuardianEngine` + `UserStateEngine` | UserState (movement, environment, isAtRisk) |
| Should the AI stay silent? | `SilenceDecisionEngine` | SilenceDecision (shouldBeSilent, reason, cooldown) |
| Should the AI warn immediately? | `ProactiveAlertEngine` | Alert urgency + trigger |
| Should the AI guide gently? | `PredictiveRiskEngine` → Guardian | Action hint based on predicted risk |
| Should the AI provide companionship? | `CompanionContextEngine` | CompanionMessage (tone, text, isAppropriate) |
| What matters right now? | `CognitiveGuardianEngine` | GuardianAction (warn / guide / companion / acknowledge / silent) |
| What might happen next? | `PredictiveRiskEngine` | PredictedRisk[] (horizon: immediate / near / potential) |

---

## V2 Engine Architecture

```
Camera / Sensor Input
    ↓
VisionEngine (V1 — unchanged)
    ↓
HazardDetectionEngine (V1 — unchanged)
    ↓
┌─────────────────────────────────────────────────────────────┐
│ V2 Cognitive Layer                                           │
│                                                             │
│  UserState Inference ──────────────────────────────────┐   │
│                                                        ↓   │
│  SilenceDecisionEngine                                 │   │
│  ProactiveAlertEngine        ┌─────────────────────┐   │   │
│  PredictiveRiskEngine   ────→│ CognitiveGuardian   │←──┘   │
│  CompanionContextEngine      │     Engine          │       │
│  RoutineLearningEngine  ────→│                     │       │
│                              └────────┬────────────┘       │
└───────────────────────────────────────┼────────────────────┘
                                        ↓
                               GuardianDecision
                          (action, message, priority,
                           interrupt, predictedRisks)
                                        ↓
                          Priority Audio Queue → Web Speech API
```

---

## New Engines

### CognitiveGuardianEngine
**File:** `src/engines/cognitiveGuardianEngine.ts`

Orchestrates all V2 sub-engines. Receives scene + alerts + user state. Decides the single best action per frame. Maintains internal state (lastSpokenAt, lastAlertAt, previousScene) to avoid over-narration.

**Outputs:** `GuardianDecision`

### ProactiveAlertEngine
**File:** `src/engines/proactiveAlertEngine.ts`

Decides when to fire an alert proactively, based on alert severity, confidence, user state, and time since last alert. Does not require the user to ask. Independent cooldown windows per severity tier (critical: 4s, high: 8s, normal: 12s).

### SilenceDecisionEngine
**File:** `src/engines/silenceDecisionEngine.ts`

The most important engine for user trust. Answers: *should we say nothing right now?*

Silence reasons:
- `no_change` — scene unchanged since last narration
- `risky_movement` — user crossing road or moving fast near hazard
- `recently_spoken` — within cooldown window (8 seconds default)
- `low_confidence` — below 50% confidence threshold
- `companion_paused` — companion mode suppressed for safety

Emergency movement bypasses all silence rules.

### PredictiveRiskEngine
**File:** `src/engines/predictiveRiskEngine.ts`

Looks ahead. Given current detections and user state, predicts what is likely to happen in the next 0–10 seconds. Outputs risks ordered by horizon (immediate → near → potential).

Example: vehicle + road + user walking → "Vehicle on road ahead — risk of collision if path continues."

### CompanionContextEngine
**File:** `src/engines/companionContextEngine.ts`

Generates contextually appropriate companionship messages when the user is not in danger. Tones: reassuring, informative, cautious, silent.

**Critical rule:** Companion messages are always suppressed during risky movement or active warnings. A companion message must never distract a user who is crossing a road.

### RoutineLearningEngine
**File:** `src/engines/routineLearningEngine.ts`

Observes scene signatures over time and learns the user's patterns. Pre-seeded with: Road crossing, Indoor navigation, Pavement walk, Entrance approach. Learns new patterns automatically from repeated detection combinations. Frequency-weighted — more often seen = stronger match.

### UserState (inference, no separate class)
Inferred from scene + alerts by `CognitiveGuardianEngine.inferUserState()`. Phase 2 will wire this to accelerometer, GPS, and barometric data.

States: `walking | standing | crossing_road | waiting | emergency | unknown`

---

## Rules (Hard-coded, Non-negotiable)

| Rule | Implementation |
|---|---|
| Do not narrate everything | SilenceDecisionEngine cooldowns + no_change detection |
| Speak only when useful | GuardianAction `silent` is valid and default |
| Safety alerts interrupt everything | `interrupt: true` on critical/warn actions |
| Low-confidence alerts must say "I'm not sure. Please check carefully." | Appended in CognitiveGuardianEngine when scene.confidence < 0.6 |
| Companion messages must never distract during risky movement | CompanionContextEngine isRisky check + Guardian suppression |
| Act like a careful human guide, not an object-labeling tool | No raw label lists. All output is human-readable guidance. |

---

## V2 Phase Plan

### Phase 2A — Cognitive Core (Current)
- [x] CognitiveGuardianEngine architecture
- [x] SilenceDecisionEngine
- [x] PredictiveRiskEngine
- [x] ProactiveAlertEngine
- [x] CompanionContextEngine
- [x] RoutineLearningEngine
- [x] V2 demo UI (`/v2-demo`)
- [x] 35+ engine unit tests

### Phase 2B — Real Vision Integration
- [ ] Replace MockVisionProvider with real camera stream
- [ ] OpenAIVisionProvider active (GPT-4o vision)
- [ ] On-device ONNX/TensorFlow.js model for local hazard detection
- [ ] 60fps frame analysis with frame-drop tolerance
- [ ] CognitiveGuardian wired to real camera loop

### Phase 2C — Sensor Fusion
- [ ] GPS integration → crossing_road detection from location + speed
- [ ] Accelerometer → walking/standing/running state
- [ ] Barometer → floor detection (indoor multi-storey)
- [ ] Audio fingerprinting → traffic noise detection
- [ ] UserState fully sensor-driven, not scene-inferred

### Phase 2D — Learning & Personalisation
- [ ] Persistent RoutineLearning (Prisma + user profiles)
- [ ] Per-user silence threshold calibration
- [ ] Time-of-day aware companion tone
- [ ] Weekly routine recognition ("Thursday afternoon — usually café visit")
- [ ] Risk pattern learning ("this junction is always busy")

### Phase 2E — Emergency Guardian
- [ ] SOS trigger (gesture or voice command)
- [ ] Emergency streaming (requires consent + legal review per jurisdiction)
- [ ] Trusted contact notification
- [ ] 999/911 voice bridge (Phase 4)

---

## What V2 Does NOT Change

- All V1 engines remain stable and untouched
- All V1 API routes remain functional
- All V1 pages remain functional
- Face recognition remains disabled (FACE_RECOGNITION_ENABLED=false)
- Emergency streaming remains disabled (EMERGENCY_STREAMING_ENABLED=false)
- No medical certification claims
- All safety alerts include confidence scores

---

## Testing

```bash
# V1 tests (19 tests)
npm test

# V2 tests (35 tests)
npx tsx tests/cognitiveGuardian.test.ts

# Type check
npm run type-check

# Build
npm run build
```

---

## Safety Note

The Cognitive Guardian is an assistive tool. No version of this system makes safety decisions on behalf of the user. It informs, alerts, and guides — it does not command. The user always retains full agency. All outputs include the standard disclaimer:

> "This system provides assistive support only. It cannot guarantee your safety. Always use your own judgement."

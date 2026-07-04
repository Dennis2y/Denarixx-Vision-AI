# V2 Cognitive Guardian — Roadmap

Denarixx Vision AI V2 introduces the **Cognitive Guardian** layer — a set of meta-engines that sit above the Phase 1 hazard/safety pipeline. Rather than just detecting hazards and alerting on them, the Cognitive Guardian reasons about *when*, *whether*, and *how urgently* to alert the user, and begins building a model of the user's routine.

---

## V2 Engine Suite

| Engine | Purpose |
|---|---|
| `CognitiveGuardianEngine` | Orchestrates all V2 engines; produces a single `GuardianDecision` per frame |
| `ProactiveAlertEngine` | Generates alerts *before* hazards become critical, based on trajectory signals |
| `SilenceDecisionEngine` | Prevents alert fatigue by silencing lower-priority alerts when rate is too high |
| `PredictiveRiskEngine` | Tracks recent detection history and predicts near-future risk level |
| `CompanionContextEngine` | Maintains real-time context about user activity, session duration, and alert history |
| `RoutineLearningEngine` | Records observed labels by time-of-day phase and learns the user's routines |

---

## GuardianDecision Schema

Every call to `CognitiveGuardianEngine.process()` returns:

```ts
interface GuardianDecision {
  shouldAlert: boolean;         // final decision — alert the user?
  shouldSilence: boolean;       // silence engine activated?
  proactiveAlerts: ProactiveAlert[]; // early-warning alerts
  riskPrediction: RiskPrediction;    // predicted near-future risk
  userContext: UserContext;          // current user activity snapshot
  message: string | null;           // alert text (null if silenced)
  confidence: number;               // base decision confidence
  reasoning: string;                // human-readable debug summary
}
```

---

## Alert Fatigue Prevention

The `SilenceDecisionEngine` tracks how many alerts have fired in the last 60 seconds. When the rate exceeds `maxAlertsPerMinute` (default: 3), lower-priority alerts are silenced until the window clears.

**Critical-severity alerts always bypass the silence filter.** Safety of the user is never compromised by fatigue suppression.

Fatigue levels: `none` → `low` → `medium` → `high`

---

## Proactive Alerting

The `ProactiveAlertEngine` fires alerts *before* a hazard reaches the user, based on detection confidence and a per-label anticipation window (seconds). This gives the user time to slow down, stop, or re-route.

Example thresholds:
- Vehicle: 3 s early warning at ≥ 40% confidence
- Step / Stairs: 4 s early warning at ≥ 40% confidence
- Person: 6 s early warning at ≥ 40% confidence

---

## Predictive Risk

The `PredictiveRiskEngine` maintains a rolling 10-second detection window. It aggregates hazard labels, computes a weighted confidence score, and outputs a `RiskLevel` (`none` / `low` / `medium` / `high` / `critical`).

A single high-confidence vehicle triggers `high`; two or more vehicle detections within the window escalate to `critical`.

---

## Routine Learning

The `RoutineLearningEngine` observes detected labels over time, keyed by time-of-day phase (`morning`, `afternoon`, `evening`, `night`). Repeated observations increment a `frequency` counter. Routines with `frequency ≥ 2` are considered "known" and could be used in Phase 3 to proactively prime the hazard pipeline before arriving at a familiar location.

---

## Phase 3 Integration Targets

1. **Adaptive alert thresholds** — lower confidence threshold near known hazardous locations
2. **Routine-based priming** — pre-load scene context when user approaches a familiar route
3. **Companion mode** — reduced verbosity when user is calm and scene is stable
4. **Persistent routine storage** — move `RoutineLearningEngine` state to database (Phase 1 resets on restart)
5. **WebSocket push** — stream `GuardianDecision` to client in real time (replace polling)

---

## V2 Test Coverage

| Suite | Count |
|---|---|
| V1 Core Engines | 19 / 19 |
| V2 Cognitive Guardian | 27 / 27 |
| **Total** | **46 / 46** |

Run V2 tests:

```bash
npx tsx tests/cognitiveGuardian.test.ts
```

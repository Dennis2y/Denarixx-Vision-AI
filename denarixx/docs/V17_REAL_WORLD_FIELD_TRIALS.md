# V17 — Real-World Field Trial & Safety Validation System

## Overview

Phase 17 creates the complete software infrastructure for conducting controlled real-world field trials with blind and low-vision users in Germany. It covers session lifecycle, consent, safety metrics, user feedback collection, incident reporting, supervisor notes, and privacy-compliant report generation.

> **Simulated mode.** Alerts and metrics are simulated in the UI. No real camera or sensor data flows through this phase — use V12 (camera), V13 (navigation), V15 (on-device AI) for those.

---

## Files Added

| File | Purpose |
|---|---|
| `src/types/fieldTrial.ts` | All V17 types + `TRIAL_PRIVACY` constants + `TRIAL_SCENARIO_REGISTRY` (9 scenarios) |
| `src/engines/fieldTrialEngine.ts` | Session lifecycle, consent validation, alert/silence/incident/note recording, delete |
| `src/engines/safetyValidationEngine.ts` | 8 safety metrics computation, score conversion, isSafeToPublish, validateSafetyRules |
| `src/engines/userFeedbackEngine.ts` | 8-question bank, feedback factory, validation, summary, guidance |
| `src/engines/trialReportEngine.ts` | Report generation, recommendations, JSON export, delete, formatting |
| `src/lib/fieldTrialStore.ts` | In-memory session + report stores (resets on hot-reload) |
| `src/app/field-trials/page.tsx` | 4-phase UI: Consent → Scenario → Active → Report |
| `src/app/api/field-trials/session/route.ts` | POST/GET/PATCH/DELETE session |
| `src/app/api/field-trials/feedback/route.ts` | POST/GET alert feedback |
| `src/app/api/field-trials/report/route.ts` | POST/GET/DELETE trial report |
| `tests/fieldTrial.test.ts` | Comprehensive engine tests |
| `docs/V17_REAL_WORLD_FIELD_TRIALS.md` | This file |
| `docs/FIELD_TRIAL_SAFETY_PROTOCOL.md` | Safety protocol for supervisors |

---

## Architecture

```
fieldTrialEngine        ← session lifecycle, consent, data recording
        │
        ├── safetyValidationEngine   ← 8 safety metrics, publish gate
        ├── userFeedbackEngine       ← 8-question bank, summary, guidance
        └── trialReportEngine        ← report generation, export, delete

API Routes:
  POST/GET/PATCH/DELETE  /api/field-trials/session
  POST/GET               /api/field-trials/feedback
  POST/GET/DELETE        /api/field-trials/report
```

All engines are **pure functions** — no async, no I/O, fully testable.

---

## Trial Phases (UI)

| Phase | Actions |
|---|---|
| **Consent** | Show disclaimers, 5 required checkboxes, anonymized participant ID |
| **Setup** | Pick one of 9 scenarios with risk level and safety notes |
| **Active** | Simulate alerts, mark feedback, log supervisor notes, log incidents, Emergency Stop |
| **Report** | Safety metrics, recommendations, privacy guarantees, Export JSON, Delete all |

---

## Consent Requirements (all required)

1. Participant consent given
2. Human supervisor physically present
3. "Assistive support only — not certainty" accepted
4. No video storage confirmed
5. No face recognition confirmed
6. Anonymized participant ID (e.g. `P001`) — no real names

---

## 9 Trial Scenarios

| Scenario | Risk | Type |
|---|---|---|
| Indoor Hallway | Low | Indoor |
| Doorway Passage | Low | Indoor |
| Obstacle Path | Medium | Indoor |
| Supermarket Aisle | Medium | Indoor |
| Outdoor Pavement | Medium | Outdoor |
| Public Transport (Simulation) | Medium | Both |
| Crowded Area (Simulation) | Medium | Indoor |
| Road Crossing (Simulation) | High | Both |
| Stair Navigation | High | Indoor |

**High-risk scenarios require 2 supervisors and are simulation-only in Phase 17.**

---

## 8 Feedback Questions

1. Was this alert useful? (`AlertUsefulness`)
2. Was the alert too late? (`TimingRating`)
3. Was the alert too frequent? (`FrequencyRating`)
4. Was the wording clear? (`ClarityRating`)
5. Did you feel overwhelmed? (boolean)
6. Did you feel safer? (boolean)
7. What should the AI say differently? (text, optional)
8. Did the supervisor observe a missed hazard? (boolean)

---

## 8 Safety Validation Metrics

| Metric | Range | Notes |
|---|---|---|
| Alert Usefulness | 0-100 | From feedback |
| Missed Hazard Score | 0-100 | Supervisor observations (placeholder) |
| False Alert Score | 0-100 | "not_useful" + "harmful" feedback (placeholder) |
| Average Reaction Time | ms | From alert responseTimeMs |
| User Confidence | 0-100 | Safer/overwhelmed ratio |
| Supervisor Safety | 0-100 | Penalised by incidents |
| Guidance Clarity | 0-100 | Clarity rating average |
| Alert Fatigue | 0-100 | Higher = more fatigue |

**`isSafeToPublish()` requires:** usefulness ≥ 50, clarity ≥ 50, supervisor safety ≥ 70, false alerts < 30.

---

## Privacy Design

| Rule | Value |
|---|---|
| No video storage | ✅ Enforced |
| No face recognition | ✅ Enforced (V8/V9/V14 SAFETY_RULES) |
| No emergency livestreaming | ✅ Enforced |
| No biometric storage | ✅ No such collection |
| Consent required | ✅ createTrialSession throws without it |
| Supervisor required | ✅ Consent validation |
| Location storage disabled | ✅ Default off |
| Full data deletion | ✅ deleteSessionData() + deleteReport() |

---

## API Summary

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/field-trials/session` | POST, GET, PATCH, DELETE | Session lifecycle |
| `/api/field-trials/feedback` | POST, GET | Alert feedback per session |
| `/api/field-trials/report` | POST, GET, DELETE | Trial report generation and deletion |

PATCH actions: `start`, `end`, `emergency_stop`, `record_alert`, `record_silence`, `add_incident`, `add_note`.

---

## What Is Simulated vs Real

| Feature | V17 Status |
|---|---|
| Session lifecycle + consent | ✅ Real logic |
| Safety metrics computation | ✅ Real logic |
| Feedback collection + summary | ✅ Real logic |
| Report generation + export | ✅ Real logic |
| Privacy enforcement | ✅ Real logic |
| Actual hazard detection | ⬜ Simulated (wire V12 camera pipeline) |
| Real-time GPS tracking | ⬜ Not wired (V7/V13 available) |
| Real participant database | ⬜ In-memory only |
| Supervisor mobile app | ⬜ Not built |
| Offline mode for field use | ⬜ V15 offline path available |

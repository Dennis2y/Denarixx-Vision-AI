# V11 — Real-World Pilot Testing System

## Overview

Phase 11 introduces a safe, supervised, consent-based pilot testing system for Denarixx Vision AI. It allows researchers and testers to run structured assistive-technology trials with blind and low-vision users in controlled environments.

> **This system is NOT a medically certified product. It is assistive support only. All testing must be supervised, consent-based, and conducted in a safe, pre-checked environment.**

---

## Architecture

### New Files

| File | Purpose |
|---|---|
| `src/types/pilot.ts` | All V11 types: `PilotScenario`, `TesterConsent`, `AlertFeedback`, `PilotSession`, `PilotReport`, `FeedbackSummary`, `ScenarioInfo`, `PILOT_PRIVACY` |
| `src/engines/pilotTestingEngine.ts` | Pure engine — no async, no I/O. All logic for consent validation, session lifecycle, feedback, reporting, and data deletion. |
| `src/lib/pilotStore.ts` | In-memory store for pilot sessions (resets on server restart). No data is persisted to disk. |
| `src/app/pilot/page.tsx` | 4-phase UI: Consent → Scenario → Active → Report |
| `src/app/api/pilot/session/route.ts` | `POST` start, `GET` retrieve, `PATCH` end/report, `DELETE` data deletion |
| `src/app/api/pilot/feedback/route.ts` | `POST` add feedback, `GET` retrieve feedback |
| `tests/pilotTesting.test.ts` | Engine unit tests |
| `docs/V11_REAL_WORLD_PILOT_TESTING.md` | This file |

---

## Privacy Guarantees (`PILOT_PRIVACY`)

```
noVideoStorage:       true  — no video frames are saved at any point
noFaceRecognition:    true  — face identification is never attempted
noEmergencyStreaming: true  — no audio or video is streamed externally
consentRequired:      true  — no test may begin without verified consent
```

These constraints are enforced in the engine and displayed on the Report screen.

---

## Consent Requirements

Before any session begins, **all three** of the following must be confirmed:

1. **Safety disclaimer acknowledged** — participant has read and understood the disclaimer
2. **Supervisor present** — a trained human supervisor is physically present
3. **Participant consent given** — explicit informed consent from the participant

The `validateConsent()` function enforces this. `createPilotSession()` throws if consent is invalid.

---

## Test Scenarios

| Scenario | Difficulty | Est. Duration |
|---|---|---|
| Indoor Room Navigation | Low | 5 min |
| Hallway Walking | Low | 5 min |
| Stairs Detection | High | 8 min |
| Obstacle Avoidance | Medium | 10 min |
| Crossing Simulation | High | 10 min |
| Supermarket Simulation | Medium | 15 min |
| Crowded Area Simulation | High | 12 min |

Each scenario includes safety notes specific to that environment.

---

## Feedback Collection

After each session, tester can respond to:

| Question | Type |
|---|---|
| Was this alert useful? | Yes / No |
| Did it arrive too late? | Yes / No |
| Was it annoying? | Yes / No |
| Did it help you feel safe? | Yes / No |
| Was the wording clear? | Yes / No |
| What should the AI say differently? | Free text |

All questions are optional. Null answers are excluded from percentage calculations.

---

## Pilot Session Report

Each session generates a `PilotReport` with:

- **Session ID, scenario, duration**
- **Alerts triggered** — count of AI alerts fired
- **Silence decisions** — count of times AI suppressed an alert
- **Predicted risks** — list of risks flagged by the AI pipeline
- **Average confidence** — mean confidence level across all alerts (0.0–1.0)
- **Feedback summary** — percentage breakdowns across all feedback questions
- **Suggested wording** — free-text suggestions from the participant
- **Known detection limits** — pre-populated list of known AI failure modes (reflective surfaces, transparent obstacles, low-contrast edges)
- **Privacy guarantees** — embedded in every report

---

## Emergency Stop

A large red **EMERGENCY STOP** button is always visible during the Active phase. Pressing it immediately:

1. Cancels the current session without saving a report
2. Returns to the Consent screen
3. Resets all session state

The button is 72px tall minimum for large-touch-target accessibility.

---

## Data Deletion

The participant or supervisor may delete all session data at any time from the Report screen. `deletePilotData()`:

- Clears all feedback items
- Clears all predicted risks
- Clears all confidence levels
- Resets alert/silence counts to 0
- Redacts `testerId` to `[deleted]`
- Sets `deleted: true` (prevents further report generation or data access)

The API returns HTTP 410 (Gone) for any subsequent requests on a deleted session.

---

## API Routes

### `POST /api/pilot/session`
Start a new pilot session.
```json
{ "scenario": "indoor_room", "consent": { ... } }
→ { "ok": true, "data": { "sessionId": "...", "startedAt": "..." } }
```

### `GET /api/pilot/session?id=<sessionId>`
Retrieve session data.

### `PATCH /api/pilot/session`
End a session or generate a report.
```json
{ "sessionId": "...", "action": "end" | "report" }
```

### `DELETE /api/pilot/session?id=<sessionId>`
Permanently delete all session data.

### `POST /api/pilot/feedback`
Submit feedback for a session.
```json
{ "sessionId": "...", "feedback": { ... } }
→ { "ok": true, "data": { "feedbackCount": 1 } }
```

### `GET /api/pilot/feedback?id=<sessionId>`
Retrieve all feedback items for a session.

---

## Test Results

`npx tsx tests/pilotTesting.test.ts` — all tests must pass before any release.

---

## Safety Rules for Researchers

1. **Never test in real traffic.** Crossing simulation must be car-free (cones/markings only).
2. **Stairs testing** — supervisor must maintain physical contact at all times.
3. **Crowded area** — use briefed volunteers only, never real crowds.
4. **Supervisor must have clear line of sight** to participant during all sessions.
5. **Participant may stop at any moment.** No pressure to continue.
6. **High-difficulty scenarios** (stairs, crossing, crowds) require additional safety checks before starting.
7. **No results should be used to make medical or safety-critical decisions.**

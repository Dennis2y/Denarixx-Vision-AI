# Denarixx Vision AI — Phase 1 MVP

An AI perception platform for blind and visually impaired users. Provides continuous scene understanding, hazard detection, audio guidance, and contextual memory — with a V2 Cognitive Guardian layer for proactive, fatigue-aware alerting.

**This is the Phase 1 simulation MVP.** All vision analysis is currently simulated. Real camera input and trained models are planned for subsequent phases.

> Assistive support only. Not medically certified. Always use your own judgement.

---

## How to Run Locally

```bash
cp .env.example .env.local
npm install --ignore-scripts
npm run dev
```

Open http://localhost:3000. No API keys needed — runs in simulation mode by default.

---

## How to Run on Replit

1. Import this repository (Node.js template)
2. In Replit Secrets: `SESSION_SECRET=<random string>`
3. Shell: `npm install --ignore-scripts && npm run dev`
4. No external services required.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SESSION_SECRET` | — | Session signing secret |
| `VISION_PROVIDER` | `simulation` | `simulation` only in Phase 1 |
| `DATABASE_URL` | — | PostgreSQL connection string (optional in Phase 1) |

---

## Tests

```bash
# V1 core engine tests (19 tests)
npm test

# V2 Cognitive Guardian tests (27 tests)
npx tsx tests/cognitiveGuardian.test.ts
```

| Suite | Result |
|---|---|
| V1 Core Engines | 24 / 24 passed |
| V2 Cognitive Guardian | 27 / 27 passed |
| **Total** | **46 / 46 passed** |

---

## What is Working

| Feature | Status |
|---|---|
| All 10 pages | Working |
| All 13 API routes | Working |
| V1 engine tests | 24 / 24 passing |
| V2 Cognitive Guardian tests | 27 / 27 passing |
| Audio guidance (Web Speech API) | Working |
| Priority-queued speech output | Working |
| Hazard confidence scoring | Working |
| Uncertainty messages on low confidence | Working |
| Safety Decision Engine | Working |
| Memory Engine (in-process) | Working |
| Conversation Engine | Working |
| V2 Cognitive Guardian Engine | Working |
| V2 Proactive Alert Engine | Working |
| V2 Silence Decision Engine | Working |
| V2 Predictive Risk Engine | Working |
| V2 Companion Context Engine | Working |
| V2 Routine Learning Engine | Working |
| TypeScript — zero errors | Clean |
| Next.js build | Clean |

---

## Pages

| Path | Description |
|---|---|
| `/` | Investor-grade landing page with 7-step demo flow |
| `/session` | Interactive 7-step guided vision session with live tracker |
| `/guardian` | V2 Cognitive Guardian pipeline debugger |
| `/hazards` | Standalone hazard detection tester |
| `/memory` | AI memory store with seed data and stats |
| `/navigation` | Navigation guidance stub |
| `/settings` | Settings page |
| `/privacy` | Privacy policy |
| `/admin` | Admin panel |
| `/docs` | Developer documentation |
| `/api/*` | 13 JSON API routes (see below) |

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/sessions/start` | POST | Start a vision session |
| `/api/sessions/end` | POST | End a session and return metrics |
| `/api/vision/analyze-frame` | POST | Analyse a simulated vision frame |
| `/api/hazards/evaluate` | POST | Run hazard detection on detections |
| `/api/safety/decide` | POST | Run safety decision on hazard alerts |
| `/api/scene/describe` | POST | Generate a scene description |
| `/api/conversation/ask` | POST | Ask a natural-language question |
| `/api/audio/speak` | POST | Request audio guidance text |
| `/api/memory` | GET | Retrieve all memory items |
| `/api/memory` | POST | Save a memory item |
| `/api/memory/save` | POST | Save a memory item (alias) |
| `/api/navigation` | GET | Navigation guidance stub |

---

## Architecture

```
Camera Input → Vision Engine → Hazard Detection Engine → Safety Decision Engine
                             → Scene Reasoning Engine
                             → Memory Engine
                             → Conversation Engine → Audio Guidance Engine

                 ┌─────────────────────────────────────────┐
                 │         V2 Cognitive Guardian            │
                 │  ProactiveAlertEngine                    │
                 │  SilenceDecisionEngine                   │
                 │  PredictiveRiskEngine                    │
                 │  CompanionContextEngine                  │
                 │  RoutineLearningEngine                   │
                 └─────────────────────────────────────────┘
```

Each engine implements a clean TypeScript interface. Swap any engine by implementing the interface — no other code changes required.

---

## What is Simulated

- Camera frame analysis (MockVisionProvider cycles preset detections)
- Scene descriptions (template-based)
- Hazard detections (rule-based on simulated labels)
- Confidence scores (real numbers, simulation-sourced)
- Navigation guidance (stub, no GPS)
- Memory recall (resets on server restart)

---

## What Must Be Built Next (Phase 2 / 3)

1. Real vision model (OpenAIVisionProvider or local ONNX/TensorFlow.js)
2. Persistent database (wire Drizzle/Prisma to API routes)
3. GPS navigation (browser Geolocation + routing service)
4. WebSocket push (replace client polling)
5. Authentication (Replit Auth or Clerk)
6. LLM conversation engine (replace rule-based stubs)
7. Persistent routine learning (move RoutineLearningEngine to database)

---

## Known Risks

| Risk | Notes |
|---|---|
| No real-world validation | Must test with real blind/low-vision users before any safety-critical use |
| In-memory session store | Resets on server restart — Phase 1 limitation |
| No authentication | Single demo-user mode only |
| Web Speech API | Best support in Chrome/Edge |
| Face recognition | Intentionally disabled — requires GDPR DPIA + BIPA consent flow |
| Emergency streaming | Intentionally disabled — requires jurisdiction-specific legal review |

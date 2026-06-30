# Denarixx Vision AI — Phase 1 MVP

An AI perception platform for blind and visually impaired users. Provides continuous scene understanding, hazard detection, audio guidance, and contextual memory.

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
2. In Replit Secrets: `DATABASE_URL=file:./dev.db`, `VISION_PROVIDER=simulation`
3. Shell: `npm install --ignore-scripts && npm run dev`
4. No external services required.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite (local) or PostgreSQL (production) |
| `VISION_PROVIDER` | `simulation` | `simulation` or `openai` |
| `OPENAI_API_KEY` | — | Required only if `VISION_PROVIDER=openai` |
| `FACE_RECOGNITION_ENABLED` | `false` | Keep false in Phase 1 |
| `EMERGENCY_STREAMING_ENABLED` | `false` | Keep false in Phase 1 |

---

## Tests

```bash
npm test
# 19 engine unit tests, no database or API key required
```

---

## Database (optional in Phase 1)

Engines use in-memory stores by default. To enable persistence:

```bash
npm run db:generate   # generates Prisma client
npm run db:push       # pushes schema to SQLite
npm run db:seed       # seeds demo data
```

---

## Docker

```bash
docker-compose up     # runs on http://localhost:3000
```

---

## What is Working

| Feature | Status |
|---|---|
| All 10 pages | Working |
| All 12 API routes | Working |
| Audio guidance (Web Speech API) | Working |
| Priority-queued speech output | Working |
| Hazard confidence scoring | Working |
| Uncertainty messages on low confidence | Working |
| Safety Decision Engine | Working |
| Memory Engine (in-process) | Working |
| Conversation Engine | Working |
| 19 engine unit tests | All passing |
| TypeScript — zero errors | Clean |
| Next.js build | Clean |

## What is Simulated

- Camera frame analysis (MockVisionProvider cycles preset detections)
- Scene descriptions (template-based)
- Hazard detections (rule-based on simulated labels)
- Confidence scores (real numbers, simulation-sourced)
- Navigation guidance (stub, no GPS)
- Memory recall (resets on server restart)

## What Must Be Built Next (Phase 2)

1. Real vision model (OpenAIVisionProvider or local ONNX/TensorFlow.js)
2. Persistent database (wire Prisma to API routes)
3. GPS navigation (browser Geolocation + routing service)
4. WebSocket push (replace client polling)
5. Authentication (NextAuth or similar)
6. LLM conversation engine (replace rule-based stubs)

## Known Risks

| Risk | Notes |
|---|---|
| No real-world validation | Must test with real blind/low-vision users before any safety-critical use |
| Prisma client not generated | Engine binaries need network download; app runs fine in simulation mode without it |
| No authentication | Single demo-user mode only |
| Web Speech API | Best support in Chrome/Edge |
| Face recognition | Intentionally disabled — requires GDPR DPIA + BIPA consent flow |
| Emergency streaming | Intentionally disabled — requires jurisdiction-specific legal review |

## Engine Pipeline

```
Camera Input → Vision Engine → Hazard Detection Engine → Safety Decision Engine
                             → Scene Reasoning Engine
                             → Memory Engine
                             → Conversation Engine → Audio Guidance Engine
```

Each engine implements a clean TypeScript interface. Swap any engine by implementing the interface — no other code changes required.

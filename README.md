# Denarixx Vision AI — Phases 1–18

An assistive AI perception platform for blind and visually impaired users. Provides real-time hazard awareness, scene understanding, spatial intelligence, and audio guidance via a simulation MVP.

> Assistive support only. Not medically certified. Always use your own judgement.

---

## Project Scale

| Item | Count |
|---|---|
| Pages | 17 |
| API routes | 26 |
| Engine files | 77 |
| Test files | 17 |
| Total tests | 1,777 |
| Phases implemented | 1–18 |

All phases are implemented as simulation, planning, and architecture layers. No real camera models or external AI providers are required to run the application.

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
| `VISION_PROVIDER` | `simulation` | `simulation` \| `openai` \| `gemini` \| `local` |
| `DATABASE_URL` | — | PostgreSQL connection string (optional) |

---

## Test Suites

```bash
npm test                                          # V1  — 24 tests
npx tsx tests/cognitiveGuardian.test.ts           # V2  — 37 tests
npx tsx tests/v3reasoning.test.ts                 # V3  — 27 tests
npx tsx tests/voiceCompanion.test.ts              # V5  — 72 tests
npx tsx tests/spatial.test.ts                     # V6  — 86 tests
npx tsx tests/sensorFusion.test.ts                # V7  — 69 tests
npx tsx tests/hardwareBridge.test.ts              # V8  — 97 tests
npx tsx tests/humanBehaviour.test.ts              # V9  — 134 tests
npx tsx tests/mobileReadiness.test.ts             # V10 — 47 tests
npx tsx tests/pilotTesting.test.ts                # V11 — 117 tests
npx tsx tests/visionPipeline.test.ts              # V12 — 148 tests
npx tsx tests/navigationEngine.test.ts            # V13 — 151 tests
npx tsx tests/multiCameraSupport.test.ts          # V14 — 164 tests
npx tsx tests/onDeviceAI.test.ts                  # V15 — 170 tests
npx tsx tests/denarixxGlassesPrototype.test.ts    # V16 — 176 tests
npx tsx tests/fieldTrial.test.ts                  # V17 — 161 tests
npx tsx tests/manufacturingReadiness.test.ts      # V18 — 144 tests
```

**Total: 1,777 / 1,777 passing. TypeScript: zero errors.**

---

## Pages (17)

| Path | Phase | Description |
|---|---|---|
| `/` | V1 | Landing page with 7-step demo flow |
| `/session` | V1 | Live vision session with guided walkthrough |
| `/guardian` | V2 | Cognitive Guardian pipeline debugger |
| `/reasoning` | V3 | Cognitive Reasoning Engine explorer |
| `/hazards` | V1 | Standalone hazard detection tester |
| `/memory` | V1 | AI memory store with seed data |
| `/navigation` | V13 | Indoor & outdoor navigation engine |
| `/vision` | V12 | Real-time AI vision pipeline viewer |
| `/devices` | V8/V14 | Smart glasses & wearable device manager |
| `/performance` | V15 | On-device AI latency & battery dashboard |
| `/pilot` | V11 | Supervised pilot testing system |
| `/field-trials` | V17 | Real-world field trial manager |
| `/manufacturing` | V18 | Manufacturing readiness dashboard |
| `/settings` | V10 | Accessibility & PWA settings |
| `/privacy` | V1 | Privacy policy |
| `/admin` | V1 | Admin panel |
| `/docs` | V1 | Developer documentation |

---

## API Routes (26)

| Route | Method | Phase | Description |
|---|---|---|---|
| `/api/health` | GET | V1 | Health check |
| `/api/sessions` | GET | V1 | List sessions |
| `/api/sessions/start` | POST | V1 | Start a vision session |
| `/api/sessions/end` | POST | V1 | End session and return metrics |
| `/api/vision/analyze-frame` | POST | V1 | Analyse a simulated vision frame |
| `/api/hazards/evaluate` | POST | V1 | Run hazard detection |
| `/api/safety/decide` | POST | V1 | Run safety decision engine |
| `/api/scene/describe` | POST | V1 | Generate scene description |
| `/api/conversation/ask` | POST | V1 | Natural-language Q&A |
| `/api/audio/speak` | POST | V1 | Request audio guidance text |
| `/api/memory` | GET/POST | V1 | Retrieve / save memory items |
| `/api/memory/save` | POST | V1 | Save memory item (alias) |
| `/api/navigation` | GET | V1 | Navigation guidance stub |
| `/api/navigation/start` | POST | V13 | Start navigation session |
| `/api/navigation/update` | POST | V13 | Update heading and detections |
| `/api/navigation/end` | POST | V13 | End navigation session |
| `/api/navigation/landmark` | POST | V13 | Add landmark |
| `/api/navigation/crossing-decision` | POST | V13 | Evaluate pedestrian crossing |
| `/api/pilot/session` | POST/GET/PATCH/DELETE | V11 | Pilot test session CRUD |
| `/api/pilot/feedback` | POST/GET | V11 | Pilot feedback |
| `/api/field-trials/session` | POST/GET/PATCH/DELETE | V17 | Field trial session CRUD |
| `/api/field-trials/feedback` | POST/GET | V17 | Field trial feedback |
| `/api/field-trials/report` | POST/GET/DELETE | V17 | Trial report management |
| `/api/manufacturing/readiness` | GET | V18 | Full manufacturing report |
| `/api/manufacturing/risk` | GET | V18 | Product risk assessment |
| `/api/manufacturing/certification` | GET | V18 | Certification roadmap |

---

## Engine Files (77)

All engines are pure TypeScript — no async I/O, fully testable in isolation.

| Phase | Engines |
|---|---|
| V1 | VisionEngine, HazardDetectionEngine, SafetyDecisionEngine, SceneReasoningEngine, MemoryEngine, ConversationEngine, NavigationEngine |
| V2 | cognitiveGuardianEngine, proactiveAlertEngine, silenceDecisionEngine, predictiveRiskEngine, companionContextEngine, routineLearningEngine, alertThrottleEngine |
| V3 | environmentUnderstandingEngine, cognitiveReasoningEngine, riskPredictionEngine, actionDecisionEngine, humanGuideEngine |
| V4 | visionProviderFactory, providers/SimulationVisionProvider, providers/OpenAIVisionProvider, providers/GeminiVisionProvider, providers/LocalVisionProvider, providers/MockVisionProvider |
| V5 | voiceCommandEngine, guidancePersonalityEngine |
| V6 | spatialReasoningEngine, pathPlanningEngine, mobilityEngine, worldModelEngine |
| V7 | sensorFusionEngine, locationPrivacyEngine |
| V8 | wearableConnectionEngine, deviceCapabilityEngine, hardwareBridgeEngine |
| V9 | humanBehaviourEngine, crowdUnderstandingEngine, interactionPredictionEngine, socialAwarenessEngine |
| V10 | (PWA lib — pwa.ts) |
| V11 | pilotTestingEngine |
| V12 | visionInferenceEngine, depthReasoningEngine, objectTrackingEngine, sceneUnderstandingEngine, cameraPipelineEngine, modelManagerEngine |
| V13 | navigationIntelligenceEngine, indoorNavigationEngine, outdoorNavigationEngine, routeSafetyEngine, landmarkGuidanceEngine, crossingDecisionEngine |
| V14 | glassesCameraEngine, cameraHealthEngine, fieldOfViewEngine, multiCameraFusionEngine, wearableSensorFusionEngine |
| V15 | onDeviceAIEngine, modelOptimizationEngine, edgeInferenceEngine, latencyBudgetEngine, batteryOptimizationEngine |
| V16 | denarixxGlassesEngine, hardwarePrototypeEngine, powerManagementEngine, audioWearableEngine, hapticWearableEngine |
| V17 | fieldTrialEngine, safetyValidationEngine, userFeedbackEngine, trialReportEngine |
| V18 | manufacturingReadinessEngine, compliancePlanningEngine, productRiskEngine, certificationRoadmapEngine |

---

## Architecture

```
Camera Input → Vision Engine → Hazard Detection → Safety Decision
                             → Scene Reasoning
                             → Memory Engine
                             → Conversation Engine → Audio Guidance

             ┌──────────────────────────────────────────────┐
             │             V2 Cognitive Guardian             │
             │  ProactiveAlert · Silence · PredictiveRisk   │
             │  CompanionContext · RoutineLearning · Throttle│
             └──────────────────────────────────────────────┘

             ┌──────────────────────────────────────────────┐
             │          V6–V8 Hardware & Sensors            │
             │  Spatial · PathPlanning · SensorFusion       │
             │  WearableConnection · HardwareBridge         │
             └──────────────────────────────────────────────┘

             ┌──────────────────────────────────────────────┐
             │       V12–V15 Vision & On-Device AI          │
             │  VisionInference · ObjectTracking · Depth    │
             │  EdgeInference · LatencyBudget · Battery     │
             └──────────────────────────────────────────────┘
```

---

## What Is Simulated (Phase 1–18)

- Camera frame analysis (SimulationVisionProvider cycles preset detections)
- Scene descriptions (template-based)
- Hazard detections (rule-based on simulated labels)
- GPS coordinates (fuzzy grid snapping for privacy)
- Navigation routes (deterministic indoor/outdoor simulation)
- Multi-camera feeds (simulated latency and battery drain)
- On-device inference (simulated latency grades per runtime)
- Smart glasses connection (simulated heartbeat and subsystem health)
- Field trial and pilot sessions (full in-memory lifecycle)
- Manufacturing readiness (planning-layer scores, not production data)

All simulation behaviour is deterministic and fully tested. Swap any provider by implementing its TypeScript interface.

---

## Known Risks

| Risk | Notes |
|---|---|
| No real-world validation | Must test with real blind/low-vision users before any safety-critical use |
| In-memory session stores | Reset on server restart — no database persistence yet |
| No authentication | Single demo-user mode only |
| Web Speech API | Best support in Chrome/Edge |
| Face recognition | Intentionally disabled — requires GDPR DPIA + BIPA consent flow |
| Emergency streaming | Intentionally disabled — requires jurisdiction-specific legal review |
| Crossing safety | Engine never asserts certainty — always hedged language by design |

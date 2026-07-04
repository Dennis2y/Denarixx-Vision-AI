# Denarixx Vision AI

An assistive AI perception platform for blind and visually impaired users — providing real-time hazard awareness, scene understanding, spatial intelligence, and audio guidance via a simulation MVP.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Express proxy (port 8080, single entry point)
- `cd denarixx && npm run dev` — run Next.js directly (port 3000, dev only)
- `cd denarixx && npm run type-check` — TypeScript check for the Next.js app
- `cd denarixx && npm test` — V1 core engine tests (24/24)
- `cd denarixx && npx tsx tests/cognitiveGuardian.test.ts` — V2 Cognitive Guardian + AlertThrottleEngine tests (37/37)
- `cd denarixx && npx tsx tests/v3reasoning.test.ts` — V3 Cognitive Reasoning Engine tests (27/27)
- `cd denarixx && npx tsx tests/voiceCompanion.test.ts` — V5 Voice Companion tests (72/72)
- `cd denarixx && npx tsx tests/spatial.test.ts` — V6 Spatial Intelligence tests (86/86)
- `cd denarixx && npx tsx tests/sensorFusion.test.ts` — V7 Phone Sensor tests (69/69)
- `cd denarixx && npm run build` — Next.js production build (then delete `.next` and restart workflow)

## Stack

- **Next.js 15** (App Router) — main application in `denarixx/`
- **Express 5** — proxy in `artifacts/api-server/` routes `/api/*` to Express and everything else to Next.js
- **TypeScript 5** — strict, zero errors
- **Tailwind CSS v4** — requires `@source` directive in `globals.css`
- **pnpm workspaces** — monorepo root

## Where things live

- **Next.js app:** `denarixx/` — all 11 pages and 13 API routes
- **Express proxy:** `artifacts/api-server/src/app.ts` — single entry point on port 8080
- **V1 engines:** `denarixx/src/engines/` — VisionEngine, HazardDetectionEngine, SafetyDecisionEngine, SceneReasoningEngine, MemoryEngine, ConversationEngine
- **V2 engines:** `denarixx/src/engines/` — cognitiveGuardianEngine, proactiveAlertEngine, silenceDecisionEngine, predictiveRiskEngine, companionContextEngine, routineLearningEngine
- **V2 types:** `denarixx/src/types/cognitive.ts`
- **V3 engines:** `denarixx/src/engines/` — environmentUnderstandingEngine, cognitiveReasoningEngine, riskPredictionEngine, actionDecisionEngine, humanGuideEngine
- **V3 types:** `denarixx/src/types/reasoning.ts`
- **V4 provider system:** `denarixx/src/engines/visionProviderFactory.ts` — factory reads `VISION_PROVIDER` env var
- **V4 providers:** `denarixx/src/engines/providers/` — SimulationVisionProvider, OpenAIVisionProvider, GeminiVisionProvider, LocalVisionProvider
- **V4 types:** `denarixx/src/types/vision.ts` — VisionAnalysisV4, VisionAnalysisProvider
- **V5 engines:** `denarixx/src/engines/voiceCommandEngine.ts`, `guidancePersonalityEngine.ts`
- **V5 hooks:** `denarixx/src/hooks/useVoiceCommands.ts`, `useLastGuidance.ts`
- **V5 components:** `denarixx/src/components/session/` — OnboardingFlow, VoiceCommandIndicator, LastGuidancePanel
- **V5 settings:** `denarixx/src/lib/settingsStore.ts`
- **V6 engines:** `denarixx/src/engines/` — spatialReasoningEngine, pathPlanningEngine, mobilityEngine, worldModelEngine
- **V6 types:** `denarixx/src/types/spatial.ts` — SpatialObject, WalkingCorridor, PathRecommendation, WorldModelSnapshot, etc.
- **V6 component:** `denarixx/src/components/session/SpatialMapPanel.tsx` — live SVG bird's-eye map
- **V7 types:** `denarixx/src/types/sensors.ts` — GPSReading, CompassReading, MotionReading, SensorContext, VibrationPattern, SensorSettings, SENSOR_DEFAULTS
- **V7 engines:** `denarixx/src/engines/sensorFusionEngine.ts` — motion classification (8-sample sliding window), heading fusion, battery mode; `locationPrivacyEngine.ts` — GPS fuzzing (0.01° grid), storage consent, Haversine distance
- **V7 hook:** `denarixx/src/hooks/useDeviceSensors.ts` — GPS (watchPosition), compass (DeviceOrientation), IMU (DeviceMotion), battery (getBattery), vibration; iOS 13+ permission handling
- **V7 component:** `denarixx/src/components/session/SensorStatusPanel.tsx` — live sensor status, permission buttons, battery bar, motion badge
- **V7 settings:** added `locationEnabled`, `locationPrecision`, `locationMemoryEnabled`, `motionEnabled`, `vibrationEnabled`, `batteryAwareMode` to `AppSettings` in `settingsStore.ts`
- **V1 tests:** `denarixx/tests/engines.test.ts` (24 tests)
- **V2 tests:** `denarixx/tests/cognitiveGuardian.test.ts` (37 tests — includes AlertThrottleEngine suite)
- **V3 tests:** `denarixx/tests/v3reasoning.test.ts` (27 tests)
- **V5 tests:** `denarixx/tests/voiceCompanion.test.ts` (72 tests)
- **V6 tests:** `denarixx/tests/spatial.test.ts` (86 tests)
- **V7 tests:** `denarixx/tests/sensorFusion.test.ts` (69 tests)
- **Camera hook:** `denarixx/src/hooks/useCameraCapture.ts` — getUserMedia, stream lifecycle, frame capture (JPEG base64), 4-state status machine
- **Alert throttle engine:** `denarixx/src/engines/alertThrottleEngine.ts` — per-severity cooldowns, shouldSpeak() decision, confidence-escalation override, speak-count tracking
- **Session hook:** `denarixx/src/hooks/useVisionSession.ts` — 7-step demo flow, camera integration, spatial intelligence, completedSteps tracking, session report generation
- **UI components:** `denarixx/src/components/` — Card, Badge, Button, DemoFlow, SessionReport, HazardPanel, SpatialMapPanel, etc.
- **API routes:** `denarixx/src/app/api/` — 13 routes (health, sessions, sessions/start, sessions/end, vision/analyze-frame, hazards/evaluate, safety/decide, scene/describe, conversation/ask, audio/speak, memory, memory/save, navigation)
- **V2 roadmap:** `denarixx/docs/V2_COGNITIVE_GUARDIAN_ROADMAP.md`
- **V4 docs:** `denarixx/docs/V4_REAL_VISION_PROVIDER.md`
- **V5 docs:** `denarixx/docs/V5_VOICE_COMPANION.md`
- **V6 docs:** `denarixx/docs/V6_SPATIAL_INTELLIGENCE.md`

## Architecture decisions

- **Express proxy pattern:** The api-server artifact (port 8080) is the single entry point. `/api/*` hits Express directly; all other paths proxy to Next.js at port 3000. `x-forwarded-host` is stripped to avoid Next.js host blocking.
- **In-memory session store:** Phase 1 uses a `Map<string, LiveSession>` in `src/lib/sessionStore.ts`. Store resets on server restart or Next.js hot-reload.
- **Simulation mode:** All AI engines return deterministic/random synthetic data. No real camera or model inference in Phase 1.
- **Stale closure pattern:** `useVisionSession` uses refs (`audioCountRef`, `peakUrgencyRef`, `startTimeRef`) for values that must be read at session-stop time, not state.
- **`npm run build` destroys dev cache:** After any prod build, delete `denarixx/.next` and restart "Start application" workflow.
- **Tailwind v4:** requires `@source "../../**/*.{js,ts,jsx,tsx,mdx}"` in `globals.css` — do not remove.
- **devIndicators disabled:** `devIndicators: false` in `next.config.ts` prevents SegmentViewNode crash in Next.js 15.5.
- **Web Speech API types:** Declared inline in `useVoiceCommands.ts` — TypeScript's `lib.dom` does not include Speech Recognition API types; use the file-local `ISpeechRecognition` interface, not the global `SpeechRecognition`.
- **V6 spatial pipeline:** Runs inside `runFrame` after vision analysis, before audio output. Spatial guidance speaks at `low` priority after hazard alerts. Repeated advisory instructions are suppressed.
- **V7 sensor integration:** `useDeviceSensors` is called inside `useVisionSession`. Battery-aware frame skipping via `lastFrameTimeRef` + `recommendedFrameInterval()` (standing 5 s, walking 3 s, running 2 s, low-power 8 s). Vibration triggered after speak() for critical/high/medium alerts. GPS + motion started automatically on session start when enabled in settings. `SensorContext` passed in `SpatialInput.sensorContext?` (optional, backward-compatible).
- **V7 location privacy:** GPS defaults to `fuzzy` (0.01° grid snap ≈ 1 km). Precise location requires two explicit settings: `locationPrecision: 'precise'` AND `locationMemoryEnabled: true`.

## Product

Denarixx Vision AI is a Phase 7 platform for blind and visually impaired users. The Vision Session page supports real browser camera input (getUserMedia) with simulation as automatic fallback. Phase 4 adds a real AI vision provider system (OpenAI GPT-4o) — set `VISION_PROVIDER=openai` and `OPENAI_API_KEY` to enable. Simulation is the default and always the fallback.

**11 pages:**
- **Homepage (`/`)** — Investor-grade landing with 7-step demo flow, AI pipeline diagram, roadmap
- **Vision Session (`/session`)** — Interactive 7-step guided demo with live DemoFlow tracker, SpatialMapPanel, SensorStatusPanel, and SessionReport
- **Cognitive Guardian (`/guardian`)** — V2 pipeline debugger: pick a scenario, run the full AI decision pipeline, see live timings per stage
- **Cognitive Reasoning (`/reasoning`)** — V3 live pipeline debugger: 6-panel view showing environment understanding, internal reasoning, risk prediction, action decision, and human guide message
- **Hazards (`/hazards`)** — Standalone HazardDetectionEngine tester with 4 example scenarios
- **Memory (`/memory`)** — AI memory store with seed demo data, stats bar, add/view items
- **Navigation (`/navigation`)**, **Settings (`/settings`)**, **Privacy (`/privacy`)**, **Admin (`/admin`)**, **Docs (`/docs`)**

**Test status:**
- V1 core engines: **24/24 passing**
- V2 Cognitive Guardian + AlertThrottleEngine: **37/37 passing**
- V3 Cognitive Reasoning Engine: **27/27 passing**
- V5 Voice Companion: **72/72 passing**
- V6 Spatial Intelligence: **86/86 passing**
- V7 Phone Sensor Integration: **69/69 passing**

## User preferences

- Phase 2 camera integration is live on the Vision Session page — simulation remains the fallback.
- Do not wire model inference (real CV models) or database without explicit instruction.
- All V2 engine files must be present in repo (not just passing in Replit) — recreate from working implementation if ever missing.

## Gotchas

- `npm run build` corrupts `.next` dev cache — always `rm -rf denarixx/.next` then restart "Start application" workflow after any prod build.
- In-memory sessionStore resets on Next.js hot-reload — `sessions/end` 404 during parallel page compilation is expected in dev.
- Health check system causes "request aborted" logs every ~500ms during initial Next.js compilation — not a user-facing bug.
- ESLint: `argsIgnorePattern: "^_"` allows `_`-prefixed unused function args.
- Tailwind v4: requires `@source "../../**/*.{js,ts,jsx,tsx,mdx}"` in `globals.css`.
- Next.js 15.5 dev: `devIndicators: false` in `next.config.ts` prevents SegmentViewNode crash.
- Web Speech API: `SpeechRecognition` not in TypeScript DOM lib — use `ISpeechRecognition` from `useVoiceCommands.ts`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- V2 roadmap: `denarixx/docs/V2_COGNITIVE_GUARDIAN_ROADMAP.md`
- V5 docs: `denarixx/docs/V5_VOICE_COMPANION.md`
- V6 docs: `denarixx/docs/V6_SPATIAL_INTELLIGENCE.md`
- V7 docs: `denarixx/docs/V7_PHONE_SENSOR_INTEGRATION.md`

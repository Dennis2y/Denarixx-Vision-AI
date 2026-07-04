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
- `cd denarixx && npx tsx tests/hardwareBridge.test.ts` — V8 Smart Glasses HAL tests (97/97)
- `cd denarixx && npx tsx tests/humanBehaviour.test.ts` — V9 Human Behaviour & Social Intelligence tests (134/134)
- `cd denarixx && npx tsx tests/mobileReadiness.test.ts` — V10 Mobile Deployment Readiness tests (47/47)
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
- **V8 types:** `denarixx/src/types/hardware.ts` — DeviceKind, ConnectedDevice, HardwareIOConfig, CameraSource, AudioOutput, HapticOutput, BrowserCapabilities, HardwareSettings, HARDWARE_DEFAULTS
- **V8 engines:** `denarixx/src/engines/wearableConnectionEngine.ts` — device registry, connect/disconnect lifecycle, heartbeat simulation; `deviceCapabilityEngine.ts` — browser API detection, I/O priority, setup instructions; `hardwareBridgeEngine.ts` — I/O routing, disconnect safety, SAFETY_RULES
- **V8 hook:** `denarixx/src/hooks/useWearableDevice.ts` — device state, connect/disconnect (with simulated delay), heartbeat timer, I/O selectors, disconnect event propagation
- **V8 page:** `denarixx/src/app/devices/page.tsx` — device cards, Active Sources selectors, Browser Capabilities panel, Safety Rules panel
- **V9 types:** `denarixx/src/types/social.ts` — HumanActivity, NearbyPerson, SocialContext, CrowdState, InteractionPrediction, SocialAlert, SocialInput, SocialScenario
- **V9 engines:** `denarixx/src/engines/humanBehaviourEngine.ts` — activity/direction/distance inference; `crowdUnderstandingEngine.ts` — density, queue detection, crowd risk; `interactionPredictionEngine.ts` — collision risk, path crossing, time to approach; `socialAwarenessEngine.ts` — full pipeline, guidance, alerts, 8 scenarios
- **V9 component:** `denarixx/src/components/session/SocialAwarenessPanel.tsx` — live social awareness panel on session page (self-contained simulation, 4 s tick)
- **V10 pwa lib:** `denarixx/src/lib/pwa.ts` — SW registration, install detection, offline/battery/connection utilities, capability check
- **V10 hook:** `denarixx/src/hooks/usePWAInstall.ts` — install prompt state, online/offline tracking
- **V10 component:** `denarixx/src/components/PWASetup.tsx` — client bootstrap: SW registration, high-contrast/reduced-motion class, offline + install banners
- **V10 session:** session page — walking mode overlay, emergency stop, battery warning, offline notice, walking/emergency buttons during active session
- **V10 settings:** settings page — high contrast mode, reduced motion, fullscreen walking mode, PWA install button
- **V10 guardian:** guardian page — `role="group"` on scenario picker, `aria-busy` + `aria-label` on run button
- **V10 sw:** `denarixx/public/sw.js` — cache-first assets, network-first navigation, offline JSON stub for API
- **V10 offline:** `denarixx/public/offline.html` — spoken offline message, auto-reload on reconnect
- **V10 manifest:** `denarixx/public/manifest.json` — display_override, shortcuts to /session + /settings, portrait lock, start_url=/session
- **V10 globals:** high-contrast-mode, reduced-motion CSS classes + @media (prefers-contrast/reduced-motion)
- **V10 docs:** `denarixx/docs/V10_MOBILE_DEPLOYMENT_READINESS.md`, `denarixx/docs/MOBILE_TESTING_CHECKLIST.md`
- **V1 tests:** `denarixx/tests/engines.test.ts` (24 tests)
- **V2 tests:** `denarixx/tests/cognitiveGuardian.test.ts` (37 tests — includes AlertThrottleEngine suite)
- **V3 tests:** `denarixx/tests/v3reasoning.test.ts` (27 tests)
- **V5 tests:** `denarixx/tests/voiceCompanion.test.ts` (72 tests)
- **V6 tests:** `denarixx/tests/spatial.test.ts` (86 tests)
- **V7 tests:** `denarixx/tests/sensorFusion.test.ts` (69 tests)
- **V8 tests:** `denarixx/tests/hardwareBridge.test.ts` (97 tests)
- **V9 tests:** `denarixx/tests/humanBehaviour.test.ts` (134 tests)
- **V10 tests:** `denarixx/tests/mobileReadiness.test.ts` (47 tests)
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
- **V8 hardware abstraction:** Three pure engines (WearableConnectionEngine, DeviceCapabilityEngine, HardwareBridgeEngine). Phone camera is always auto-activated via `ensurePhoneCamera()`. All other devices start disconnected. Camera source priority: denarixx_glasses > wifi_glasses > bluetooth > usb > phone > simulation.
- **V8 safety rules:** SAFETY_RULES constants in hardwareBridgeEngine — noVideoStorage, noFaceRecognition, warnOnVisionDisconnect, phoneCameraFallback all true. Glasses disconnect during session → "Vision device disconnected. Please stop and check carefully."
- **V9 privacy rules:** No person ever identified or named. Emotions never inferred as facts. Only observable behaviour described. Hedging language enforced ("appears to be", "may be"). All four engines are pure — no async, no I/O.
- **V10 PWA:** SW cache name `denarixx-v10`. Bump to `denarixx-v11` on next deploy to purge old caches. start_url = `/session`. `isOffline()` guards `typeof navigator.onLine !== 'boolean'` (Node.js has navigator but no onLine). Walking mode overlay is React-level (not native Fullscreen API) so it works on iOS.
- **V10 settings:** `highContrastMode`, `reducedMotion`, `fullscreenWalkingMode` in AppSettings. Classes applied to `<html>` by PWASetup on mount and by settings page on Save.

## Product

Denarixx Vision AI is a Phase 10 platform for blind and visually impaired users. The Vision Session page supports real browser camera input (getUserMedia) with simulation as automatic fallback. Phase 4 adds a real AI vision provider system (OpenAI GPT-4o) — set `VISION_PROVIDER=openai` and `OPENAI_API_KEY` to enable. Simulation is the default and always the fallback.

**12 pages:**
- **Homepage (`/`)** — Investor-grade landing with 7-step demo flow, AI pipeline diagram, roadmap
- **Vision Session (`/session`)** — Interactive 7-step guided demo with live DemoFlow tracker, SpatialMapPanel, SensorStatusPanel, and SessionReport
- **Devices (`/devices`)** — V8 Smart Glasses Integration Layer: device cards, connect/disconnect, Active Sources selectors, Browser Capabilities, Safety Rules
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
- V8 Smart Glasses HAL: **97/97 passing**
- V9 Human Behaviour & Social Intelligence: **134/134 passing**
- V10 Mobile Deployment Readiness: **47/47 passing**

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
- V8 docs: `denarixx/docs/V8_SMART_GLASSES_INTEGRATION.md`
- V9 docs: `denarixx/docs/V9_HUMAN_BEHAVIOUR_AND_SOCIAL_INTELLIGENCE.md`
- V10 docs: `denarixx/docs/V10_MOBILE_DEPLOYMENT_READINESS.md`
- V10 checklist: `denarixx/docs/MOBILE_TESTING_CHECKLIST.md`

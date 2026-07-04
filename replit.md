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
- `cd denarixx && npx tsx tests/pilotTesting.test.ts` — V11 Pilot Testing tests (117/117)
- `cd denarixx && npx tsx tests/visionPipeline.test.ts` — V12 Real-Time AI Vision tests (148/148)
- `cd denarixx && npx tsx tests/navigationEngine.test.ts` — V13 Indoor & Outdoor Navigation tests (151/151)
- `cd denarixx && npx tsx tests/multiCameraSupport.test.ts` — V14 Multi-Camera Smart Glasses tests (164/164)
- `cd denarixx && npx tsx tests/onDeviceAI.test.ts` — V15 On-Device AI Optimization tests (170/170)
- `cd denarixx && npx tsx tests/denarixxGlassesPrototype.test.ts` — V16 Denarixx Vision Glasses Prototype tests (176/176)
- `cd denarixx && npx tsx tests/fieldTrial.test.ts` — V17 Real-World Field Trial tests (161/161)
- `cd denarixx && npx tsx tests/manufacturingReadiness.test.ts` — V18 Manufacturing Readiness tests (144/144)
- `cd denarixx && npm run build` — Next.js production build (then delete `.next` and restart workflow)

## Stack

- **Next.js 15** (App Router) — main application in `denarixx/`
- **Express 5** — proxy in `artifacts/api-server/` routes `/api/*` to Express and everything else to Next.js
- **TypeScript 5** — strict, zero errors
- **Tailwind CSS v4** — requires `@source` directive in `globals.css`
- **pnpm workspaces** — monorepo root

## Where things live

- **Next.js app:** `denarixx/` — all 14 pages and 18 API routes
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
- **V11 types:** `denarixx/src/types/pilot.ts` — PilotScenario, TesterConsent, AlertFeedback, PilotSession, PilotReport, FeedbackSummary, ScenarioInfo, PILOT_PRIVACY
- **V11 engine:** `denarixx/src/engines/pilotTestingEngine.ts` — SCENARIO_REGISTRY (7 scenarios), validateConsent, createPilotSession, endPilotSession, recordAlert, recordSilenceDecision, recordPredictedRisk, addAlertFeedback, buildFeedback, calculateFeedbackSummary, generateReport, deletePilotData, formatDuration
- **V11 store:** `denarixx/src/lib/pilotStore.ts` — in-memory pilot session store
- **V11 page:** `denarixx/src/app/pilot/page.tsx` — 4-phase UI: Consent → Scenario → Active (with feedback) → Report; Emergency Stop button; delete session data
- **V11 routes:** `denarixx/src/app/api/pilot/session/route.ts` — POST/GET/PATCH/DELETE; `denarixx/src/app/api/pilot/feedback/route.ts` — POST/GET
- **V11 tests:** `denarixx/tests/pilotTesting.test.ts` (117 tests)
- **V11 docs:** `denarixx/docs/V11_REAL_WORLD_PILOT_TESTING.md`
- **V12 types:** `denarixx/src/types/vision12.ts` — DetectedObject, TrackedObject, TrackerState, PerceptionFrame, PipelineConfig, ModelDescriptor, PipelineMetrics, SceneUnderstanding, BoundingBox, ObjectVelocity, PIPELINE_PRIVACY, DEFAULT_PIPELINE_CONFIG
- **V12 engines:** `denarixx/src/engines/visionInferenceEngine.ts` — orchestrator, runSimulationPipeline, prioritizeObjects, selectSpeechGuidance, buildPerceptionFrame; `depthReasoningEngine.ts` — estimateDepthFromBox, assignObjectPriority, buildVelocity, predictNextPosition, estimateTimeToCollision; `objectTrackingEngine.ts` — IoU tracker, updateTracker, createTrackerState, tracksToDetectedObjects; `sceneUnderstandingEngine.ts` — classifyScene, buildSceneUnderstanding; `cameraPipelineEngine.ts` — FPS throttle, shouldSkipFrame, updateMetrics; `modelManagerEngine.ts` — MODEL_REGISTRY (7 providers), getRecommendedModel
- **V12 page:** `denarixx/src/app/vision/page.tsx` — Live AI Vision: camera preview, tracked objects, scene panel, performance metrics, speech guidance, provider selector, battery mode selector
- **V12 tests:** `denarixx/tests/visionPipeline.test.ts` (148 tests)
- **V12 docs:** `denarixx/docs/V12_REAL_TIME_AI_VISION.md`
- **V13 types:** `denarixx/src/types/navigation.ts` — NavigationSession, RouteSegment, GuidanceLine, CrossingDecision, Landmark, RouteMemory, NavigationSettings, NAVIGATION_PRIVACY (separate from index.ts)
- **V13 engines:** `denarixx/src/engines/navigationIntelligenceEngine.ts` — session lifecycle, tick processing, guidance selection; `indoorNavigationEngine.ts` — zone detection, room-to-room routes, venue modes; `outdoorNavigationEngine.ts` — heading/compass, outdoor routes; `routeSafetyEngine.ts` — risk from detected objects; `landmarkGuidanceEngine.ts` — landmark detection and announcement; `crossingDecisionEngine.ts` — crossing safety (never asserts certainty)
- **V13 store:** `denarixx/src/lib/navigationStore.ts` — in-memory Map<string, NavigationSession>
- **V13 page:** `denarixx/src/app/navigation/page.tsx` — full rewrite: indoor/outdoor toggle, venue mode, route status, heading, distance, crossing panel, SVG route map, guidance queue, privacy notes
- **V13 routes:** `denarixx/src/app/api/navigation/start/route.ts` — POST create session; `update/route.ts` — POST update heading/detections; `end/route.ts` — POST end; `landmark/route.ts` — POST add landmark; `crossing-decision/route.ts` — POST evaluate crossing
- **V13 tests:** `denarixx/tests/navigationEngine.test.ts` (151 tests)
- **V13 docs:** `denarixx/docs/V13_INDOOR_OUTDOOR_NAVIGATION_ENGINE.md`
- **V1 tests:** `denarixx/tests/engines.test.ts` (24 tests)
- **V2 tests:** `denarixx/tests/cognitiveGuardian.test.ts` (37 tests — includes AlertThrottleEngine suite)
- **V3 tests:** `denarixx/tests/v3reasoning.test.ts` (27 tests)
- **V5 tests:** `denarixx/tests/voiceCompanion.test.ts` (72 tests)
- **V6 tests:** `denarixx/tests/spatial.test.ts` (86 tests)
- **V7 tests:** `denarixx/tests/sensorFusion.test.ts` (69 tests)
- **V8 tests:** `denarixx/tests/hardwareBridge.test.ts` (97 tests)
- **V9 tests:** `denarixx/tests/humanBehaviour.test.ts` (134 tests)
- **V10 tests:** `denarixx/tests/mobileReadiness.test.ts` (47 tests)
- **V11 tests:** `denarixx/tests/pilotTesting.test.ts` (117 tests)
- **V14 types:** `denarixx/src/types/glasses.ts` — GlassesCameraPosition, CameraHealthStatus, FovZone, CameraFeed, GlassesState, FusedDetection, FusedFrame, WearableSensorFrame, MultiCameraConfig, CAMERA_PRIVACY, VISION_UNAVAILABLE_MESSAGE
- **V14 engines:** `glassesCameraEngine.ts` — state, connect/disconnect, feed simulation; `cameraHealthEngine.ts` — health, fallback, battery; `fieldOfViewEngine.ts` — FOV zone classification, directional speech; `multiCameraFusionEngine.ts` — detection fusion, dedup, priority; `wearableSensorFusionEngine.ts` — IMU/compass/thermal/battery
- **V14 component:** `denarixx/src/components/devices/MultiCameraPanel.tsx` — live multi-camera panel (live simulation, embedded in /devices)
- **V14 tests:** `denarixx/tests/multiCameraSupport.test.ts` (164 tests)
- **V14 docs:** `denarixx/docs/V14_MULTI_CAMERA_SMART_GLASSES_SUPPORT.md`
- **V15 types:** `denarixx/src/types/onDeviceAI.ts` — `ModelRuntime` (6 runtimes), `BatteryMode` (4 modes), `LatencyBudget`, `LatencyRecord`, `PerformanceDashboard`, `OnDeviceConfig`, `BatteryOptimizationProfile`, `OfflineSafetyPath`, `OFFLINE_SAFETY_MESSAGE`, `DEFAULT_LATENCY_BUDGET` (criticalTargetMs: 500)
- **V15 engines:** `onDeviceAIEngine.ts` — runtime registry, offline-first safety path, cloud status, processing mode selection; `modelOptimizationEngine.ts` — 7-model registry, quantization strategy, latency grades; `edgeInferenceEngine.ts` — frame pipeline, skip logic, inference simulation, performance dashboard; `latencyBudgetEngine.ts` — budget, recording, critical alert timing (≤500ms), report; `batteryOptimizationEngine.ts` — battery mode classification, adaptive profiles, thermal adjustment
- **V15 page:** `denarixx/src/app/performance/page.tsx` — live performance dashboard: battery slider, cloud status toggle, runtime registry table, latency report, edge detections
- **V15 tests:** `denarixx/tests/onDeviceAI.test.ts` (170 tests)
- **V15 docs:** `denarixx/docs/V15_ON_DEVICE_AI_OPTIMIZATION.md`
- **V16 types:** `denarixx/src/types/denarixxGlasses.ts` — `HardwareMode` (5 modes), `ComponentStatus`, `ConnectionState`, `ThermalState`, `CameraModuleConfig`, `BoneAudioConfig`, `HapticConfig`, `HapticPattern`, `HapticAlertType` (8 types), `PowerProfile`, `PhoneCompanionState`, `GlassesDeviceProfile`, `DenarixxGlassesState`, `HardwarePrototypeSpec`, safety message constants
- **V16 engines:** `denarixxGlassesEngine.ts` — device profile factory (4 cameras), connection state machine, health score, simulation tick; `hardwarePrototypeEngine.ts` — mode classification, emergency fallback, subsystem health matrix, bridge status; `powerManagementEngine.ts` — battery/thermal classification, voltage curve, drain simulation; `audioWearableEngine.ts` — bone-conduction config, output routing, haptic fallback; `hapticWearableEngine.ts` — 8-pattern library, alert routing, intensity scaling
- **V16 component:** `denarixx/src/components/devices/GlassesPrototypePanel.tsx` — live prototype panel: connect/disconnect, mode card, battery/thermal, subsystem status, camera modules grid, haptic pattern preview, hardware bridge status, prototype spec
- **V16 tests:** `denarixx/tests/denarixxGlassesPrototype.test.ts` (176 tests)
- **V16 docs:** `denarixx/docs/V16_DENARIXX_VISION_GLASSES_PROTOTYPE.md`, `denarixx/docs/HARDWARE_PROTOTYPE_SPEC.md`
- **V17 types:** `denarixx/src/types/fieldTrial.ts` — `TrialScenario` (9), `TrialPhase`, `TrialConsent`, `AlertFeedback`, `FeedbackQuestion`, `FeedbackSummary`, `IncidentReport`, `SupervisorNote`, `TrialSilenceDecision`, `SafetyMetrics`, `TrialSession`, `TrialReport`, `TRIAL_PRIVACY`, `TRIAL_SCENARIO_REGISTRY`
- **V17 engines:** `fieldTrialEngine.ts` — session lifecycle, consent validation, alert/silence/incident/note recording, deleteSessionData, emergency stop; `safetyValidationEngine.ts` — 8 safety metrics, usefulnessToScore/clarityToScore, isSafeToPublish, validateSafetyRules, SAFETY_THRESHOLDS; `userFeedbackEngine.ts` — 8-question bank, createAlertFeedback, validateFeedbackResponses, calculateFeedbackSummary, buildFeedbackGuidance; `trialReportEngine.ts` — generateTrialReport, buildRecommendations, getPrivacyGuarantees, exportReportAsJSON, deleteReport
- **V17 store:** `denarixx/src/lib/fieldTrialStore.ts` — in-memory session + report stores
- **V17 page:** `denarixx/src/app/field-trials/page.tsx` — 4-phase UI: Consent (5 checkboxes + participant ID) → Setup (9 scenario cards) → Active (alerts, feedback, notes, incidents, Emergency Stop) → Report (metrics, recommendations, privacy, JSON export, delete)
- **V17 routes:** `denarixx/src/app/api/field-trials/session/route.ts` — POST/GET/PATCH/DELETE; `feedback/route.ts` — POST/GET; `report/route.ts` — POST/GET/DELETE
- **V17 tests:** `denarixx/tests/fieldTrial.test.ts` (161 tests)
- **V17 docs:** `denarixx/docs/V17_REAL_WORLD_FIELD_TRIALS.md`, `denarixx/docs/FIELD_TRIAL_SAFETY_PROTOCOL.md`
- **V18 types:** `denarixx/src/types/manufacturing.ts` — `HardwareComponent` (11), `ReadinessLevel`, `ComplianceStatus`, `RiskLevel`, `ManufacturingRegion`, `CertificationStandard`, `HardwareComponentSpec`, `ComplianceItem` (`isRoadmapOnly: true` always), `ProductRisk`, `ManufacturingOption`, `CertificationMilestone` (`isPlaceholder: true` always), `ReadinessScore`, `ManufacturingReadinessReport`, `MANUFACTURING_DISCLAIMER`
- **V18 engines:** `manufacturingReadinessEngine.ts` — 11-component registry, readiness scoring, 3 manufacturing options, next actions; `compliancePlanningEngine.ts` — 9 compliance items, GDPR/CE/MDR/EAA planning; `productRiskEngine.ts` — 14 risks across 6 categories, scoring/filtering; `certificationRoadmapEngine.ts` — 10 milestones across 4 phases, Q3 2026–Q3 2027, €79k–€216k budget
- **V18 page:** `denarixx/src/app/manufacturing/page.tsx` — 6-tab dashboard: Overview, Hardware (11 components), Compliance (9 items), Risks (14), Roadmap (10 milestones), Manufacturing (3 options)
- **V18 routes:** `api/manufacturing/readiness/route.ts` — GET full report; `risk/route.ts` — GET risks (filterable); `certification/route.ts` — GET milestones + compliance warnings
- **V18 tests:** `denarixx/tests/manufacturingReadiness.test.ts` (144 tests)
- **V18 docs:** `denarixx/docs/V18_MANUFACTURING_READINESS.md`, `denarixx/docs/CERTIFICATION_AND_COMPLIANCE_ROADMAP.md`, `denarixx/docs/MANUFACTURER_REQUIREMENTS_BRIEF.md`
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
- **V11 privacy rules:** PILOT_PRIVACY constants — noVideoStorage, noFaceRecognition, noEmergencyStreaming, consentRequired all true. Enforced in engine: `createPilotSession` throws if `validateConsent` fails. `deletePilotData` redacts testerId → `[deleted]`, API returns HTTP 410 on deleted sessions. Report embeds privacy guarantees.
- **V11 pilot phases:** Consent (disclaimer + 3 checkboxes) → Scenario (7 scenarios with safety notes) → Active (feedback + 72px Emergency Stop) → Report (stats + delete option). Emergency Stop resets to Consent without saving data.
- **V13 navigation types:** `src/types/navigation.ts` is separate from `src/types/index.ts` (which owns V1 `NavigationGuidance`) — never merge them.
- **V13 crossing safety:** crossingDecisionEngine.buildCrossingMessage NEVER says "safe to cross" with certainty. Always uses hedged language: "appears clear, but please check carefully." This is a hard requirement, not a style preference.
- **V13 route memory privacy:** `canSaveRouteMemory()` requires `locationConsentGiven === true`. Default is false. Precise GPS is never stored by default (`noPreciseLocation: true`).
- **V13 simulation tick:** `processNavigationTick` runs at 500ms intervals in the UI — ~1.2m distance per tick (walking pace). Auto-advances segments when 90% of distance traveled. Deviation of 45°+ triggers rerouting state.
- **V13 speech cooldown:** 4-second cooldown between navigation guidance messages. Critical risk bypasses cooldown (always immediate).
- **V14 types separation:** `src/types/glasses.ts` is separate from `src/types/hardware.ts` (V8) — both define camera-related types but for different abstraction layers; never merge them.
- **V14 fallback chain:** glassesCameraEngine `disconnectCamera` does NOT set `fallbackActive`; only `cameraHealthEngine.applyPhoneFallback()` sets it. `shouldFallbackToPhone` returns false when `fallbackActive` is already true (already on phone).
- **V14 camera priority:** front → external → right → left → phone. Phone is always the ultimate fallback (`fallbackToPhoneOnAllFail: true` in DEFAULT_MULTICAMERA_CONFIG).
- **V14 VISION_UNAVAILABLE_MESSAGE:** Used when ALL cameras fail — must say "stop" and "check carefully". This exact string is tested and must not be changed.
- **V14 simulation tick:** MultiCameraPanel runs at 800ms intervals. Feed latency drifts via sin-wave jitter. Battery drains 0.005% per tick.
- **V15 types separation:** `src/types/onDeviceAI.ts` is separate from all other type files — `ModelRuntime`, `BatteryMode`, and `LatencyBudget` live here only.
- **V15 critical latency:** `DEFAULT_LATENCY_BUDGET.criticalTargetMs = 500`. This is a hard cap — never raise it. `adjustBudgetForBattery` scales other components but never relaxes criticalTargetMs.
- **V15 offline safety:** `OFFLINE_SAFETY_MESSAGE` must contain "Online AI" and "local safety mode" — tested by the suite. Never change this string. `initOfflineSafetyPath` activates when cloud is offline OR degraded.
- **V15 runtime selection:** In power_saver/critical battery modes, `selectRuntime` prefers `powerEfficient: true` runtimes. Browser JS is the only `available` runtime; all others are `placeholder` pending SDK integration.
- **V15 processing mode:** Critical alerts ALWAYS route to `local` when `criticalAlertsLocal: true` (default). Offline → `local`. Degraded → `edge`. Normal → `hybrid`.
- **V16 types separation:** `src/types/denarixxGlasses.ts` is separate from `src/types/glasses.ts` (V14) and `src/types/hardware.ts` (V8). `DenarixxGlassesState` is named to avoid clash with V14's `GlassesState`.
- **V16 safety constants:** `GLASSES_DISCONNECT_MESSAGE = 'Vision glasses disconnected. Please stop and check carefully.'`; `BATTERY_CRITICAL_MESSAGE = 'Glasses battery is critically low. Switch to phone mode.'`; `CAMERA_FAIL_MESSAGE = 'Camera input failed. Local safety guidance may be limited.'` — exact strings tested, never change.
- **V16 audio fallback:** If bone-conduction audio fails → haptic fallback triggers automatically (`shouldUsHapticFallback(status)`). If haptic also fails → audio-only continues. Never silent failure.
- **V16 hardware modes:** `phone_only` (disconnected), `glasses_assisted` (connected, reduced), `glasses_primary` (connected, all ok), `degraded_safety` (camera failed / battery critical / degraded), `offline_safety` (no cloud + no glasses).
- **V16 haptic patterns:** 8 patterns in `HAPTIC_PATTERNS` constant — `critical_hazard` (100% intensity, ×3), down to `notification` (40%, ×1). Intensity scales at ≤20%/≤10% battery. Pattern durations computed from pulse+pause arrays.
- **V16 battery thresholds:** Critical = ≤10%, Low = ≤20%. `BATTERY_CRITICAL_THRESHOLD` and `BATTERY_LOW_THRESHOLD` constants. `estimateRemainingMinutes()` uses mode-specific mAh draw (phone_only 80mA, glasses_primary 220mA).
- **V16 camera modules:** 4 cameras: front 1920×1080/30fps/80°, left 1280×720/15fps/100°, right 1280×720/15fps/100°, downward 640×480/10fps/120°+depth. No local video storage (privacy rule).
- **V16 prototype spec:** 42g, 300mAh LiPo, 4h battery, Qualcomm AR2 (placeholder), 2GB RAM, 8GB storage, BT LE primary, €399 target, Q2 2026 Germany prototype.
- **V16 bridge integration:** `buildHardwareBridgeStatus()` provides visionSource/audioOutput/hapticOutput/processingMode to V8 Hardware Bridge, V14 Multi-Camera, V15 On-Device AI, V2 Cognitive Guardian.
- **V17 types separation:** `src/types/fieldTrial.ts` is separate from `src/types/pilot.ts` (V11 lab pilot). `TrialSilenceDecision` avoids clash with V11's `SilenceDecision`.
- **V17 consent gate:** `createTrialSession` throws if `validateConsent` fails — all 5 consent fields + non-empty participantId required. Same pattern as V11.
- **V17 safety metrics:** `isSafeToPublish()` requires usefulness ≥ 50, clarity ≥ 50, supervisor safety ≥ 70, false alerts < 30. All thresholds in `SAFETY_THRESHOLDS` constant.
- **V17 privacy constants:** `TRIAL_PRIVACY.{noVideoStorage, noFaceRecognition, noEmergencyStreaming, noBiometricStorage, consentRequired, supervisorRequired, locationStorageDisabled, dataDeleteOnRequest}` — all true.
- **V17 delete flow:** `deleteSessionData` → redacts participantId to `[deleted]`, clears all arrays, sets phase `deleted`. `deleteReport` → redacts participantId, zeroes feedbackSummary, sets deleted=true. API returns HTTP 410 for deleted records.
- **V17 Emergency Stop:** sets `emergencyStopUsed: true`, transitions to `completed` from any phase. Report embeds this flag. Debrief required before next session.
- **V17 9 scenarios:** road_crossing and stairs are high-risk, require 2 supervisors, simulation-only in Phase 17. Never with real traffic or live platforms.
- **V17 feedback questions:** 8 questions covering usefulness, timing, frequency, clarity, overwhelmed, safer, alternative text, supervisor missed hazard.
- **V18 types separation:** `src/types/manufacturing.ts` is separate from all other type files. `isRoadmapOnly: true` on all `ComplianceItem` — never claim certified. `isPlaceholder: true` on all `CertificationMilestone`.
- **V18 MANUFACTURING_DISCLAIMER:** must contain "not CE marked", "not a medical device", "planning purposes only". Exact strings tested — never change.
- **V18 compliance score:** `not_assessed=0, planning=20, in_progress=50, verified=85, certified=100`. Applied per item, averaged.
- **V18 risk scoring:** lower is better. Weights: critical=40, high=20, medium=10, low=3. Multiplier: open=1.0, mitigated=0.1, accepted=0.2.
- **V18 critical risks open:** HW-001 (no physical prototype), REG-001 (medical device boundary not assessed). Both must be addressed before any investor/manufacturer meeting.
- **V18 certification budget:** €79k–€216k total. CE marking target Q1 2027. Pre-prototype tasks (DPIA, DPO, MDR) must start Q3 2026.
- **V18 medical device warning:** MDR boundary assessment is MANDATORY before any public launch. Never claim Denarixx is a medical device. crossingDecisionEngine already enforces hedged language — do not change.
- **V18 manufacturing recommended path:** hybrid (EU industrial design + CN assembly). Europe-only for GDPR-first pilot prototypes. China-only for scale >1,000 units.

## Product

Denarixx Vision AI is a Phase 18 platform for blind and visually impaired users. The Vision Session page supports real browser camera input (getUserMedia) with simulation as automatic fallback. Phase 4 adds a real AI vision provider system (OpenAI GPT-4o) — set `VISION_PROVIDER=openai` and `OPENAI_API_KEY` to enable. Simulation is the default and always the fallback.

**14 pages:**
- **Homepage (`/`)** — Investor-grade landing with 7-step demo flow, AI pipeline diagram, roadmap
- **Vision Session (`/session`)** — Interactive 7-step guided demo with live DemoFlow tracker, SpatialMapPanel, SensorStatusPanel, and SessionReport
- **Live AI Vision (`/vision`)** — V12 real-time perception pipeline: camera preview, tracked objects (IoU), scene understanding, performance metrics, speech guidance, provider + battery mode selectors
- **Pilot Testing (`/pilot`)** — V11 4-phase supervised pilot testing: consent screen, 7 test scenarios, live feedback collection, session report with privacy guarantees and delete option
- **Manufacturing (`/manufacturing`)** — V18 6-tab dashboard: readiness score (overall/hardware/software/compliance/docs), hardware component registry (11 components with readiness level + blockers), compliance checklist (9 items, roadmap-only), risk registry (14 risks with level/status/mitigation), certification roadmap (10 milestones, Q3 2026–Q3 2027), manufacturing options (3 regions)
- **Field Trials (`/field-trials`)** — V17 4-phase UI: Consent (5 checkboxes, participant ID, disclaimers) → Scenario (9 scenarios with risk/safety labels) → Active (alert simulation, feedback, supervisor notes, incidents, 72px Emergency Stop) → Report (8 safety metrics, recommendations, privacy guarantees, JSON export, full data delete)
- **Devices (`/devices`)** — V8 + V14 + V16: Smart Glasses Integration Layer + Multi-Camera System + Denarixx Vision Glasses prototype panel (connect/disconnect sim, mode, battery, thermal, subsystems, haptic preview, camera modules, bridge status, prototype spec)
- **Performance (`/performance`)** — V15 On-Device AI dashboard: battery slider, cloud status, runtime registry, latency budget, edge detections, processing mode selector
- **Cognitive Guardian (`/guardian`)** — V2 pipeline debugger: pick a scenario, run the full AI decision pipeline, see live timings per stage
- **Cognitive Reasoning (`/reasoning`)** — V3 live pipeline debugger: 6-panel view showing environment understanding, internal reasoning, risk prediction, action decision, and human guide message
- **Hazards (`/hazards`)** — Standalone HazardDetectionEngine tester with 4 example scenarios
- **Memory (`/memory`)** — AI memory store with seed demo data, stats bar, add/view items
- **Navigation (`/navigation`)** — V13 Indoor & Outdoor Navigation: mode toggle, venue modes, route status panel, heading, distance, SVG route map, crossing decision panel, guidance queue, location privacy notes
- **Settings (`/settings`)**, **Privacy (`/privacy`)**, **Admin (`/admin`)**, **Docs (`/docs`)**

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
- V11 Pilot Testing: **117/117 passing**
- V12 Real-Time AI Vision Engine: **148/148 passing**
- V13 Indoor & Outdoor Navigation Engine: **151/151 passing**
- V14 Multi-Camera Smart Glasses: **164/164 passing**
- V15 On-Device AI Optimization: **170/170 passing**
- V16 Denarixx Glasses Prototype: **176/176 passing**
- V17 Real-World Field Trials: **161/161 passing**
- V18 Manufacturing Readiness: **144/144 passing**

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
- V11 docs: `denarixx/docs/V11_REAL_WORLD_PILOT_TESTING.md`
- V12 docs: `denarixx/docs/V12_REAL_TIME_AI_VISION.md`
- V13 docs: `denarixx/docs/V13_INDOOR_OUTDOOR_NAVIGATION_ENGINE.md`
- V14 docs: `denarixx/docs/V14_MULTI_CAMERA_SMART_GLASSES_SUPPORT.md`
- V15 docs: `denarixx/docs/V15_ON_DEVICE_AI_OPTIMIZATION.md`
- V16 docs: `denarixx/docs/V16_DENARIXX_VISION_GLASSES_PROTOTYPE.md`
- V16 spec: `denarixx/docs/HARDWARE_PROTOTYPE_SPEC.md`
- V17 docs: `denarixx/docs/V17_REAL_WORLD_FIELD_TRIALS.md`
- V17 protocol: `denarixx/docs/FIELD_TRIAL_SAFETY_PROTOCOL.md`
- V18 docs: `denarixx/docs/V18_MANUFACTURING_READINESS.md`
- V18 roadmap: `denarixx/docs/CERTIFICATION_AND_COMPLIANCE_ROADMAP.md`
- V18 brief: `denarixx/docs/MANUFACTURER_REQUIREMENTS_BRIEF.md`

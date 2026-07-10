# Denarixx Vision AI

An assistive AI perception platform for blind and visually impaired users — providing real-time hazard awareness, scene understanding, spatial intelligence, and audio guidance via a simulation MVP.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Express proxy (port 8080, single entry point)
- `cd denarixx && npm run dev` — run Next.js directly (port 3000, dev only)
- `cd denarixx && npm run type-check` — TypeScript check for the Next.js app
- `cd denarixx && npm test` — V1 core engine tests (24/24)
- `cd denarixx && npx tsx tests/cognitiveGuardian.test.ts` — V2 Cognitive Guardian + AlertThrottleEngine tests (37/37)
- `cd denarixx && npx tsx tests/guardianAlertQuality.test.ts` — Sprint 5 Guardian Alert Quality tests (60/60)
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
- `cd denarixx && npx tsx tests/longTermMemory.test.ts` — Sprint 8 Long-Term Memory tests (100/100)
- `cd denarixx && npx tsx tests/explainableAI.test.ts` — Sprint 9 Explainable AI & Trust tests (90/90)
- `cd denarixx && npx tsx tests/companionPersonality.test.ts` — Sprint 10 Adaptive Companion Personality tests (92/92)
- `cd denarixx && npx tsx tests/projectProgress.test.ts` — Project Progress Tracker tests (59/59) — updated for 30 sprints, 6 phases
- `cd denarixx && npx tsx tests/accessibilityEngine.test.ts` — Sprint 11 Accessibility & Personal Preferences tests (127/127)
- `cd denarixx && npx tsx tests/privacyDashboard.test.ts` — Sprint 12 Privacy Dashboard & Consent Management tests (103/103)
- `cd denarixx && npx tsx tests/languageEngine.test.ts` — Sprint 13 Multi-Language AI Engine tests (118/118)
- `cd denarixx && npx tsx tests/offlineEngine.test.ts` — Sprint 14 Offline Mode & Edge AI tests (152/152)
- `cd denarixx && npx tsx tests/streetSafety.test.ts` — Sprint 15 No-Internet Street Safety tests (143/143)
- `cd denarixx && npx tsx tests/glassesRuntime.test.ts` — Sprint 16 Standalone Glasses OS tests (160/160)
- `cd denarixx && npx tsx tests/hardwareAbstraction.test.ts` — Sprint 17 Hardware Abstraction Layer tests (161/161)
- `cd denarixx && npx tsx tests/glassesSimulator.test.ts` — Sprint 18 Digital Twin tests (127/127)
- `cd denarixx && npx tsx tests/hardwareSpecification.test.ts` — Sprint 19 Hardware Specification tests (48/48)
- `cd denarixx && npx tsx tests/prototypeIntegration.test.ts` — Sprint 20 Prototype Hardware Integration tests (75/75)
- `cd denarixx && npx tsx tests/livePerceptionE2E.test.ts` — Sprint 23 Live Perception E2E behavioural tests (80/80)
- `cd denarixx && npm run build` — Next.js production build (then delete `.next` and restart workflow)

## Live Perception Hardening (Sprint 23)

10-item hardening program covering alert coordination, failure recovery, human-friendly wording, pipeline audit, accessibility validation, and E2E behavioural tests.

**New engines:**
- `src/engines/alertCoordinationEngine.ts` — 7-level priority queue (critical_hazard → companion_info), deduplication by key + cooldown, critical interrupt logic, multi-source (vision/ocr/navigation/companion/system)
- `src/engines/systemAnnouncementEngine.ts` — human-friendly messages for all system events (session start, mode switches, provider failures, battery, camera status); no technical jargon in speech
- `src/engines/failureRecoveryEngine.ts` — 12 failure scenarios (camera-permission-denied, camera-disconnected, model-load-failure, cloud-provider-timeout, no-internet, weak-internet, ocr-worker-crash, stt-unavailable, tts-unavailable, location-unavailable, battery-critical, overheating); each has recovery level, announcement, fallback action, user hint; safety core maintained in all scenarios

**Wording fix:** `guardianWordingEngine.ts` crossing language confirmed clean — never says "safe to cross"; uses "appears clear, but please check carefully"

**Tests:** `tests/livePerceptionE2E.test.ts` — 80 behavioural tests covering all 13 real scenarios (obstacle, stairs, vehicle, bicycle, sign, medicine, provider outage, internet loss, camera loss, critical interrupt, dedup suppression, hybrid fallback, offline continuation) + wording validation + coordination system + failure recovery system

**Docs:**
- `docs/LIVE_PIPELINE_WIRING_AUDIT.md` — full audit of connected/disconnected stages with evidence from source; latency budget table; safety guarantees; pipeline diagram
- `docs/LIVE_ACCESSIBILITY_VALIDATION.md` — 9 requirements validated (screen reader, keyboard, voice-first, emergency control, one-action start, reduced motion, high contrast, haptic fallback, offline accessibility)

**Wiring summary (from audit):** Vision→Hazard→Safety→speak() fully connected; AlertThrottleEngine, GuidancePersonalityEngine, MobilityEngine, SensorFusion all in runFrame. livePerceptionEngine.ts and voiceInteractionEngine.ts (Sprint 22) remain isolated engines — session hook is the pipeline.

**Total test count: 38 suites, 3,070+ tests passing, 0 regressions**

Test command: `cd denarixx && npx tsx tests/livePerceptionE2E.test.ts`

## Real Perception Integration (Sprint 22)

Full 5-phase sprint connecting OCR, speech engines, and live perception pipeline.

**Phase 1 — OCR engines:**
- `src/engines/ocrEngine.ts` — provider abstraction: TesseractProvider + NullProvider
- `src/engines/textReadingEngine.ts` — domain-aware text reading (sign/menu/medicine/street/receipt/document)
- `src/types/ocr.ts` — OCR types (OCRResult, TextReadingResult, OCRProvider, TextDomain, etc.)

**Phase 2 — Speech engines:**
- `src/engines/speechRecognitionEngine.ts` — STT provider, wake word detection, emergency transcript, streaming buffer
- `src/engines/textToSpeechEngine.ts` — priority queue (critical/high/normal/low), interrupt, streaming, emergency bypass
- `src/engines/voiceInteractionEngine.ts` — orchestrates STT + TTS + wake word + emergency mode
- `src/types/speech.ts` — speech types (TtsQueueItem, WakeWordConfig, VoiceInteractionState, etc.)

**Phase 3 — Live Perception Pipeline:**
- `src/engines/livePerceptionEngine.ts` — Camera → Vision → OCR → Guardian → Navigation → Voice
- `src/types/livePerception.ts` — pipeline types (LivePerceptionConfig, PerceptionFrameMetrics, etc.)

**Phase 4 — Settings UI** (added to Settings page):
- OCR provider selector (Tesseract.js / Disabled)
- TTS provider selector (Web Speech API / Silent)
- STT provider selector (Web Speech API / Disabled)
- Wake word toggle ("Hey Aria")
- Streaming speech toggle
- New fields in `settingsStore.ts`: `perceptionMode`, `ocrProvider`, `speechProvider`, `sttProvider`, `wakeWordEnabled`, `streamingSpeech`

**Phase 5 — Performance:**
- `src/engines/perceptionLatencyEngine.ts` — per-stage timers, ring buffer (100 samples), P95/avg/min/max report, grade labels

**Tests:** `tests/realPerception.test.ts` — 146 tests, 0 failed. Covers OCR, text reading, STT, TTS, voice interaction, pipeline, latency, provider switching, failure recovery.

**Docs:** `docs/REAL_PERCEPTION_INTEGRATION.md` — pipeline diagram, provider table, phase docs, offline strategy.

Test command: `cd denarixx && npx tsx tests/realPerception.test.ts`

## Real AI Integration (Sprint 21)

Three vision modes selectable in Settings → AI Vision Mode:
- **Simulation** (default) — synthetic detections, no camera or API key needed
- **Live Local AI** — TensorFlow.js COCO-SSD on-device (80 classes, no API key, works offline)
- **Live Cloud AI** — Gemini / OpenAI vision via `/api/vision/analyze-frame` (requires env key)

OCR (Tesseract.js): Settings → OCR toggle — reads signs/labels from camera frames every 15 s.

New files:
- `denarixx/src/hooks/useLocalObjectDetection.ts` — COCO-SSD hook (lazy model load, status/error tracking)
- `denarixx/src/hooks/useOCR.ts` — Tesseract.js hook (lazy worker, confidence output)
- `denarixx/docs/REAL_AI_INTEGRATION.md` — feature status table, latency table, architecture

Session page shows an **AI Processing** panel: mode badge, model status, live pipeline latency (ms), OCR results.
Latency is tracked in `useVisionSession.ts` → `state.lastLatencyMs` / `state.avgLatencyMs`.
New settings keys in `settingsStore.ts`: `visionMode`, `ocrEnabled`.
Web Speech API (TTS + STT) was already real; now documented explicitly.

## Stack

- **Next.js 15** (App Router) — main application in `denarixx/`
- **Express 5** — proxy in `artifacts/api-server/` routes `/api/*` to Express and everything else to Next.js
- **TypeScript 5** — strict, zero errors
- **Tailwind CSS v4** — requires `@source` directive in `globals.css`
- **pnpm workspaces** — monorepo root

## Where things live

- **Next.js app:** `denarixx/` — all 17 pages, 26 API routes, 83 engine files, 23 test files
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
- **Sprint 5 engines:** `src/engines/alertDeduplicationEngine.ts` — cross-frame hazard tracking (appeared/disappeared/ongoing, everSeenBeforeFrame snapshot); `guardianWordingEngine.ts` — specific directional messages, 30+ hazard templates, confidence hedging, directional hints from boundingBox; `guardianDecisionLogger.ts` — ring-buffer 100 entries, spoke/silent, getSilenceRatio, getSpeakTriggerSummary; `alertQualityEngine.ts` — Sprint 5 orchestrator, speak-when rules (6 triggers + critical bypass)
- **Sprint 5 tests:** `denarixx/tests/guardianAlertQuality.test.ts` (60 tests)
- **Sprint 5 docs:** `denarixx/docs/SPRINT_5_GUARDIAN_ALERT_QUALITY.md`
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
- **Sprint 11 types:** `denarixx/src/types/preferences.ts` — AccessibilityMode, AudioPreferences, HapticPreferences, NavigationPreferences, AlertPreferences, DisplayPreferences, UserPreferences, AccessibilityPreset (15 types)
- **Sprint 11 engines:** `accessibilityEngine.ts` — 5 presets, CSS class derivation, ARIA helpers, colour-blind palette; `userPreferenceEngine.ts` — save/load/validate/diff, bridge to AppSettings; `audioPreferenceEngine.ts` — speech rate/volume/verbosity/repeat/silence/earcons; `hapticPreferenceEngine.ts` — 6 patterns, intensity scaling, event routing
- **Sprint 11 page:** `denarixx/src/app/accessibility/page.tsx` — 6-tab UI: Presets · Voice · Navigation · Alerts · Haptic · Display
- **Sprint 11 tests:** `denarixx/tests/accessibilityEngine.test.ts` (127 tests)
- **Sprint 11 docs:** `denarixx/docs/SPRINT_11_ACCESSIBILITY_PREFERENCES.md`
- **Sprint 12 types:** `denarixx/src/types/privacy.ts` — ConsentItem, AuditEvent, RetentionRule, PrivacyDashboardState, PrivacyExport, PrivacySummary, PRIVACY_DISCLAIMER, GDPR_NOTE (separate file, never merge with index.ts)
- **Sprint 12 engines:** `consentManagementEngine.ts` — CONSENT_REGISTRY (10 items), grant/revoke/toggle/reset lifecycle; `permissionAuditEngine.ts` — ring-buffer 100 events, 10 audit event types, summary; `dataRetentionEngine.ts` — 6 retention rules, expiry detection, deletion simulation; `privacyDashboardEngine.ts` — dashboard state, privacy summary, export/reset orchestration
- **Sprint 12 page:** `denarixx/src/app/privacy/page.tsx` — 5-tab Privacy Dashboard: Overview · Permissions · Your Data · Activity Log · Retention; consent toggles, data deletion, JSON export, audit trail
- **Sprint 12 tests:** `denarixx/tests/privacyDashboard.test.ts` (103 tests)
- **Sprint 12 docs:** `denarixx/docs/SPRINT_12_PRIVACY_DASHBOARD.md`
- **Sprint 13 types:** `denarixx/src/types/language.ts` — SupportedLanguage (8 langs), LanguageInfo, TranslationContext, TranslationInput, TranslationOutput, VoiceOption, VoicePreference, LanguagePreferences, LanguageDetectionResult, SpeechUtteranceConfig, LANGUAGE_DEFAULTS, GUARDIAN_SAFETY_NOTE (separate file, never merge with index.ts)
- **Sprint 13 engines:** `languageDetectionEngine.ts` — locale map (50+ variants), Arabic script detection, text-frequency analysis, detectFromLocale/Text/Language/LanguageList; `languageEngine.ts` — LANGUAGE_REGISTRY (8 languages), preference lifecycle, RTL helpers, diff; `translationEngine.ts` — PHRASE_DICTIONARY (30+ phrases × 8 languages), translateHazardAlert (sync-only critical safety), batchTranslate, RTL formatting; `speechLanguageEngine.ts` — VOICE_OPTIONS (2–3 voices per language), voice switching, buildSpeechUtteranceConfig, clampVoicePreference
- **Sprint 13 page:** `denarixx/src/app/language/page.tsx` — 4-tab Language Settings: Language (8-card grid, auto-detect) · Voice (selector, pitch/rate/volume sliders, presets) · Preview (live translation for all contexts) · Test (hear phrases in all 8 languages)
- **Sprint 13 tests:** `denarixx/tests/languageEngine.test.ts` (118 tests)
- **Sprint 13 docs:** `denarixx/docs/SPRINT_13_MULTI_LANGUAGE.md`
- **Sprint 14 types:** `denarixx/src/types/offline.ts` — NetworkStatus (5 states), NetworkQuality (4), EdgeModelType (5), ModelStatus (6), OfflineFeature (10), SyncCategory (7), SyncState (6), ConflictStrategy (4), NetworkReading, EdgeModel, OfflineCapabilityEntry, OfflineCapabilityTable, SyncRecord, SyncQueue, ConflictReport, ModelIntegrityCheck, OfflineState, OfflineSummary, OFFLINE_SAFETY_NOTE, SYNC_PRIVACY_NOTE
- **Sprint 14 engines:** `networkMonitorEngine.ts` — glasses↔cloud/phone link tracking, status/quality detection, transitions; `offlineEngine.ts` — glasses-first orchestrator, capability table (10 features all available on glasses), guardian/memory/nav fallbacks; `offlineEdgeEngine.ts` — wearable edge AI on glasses compute module, 5-model registry, integrity checks, inference simulation; `offlineSyncEngine.ts` — glasses sync queue (glasses→cloud via phone bridge), 4 conflict strategies, retry logic; `offlineModelRegistryEngine.ts` — glasses model lifecycle (cloud→phone→glasses OTA), coverage validation, storage summary
- **Sprint 14 pages:** `/offline-status` — glasses cloud link status, offline readiness, feature table (edge-only vs full); `/models` — glasses compute module model cards, download/remove/integrity; `/sync` — glasses cloud sync queue, conflict resolution, activity log
- **Sprint 14 architecture:** Smart glasses = primary device. Phone = setup dashboard + fallback. Cloud = optional enhancement. All safety functions run on glasses compute module offline.
- **Sprint 15 types:** `denarixx/src/types/streetSafety.ts` — StreetHazardType (12 types), HazardSeverity, HazardDirection, ConnectivityState, StreetSafetyMode, LocalHazardPattern, HazardAlert, OfflineGuardianDecision, ConnectivityFallbackConfig, PatternLibraryEntry, StreetSafetyState, StreetSafetySummary, ConnectivityTransition, safety constants (CROSSING_SAFETY_MESSAGE, CAMERA_FAILURE_MESSAGE, OFFLINE_MODE_ANNOUNCEMENT, ONLINE_RESTORED_ANNOUNCEMENT, GLASSES_PRIMARY_NOTE)
- **Sprint 15 engines:** `localHazardPatternEngine.ts` — 12-entry on-glasses pattern library, keyword matching, severity estimation, guidance generation (crossing never says "safe to cross"); `connectivityFallbackEngine.ts` — internet loss detection, mode determination, transition announcements, offline duration; `offlineStreetGuardianEngine.ts` — critical bypass (vehicle/stairs/stop/camera-failure always speak), cooldown table, prioritisation, camera failure alert; `streetSafetyEngine.ts` — tick orchestrator, hazard upsert, stale clear, alert ring-buffer (max 20), mode label/colour
- **Sprint 15 page:** `/street-safety` — mode indicator (online/offline/degraded), hazard injector (8 scenarios), alert log (bone-conduction), network simulator, safety rules panel; phone dashboard only — glasses operate independently
- **Sprint 15 architecture:** Guardian never waits for internet. Critical alerts bypass cooldown. Camera failure triggers immediate warning. Offline → bone-conduction announcement. Online restored → safety mode remains active.
- **Sprint 16 types:** `denarixx/src/types/glassesOS.ts` — BootPhase (7 phases), BootStatus, BootStepResult, BootSequenceResult, BootDiagnostic, SensorType (10 types), SensorStatus, GlassesOSSensor, SensorFusionFrame, SensorStatusSummary, PowerLevel, PowerProfile, ComponentName (7), ComponentStatus, ComponentHealth, DeviceHealth, RuntimeMode (4 modes), RuntimeState, RuntimeSummary, EmergencyModeState; constants: WAKE_WORD, CRITICAL_BATTERY_PCT, LOW_BATTERY_PCT, THERMAL_THROTTLE_TEMP_C, ALWAYS_ACTIVE_FEATURES, STANDALONE_PRINCIPLE, EMERGENCY_MODE_ANNOUNCEMENT, CRITICAL_BATTERY_ANNOUNCEMENT
- **Sprint 16 engines:** `glassesRuntimeEngine.ts` — standalone OS orchestrator, determineRuntimeMode, selectActiveFeatures, bootGlasses, processRuntimeTick, activateEmergencyMode, buildRuntimeSummary, isOperational; `bootSequenceEngine.ts` — 7-phase boot simulation, runBootSequence, runBootUntilPhase, buildBootDiagnostic, getFailureRecoveryMessage; `glassesPowerEngine.ts` — classifyPowerLevel, buildPowerProfile, getReducedPowerFeatures, estimateDrainRate, buildPowerWarning, simulateBatteryTick; `glassesOSSensorEngine.ts` — 10-sensor lifecycle, initializeSensor, activateSensor, restartSensor, buildSensorFusionFrame, detectSensorAnomalies; `deviceHealthEngine.ts` — 7-component health assessment, buildDeviceHealthReport, isHealthCritical
- **Sprint 16 pages:** `/glasses-status` (runtime mode, features, emergency), `/device-health` (component health scores), `/battery` (power profile, drain simulation), `/sensors` (10 sensors, fusion frame, restart), `/boot-diagnostics` (7-phase boot results)
- **Sprint 16 tests:** `denarixx/tests/glassesRuntime.test.ts` (160/160)
- **Sprint 16 docs:** `denarixx/docs/SPRINT_16_STANDALONE_GLASSES_OS.md`
- **Sprint 16 architecture:** Glasses = primary computer. Phone = optional dashboard. Cloud = optional enhancement. No phone required for any safety feature. Guardian is last feature disabled at critical battery. Boot completes before any user interaction — Guardian active before wake word listener.
- **Sprint 17 types:** `denarixx/src/types/hardwareHAL.ts` — HardwarePlatform (5: simulation/prototype/android-xr/linux-wearable/denarixx-v1), HALDeviceStatus, HALComponentType (7), CameraFrame, CameraHALState, MicrophoneFrame, MicrophoneHALState, SpeechQueueItem, SpeakerHALState, IMUReading, IMUHALState, GPSReading, GPSHALState, BatteryReading, BatteryHALState, DisplayHALState, HALRegistration, SensorHealthReport, HALSystemState; constants: HAL_SAFETY_NOTE, SIMULATION_DRIVER, MAX_RESTART_ATTEMPTS (3), RESTART_COOLDOWN_TICKS (5), SUPPORTED_PLATFORMS. Never merge with V8 src/types/hardware.ts.
- **Sprint 17 engines:** `hardwareAbstractionEngine.ts` — top-level HAL coordinator, initializeHALSystem (7 component registrations), registerDriver, getDriverForComponent, isSupportedPlatform (5 platforms), getPlatformLabel/Notes, buildHALIntegrationBridge (8 Sprint 1–16 connections), getHALNote; `cameraHAL.ts` — createCameraHALState, initializeCamera, captureFrame, restartCamera (max 3), activateFallbackCamera, buildFrameStream, getCameraDriver per platform; `microphoneHAL.ts` — createMicHALState, startWakeWordListening, captureMicFrame, applyNoiseReduction (placeholder), detectWakeWord, runMicDiagnostics; `speakerHAL.ts` — bone-conduction default, priority queue (emergency/high/normal/low), activateEmergencyOverride, processQueue; `imuHAL.ts` — readIMU, classifyMotionState (stationary/walking/running/falling), getHeading (0–360°), detectFall; `gpsHAL.ts` — acquireFix, classifyGPSQuality (excellent/good/fair/poor/unavailable), classifyPositioningMode (gnss/assisted/offline-dead-reckoning/unavailable), activateOfflineMode; `batteryHAL.ts` — readBattery, classifyBatteryHealth, buildBatteryWarning (CRITICAL_BATTERY_ANNOUNCEMENT at ≤10%), isCritical; `displayHAL.ts` — setDisplayMode (hud/low-power/off/ar-overlay), setBrightness, activateLowPowerMode, AR overlay placeholder; `sensorManagerEngine.ts` — coordinates all 7 HALs, runHealthChecks, autoRestartFailedSensors (cameras/mic/IMU/GPS), RESTART_COOLDOWN_TICKS cooldown, getSensorManagerSummary
- **Sprint 17 tests:** `denarixx/tests/hardwareAbstraction.test.ts` (161/161)
- **Sprint 17 docs:** `denarixx/docs/SPRINT_17_HARDWARE_ABSTRACTION_LAYER.md`
- **Sprint 17 architecture:** AI communicates with HAL only — never directly with hardware. Platform switching (simulation → prototype → android-xr → linux-wearable → denarixx-v1) requires zero changes to AI engines. Camera fallback: up to 3 restarts then switches to secondary camera. Sensor auto-restart with cooldown prevents restart storms. Battery HAL imports CRITICAL_BATTERY_PCT from glassesOS.ts (Sprint 16). Future: denarixx-v1 native drivers connect HAL to custom Denarixx hardware (target Q4 2027).
- **Sprint 18 types:** `denarixx/src/types/simulator.ts` — EnvironmentType (11), SimulatorFaultType (9), DigitalTwinState, VirtualCamera, VirtualGPS, VirtualIMU, VirtualBattery, VirtualMicrophone, VirtualSpeaker, VirtualDisplay, SimulatedFault, FaultInjectionResult, DiagnosticsReport, AIValidationResult, PerformanceMetrics, ManufacturingReadinessScore; TWIN_NOTE, DIGITAL_TWIN_PLATFORM, TOTAL_VIRTUAL_COMPONENTS (11). Never merge with hardware.ts (V8) or hardwareHAL.ts (Sprint 17).
- **Sprint 18 engines:** `environmentSimulationEngine.ts` — ENVIRONMENT_REGISTRY (11 profiles: busy-city/quiet-street/shopping-mall/airport/train-station/rain/fog/night/snow/strong-sunlight/indoor-navigation), applyEnvironment, getGPSAccuracyForEnvironment, needsBoneConductionBoost, getEnvironmentCameraChallenge; `virtualSensorEngine.ts` — simulateCameraFrame, simulateGPS, simulateIMU, simulateCompass, simulateBatteryTick, simulateTemperature, isBatteryThermalCritical, simulateMicFrame, getMicQuality, getDisplayVisibility; `hardwareFaultEngine.ts` — FAULT_DEFINITIONS (9), injectCameraFailure/GPSLoss/LowBattery/SensorDrift/MicrophoneFailure/SpeakerFailure/Overheating/LowLight/PartialObstruction, clearFault, recoverFrom* helpers, getActiveFaults, isCriticalFaultActive; `glassesSimulatorEngine.ts` — createGlassesSimulator, bootSimulator, tickSimulator, resetSimulator, setSimulatorEnvironment, getWorkingCameraCount, isSimulatorHealthy, getSimulatorSummary, getComponentStatuses (11 components); `digitalTwinEngine.ts` — createDigitalTwin, getTwinHealthScore, buildTwinSnapshot, validateGuardianResponse/NavigationDegradation/OfflineMode/EmergencyMode/ExplainableAI, runAllAIValidations, allAIValidationsPassed, buildManufacturingReadinessScore, getPerformanceMetrics; `diagnosticsEngine.ts` — buildSensorHealthDashboard, runDiagnostics, validateAISystems, buildPerformanceSummary, getFaultHistory
- **Sprint 18 tests:** `denarixx/tests/glassesSimulator.test.ts` (127/127)
- **Sprint 18 docs:** `denarixx/docs/SPRINT_18_DIGITAL_TWIN.md`
- **Sprint 18 architecture:** Digital Twin platform = 'simulation'. 11 virtual components (3 cameras + GPS + IMU + battery + 2 mics + speaker + display + temperature). 5 AI validation scenarios must pass before isManufacturingReady=true. Phase 5 (Expanded Access) sprintRange [23,28] — complete. Phase 6 "Platform & Hardware" [29,33] — active.
- **Sprint 19 docs:** `denarixx/docs/SPRINT_19_HARDWARE_SPECIFICATION.md` — sprint summary, prototype target (≤85g, ≥4h, IP53), processor/AI accelerator (4 TOPS NPU), RAM/storage targets, connectivity (Wi-Fi 6, BT 5.3, eSIM/LTE, USB-C PD 45W), software links (HAL/Glasses OS/Digital Twin/Offline/Guardian), quality gates, EVT/DVT/PVT milestones; `HARDWARE_ARCHITECTURE.md` — system block diagram (compute module, camera array, sensor hub, connectivity, audio, power), 5 component interfaces (MIPI CSI-2 camera / I2C sensor / PMIC power / I2S audio / DSI display), 5 modularity rules, software stack diagram, manufacturing gate commands; `SENSOR_REQUIREMENTS.md` — GPS/GNSS (multi-constellation, TTFF, dead-reckoning fallback, privacy fuzzing), IMU 6-axis (200 Hz, fall detection, motion states), compass (100 Hz, ±2° heading), temperature sensor (thresholds: 38/42/48°C), microphone array (3 MEMS, PDM, beamforming, always-on wake ≤3 mW), bone-conduction speaker (×2, priority queue, emergency override, haptic fallback), touch controls (capacitive strip, 5 gestures), voice wake system (on-chip DSP, offline, no cloud); `CAMERA_REQUIREMENTS.md` — 4-camera deep-dive (front-wide 120°/f1.8, front-tele 60°/f2.4, side-left 160°, side-right 160°), multi-camera fusion pipeline, vision pipeline performance (15/10/5/2 fps per battery mode), crossing safety rule (never says "safe to cross"), privacy requirements; `POWER_SYSTEM.md` — battery spec (Li-Po 2500 mAh 3.7V), charging (USB-C PD 45W, ≤90 min to 80%), power budget per mode (4 modes: Performance 2815mW/Balanced/Low-power/Emergency ≤600mW), thermal thresholds + actions, thermal design (SoC TDP ≤4W, graphite sheet, aluminium frame), battery safety rules (10 rules), emergency power path (bone-conduction + wake DSP always live); `MANUFACTURING_READINESS.md` — 4 manufacturing stages (Stage 0 software-defined → EVT Q4 2026 → DVT Q2 2027 → PVT Q4 2027 → Limited run Q1 2028), compliance/certification roadmap (CE/FCC/GDPR/EAA/MDR/ISO 9001/UKCA), top 5 risk register, software readiness test commands, budget estimate (€270k–€396k to PVT)
- **Sprint 19 tests:** `denarixx/tests/hardwareSpecification.test.ts` (48/48) — validates all 6 docs exist, content checks for all specs
- **Sprint 19 roadmap:** Phase 6 (Platform & Hardware) [29,33] now active — Sprint 19 (ID 29) complete; projectProgressEngine tracks 29 sprints / 6 phases; Phase 6 shows 1/5 sprints complete (IDs 30–33 reserved for future hardware sprints)
- **Sprint 20 types:** `denarixx/src/types/prototype.ts` — 12 HardwareInterfaceType, IntegrationStatus, FirmwareState, ProvisioningStep (8), ProvisioningStepStatus, DeploymentStage (4), DeploymentArtifact (4), DiagnosticLevel, HardwareInterface, PrototypeIntegrationState (integrationScore/readyForEVT), FirmwareInfo, FirmwareSensorRecord, FirmwareBridgeState, FirmwareHealthReport, ProvisioningStepRecord, DeviceProvisioningState, ProvisioningResult, DeploymentStageConfig, DeploymentPipelineState, DiagnosticEntry, RollbackResult, PrototypeTestCase; constants: INTEGRATION_DISCLAIMER, PROTOTYPE_PLATFORM, TOTAL_HARDWARE_INTERFACES=12, PROVISIONING_STEPS, PROVISIONING_VOICE_SAMPLES_REQUIRED=3, INTEGRATION_SCORE_EVT_THRESHOLD=80, PROTOTYPE_SAFETY_NOTE. Never merge with hardware.ts (V8), hardwareHAL.ts (Sprint 17), or simulator.ts (Sprint 18).
- **Sprint 20 engines:** `prototypeIntegrationEngine.ts` — INTERFACE_REGISTRY (12 interfaces: camera/mic/bone-audio/battery/GPS/IMU/compass/display/button/touch/USB-C/wireless), CRITICAL_INTERFACE_TYPES (6: camera/bone-audio/battery/gps/imu/microphone), createPrototypeIntegrationState, updateInterfaceStatus, recomputeState (score/EVT-ready), getCriticalInterfaces, getFailedInterfaces, allCriticalValidated, getIntegrationSummary; `firmwareBridgeEngine.ts` — startDiscovery, registerSensor, completeDiscovery, getDiscoverySummary, setFirmwareInfo, isVersionCompatible, hasCapability, buildHealthReport, recordHeartbeat, isHeartbeatStale (10 s default), checkForOTA, setOTAAvailable, beginOTA, completeOTA (clears sensor registry for re-registration), getRegisteredSensors, getSensorByType; `deviceProvisioningEngine.ts` — createProvisioningState (8 steps, privacy defaults: GPS fuzzing on/locationEnabled off), beginStep, completeStep, applyStepResult, failStep, addVoiceSample, isVoiceCalibrationComplete (3 samples), setSensorCalibrationPassed, setLanguage, setAccessibilityProfile, ACCESSIBILITY_PROFILES (5), setPrivacyDefault, applyFactoryReset, getProvisioningProgress, getProvisioningSummary; `hardwareDeploymentEngine.ts` — DEFAULT_STAGES (dev/staging/prototype/production), createDeploymentPipeline, getStageConfig, getCurrentStageConfig, getNextStage, checkForOTA, setLatestVersion, applyOTA (stores rollback version), rollback, applyRollback, addDiagnosticEntry, getDiagnosticsByLevel, clearDiagnostics, isProductionReady, hasArtifact, getDeploymentSummary
- **Sprint 20 docs:** `SPRINT_20_PROTOTYPE_INTEGRATION.md` — sprint summary, integration architecture diagram, first-boot provisioning flow, EVT readiness gate (score ≥ 80, all critical validated), safety rules unchanged on prototype, roadmap (EVT Q4 2026 → DVT Q2 2027 → PVT Q4 2027 → Limited run Q1 2028); `SYSTEM_INTEGRATION_GUIDE.md` — 12-interface registry table (protocol/HAL driver/sprint source/notes), integration checklist (4 phases per interface), interface dependency tree, integration score calculation, 5 safety integration rules; `HARDWARE_SOFTWARE_INTERFACE.md` — firmware bridge protocol (discovery/sensor registration/health reporting/version/capability flags/OTA hooks), HAL platform driver contract (simulation stubs → prototype implementations), error handling contract (7 error types), data flow example (camera → Guardian alert ≤500 ms); `PROTOTYPE_TEST_PLAN.md` — 8 EVT test scenarios (indoor navigation/outdoor navigation/obstacle detection/low battery/offline mode/camera interruption/sensor recovery/emergency alerts), pass criteria per scenario, EVT acceptance summary (6 critical tests), automated test commands; `DEPLOYMENT_PIPELINE.md` — 4-stage pipeline (dev/staging/prototype/production), build artifacts (firmware/ai-models/config/locale-pack), signed firmware format (placeholder HSM), rollback strategy (5 triggers), diagnostic log retention rules, recovery mode conditions, deployment engine API reference
- **Sprint 20 tests:** `denarixx/tests/prototypeIntegration.test.ts` (75/75) — 8 suites: constants (8), interface registry (5), integration engine (14), firmware bridge (16), provisioning (16), deployment (16)
- **Sprint 20 roadmap:** Phase 6 (Platform & Hardware) now **complete** — Sprint 19 (ID 29) + Sprint 20 (ID 30) both done; Phase 6 = 2/2 sprints complete; projectProgressEngine tracks 30 sprints / 6 phases; all 6 phases complete when all 30 test files detected
- **Sprint 14 tests:** `denarixx/tests/offlineEngine.test.ts` (152 tests)
- **Sprint 14 docs:** `denarixx/docs/SPRINT_14_OFFLINE_EDGE_AI.md`
- **Roadmap Phase 5:** `Expanded Access` — sprintRange [23, 27], Sprint 23 = Multi-Language, Sprint 24 = Offline Mode & Edge AI
- **Camera hook:** `denarixx/src/hooks/useCameraCapture.ts` — getUserMedia, stream lifecycle, frame capture (JPEG base64), 4-state status machine
- **Alert throttle engine:** `denarixx/src/engines/alertThrottleEngine.ts` — per-severity cooldowns (Sprint 5: critical:5s, high:10s, medium:20s, low:30s), shouldSpeak() decision, confidence-escalation override, speak-count tracking
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
- **Memory (`/memory`)** — Sprint 8 long-term memory: 6-tab dashboard (Overview, Saved Places, Routes, Hazards, Preferences, Privacy), delete all, export placeholder, privacy rules panel
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
- Sprint 8 Long-Term Memory: **100/100 passing**

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
- Sprint 8 docs: `denarixx/docs/SPRINT_8_LONG_TERM_MEMORY_CONTEXT.md`
- Sprint 19 docs: `denarixx/docs/HARDWARE_SPECIFICATION_OVERVIEW.md`, `denarixx/docs/CAMERA_ARRAY_SPECIFICATION.md`, `denarixx/docs/SENSOR_SUITE_SPECIFICATION.md`, `denarixx/docs/POWER_SYSTEM_SPECIFICATION.md`, `denarixx/docs/CONNECTIVITY_SPECIFICATION.md`, `denarixx/docs/SOFTWARE_HARDWARE_CONTRACTS.md`
- Sprint 20 docs: `denarixx/docs/PROTOTYPE_INTEGRATION_PLAN.md`, `denarixx/docs/FIRMWARE_BRIDGE_SPECIFICATION.md`, `denarixx/docs/FIRST_BOOT_PROVISIONING_GUIDE.md`, `denarixx/docs/EVT_TEST_PLAN.md`, `denarixx/docs/DEPLOYMENT_PIPELINE_SPECIFICATION.md`

## Phase 5: Project Integration & Production Readiness

**Status:** ✅ COMPLETE — Production Prototype Ready

### What was audited and fixed

- **ENGINE_AUDIT.md** — All 142 engines verified. Zero dead code, zero duplicate responsibilities. 4 Phase 6 EVT tooling engines correctly test-only. No placeholder imports.
- **API_AUDIT.md** — All 30 API routes verified: connected to UI, connected to engines, error handling, type safety. One bug fixed (admin page).
- **UI_AUDIT.md** — All 30 pages audited: buttons, toggles, persistence, live dashboards. One bug fixed.
- **TEST_AUDIT.md** — 36 test files, 3,244+ tests, all passing, all behavioural (zero placeholder tests).
- **END_TO_END_VALIDATION.md** — Full power-on → boot → guardian → navigate → obstacle → offline → language → privacy → memory → emergency alert → shutdown simulation. 10/10 steps pass. All 8 safety rules verified.
- **PERFORMANCE_REPORT.md** — Bundle sizes all < 250 kB First Load JS. Alert latency ~50 ms (budget: 500 ms). Critical bypass latency ~5 ms (budget: 200 ms).

### Bug fixed

- `denarixx/src/app/admin/page.tsx` — JSON parse error on startup. Added `safeFetch()` helper that checks `r.ok` and catches all errors before calling `.json()`. Admin page now renders gracefully (shows `…` placeholders) if any API is not yet ready.

### New files

- `denarixx/docs/ENGINE_AUDIT.md`
- `denarixx/docs/API_AUDIT.md`
- `denarixx/docs/UI_AUDIT.md`
- `denarixx/docs/TEST_AUDIT.md`
- `denarixx/docs/END_TO_END_VALIDATION.md`
- `denarixx/docs/PERFORMANCE_REPORT.md`

### Statistics (Phase 5 final)

| Metric | Value |
|---|---|
| Engines | 142 |
| API routes | 30 |
| Pages | 30 |
| Test files | 36 |
| Tests | 3,244+ |
| TypeScript errors | 0 |
| Bugs found | 1 (fixed) |
| Overall completion | 91% (30/33 sprints) |
| Status | **Production Prototype Ready** |

### Run commands (Phase 5 docs)
- `cat denarixx/docs/ENGINE_AUDIT.md` — engine audit
- `cat denarixx/docs/API_AUDIT.md` — API audit
- `cat denarixx/docs/UI_AUDIT.md` — UI audit
- `cat denarixx/docs/TEST_AUDIT.md` — test audit
- `cat denarixx/docs/END_TO_END_VALIDATION.md` — E2E validation
- `cat denarixx/docs/PERFORMANCE_REPORT.md` — performance report

# Denarixx Vision AI

An assistive AI perception platform for blind and visually impaired users.
Provides real-time hazard awareness, scene understanding, spatial intelligence, and audio guidance.

> **Assistive support only. Not medically certified. Always use your own judgement.**

---

## Prototype Baseline

**DENARIXX_VISION_PROTOTYPE_BASELINE=v0.1.0**

This is a software prototype, not a consumer or production release.

---

## Actual Project Scale (verified 2026-07-10)

| Item | Count |
|---|---|
| Pages (`page.tsx`) | 30 |
| API routes (`route.ts`) | 30 |
| Engine files | 152 |
| Hooks | 11 |
| Test suites | 39 |
| Total tests | 3,096+ |
| Docs | 65 |
| UI Components | 20 |

---

## Implementation Status

### REAL AND CONNECTED
- Alert quality engine (dedup, directional wording, confidence hedging)
- 7-level alert coordination priority queue (vision / OCR / nav / companion / system)
- Network events (`window` online/offline) → automatic provider switching
- Web Speech API TTS (browser)
- Web Speech API STT (browser, where supported)
- Browser DeviceMotion / DeviceOrientation (IMU, compass)
- Browser Geolocation API (GPS)
- Browser Battery API
- `navigator.vibrate` haptics
- OCR via Tesseract.js (when enabled in settings)
- Guardian + hazard detection (fully local — no cloud required)

### REAL BUT ENVIRONMENT-DEPENDENT
- Cloud vision (OpenAI gpt-4o, Gemini 1.5 flash) — requires API key
- Live camera feed — requires browser `getUserMedia` permission
- Local TFJS COCO-SSD — requires browser with WASM/WebGL

### SIMULATED
- Glasses hardware (cameras, bone-conduction audio, haptic actuators)
- Edge compute module inference
- Vision detections in simulation mode
- Navigation map tiles and routing
- Battery / thermal readings when hardware API is unavailable

### HARDWARE PLACEHOLDER (HAL implemented, hardware not connected)
- `glassesCameraEngine.ts` — 4-camera HAL
- `hardwareBridgeEngine.ts` — I/O routing HAL
- `denarixxGlassesEngine.ts` — device profile + state machine
- `hardwarePrototypeEngine.ts` — prototype mode classification
- `powerManagementEngine.ts` — battery / thermal HAL
- `audioWearableEngine.ts` — bone-conduction HAL
- `hapticWearableEngine.ts` — haptic actuator HAL

### NOT VALIDATED (requires physical users or hardware)
- Real-user safety validation (pilot testing not yet completed)
- Bone-conduction audio intelligibility
- Haptic pattern recognition in real conditions

---

## Glasses-First Architecture

```
Denarixx Vision Glasses (primary)
  └── glasses camera (front + peripheral)
  └── glasses compute module (local Guardian, local inference)
  └── bone-conduction audio
  └── haptic feedback

Phone / web UI (optional — development, diagnostics, caregiver settings only)
```

The Guardian, alert quality, alert coordination, and audio pipeline run entirely locally.
No cloud connection is required for safety-critical hazard detection.

See `docs/LIVE_RUNTIME_OWNERSHIP.md` for full pipeline ownership.

---

## Network & Provider Switching

| Event | Behavior |
|---|---|
| `window offline` | Immediate switch to simulation; announces once |
| Weak connection (2G / <150Kbps) | Pause cloud; announce once; local safety continues |
| `window online` | Cloud health check → restore only if check passes |
| Cloud health check fails | Stay on simulation; log error; no re-announcement |
| Critical alert | Never waits for cloud — fires from local Guardian |

---

## How to Run

```bash
# Replit — just start the "Start application" workflow. No setup required.

# Local
cp .env.example .env.local
npm install --ignore-scripts
npm run dev   # from denarixx/
```

Open http://localhost:3000. No API keys needed — simulation mode by default.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SESSION_SECRET` | — | Session signing secret |
| `VISION_PROVIDER` | `simulation` | `simulation` \| `openai` \| `gemini` \| `local` |
| `OPENAI_API_KEY` | — | Required when `VISION_PROVIDER=openai` |
| `GEMINI_API_KEY` | — | Required when `VISION_PROVIDER=gemini` |
| `DENARIXX_VISION_PROTOTYPE_BASELINE` | `v0.1.0` | Baseline marker |

---

## Key Documents

| Document | Description |
|---|---|
| `docs/LIVE_RUNTIME_OWNERSHIP.md` | Runtime orchestrator, pipeline ownership, glasses-first architecture |
| `docs/PHYSICAL_PROTOTYPE_SOFTWARE_BASELINE.md` | v0.1.0 baseline definition |
| `docs/PROTOTYPE_READINESS_REPORT.md` | READY / PARTIAL / BLOCKED readiness per subsystem |
| `docs/LIVE_PIPELINE_WIRING_AUDIT.md` | Full pipeline audit and latency budget |
| `docs/LIVE_ACCESSIBILITY_VALIDATION.md` | Accessibility requirements validation |
| `docs/HARDWARE_PROTOTYPE_SPEC.md` | Physical hardware specification |

---

## Test Suites

```bash
cd denarixx
npm test                                                 # V1 core       — 24
npx tsx tests/cognitiveGuardian.test.ts                  # V2            — 37
npx tsx tests/guardianAlertQuality.test.ts               # Sprint 5      — 60
npx tsx tests/v3reasoning.test.ts                        # V3            — 27
npx tsx tests/voiceCompanion.test.ts                     # V5            — 72
npx tsx tests/spatial.test.ts                            # V6            — 86
npx tsx tests/sensorFusion.test.ts                       # V7            — 69
npx tsx tests/hardwareBridge.test.ts                     # V8            — 97
npx tsx tests/humanBehaviour.test.ts                     # V9            — 134
npx tsx tests/mobileReadiness.test.ts                    # V10           — 47
npx tsx tests/pilotTesting.test.ts                       # V11           — 117
npx tsx tests/visionPipeline.test.ts                     # V12           — 148
npx tsx tests/navigationEngine.test.ts                   # V13           — 151
npx tsx tests/multiCameraSupport.test.ts                 # V14           — 164
npx tsx tests/onDeviceAI.test.ts                         # V15           — 170
npx tsx tests/denarixxGlassesPrototype.test.ts           # V16           — 176
npx tsx tests/fieldTrial.test.ts                         # V17           — 161
npx tsx tests/manufacturingReadiness.test.ts             # V18           — 144
npx tsx tests/longTermMemory.test.ts                     # Sprint 8      — 100
npx tsx tests/explainableAI.test.ts                      # Sprint 9      — 90
npx tsx tests/companionPersonality.test.ts               # Sprint 10     — 92
npx tsx tests/accessibilityEngine.test.ts                # Sprint 11     — 127
npx tsx tests/privacyDashboard.test.ts                   # Sprint 12     — 103
npx tsx tests/languageEngine.test.ts                     # Sprint 13     — 118
npx tsx tests/offlineEngine.test.ts                      # Sprint 14     — 152
npx tsx tests/streetSafety.test.ts                       # Sprint 15     — 143
npx tsx tests/glassesRuntime.test.ts                     # Sprint 16     — 160
npx tsx tests/hardwareAbstraction.test.ts                # Sprint 17     — 161
npx tsx tests/glassesSimulator.test.ts                   # Sprint 18     — 127
npx tsx tests/hardwareSpecification.test.ts              # Sprint 19     — 48
npx tsx tests/prototypeIntegration.test.ts               # Sprint 20     — 75
npx tsx tests/livePerceptionE2E.test.ts                  # Sprint 23     — 96
npx tsx tests/realPerception.test.ts                     # Sprint 22     — 146
npx tsx tests/visionProvider.test.ts                     # Sprint 4      — 72
npx tsx tests/networkProviderSwitching.test.ts           # Network       — 10
npm run type-check                                       # 0 errors
npm run build                                            # ✓ Compiled
```

---

## Safety Constraints (hardcoded OFF)

- `FACE_RECOGNITION_ENABLED=false`
- `EMERGENCY_STREAMING_ENABLED=false`
- Crossing guidance: never "safe to cross" — "appears clear, but please check carefully"

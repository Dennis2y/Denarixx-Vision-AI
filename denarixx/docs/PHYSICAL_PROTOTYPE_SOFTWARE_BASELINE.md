# Physical Prototype Software Baseline

**DENARIXX_VISION_PROTOTYPE_BASELINE=v0.2.0-hardware-bringup**  
**Date:** 2026-07-10  
**Status:** Hardware Bring-Up — Not a consumer or production release

---

## Baseline Identity

| Field | Value |
|---|---|
| Baseline name | DENARIXX_VISION_PROTOTYPE_BASELINE |
| Version | v0.2.0-hardware-bringup |
| Git commit | Run `git -C denarixx rev-parse HEAD` to get the current hash |
| Branch | main |
| Purpose | Hardware bring-up baseline — embedded runtime, adapters, local inference, HILT |

---

## Required Runtime Modules

These modules must be present and passing for the prototype to be considered at baseline:

| Module | Test file | Tests |
|---|---|---|
| V1 Core Engine | `tests/engines.test.ts` | 24 |
| V2 Cognitive Guardian | `tests/cognitiveGuardian.test.ts` | 37 |
| Sprint 5 Alert Quality | `tests/guardianAlertQuality.test.ts` | 60 |
| V3 Cognitive Reasoning | `tests/v3reasoning.test.ts` | 27 |
| V5 Voice Companion | `tests/voiceCompanion.test.ts` | 72 |
| V6 Spatial Intelligence | `tests/spatial.test.ts` | 86 |
| V7 Sensor Fusion | `tests/sensorFusion.test.ts` | 69 |
| V8 Hardware Bridge | `tests/hardwareBridge.test.ts` | 97 |
| V9 Human Behaviour | `tests/humanBehaviour.test.ts` | 134 |
| V12 Vision Pipeline | `tests/visionPipeline.test.ts` | 148 |
| V13 Navigation | `tests/navigationEngine.test.ts` | 151 |
| Sprint 14 Offline | `tests/offlineEngine.test.ts` | 152 |
| Sprint 15 Street Safety | `tests/streetSafety.test.ts` | 143 |
| Sprint 23 E2E | `tests/livePerceptionE2E.test.ts` | 96 |
| Network Provider Switching | `tests/networkProviderSwitching.test.ts` | 10 |

Run all: `cd denarixx && npm test` (V1) then run individual sprint tests.

---

## Complete Embedded ONNX Runtime Wiring (post-v0.2.0)

Added as a follow-on to the Embedded Runtime Reality Check bring-up program:

| Component | File | Description |
|---|---|---|
| Async processFrame | `src/runtime/embeddedVisionRuntime.ts` | processFrame now async; routes embedded-prototype mode through `provider.runInference(frame)` |
| Provider in boot | `src/runtime/startPrototypeRuntime.ts` | BootSequenceOutcome includes provider; runOneTick async; startPrototypeRuntime awaits `provider.initialize()` |
| Local inference clarification | `src/engines/localInferenceEngine.ts` | `runLocalInference` documented as simulation/test ONLY; embedded mode uses LocalInferenceProvider |
| ONNX environment check | `scripts/check-onnx.ts` | Reports runtime installed/missing, model found/missing, model load result |
| Pipeline integration tests | `tests/embeddedRuntime.integration.test.ts` | Section 5: 13 embedded pipeline tests (null pixel camera, provider→Guardian, EmbeddedSimulatedDetectionError, shutdown, emergency stop, network independence, etc.) |
| Env vars documented | `.env.example` | DENARIXX_HAL_ADAPTER and DENARIXX_LOCAL_MODEL_PATH added with descriptions |
| Optional dependency | `package.json` | onnxruntime-node declared as optionalDependencies |

**Safety invariants confirmed:**
1. Embedded-prototype mode NEVER falls back to simulation (EmbeddedSimulationFallbackError)
2. isSimulated detections in embedded mode always throw EmbeddedSimulatedDetectionError
3. Camera without pixel bytes → announces "Local vision is unavailable" — never fabricates
4. No ONNX provider → announces "Local vision is unavailable" — never fabricates
5. Network offline → local inference runs normally (independence confirmed)

---

## Bring-Up Program Additions (v0.2.0)

| Component | File | Description |
|---|---|---|
| Hardware profile | `config/prototype-hardware-profile.json` | Machine-readable target hardware spec |
| Hardware profile doc | `docs/FIRST_PHYSICAL_PROTOTYPE_PROFILE.md` | Human-readable hardware profile |
| Local inference types | `src/types/localInference.ts` | Capability honesty model, adapter types |
| Local inference engine | `src/engines/localInferenceEngine.ts` | Real embedded inference path (not simulation) |
| Hardware button engine | `src/engines/hardwareButtonEngine.ts` | Button events, emergency stop, voice-first |
| Sensor calibration engine | `src/engines/sensorCalibrationEngine.ts` | First-boot and maintenance calibration |
| Hardware output test engine | `src/engines/hardwareOutputTestEngine.ts` | Audio + haptic bring-up test flows |
| HILT test harness engine | `src/engines/hiltTestHarnessEngine.ts` | 12 HILT scenarios, metric recording |
| Adapter types | `src/runtime/adapters/hardwareAdapterTypes.ts` | Composite adapter interface |
| Simulation adapter | `src/runtime/adapters/simulationTestAdapter.ts` | CI / test — all inputs synthetic |
| Browser development adapter | `src/runtime/adapters/browserDevelopmentAdapter.ts` | Phone/laptop browser APIs |
| Embedded prototype adapter | `src/runtime/adapters/embeddedPrototypeAdapter.ts` | Physical HAL stubs (I2C, SPI, V4L2, ALSA, GPIO) |
| Embedded vision runtime | `src/runtime/embeddedVisionRuntime.ts` | Headless runtime — no browser, no React |
| Runtime entry point | `src/runtime/startPrototypeRuntime.ts` | Boot sequence + processing loop |
| HILT test plan | `docs/HARDWARE_IN_THE_LOOP_TEST_PLAN.md` | 12 supervised engineering test plans |
| Bring-up tests | `tests/hardwareBringup.test.ts` | 14 behavioral tests (all mocked) |

Run bring-up tests: `cd denarixx && npx tsx tests/hardwareBringup.test.ts`

---

## Optional Modules (Enhancement Only)

| Module | Purpose | Dependency |
|---|---|---|
| Gemini / OpenAI provider | Cloud vision enhancement | `GEMINI_API_KEY` or `OPENAI_API_KEY` |
| OCR (Tesseract.js) | Sign / label reading | Camera + browser |
| STT (Web Speech API) | Voice commands | Browser / OS |
| Caregiver UI (`/devices`, `/pilot`, `/field-trials`) | Remote diagnostics | Phone companion |
| GPS navigation | Outdoor turn-by-turn | GPS hardware |

---

## Environment Variables

| Variable | Default | Required | Description |
|---|---|---|---|
| `SESSION_SECRET` | — | Yes | Session signing secret (server) |
| `VISION_PROVIDER` | `simulation` | No | `simulation` \| `openai` \| `gemini` \| `local` |
| `OPENAI_API_KEY` | — | No | Cloud vision (OpenAI gpt-4o) |
| `GEMINI_API_KEY` | — | No | Cloud vision (Gemini 1.5 flash) |
| `DENARIXX_VISION_PROTOTYPE_BASELINE` | `v0.2.0-hardware-bringup` | Recommended | Baseline marker for firmware/software pairing |
| `DENARIXX_HAL_ADAPTER` | `simulation-test` | No | `simulation-test` \| `browser-development` \| `embedded-prototype` |
| `DENARIXX_LOCAL_MODEL_PATH` | — | Embedded only | Path to ONNX/TFLite model on compute module flash |
| `FACE_RECOGNITION_ENABLED` | `false` | Fixed | Always false — privacy constraint |
| `EMERGENCY_STREAMING_ENABLED` | `false` | Fixed | Always false — privacy constraint |

---

## Local / Cloud Provider Behavior

### Offline (no internet)
- Vision: simulation provider (synthetic detections)
- Guardian: fully active — all hazard detection, alert quality, coordination
- Audio: bone-conduction or speaker — all announcements continue
- Haptics: continue uninterrupted
- Navigation: last known route continues (offline segments)
- OCR: Tesseract.js local (if loaded)
- Announcement: "Internet is unavailable. Offline safety mode is active."

### Weak connection
- Vision: simulation provider (cloud paused)
- Guardian: fully active
- Announcement: "Connection is weak. Local safety remains active."

### Online (cloud available)
- Vision: configured provider (simulation / openai / gemini / local)
- Cloud health check on reconnection before restoring cloud enhancement
- Guardian and local safety always remain active regardless of cloud status
- Announcement on restore: "Online enhancement has returned."

---

## Hardware Interfaces

| Interface | Prototype Status | HAL File |
|---|---|---|
| Front camera | Simulated / browser `getUserMedia` | `glassesCameraEngine.ts` |
| Peripheral cameras (×3) | Simulated | `glassesCameraEngine.ts` |
| Bone-conduction audio | Simulated via Web Audio API / browser TTS | `audioWearableEngine.ts` |
| Haptic actuator | Simulated via `navigator.vibrate` | `hapticWearableEngine.ts` |
| IMU / accelerometer | Browser DeviceMotion API | `useDeviceSensors.ts` |
| Compass / magnetometer | Browser DeviceOrientation API | `useDeviceSensors.ts` |
| GPS | Browser Geolocation API | `useDeviceSensors.ts` |
| Battery monitor | Browser Battery API | `useDeviceSensors.ts` |
| Compute module bridge | Placeholder (`hardwarePrototypeEngine.ts`) | `hardwareBridgeEngine.ts` |
| Thermal sensor | Simulated | `powerManagementEngine.ts` |

---

## Test Commands

```bash
# Full baseline test run
cd denarixx
npm test                                                    # V1 core (24)
npx tsx tests/cognitiveGuardian.test.ts                     # V2 (37)
npx tsx tests/guardianAlertQuality.test.ts                  # Sprint 5 (60)
npx tsx tests/v3reasoning.test.ts                           # V3 (27)
npx tsx tests/voiceCompanion.test.ts                        # V5 (72)
npx tsx tests/spatial.test.ts                               # V6 (86)
npx tsx tests/sensorFusion.test.ts                          # V7 (69)
npx tsx tests/hardwareBridge.test.ts                        # V8 (97)
npx tsx tests/humanBehaviour.test.ts                        # V9 (134)
npx tsx tests/visionPipeline.test.ts                        # V12 (148)
npx tsx tests/navigationEngine.test.ts                      # V13 (151)
npx tsx tests/offlineEngine.test.ts                         # Sprint 14 (152)
npx tsx tests/streetSafety.test.ts                          # Sprint 15 (143)
npx tsx tests/livePerceptionE2E.test.ts                     # Sprint 23 E2E (96)
npx tsx tests/networkProviderSwitching.test.ts              # Network switching (10)

# TypeScript check
npm run type-check

# Production build
npm run build
```

---

## Known Limitations

1. **No physical hardware connected** — all cameras, haptics, and bone-conduction audio use browser/simulation APIs. The HAL layer (`hardwareBridgeEngine.ts`, `denarixxGlassesEngine.ts`) is architecture-complete but not connected to real hardware.
2. **Vision is simulated by default** — real AI requires a cloud API key (`GEMINI_API_KEY` or `OPENAI_API_KEY`).
3. **Local TFJS inference (COCO-SSD)** — runs in browser, 80-class object detection only. No custom hazard models loaded.
4. **OCR requires Tesseract.js** — loads in-browser (~15 MB). Not loaded until OCR mode enabled.
5. **Navigation is indoor/outdoor simulation** — no live map tile integration.
6. **Pilot and field trial data is in-memory** — lost on server restart.
7. **No firmware bridge** — `hardwarePrototypeEngine.ts` is a HAL stub; no actual SPI/I2C/USB communication.
8. **Phone dependency not fully eliminated** — the glasses compute module target is defined in architecture; the browser runtime (Next.js) still runs on a phone/laptop in this prototype.
9. **Battery and thermal management** — simulated values, not from real hardware sensors.

---

## What Is Real vs. Simulated

### REAL AND CONNECTED
- Alert quality engine (dedup, directional wording, human phrasing)
- 7-level alert coordination priority queue
- Web Speech API TTS (browser)
- Web Speech API STT (browser, where supported)
- Browser DeviceMotion / DeviceOrientation (IMU, compass)
- Browser Geolocation API (GPS)
- Browser Battery API
- `navigator.vibrate` haptics
- `navigator.onLine` + `window` online/offline events
- Network event → provider switch logic
- OCR via Tesseract.js (when enabled)

### REAL BUT ENVIRONMENT-DEPENDENT
- Cloud vision (OpenAI / Gemini) — requires API key in environment
- Live camera feed — requires `getUserMedia` permission
- Local TFJS COCO-SSD — requires browser with WASM/WebGL

### SIMULATED
- Glasses hardware (cameras, bone-conduction, haptics)
- Compute module (edge inference pipeline)
- Thermal sensor
- Battery readings (when Battery API unavailable)
- Vision detections in simulation mode
- Navigation map tiles and routing

### HARDWARE PLACEHOLDER (HAL IMPLEMENTED, HARDWARE NOT CONNECTED)
- `glassesCameraEngine.ts` — camera HAL
- `hardwareBridgeEngine.ts` — I/O routing HAL
- `denarixxGlassesEngine.ts` — device profile and state machine
- `hardwarePrototypeEngine.ts` — prototype mode classification
- `powerManagementEngine.ts` — battery/thermal HAL
- `audioWearableEngine.ts` — bone-conduction HAL
- `hapticWearableEngine.ts` — haptic actuator HAL

### NOT VALIDATED (requires physical users or hardware)
- Real-user safety validation
- Bone-conduction audio intelligibility
- Haptic pattern recognition
- Physical ergonomics and wear comfort
- Real-world latency under field conditions

---

## Rollback Procedure

```bash
# 1. Identify the last known-good baseline commit
git log --oneline -20

# 2. Restore to that commit (creates a new branch — does not force-push main)
git checkout -b rollback/<commit-short> <commit-hash>

# 3. Delete stale Next.js cache and restart
rm -rf denarixx/.next
# Restart "Start application" workflow in Replit

# 4. Verify baseline tests pass
cd denarixx && npm test && npx tsx tests/livePerceptionE2E.test.ts
```

---

## Baseline Marker

This baseline is tagged in `.env.example`:

```
DENARIXX_VISION_PROTOTYPE_BASELINE=v0.2.0-hardware-bringup
```

Future software releases that run on the physical prototype must update this value and create a new baseline document.

> **Note (2026-07-10):** The Guardian decision pipeline runs locally. Embedded hazard perception
> requires a successfully loaded ONNX model, real camera frames and validated target hardware.
> Development mode may use simulation. Embedded real-user mode must never switch to synthetic detections.

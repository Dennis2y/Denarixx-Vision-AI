# Live Runtime Ownership

**Status: Authoritative**  
**Baseline: DENARIXX_VISION_PROTOTYPE_BASELINE=v0.2.0-hardware-bringup**

---

## Runtime Orchestrators

There are now **two** runtime orchestrators. They serve different deployment contexts and must not be confused.

---

### 1. `useVisionSession.ts` — Browser Orchestrator (phone / laptop / caregiver UI)

**`useVisionSession.ts` is the active browser runtime orchestrator.**

This is the single source of truth for the live perception pipeline running in a browser. Every sensor reading, vision frame, audio output, and network event flows through this React hook. It is not a UI helper — it is the browser-side pipeline controller.

---

### 2. `src/runtime/embeddedVisionRuntime.ts` — Embedded Glasses Runtime (compute module)

**`embeddedVisionRuntime.ts` is the headless runtime for the glasses compute module.**

Entry point: `src/runtime/startPrototypeRuntime.ts`  
No React, no browser APIs, no Next.js. Uses the same domain engines as `useVisionSession.ts` — no duplication. Selected via `DENARIXX_HAL_ADAPTER` environment variable.

Hardware adapters:
- `simulationTestAdapter.ts` — CI / unit tests
- `browserDevelopmentAdapter.ts` — phone/laptop browser
- `embeddedPrototypeAdapter.ts` — physical prototype hardware (I2C, SPI, V4L2, ALSA, GPIO)

---

## What `useVisionSession.ts` Owns (Browser Context Only)

| Stage | Engine | Status |
|---|---|---|
| Camera capture | `useCameraCapture` | Connected |
| Frame-rate control | `SensorFusionEngine.recommendedFrameInterval` | Connected |
| Vision inference | `/api/vision/analyze-frame` → `visionProviderFactory` | Connected |
| Local TFJS inference | `useLocalObjectDetection` (pushed via `setLocalDetections`) | Connected |
| Spatial analysis | `MobilityEngine` + `WorldModelEngine` | Connected |
| Scene description | `/api/scene/describe` | Connected |
| Hazard evaluation | `/api/hazards/evaluate` | Connected |
| Safety decision | `/api/safety/decide` | Connected |
| Alert quality | `AlertQualityEngine` | Connected |
| Alert coordination | `AlertCoordinationEngine` (7-level priority queue) | Connected |
| OCR pipeline | `reportOCRResult()` → `formatOCRAnnouncement` | Connected |
| Navigation ticks | `processNavigationTick` per frame | Connected |
| Failure monitoring | `detectActiveFailures` per frame | Connected |
| Network events | `window` online/offline → `networkMonitorEngine` + `connectivityFallbackEngine` | Connected |
| Provider switching | Automatic on offline/weak; cloud restored after health check | Connected |
| Audio output | `useAudioGuidance` via `speakCoordinated()` only | Connected |
| Haptic output | `useDeviceSensors.vibrate` | Connected |
| Memory recall | `/api/memory` per frame | Connected |
| Session start/stop | `/api/sessions/start`, `/api/sessions/end` | Connected |

---

## What `livePerceptionEngine.ts` Is

`livePerceptionEngine.ts` (Sprint 22) is a **domain reference pipeline** — a pure-TypeScript, testable description of the full camera-to-voice pipeline. It is:

- Fully testable in Node.js (no browser APIs)
- Used as the architecture reference and engine-integration test target
- **Not** the production runtime orchestrator

It does not run during a live session. `useVisionSession.ts` runs instead.

This is intentional. `livePerceptionEngine.ts` exists so pipeline logic can be validated in unit tests without a browser. `useVisionSession.ts` is where those same engines are wired to real camera, real audio, real sensors, and real network events.

---

## Glasses-First Operation

The target architecture is:

```
Denarixx Vision Glasses
  └── glasses camera (front + peripheral)
  └── glasses compute module (local Guardian, local inference)
  └── bone-conduction audio output
  └── haptic feedback
  └── optional: phone companion for cloud, diagnostics, caregiver UI
```

The phone / web UI is **optional** for:
- Development and simulation
- Cloud AI enhancement (Gemini / OpenAI)
- Caregiver settings and monitoring
- Firmware management
- Field trial feedback

The glasses compute module must maintain local safety (hazard detection, Guardian alerts, audio) without any phone or internet connection. `useVisionSession.ts` enforces this: when `navigator.onLine === false`, the session falls back to simulation/local-ai immediately — no cloud round-trip is attempted.

---

## Network & Provider Lifecycle

```
Session start
  └── check navigator.onLine
  └── register window online/offline event listeners

Online → Offline
  └── announce once: "Internet is unavailable. Offline safety mode is active."
  └── switch visionMode → simulation (immediate, in-frame)
  └── providerHealth.activeProvider = simulation
  └── critical alerts continue uninterrupted

Offline → Online
  └── announce once: "Online enhancement has returned."
  └── run cloud health check (POST /api/vision/analyze-frame)
  └── if health check passes → restore cloud provider
  └── if health check fails → remain on simulation, log error

Weak connection
  └── announce once: "Connection is weak. Local safety remains active."
  └── switch visionMode → simulation
  └── cloud paused until connection improves

Session stop
  └── remove event listeners (React useEffect cleanup)
  └── reset providerHealthRef
```

---

## Rule: One Audio Path

All spoken output — vision alerts, OCR announcements, navigation guidance, system messages, companion reassurance — flows through `speakCoordinated()`. No engine calls `speak()` directly. This is the 7-level `alertCoordinationEngine` priority queue guarantee.

---

## Rule: No Silent Failures

Network failures, camera disconnects, and provider errors are monitored in every frame via `detectActiveFailures()`. Each new failure type is announced exactly once per session transition via `buildSystemAlert()`. Resolved failures are cleared so they re-announce if they return.

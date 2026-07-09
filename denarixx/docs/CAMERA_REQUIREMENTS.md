# Camera Requirements — Denarixx Vision Glasses

**Revision:** Sprint 19
**Platform:** Denarixx V1 prototype

---

## 1. Camera Array Overview

Denarixx Vision Glasses use **4 cameras** as defined in Sprint 14 (Multi-Camera Smart Glasses Support) and Sprint 16 (Glasses Prototype).

| Camera | Position | Primary Role |
|---|---|---|
| `front-wide` | Front-centre | Primary hazard detection, scene understanding |
| `front-tele` | Front-centre (secondary) | Distance estimation, object detail |
| `side-left` | Left temple | Peripheral hazard awareness (left side) |
| `side-right` | Right temple | Peripheral hazard awareness (right side) |

HAL types defined in `src/types/hardware.ts` (V8) and `src/types/glasses.ts` (V14).

---

## 2. Front-Wide Camera (Primary)

| Attribute | Requirement | Source |
|---|---|---|
| Resolution | 12 MP (4032 × 3024) | Sprint 12 scene understanding |
| Video resolution | 1920 × 1080 @ 30 fps (guardian mode) | Sprint 12 |
| Low-light video | 1280 × 720 @ 15 fps (battery save) | Sprint 15 |
| Field of view | 120° (horizontal) | Sprint 14 `fieldOfViewEngine.ts` |
| FOV zone | `front` (primary) | Sprint 14 |
| Aperture | f/1.8 | Low-light performance |
| Sensor type | Sony IMX sensor or equivalent BSI CMOS | |
| Low-light min | Functional at ≥ 1 lux (with processing) | Sprint 18 fault: `low-light` |
| HDR | 3-frame HDR (on-ISP) | Outdoor/indoor transitions |
| EIS | Electronic Image Stabilisation (walking/running) | Sprint 7 motion states |
| Interface | MIPI CSI-2 (4-lane) | Sprint 17 |
| Fallback | → front-tele → side-left → side-right | Sprint 17 `cameraHAL.ts` |
| Max restarts | 3 before fallback switch | Sprint 17 |
| HAL driver | `cameraHAL.ts` — initializeCamera, captureFrame, restartCamera, activateFallbackCamera | Sprint 17 |

---

## 3. Front-Tele Camera (Secondary)

| Attribute | Requirement | Source |
|---|---|---|
| Resolution | 8 MP (3264 × 2448) | |
| Video resolution | 1280 × 720 @ 30 fps | |
| Field of view | 60° (horizontal, 2× optical equivalent) | Sprint 14 |
| FOV zone | `front` | Sprint 14 |
| Aperture | f/2.4 | |
| Sensor type | BSI CMOS | |
| Primary use | Distance estimation, pedestrian/vehicle detail | Sprint 12 depthReasoningEngine |
| Optical zoom | 2× optical | |
| Interface | MIPI CSI-2 (2-lane) | |
| Standby | Low-power standby when not used | Sprint 14/15 |

---

## 4. Side-Left Camera (Peripheral)

| Attribute | Requirement | Source |
|---|---|---|
| Resolution | 5 MP | |
| Video resolution | 1280 × 720 @ 15 fps | |
| Field of view | 160° (ultra-wide, peripheral awareness) | Sprint 14 |
| FOV zone | `peripheral-left` | Sprint 14 `fieldOfViewEngine.ts` |
| Aperture | f/2.2 | |
| Primary use | Left-side hazard detection, crossing safety | Sprint 5 Guardian |
| Interface | MIPI CSI-2 (2-lane) | |
| Standby | Active during navigation, sleep in static scenes | Sprint 15 |

---

## 5. Side-Right Camera (Peripheral)

| Attribute | Requirement | Source |
|---|---|---|
| Resolution | 5 MP | |
| Video resolution | 1280 × 720 @ 15 fps | |
| Field of view | 160° (ultra-wide, peripheral awareness) | Sprint 14 |
| FOV zone | `peripheral-right` | Sprint 14 |
| Aperture | f/2.2 | |
| Primary use | Right-side hazard detection, overtaking vehicles | Sprint 5 |
| Interface | MIPI CSI-2 (2-lane) | |
| Standby | Active during navigation, sleep in static scenes | Sprint 15 |

---

## 6. Multi-Camera Fusion

Defined in Sprint 14 (`multiCameraFusionEngine.ts`):

- **Detection fusion:** Detections from all active cameras are merged, de-duplicated by position and class.
- **FOV zone labelling:** Every detection is tagged with its FOV zone (`front`, `peripheral-left`, `peripheral-right`).
- **Priority:** `front` zone objects are prioritised for guardian alerts; `peripheral` zones provide situational awareness.
- **Bone-conduction guidance:** `fieldOfViewEngine.ts` translates FOV zone into directional speech (e.g., "obstacle on your left").

```
Camera array → glassesCameraEngine.ts → multiCameraFusionEngine.ts
                                               ↓
                                       FusedFrame (all detections, tagged by zone)
                                               ↓
                                       Guardian → Bone-conduction alert
```

---

## 7. Vision Pipeline Performance

From Sprint 12 (`visionInferenceEngine.ts`) and Sprint 15 (`edgeInferenceEngine.ts`):

| Mode | Frame rate | Latency budget |
|---|---|---|
| Full AI (mains/high battery) | 15 fps | ≤ 150 ms / frame |
| Balanced (60–80 % battery) | 10 fps | ≤ 200 ms / frame |
| Low-power (20–60 % battery) | 5 fps | ≤ 300 ms / frame |
| Emergency (< 20 % battery) | 2 fps | ≤ 500 ms / frame |

The NPU scheduler (`onDeviceAIEngine.ts`) selects the model and frame rate automatically based on battery, thermal, and connectivity state.

---

## 8. Privacy Requirements

- No video is stored without explicit user consent (Sprint 12 `consentManagementEngine.ts`).
- Frame processing is on-device only.
- Session recordings (pilot/field trials) require explicit consent per Sprint 11 and Sprint 17.
- Camera failure triggers an immediate bone-conduction alert: `CAMERA_FAILURE_MESSAGE` (Sprint 15 `streetSafetyEngine.ts`).

---

## 9. Camera Health Monitoring

`cameraHealthEngine.ts` (Sprint 14) monitors:

- Frame rate (expected vs actual)
- Frame confidence score
- Lens obstruction detection (score < 0.3 → alert)
- Temperature (camera module temp)
- Battery-aware fallback (reduce active cameras under low battery)

Digital Twin validation: `hardwareFaultEngine.ts` `injectPartialObstruction` and `injectLowLight` test graceful degradation.

---

## 10. Crossing Safety Rule

The Guardian never says "safe to cross" based on camera alone.  This is a hard-coded safety rule enforced across:

- `crossingDecisionEngine.ts` (Sprint 13)
- `offlineStreetGuardianEngine.ts` (Sprint 15)
- `localHazardPatternEngine.ts` (Sprint 15)
- `safetyValidationEngine.ts` (Sprint 17)

The camera provides hazard information; the crossing decision is always advisory.

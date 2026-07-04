# V14 — Multi-Camera Smart Glasses Support

## Overview

Phase 14 adds a multi-camera intelligence layer to Denarixx Vision AI. Smart glasses with multiple cameras (front, left peripheral, right peripheral, external) are managed through a unified fusion system that combines their detections, monitors health, handles failures safely, and routes guidance to downstream engines.

> **Simulation mode only.** No real Bluetooth/WebRTC camera streams are used in V14. All camera feeds, sensor readings, and latency values are simulated. Real hardware integration is planned for a future phase.

---

## Files Added

| File | Purpose |
|---|---|
| `src/types/glasses.ts` | All V14 types — separate from `src/types/hardware.ts` (V8) |
| `src/engines/glassesCameraEngine.ts` | Camera state management, connect/disconnect, health, simulation |
| `src/engines/cameraHealthEngine.ts` | Health monitoring, fallback logic, battery, safety guidance |
| `src/engines/fieldOfViewEngine.ts` | FOV zone classification, directional speech, peripheral warnings |
| `src/engines/multiCameraFusionEngine.ts` | Detection fusion, deduplication, priority ordering, fused frame |
| `src/engines/wearableSensorFusionEngine.ts` | IMU/compass/thermal/battery sensor frame, motion classification |
| `src/components/devices/MultiCameraPanel.tsx` | Live multi-camera panel added to /devices page |
| `tests/multiCameraSupport.test.ts` | Comprehensive engine tests |
| `docs/V14_MULTI_CAMERA_SMART_GLASSES_SUPPORT.md` | This file |

---

## Architecture

```
GlassesCameraEngine          ←─ Camera state, connect/disconnect, feed simulation
       │
       ├── CameraHealthEngine    ←─ Health monitoring, fallback, battery warnings
       ├── FieldOfViewEngine     ←─ Zone classification, directional instructions
       ├── MultiCameraFusionEngine ←─ Detection fusion, dedup, priority, fused frame
       └── WearableSensorFusionEngine ←─ IMU, compass, thermal, battery

FusedFrame output → Vision Inference · Spatial Reasoning · Cognitive Guardian ·
                    Navigation Intelligence · Audio Guidance
```

All engines are **pure functions** — no async, no I/O, fully testable.

---

## Camera Sources

| Position | Description | Default |
|---|---|---|
| `front` | Primary forward-facing camera | ✅ Connected |
| `left` | Left peripheral camera | Standby |
| `right` | Right peripheral camera | Standby |
| `external` | External clip-on wearable camera | Standby |
| `phone` | Phone camera fallback | Auto on glasses fail |

---

## Field of View Zones

| Zone | Trigger | Speech |
|---|---|---|
| `center` | Front camera, normalizedX 0.3–0.7 | "Car ahead." |
| `left` | Left camera, or front camera x < 0.3 | "Person on your left." |
| `right` | Right camera, or front camera x > 0.7 | "Bike on your right." |
| `overhead` | normalizedY < 0.2 | "Sign overhead." |
| `below` | normalizedY > 0.85 | "Step below — watch your step." |

---

## Camera Health States

| Status | Trigger | Usable |
|---|---|---|
| `active` | latency < 100ms, quality > 0.6 | ✅ Yes |
| `degraded` | latency 100–200ms or quality 0.3–0.6 | ✅ Yes (with warning) |
| `failed` | latency > 200ms or quality < 0.3 | ❌ No |
| `offline` | Not connected | ❌ No |
| `standby` | Connected but idle | ✅ Yes (after activation) |

---

## Fallback Logic

```
All glasses cameras failed or disconnected
  → applyPhoneFallback(): activeSource = 'phone'
  → Speech: "Glasses camera disconnected. Switched to phone camera."

No usable cameras at all (glasses AND phone):
  → "Vision input unavailable. Please stop and check carefully."
```

**Phone camera is always available as fallback** (matches V8 `hardwareBridgeEngine.ts` `phoneCameraFallback: true`).

---

## Detection Fusion

**Priority ordering:**
| Label | Priority |
|---|---|
| car, construction_barrier, stairs, crossing | high |
| person, bike, dog, wheelchair | medium |
| all others | low |

**Deduplication:** Objects with the same label within `deduplicationThreshold` (default 0.15) confidence of each other are merged — highest confidence wins.

**Fusion strategy:** `center_priority` — front/phone camera detections preferred for center FOV; left/right cameras for peripheral zones.

---

## Wearable Sensor Data

| Sensor | Classifies | Output |
|---|---|---|
| Accelerometer | Motion state | stationary / walking / running |
| Magnetometer | Compass heading | 0–360°, N/NE/E/SE/S/SW/W/NW |
| Temperature | Thermal state | normal / warm (38°+) / hot (45°+) |
| Battery | Warning threshold | 25% advisory / 15% low / 5% critical |

**Sensor-camera fusion:** If motion state is `running` and guidance text is present, prepends "Slow down."

---

## Integration Points

| Downstream Engine | Data Provided |
|---|---|
| Vision Inference Engine | `FusedFrame.detections` replaces single-camera detections |
| Spatial Reasoning Engine | `FovZone` for directional spatial placement |
| Cognitive Guardian Engine | `FusedFrame.guidanceText` for alert decisions |
| Navigation Intelligence | `WearableSensorFrame.magnetometer.heading` for compass |
| Audio Guidance | `buildDirectionalInstruction(zone, label)` for spatial speech |

---

## Privacy

| Guarantee | Status |
|---|---|
| No video storage | ✅ `CAMERA_PRIVACY.noVideoStorage: true` |
| No face recognition | ✅ `CAMERA_PRIVACY.noFaceRecognition: true` |
| No bystander identification | ✅ `CAMERA_PRIVACY.noBystander: true` |

Privacy constants are compile-time read-only — they cannot be overridden at runtime.

---

## What Is Simulated vs Real

| Feature | V14 Status |
|---|---|
| Camera state machine | ✅ Simulated |
| Feed health + latency | ✅ Simulated (sin-wave drift) |
| Detection fusion | ✅ Real logic, simulated detections |
| Fallback to phone | ✅ Logic implemented, simulated trigger |
| Wearable IMU/compass | ✅ Simulated values |
| Battery drain | ✅ Simulated (slow drain per tick) |
| Real Bluetooth streaming | ❌ Not integrated |
| Real WebRTC camera feed | ❌ Not integrated |
| Real USB/WiFi glasses | ❌ Not integrated |
| Traffic light colour detection | ❌ Not integrated |

---

## Future Integration

1. **WebBluetooth API** — connect to BLE glasses for real camera/IMU data
2. **WebRTC** — stream glasses camera feed into the V12 perception pipeline
3. **WebUSB** — USB tethered camera integration
4. **Device orientation API** — real compass heading from phone/glasses IMU (V7 `useDeviceSensors`)
5. **WebGL object detection** — on-glasses ONNX inference for reduced latency

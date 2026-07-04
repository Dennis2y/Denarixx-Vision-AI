# V16 — Denarixx Vision Glasses Hardware Prototype Layer

## Overview

Phase 16 creates the software-side hardware prototype specification and simulated hardware control layer for the **Denarixx Vision Glasses v1**. No physical manufacturing yet — this phase defines the interfaces, safety behaviors, and simulated state machines that a real prototype device will plug into.

> **Simulation mode only.** No real hardware is connected. All sensor readings, RSSI values, battery drain, and thermal states are simulated.

---

## Files Added

| File | Purpose |
|---|---|
| `src/types/denarixxGlasses.ts` | All V16 types — `HardwareMode`, `ComponentStatus`, `DenarixxGlassesState`, `GlassesDeviceProfile`, `CameraModuleConfig`, `BoneAudioConfig`, `HapticConfig`, `PowerProfile`, `PhoneCompanionState`, `HardwarePrototypeSpec` + safety message constants |
| `src/engines/denarixxGlassesEngine.ts` | Device profile factory, connection state machine, health scoring, simulation tick |
| `src/engines/hardwarePrototypeEngine.ts` | Hardware mode classification, emergency fallback, subsystem health matrix, prototype spec, hardware bridge status |
| `src/engines/powerManagementEngine.ts` | Battery classification, thermal state, remaining time estimation, LiPo voltage curve, battery drain simulation |
| `src/engines/audioWearableEngine.ts` | Bone-conduction audio config, health assessment, audio output routing, haptic fallback logic, volume management |
| `src/engines/hapticWearableEngine.ts` | Haptic pattern library (8 patterns), health assessment, alert routing, intensity scaling, duration calculation |
| `src/components/devices/GlassesPrototypePanel.tsx` | Live panel in `/devices` — connect/disconnect, mode display, battery, thermal, camera modules, subsystem status, haptic preview, prototype spec |
| `tests/denarixxGlassesPrototype.test.ts` | Comprehensive engine tests |
| `docs/V16_DENARIXX_VISION_GLASSES_PROTOTYPE.md` | This file |
| `docs/HARDWARE_PROTOTYPE_SPEC.md` | MVP hardware specification |

---

## Architecture

```
DenarixxGlassesEngine       ← device profile, connection state, health score
         │
         ├── HardwarePrototypeEngine   ← mode classification, emergency fallback
         ├── PowerManagementEngine     ← battery, thermal, power profile
         ├── AudioWearableEngine       ← bone-conduction, fallback routing
         └── HapticWearableEngine      ← patterns, alert routing, intensity

Integration bridge:
  → Hardware Bridge Engine (V8)
  → Multi-Camera Fusion Engine (V14)
  → On-Device AI Engine (V15)
  → Cognitive Guardian Engine (V2)
  → Audio Guidance Engine
```

All engines are **pure functions** — no async, no I/O, fully testable.

---

## Hardware Modes

| Mode | Condition | Guidance |
|---|---|---|
| `phone_only` | Glasses disconnected | Hold phone at chest level |
| `glasses_assisted` | Connected, some subsystems reduced | Glasses supplementing phone |
| `glasses_primary` | Connected, all subsystems ok | Glasses are primary sensor |
| `degraded_safety` | Camera failed / battery critical / connection degraded | Proceed cautiously |
| `offline_safety` | Cloud + glasses unavailable | Extra caution, local only |

---

## Safety Messages (exact strings tested)

```
Disconnect:  "Vision glasses disconnected. Please stop and check carefully."
Battery:     "Glasses battery is critically low. Switch to phone mode."
Camera:      "Camera input failed. Local safety guidance may be limited."
Audio fail:  "Bone-conduction audio unavailable. Haptic alerts activated."
```

If audio fails → haptic fallback is triggered automatically.
If haptic also fails → audio-only mode continues, never silent failure.

---

## Camera Modules (Prototype v1)

| Position | Resolution | FOV | FPS | Depth |
|---|---|---|---|---|
| Front | 1920×1080 | 80° | 30 | No |
| Left | 1280×720 | 100° | 15 | No |
| Right | 1280×720 | 100° | 15 | No |
| Downward | 640×480 | 120° | 10 | Yes |

---

## Battery & Thermal

| Battery % | State | Action |
|---|---|---|
| >20% | Normal | No action |
| ≤20% | Low | Warning: switch to phone mode soon |
| ≤10% | Critical | Emergency: `BATTERY_CRITICAL_MESSAGE` + degrade mode |
| 0% | Empty | Phone-only mode |

| Temp | State | Action |
|---|---|---|
| <38°C | Normal | None |
| 38–42°C | Warm | Advisory |
| 42–47°C | Hot | Guidance displayed |
| ≥47°C | Throttling | AI processing reduced + warning |

---

## Haptic Pattern Library

| Alert | Intensity | Pattern | Duration |
|---|---|---|---|
| critical_hazard | 100% | 200+200+200ms × 3 | ~1.8s |
| high_hazard | 85% | 150+150ms × 2 | ~0.9s |
| medium_hazard | 70% | 100ms × 2 | 200ms |
| navigation_turn | 60% | 80+80ms × 1 | 360ms |
| crossing_warning | 90% | 100+300+100ms × 2 | ~1s |
| battery_low | 50% | 500ms × 1 | 500ms |
| disconnected | 80% | 200+200+200+200ms × 1 | 800ms |
| notification | 40% | 60ms × 1 | 60ms |

Battery-aware intensity scaling: ≤10% → 50%, ≤20% → 75%, else 100%.

---

## Integration Points

| Downstream | Data Provided |
|---|---|
| Hardware Bridge Engine (V8) | `buildHardwareBridgeStatus()` — visionSource, audioOutput, hapticOutput, processingMode |
| Multi-Camera Fusion Engine (V14) | Camera module config per position; health status gating |
| On-Device AI Engine (V15) | Battery → `BatteryMode`; thermal → throttle inference |
| Cognitive Guardian Engine (V2) | Hardware mode → affects alert cadence |
| Audio Guidance Engine | `selectAudioOutput()` — bone_conduction / phone_speaker / haptic_only |
| Haptic System | `buildHapticPattern()`, `routeAlert()`, `scaleIntensityForBattery()` |

---

## What Is Simulated vs Real

| Feature | V16 Status |
|---|---|
| Device profile schema | ✅ Real spec |
| Connection state machine | ✅ Real logic |
| Hardware mode classification | ✅ Real logic |
| Emergency fallback routing | ✅ Real logic |
| Battery classification & warnings | ✅ Real logic |
| Thermal classification | ✅ Real logic |
| Haptic pattern library | ✅ Real patterns |
| Audio output routing | ✅ Real logic |
| Physical camera hardware | ❌ Simulated |
| Bluetooth LE pairing | ❌ Placeholder (Web Bluetooth API) |
| Wi-Fi Direct streaming | ❌ Placeholder |
| Bone-conduction driver | ❌ Simulated (phone speaker fallback) |
| Haptic motors | ❌ Simulated (phone vibration fallback) |
| Firmware OTA | ❌ Placeholder |
| Real battery API | ❌ Not wired (V7 `useDeviceSensors` available) |

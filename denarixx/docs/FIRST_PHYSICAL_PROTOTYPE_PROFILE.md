# First Physical Prototype Hardware Profile

**DENARIXX_VISION_PROTOTYPE_BASELINE=v0.2.0-hardware-bringup**  
**Revision:** P0 (Bring-Up)  
**Date:** 2026-07-10  
**Status:** Engineering bring-up — not a consumer or mass-production specification

> This document describes the target hardware profile for the first physical Denarixx Vision Glasses prototype.  
> No final component vendor has been selected. All part numbers are illustrative.  
> The software HAL is structured so that changing the physical component does not require changing the Guardian or AI engines.

---

## Design Principle

The glasses compute module is the **primary device**. A phone is **not required** for normal operation.

```
Camera × 4 (MIPI-CSI2)
    ↓
Compute Module (ARM64, embedded Linux)
    ↓ ONNX Runtime / TFLite / NPU SDK
Local Object Detection (real inference — not simulation)
    ↓
Cognitive Guardian
    ↓
Alert Coordination Queue (7-level priority)
    ↓
Bone-Conduction Audio + Haptic Motor
```

Cloud AI and phone companion are **optional enhancements only**.

---

## Compute

| Field | Value |
|---|---|
| OS | Linux (Yocto minimal rootfs or Raspberry Pi OS Lite 64-bit) |
| CPU Architecture | ARM64 (aarch64) |
| Example SoC | Rockchip RK3588S, Raspberry Pi CM4, or equivalent (vendor TBD) |
| CPU Cores | 4 |
| Clock Speed | ≥ 1.5 GHz sustained |
| NPU (optional) | 4 TOPS — RKNN or vendor NPU SDK |
| RAM | 4 GB LPDDR4X |
| Storage | 32 GB eMMC 5.1 |
| TDP (target) | ≤ 3 W sustained at full Guardian + inference load |

**NPU is optional for P0 bring-up.** CPU inference via ONNX Runtime is the fallback if the NPU driver is unavailable.

---

## Cameras

| Field | Value |
|---|---|
| Count | 4 |
| Interface | MIPI-CSI2 (2-lane per camera) |
| Positions | Front-center (primary), Side-left, Side-right, Downward-left |
| Inference resolution | 640 × 480 @ 15 fps |
| Scene resolution | 1280 × 720 @ 30 fps |
| FoV | Front: 90°, Side: 120°, Downward: 100° |
| Minimum viable | Front camera alone (single-camera bring-up mode) |

The front camera is the primary safety sensor. Side and downward cameras are enhancement only.

---

## Microphone

| Field | Value |
|---|---|
| Type | MEMS digital PDM or I2S |
| Count | 2 (beamforming array) |
| Interface | I2S / PDM |
| Purpose | Wake word detection ("Hey Aria"), voice commands |

Single-mic is acceptable for P0 bring-up. Dual-mic beamforming is the target.

---

## Audio Output

| Field | Value |
|---|---|
| Type | Bone-conduction transducer |
| Interface | I2S codec → Class-D amplifier |
| Channels | 1 (mono) |
| Sample rate | 16 kHz (speech) |
| Fallback | 3.5 mm wired jack (P0 engineering use) |

Bone-conduction is the primary output for ambient-aware, non-isolating audio.  
**Do not rely on bone-conduction intelligibility until tested on physical hardware with real users.**

---

## Haptic

| Field | Value |
|---|---|
| Type | ERM (Eccentric Rotating Mass) or LRA (Linear Resonant Actuator) |
| Interface | PWM or I2C haptic driver IC (DRV2605L or equivalent) |

### Defined Haptic Patterns

| Pattern | Meaning |
|---|---|
| `stop-immediately` | Critical hazard — stop now |
| `hazard-left` | Hazard detected to the left |
| `hazard-right` | Hazard detected to the right |
| `obstacle-ahead` | Obstacle directly ahead |
| `device-failure` | Hardware fault detected |
| `low-battery` | Battery critically low |

LRA is preferred for precise pattern timing. PWM fallback for P0.

**Do not rely on haptic patterns alone for complex safety instructions.**

---

## IMU

| Field | Value |
|---|---|
| Type | 6-DOF (accel + gyro) or 9-DOF (+ magnetometer) |
| Interface | SPI or I2C |
| Example part | ICM-42688-P, LSM6DSO, or equivalent (vendor TBD) |
| Output rate | 100 Hz |

Separate magnetometer chip recommended for heading accuracy.

---

## GNSS

| Field | Value |
|---|---|
| Type | GNSS (GPS + GLONASS minimum) |
| Interface | UART (NMEA 0183) |
| Cold fix time | ≤ 60 s |
| Accuracy | ≤ 2.5 m CEP |
| P0 status | Optional — not required for indoor bring-up |

GNSS is required for outdoor navigation. Indoor bring-up can proceed without it.

---

## Connectivity

| Interface | Specification |
|---|---|
| Wi-Fi | 802.11ac (Wi-Fi 5) minimum, 802.11ax (Wi-Fi 6) preferred |
| Bluetooth | BT 5.2 (BLE + A2DP) |
| LTE/eSIM | Optional M.2 modem slot — not populated in P0 |

---

## Battery

| Field | Value |
|---|---|
| Chemistry | LiPo |
| Capacity | 1200 mAh |
| Monitoring IC | I2C fuel gauge (MAX17048, BQ27220, or equivalent) |
| Provides | Voltage, SoC %, estimated time remaining |
| Expected runtime (full) | ~3 hours |
| Expected runtime (Guardian only) | ~6 hours |

### Battery Thresholds

| Level | Percentage |
|---|---|
| Low | 20% |
| Critical | 10% |
| Emergency (stop soon) | 5% |

---

## Thermal

| Field | Value |
|---|---|
| Sensor | I2C temperature sensor (TMP117, NCT7751, or equivalent) |
| Warn threshold | 70°C |
| Throttle threshold | 80°C |
| Shutdown threshold | 90°C |

---

## Hardware Buttons

| Button | Position | Actions |
|---|---|---|
| Main | Right temple (top) | Single press: repeat last guidance; Long press: start/stop; Triple press: emergency stop |
| Volume Up | Right temple (mid-upper) | Increase audio level |
| Volume Down | Right temple (mid-lower) | Decrease audio level |

Interface: GPIO with hardware debounce (≥ 20 ms).  
All essential safety actions must work through voice, hardware button, or automatic startup — **no screen required**.

---

## HAL Adapter Selection

| Adapter | When Used |
|---|---|
| `browser-development` | Development on phone/laptop browser |
| `embedded-prototype` | Physical prototype hardware |
| `simulation-test` | CI, unit tests, no hardware |

Selected via `DENARIXX_HAL_ADAPTER` environment variable.  
The Guardian and navigation engines must not know which adapter is active.

---

## Local Inference Runtime Priority

When offline or when cloud AI is unavailable, the system tries in order:

1. **Real embedded local inference** — ONNX Runtime or TFLite on compute module CPU/NPU
2. **Degraded sensor-based guidance** — IMU + GPS heading only, no vision
3. **Explicit limited-function warning** — "Vision guidance is unavailable. Please stop and check carefully."

**Simulation is never step 4.** It is a development tool only.

---

## Detection Class Capabilities

| Class | Capability Level |
|---|---|
| person | model-supported |
| vehicle | model-supported |
| bicycle | model-supported |
| motorcycle | model-supported |
| obstacle | heuristic (geometry) |
| chair | model-supported |
| stairs | experimental — not validated |
| doorway | heuristic (edge pairs) |
| traffic-light | model-supported |
| construction-barrier | experimental |
| dog | model-supported |

**Do not claim reliable stair detection** until measured on physical hardware.

---

## Components Replaceable Without Engine Changes

- SoC vendor (ARM64 → ARM64, same OS ABI)
- Camera sensor (same MIPI-CSI2 lane interface)
- IMU vendor (same I2C/SPI register protocol)
- GNSS module (same UART NMEA interface)
- Haptic driver IC (same PWM/I2C protocol)
- Audio codec (same I2S interface)

Changing these requires driver updates only. The Guardian, navigation, and AI engines are unchanged.

---

## Machine-Readable Reference

See `config/prototype-hardware-profile.json` for the machine-readable version of this profile.

---

## What Is NOT Defined Here

- PCB layout or schematic
- Optics (lens focal length, IR cut filter spec)
- Mechanical housing or frame geometry
- Manufacturing partner or supply chain
- Regulatory certification (FCC, CE, etc.)

These are engineering design items beyond the software bring-up scope.

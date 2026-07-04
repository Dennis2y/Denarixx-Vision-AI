# Denarixx Vision Glasses — Hardware Prototype Specification

**Product:** Denarixx Vision Glasses v1  
**Phase:** Software Prototype (V16) — No physical manufacturing yet  
**Target:** Germany prototype build, Q2 2026  

---

## Executive Summary

The Denarixx Vision Glasses are an AI-powered wearable for blind and visually impaired users. They provide real-time hazard awareness, scene understanding, and audio/haptic guidance — independent of a held phone. The device pairs with the Denarixx Vision AI phone app via Bluetooth LE, extending the platform's sensor range and moving critical AI processing closer to the user.

---

## MVP Hardware Requirements

### Compute

| Component | Specification | Notes |
|---|---|---|
| Processor | Qualcomm AR2 / Snapdragon AR (TBD) | NPU required for on-device AI |
| RAM | 2 GB LPDDR5 | For V15 edge inference + OS |
| Storage | 8 GB eMMC | Offline model weights, firmware |
| AI Accelerator | Qualcomm Hexagon DSP / NPU | Targets <20ms inference per frame |
| OS | Android Glasses / AOSP | Or custom embedded Linux |

### Camera Requirements

| Camera | Position | Min Resolution | Min FPS | FOV |
|---|---|---|---|---|
| Primary | Front-center | 1920×1080 | 30 fps | ≥75° |
| Peripheral L | Left temple | 1280×720 | 15 fps | ≥90° |
| Peripheral R | Right temple | 1280×720 | 15 fps | ≥90° |
| Ground | Downward | 640×480 | 10 fps | ≥100° |

- **No local video storage** (privacy rule — see V11/V14 PRIVACY constants)
- Depth sensor on downward camera is preferred for stair/curb detection
- Low-light performance: min 0.1 lux for night/indoor use

### Battery Requirements

| Specification | Target |
|---|---|
| Capacity | 300 mAh (expandable to 500 mAh in v1.1) |
| Chemistry | LiPo, 1S |
| Operating life | ≥4 hours (glasses_primary mode) |
| Charging | USB-C PD, 5V/1A |
| Charging time | ≤90 minutes |
| Critical threshold | ≤10% triggers fallback to phone-only mode |
| Low threshold | ≤20% triggers audio warning |
| Operating range | 0°C to 45°C |

### Audio Requirements — Bone-Conduction

| Specification | Target |
|---|---|
| Driver type | Piezoelectric (preferred) or electromagnetic |
| Frequency range | 200 Hz – 8,000 Hz |
| Max output | 85 dB SPL |
| Volume steps | ≥16 software-controlled steps |
| Placement | Both temples, behind ear |
| Latency | <50ms audio path from trigger to emission |

Bone-conduction is mandatory — in-ear audio blocks ambient awareness and is unsafe for this use case.

### Haptic Requirements

| Specification | Target |
|---|---|
| Motor count | 2 (one per temple) |
| Motor type | ERM or LRA (LRA preferred for precision patterns) |
| Intensity control | 8-bit software control (0–100%) |
| Max pattern duration | 3,000 ms |
| Min pulse resolution | 10 ms |
| Battery scaling | Intensity reduces at ≤20% battery |

### Microphone Requirements

| Specification | Target |
|---|---|
| Channels | 2 (stereo, spatial voice processing) |
| Sample rate | 16,000 Hz (voice-optimized) |
| Noise cancellation | Required (wind/traffic noise) |
| Direction | Beamforming toward user's mouth |

### Connectivity

| Protocol | Purpose | Priority |
|---|---|---|
| Bluetooth 5.2 LE | Phone companion link (primary) | Required |
| Wi-Fi 6 Direct | High-bandwidth camera streaming (future) | Optional v1.1 |
| USB-C | Charging + debug | Required |

Bluetooth pairing: Web Bluetooth API (Chrome/Edge) — Android companion app for iOS.

### Weight & Form Factor

| Specification | Target |
|---|---|
| Total weight | ≤42g (frame + electronics) |
| Frame material | TR-90 nylon (lightweight, flexible) |
| IP rating | IPX4 (sweat and light rain resistant) |
| Operating temperature | 0°C – 40°C |
| Storage temperature | -20°C – 60°C |

---

## Smart-Glasses Integration Plan

### Phase 16 (Current — Software Prototype)
- Software-side hardware abstraction layer complete
- Simulated device profile, connection state machine, power management
- All safety fallback paths defined and tested (170 tests passing as of V15; V16 adds comprehensive tests)
- Integration bridge to V8 (Hardware HAL), V14 (Multi-Camera), V15 (Edge AI)

### Phase 17 (Hardware EVT — Engineering Validation)
- Procure development kit: Qualcomm AR2 reference glasses or equivalent
- Flash Denarixx firmware placeholder
- Wire Web Bluetooth API pairing (`navigator.bluetooth.requestDevice()`)
- Test camera streaming over BT LE (GATT custom service)
- Validate bone-conduction audio latency (<50ms target)
- Validate haptic pattern timing accuracy

### Phase 18 (DVT — Design Validation)
- Custom PCB with compute module + sensor array
- Denarixx frame design (3D-printed prototype)
- Battery validation (>4h life under load)
- Thermal validation (sustained use <42°C)
- IP rating test (IPX4)

### Phase 19 (PVT — Production Validation)
- Small-batch manufacturing (50–200 units)
- User accessibility testing with real blind/visually impaired users
- CE/FCC certification
- Companion app on Google Play / App Store

---

## Germany Prototype Path (Q2 2026)

**Why Germany:**
- Strong assistive technology market (EU Accessibility Act 2025)
- University research partnerships (TU Berlin, RWTH Aachen)
- German pilot testing facility identified
- Proximity to European hardware suppliers

**Milestones:**
1. **Feb 2026** — Software prototype spec finalized (this phase)
2. **Mar 2026** — Reference hardware kit ordered (Qualcomm AR2 devkit or equivalent)
3. **Apr 2026** — First hardware pairing test (Bluetooth LE + Web Bluetooth)
4. **May 2026** — 5-unit alpha batch (3D-printed frame + dev board)
5. **Jun 2026** — Blind user pilot test, Germany (10 participants, V11 protocol)

---

## China / Europe Manufacturing Path (2027+)

**Manufacturing strategy:**
- **ODM partner** in Shenzhen (smart-glasses ODM ecosystem, e.g., Rokid / TCL / Vuzix OEM)
- Custom frame + Denarixx PCB
- **CE marking** (Europe) + **UKCA** (UK) + FCC (US) in parallel
- Target retail: €399 (introductory), €299 at scale
- EU social inclusion fund eligibility (subsidized for registered visually impaired users)

**Volume targets:**
- 2027 Q1: 500 units (EU pilot)
- 2027 Q3: 5,000 units (retail launch)
- 2028: 50,000 units/year

---

## What Is Simulated vs Real Hardware-Needed

| Capability | V16 Status | Real Hardware Needed |
|---|---|---|
| Connection state machine | ✅ Simulated | Bluetooth LE + GATT custom service |
| Camera image capture | ❌ Placeholder | OV5640 / IMX415 modules |
| Bone-conduction driver | ❌ Placeholder | Piezo transducer driver IC |
| Haptic pattern playback | ❌ Placeholder | ERM/LRA motor + DRV2605 |
| Battery monitoring | ❌ Placeholder | MAX17048 fuel gauge IC |
| Thermal monitoring | ❌ Placeholder | NTC thermistor |
| NPU inference | ❌ Placeholder | Qualcomm Hexagon DSP SDK |
| Firmware OTA | ❌ Placeholder | MCUBOOT or custom BL |
| Microphone capture | ❌ Placeholder | MEMS microphone array |

---

## Privacy by Design

- **No video storage** on glasses — frames processed in memory, discarded
- **No face recognition** (enforced in V9 + V14 + V8 SAFETY_RULES)
- **No biometric data** collected from the user
- **No serial number stored** in software (placeholder string only)
- **Consent required** before any pilot testing (V11 PILOT_PRIVACY)
- **GDPR compliant** by design (EU market-first)

---

## Emergency Fallback Guarantees

The glasses are designed with **defense in depth** — every subsystem failure has a defined fallback, and no failure is ever silent:

| Failure | Detection | Response |
|---|---|---|
| Glasses disconnected | BT heartbeat timeout | Switch to phone-only + audio alert |
| Camera failed | Frame timeout / GATT error | Phone camera fallback + alert |
| Bone-conduction failed | Audio ACK timeout | Phone speaker fallback |
| Haptic failed | Motor ACK timeout | Audio-only, no crash |
| Battery critical | Fuel gauge | Emergency audio + degrade mode |
| All cameras failed | V14 `VISION_UNAVAILABLE_MESSAGE` | "Stop and check carefully" |
| Cloud unavailable | HTTP timeout | V15 offline safety path activates |

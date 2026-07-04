# Manufacturer Requirements Brief — Denarixx Vision AI Glasses

**Version:** Phase 18 (Internal Planning)
**Audience:** Prospective hardware manufacturers, OEM partners, industrial designers
**Status:** Planning only — no NDA signed, no purchase orders issued

---

## What Is Denarixx Vision AI?

Denarixx Vision AI is an AI-powered assistive perception platform for blind and low-vision users. It uses a small form-factor wearable glasses device with multiple cameras, bone-conduction audio, and haptic feedback to provide real-time navigation guidance, hazard warnings, and spatial awareness — delivered via spoken audio and vibration patterns.

The system is **assistive technology**, not a medical device. It does not replace medical care. It is intended as a daily-use accessibility tool, primarily for indoor navigation, outdoor pavement walking, and public transport environments.

**Target market:** Blind and visually impaired users in Germany and the EU.

---

## What the Glasses Must Do

| Capability | Requirement | Priority |
|---|---|---|
| Wide-angle camera (front) | 1080p, ≥30fps, 80° FOV | Critical |
| Side cameras (left/right) | 720p, ≥15fps, 100° FOV | Critical |
| Downward camera (depth) | 480p, ≥10fps, 120° FOV, depth map | High |
| Bone-conduction audio | ≥85dB SPL at 1cm, 20Hz–20kHz | Critical |
| Haptic feedback (LRA) | 8 vibration patterns, 150–300Hz | High |
| Bluetooth LE 5.3 | BT LE Audio, ≥10m range | Critical |
| On-device compute | NPU ≥1 TOPS, <500mW TDP | Critical |
| Battery | 300mAh LiPo, ≥4h life glasses-primary mode | Critical |
| Weight | ≤42g total assembled | High |
| Form factor | Glasses frame — not headband, not helmet | Critical |
| Charging | USB-C PD, 30min to 80% | Medium |

---

## Camera Placement Requirements

```
Frame layout (top-down view):

  ← Left camera (100°)    Front camera (80°)    Right camera (100°) →
  [lens]                  [bridge/nose]                  [lens]
                              │
                              ↓
                    Downward camera (120°+depth)
                    Mounted on lower bridge or nose pad
```

- **Front camera:** Primary hazard detection. Must be centered, level with eye line.
- **Side cameras:** Peripheral awareness. Mounted on temple arms pointing outward.
- **Downward camera:** Floor/step detection. Must have unobstructed downward view when worn.
- **No camera may point directly at the user's eyes** (privacy + safety).
- **No microphone array required in V18 prototype** (voice processed on phone).

---

## Battery Requirements

| Specification | Target |
|---|---|
| Capacity | 300mAh minimum |
| Chemistry | LiPo (3.7V nominal) |
| Weight | <5g cell only |
| Safety | IEC 62368-1 compliant chemistry (no cobalt-heavy cells) |
| Over-temperature | Cutoff at 60°C charge, 70°C discharge |
| Charging IC | PMIC with over-voltage, over-current, over-temperature protection |
| Charging interface | USB-C PD 5W minimum |
| Cycle life | ≥500 cycles to 80% capacity |
| Expected runtime | ≥4h glasses-primary AI mode |

**Note:** Battery safety pre-assessment must be completed before any prototype is assembled with LiPo cells.

---

## Audio Requirements (Bone-Conduction)

| Specification | Target |
|---|---|
| Transducer type | Bone-conduction (vibration to skull) — NOT in-ear |
| Channels | Stereo (2 transducers — left and right temple) |
| SPL | ≥85dB SPL at 1cm contact point |
| Frequency response | 20Hz–20kHz (voice intelligibility: 200Hz–4kHz) |
| Power | <300mW per transducer |
| Latency | <50ms audio-to-bone |
| Fallback | If bone-conduction fails, route to phone speaker via Bluetooth |

**Vendor suggestions for evaluation:** Shokz OEM division, xMEMS (micro-speaker alternative), Vibronics

---

## Haptic Requirements

| Specification | Target |
|---|---|
| Actuator type | LRA (Linear Resonant Actuator) — NOT ERM |
| Resonance frequency | 150–300Hz |
| Placement | Right temple arm (primary), left temple arm (secondary optional) |
| Weight | <2g each |
| Power | <100mW per actuator |
| Patterns | 8 patterns (critical hazard, high priority, warning, caution, navigation, confirmation, social alert, notification) |
| Intensity scaling | Software-controlled 0–100% via PWM |

---

## Compute Requirements

| Specification | Target |
|---|---|
| SoC target | Qualcomm AR2 (placeholder) or equivalent AR/edge AI SoC |
| NPU | ≥1 TOPS (for YOLO-NAS / MobileNet inference) |
| CPU | ≥4 cores, ARM Cortex-A series |
| RAM | ≥2GB LPDDR4 |
| Storage | ≥8GB eMMC or UFS |
| TDP | <500mW sustained |
| OS target | Android Embedded or Linux (AOSP) |
| Runtime support | ONNX Runtime, TFLite, or vendor NPU SDK |

**Alternative SoCs to evaluate:** MediaTek MT8365, Rockchip RK3568, Synaptics Katana (VS680)

---

## Connectivity

| Interface | Requirement |
|---|---|
| Bluetooth | BT LE 5.3 + BT LE Audio (ISO channels for low-latency audio) |
| Wi-Fi | IEEE 802.11ax (Wi-Fi 6), 2.4/5GHz — optional for OTA firmware |
| USB | USB-C 2.0 (charging + debug) |
| Phone link | BT LE primary. Wi-Fi Direct optional for future cloud offload |

---

## Thermal Safety Requirements

| Specification | Requirement |
|---|---|
| External surface temperature | ≤40°C at sustained AI load (EN 62368-1) |
| CPU throttle threshold | 70°C junction temperature |
| Passive thermal design | Graphite spreader sheet or vapour chamber on SoC |
| No active fans | Form factor constraint — passive cooling only |
| IP rating target | IP52 (dust-protected, splash-resistant) |

---

## Durability Requirements

| Specification | Requirement |
|---|---|
| Drop test | 1.2m drop onto concrete (MIL-STD-810G) — survive 3 drops |
| Hinge strength | ≥10,000 open/close cycles |
| UV resistance | Frame material does not yellow or degrade in 2 years |
| Lens scratch resistance | Anti-scratch coating (Mohs ≥6) |
| Sweat resistance | IP52 minimum. Nose pad and temple tips replaceable |
| Operating temperature | 0°C to 40°C |

---

## Privacy Requirements — MANDATORY

These are non-negotiable. Any manufacturer or ODM partner must agree to all of the following:

| Requirement | Detail |
|---|---|
| **No onboard video storage** | Frames must be processed in memory and discarded. No flash storage of raw camera frames. |
| **No face recognition firmware** | No face recognition algorithm may be embedded in firmware or SDK. |
| **No always-on microphone** | No microphone array in glasses. All voice processing on phone. |
| **No biometric data storage** | No iris scan, retinal map, facial geometry, or gait analysis stored on device. |
| **No remote activation of camera** | Camera must be user-initiated (session start). No remote camera access. |
| **GPS not embedded in glasses** | GPS only in companion phone. Glasses do not process location. |
| **User can wipe device** | Factory reset must delete all user data from device storage. |

---

## Prototype Assumptions (Phase 18)

For the first physical prototype (target Q3 2026 breadboard, Q4 2026 PCB prototype):

- **Off-the-shelf components only** — no custom ASICs
- **3D printed frame** — not injection moulded (tooling comes later)
- **Evaluation board compute** — e.g. Qualcomm RB5 development kit or Raspberry Pi CM4
- **Bone-conduction headset OEM** — e.g. Shokz OpenRun module
- **Weight target relaxed for prototype** — 80–120g acceptable for V18 breadboard
- **Battery** — standard 18650 cell in prototype (LiPo custom cell in V19+)
- **Target: 5 prototype units** for V17 supervised field trials (Q4 2026)

---

## Questions to Ask Manufacturers

1. What is your minimum order quantity (MOQ) for custom wearable frames?
2. Have you worked on smart glasses or AR glasses before? Can you share reference designs?
3. Do you have experience with LiPo integration in sub-50g form factors?
4. What is your NDA and IP protection process for foreign hardware startups?
5. Do you have an optical alignment jig for multi-camera calibration?
6. Can you supply bone-conduction transducers as a sub-assembly?
7. What is your lead time for a 5-unit prototype with 3D printed frame?
8. Do you have CE marking experience for wearable electronics?
9. Can you provide FMEA (Failure Mode and Effects Analysis) for the battery circuit?
10. Are you willing to sign a supply chain audit agreement for EU GDPR compliance?

---

## What Not to Ask Yet

- Do not ask about mass production pricing until V19 prototype is validated.
- Do not request custom ASIC design — off-the-shelf SoC only in V18/V19.
- Do not request injection mould tooling quotes until frame CAD is finalized.
- Do not discuss CE marking application until battery safety pre-assessment is complete.

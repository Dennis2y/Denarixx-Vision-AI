# Power System — Denarixx Vision Glasses

**Revision:** Sprint 19
**Platform:** Denarixx V1 prototype

---

## 1. Battery Specification

| Attribute | Requirement | Source |
|---|---|---|
| Chemistry | Lithium Polymer (Li-Po) | |
| Nominal voltage | 3.7 V | |
| Capacity | 2500 mAh (9.25 Wh) | |
| Charge voltage | 4.2 V (max) | |
| Discharge cut-off | 3.0 V | |
| Continuous discharge | 2 A (7.4 W) | |
| Peak discharge | 4 A (< 5 s, burst NPU workload) | |
| Cycle life | ≥ 500 full cycles to 80 % capacity | |
| Operating temperature | 0°C – 45°C | |
| Storage temperature | −20°C – 60°C | |
| Safety | PCM (protection circuit module): over-charge, over-discharge, short circuit, over-temperature | |
| Form factor | Custom Li-Po pouch, integrated into frame arm | |

---

## 2. Charging

| Attribute | Requirement |
|---|---|
| Connector | USB-C (USB-PD 3.0) |
| Fast charge input | 45 W (20 V × 2.25 A) |
| Charge time (0 → 80 %) | ≤ 90 min |
| Charge time (0 → 100 %) | ≤ 2 h |
| Wireless charging | Planned for DVT — not required for EVT |
| Charge indicator | Bone-conduction audio: "Charging", "Battery full" |
| Charge-through use | Yes — glasses operable during charging |

---

## 3. Power Budget

### 3.1 Active Mode (Full AI)

| Component | Typical Power | Peak |
|---|---|---|
| SoC (CPU + NPU active) | 1200 mW | 2000 mW |
| Front-wide camera (1080p 30fps) | 300 mW | 450 mW |
| Front-tele camera | 200 mW | 300 mW |
| Side cameras (×2, 720p 15fps) | 150 mW total | 250 mW |
| IMU + compass | 5 mW | 8 mW |
| GPS (tracking) | 20 mW | 35 mW |
| Wi-Fi 6 (active) | 500 mW | 900 mW |
| Bluetooth 5.3 | 25 mW | 50 mW |
| Bone-conduction (×2, speech) | 200 mW | 400 mW |
| Microphone array + DSP | 15 mW | 25 mW |
| Display (HUD, if fitted) | 150 mW | 300 mW |
| PMIC + misc | 50 mW | 100 mW |
| **Total (typical)** | **2815 mW** | **4818 mW** |

**Runtime estimate:** 9250 mWh ÷ 2815 mW ≈ **3.3 h** (typical) — target ≥ 4 h with software optimisation (Sprint 15 battery mode scheduler).

### 3.2 Balanced Mode (60–80 % battery)

| Change | Power saving |
|---|---|
| NPU frame rate → 10 fps | −300 mW |
| Side cameras → standby | −100 mW |
| Wi-Fi → duty-cycled | −200 mW |
| Display → low-power | −80 mW |
| **Total saving** | **~−680 mW** |

**Runtime estimate:** ≈ **4.5 h**

### 3.3 Low-Power Mode (20–60 % battery)

| Change | Power saving |
|---|---|
| NPU frame rate → 5 fps | −500 mW |
| Front-tele → standby | −200 mW |
| GPS → 1 Hz update | −12 mW |
| Wi-Fi → off | −500 mW |
| **Total saving** | **~−1200 mW** |

**Runtime estimate:** ≈ **6 h**

### 3.4 Emergency Mode (< 20 % battery)

| Mode | Active components | Power |
|---|---|---|
| Emergency | Bone-conduction speaker + mic wake word + critical alerts only | ≤ 600 mW |
| Runtime | 9250 mWh × 20 % ÷ 600 mW | **≈ 3 h additional** |
| Total from 0 % | 6 h (low-power) + 3 h (emergency) | **≈ 9 h total** |

Software: `batteryHAL.ts` triggers `CRITICAL_BATTERY_ANNOUNCEMENT` at ≤10% and activates emergency mode via `powerManagementEngine.ts` (Sprint 16).

---

## 4. Thermal Management

### 4.1 Temperature Thresholds

| State | Temperature | Action | Source |
|---|---|---|---|
| Normal | < 38°C | No action | Sprint 18 |
| Warm | 38–42°C | Log warning, monitor | Sprint 18 |
| Hot | 42–48°C | Reduce NPU frame rate, close front-tele | Sprint 18 |
| Critical | ≥ 48°C | Enter emergency mode, alert user, log incident | Sprint 18 |

### 4.2 Thermal Design

| Element | Detail |
|---|---|
| SoC TDP | ≤ 4 W sustained (within glasses thermal envelope) |
| Heat spreader | Graphite sheet on SoC lid → frame rail |
| Frame material | Aluminium alloy (heat conduction to ambient) |
| Ambient max | 40°C (operating spec) |
| Safety margin | System throttles at 48°C — well below Li-Po safety limit (60°C) |

### 4.3 Software Control

`batteryOptimizationEngine.ts` (Sprint 15):
- Monitors battery mode: `performance → balanced → low-power → emergency`
- Adjusts NPU clock, camera frame rates, Wi-Fi duty cycle based on thermal + battery state
- Reports thermal adjustments to `edgeInferenceEngine.ts`

`powerManagementEngine.ts` (Sprint 16):
- classifyBatteryHealth, voltage curve, drain simulation
- activates emergency power path (PMIC bypass)

---

## 5. Battery Safety

| Rule | Enforcement |
|---|---|
| Never discharge below 3.0 V | PMIC hardware cut-off |
| Never charge above 4.2 V | PMIC hardware cut-off |
| Never operate above 60°C (battery) | Thermal shutdown |
| Swollen battery detection | Strain gauge in frame (future EVT) |
| User alert at 20 % | `batteryHAL.ts` → bone-conduction |
| User alert at 10 % | `CRITICAL_BATTERY_ANNOUNCEMENT` (Sprint 17) |
| Emergency mode at 10 % | `powerManagementEngine.ts` |
| Charge circuit disable above 45°C | PMIC thermal protection |
| Short circuit protection | PCM (hardware, always active) |

---

## 6. Emergency Power Path

The PMIC maintains a dedicated emergency power path that keeps the following alive even if the main SoC powers down:

1. Bone-conduction speaker driver (left temple)
2. Wake-word DSP (microphone)
3. Emergency LED indicator (rear)
4. USB-C VBUS detection

This ensures the user can still hear critical alerts and the glasses can be identified as in emergency state — even with a critically low or failed battery.

---

## 7. Software Power Modes Summary

| Mode | Battery | Frame rate | Wi-Fi | Cameras active |
|---|---|---|---|---|
| Performance | > 80 % | 15 fps | Active | All 4 |
| Balanced | 60–80 % | 10 fps | Duty-cycled | Front ×2 |
| Low-power | 20–60 % | 5 fps | Off | Front-wide only |
| Emergency | < 20 % | 2 fps | Off | Front-wide only |

Defined in `src/types/onDeviceAI.ts` (`BatteryMode`) and orchestrated by `onDeviceAIEngine.ts` (Sprint 15).

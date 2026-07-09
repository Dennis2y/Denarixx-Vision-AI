# System Integration Guide — Denarixx Vision Glasses

**Revision:** Sprint 20
**Platform:** Denarixx V1 prototype

---

## 1. Integration Philosophy

> The HAL (Sprint 17) is the only layer that changes when moving from simulation to prototype.  Every AI engine above the HAL runs unchanged.

The `platform` field in `hardwareAbstractionEngine.ts` switches from `'simulation'` to `'prototype'`.  No AI code changes.

---

## 2. Hardware Interface Registry (12 interfaces)

Defined in `prototypeIntegrationEngine.ts` — `INTERFACE_REGISTRY`.

| # | Type | Protocol | HAL Driver | Required Sprint | Notes |
|---|---|---|---|---|---|
| 1 | `camera` | MIPI CSI-2 (4-lane) | `cameraHAL.ts` | 14 (Multi-camera) | 4-camera array; fallback chain front-wide → front-tele → side-left → side-right |
| 2 | `microphone` | PDM (3.072 MHz) | `microphoneHAL.ts` | 17 | 3× MEMS mic array; always-on DSP path for wake word |
| 3 | `bone-audio` | I2S (48 kHz, 24-bit) | `speakerHAL.ts` | 17 | 2× bone-conduction transducer; priority queue; emergency override |
| 4 | `battery` | I2C (fuel gauge IC) | `batteryHAL.ts` | 17 | Li-Po 2500 mAh; CRITICAL_BATTERY_ANNOUNCEMENT at ≤10% |
| 5 | `gps` | UART (9600 bps) | `gpsHAL.ts` | 17 | Multi-constellation GNSS; dead-reckoning via IMU when unavailable |
| 6 | `imu` | SPI (or I2C) | `imuHAL.ts` | 17 | 6-axis (accel + gyro); 200 Hz; fall detection |
| 7 | `compass` | I2C (400 kHz) | `imuHAL.ts` (getHeading) | 17 | 3-axis magnetometer; hard/soft iron calibration on boot |
| 8 | `display` | MIPI DSI | `displayHAL.ts` | 17 | Optional HUD; modes: hud/low-power/off/ar-overlay; may be absent in EVT |
| 9 | `button` | GPIO (digital input) | Future `buttonHAL.ts` | 20 (planned) | 2 physical buttons: power, guardian trigger |
| 10 | `touch` | I2C (capacitive controller) | Future `touchHAL.ts` | 20 (planned) | Capacitive strip on temple arms; 5 gestures |
| 11 | `usb-c` | USB 3.2 Gen 1 | Kernel driver (host OS) | 20 | Charging (PD 45W); ADB debugging; DisplayPort alt mode |
| 12 | `wireless` | PCIe/SDIO → Wi-Fi 6 + BT 5.3 | Kernel driver (host OS) | 14, 20 | OTA model updates; phone companion link; optional eSIM |

---

## 3. Integration Checklist per Interface

For each interface, complete these steps in order:

**Phase 1 — Vendor Selection** (not required for software readiness)
- [ ] Select IC vendor (camera sensor, fuel gauge, GNSS module, IMU)
- [ ] Obtain evaluation kit / datasheet

**Phase 2 — HAL Driver Stub** (Sprint 17 provides simulation; real driver needed for prototype)
- [ ] Implement `get<Component>Driver()` for `'prototype'` platform
- [ ] Return real register map / UART frame parser / SPI sequence

**Phase 3 — Integration Test** (covered by `prototypeIntegration.test.ts`)
- [ ] Hardware interface responds to HAL init
- [ ] HAL health check returns `'ok'`
- [ ] Sensor self-test passes

**Phase 4 — Validation** (EVT acceptance criteria, Sprint 19)
- [ ] Camera delivers frames at target rate
- [ ] GPS acquires fix (cold start ≤30 s)
- [ ] IMU reads heading and detects fall
- [ ] Battery reads voltage, triggers critical at ≤10%
- [ ] Bone-conduction plays guardian alert (all priority levels)
- [ ] Microphone captures wake word correctly

---

## 4. Interface Dependencies

```
Camera (MIPI CSI-2)
  └─ ISP (on-SoC) → cameraHAL → multiCameraFusionEngine (Sprint 14)
                                → visionInferenceEngine (Sprint 12)

Microphone (PDM)
  └─ Audio DSP → microphoneHAL → voiceCommandEngine (Sprint 5)
                               → wake-word detection (always on)

Bone-audio (I2S)
  └─ Class-D amp → speakerHAL → Guardian alerts → all safety engines

Battery (I2C fuel gauge)
  └─ batteryHAL → powerManagementEngine (Sprint 16)
               → batteryOptimizationEngine (Sprint 15)
               → onDeviceAIEngine (Sprint 15) — frame rate scheduling

GPS (UART)
  └─ gpsHAL → sensorFusionEngine (Sprint 7)
            → navigationIntelligenceEngine (Sprint 13)

IMU + Compass (SPI/I2C)
  └─ imuHAL → sensorFusionEngine → motion state + heading

Display (DSI) [optional]
  └─ displayHAL → glassesRuntime (Sprint 16) — hud mode

USB-C
  └─ Host OS → ADB (debugging) + PD charging + DisplayPort

Wireless
  └─ Host OS → offlineSyncEngine (Sprint 14) — cloud sync
            → offlineModelRegistryEngine (Sprint 14) — OTA models
```

---

## 5. Integration Score Calculation

`prototypeIntegrationEngine.ts` computes an integration score 0–100:

```
score = (validatedInterfaces / totalInterfaces) × 100
```

Thresholds:
- ≥ 80: EVT-ready (`readyForEVT = true`)
- ≥ 60: Integration progressing, not EVT-ready
- < 60: Critical interfaces outstanding

---

## 6. Safety Integration Rules

These rules are enforced in `prototypeIntegrationEngine.ts` and cannot be bypassed:

1. Camera integration failure → bone-audio must still work (fallback chain)
2. GPS failure → IMU dead-reckoning activates (not a blocking integration failure)
3. Bone-audio failure → haptic motor fires (Sprint 16 haptic fallback)
4. Battery below 10% → emergency mode activates regardless of integration state
5. All safety rules from Guardian (Sprint 5) and Street Safety (Sprint 15) apply unchanged

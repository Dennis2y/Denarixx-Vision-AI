# Sprint 20: Prototype Hardware Integration Plan

**Phase:** Platform & Hardware (Phase 6)
**Sprint ID:** 30 (internal)
**Status:** Complete
**Goal:** Create a complete prototype integration plan that links the Denarixx Vision AI software stack to real hardware modules — without changing the core software.

---

## 1. Overview

Sprint 20 defines the engineering bridge between the software stack (Sprints 1–19) and physical prototype hardware.  All core AI, safety, and accessibility code runs unchanged on the prototype because the HAL (Sprint 17) provides full hardware abstraction.

The only change when moving from simulation to prototype is the HAL platform string:

```typescript
// Simulation
const platform = 'simulation';  // Sprint 18 Digital Twin

// Prototype
const platform = 'prototype';   // Sprint 17 HAL + Sprint 20 bridge
```

---

## 2. Document Map

| Document | Coverage |
|---|---|
| `SYSTEM_INTEGRATION_GUIDE.md` | 12 hardware interfaces, integration checklist |
| `HARDWARE_SOFTWARE_INTERFACE.md` | Contract between firmware and HAL |
| `PROTOTYPE_TEST_PLAN.md` | 8 validation scenarios (EVT acceptance) |
| `DEPLOYMENT_PIPELINE.md` | Dev → staging → prototype → production |
| This file | Sprint summary and cross-document index |

---

## 3. Sprint 20 Engines

| Engine | Purpose |
|---|---|
| `prototypeIntegrationEngine.ts` | 12-interface registry, integration scoring, EVT readiness |
| `firmwareBridgeEngine.ts` | Device discovery, sensor registration, OTA hooks, health reports |
| `deviceProvisioningEngine.ts` | First-boot flow (7 steps), calibration, language, accessibility |
| `hardwareDeploymentEngine.ts` | 4-stage deployment pipeline, signing, rollback, diagnostics |

---

## 4. Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Guardian AI, Navigation, Vision, Social Awareness ...          │
│  (Sprints 1–19 — zero code changes for prototype)              │
├─────────────────────────────────────────────────────────────────┤
│  Hardware Abstraction Layer — HAL (Sprint 17)                   │
│  Platform: 'prototype'                                          │
├─────────────────────────────────────────────────────────────────┤
│  Sprint 20 Bridge                                               │
│  ┌─────────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ FirmwareBridge  │  │  Provisioning │  │  Deployment      │  │
│  │ Engine          │  │  Engine       │  │  Engine          │  │
│  └─────────────────┘  └───────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Prototype Firmware (MCU / Linux Wearable / Android XR)         │
├─────────────────────────────────────────────────────────────────┤
│  Physical Hardware (12 interfaces)                              │
│  Camera × 4 | Mic × 3 | Bone-audio × 2 | Battery | GPS | IMU  │
│  Compass | Display | Button × 2 | Touch | USB-C | Wireless     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. First-Boot Provisioning Flow

Defined in `deviceProvisioningEngine.ts` — 7 steps (plus `complete`):

1. **factory-reset** — wipe all user data and restore defaults
2. **device-init** — register device ID, connect to HAL
3. **voice-calibration** — record 3 voice samples for wake-word tuning
4. **sensor-calibration** — IMU offset, compass hard/soft iron, camera white balance
5. **language-selection** — choose from 8 supported languages (Sprint 13)
6. **accessibility-profile** — apply preset (Sprint 11) + bone-conduction volume
7. **privacy-defaults** — set consent flags (Sprint 12), GPS fuzzing on by default
8. **complete** — device ready

---

## 6. EVT Readiness Gate

Integration score ≥ 80 (`INTEGRATION_SCORE_EVT_THRESHOLD`) with all 12 interfaces at least `in-progress` and all critical interfaces `validated`:

Critical interfaces: `camera`, `bone-audio`, `battery`, `gps`, `imu`, `microphone`

All 12 interfaces must reach `validated` before DVT.

---

## 7. Safety Rules (unchanged from software)

- Guardian never says "safe to cross" based on camera alone.
- Camera failure triggers immediate bone-conduction alert.
- Critical alerts bypass cooldown even on prototype hardware.
- All safety rules tested in `prototypeIntegration.test.ts`.

---

## 8. Roadmap

| Milestone | Target | Notes |
|---|---|---|
| Sprint 19 — Hardware Spec | Q3 2026 | ✅ Complete |
| Sprint 20 — Integration Plan | Q3 2026 | ✅ Complete |
| EVT prototype build | Q4 2026 | 5 hand-built units |
| DVT prototype | Q2 2027 | 20 units, wearable form |
| PVT | Q4 2027 | 100 units, certification |
| Limited production | Q1 2028 | 500–2000 units |

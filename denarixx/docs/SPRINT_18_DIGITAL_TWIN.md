# Sprint 18: Smart Glasses Hardware Simulator & Digital Twin

## Core Principle

**No real hardware exists yet. The Digital Twin simulates all hardware so every subsystem can be tested before manufacturing.**

Every sensor, every camera, every fault scenario, every environmental condition — all testable in software before a single piece of hardware is produced.

---

## Digital Twin Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              AI Engine Layer (Sprint 1–17)                   │
│  Guardian · Navigation · Vision · Voice · Memory · Privacy   │
└──────────────────────────┬──────────────────────────────────┘
                           │ ← validated by Digital Twin
┌──────────────────────────▼──────────────────────────────────┐
│           Digital Twin Engine (Sprint 18)                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Glasses Simulator Engine                   │    │
│  │   (orchestrator — tick, boot, reset, environment)    │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐    │
│  │              Virtual Sensor Engine                   │    │
│  │  camera · GPS · IMU · compass · battery · mic        │    │
│  │  speaker · display · temperature                     │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                   │
│  ┌────────────┐  ┌───────▼────────┐  ┌───────────────────┐  │
│  │ Hardware   │  │ Environment    │  │   Diagnostics     │  │
│  │ Fault      │  │ Simulation     │  │   Engine          │  │
│  │ Engine     │  │ Engine (11)    │  │   (reports)       │  │
│  └────────────┘  └────────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │ wraps
┌──────────────────────────▼──────────────────────────────────┐
│       HAL (Sprint 17) · Glasses OS (Sprint 16)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Simulated Hardware Components (11)

| Component | Simulated Behaviours |
|-----------|---------------------|
| Camera (front) | Frame capture, confidence, obstruction, low-light degradation, fallback |
| Camera (side-left) | Same as above — side coverage |
| Camera (side-right) | Same as above — side coverage |
| GPS | GNSS fix, accuracy, drift, offline dead-reckoning |
| IMU | Accelerometer, gyroscope, compass, heading, motion state, drift |
| Battery | Percentage, temperature, drain rate, charging, thermal critical |
| Microphone (left) | Wake word detection, amplitude, noise, SNR |
| Microphone (right) | Backup microphone, same as above |
| Bone-Conduction Speaker | Volume, bone-conduction mode, emergency override |
| Display | HUD mode, brightness, low-power, overheating |
| Temperature | Thermal simulation across compute module + battery |

---

## 11 Environment Profiles

| Environment | GPS Accuracy | Noise | Light | Indoor | Hazard Density |
|-------------|-------------|-------|-------|--------|----------------|
| Busy City | 8m | 85% | Normal | No | High |
| Quiet Street | 4m | 20% | Normal | No | Low |
| Shopping Mall | 35m | 75% | Bright | Yes | High |
| Airport | 40m | 80% | Bright | Yes | High |
| Train Station | 30m | 90% | Normal | Yes | High |
| Rain | 12m | 60% | Dim | No | Medium |
| Fog | 10m | 30% | Dim | No | Medium |
| Night | 6m | 15% | Dark | No | Medium |
| Snow | 15m | 25% | Dim | No | Medium |
| Strong Sunlight | 3m | 35% | Bright | No | Low |
| Indoor Navigation | 50m | 40% | Normal | Yes | Medium |

Each environment profile automatically adjusts: GPS accuracy, camera challenge, microphone noise, GPS indoor mode, and bone-conduction boost requirement.

---

## Fault Injection (9 Fault Types)

| Fault | Severity | Safety Impact | Recoverable |
|-------|---------|---------------|-------------|
| Camera Failure | Critical | Critical | Yes |
| GPS Loss | High | Degraded | Yes |
| Low Battery | High | Reduced | Yes |
| Sensor Drift | Medium | Reduced | Yes |
| Microphone Failure | High | Degraded | Yes |
| Speaker Failure | Critical | Critical | Yes |
| Overheating | High | Reduced | Yes |
| Low Light | Medium | Reduced | Yes |
| Partial Obstruction | Medium | Reduced | Yes |

Each fault includes: affected component, safety impact classification, and a list of recovery steps.

### Recovery Paths

- **Camera failure** → Fallback to side cameras (Sprint 14 multi-camera)
- **GPS loss** → IMU dead-reckoning (Sprint 17 GPS HAL)
- **Low battery** → Guardian remains last feature active (Sprint 16)
- **Speaker failure** → Haptic fallback (Sprint 17 speaker HAL)
- **Sensor drift** → Heading uncertainty increased; calibration recommended

---

## AI Validation Scenarios (5)

The Digital Twin validates that all Sprint 1–17 AI engines respond correctly under fault conditions:

1. **Guardian responds correctly** — Speaker working → Guardian can alert the user
2. **Navigation degrades safely** — GPS loss → IMU dead-reckoning (no hard failure)
3. **Offline mode continues** — Sprint 14 edge AI always runs on glasses compute module
4. **Emergency mode works** — Battery > 0% → emergency mode activates
5. **Explainable AI available** — Sprint 9 explains every Guardian decision when booted

All 5 validations must pass before `isManufacturingReady` returns `true`.

---

## Diagnostics

### Sensor Health Dashboard
Reports quality (`perfect` / `good` / `degraded` / `failed`) for all 11 components with specific issue descriptions.

### Overall Health Score (0–100)
- 100 points = all 7 key components healthy
- -5 per active fault
- -10 for IMU drift factor > 1.5
- -10 to -20 for thermal issues

### Manufacturing Readiness Score
Requirements to mark `isManufacturingReady = true`:
- No blocking faults (no camera failure, speaker failure, thermal limit breach, extreme drift, battery depletion)
- Overall health score ≥ 70
- All 5 AI validation scenarios pass

### Performance Monitor
Tracks: uptime ticks, active fault count, healthy component count, battery percentage, GPS accuracy, environment label.

---

## Integration with Sprint 1–17

| Sprint 18 Engine | Integrates with |
|-----------------|----------------|
| glassesSimulatorEngine | Glasses OS (Sprint 16), HAL (Sprint 17) |
| digitalTwinEngine | Guardian (Sprint 2), Explainable AI (Sprint 9), Offline (Sprint 14) |
| virtualSensorEngine | All HAL engines (Sprint 17) |
| hardwareFaultEngine | HAL recovery logic (Sprint 17) |
| environmentSimulationEngine | Navigation (Sprint 13), Street Safety (Sprint 15) |
| diagnosticsEngine | All previous sprint engines |

---

## Hardware Simulation Strategy

### Why Digital Twin?

Without real hardware, it is impossible to know:
- How the Guardian responds when a camera fails mid-route
- Whether navigation degrades safely when GPS is lost indoors
- Whether the battery drain model matches real hardware
- Whether bone-conduction speakers provide adequate audio in noisy environments

The Digital Twin answers all these questions in software.

### Simulation Confidence

| Sensor | Simulation Accuracy | Basis |
|--------|---------------------|-------|
| Camera confidence | High | Physics-based light model |
| GPS accuracy | High | Environment-based models (indoor/outdoor) |
| Battery drain | Medium | Drain rate × environment load |
| IMU readings | Medium | Sinusoidal motion model |
| Microphone SNR | High | Ambient noise × mic noise level |

### What the Digital Twin Cannot Simulate

- Real-world radio interference on GPS
- Hardware manufacturing variance (component tolerances)
- Long-term battery degradation (> 500 charge cycles)
- Real user interaction latency

These require physical prototyping (Sprint 17 Raspberry Pi prototype path).

---

## Manufacturing Readiness Path

```
Sprint 18 Digital Twin (software validation)
    ↓
Sprint 17 HAL prototype on Raspberry Pi (hardware validation)
    ↓
Android XR partnership device (field trials, Sprint 17)
    ↓
Custom Denarixx Vision Glasses v1 (Q4 2027)
```

The Digital Twin runs continuously alongside prototype hardware — any regression in hardware behaviour is immediately visible in the simulation.

---

## Files Created

### Types
- `src/types/simulator.ts` — All Sprint 18 types; never merge with hardware.ts or hardwareHAL.ts

### Engines
- `src/engines/glassesSimulatorEngine.ts` — Top-level simulator orchestrator (boot, tick, reset, environment, mode)
- `src/engines/digitalTwinEngine.ts` — Twin lifecycle, AI validation, manufacturing readiness
- `src/engines/virtualSensorEngine.ts` — All 11 sensor simulations (camera, GPS, IMU, compass, battery, mic, temp, display)
- `src/engines/hardwareFaultEngine.ts` — 9 fault types, injection, recovery, fault queries
- `src/engines/environmentSimulationEngine.ts` — 11 environment profiles, environment effects on sensors
- `src/engines/diagnosticsEngine.ts` — Sensor health dashboard, diagnostics report, AI validation, performance monitor

### Tests
- `tests/glassesSimulator.test.ts` — Sprint 18 test suite

---

*"Digital Twin simulates all Denarixx Vision Glasses hardware. Every subsystem can be tested before manufacturing." — TWIN_NOTE constant*

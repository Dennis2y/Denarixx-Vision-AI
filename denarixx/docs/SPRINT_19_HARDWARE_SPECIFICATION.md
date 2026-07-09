# Sprint 19: Hardware Specification & Manufacturing Readiness

**Phase:** Platform & Hardware (Phase 6)
**Sprint ID:** 29 (internal)
**Status:** Complete
**Goal:** Produce a complete engineering specification that software and hardware teams can use to build a working Denarixx Vision Glasses prototype.

---

## 1. Overview

Sprint 19 converts the software-defined hardware model built in Sprints 1–18 into an engineering specification.  Every requirement below is traceable to a software engine that already validates it in the Digital Twin (Sprint 18).

The glasses are a **standalone wearable computer**.  The phone is an optional dashboard.  Cloud is an optional enhancement.  All safety functions run on-device.

---

## 2. Document Map

| Document | Coverage |
|---|---|
| `HARDWARE_ARCHITECTURE.md` | System block diagram, component interfaces |
| `SENSOR_REQUIREMENTS.md` | Camera, GPS, IMU, compass, microphone, temperature specs |
| `CAMERA_REQUIREMENTS.md` | Camera module deep-dive (4 cameras) |
| `POWER_SYSTEM.md` | Battery, thermal, power budget, emergency mode |
| `MANUFACTURING_READINESS.md` | EVT → DVT → PVT → mass production roadmap |
| This file | Sprint summary and cross-document index |

---

## 3. Prototype Target

| Attribute | Value |
|---|---|
| Form factor | Lightweight glasses frame |
| Platform | Denarixx V1 (custom PCB) |
| Primary use case | Blind & visually impaired assistive navigation |
| Target weight | ≤ 85 g including battery |
| Continuous operation | ≥ 4 hours active use |
| Emergency mode | ≥ 8 hours (bone-conduction only, reduced AI) |
| Operating temperature | 0°C – 40°C |
| Storage temperature | −20°C – 60°C |
| IP rating target | IP53 (dust-protected, rain-resistant) |

---

## 4. Processor & AI Accelerator

### 4.1 Main SoC

| Attribute | Requirement |
|---|---|
| Architecture | ARM Cortex-A55 cluster (or equivalent) |
| CPU cores | ≥ 4 cores, ≥ 1.8 GHz sustained |
| NPU | ≥ 4 TOPS (INT8) dedicated neural processing |
| GPU | Integrated Mali-G57 class or equivalent |
| Process node | ≤ 6 nm (power efficiency target) |
| Memory interface | LPDDR5, 64-bit |
| Reference chips | Qualcomm QCS4490, MediaTek MT8370, or equivalent |

### 4.2 AI Accelerator Requirements

The on-device AI engine (Sprint 15) defines these minimum thresholds:

| Workload | Latency Budget |
|---|---|
| Critical hazard detection | ≤ 500 ms end-to-end |
| Object tracking (V12) | ≤ 150 ms per frame |
| Scene understanding | ≤ 300 ms |
| Navigation guidance (V13) | ≤ 200 ms |
| Voice wake word | ≤ 50 ms |
| Guardian alert decision | ≤ 100 ms |

All budgets defined in `src/types/onDeviceAI.ts` (`DEFAULT_LATENCY_BUDGET`).

### 4.3 RAM

| Attribute | Target |
|---|---|
| Capacity | 6 GB LPDDR5 |
| Minimum | 4 GB (reduced AI mode) |
| Allocation | 2 GB OS + 2 GB AI models + 2 GB frame buffer + runtime |

### 4.4 Storage

| Attribute | Target |
|---|---|
| Internal eMMC | 64 GB |
| User data partition | 32 GB |
| Model storage | 16 GB (on-device AI, Sprint 15) |
| OS + system | 16 GB |
| Expandable | microSD (optional, Sprint 17 HAL supports hot-swap) |

---

## 5. Connectivity

### 5.1 Wi-Fi

| Attribute | Requirement |
|---|---|
| Standard | Wi-Fi 6 (802.11ax) |
| Bands | 2.4 GHz + 5 GHz dual-band |
| Purpose | Cloud sync, OTA model updates, phone dashboard |
| Power mode | Duty-cycled when offline-safe mode active (Sprint 14) |

### 5.2 Bluetooth

| Attribute | Requirement |
|---|---|
| Standard | Bluetooth 5.3 |
| Profiles | BLE (phone companion), HFP (audio), GATT (sensor data) |
| Purpose | Phone companion link, optional hearing-aid integration |
| Range | ≥ 10 m reliable |

### 5.3 Optional eSIM / LTE

| Attribute | Requirement |
|---|---|
| Standard | LTE Cat-4 eSIM |
| Bands | Regional (EU: Band 1/3/7/20; US: Band 2/4/12/17) |
| Purpose | Stand-alone cloud link when phone absent |
| Power | Off when not needed; wake on guardian alert |
| Note | Optional in prototype; required in mass-market SKU |

### 5.4 USB-C

| Attribute | Requirement |
|---|---|
| Standard | USB 3.2 Gen 1 (5 Gbps) |
| Power delivery | USB-PD 3.0, 45 W input |
| Charging time | ≤ 90 min to 80 % (fast charge) |
| Alt mode | DisplayPort 1.4 (debugging / screen mirroring) |
| ADB | Enabled in developer mode |

---

## 6. Software Links

| Software System | Sprint | Hardware Component |
|---|---|---|
| HAL (hardwareAbstractionEngine) | 17 | All sensors — camera, mic, speaker, IMU, GPS |
| Glasses OS (glassesRuntime) | 16 | SoC, boot loader, power management |
| Digital Twin | 18 | All 11 virtual components, fault injection |
| Offline Engine | 14 | Wi-Fi/eSIM stack, edge AI model storage |
| Guardian Alert Quality | 5 | Bone-conduction speaker, microphone array |
| Navigation Intelligence | 13 | GPS, IMU, compass fusion |
| On-Device AI | 15 | NPU/AI accelerator |
| Multi-Camera Fusion | 14 | 4-camera module array |
| Street Safety (offline) | 15 | Local hazard pattern library (no internet required) |

---

## 7. Quality Gates

All the following must pass before prototype PCB is ordered:

- [ ] Digital Twin 5/5 AI validations (`digitalTwinEngine.ts`)
- [ ] HAL sensor health 100% (`sensorManagerEngine.ts`)
- [ ] On-device latency budget met (≤ 500 ms critical) (`latencyBudgetEngine.ts`)
- [ ] Manufacturing readiness score ≥ 85 (`manufacturingReadinessEngine.ts`)
- [ ] Sprint 18 simulator: 127/127 tests passing
- [ ] Offline street safety: works with no internet (Sprint 15)
- [ ] Guardian alert: never misses a vehicle crossing alert (Sprint 5)
- [ ] Battery thermal safe: no throttle below 40°C ambient

---

## 8. Next Steps

| Milestone | Target Quarter |
|---|---|
| EVT (Engineering Validation Test) | Q4 2026 |
| DVT (Design Validation Test) | Q2 2027 |
| PVT (Production Validation Test) | Q4 2027 |
| Limited manufacturing run | Q1 2028 |

See `MANUFACTURING_READINESS.md` for full roadmap.

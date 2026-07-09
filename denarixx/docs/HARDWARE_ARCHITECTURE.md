# Hardware Architecture — Denarixx Vision Glasses

**Revision:** Sprint 19 (initial engineering specification)
**Platform:** Denarixx V1 prototype

---

## 1. System Block Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DENARIXX VISION GLASSES V1                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  COMPUTE MODULE                              │   │
│  │                                                             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │  CPU     │  │  NPU     │  │  GPU     │  │  DSP     │  │   │
│  │  │ 4×A55    │  │ 4 TOPS   │  │ Mali-G57 │  │ Voice    │  │   │
│  │  │ 1.8 GHz  │  │ INT8     │  │          │  │ wake     │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │
│  │                                                             │   │
│  │  ┌─────────────────────┐  ┌──────────────────────────┐    │   │
│  │  │  RAM: 6 GB LPDDR5   │  │  Storage: 64 GB eMMC     │    │   │
│  │  └─────────────────────┘  └──────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│               ┌──────────────┼──────────────┐                      │
│               ▼              ▼              ▼                       │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  CAMERA ARRAY  │  │  SENSOR HUB  │  │  CONNECTIVITY          │ │
│  │                │  │              │  │                         │ │
│  │  Front-wide    │  │  IMU 6-axis  │  │  Wi-Fi 6 (2.4+5 GHz)  │ │
│  │  Front-tele    │  │  Compass     │  │  Bluetooth 5.3          │ │
│  │  Side-left     │  │  GPS (GNSS)  │  │  Optional eSIM/LTE      │ │
│  │  Side-right    │  │  Temp sensor │  │  USB-C 3.2 Gen 1        │ │
│  └────────────────┘  └──────────────┘  └────────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  AUDIO SYSTEM                                                │   │
│  │  Dual MEMS mic array │ Bone-conduction speaker (×2)         │   │
│  │  3rd mic (wind noise) │ Optional secondary speaker          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  POWER SYSTEM                                                │   │
│  │  Li-Po 3.7V 2500 mAh │ USB-C PD 45W │ PMIC                 │   │
│  │  Thermal management  │ Emergency power path                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Interfaces

All interfaces are defined in `src/types/hardwareHAL.ts` (Sprint 17).  The AI layer never speaks to hardware directly — it always goes through the HAL.

### 2.1 Camera Interface

```
Camera → MIPI CSI-2 (4-lane) → ISP → NPU (object detection) → HAL
```

| Signal | Spec |
|---|---|
| Protocol | MIPI CSI-2 rev 2.0 |
| Lanes | 4 per camera |
| Max bandwidth | 4.5 Gbps per camera |
| ISP | On-SoC (HDR, noise reduction, EIS) |
| HAL driver | `cameraHAL.ts` (`getCameraDriver` per platform) |
| Fallback | Up to 3 restarts → switch to secondary camera |

### 2.2 Sensor Interface

```
IMU / Compass / Temp → I2C (400 kHz) → Sensor Hub MCU → Main SoC → HAL
```

| Sensor | Protocol | HAL Driver |
|---|---|---|
| IMU (6-axis) | I2C or SPI | `imuHAL.ts` |
| Compass | I2C | `imuHAL.ts` (getHeading) |
| GPS / GNSS | UART (9600 bps) | `gpsHAL.ts` |
| Temperature | I2C | `virtualSensorEngine.ts` (Digital Twin) |

### 2.3 Power Interface

```
USB-C PD → PMIC → Battery (3.7V Li-Po) → Buck converters → SoC rails
```

| Rail | Voltage | Consumer |
|---|---|---|
| VDD_CPU | 0.75–1.0 V | CPU cluster |
| VDD_NPU | 0.8 V | Neural engine |
| VDD_IO | 1.8 V | Cameras, sensors |
| VDD_RF | 3.3 V | Wi-Fi, BT, GPS |
| VDD_AUD | 3.3 V | Mic amplifiers, bone speaker driver |

HAL driver: `batteryHAL.ts` — reads voltage, classifies health, triggers `CRITICAL_BATTERY_ANNOUNCEMENT` at ≤10%.

### 2.4 Audio Interface

```
Bone speaker driver → I2S (48 kHz) → Audio DSP → SoC
Mic array         → PDM (3.072 MHz) → Audio DSP → SoC
```

| Component | Interface | HAL |
|---|---|---|
| Bone-conduction (×2) | I2S / Class-D amp | `speakerHAL.ts` |
| MEMS mic (×3) | PDM | `microphoneHAL.ts` |

### 2.5 Display Interface (optional HUD)

```
SoC → DSI (MIPI) → Waveguide driver → Optical combiner
```

Sprint 17 HAL includes `displayHAL.ts` with modes: `hud / low-power / off / ar-overlay`.  AR overlay is a placeholder for a future sprint.  The prototype may ship display-free (bone-conduction-only) to reduce weight and cost.

---

## 3. Modularity Rules

1. **No AI engine imports a hardware driver directly.**  All hardware access is via `hardwareAbstractionEngine.ts`.
2. **Platform switching** (simulation → prototype → android-xr → linux-wearable → denarixx-v1) requires zero changes to AI code.  Only the HAL platform string changes.
3. **Camera fallback chain:** front-wide → front-tele → side-left → side-right.  The AI always has at least one camera.
4. **Sensor auto-restart:** RESTART_COOLDOWN_TICKS (5) prevents restart storms.  `sensorManagerEngine.ts` orchestrates all restarts.
5. **Power independence:** The PMIC keeps the bone-conduction speaker active even if the SoC is in emergency power mode.

---

## 4. Software Stack

```
┌─────────────────────────────────────────────┐
│  Guardian AI (Sprint 5)                     │
│  Navigation (Sprint 13)                     │
│  On-Device AI Scheduler (Sprint 15)         │
│  Social Awareness (Sprint 9)                │
├─────────────────────────────────────────────┤
│  Glasses OS / Runtime (Sprint 16)           │
│  HAL (Sprint 17)                            │
│  Digital Twin / Simulator (Sprint 18)       │
├─────────────────────────────────────────────┤
│  Linux Wearable / Android XR / Denarixx V1  │
│  (bare metal drivers — future sprints)      │
└─────────────────────────────────────────────┘
```

---

## 5. Manufacturing Readiness Gate

Before ordering prototype PCBs the following software checks must all pass:

```bash
cd denarixx && npx tsx tests/glassesSimulator.test.ts    # 127/127
cd denarixx && npx tsx tests/hardwareAbstraction.test.ts # 161/161
cd denarixx && npx tsx tests/onDeviceAI.test.ts          # 170/170
cd denarixx && npx tsx tests/multiCameraSupport.test.ts  # 164/164
cd denarixx && npm run type-check                        # zero errors
```

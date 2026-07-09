# Sensor Requirements — Denarixx Vision Glasses

**Revision:** Sprint 19
**Platform:** Denarixx V1 prototype

---

## 1. GPS / GNSS

| Attribute | Requirement | Source |
|---|---|---|
| Constellations | GPS + GLONASS + Galileo (multi-constellation) | Sprint 13 Nav |
| Sensitivity | −165 dBm tracking | Outdoor navigation |
| Cold start TTFF | ≤ 30 s | Sprint 13 |
| Hot start TTFF | ≤ 1 s | Sprint 13 |
| Accuracy | ≤ 3 m CEP (open sky) | Sprint 13 |
| Offline mode | Dead-reckoning via IMU (Sprint 14 + 17) | Sprint 17 `gpsHAL.ts` |
| Positioning modes | gnss / assisted / offline-dead-reckoning / unavailable | Sprint 17 |
| Power | ≤ 20 mW (tracking), off in offline mode | Sprint 14 |
| Privacy | 0.01° grid fuzzing, consent required | Sprint 7 `locationPrivacyEngine.ts` |
| HAL driver | `gpsHAL.ts` — acquireFix, classifyGPSQuality, activateOfflineMode | Sprint 17 |

**Fallback chain:** GNSS → Assisted GPS (A-GPS, phone bridge) → IMU dead-reckoning → last known position

---

## 2. IMU — Inertial Measurement Unit

| Attribute | Requirement | Source |
|---|---|---|
| Type | 6-axis (3-axis accelerometer + 3-axis gyroscope) | Sprint 7 |
| Accelerometer range | ±8 g | Fall detection |
| Gyroscope range | ±2000 °/s | Motion classification |
| Output rate | 200 Hz | Sprint 7 sliding window (8 samples) |
| Noise density (accel) | ≤ 100 μg/√Hz | |
| Noise density (gyro) | ≤ 7 mdps/√Hz | |
| Motion states classified | stationary / walking / running / falling | Sprint 17 `imuHAL.ts` |
| Fall detection | Yes — `detectFall()` triggers emergency alert | Sprint 17 |
| Heading fusion | IMU + compass (Sprint 7 `sensorFusionEngine.ts`) | Sprint 7 |
| Power | ≤ 5 mW (continuous), ≤ 1 mW (low-power) | Sprint 14 |
| Interface | SPI (preferred) or I2C | Sprint 17 |
| Reference chips | STMicro LSM6DSV, Bosch BMI323 | |
| HAL driver | `imuHAL.ts` — readIMU, classifyMotionState, getHeading, detectFall | Sprint 17 |

---

## 3. Compass / Magnetometer

| Attribute | Requirement | Source |
|---|---|---|
| Type | 3-axis digital magnetometer | Sprint 7 |
| Range | ±1300 μT | |
| Resolution | ≤ 0.3 μT | |
| Output rate | 100 Hz | Sprint 7 |
| Heading accuracy | ≤ 2° (calibrated) | Sprint 13 outdoor nav |
| Heading output | 0°–360° | Sprint 17 `imuHAL.ts` getHeading |
| Interference rejection | Hard iron + soft iron calibration on boot | |
| Interface | I2C | |
| Reference chips | STMicro LIS2MDL, Bosch BMM350 | |
| HAL driver | `imuHAL.ts` getHeading | Sprint 17 |

---

## 4. Temperature Sensor

| Attribute | Requirement | Source |
|---|---|---|
| Type | On-chip thermal diode + external MEMS | Sprint 18 Digital Twin |
| Range | −20°C – 85°C | |
| Accuracy | ±1°C | |
| Sample rate | 1 Hz | Sprint 18 |
| Thresholds | Warm ≥ 38°C, Hot ≥ 42°C, Critical ≥ 48°C | Sprint 18 `virtualSensorEngine.ts` |
| Action at critical | Throttle NPU, reduce camera frame rate, alert user | Sprint 18 |
| HAL driver | `virtualSensorEngine.ts` simulateTemperature | Sprint 18 (real driver: future sprint) |

---

## 5. Microphone Array

| Attribute | Requirement | Source |
|---|---|---|
| Count | 3 MEMS microphones | Sprint 17 |
| Configuration | Stereo pair (front) + wind-noise reference (side) | Sprint 17 |
| Frequency response | 100 Hz – 16 kHz (−3 dB) | Voice intelligibility |
| SNR | ≥ 65 dB(A) | |
| Sensitivity | −38 dBFS/Pa | |
| Interface | PDM (3.072 MHz) | Sprint 17 |
| Noise reduction | Beamforming + spectral subtraction (DSP) | Sprint 17 `microphoneHAL.ts` |
| Wake word | Always-on DSP path, ≤ 50 ms latency, ≤ 3 mW | Sprint 5, 17 |
| Wake words | "Hey Denarixx", "Stop", "Help" | Sprint 17 |
| Voice quality classes | excellent / good / fair / poor | Sprint 17 `getMicQuality` |
| HAL driver | `microphoneHAL.ts` — startWakeWordListening, captureMicFrame, detectWakeWord | Sprint 17 |

**Accessibility note:** microphone quality is monitored continuously.  If quality drops below `fair`, the guardian prompts the user to check fit.

---

## 6. Bone-Conduction Speaker

| Attribute | Requirement | Source |
|---|---|---|
| Count | 2 (left + right temples) | Sprint 17 |
| Driver type | Piezoelectric bone-conduction transducer | Sprint 16/17 |
| Frequency response | 200 Hz – 8 kHz (speech range) | |
| SPL | ≥ 90 dB SPL at bone (hearing loss capable) | Sprint 11 accessibility |
| Audio bypass | Ear canal remains open — ambient sound unobstructed | Safety requirement |
| Priority queue | emergency → high → normal → low | Sprint 17 `speakerHAL.ts` |
| Emergency override | Bypasses all queue levels | Sprint 17 |
| Haptic fallback | If speaker fails, haptic motor fires alert pattern | Sprint 16 |
| Interface | I2S 48 kHz, 24-bit | Sprint 17 |
| Power | ≤ 100 mW per speaker (average speech) | |
| HAL driver | `speakerHAL.ts` — priority queue, activateEmergencyOverride, processQueue | Sprint 17 |

---

## 7. Touch Controls

| Attribute | Requirement |
|---|---|
| Type | Capacitive touch strip (one per temple arm) |
| Gestures | Single tap (confirm), double tap (repeat), swipe forward (next), swipe back (previous), long press (emergency stop) |
| Accessibility | Tactile reference ridge at centre of strip |
| Glove-compatible | Yes (sensitivity threshold adjustable) |
| Water resistant | Yes (IP53) |
| HAL driver | Future sprint — `touchHAL.ts` interface defined in `hardwareHAL.ts` placeholder |

---

## 8. Voice Wake System

| Attribute | Requirement | Source |
|---|---|---|
| Always-on processor | Dedicated DSP (< 3 mW) | Sprint 17 |
| Primary wake word | "Hey Denarixx" | Sprint 5, 17 |
| Emergency trigger | "Help" or "Stop" (always active) | Sprint 5 |
| False accept rate | ≤ 1 per 24 h (quiet room) | |
| False reject rate | ≤ 5 % (85 dB SNR environment) | |
| Offline | Yes — runs without internet, no cloud processing | Sprint 14, 15 |
| Privacy | Wake word processing on-chip only; no audio sent to cloud without consent | Sprint 12 |

---

## 9. Sensor Fusion Architecture

All sensor data is merged by `sensorFusionEngine.ts` (Sprint 7) and `sensorManagerEngine.ts` (Sprint 17):

```
GPS ──────────────────────┐
IMU (accel + gyro) ───────┤  sensorFusionEngine.ts
Compass ──────────────────┤  → MotionState + Heading + Position
Temperature ──────────────┤
Battery ──────────────────┘

All 7 sensors ────────────→ sensorManagerEngine.ts
                              → SensorHealthReport
                              → autoRestartFailedSensors
                              → getSensorManagerSummary
```

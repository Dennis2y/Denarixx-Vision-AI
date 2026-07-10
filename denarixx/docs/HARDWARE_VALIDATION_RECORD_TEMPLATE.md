# Hardware Validation Record Template

**Record ID:** `HVR-YYYY-MM-DD-NNN`  
**Baseline:** `DENARIXX_VISION_PROTOTYPE_BASELINE=v0.2.0-hardware-bringup`  
**Status:** BLOCKED — not yet physically tested

> This template must be filled in by a named engineer who was physically present during the test run.  
> No field may be completed from software test output alone.  
> A record is only credible if `physicalHardwareConnected: true` and all FILL_IN fields are populated.

---

## Device Profile

| Field | Value |
|---|---|
| Device ID | FILL_IN (e.g. `denarixx-p1-001`) |
| Hardware Revision | FILL_IN (e.g. `P1.0`) |
| Compute Board | FILL_IN (e.g. `Raspberry Pi CM4 / NVIDIA Jetson Nano`) |
| Camera Module | FILL_IN (e.g. `OV9281 x2 MIPI-CSI2 @60fps`) |
| Audio Output | FILL_IN (e.g. `MAX98357A I2S → YB150 bone-conduction`) |
| Haptic Controller | FILL_IN (e.g. `DRV2605L I2C at 0x5A`) |
| IMU | FILL_IN (e.g. `ICM-42688-P SPI` or `LSM6DSO I2C at 0x6A`) |
| Battery Gauge | FILL_IN (e.g. `MAX17048 I2C at 0x36`) |
| GNSS | FILL_IN (e.g. `u-blox M10 UART` or `none`) |
| Software Baseline | `v0.2.0-hardware-bringup` |
| OS Version | FILL_IN (e.g. `Ubuntu 22.04.4 LTS aarch64`) |
| Kernel Version | FILL_IN (e.g. `5.15.0-1038-raspi`) |

---

## Test Environment

| Field | Value |
|---|---|
| Test Date | FILL_IN (ISO 8601, e.g. `2026-07-10T14:32:00Z`) |
| Test Operator | FILL_IN (full name of engineer who ran the test) |
| Location | FILL_IN (e.g. `Lab bench`, `Indoor corridor`) |
| Lighting Conditions | FILL_IN (e.g. `Office fluorescent ~500 lux`) |
| Ambient Noise | FILL_IN (e.g. `Quiet office ~35 dB`) |
| Network Condition | FILL_IN (e.g. `WiFi good signal`, `Offline`) |

---

## ONNX Model Validation

| Field | Value |
|---|---|
| Model Filename | FILL_IN (e.g. `hazard-detection-v1.onnx`) |
| SHA-256 Checksum | FILL_IN (run: `sha256sum hazard-detection-v1.onnx`) |
| Model Size | FILL_IN bytes |
| Input Shape | FILL_IN (e.g. `[1, 3, 640, 640]`) |
| Output Shape | FILL_IN (e.g. `[1, 84, 8400]`) |
| Detection Classes | FILL_IN (e.g. `80 COCO classes`) |
| Confidence Threshold | `0.45` (default) |
| NMS IoU Threshold | `0.45` (default) |
| Real Inference Tested On Device | ☐ YES / ☐ NO (must be YES for record to be credible) |

---

## Measured Performance Metrics

> All metrics must be measured from real device runs, not estimated.

| Metric | Target | Measured | Pass/Fail |
|---|---|---|---|
| Camera FPS (actual V4L2 capture) | ≥ 30 FPS | FILL_IN | ☐ |
| ONNX inference latency (P95) | ≤ 500 ms | FILL_IN ms | ☐ |
| Guardian decision latency per frame | ≤ 100 ms | FILL_IN ms | ☐ |
| Audio latency (alert → first byte) | ≤ 200 ms | FILL_IN ms | ☐ |
| Haptic latency (command → waveform) | ≤ 50 ms | FILL_IN ms | ☐ |
| Continuous session duration | ≥ 30 min | FILL_IN min | ☐ |
| Battery drain under full load | ≤ 30%/hr | FILL_IN %/hr | ☐ |
| Peak SoC temperature | ≤ 80°C | FILL_IN °C | ☐ |
| Frame drop rate | ≤ 5% | FILL_IN % | ☐ |

---

## Subsystem Validation Results

For each subsystem: `PASS` | `FAIL` | `BLOCKED` | `NOT-TESTED`

| Subsystem | Status | Notes |
|---|---|---|
| MIPI-CSI2 camera capture (V4L2) | BLOCKED | Physical prototype not yet built |
| ONNX local inference on SoC | BLOCKED | Physical prototype not yet built |
| ALSA I2S microphone capture | BLOCKED | Physical prototype not yet built |
| Bone-conduction audio output (TTS) | BLOCKED | Physical prototype not yet built |
| DRV2605L haptic controller | BLOCKED | Physical prototype not yet built |
| ICM-42688-P / LSM6DSO IMU | BLOCKED | Physical prototype not yet built |
| MAX17048 battery fuel gauge | BLOCKED | Physical prototype not yet built |
| Thermal monitoring (sysfs) | NOT-TESTED | Can test on any Linux device |
| Network monitoring (sysfs) | NOT-TESTED | Can test on any Linux device |
| Emergency button GPIO | BLOCKED | Physical prototype not yet built |
| 30-minute continuous session | BLOCKED | Physical prototype not yet built |
| Guardian alert delivered to user | BLOCKED | Physical prototype not yet built |

---

## Raw Test Evidence

> These fields must reference real captured output. Do not leave as FILL_IN if claiming PASS.

| Evidence Type | Reference |
|---|---|
| Terminal log | FILL_IN (e.g. `logs/2026-07-10-bring-up-session-1.txt`) |
| Screen recording | FILL_IN or `none` |
| Latency profile (CSV/JSON) | FILL_IN or `none` |
| Notes | FILL_IN |

---

## Overall Result

**Physical Hardware Connected:** ☐ YES / ☐ NO — *(must be YES)*

**Result:** ☐ PASS / ☐ FAIL / ☒ BLOCKED

**Justification:**  
Not yet physically tested. This template must be completed during first physical bring-up.

**Signed off by:** `FILL_IN` (engineer name, date)

---

## Next Steps Before First Bring-Up

1. Procure Raspberry Pi CM4 / Jetson Nano compute module
2. Connect OV9281 cameras to MIPI-CSI2 interface
3. Install Ubuntu 22.04 LTS (aarch64) and V4L2 drivers
4. Install Node.js 18 LTS, onnxruntime-node, i2c-bus, serialport
5. Deploy ONNX hazard detection model to `/opt/denarixx/models/`
6. Run: `DENARIXX_RUN_PHYSICAL_HARDWARE_TESTS=true DENARIXX_LOCAL_MODEL_PATH=/opt/denarixx/models/hazard-detection.onnx npx tsx tests/hardwareOnDevice.test.ts`
7. Fill in all FILL_IN fields in this template with real measured values
8. Sign off this record before commencing real-user safety trials

# Sprint 17: Hardware Abstraction Layer (HAL)

## Core Principle

**The AI communicates with the HAL, never directly with hardware.**

Denarixx Vision AI must never depend on one hardware manufacturer. The HAL ensures the same AI engines work across any hardware platform — from a Raspberry Pi prototype to the final Denarixx Vision Glasses v1.

---

## HAL Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  AI Engine Layer (Sprint 1–16)               │
│  Guardian · Navigation · Vision · Voice · Memory · Privacy   │
│                                                              │
│                communicates via HAL only                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│           Hardware Abstraction Engine (Sprint 17)            │
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Camera  │ │   Mic   │ │ Speaker │ │   IMU   │           │
│  │  HAL   │ │  HAL   │ │  HAL   │ │  HAL   │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                        │
│  │   GPS   │ │ Battery │ │ Display │  Sensor Manager        │
│  │  HAL   │ │  HAL   │ │  HAL   │  (auto-restart)         │
│  └─────────┘ └─────────┘ └─────────┘                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ driver layer
┌──────────────────────────▼──────────────────────────────────┐
│                    Hardware Drivers                          │
│                                                              │
│  Simulation · V4L2 · Android Camera2 · ALSA · gpsd          │
│  Android Location · IIO · sysfs-battery · DRM/KMS           │
│  Denarixx Native Drivers (v1 hardware)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Supported Platforms

| Platform | Label | Drivers |
|----------|-------|---------|
| `simulation` | Software Simulation | All simulated — for dev and testing |
| `prototype` | Raspberry Pi Prototype | V4L2, ALSA, gpsd, IIO, sysfs-battery |
| `android-xr` | Android XR Smart Glasses | Camera2, AudioRecord, LocationManager, Sensor API |
| `linux-wearable` | Linux Wearable | V4L2, ALSA, gpsd, IIO-IMU, DRM/KMS |
| `denarixx-v1` | Denarixx Vision Glasses v1 | All native Denarixx drivers (Q4 2027) |

Switching platforms requires only changing the `HardwarePlatform` value — the AI engines see the same interface regardless.

---

## HAL Components

### Camera HAL (`cameraHAL.ts`)
- Initialize camera by facing direction (front, side-left, side-right)
- Capture frames (simulated) with confidence scores
- Automatic fallback to secondary camera on primary failure
- Up to 3 restart attempts before fallback activation
- Supports 480p / 720p / 1080p resolution configuration
- Per-platform driver: V4L2, android-camera2, denarixx-camera-native

### Microphone HAL (`microphoneHAL.ts`)
- Wake word listener (`"Denarixx"` — from Sprint 16 `WAKE_WORD` constant)
- Speech capture with simulated amplitude and noise levels
- Noise reduction (placeholder — real implementation per-platform)
- Microphone diagnostics: error count, restart count, wake word status
- Per-platform driver: ALSA, android-audio

### Speaker HAL (`speakerHAL.ts`)
- Bone-conduction speaker abstraction (primary) with standard/bluetooth fallback
- Volume control (0–100) with clamping
- Priority speech queue: emergency → high → normal → low
- Emergency override: bypasses queue ordering for critical safety alerts
- Per-platform driver: alsa-bone-conduction, denarixx-bone-native

### IMU HAL (`imuHAL.ts`)
- Accelerometer (X/Y/Z), gyroscope (X/Y/Z), magnetometer (X/Y/Z)
- Heading calculation (0–360°, always positive)
- Motion state classification: stationary / walking / running / falling
- Fall detection (accelerometer magnitude > 15 m/s²)
- Up to 3 restart attempts before marking offline
- Per-platform driver: mpu6050, android-sensor-api, iio-imu

### GPS HAL (`gpsHAL.ts`)
- GNSS fix acquisition with simulated location
- Quality classification: excellent (≤3m) / good (≤10m) / fair (≤25m) / poor (≤50m) / unavailable
- Positioning modes: gnss / assisted / offline-dead-reckoning / unavailable
- Offline mode: switches to dead-reckoning when internet/GNSS unavailable
- Per-platform driver: gpsd, android-location, denarixx-gnss-native

### Battery HAL (`batteryHAL.ts`)
- Battery percentage, temperature, voltage, estimated life
- Charging state: charging / discharging / full / unknown
- Health assessment: good / degraded / replace
- Critical battery mode (≤10%) — Guardian stays alive last
- Thermal warnings at 45°C (throttle) and 55°C (emergency)
- Per-platform driver: sysfs-battery, android-battery-manager

### Display HAL (`displayHAL.ts`)
- HUD mode (primary) and AR overlay abstraction (future)
- Low-power display mode (brightness dim + mode change)
- Brightness levels: auto / dim / normal / bright (or numeric 0–100)
- Per-platform driver: drm-kms, android-display
- *Note: AR overlay is a placeholder in Sprint 17. Full AR rendering is a future sprint.*

---

## Sensor Manager (`sensorManagerEngine.ts`)

The Sensor Manager coordinates all HALs:

1. **Health monitoring** — runs health checks across all registered HALs
2. **Auto-restart** — automatically restarts failed sensors (up to `MAX_RESTART_ATTEMPTS = 3`)
3. **Cooldown** — prevents restart storms via `RESTART_COOLDOWN_TICKS = 5`
4. **Summary** — reports total/healthy/errored/restarting counts to the Glasses Runtime
5. **Critical issues** — surfaces blocking issues to the Guardian

Auto-restart is supported for: cameras, microphones, IMU, GPS.
Battery and display failures are reported but not auto-restarted.

---

## Integration with Sprint 1–16 Engines

| Sprint 17 HAL | Integrates with |
|---------------|----------------|
| Camera HAL | Vision Engine (Sprint 12), Multi-Camera (Sprint 14) |
| Microphone HAL | Voice Companion (Sprint 5), Wake Word (Sprint 16) |
| Speaker HAL | Voice Companion (Sprint 5), Guardian alerts (Sprint 2) |
| IMU HAL | Sensor Fusion (Sprint 7), Navigation (Sprint 13) |
| GPS HAL | Navigation (Sprint 13), Location Privacy (Sprint 7) |
| Battery HAL | Power Management (Sprint 16), Guardian (Sprint 2) |
| Display HAL | HUD future, Low-power mode (Sprint 16) |

`buildHALIntegrationBridge(system)` returns a bridge status object confirming all Sprint 1–16 engine connections.

---

## Hardware Independence

### Why HAL?

Without a HAL, every engine would call hardware APIs directly:
```
// BAD — couples AI to Android hardware
const frame = androidCamera2.captureFrame();
```

With the HAL, engines call hardware-independent functions:
```
// GOOD — hardware-independent
const { frame } = captureFrame(cameraState, tick);
```

Switching from an Android XR prototype to the final Denarixx v1 hardware requires **zero changes** to AI engines. Only the driver registration changes.

### Adding a New Platform

1. Add the platform to `HardwarePlatform` type in `hardwareHAL.ts`
2. Add driver strings to each HAL's `get*Driver()` function
3. Implement the driver (separate file, outside this sprint)
4. Pass `platform: 'your-platform'` to `createHALSystem()`

The HAL handles the rest.

---

## Future Custom Denarixx Hardware (v1 Target: Q4 2027)

Sprint 17 lays the driver interface that will connect to custom Denarixx hardware:

| HAL | Denarixx v1 Driver | Hardware |
|-----|--------------------|---------|
| Camera | `denarixx-camera-native` | 4-camera array (custom CMOS) |
| Microphone | `denarixx-mic-native` | Dual MEMS microphone |
| Speaker | `denarixx-bone-native` | Bone-conduction transducer (frame) |
| IMU | `denarixx-imu-native` | 6-DOF + 3-axis magnetometer |
| GPS | `denarixx-gnss-native` | Embedded GNSS (L1/L5 dual-band) |
| Battery | `denarixx-power-native` | Smart battery with fuel gauge IC |
| Display | `denarixx-display-native` | Waveguide AR display (future) |

When v1 hardware is ready, only driver implementations change — the HAL interface (and all Sprint 1–17 AI engines) remain unchanged.

---

## Files Created

### Types
- `src/types/hardwareHAL.ts` — All Sprint 17 HAL types, never merged with V8 `hardware.ts`

### Engines
- `src/engines/hardwareAbstractionEngine.ts` — Top-level HAL coordinator
- `src/engines/cameraHAL.ts` — Camera abstraction (init, capture, fallback, restart)
- `src/engines/microphoneHAL.ts` — Microphone abstraction (wake word, capture, noise reduction)
- `src/engines/speakerHAL.ts` — Bone-conduction speaker abstraction (queue, emergency override)
- `src/engines/imuHAL.ts` — IMU abstraction (accel, gyro, mag, motion state, fall detect)
- `src/engines/gpsHAL.ts` — GPS abstraction (GNSS, quality, offline dead-reckoning)
- `src/engines/batteryHAL.ts` — Battery abstraction (%, temp, health, critical mode)
- `src/engines/displayHAL.ts` — Display abstraction (HUD, brightness, low-power, AR placeholder)
- `src/engines/sensorManagerEngine.ts` — HAL coordinator, health checks, auto-restart

### Tests
- `tests/hardwareAbstraction.test.ts` — Sprint 17 HAL test suite

---

*Safety note: The HAL_SAFETY_NOTE constant is embedded in the engine:*
*"The AI communicates with the HAL, never directly with hardware. Hardware independence ensures Denarixx Vision AI works across all platforms."*

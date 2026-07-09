# Hardware–Software Interface Contract — Denarixx Vision Glasses

**Revision:** Sprint 20
**Platform:** Denarixx V1 prototype

---

## 1. Contract Principle

> Firmware exposes a well-defined interface.  The HAL consumes it.  The AI never speaks to firmware directly.

```
AI Engines → HAL (Sprint 17) → Firmware Bridge (Sprint 20) → Firmware → Hardware
```

---

## 2. Firmware Bridge Protocol

Defined in `firmwareBridgeEngine.ts`.

### 2.1 Device Discovery

On boot, the firmware bridge scans for connected hardware and builds the sensor registry:

```
Boot sequence:
1. firmwareBridgeEngine.startDiscovery(deviceId)
2. For each registered sensor: registerSensor(deviceId, sensorRecord)
3. discoveryScan() returns: { discovered: number, failed: number }
4. discoveryComplete = true when all expected sensors found
```

Discovery is complete when all 12 interfaces have been probed (pass or fail).

### 2.2 Sensor Registration

Each hardware component registers with the firmware bridge before the HAL can use it:

```typescript
interface FirmwareSensorRecord {
  sensorId: string;   // e.g. 'camera-front-wide'
  type: HardwareInterfaceType;
  driver: string;     // e.g. 'cameraHAL.ts (prototype)'
  registered: boolean;
}
```

The HAL queries registered sensors via `getRegisteredSensors(deviceId)`.

### 2.3 Health Reporting

The firmware bridge reports health every 5 seconds (heartbeat):

```typescript
interface FirmwareHealthReport {
  deviceId: string;
  healthStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
  registeredSensors: number;
  failedSensors: number;
  firmwareVersion: string;
  uptime: number; // seconds
}
```

Health states:
- `healthy`: all sensors registered, no failures
- `degraded`: 1–2 failed sensors (non-critical), system operational
- `critical`: critical sensor failed (camera, bone-audio, battery)
- `unknown`: bridge not yet initialised or connection lost

### 2.4 Firmware Version Reporting

```typescript
interface FirmwareInfo {
  version: string;       // semver e.g. '0.1.0-evt1'
  buildDate: string;     // ISO 8601
  platform: string;      // 'prototype' | 'android-xr' | 'linux-wearable' | 'denarixx-v1'
  capabilities: string[];// e.g. ['camera', 'imu', 'gps', 'ota']
  halVersion: string;    // must match HAL spec version
  bootloaderVersion: string;
}
```

Version compatibility: `halVersion` in FirmwareInfo must match the HAL spec version in `hardwareAbstractionEngine.ts`.  Mismatch → bridge enters `error` state.

### 2.5 Capability Flags

```typescript
capabilityFlags: {
  'multi-camera': boolean,     // 4-camera array present
  'bone-audio': boolean,       // bone-conduction speaker present
  'gps': boolean,              // GNSS module present
  'display': boolean,          // HUD display present (optional)
  'eSIM': boolean,             // cellular module present (optional)
  'OTA': boolean,              // OTA update capable
  'haptic': boolean,           // haptic motor present
}
```

### 2.6 OTA Update Hooks

OTA is triggered by the deployment engine (Sprint 20 `hardwareDeploymentEngine.ts`):

```
1. checkForOTA(deviceId) → { available: boolean, version: string | null }
2. If available: scheduleOTA(deviceId) → starts in next maintenance window
3. OTA applies firmware + AI models + locale packs
4. On success: firmware bridge reboots, re-registers all sensors
5. On failure: rollback to previous version (rollbackVersion in deployment stage)
```

Safety rule: OTA never applies during an active Guardian session or navigation session.

---

## 3. HAL Platform Driver Contract

For the `'prototype'` platform, each HAL driver must implement a real hardware call instead of the simulation stub:

| HAL File | Simulation stub | Prototype implementation |
|---|---|---|
| `cameraHAL.ts` | Returns simulated frame data | Opens /dev/video0–3 via V4L2 |
| `microphoneHAL.ts` | Returns simulated audio frames | Reads from ALSA capture device |
| `speakerHAL.ts` | Logs speech output | Writes to ALSA playback device |
| `imuHAL.ts` | Returns simulated IMU readings | Reads via sysfs IIO interface |
| `gpsHAL.ts` | Returns simulated GPS fix | Reads NMEA from UART |
| `batteryHAL.ts` | Returns simulated charge % | Reads from I2C fuel gauge IC |
| `displayHAL.ts` | No-op | Writes to DRM/KMS device |
| `buttonHAL.ts` (planned) | No-op | Reads GPIO via libgpiod |

---

## 4. Error Handling Contract

| Error | Firmware response | HAL response | AI response |
|---|---|---|---|
| Camera failure | Report in health status | Activate fallback camera | Announce `CAMERA_FAILURE_MESSAGE` |
| GPS loss | Report in health status | Activate dead-reckoning | Navigation continues (IMU mode) |
| IMU failure | Report in health status | Return last valid reading for 5 s | Alert user after 5 s |
| Battery critical | Report `critical` health | Trigger `CRITICAL_BATTERY_ANNOUNCEMENT` | Enter emergency power mode |
| Bone-audio failure | Report in health status | Return error to speakerHAL | Activate haptic fallback |
| Firmware mismatch | Enter bridge `error` state | Log error, use simulation fallback | System continues in simulation mode |
| OTA failure | Rollback to previous version | Re-register all sensors | Log failure, continue normal operation |

---

## 5. Data Flow Example: Guardian Alert

```
1. Camera frame arrives (cameraHAL, prototype MIPI CSI-2 driver)
2. visionInferenceEngine processes frame (Sprint 12, NPU)
3. Hazard detected → guardianWordingEngine selects message (Sprint 5)
4. alertQualityEngine decides to speak (Sprint 5 — 6 triggers)
5. speakerHAL.processQueue() → bone-conduction I2S driver
6. firmwareBridgeEngine records health heartbeat
```

Total path from camera to audio: ≤ 500 ms (critical path, Sprint 15 latency budget).

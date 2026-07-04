# V7 Phone Sensor Integration

Phase 7 connects Denarixx Vision AI to the device's physical sensors —
GPS, compass, accelerometer, battery, and vibration — for richer mobility
guidance that adapts to how the user is actually moving.

---

## Sensor Stack

| Sensor | Browser API | Permission |
|--------|-------------|------------|
| GPS | `navigator.geolocation.watchPosition` | `prompt` (user gesture) |
| Compass | `DeviceOrientationEvent` | iOS 13+: gesture required |
| Accelerometer / IMU | `DeviceMotionEvent` | iOS 13+: gesture required |
| Battery | `navigator.getBattery()` | Automatic |
| Haptic | `navigator.vibrate()` | Automatic |

All sensors gracefully degrade: if a sensor is unavailable (desktop,
denied permission, SSR), the rest continue working and the session falls
back to simulation data for any missing input.

---

## Architecture

```
Browser APIs
    │
    ▼
useDeviceSensors (React hook)
    ├─ GPS:     navigator.geolocation.watchPosition()
    ├─ Compass: window.addEventListener('deviceorientation', ...)
    ├─ IMU:     window.addEventListener('devicemotion', ...)
    ├─ Battery: navigator.getBattery() + level/charging events
    └─ Vibrate: navigator.vibrate(pattern)
    │
    ▼
SensorFusionEngine (pure)
    ├─ classifyMotion()          → MotionState (8-sample sliding window)
    ├─ fuseHeading()             → degrees 0–360 (compass preferred)
    ├─ isLowPowerMode()          → boolean (< 20% + not charging)
    ├─ urgencyModifier()         → 'elevate' | 'normal' | 'reduce'
    ├─ recommendedFrameInterval()→ 2000–8000 ms based on motion + battery
    └─ fuse()                    → SensorContext
    │
    ▼
LocationPrivacyEngine (pure)
    ├─ filter(gps, level)        → FuzzedLocation | null
    ├─ mayStore(level, memory)   → boolean
    ├─ distanceMetres()          → Haversine distance
    └─ locationNote()            → human-readable location string
    │
    ▼
useVisionSession
    ├─ Adjusts frame interval via recommendedFrameInterval()
    ├─ Adds motionNote() to spatial guidance prefix
    ├─ Vibrates for critical/high alerts
    └─ Passes sensorContext to mobilityEngine.analyze()
```

---

## Motion Classification

The `SensorFusionEngine` uses a sliding 8-sample window of accelerometer
magnitude to classify motion, avoiding false transitions on spikes.

| State | Magnitude (m/s²) | Rotation (°/s) | GPS speed (m/s) |
|-------|-----------------|-----------------|-----------------|
| standing | < 0.3 | any | < 0.3 |
| walking | 0.3–2.5 | < 25 | 0.3–2.0 |
| turning | > 0.3 | ≥ 25 | — |
| running | 2.5–6.0 | < 25 | 2.0–5.0 |
| riding | > 6.0 or very smooth | — | > 5.0 |

**Effect on guidance:**
- `running` / `riding` → urgency elevated, frame interval 2 s
- `standing` → urgency reduced, frame interval 5 s  
- `turning` → motion note added to spatial guidance
- Low power → frame interval 8 s, audio reduced

---

## Location Privacy

Default is `fuzzy` precision — coordinates are snapped to a 0.01° grid (~1 km):

```
User's actual position:  51.5074°N, 0.1278°W
Fuzzy position shown:    51.51°N, 0.13°W  (nearest 0.01° grid)
Reported accuracy:       ±555 m  (half the grid in metres)
```

| Level | Behaviour | Store to memory? |
|-------|-----------|-----------------|
| `none` | GPS not used | Never |
| `fuzzy` | 1 km grid snap | Only if memory enabled |
| `precise` | Full coordinates | Only if memory enabled |

Precise location requires two explicit consents:
1. `locationPrecision: 'precise'` in Settings
2. `locationMemoryEnabled: true` in Settings

---

## Vibration Patterns

Critical alerts trigger haptic feedback when `vibrationEnabled = true`.

| Pattern | Sequence (ms) | Use case |
|---------|---------------|----------|
| `critical` | 300·100·300·100·300 | Immediate hazard stop |
| `high` | 200·100·200 | High urgency alert |
| `medium` | 150 | Medium alert |
| `stop` | 500·200·500 | Emergency stop |
| `waypoint` | 50·50·50 | Location saved |
| `clear` | 80 | Path clear confirmation |
| `turn_left` | 50·30·100 | Turn left instruction |
| `turn_right` | 100·30·50 | Turn right instruction |
| `confirm` | 30 | Acknowledge command |

---

## Battery-Aware Mode

When `batteryAwareMode = true` and battery drops below 20%:

- Frame interval: 3 s → 8 s
- Motion: `standing` → 5 s, `running` → 2 s (these override low power only when not in low power)
- Audio: `low` priority guidance suppressed
- UI: "Low Power" badge shown in Sensor Status panel

---

## Privacy Settings (Settings page)

| Setting | Default | Description |
|---------|---------|-------------|
| `locationEnabled` | `false` | Whether GPS is requested |
| `locationPrecision` | `'fuzzy'` | Coordinate precision |
| `locationMemoryEnabled` | `false` | Save locations to AI memory |
| `motionEnabled` | `true` | Request DeviceMotion/Orientation |
| `vibrationEnabled` | `true` | Haptic alerts |
| `batteryAwareMode` | `true` | Reduce processing on low battery |

---

## File Map

| File | Role |
|------|------|
| `src/types/sensors.ts` | All V7 types (GPSReading, SensorContext, VibrationPattern, …) |
| `src/engines/sensorFusionEngine.ts` | Motion classification, heading fusion, battery mode |
| `src/engines/locationPrivacyEngine.ts` | GPS fuzzing, storage consent, distance |
| `src/hooks/useDeviceSensors.ts` | React hook — all browser sensor APIs |
| `src/components/session/SensorStatusPanel.tsx` | Live sensor status UI |
| `tests/sensorFusion.test.ts` | Comprehensive V7 tests |

---

## Tests

```bash
cd denarixx && npx tsx tests/sensorFusion.test.ts
```

Covers 50+ cases:
- Motion classification: standing / walking / running / turning / GPS fallback / reset
- Heading fusion: compass priority, GPS fallback, null fallback, 8-direction conversion
- Battery mode: low power thresholds, charging override, awareness toggle
- Urgency modifier: all 6 motion states
- Frame interval: motion + battery combinations
- Location privacy: none / fuzzy / precise filtering, grid snapping, storage consent
- Haversine distance: real-world distance, same-point zero
- Location note: null input, positive/negative coordinates

---

## Future Extensions

- **WebXR + IMU:** Spatial tracking for AR overlays in WebXR sessions
- **Wi-Fi positioning:** Supplement GPS indoors using `NetworkInformation`
- **Geofencing:** Use `watchPosition` delta to trigger landmark recall when re-entering a known area
- **Smart glasses IMU:** Replace phone accelerometer with glasses-native sensor feed (Phase 8)

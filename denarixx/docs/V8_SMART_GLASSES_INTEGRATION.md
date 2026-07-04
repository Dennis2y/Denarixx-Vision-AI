# V8 Smart Glasses Integration Layer

Phase 8 adds a **Hardware Abstraction Layer (HAL)** to Denarixx Vision AI.
It abstracts away physical device differences so the session pipeline can
route camera, audio, and haptic I/O to whichever device is currently
connected — or gracefully fall back to the phone when nothing is paired.

Phase 8 is a **simulation layer**: the engine contracts are fully defined
and testable, but real Bluetooth/WebUSB/WebRTC calls are behind feature
flags that will activate once hardware is available.

---

## Supported Device Types

| Device | Protocol | Camera | Audio | Haptic |
|--------|----------|:------:|:-----:|:------:|
| Phone Camera | Internal | ✓ | — | via V7 |
| Denarixx Vision Glasses | Wi-Fi / WebRTC | ✓ | Bone-conduction | — |
| Bluetooth Camera Clip | Bluetooth | ✓ | — | — |
| Wi-Fi Streaming Glasses | Wi-Fi / WebRTC | ✓ | — | — |
| USB Camera | WebUSB | ✓ | — | — |
| Bone-Conduction Headset | Bluetooth | — | ✓ | — |
| Haptic Wristband | Bluetooth | — | — | ✓ |
| Smart Cane | Bluetooth / Serial | — | — | ✓ |

---

## Architecture

```
Session Page
    │
    ├── useWearableDevice (hook)
    │   ├── WearableConnectionEngine  ← pure engine, device lifecycle
    │   ├── HardwareBridgeEngine      ← pure engine, I/O routing
    │   └── DeviceCapabilityEngine   ← pure engine, browser API detection
    │
    └── useVisionSession (hook)
        └── receives safetyMessage from disconnect event
            → speaks "Vision device disconnected. Please stop and check carefully."
```

---

## Device Connection Lifecycle

```
undiscovered
    │ discover()
    ▼
discovered
    │ beginConnect()
    ▼
connecting  ──── timeout / error ──→  error
    │ finaliseConnect()
    ▼
connected
    │ activate()
    ▼
active  ◄──── heartbeat() every 5 s ────┐
    │                                     │
    │ signal degraded → unstable          │
    │ signal lost → disconnect event ─────┘
    │ user_requested → disconnect
    ▼
disconnected
```

---

## I/O Source Priority

### Camera source (highest priority first)
1. `denarixx_glasses` — Denarixx Vision Glasses
2. `wifi_glasses` — any Wi-Fi streaming glasses
3. `bluetooth` — Bluetooth camera clip
4. `usb` — USB camera
5. `phone` — phone camera (always available as fallback)
6. `simulation` — synthetic data

### Audio output
1. `bone_conduction` — bone-conduction headset or glasses with BC audio
2. `phone_speaker` — default

### Haptic output
1. `smart_cane` — cane vibration
2. `wrist_haptic` — haptic wristband motor
3. `phone_vibration` — phone vibration (V7)

---

## Safety Rules

These are enforced as constants in `hardwareBridgeEngine.ts`:

| Rule | Value | Meaning |
|------|-------|---------|
| `noVideoStorage` | `true` | Video frames MUST NOT be saved to disk or memory |
| `noFaceRecognition` | `true` | Face recognition MUST NOT be enabled on any camera feed |
| `warnOnVisionDisconnect` | `true` | User MUST be warned if a camera device disconnects during an active session |
| `phoneCameraFallback` | `true` | Phone camera is always available as a fallback source |

**Disconnect warning message** (spoken aloud via TTS):
> "Vision device disconnected. Please stop and check carefully."

The session hook automatically switches to phone camera (if available) after a glasses disconnect.

---

## Browser API Requirements

| Device | Required API | Chrome | Firefox | Safari |
|--------|-------------|:------:|:-------:|:------:|
| Phone camera | `getUserMedia` | ✓ | ✓ | ✓ |
| Bluetooth devices | Web Bluetooth | ✓ | ✗ | ✗ |
| Wi-Fi glasses | WebRTC | ✓ | ✓ | ✓ |
| USB camera | WebUSB | ✓ | ✗ | ✗ |
| Smart cane | Web Serial | ✓ | ✗ | ✗ |

---

## Connection Health

| Health level | Signal strength | Effect |
|-------------|----------------|--------|
| `excellent` | ≥ 80% | Full frame rate, all features |
| `good` | 60–80% | Full frame rate |
| `weak` | 30–60% | Consider reducing frame rate |
| `unstable` | < 30% | Warn user, prepare fallback |
| `lost` | 0% | Trigger disconnect event |

Heartbeats run every 5 s on all active devices. Battery level drains 0.1%
per heartbeat in simulation (representing ~8 h of use on a 5000 mAh battery).

---

## Devices Page (`/devices`)

The Devices page shows:
- All discovered/connected devices with status badges
- Per-device: battery bar, signal strength, connect/disconnect button
- Active I/O source selectors (camera, audio, haptic)
- Browser capability summary
- Safety rules reminder

---

## File Map

| File | Role |
|------|------|
| `src/types/hardware.ts` | All V8 types (DeviceKind, ConnectedDevice, HardwareIOConfig, …) |
| `src/engines/wearableConnectionEngine.ts` | Device registry, connect/disconnect lifecycle, heartbeat simulation |
| `src/engines/deviceCapabilityEngine.ts` | Browser API detection, I/O priority, setup instructions |
| `src/engines/hardwareBridgeEngine.ts` | I/O routing, disconnect handling, safety rules |
| `src/hooks/useWearableDevice.ts` | React hook — device state, connect/disconnect, heartbeat timer |
| `src/app/devices/page.tsx` | Devices management UI |
| `tests/hardwareBridge.test.ts` | Comprehensive V8 tests |

---

## Tests

```bash
cd denarixx && npx tsx tests/hardwareBridge.test.ts
```

Covers 50+ cases across all three engines:
- Device registry: initial state, connect lifecycle, disconnect, getConnected, getByCapability
- Disconnect simulation: vision device warning, non-vision message, session state check
- Heartbeat: signal variation, battery drain, lastHeartbeat update
- Safety fallback: ensurePhoneCamera, unknown device errors
- I/O routing: no-device defaults, glasses priority, setCameraSource validation
- Browser capabilities: all API detection paths, canConnect, block reasons
- SAFETY_RULES constants: all four rules enforced

---

## Future Extensions

- **Real Bluetooth pairing:** Swap `beginConnect()` stub for `navigator.bluetooth.requestDevice()` call
- **WebRTC glasses stream:** Replace simulation source with `RTCPeerConnection` receiving glasses feed
- **Denarixx Vision Glasses firmware:** OTA update, low-latency H.264 stream, IMU fusion
- **Smart cane Serial protocol:** Obstacle pings via Web Serial, proximity distance integration with spatial engine
- **Phase 9 integration:** Human behaviour engine will consume wearable IMU data for social-distance awareness

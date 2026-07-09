# Sprint 16: Standalone Smart Glasses Operating System

## Core Principle

**The glasses are the primary computer. The phone is optional. The cloud is optional.**

Every core safety feature — hazard detection, Guardian alerts, navigation, speech guidance, memory, and emergency response — runs entirely on the Denarixx Vision Glasses compute module, with no phone and no internet required.

This is not a phone accessory. It is a wearable computer.

---

## Standalone Architecture

```
┌─────────────────────────────────────────────────────────┐
│               Denarixx Vision Glasses                    │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ 4 Cameras  │  │  IMU + GPS │  │  2 Microphones     │ │
│  │ Front/Side │  │  Compass   │  │  (bone-conduction  │ │
│  │            │  │  Temp/Batt │  │   output)          │ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Glasses Compute Module                │  │
│  │                                                    │  │
│  │  Boot Sequence Engine → OS Runtime Engine          │  │
│  │  Sensor Fusion (OS level) → Vision Pipeline        │  │
│  │  Cognitive Guardian → Alert Throttle               │  │
│  │  Navigation Engine → Spatial Reasoning             │  │
│  │  Voice Companion → Language Engine                 │  │
│  │  Memory Engine → Privacy Dashboard                 │  │
│  │  Power Management → Device Health Monitor          │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ (optional)
        ┌──────────────────┴───────────────────┐
        │                                      │
        ▼                                      ▼
  ┌──────────────┐                    ┌──────────────────┐
  │  Phone App   │                    │  Cloud Services  │
  │  (Dashboard) │                    │  (Enhancement)   │
  │  Optional    │                    │  Optional        │
  └──────────────┘                    └──────────────────┘
```

---

## Boot Sequence

The glasses execute a 7-phase startup sequence on every power-on:

| Phase | Label | Description | Typical Duration |
|-------|-------|-------------|-----------------|
| 1 | Power On | Hardware self-test, voltage check | 120ms |
| 2 | Hardware Check | All subsystem self-diagnostics | 250ms |
| 3 | Sensor Init | Cameras, IMU, GPS, compass, microphones | 800ms |
| 4 | AI Load | Edge models loaded from flash storage | 1200ms |
| 5 | Guardian Start | Cognitive Guardian engine active | 400ms |
| 6 | Wake Word | Wake word listener active ("Denarixx") | 200ms |
| 7 | Ready | Fully operational standalone OS | 50ms |

**Total estimated boot time: ~3 seconds**

If any phase fails, the boot sequence stops, announces the fault via bone-conduction audio, and provides recovery guidance. Wake word failure is non-critical — Guardian continues operating, voice commands revert to touch input only.

---

## Runtime Modes

The glasses automatically select the optimal mode based on available connections:

| Mode | When Active | Capabilities |
|------|-------------|--------------|
| **Standalone** | No phone, no cloud | All safety features via glasses compute |
| **Phone Companion** | Phone connected | + settings dashboard, memory sync |
| **Cloud Enhanced** | Internet available | + enhanced scene AI, model updates |
| **Emergency** | Battery ≤ 10% | Guardian + hazard + voice + alerts only |

**The glasses never degrade to an unsafe state.** Moving from cloud-enhanced to standalone simply removes optional enhancements — all safety functions remain fully active.

---

## Sensor Array (10 Sensors)

All sensors are on-device. The glasses never depend on a phone's sensors.

| Sensor | Type | Critical? | Purpose |
|--------|------|-----------|---------|
| Front Camera | Vision | ✅ | Primary hazard detection |
| Left Side Camera | Vision | — | Peripheral awareness |
| Right Side Camera | Vision | — | Peripheral awareness |
| IMU | Motion | ✅ | Fall detection, step counting, motion classification |
| GPS | Location | — | Outdoor navigation |
| Compass | Direction | — | Heading, spatial orientation |
| Left Microphone | Audio | ✅ | Voice input, environmental sound |
| Right Microphone | Audio | — | Stereo audio input |
| Temperature | Environment | — | Thermal management |
| Battery Sensor | Power | ✅ | Power monitoring, warning system |

Critical sensors (marked ✅) trigger immediate Guardian alerts if they fail.

---

## Power & Battery Management

The power management system ensures Guardian remains active as long as possible:

| Battery Level | Threshold | Action |
|---------------|-----------|--------|
| Full | 100% | All features active |
| High | 80–99% | All features active |
| Normal | 21–79% | All features active |
| Low | ≤ 20% | Voice announcement · Social/cloud features reduced |
| Critical | ≤ 10% | Bone-conduction warning · Emergency mode · Guardian only |

Thermal throttling activates at 45°C. Non-essential features are disabled above this temperature. At 55°C the glasses announce a critical thermal warning.

**The Guardian engine is never disabled by the power system. It is the last feature to stop.**

---

## Device Health Monitoring

7 components are continuously assessed on the glasses:

1. **Compute Module** — boot success, processor health
2. **Camera System** — active cameras, confidence scores
3. **Audio System** — microphone status
4. **Sensor Array** — IMU, GPS, compass, temperature, battery sensor
5. **Power System** — battery level, thermal state
6. **Storage** — AI model flash storage integrity
7. **Guardian Engine** — core safety engine status

Health score: 0–100. Below 30 = critical. Guardian active = operational.

---

## Emergency Mode

Emergency mode activates automatically when:
- Battery drops to ≤ 10%
- User manually activates it
- Critical hardware failure

In emergency mode, the glasses continue providing:
- ✅ Obstacle detection
- ✅ Guardian safety alerts
- ✅ Voice guidance (bone-conduction)
- ✅ Emergency alerts
- ✅ Navigation (basic)
- ✅ Companion memory (local)
- ✅ Speech output

And disable:
- Social awareness (power-intensive)
- Cloud sync
- Phone companion link (non-safety)
- Enhanced scene AI

The spoken announcement: *"Emergency mode active. Core safety features running at minimum power."*

---

## Why No Phone Is Required

Previous generations of assistive tech required a smartphone to do the computation. Denarixx Vision Glasses are fundamentally different:

1. **On-device AI** — All edge models load directly onto the glasses compute module flash storage at boot. No phone needed to run hazard detection or Guardian.

2. **Local sensor fusion** — All 10 sensors are on the glasses frame. IMU, GPS, cameras, and microphones report directly to the glasses compute module.

3. **Bone-conduction audio** — Speech output goes directly through the glasses frame. No Bluetooth headset or phone speaker required.

4. **Local memory** — Conversational memory and learned preferences are stored on the glasses. Cloud sync is an optional enhancement, not a requirement.

5. **Standalone navigation** — Indoor and outdoor navigation runs from on-device maps and sensor data. GPS and compass are built in.

The phone app is a *companion dashboard* — useful for settings, viewing reports, and optional memory sync — but removing the phone never reduces safety.

---

## Future Custom Hardware Vision

Sprint 16 lays the software foundation for the full custom Denarixx Vision Glasses hardware:

- **Glasses compute module** — ARM-class SoC with NPU for edge AI
- **4-camera array** — front + bilateral side cameras for 200°+ field of awareness
- **Bone-conduction transducers** — embedded in the glasses frame (no earphones)
- **Haptic feedback** — 8 vibration patterns in the frame
- **Flash storage** — 32GB+ for AI models and local memory
- **Wireless charging** — daily charging cycle target 8+ hours
- **BLE/WiFi** — phone companion and cloud when available

The sprint 16 engines are designed to map directly onto this hardware. All engine interfaces (boot, sensor, power, health, runtime) correspond to real hardware subsystems.

---

## Phone Dashboard Pages

The following web pages (phone dashboard only) let users monitor their glasses:

| Page | Path | Purpose |
|------|------|---------|
| Glasses OS Status | `/glasses-status` | Runtime mode, features, emergency |
| Device Health | `/device-health` | Component health scores |
| Battery & Power | `/battery` | Battery level, drain, warnings |
| Sensor Array | `/sensors` | 10 sensors, fusion frame, restart |
| Boot Diagnostics | `/boot-diagnostics` | 7-phase boot sequence results |

These pages show the glasses state — they do not control safety functions.

---

## Files Created

### Types
- `src/types/glassesOS.ts` — All Sprint 16 types: boot phases, sensors, power, health, runtime, emergency

### Engines
- `src/engines/glassesRuntimeEngine.ts` — Main OS orchestrator, mode determination, feature selection
- `src/engines/bootSequenceEngine.ts` — 7-phase boot sequence simulation
- `src/engines/glassesPowerEngine.ts` — Power classification, drain estimation, warning system
- `src/engines/glassesOSSensorEngine.ts` — 10-sensor lifecycle, fusion frame, anomaly detection
- `src/engines/deviceHealthEngine.ts` — 7-component health assessment

### Pages
- `src/app/glasses-status/page.tsx`
- `src/app/device-health/page.tsx`
- `src/app/battery/page.tsx`
- `src/app/sensors/page.tsx`
- `src/app/boot-diagnostics/page.tsx`

### Tests
- `tests/glassesRuntime.test.ts` — Sprint 16 test suite

---

*Safety note: The glasses boot sequence completes before any user interaction. Guardian is active before the wake word listener starts. The user is never unprotected after power-on.*

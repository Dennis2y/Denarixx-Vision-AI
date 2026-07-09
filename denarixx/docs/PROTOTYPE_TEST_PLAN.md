# Prototype Test Plan — Denarixx Vision Glasses EVT

**Revision:** Sprint 20
**Platform:** Denarixx V1 prototype (EVT)
**Purpose:** Validate prototype hardware meets EVT acceptance criteria before DVT.

---

## 1. Test Environment

| Attribute | Value |
|---|---|
| Platform | Linux Wearable or Android XR (EVT hardware) |
| HAL platform | `'prototype'` |
| Firmware version | 0.x.x-evtN |
| Test runner | Manual (EVT) + automated CI (Sprint 17 HAL tests) |
| Tester | Hardware + software engineer pair |
| Duration | 2–3 days per full test run |

---

## 2. Test Scenarios (8 categories)

### 2.1 Indoor Navigation

**Sprint source:** 13 (navigation), 17 (HAL), 14 (cameras)

| Step | Action | Expected |
|---|---|---|
| 1 | Boot device in shopping mall | GPS unavailable → indoor mode activates |
| 2 | Say "Hey Denarixx, navigate to café" | Bone-conduction: "Starting indoor navigation" |
| 3 | Walk through 3 rooms | Landmark guidance every 15–20 steps |
| 4 | Encounter obstacle (chair) | Guardian alert within 500 ms |
| 5 | Arrive at destination | "You have arrived" via bone-conduction |

**Pass criteria:**
- Indoor mode detected within 5 s of GPS loss
- Landmark announced within 2 m of each landmark
- Obstacle alert latency ≤ 500 ms (Sprint 15 critical budget)

---

### 2.2 Outdoor Navigation

**Sprint source:** 13, 7 (sensor fusion), 15 (offline street safety)

| Step | Action | Expected |
|---|---|---|
| 1 | Boot device outdoors | GPS acquires fix within 30 s |
| 2 | Say "navigate to the park" | Route guidance begins |
| 3 | Approach pedestrian crossing | "Approaching crossing — use your judgement" |
| 4 | Vehicle approaches from right | Side-right camera triggers alert |
| 5 | Cross road | Continuous guidance during crossing |

**Pass criteria:**
- GPS cold start TTFF ≤ 30 s (Sprint 19 sensor spec)
- Crossing advisory: never says "safe to cross" (enforced in crossingDecisionEngine)
- Vehicle alert from side camera within 500 ms

---

### 2.3 Obstacle Detection

**Sprint source:** 5 (Guardian), 12 (vision pipeline), 14 (multi-camera)

| Step | Action | Expected |
|---|---|---|
| 1 | Walk towards a step | Guardian alert 1–2 m before step |
| 2 | Walk towards a glass door | Alert with directional hint |
| 3 | Walk towards a low shelf | Alert with "object at waist height" |
| 4 | Camera partially obstructed | Alert: "Camera obstructed — clean lens" |
| 5 | All 4 cameras tested individually | Each camera triggers correct zone alert |

**Pass criteria:**
- ≥ 95 % detection rate for objects at 1–3 m
- Alert latency ≤ 500 ms
- Camera zone labelling correct (front / peripheral-left / peripheral-right)

---

### 2.4 Low Battery

**Sprint source:** 16 (power management), 17 (battery HAL), 15 (on-device AI)

| Step | Action | Expected |
|---|---|---|
| 1 | Battery reaches 20 % | Bone-conduction: "Battery low — 20% remaining" |
| 2 | Battery reaches 10 % | `CRITICAL_BATTERY_ANNOUNCEMENT` plays |
| 3 | Frame rate drops to emergency (2 fps) | Guardian still alerts for critical hazards |
| 4 | Side cameras enter standby | Front-wide camera remains active |
| 5 | Battery at 5 % | Emergency mode: bone-conduction + wake word only |

**Pass criteria:**
- 20% alert announced within 5 s of threshold crossing
- 10% announcement plays exactly once (no spamming)
- Emergency mode activates correctly, critical alerts still pass through

---

### 2.5 Offline Mode

**Sprint source:** 14 (offline engine), 15 (street safety offline), 15 (edge AI)

| Step | Action | Expected |
|---|---|---|
| 1 | Disable Wi-Fi | Bone-conduction: "Offline mode — local AI active" |
| 2 | Walk towards vehicle | Guardian alerts from local model (no cloud) |
| 3 | Approach crossing | Offline crossing advisory works |
| 4 | Re-enable Wi-Fi | "Connection restored" |
| 5 | Navigate 30 min offline | No degradation in critical alerts |

**Pass criteria:**
- Offline mode activated within 3 s of connectivity loss
- All critical hazard types (vehicle, step, bollard) detected offline
- Cloud-only features (enhanced scene description) gracefully degraded

---

### 2.6 Camera Interruption

**Sprint source:** 17 (camera HAL), 14 (camera health), 15 (street safety)

| Step | Action | Expected |
|---|---|---|
| 1 | Physically cover front-wide camera | `CAMERA_FAILURE_MESSAGE` within 2 s |
| 2 | System switches to front-tele | "Switching to secondary camera" |
| 3 | Uncover front-wide camera | "Primary camera restored" |
| 4 | Disconnect all 4 cameras | Emergency alert: "All cameras unavailable" |
| 5 | Reconnect cameras | HAL auto-restart sequence |

**Pass criteria:**
- Camera failure detected within 2 s
- Fallback camera activates within 3 s
- All-camera failure triggers immediate bone-conduction alert (safety rule)

---

### 2.7 Sensor Recovery

**Sprint source:** 17 (sensor manager), 17 (IMU HAL, GPS HAL)

| Step | Action | Expected |
|---|---|---|
| 1 | GPS signal lost (tunnel) | IMU dead-reckoning activates |
| 2 | GPS signal restored (exit tunnel) | GPS re-acquired, navigation resumes |
| 3 | IMU sensor reset (simulate crash) | Auto-restart within 5 ticks (RESTART_COOLDOWN_TICKS) |
| 4 | Compass calibration drift | Recalibration prompt via bone-conduction |
| 5 | All sensors restart in sequence | No guardian alerts dropped during restart |

**Pass criteria:**
- GPS → IMU fallback transition ≤ 2 s
- IMU auto-restart completes within RESTART_COOLDOWN_TICKS (5 ticks = 5 s at 1 Hz)
- No safety-critical alert missed during any sensor restart

---

### 2.8 Emergency Alerts

**Sprint source:** 5 (Guardian), 15 (critical bypass), 17 (speaker HAL)

| Step | Action | Expected |
|---|---|---|
| 1 | Vehicle approaching at speed | Critical bypass: alert plays regardless of cooldown |
| 2 | Say "Help" | Emergency mode activates, logs incident |
| 3 | Fall detected by IMU | Alert: "Fall detected" + haptic pattern |
| 4 | Long-press button | Emergency stop activated |
| 5 | Battery critical during active navigation | Emergency power mode, navigation pauses |

**Pass criteria:**
- Critical alerts bypass cooldown 100 % of the time (Sprint 5 `CRITICAL_BYPASS` rule)
- "Help" wake word triggers within 50 ms (always-on DSP path)
- Fall detection alert within 200 ms of impact

---

## 3. EVT Acceptance Summary

| Test | Pass threshold | Critical |
|---|---|---|
| Indoor navigation | 5/5 steps | No |
| Outdoor navigation | 5/5 steps | No |
| Obstacle detection | ≥ 95 % detection, ≤ 500 ms | **Yes** |
| Low battery | All thresholds triggered | **Yes** |
| Offline mode | Full offline operation 30 min | **Yes** |
| Camera interruption | Fallback ≤ 3 s | **Yes** |
| Sensor recovery | No dropped alerts | **Yes** |
| Emergency alerts | 100 % critical bypass | **Yes** |

All 6 critical tests must pass for EVT sign-off.

---

## 4. Automated Test Coverage

Before EVT, run all automated tests:

```bash
cd denarixx
npx tsx tests/prototypeIntegration.test.ts     # Sprint 20
npx tsx tests/hardwareAbstraction.test.ts       # Sprint 17 HAL (161/161)
npx tsx tests/glassesSimulator.test.ts          # Sprint 18 Digital Twin (127/127)
npx tsx tests/guardianAlertQuality.test.ts      # Sprint 5 (60/60)
npx tsx tests/streetSafety.test.ts              # Sprint 15 offline (143/143)
npx tsx tests/visionPipeline.test.ts            # Sprint 12 (148/148)
npx tsx tests/navigationEngine.test.ts          # Sprint 13 (151/151)
```

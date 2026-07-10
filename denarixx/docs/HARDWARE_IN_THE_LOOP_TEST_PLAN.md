# Hardware-in-the-Loop (HILT) Test Plan

**DENARIXX_VISION_PROTOTYPE_BASELINE=v0.2.0-hardware-bringup**  
**Date:** 2026-07-10  
**Status:** Engineering test plan — supervised use only

> All scenarios in this plan are supervised engineering tests.  
> Do not test public-road crossing guidance with a blind user during initial bring-up.  
> Do not market the prototype as safe for unsupervised mobility.

---

## Purpose

The HILT test harness records structured diagnostic metrics without storing raw video by default.  
It enables engineers to:
- Validate the hardware bring-up pipeline end-to-end
- Catch latency regressions before user testing
- Generate machine-readable reports for comparison across hardware builds

---

## Metrics Recorded

| Metric | Unit | Budget |
|---|---|---|
| Camera frame rate | fps | ≥ 10 fps |
| Inference latency | ms | ≤ 500 ms |
| Guardian latency | ms | ≤ 200 ms |
| Speech queue delay | ms | ≤ 300 ms |
| Total warning latency | ms | ≤ 1000 ms |
| CPU usage | % | ≤ 85% |
| Memory usage | MB | ≤ 3072 MB |
| Battery drain | %/hour | measured only |
| Temperature | °C | ≤ 80°C |
| Sensor health score | 0–100 | ≥ 70 |
| Dropped frames | count | < 5% per session |
| Provider failures | count | 0 target |

**Raw video is never stored by default.** The `storeRawVideo` field in all HILT report outputs is structurally `false`.

---

## Test Scenarios

### 1. Stationary Indoor Object Detection
**File:** `hiltTestHarnessEngine.ts` scenario: `stationary-indoor`  
**Duration:** 60 seconds  
**Setup:** Glasses stationary, 2–4 known objects in view (chair, person, obstacle box)  
**Pass criteria:**
- Inference latency ≤ 500 ms
- Camera FPS ≥ 10
- Dropped frames < 5%
- At least 1 detection per 3 frames  

**Notes:** No blind user. Engineer observation only. Compare every run against this baseline.

---

### 2. Walking Toward Large Obstacle
**Duration:** 30 seconds  
**Setup:** Controlled indoor space, cardboard box or bollard at 3 m  
**Pass criteria:**
- Obstacle announced before 1 m
- `obstacle-ahead` haptic triggered
- Total warning latency ≤ 1000 ms  

**Notes:** Both start and stop marked with `start-event` / `stop-event` in diagnostic log.

---

### 3. Person Approaching
**Duration:** 20 seconds  
**Setup:** Second engineer walks toward glasses wearer from 5 m in corridor  
**Pass criteria:**
- Person detected at ≥ 3 m
- Directional guidance announced (left/right/ahead)  

---

### 4. Parked Vehicle
**Duration:** 30 seconds  
**Setup:** Private carpark, parked car at 4 m  
**Pass criteria:**
- Vehicle detected
- No false crossing guidance issued ("safe to cross" must never appear)  

**Notes:** Private property only. Not on public road.

---

### 5. Moving Bicycle — Controlled Area
**Duration:** 20 seconds  
**Setup:** Engineer on bicycle crosses path at walking speed in private space  
**Pass criteria:**
- Bicycle detected before crossing path
- `hazard-left` or `hazard-right` haptic triggered depending on approach direction  

---

### 6. Doorway Detection
**Duration:** 20 seconds  
**Setup:** Approach standard doorway opening  
**Pass criteria:**
- Doorway guidance announced
- No obstacle false-positive for the opening  

**Capability note:** Doorway is a heuristic class, not model-supported. Results may vary.

---

### 7. Low-Light Degradation
**Duration:** 60 seconds  
**Setup:** Start with full light, progressively dim to < 5 lux  
**Pass criteria:**
- System announces reduced detection confidence as light drops
- No false "safe" messages
- Frame rate remains ≥ 10 fps (throttled model acceptable)  

**Notes:** Compare detection rate at each lux level vs. baseline. Do not claim night vision without hardware-validated results.

---

### 8. Internet Loss
**Duration:** 30 seconds  
**Setup:** Wi-Fi disconnected mid-session (router disabled or SSID blocked)  
**Pass criteria:**
- Offline announcement within 2 seconds of disconnect
- Local inference continues (no gap in announcements > 5 s)
- No silent substitution with synthetic detections in real-user mode  

---

### 9. Camera Disconnection
**Duration:** 20 seconds  
**Setup:** Camera cable pulled or software-disabled via V4L2  
**Pass criteria:**
- Camera failure announced immediately
- `device-failure` haptic triggered
- System does not continue as if camera is present  

---

### 10. Low Battery Simulation
**Duration:** 60 seconds  
**Setup:** Battery level software-set to 15%, 8%, 4%  
**Pass criteria:**
- Low battery announced at 20%
- Critical announced at 10%
- Emergency announced at 5%
- `low-battery` haptic pattern triggered at each threshold  

---

### 11. Overheating Simulation
**Duration:** 60 seconds  
**Setup:** Temperature sensor reading software-set to 70°C, 80°C, 90°C  
**Pass criteria:**
- Throttle announced at 80°C
- Shutdown announced at 90°C
- `device-failure` haptic triggered  

**Notes:** Do not actually overheat prototype hardware. Software simulation only.

---

### 12. Audio Failure with Haptic Fallback
**Duration:** 30 seconds  
**Setup:** Audio output disabled mid-session (ALSA device closed)  
**Pass criteria:**
- Audio failure announced before disabling (so user knows)
- Haptic patterns continue for all critical alerts
- `stop-immediately` haptic fires on next critical detection  

**Notes:** Do not rely on haptics alone for complex navigation instructions.

---

## Machine-Readable Output Format

Each HILT session produces a JSON report. Example:

```json
{
  "sessionId": "hilt-2026-07-10-001",
  "scenario": "stationary-indoor",
  "durationMs": 60000,
  "frameCount": 600,
  "droppedFrames": 12,
  "droppedFramePct": 2.0,
  "providerFailures": 0,
  "storeRawVideo": false,
  "generatedAt": 1752163200000,
  "allBudgetsPassed": true,
  "failedBudgets": [],
  "summaries": [
    {
      "metric": "inference-latency-ms",
      "sampleCount": 600,
      "min": 45,
      "max": 312,
      "avg": 128,
      "p95": 245,
      "unit": "ms",
      "passedBudget": true,
      "budget": 500
    },
    {
      "metric": "camera-fps",
      "sampleCount": 600,
      "min": 9.8,
      "max": 14.9,
      "avg": 12.3,
      "p95": 10.1,
      "unit": "fps",
      "passedBudget": true,
      "budget": 10
    }
  ]
}
```

Report is generated by `buildFullReport()` in `src/engines/hiltTestHarnessEngine.ts`.

---

## Running the HILT Test

```bash
# Simulation mode (no hardware required)
DENARIXX_HAL_ADAPTER=simulation-test npx tsx src/runtime/startPrototypeRuntime.ts

# Embedded prototype (physical hardware connected)
DENARIXX_HAL_ADAPTER=embedded-prototype npx tsx src/runtime/startPrototypeRuntime.ts

# Dedicated test suite (mocked hardware)
cd denarixx && npx tsx tests/hardwareBringup.test.ts
```

---

## Safety Rules

1. All scenarios require an engineer supervisor present.
2. No blind users during initial bring-up.
3. No public road testing of crossing guidance.
4. Raw video is never stored by default.
5. "Safe to cross" language is permanently prohibited — confirmed in `guardianWordingEngine.ts`.
6. Physical prototype must not be used unsupervised until real-user safety pilot completes.

---

## Before Moving to User Pilot

All of the following must be complete:

- [ ] All 12 HILT scenarios pass on physical hardware
- [ ] Inference latency ≤ 500 ms p95 confirmed on device
- [ ] Haptic patterns confirmed felt by 3+ engineers
- [ ] Bone-conduction audio intelligibility confirmed in quiet environment
- [ ] No silent simulation fallback observed in 60-minute soak test
- [ ] Emergency stop haptic + announcement tested 10× in succession
- [ ] Battery runtime ≥ 3 hours confirmed with real battery
- [ ] Thermal throttle tested to 80°C without safety failure

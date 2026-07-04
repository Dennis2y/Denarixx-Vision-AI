# V15 — On-Device AI Optimization

## Overview

Phase 15 adds a full on-device AI optimization layer to Denarixx Vision AI. The platform can now classify battery state, select the best available model runtime, track latency budgets, and route critical safety alerts to a local/edge inference path — independent of cloud availability.

> **Simulation mode only.** Model inference is simulated. No real TensorFlow.js, ONNX Runtime, or WebGPU execution happens in V15. The runtime registry, latency estimates, and FPS figures are aspirational targets based on published benchmarks.

---

## Files Added

| File | Purpose |
|---|---|
| `src/types/onDeviceAI.ts` | All V15 types — `ModelRuntime`, `BatteryMode`, `LatencyBudget`, `PerformanceDashboard`, `OFFLINE_SAFETY_MESSAGE` |
| `src/engines/onDeviceAIEngine.ts` | Runtime abstraction, offline-first safety path, cloud status |
| `src/engines/modelOptimizationEngine.ts` | Model registry, quantization strategy, model selection |
| `src/engines/edgeInferenceEngine.ts` | Edge inference pipeline, frame skipping, performance dashboard |
| `src/engines/latencyBudgetEngine.ts` | Latency budgeting, recording, analysis, critical alert timing |
| `src/engines/batteryOptimizationEngine.ts` | Battery mode classification, adaptive profiles, thermal adjustment |
| `src/app/performance/page.tsx` | Live performance dashboard at `/performance` |
| `tests/onDeviceAI.test.ts` | Comprehensive engine tests |
| `docs/V15_ON_DEVICE_AI_OPTIMIZATION.md` | This file |

---

## Architecture

```
BatteryOptimizationEngine   ←─ classifyBatteryMode, profile, FPS, cloud pause
         │
         ├── OnDeviceAIEngine     ←─ runtime selection, offline path, cloud status
         ├── ModelOptimizationEngine  ←─ model registry, quantization, latency estimate
         ├── EdgeInferenceEngine  ←─ frame pipeline, skip logic, performance dashboard
         └── LatencyBudgetEngine  ←─ budget, recording, critical alert timing

Output → Vision Inference · Cognitive Guardian · Spatial Reasoning ·
         Navigation Intelligence · Audio Guidance
```

All engines are **pure functions** — no async, no I/O, fully testable.

---

## Model Runtime Registry

| Runtime | Availability | Est. Latency | Est. FPS | Power |
|---|---|---|---|---|
| Browser JS | ✅ Available | 800ms | 1.2 | ❌ |
| TensorFlow.js | ⏳ Placeholder | 250ms | 4 | ❌ |
| ONNX Runtime | ⏳ Placeholder | 90ms | 11 | ✅ |
| WebGPU | ⏳ Placeholder | 35ms | 28 | ✅ |
| Apple Neural Engine | ⏳ Placeholder | 8ms | 125 | ✅ |
| Qualcomm NPU | ⏳ Placeholder | 12ms | 83 | ✅ |

Runtimes marked `Placeholder` require real SDK integration before they can run inference.

---

## Battery Optimization Profiles

| Mode | Trigger | Target FPS | Cloud | Local Priority |
|---|---|---|---|---|
| Performance | >60% or charging | 10 fps | ✅ Active | No |
| Balanced | 30–60% | 5 fps | ✅ Active | No |
| Power Saver | 10–30% | 2 fps | ⏸ Paused | Yes |
| Critical | <10% | 1 fps | ⏸ Paused | Yes |

**FPS near hazard:** Doubled (capped at 15) in Performance, Balanced, and Power Saver modes.

**Thermal adjustment:** `warm` → step down 1 level; `hot` → step down 2 levels.

---

## Latency Budget

```
Perception (object detection)  150ms
Reasoning (cognitive guardian) 100ms
Speech (TTS synthesis)         200ms
─────────────────────────────────────
Total budget                   450ms
Critical alert target          500ms  ← hard cap, never relaxed
```

Critical alert path must complete in ≤500ms. This is checked by `isCriticalAlertOnTime()` and reported in the dashboard.

Battery-adjusted budgets scale non-critical components but **never** relax the 500ms critical target.

---

## Quantization Strategy

| Battery Mode | Quantization |
|---|---|
| Performance | None (FP32) |
| Balanced | Float16 |
| Power Saver | INT8 |
| Critical | INT4 |

---

## Offline-First Safety Path

```
Cloud unavailable (offline/degraded)
  → initOfflineSafetyPath() activates
  → Speech: "Online AI is unavailable. Local safety mode is active."
  → localDetectionEnabled, localNavigationEnabled, localSpeechEnabled all true

Detected hazard (no cloud):
  buildOfflineFallbackGuidance(label) → specific safety instruction
    car → "Vehicle nearby. Stop and check carefully before crossing."
    stairs → "Stairs ahead. Use the handrail."
    person → "Person ahead. Slow down."
    construction_barrier → "Construction ahead. Follow alternate route."
    bicycle → "Bicycle nearby. Stay to the right."
    unknown → "Obstacle detected. Proceed carefully."
```

**Safety guarantee:** Cloud unavailability never causes a silent failure. The offline path always produces guidance.

---

## Processing Mode Selection

| Situation | Mode |
|---|---|
| Critical alert + `criticalAlertsLocal: true` | `local` |
| Cloud offline | `local` |
| Cloud degraded | `edge` |
| `offlineFirst: true` | `edge` |
| Normal (cloud online) | `hybrid` (default) |

---

## Performance Dashboard (`/performance`)

Live controls:
- Battery slider (1–100%) + charging toggle
- Cloud status selector (online/degraded/offline)

Live display:
- FPS, inference time, battery mode, selected runtime
- Cloud/offline status, local safety active flag
- Cloud reasoning paused indicator
- Model name, quantization, memory footprint
- Runtime registry table (all 6 runtimes, status, latency)
- Live edge detections per tick
- Latency report (avg, max, min, budget exceeded %)

---

## Integration Points

| Downstream | Data Provided |
|---|---|
| Vision Inference Engine | `processingMode` routes to edge or cloud pipeline |
| Cognitive Guardian | `shouldPauseCloudReasoning()` controls heavy reasoning |
| Spatial Reasoning Engine | `getRecommendedFPS()` controls how often spatial map updates |
| Navigation Intelligence | `selectProcessingMode()` routes nav ticks locally when offline |
| Audio Guidance | `buildOfflineFallbackGuidance()` provides speech when cloud unavailable |

---

## What Is Simulated vs Real

| Feature | V15 Status |
|---|---|
| Battery mode classification | ✅ Real logic |
| Runtime registry + selection | ✅ Real logic |
| Latency budget tracking | ✅ Real logic |
| Offline safety path | ✅ Real logic |
| Model selection + quantization | ✅ Real logic |
| Actual model inference | ❌ Simulated |
| TensorFlow.js execution | ❌ Not integrated |
| ONNX Runtime Web | ❌ Not integrated |
| WebGPU backend | ❌ Not integrated |
| Apple Neural Engine / Core ML | ❌ Not integrated |
| Qualcomm HTP / Hexagon DSP | ❌ Not integrated |
| Real battery API | ❌ Browser `getBattery()` available via V7 useDeviceSensors |

---

## Future Integration

1. **TensorFlow.js** — `@tensorflow/tfjs-core` + WebGL backend
2. **ONNX Runtime Web** — `onnxruntime-web` WASM backend
3. **WebGPU** — via `@tensorflow/tfjs-backend-webgpu` or native ONNX WebGPU
4. **Battery API** — wire `V7.useDeviceSensors().battery.level` into `classifyBatteryMode()`
5. **Thermal API** — not yet standardised; proxy via device temperature sensor
6. **Model caching** — Cache-API or IndexedDB for offline model weights

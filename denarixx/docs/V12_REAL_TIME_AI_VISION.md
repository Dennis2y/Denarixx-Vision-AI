# V12 — Real-Time AI Vision Engine

## Overview

Phase 12 introduces a full real-time computer vision perception pipeline into Denarixx Vision AI. The system detects objects, tracks them across frames, estimates depth, understands scenes, and produces smart audio guidance — all with swappable AI model providers.

> **Simulation mode is the default.** Real providers (OpenAI, Gemini, ONNX, YOLO) are plugged in by setting the provider in the pipeline config. No code changes needed.

> **Privacy first.** No video is stored. No faces are identified. No data leaves the device.

---

## Architecture

```
Camera Frame
    │
    ▼
cameraPipelineEngine  ←─ FPS throttling, adaptive frame skipping
    │
    ▼
modelManagerEngine    ←─ Provider selection (simulation / openai / gemini / onnx / yolo / rtdetr / sam)
    │
    ▼
visionInferenceEngine ←─ Raw object detections + confidence
    │
    ▼
depthReasoningEngine  ←─ Depth estimate (collision / near / walking_distance / medium / far)
    │                    Object priority (critical / high / medium / low / ignore)
    ▼
objectTrackingEngine  ←─ IoU matching, stable track IDs, velocity, position prediction
    │
    ▼
sceneUnderstandingEngine ←─ Scene type, crowding, movement, lighting
    │
    ▼
visionInferenceEngine ←─ Speech guidance selection (smart silence by default)
    │
    ▼
PerceptionFrame       ←─ Full result: objects + scene + guidance + metrics
```

---

## New Files

| File | Purpose |
|---|---|
| `src/types/vision12.ts` | All V12 types — separate from `vision.ts` (V4) to avoid breaking existing providers |
| `src/engines/visionInferenceEngine.ts` | Top-level orchestrator: simulation, prioritization, speech guidance, frame building |
| `src/engines/sceneUnderstandingEngine.ts` | Scene classification from object patterns |
| `src/engines/objectTrackingEngine.ts` | IoU multi-object tracking, velocity, position prediction |
| `src/engines/depthReasoningEngine.ts` | Depth from bounding box + object priority assignment |
| `src/engines/cameraPipelineEngine.ts` | FPS targeting, frame skipping, adaptive throttling, metrics |
| `src/engines/modelManagerEngine.ts` | Model registry, availability, provider recommendation |
| `src/app/vision/page.tsx` | Live AI Vision page |
| `tests/visionPipeline.test.ts` | Comprehensive engine unit tests |
| `docs/V12_REAL_TIME_AI_VISION.md` | This file |

---

## Object Detection

**16 supported labels:**
`person`, `chair`, `table`, `car`, `bike`, `stairs`, `door`, `traffic_light`, `crosswalk`, `dog`, `bag`, `tree`, `sign`, `shopping_cart`, `wheelchair`, `construction_barrier`

**Priority assignment** (from `depthReasoningEngine`):

| Label | Near/Collision | Medium | Far |
|---|---|---|---|
| car, stairs, construction_barrier, traffic_light, crosswalk | **critical** | high | ignore |
| person, door, wheelchair | **high** | medium | ignore |
| chair, table, dog, shopping_cart, bike | **medium** | medium | ignore |
| bag, tree, sign | **low** | low | ignore |

---

## Depth Estimation

Derived from normalized bounding box area (no separate depth sensor required):

| Area | Depth | Distance |
|---|---|---|
| > 25% | collision | ~0.5 m |
| > 10% | near | ~1.5 m |
| > 4% | walking_distance | ~3 m |
| > 1% | medium | ~6 m |
| ≤ 1% | far | ~12 m |

---

## Object Tracking (IoU)

- Intersection-over-Union (IoU) threshold: **0.25**
- History window: **10 frames** per track
- Lost frames before pruning: **5 frames**
- Track IDs are stable across frames (e.g. `T001`, `T002`)
- Velocity estimated from last 3 frames (smoothed)
- Next position predicted from velocity × frames ahead

---

## Scene Understanding

Scene classified from object co-occurrence patterns:

| Scene | Key Indicators |
|---|---|
| street | car × 2, traffic_light, crosswalk |
| supermarket | shopping_cart × 2 |
| corridor | door × 2, person |
| office | chair + table + door |
| park | tree × 2, dog |
| restaurant | chair + table × 2 |

---

## Smart Speech

**Principle: speak only when useful. Remain quiet otherwise.**

- Speech cooldown: 3 seconds minimum between messages
- "Clear path" announced after 8+ seconds of silence
- Only `critical` and `high` priority objects trigger speech
- Medium / low / ignore objects are observed but never announced

Example outputs:
```
"Vehicle approaching."
"Stairs ahead — caution."
"Door ahead."
"Vehicle — stop immediately."
"Clear path."
```

---

## Provider System

| Provider | Status | Avg Latency | Cloud |
|---|---|---|---|
| simulation | ✅ Available | ~20ms | No |
| openai (GPT-4o) | 🔐 Requires key | ~1200ms | Yes |
| gemini | 🔐 Requires key | ~900ms | Yes |
| onnx (MobileNet) | 🔜 Future | ~80ms | No |
| yolo (v8n) | 🔜 Future | ~30ms | No |
| rtdetr-l | 🔜 Future | ~45ms | No |
| sam (ViT-B) | 🔜 Future | ~200ms | No |

Switch providers without changing UI code — set `config.provider`.

---

## Performance

**Target:** < 500ms perception cycle

| Battery Mode | FPS | Interval |
|---|---|---|
| performance | 10 fps | 100ms |
| balanced | 5 fps | 200ms |
| power_save | 2 fps | 500ms |

**Adaptive FPS:** battery < 20% → max 3fps; battery < 10% → max 2fps.

**Frame skipping:** any frame arriving before the target interval is dropped (not processed). Metrics track `framesSkipped` and `droppedFrames` separately.

---

## Privacy Guarantees

```
noCloudStorage:        true — no frame data is ever uploaded
noRecording:           true — no video or audio is saved to disk
noFaceRecognition:     true — face detection is disabled at model level
noIdentityRecognition: true — no person is identified or named
```

These are enforced in `PIPELINE_PRIVACY` (const, not configurable) and embedded in every `PipelineConfig`.

---

## Test Results

`npx tsx tests/visionPipeline.test.ts` — all tests must pass before release.

---

## Future Optimization

1. **WebGL / WebGPU inference** — run ONNX models in browser GPU context
2. **Worker thread isolation** — move inference off main thread
3. **Streaming frame buffer** — double-buffer to hide inference latency
4. **YOLO v8 + WebAssembly** — sub-30ms inference on-device
5. **Depth from stereo** — use front+rear camera parallax for metric depth
6. **SAM segmentation** — replace bounding boxes with pixel-precise masks for better path planning

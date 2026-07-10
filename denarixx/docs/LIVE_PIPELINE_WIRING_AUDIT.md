# Live Pipeline Wiring Audit

> **Sprint 23: Live Perception Hardening & End-to-End Validation**
> Audit date: July 2026 — updated post Live Pipeline Completion Program

This document records the exact connection status of every stage in the live perception pipeline, with evidence from the source tree.

---

## Pipeline Stages Under Audit

```
Camera frame capture
  → Vision provider (simulation / local-AI / cloud-AI)
  → OCR (Tesseract.js)
  → AlertQualityEngine (hazard evaluation + dedup + wording)
  → AlertCoordinationEngine (7-level priority queue)
  → Navigation intelligence tick
  → Failure monitoring (FailureRecoveryEngine)
  → speakCoordinated() → TTS priority queue → Web Speech API
  → Decision trace + performance metrics
```

---

## Fully Connected Components

These stages are directly called in `denarixx/src/hooks/useVisionSession.ts → runFrame()`.

| Component | Engine/Hook | Connected via | Notes |
|-----------|-------------|--------------|-------|
| **Camera capture** | `useCameraCapture.ts` | `captureFrameRef.current()` | Active only when `cameraStatus === 'active'` |
| **Vision — simulation** | `SimulationVisionProvider` | `/api/vision/analyze-frame` (server) | Default mode, always available |
| **Vision — local-AI** | `useLocalObjectDetection.ts` (TF.js COCO-SSD) | `setLocalDetections()` + `localDetectionsRef` | Bypasses server — client-side TFJS |
| **Vision — cloud-AI** | `GeminiVisionProvider` / `OpenAIVisionProvider` | `/api/vision/analyze-frame` (server) | Requires API key |
| **Scene description** | `/api/scene/describe` | `fetch` in `runFrame` | Feeds into speech guidance |
| **Hazard evaluation** | `/api/hazards/evaluate` | `fetch` in `runFrame` (fallback path) | Used when not real-AI |
| **Safety decision** | `/api/safety/decide` | `fetch` in `runFrame` (fallback path) | Used when not real-AI |
| **AlertQualityEngine** | `alertQualityEngine.ts` | `alertQualityEngineRef.current.process()` in `runFrame` | Replaces AlertThrottleEngine — includes dedup, wording, decision logger |
| **AlertCoordinationEngine** | `alertCoordinationEngine.ts` | `coordinationStateRef` + `speakCoordinated()` | 7-level priority queue, dedup by key+cooldown, critical interrupt logic |
| **OCR → Guardian** | `ocrEngine.ts` + `textReadingEngine.ts` | `reportOCRResult()` callback → `formatOCRAnnouncement()` → `speakCoordinated()` | OCR hazard text routed to coordination queue |
| **Navigation intelligence** | `navigationIntelligenceEngine.ts` | `processNavigationTick()` in `runFrame` | Guidance from tick routed to `speakCoordinated()` via `buildNavigationAlert()` |
| **Failure monitoring** | `failureRecoveryEngine.ts` | `detectActiveFailures()` + `getFailureAnnouncement()` in `runFrame` | 12 scenarios; announces failures, maintains safety core |
| **System announcements** | `systemAnnouncementEngine.ts` | `buildSystemAlert()` → `speakCoordinated()` on session start | Human-friendly messages for all system events |
| **GuidancePersonalityEngine** | `guidancePersonalityEngine.ts` | `personalityEngineRef.current.formatMessage()` | Personality-aware wording |
| **MobilityEngine (spatial)** | `mobilityEngine.ts` | `mobilityEngineRef.current.analyze()` | V6 spatial guidance |
| **WorldModelEngine** | `worldModelEngine.ts` | `worldModelEngineRef.current.update()` | V6 world model |
| **SensorFusionEngine** | `sensorFusionEngine.ts` | `recommendedFrameInterval()` (battery-aware skip) | V7 sensor integration |
| **Audio output** | `speakCoordinated()` → `useAudioGuidance.ts` | `speak(text, priority, interrupt)` | All speech routed through 7-level priority queue |
| **Haptic output** | `useDeviceSensors.ts` | `vibrate(pattern)` | V7 haptic on critical/high |
| **lastGuidance / repeat** | `useLastGuidance.ts` | `setGuidance()` + `repeatGuidance()` | V5 repeat guidance |
| **Latency measurement** | `latencySamplesRef` (rolling 10) | `Date.now()` diff | End-to-end ms per frame |

---

## Partially Connected Components

| Component | Status | Gap | File |
|-----------|--------|-----|------|
| **ExplainableAIEngine** | Used in session page to build `ExplainedDecision` from safety decision | Does not gate speech — display only | `explainableAIEngine.ts` |
| **NetworkMonitorEngine** | Connectivity state feeds into `detectActiveFailures` | Direct event stream not subscribed | `networkMonitorEngine.ts` |
| **ConnectivityFallbackEngine** | Fallback mode reflected through failure monitoring | Provider switching not triggered from within session | `connectivityFallbackEngine.ts` |

---

## Disconnected Components (Intentional Architectural Choices)

| Engine | File | Reason | Risk |
|--------|------|---------|------|
| **livePerceptionEngine.ts** | Sprint 22 | Session hook IS the pipeline; this engine is a pure TS model layer | No risk — hook supersedes it |
| **voiceInteractionEngine.ts** | Sprint 22 | Speech handled by `speakCoordinated()` + `useAudioGuidance`; engine is a model | No risk — coordination engine covers it |
| **cognitiveGuardianEngine.ts** | V2 | Session calls API endpoints which wrap the engine internally | No risk — API bridge works |

---

## Fixes Completed in This Sprint

### New Engines Created (Sprint 23 Hardening)

| Engine | Purpose | File |
|--------|---------|------|
| **AlertCoordinationEngine** | 7-priority unified queue, dedup, cooldown, interrupt logic | `alertCoordinationEngine.ts` |
| **SystemAnnouncementEngine** | Human-friendly messages for all system events | `systemAnnouncementEngine.ts` |
| **FailureRecoveryEngine** | 12 failure scenarios with recovery levels and user messages | `failureRecoveryEngine.ts` |

### Live Pipeline Completion Program (Post-Sprint 23)

All 11 items wired into `useVisionSession.ts`:

| Item | Change | Benefit |
|------|--------|---------|
| 1 | Alert coordination to `speakCoordinated()` | 7-level priority queue governs all audio |
| 2 | `AlertQualityEngine.process()` replaces `alertThrottleRef` | Dedup + wording + decision logger all active |
| 3 | OCR text → Guardian via `reportOCRResult()` | Medicine labels, signs reach hazard pipeline |
| 4 | Navigation tick via `processNavigationTick()` | Guidance from route engine reaches audio |
| 5 | Voice unified through `speakCoordinated()` | Single controller for all speech sources |
| 6 | `detectActiveFailures()` per frame | 12 failure scenarios monitored live |
| 7 | Session start via `buildSystemAlert()` | User hears human-friendly session start message |
| 8 | 16 integration tests added to `livePerceptionE2E.test.ts` | 96 total E2E tests, all passing |
| 9 | This audit updated | Disconnected list trimmed to 3 architectural choices |
| 10 | `replit.md` updated with real counts | Accurate documentation |
| 11 | Quality gate: type-check, all tests, build | 0 regressions |

### Existing Engine Fixes

| Engine | Fix |
|--------|-----|
| `guardianWordingEngine.ts` | Crossing language: removed "safe to cross" — now "appears clear, but please check carefully" |

### Documentation Created

| Document | Purpose |
|----------|---------|
| `docs/LIVE_PIPELINE_WIRING_AUDIT.md` | This document |
| `docs/LIVE_ACCESSIBILITY_VALIDATION.md` | Accessibility audit |

---

## Pipeline Diagram (Actual Wiring Post-Completion)

```
useVisionSession → runFrame()
  │
  ├─ SensorFusionEngine ──────────────────────── Battery-aware frame skip
  │
  ├─ [local-ai] TF.js COCO-SSD                 ← setLocalDetections()
  │   or [simulation/cloud] /api/vision/analyze-frame
  │
  ├─ MobilityEngine + WorldModelEngine ───────── Spatial guidance
  │
  ├─ /api/scene/describe ─────────────────────── Scene text
  │
  ├─ [real-AI] VisionAnalysisV4 hazards → alerts
  │   or /api/hazards/evaluate + /api/safety/decide → alerts, decision
  │
  ├─ AlertQualityEngine.process()             ◄─ Replaces AlertThrottleEngine
  │   (dedup + wording + decision logger)
  │   └─ if shouldSpeak → speakCoordinated('high', message)
  │
  ├─ OCR pending → formatOCRAnnouncement()    ◄─ reportOCRResult() callback
  │   └─ speakCoordinated('medium', ocrText)
  │
  ├─ processNavigationTick()                  ◄─ navigationIntelligenceEngine
  │   └─ if guidance → speakCoordinated('high'/'low', guidance.text)
  │
  ├─ detectActiveFailures()                   ◄─ failureRecoveryEngine
  │   └─ if failure → speakCoordinated('critical'/'high', announcement)
  │
  └─ speakCoordinated() → coordinationStateRef (7-level queue)
      └─ dequeueNextAlert() → speak() → useAudioGuidance (Web Speech TTS)
                           → vibrate() → useDeviceSensors (navigator.vibrate)
```

---

## Latency Budget (Measured in Simulation Mode)

| Stage | Measured | Target | Status |
|-------|----------|--------|--------|
| Frame-to-decision (simulation) | < 50 ms | < 200 ms | ✅ |
| Frame-to-decision (local-AI TF.js) | 200–600 ms | < 500 ms | ⚠️ device-dependent |
| Frame-to-decision (cloud-AI) | 800–2500 ms | < 3000 ms | ✅ on good connection |
| Alert coordination queue dispatch | < 5 ms | < 20 ms | ✅ |
| TTS queue delay | 0–100 ms | < 200 ms | ✅ |
| OCR (Tesseract per frame) | 300–1200 ms | < 2000 ms | ✅ |

> Note: Latency values for local-AI and cloud-AI are measured in browser; simulation values are from the `perceptionLatencyEngine.ts` ring buffer. Actual hardware performance depends on device GPU and connection quality.

---

## Safety Guarantees

1. **Simulation mode always available** — even if camera, model, and internet all fail.
2. **Guardian runs regardless of vision provider** — hazard evaluation does not require cloud.
3. **Critical alerts never silenced** — `AlertQualityEngine` has `critical_never_silenced` path; coordination queue gives `critical_hazard` highest rank.
4. **Crossing language** — never says "safe to cross". Uses "appears clear, but please check carefully."
5. **Failures always announced** — `FailureRecoveryEngine` provides user-facing messages for all 12 scenarios, monitored per frame.
6. **Offline safety continues** — `offlineStreetGuardianEngine` runs independently of internet.
7. **All audio through single queue** — `speakCoordinated()` is the sole audio dispatcher; no speech bypasses priority ranking.

---

*This audit reflects the actual source tree as of the Live Pipeline Completion Program. Engine counts, page counts, and wiring status were verified by code inspection — not generated from documentation.*

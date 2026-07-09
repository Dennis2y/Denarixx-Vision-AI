# Real Perception Integration Guide

> **Sprint 22: Real Perception Integration Program**
> Date: July 2026

This document describes the full live perception pipeline — from camera capture through object detection, OCR, Guardian evaluation, navigation, and voice output.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                  Live Perception Pipeline                    │
│                                                              │
│  Camera ──► Vision Provider ──► OCR ──► Guardian            │
│                │                  │         │                │
│                ▼                  ▼         ▼                │
│            Detections         TextReading  Alerts            │
│                │                  │         │                │
│                └──────────────────┴─────────┘                │
│                                  │                           │
│                             Navigation                       │
│                                  │                           │
│                           Voice Output (TTS)                 │
│                                                              │
│  ◄── Latency measured at each stage ──►                      │
└──────────────────────────────────────────────────────────────┘
```

All stages are optional and can fall back gracefully. Simulation Mode uses the same pipeline with synthetic inputs — no camera, API key, or internet required.

---

## Pipeline Modes

| Mode | Camera | Vision AI | OCR | Guardian | Notes |
|------|--------|-----------|-----|----------|-------|
| **Simulation** | No | Synthetic | No | Yes | Default. Safe fallback. |
| **Live** | Yes | Real AI | Optional | Yes | Full real-time perception. |
| **Hybrid** | Yes | Real AI | Optional | Yes | Falls back to simulation on failure. |

Select mode in **Settings → AI Vision Mode**.

---

## Phase 1 — OCR

### New Engines

| Engine | File | Description |
|--------|------|-------------|
| OCR Engine | `ocrEngine.ts` | Provider abstraction. Tesseract + None providers. |
| Text Reading Engine | `textReadingEngine.ts` | Domain-aware text analysis and TTS announcements. |

### Text Domains

| Domain | Trigger | Priority | Announcement Style |
|--------|---------|----------|--------------------|
| `sign` | "STOP", "EXIT", "NO" | `normal` → `high`/`critical` if hazard | "Sign reads: STOP" |
| `menu` | "calories", "allergen" | `low` | "Menu: Salad, £6.50…" |
| `medicine` | "mg", "tablet", "dose" | `high` | "Medicine label: 500mg… verify with pharmacist." |
| `street` | "st", "ave", "rd", "mph" | `normal` | "Street name: Baker Street" |
| `receipt` | "total", "subtotal" | `low` | "Receipt. Total: £4.95" |
| `document` | "dear", "subject", "date" | `low` | "Document text: …" |
| `general` | (fallback) | `low` | "I can read: …" |

### Hazard Keywords

Any text containing these words triggers `high` or `critical` priority:

```
STOP · DANGER · WARNING · CAUTION · EXIT · EMERGENCY
POISON · TOXIC · HOT · RESTRICTED · NO ENTRY · KEEP OUT
HIGH VOLTAGE · FLAMMABLE · BIOHAZARD
```

`DANGER`, `POISON`, `TOXIC`, `HIGH VOLTAGE`, and `BIOHAZARD` trigger `critical` priority (interrupt all speech).

### OCR Providers

| Provider | Status | Notes |
|----------|--------|-------|
| `tesseract` | ✅ Available | Tesseract.js v5, WebAssembly, on-device, no API key |
| `cloud-vision` | 🔶 Planned | Google Cloud Vision API — requires API key |
| `none` | ✅ Available | OCR disabled, NullProvider returns empty |

Providers are selected via `settingsStore.ocrProvider`. The hook (`useOCR.ts`) injects the real Tesseract worker into the engine's `TesseractOCRProvider` via `injectRecognizeFn`.

---

## Phase 2 — Speech

### New Engines

| Engine | File | Description |
|--------|------|-------------|
| Speech Recognition Engine | `speechRecognitionEngine.ts` | STT provider abstraction, wake word, emergency detection |
| Text-to-Speech Engine | `textToSpeechEngine.ts` | Priority queue, interrupt, streaming, emergency bypass |
| Voice Interaction Engine | `voiceInteractionEngine.ts` | Orchestrates STT + TTS + wake word + emergency mode |

### Reused (not duplicated)

- `voiceCommandEngine.ts` — command parsing (30+ intents)
- `guidancePersonalityEngine.ts` — calm/detailed/brief personality styles
- `speechLanguageEngine.ts` — voice selection, pitch/rate/volume
- `useAudioGuidance.ts` — actual `speechSynthesis` browser hook
- `useVoiceCommands.ts` — actual `SpeechRecognition` browser hook

### Priority Queue

All TTS announcements pass through a priority queue before speaking:

| Priority | Weight | Interrupt? | Use case |
|----------|--------|------------|----------|
| `critical` | 4 | Always | Hazards: DANGER, POISON, imminent collision |
| `high` | 3 | If queue empty | Important: approaching person, medicine label |
| `normal` | 2 | No | Regular: sign, street name, scene update |
| `low` | 1 | No | Background: receipt total, menu, ambient |

Critical items always interrupt any currently-speaking audio. They also clear `low` and `normal` items from the queue.

### Wake Word

The wake word (`"Hey Aria"`) is disabled by default. Enable in Settings → Wake Word.

- After detection: 3-second cooldown before listening again
- Wake word is stripped from the transcript before command parsing
- State machine: `idle → cooldown → idle` (no persistent "listening" mode to preserve battery)

### Offline Placeholder

Offline STT (`offline-stt` provider) is implemented as a stub with `isAvailable = false`. It logs a clear note about the current limitation. Future implementation: WebAssembly Whisper.

### Emergency Speech

Emergency phrases bypass the queue and interrupt immediately:
```
"emergency stop" · "stop everything" · "help" · "danger"
"call 999" · "call 911" · "call ambulance"
```

---

## Phase 3 — Live Perception Pipeline

### livePerceptionEngine.ts

Orchestrates all stages. Each frame runs:

1. **Camera** — capture frame from `useLocalObjectDetection` or `useCameraCapture`
2. **Vision** — TF.js COCO-SSD (local) or Gemini/OpenAI (cloud) or simulation
3. **OCR** — Tesseract.js reads text from frame (optional, every 15 s)
4. **Guardian** — `cognitiveGuardianEngine` evaluates detections → alerts
5. **Navigation** — `navigationIntelligenceEngine` updates route guidance
6. **Voice** — TTS queue speaks highest-priority item

### Failure Recovery

Each stage can fail independently. The pipeline continues with available stages:

| Failure | Recovery Action |
|---------|----------------|
| Camera denied | Fallback to simulation mode |
| Vision model fails | Fallback to simulation detections |
| OCR worker fails | Skip OCR for this frame; retry next interval |
| Guardian error | Use last known alert state |
| Navigation error | Skip navigation update |
| TTS error | Log silently; next item attempted |

All failures are recorded in `session.failureLog`. Provider switches are recorded in `session.switchLog`.

---

## Phase 4 — Provider Settings

All providers are selectable in **Settings**:

| Setting | Key | Options |
|---------|-----|---------|
| Perception Mode | `perceptionMode` | `simulation` / `live` / `hybrid` |
| Vision Provider | `visionMode` | `simulation` / `local-ai` / `cloud-ai` |
| OCR Provider | `ocrProvider` | `tesseract` / `none` |
| TTS Provider | `speechProvider` | `web-speech` / `none` |
| STT Provider | `sttProvider` | `web-speech` / `none` |
| Wake Word | `wakeWordEnabled` | `true` / `false` |
| Streaming Speech | `streamingSpeech` | `true` / `false` |

All settings persist to `localStorage` via `settingsStore.ts`.

---

## Phase 5 — Performance Measurement

### perceptionLatencyEngine.ts

Measures latency at each pipeline stage. Stores up to 100 frame samples in a ring buffer.

### Latency Targets

| Stage | Excellent | Good | Acceptable | Slow |
|-------|-----------|------|------------|------|
| Camera | < 50ms | < 100ms | < 200ms | > 200ms |
| Vision | < 100ms | < 300ms | < 600ms | > 600ms |
| OCR | < 200ms | < 500ms | < 1000ms | > 1000ms |
| Guardian | < 10ms | < 30ms | < 60ms | > 60ms |
| Navigation | < 10ms | < 30ms | < 60ms | > 60ms |
| Voice | < 50ms | < 100ms | < 200ms | > 200ms |
| **End-to-end** | **< 200ms** | **< 500ms** | **< 1000ms** | **> 1000ms** |

### End-to-End Latency by Mode

| Mode | Expected Latency | Notes |
|------|-----------------|-------|
| Simulation | < 50ms | No camera, no AI inference |
| Local AI (COCO-SSD) | 200–600ms | GPU/WebGL accelerated on modern devices |
| Cloud AI (Gemini) | 800–2500ms | Depends on network and API |

### Report Generation

```typescript
import { generateLatencyReport, describeReport } from '@/engines/perceptionLatencyEngine';

const report = generateLatencyReport(store);
// {
//   sampleCount: 25,
//   avgVisionLatencyMs: 280,
//   avgOcrLatencyMs: 450,
//   avgGuardianLatencyMs: 15,
//   avgEndToEndLatencyMs: 380,
//   p95EndToEndLatencyMs: 520,
//   mode: 'live'
// }
```

---

## Providers Reference

### Vision Providers (reused from visionProviderFactory.ts)

| Provider | Key | Notes |
|----------|-----|-------|
| Simulation | `simulation` | Synthetic detections, always available |
| TF.js COCO-SSD | `local-ai` | On-device, 80 classes, no API key |
| Gemini Vision | `gemini` | Requires `GEMINI_API_KEY` |
| OpenAI Vision | `openai` | Requires `OPENAI_API_KEY` |

### OCR Providers

| Provider | Key | Notes |
|----------|-----|-------|
| Tesseract.js | `tesseract` | On-device WebAssembly, English default |
| None | `none` | OCR disabled |

### TTS Providers

| Provider | Key | Notes |
|----------|-----|-------|
| Web Speech API | `web-speech` | Real. Chrome, Edge, Firefox, Safari |
| Offline TTS | `offline-tts` | Planned — WebAssembly TTS |
| None | `none` | Silent mode |

### STT Providers

| Provider | Key | Notes |
|----------|-----|-------|
| Web Speech API | `web-speech` | Real. Chrome and Edge only |
| Offline STT | `offline-stt` | Planned — WebAssembly Whisper |
| None | `none` | Voice commands disabled |

---

## Offline Strategy

| Feature | Online | Offline |
|---------|--------|---------|
| Vision (COCO-SSD) | ✅ | ✅ (on-device) |
| Vision (Cloud) | ✅ | ✗ (fallback to simulation) |
| OCR (Tesseract) | ✅ | ✅ (WebAssembly) |
| TTS | ✅ | ✅ (browser-native) |
| STT | ✅ | ✗ (requires network in current browsers) |
| Guardian | ✅ | ✅ (runs locally) |
| Navigation | ✅ | ✅ (local hazard patterns) |
| GPS | ✅ | ✅ (device GPS) |

The platform uses a glasses-first, cloud-optional architecture. Critical safety functions (Guardian, hazard detection, navigation) are always available offline.

---

## Testing

```bash
cd denarixx && npx tsx tests/realPerception.test.ts
```

Test coverage:
- OCR engine: confidence, domain detection, keyword extraction, hazard detection (12 tests)
- Text reading engine: priority, announcements, domain builders, numbers, abbreviations (16 tests)
- Speech recognition: wake word state machine, emergency detection, providers (18 tests)
- TTS engine: priority queue, interrupt, streaming, preprocessing (20 tests)
- Voice interaction: transcript processing, emergency mode, queue management (18 tests)
- Live perception pipeline: session lifecycle, provider switching, failure recovery (20 tests)
- Latency engine: frame metrics, report generation, grading, percentiles (18 tests)

---

## Safety Guarantees

1. **Critical alerts always speak** — bypass throttle, interrupt current audio
2. **OCR is advisory only** — always appended with confidence level
3. **Medicine labels** — always remind user to verify with pharmacist
4. **Crossing** — never says "safe to cross" (inherited from crossingDecisionEngine.ts)
5. **Simulation mode always available** — even if camera/AI/internet fails
6. **All providers have a `none` fallback** — pipeline never hard-fails

---

*Assistive technology. Not a substitute for professional judgement or personal safety awareness.*

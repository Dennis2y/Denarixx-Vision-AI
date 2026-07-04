---
name: V4 Vision Provider System
description: Architecture and key decisions for the Phase 4 real AI provider system.
---

## Key design decision: separate interface

V4 adds a **new** `VisionAnalysisProvider` interface in `src/types/vision.ts` with `analyzeFrameV4()`. This is separate from the existing `VisionProvider` interface in `src/engines/types.ts` (which returns `Detection[]`).

**Why:** Keeps all V1 tests passing without modification. No existing engine code changes. The new interface lives entirely in the new files.

## Provider selection: visionProviderFactory.ts

`getVisionAnalysisProvider()` — module-level singleton, reads `VISION_PROVIDER` env var at first call.
- `simulation` → SimulationVisionProvider (wraps MockVisionProvider, pure synthetic data)
- `openai` → OpenAIVisionProvider (GPT-4o, requires OPENAI_API_KEY; if missing, falls back to simulation)
- `gemini` → GeminiVisionProvider (placeholder, falls back to simulation)
- `local` → LocalVisionProvider (placeholder, falls back to simulation)

## analyze-frame route

Route now calls `getVisionAnalysisProvider()` instead of `getVisionEngine()`. Returns:
- `detections` (= `analysis.objects`) — backward compat for `useVisionSession` hook
- `visionAnalysis` — full VisionAnalysisV4 struct
- `isRealAI`, `usedFallback`, `provider` — promoted to top level for UI

## Fallback guarantee

Any real provider failure → `usedFallback: true`, provider gets `/error-fallback` suffix. Session continues uninterrupted. Never leaves user without guidance.

## Safety hardcoded in OpenAI system prompt

- Face recognition: explicitly disabled in prompt
- Certainty: never expressed — confidence < 0.7 appends "I'm not completely sure"
- Severity values validated/sanitized server-side even after GPT-4o response

## OpenAI call parameters

model: gpt-4o, detail: low, max_tokens: 900, temperature: 0.1, response_format: json_object

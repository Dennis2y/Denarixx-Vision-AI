# Sprint 4 — Real Vision Intelligence

## Objective

Replace simulated scene descriptions with real AI vision analysis while keeping simulation as the automatic fallback when no API key is configured.

## What Changed

### 1. Vision Provider Abstraction (V4 — already existed, extended)

`VisionAnalysisProvider` interface in `src/types/vision.ts` — unchanged interface, extended `VisionAnalysisV4` output type.

### 2. DetectedCategories (new in Sprint 4)

`VisionAnalysisV4` now includes a `categories` field of type `DetectedCategories`:

```typescript
interface DetectedCategories {
  obstacles: Detection[];   // bollards, bins, construction, furniture in path
  people:    Detection[];   // persons, pedestrians
  vehicles:  Detection[];   // cars, buses, bicycles, cyclists, motorcycles
  stairs:    Detection[];   // stairs, steps, escalators, ramps
  doors:     Detection[];   // doors, gates, entrances, exits
  crossings: Detection[];   // road crossings, intersections, zebra crossings
  signs:     Detection[];   // traffic signs, signals, text boards
}
```

Populated automatically by `categorizeDetections()` in every provider.

### 3. categorizeDetections — Pure Helper

`src/engines/providers/categorizeDetections.ts`

- Pure function — no I/O, no browser APIs, importable anywhere
- Maps detection labels (case-insensitive) to the 7 named categories
- Also exports `hasAnyDetections()` and `getPriorityCategory()` helpers
- Priority order (highest → lowest): vehicles > stairs > crossings > obstacles > people > doors > signs

### 4. Provider Implementations

| Provider | Status | Key Required | isRealAI |
|---|---|---|---|
| `SimulationVisionProvider` | ✅ Full (default) | None | `false` |
| `OpenAIVisionProvider` | ✅ Full (GPT-4o) | `OPENAI_API_KEY` | `true` |
| `GeminiVisionProvider` | ✅ Full (gemini-1.5-flash) | `GEMINI_API_KEY` | `true` |
| `LocalVisionProvider` | 🔄 Placeholder | — | `false` |

#### Activating OpenAI Vision

```bash
VISION_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

#### Activating Gemini Vision

```bash
VISION_PROVIDER=gemini
GEMINI_API_KEY=AIza...
```

#### Keeping Simulation (default, no key)

```bash
# No env vars needed — simulation is always the safe fallback
VISION_PROVIDER=simulation   # or leave unset
```

### 5. GeminiVisionProvider — Real Implementation

`src/engines/providers/GeminiVisionProvider.ts`

- Uses `gemini-1.5-flash` via `generativelanguage.googleapis.com` REST API
- Same JSON output schema as OpenAI provider
- `responseMimeType: "application/json"` with markdown stripping fallback
- Falls back to `SimulationVisionProvider` on any API error; sets `usedFallback: true`
- Safety constraints enforced via system prompt (same rules as OpenAI)

### 6. Cognitive Guardian Integration (Sprint 4)

`src/hooks/useVisionSession.ts` — `runFrame()` updated:

**Before:** Every frame called `/api/hazards/evaluate` (simulated detection → alert mapping) + `/api/safety/decide`.

**After:** When `visionAnalysis.isRealAI && !visionAnalysis.usedFallback`:
- `visionAnalysis.hazards` → converted directly to `HazardAlert[]`
- `visionAnalysis.recommendedAction` → becomes the safety decision message
- `/api/hazards/evaluate` and `/api/safety/decide` API round-trips are **skipped**
- Cognitive pipeline (alert throttle, speech, haptics) receives real AI output

When simulation or fallback mode is active, the existing pipeline runs unchanged.

## Safety Constraints (enforced in all real providers)

1. **No face recognition** — system prompt explicitly prohibits identifying people by face, name, or appearance; `ProviderCapabilities.faceRecognition` is always `false`
2. **Hedged language** — "never says safe" rule; confidence < 0.7 triggers uncertainty note
3. **No emergency streaming** — camera frames are analyzed server-side, never stored or transmitted beyond the API call
4. **Simulation fallback** — any API failure silently falls back to simulation; user experience is never broken

## Provider Factory

`src/engines/visionProviderFactory.ts`

```
VISION_PROVIDER=simulation (default) → SimulationVisionProvider
VISION_PROVIDER=openai + OPENAI_API_KEY set → OpenAIVisionProvider
VISION_PROVIDER=openai + no key → SimulationVisionProvider (+ warning log)
VISION_PROVIDER=gemini + GEMINI_API_KEY set → GeminiVisionProvider
VISION_PROVIDER=gemini + no key → SimulationVisionProvider (+ warning log)
VISION_PROVIDER=local → LocalVisionProvider (placeholder → simulation)
VISION_PROVIDER=<unknown> → SimulationVisionProvider (+ warning log)
```

## Tests

`tests/visionProvider.test.ts` — 62 tests

- `categorizeDetections()` — all 7 categories, case-insensitivity, edge cases, confidence preservation
- `hasAnyDetections()` and `getPriorityCategory()` — priority ordering, empty states
- Provider factory — fallback behaviour for missing keys, unknown provider names
- `SimulationVisionProvider` — VisionAnalysisV4 structure, categories field, privacy rules
- Privacy constraints — no face recognition data in any output field

Run:

```bash
cd denarixx && npx tsx tests/visionProvider.test.ts
```

## Architecture Notes

- `VisionAnalysisV4.categories` is derived from `.objects` via `categorizeDetections()`. A detection can appear in at most one logical category per frame (e.g. `bicycle` → `vehicles`, not `obstacles`). Labels matching multiple sets are placed in all matching categories.
- All three real-provider classes share the same JSON output schema and the same safety system prompt template — changes to constraints must be applied to all three.
- The singleton returned by `getVisionAnalysisProvider()` resets on Next.js hot-reload. Use `resetVisionAnalysisProvider()` in tests.
- `LocalVisionProvider` remains a placeholder for future on-device model integration (ONNX, TensorFlow.js, Ollama/LLaVA).
